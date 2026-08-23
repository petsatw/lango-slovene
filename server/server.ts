// Thin backend: holds keys (from .env), runs the turn loop, serves the PWA.
// The browser only ever calls these /api endpoints — keys never leave this process.
//
// Level 1 streaming: /api/turn returns the tutor text fast (E2 only); /api/speak streams the
// Slovenian audio (E3) so the browser plays it progressively, starting on the first chunk.

import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { understand, converse } from "./orchestrator";
import { getE2, getE3, getE4 } from "./adapters/index";
import * as store from "./assets/store";
import * as sessions from "./assets/sessions";
import * as learner from "./assets/learner";
import { inspect, statusOf, applyCredit } from "./mastery";
import { A1_MAP } from "./a1";
import { IMAGE_STYLE, IMAGE_FORMAT } from "./adapters/image-style";
import { SCENARIOS, freshSession, getScenario, characterVoiceProfile } from "./scenarios";
import { CATALOG } from "./catalog";
import { getDialoguesForScenario } from "./dialogues";
import { pacingFor } from "./pacing";
import { advanceDialogue } from "./adapters/dialogue-scripted";
import { getLearnable, LEARNABLES } from "./learnables";
import { buildGalleryHtml } from "./scripts/gallery";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// L1: a small in-memory LRU of hot clips. L2 (the source of truth) is the persistent disk store
// (server/assets/store.ts), which survives restarts. L1 is just to skip a disk read on hot replays;
// it's wiped on restart, after which L2 serves the same bytes for free — no re-synthesis, no re-billing.
const audioCache = new Map<string, Buffer>();
const AUDIO_CACHE_MAX = 200;

function cachePut(key: string, buf: Buffer): void {
  if (audioCache.has(key)) return;
  if (audioCache.size >= AUDIO_CACHE_MAX) {
    const oldest = audioCache.keys().next().value;
    if (oldest) audioCache.delete(oldest);
  }
  audioCache.set(key, buf);
}

// Audio clips arrive as base64 JSON — allow a generous body size.
app.use(express.json({ limit: "25mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// Live catalog gallery — rebuilt from the CURRENT catalog + on-disk renders on every request, so you
// can just refresh http://localhost:PORT/gallery after rendering or adding assets. Read-only, bills
// nothing. Images are revalidated each load (maxAge 0) so a re-rolled asset under the same key updates.
app.use("/gallery/image", express.static(path.join(store.ASSET_DIR, "image"), { maxAge: 0, etag: true }));
app.get("/gallery", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  try {
    res.end(buildGalleryHtml({ imgBase: "/gallery/image" }));
  } catch (err: any) {
    // A catalog/scenario JSON mid-edit throws on reload — show why instead of a blank 500, and recover
    // on the next refresh once the file is valid again.
    const msg = String(err?.message ?? err).replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"));
    res.end(`<pre style="color:#e66;background:#111;padding:24px;font:13px ui-monospace;white-space:pre-wrap">gallery build failed — likely a catalog or scenario file mid-edit:\n\n${msg}</pre>`);
  }
});

// Active providers, the chosen scenario (with objectives for the dots + a fresh session), and the
// scenario list (active + PLANNED) for the picker. NO keys — safe for the client.
// ?scenarioId= selects which scenario to boot; getScenario falls back to CAFE for unknown/planned ids.
app.get("/api/config", (req, res) => {
  const scenario = getScenario(req.query.scenarioId ? String(req.query.scenarioId) : undefined);
  res.json({
    providers: { e2: getE2().name, e3: getE3().name },
    scenario: {
      id: scenario.id,
      name: scenario.name ?? scenario.title,
      title: scenario.title,
      opening: scenario.opening,
      objectives: scenario.objectives.map((o) => ({ id: o.id, label: o.label, targetSL: o.targetSL })),
      // Story layer (M4): frame order + SL lines for playback; image bytes come from /api/image.
      story: scenario.scene?.story
        ? {
            sentences: scenario.scene.story.sentences,
            frames: scenario.scene.story.frames.map((f) => ({ objectiveId: f.objectiveId, lineSL: f.lineSL })),
            hasScene: !!scenario.scene.story.sceneImagePrompt,
          }
        : null,
    },
    // Rehearsal layer: the predetermined branching dialogues paired with this scenario, one per
    // competency level (ascending), [] if none. Each whole tree is client-side data — the click-through
    // runs with no server turn.
    dialogues: getDialoguesForScenario(scenario.id),
    session: freshSession(scenario),
    scenarios: SCENARIOS.map((s) => ({ id: s.id, name: s.name ?? s.title, title: s.title, status: s.status })),
    // Has this learner produced anything yet? If not, free conversation routes them into the seed.
    started: Object.keys(learner.load().learnables).length > 0,
  });
});


// Practice scenarios (MVP destination ①): every scenario that has authored rehearsal dialogues, with
// its full level trees inline (each tree is client-side data — the click-through runs with no server
// turn). Scenarios without dialogues (café, planned stubs) are omitted — this list IS the picker.
// `started` drives the live-tutor zero-state (empty learner → seed) so the home can route without a
// second call.
app.get("/api/practice", (_req, res) => {
  const scenarios = SCENARIOS.map((s) => ({ s, dialogues: getDialoguesForScenario(s.id) }))
    .filter(({ dialogues }) => dialogues.length > 0)
    // A spoken scene is a place the app takes the learner, not a rehearsal the learner picks — so it
    // stays out of the picker. The advance mode already tells the two apart.
    .filter(({ dialogues }) => dialogues.some((d) => (d.advance ?? "tap") === "tap"))
    .map(({ s, dialogues }) => ({ id: s.id, name: s.name ?? s.title, title: s.title, role: s.role ?? null, dialogues }));
  // The scenario that owns the first-run spoken scene, if one is authored — the boot route needs it in
  // the same call as `started`, so a zero-state learner reaches the scene without a second round trip.
  const sceneScenario = SCENARIOS.find((s) =>
    getDialoguesForScenario(s.id).some((d) => (d.advance ?? "tap") === "audio"));
  res.json({
    scenarios,
    providers: { e2: getE2().name, e3: getE3().name },
    started: Object.keys(learner.load().learnables).length > 0,
    scene: sceneScenario?.id ?? null,
  });
});

// SPOKEN SCENE — one step of an `advance: "audio"` dialogue. The learner's recording is NEVER sent
// here: nothing inspects it, so uploading it would be waste, and the turn is unfailable by construction.
// The client posts the node it is leaving; the server walks the spine, plants that beat's learnables as
// ATTEMPTS, and returns the next character line with its pacing.
//
//   POST /api/scene { scenarioId }            → the opening line (credits nothing)
//   POST /api/scene { scenarioId, from }      → the learner spoke at `from`; advance
app.post("/api/scene", (req, res) => {
  const { scenarioId, from } = req.body ?? {};
  if (typeof scenarioId !== "string") return res.status(400).json({ error: "scenarioId is required" });

  const scene = getDialoguesForScenario(scenarioId).find((d) => (d.advance ?? "tap") === "audio");
  if (!scene) return res.status(404).json({ error: `No spoken scene for scenario "${scenarioId}"` });

  const pacing = pacingFor(scene.pacing);

  const shape = (id: string | null) => {
    const n = id ? scene.nodes[id] : null;
    if (!n) return null;
    // What the learner is asked to say is the upcoming CLIENT node's own line — not a gloss of what the
    // character just said. A beginner who hears nine words and must produce two cannot tell which two,
    // and the character's caption can never tell them; their own line can.
    const client = n.next.map((i) => scene.nodes[i]).find((x) => x?.speaker === "client");
    // A client line that is nothing but a blank ("___" — the learner saying their own name) has no
    // Slovene stem to show. Rendering the blank on its own is worse than showing nothing: it is a bold
    // placeholder that says only "something goes here". In that case the English instruction IS the
    // prompt, and it carries the beat alone.
    const stem = client && /\p{L}/u.test(client.sl) ? client.sl : null;
    return {
      id,
      sl: n.sl,
      en: n.en,
      slowSL: n.slowSL ?? null,
      // Resolved here so the renderer never has to know a default: the node's own lead, else the profile's.
      captionLeadMs: n.captionDelayMs ?? pacing.captionLeadMs,
      glossPolicy: n.glossPolicy ?? "tap",
      // Each rung's timing resolved from the profile by position unless the rung overrides it.
      stallHandlers: (n.stallHandlers ?? []).map((h, i) => ({
        kind: h.kind,
        label: h.label ?? null,
        afterMs: h.afterMs ?? pacing.stallMs[i]!,
      })),
      prompt: client ? { sl: stem, en: client.en } : null,
      // Whether this beat ends in a turn at all. A node that hands to another npc node is the character
      // carrying himself forward — the renderer plays it and continues rather than arming the button.
      handsOver: !!client,
      // A closing beat has nobody to hand the turn to. Without this the renderer armed the button anyway
      // and the run ended sitting on "Hold and say it" after the character had said goodbye.
      terminal: !n.next.length,
    };
  };
  // The character's listening noise, already on disk — the client fires it the instant the learner
  // releases, before anything could have processed what they said.
  const backchannel = CATALOG.voiceProfiles[scene.voices.npc]?.backchannels?.[0] ?? null;

  try {
    if (typeof from !== "string") {
      return res.json({ voice: scene.voices.npc, background: scene.background ?? null, backchannel,
                        pacing, frameEN: scene.frameEN ?? [], npc: shape(scene.root), done: false });
    }
    const step = advanceDialogue(scene, from, { kind: "audio" });
    if (step.learnableProgress.length) learner.save(applyCredit(learner.load(), step.learnableProgress));
    res.json({
      voice: scene.voices.npc,
      background: scene.background ?? null,
      backchannel,
      pacing,
      npc: shape(step.npcNodeId),
      spoke: step.clientNodeId ? { id: step.clientNodeId, sl: scene.nodes[step.clientNodeId]!.sl } : null,
      done: step.done,
    });
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? String(err) });
  }
});

// A1 Readiness (MVP destination ④) — the coverage map. Each competency carries REAL progress read from
// the durable learner model (mastered / attempted counts over its learnables) + the scenario levels that
// advance it, resolved to display labels. This is the only place progress is visible to the learner.
app.get("/api/a1", (_req, res) => {
  const model = learner.load();
  const competencies = A1_MAP.map((c) => {
    const ids = c.learnables.filter((id) => LEARNABLES[id]);
    const status = (id: string) => statusOf(model.learnables[id]);
    const mastered = ids.filter((id) => status(id) === "mastered").length;
    const attempted = ids.filter((id) => status(id) === "attempted").length;
    const scenarios = c.scenarios.map((s) => {
      const scn = SCENARIOS.find((x) => x.id === s.scenarioId);
      const dlg = getDialoguesForScenario(s.scenarioId).find((d) => d.level === s.level);
      return {
        scenarioId: s.scenarioId,
        name: scn?.name ?? scn?.title ?? s.scenarioId,
        level: s.level,
        levelLabel: dlg?.levelLabel ?? `Level ${s.level}`,
        title: dlg?.title ?? "",
      };
    });
    return {
      id: c.id,
      label: c.label,
      descriptor: c.descriptor,
      total: ids.length,
      mastered,
      attempted,
      scenarios,
      items: ids.map((id) => ({ id, sl: LEARNABLES[id]!.sl, gloss: LEARNABLES[id]!.gloss, status: status(id) })),
    };
  });
  res.json({ competencies });
});

// Liveness only. Does not touch providers or keys.
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Operator inspection of the durable learner model (US-17) — read-only, derived, bills nothing. The
// engine stays invisible to the learner; this is for whoever runs the system.
app.get("/api/learner", (_req, res) => res.json(inspect(learner.load())));

// One conversational turn — E2 only. Returns text fast; audio is fetched from /api/speak.
app.post("/api/turn", async (req, res) => {
  const { audioBase64, mimeType, history, session, runId } = req.body ?? {};
  if (!audioBase64 || !mimeType) {
    return res.status(400).json({ error: "audioBase64 and mimeType are required" });
  }
  try {
    const result = await understand({
      audioBase64,
      mimeType,
      history: Array.isArray(history) ? history : [],
      session,
    });

    // M6 capture (best-effort — never fail a turn because the record couldn't be written).
    // The tutor audioKey is computed from the reply text, so it matches the clip /api/speak will
    // create when the client plays it. On the first turn we seed the record with the opening line.
    if (runId) {
      try {
        const e3 = getE3();
        const scenario = getScenario(result.session.scenarioId);
        // The opening + every tutor reply are the CHARACTER speaking → key by the character's voice
        // profile, so the captured/replayed clip matches what /api/speak (voice=character) synthesizes.
        const tutorTag = e3.voiceTagFor(characterVoiceProfile(scenario));
        const tutorKey = (text: string) => store.audioKey(e3.name, tutorTag, text);
        const seedTurns = sessions.load(runId)
          ? undefined
          : [{ role: "tutor" as const, text: scenario.opening, audioKey: tutorKey(scenario.opening) }];
        sessions.appendTurns({
          id: runId,
          scenarioId: result.session.scenarioId,
          seedTurns,
          turns: [
            { role: "student", text: result.userSaid, userVerbatim: result.userVerbatim },
            { role: "tutor", text: result.tutorReply, audioKey: tutorKey(result.tutorReply) },
          ],
          finalObjectives: result.session.objectives,
          complete: result.session.complete,
        });
      } catch (capErr: any) {
        console.error("[capture] failed:", capErr?.message);
      }
    }

    res.json(result);
  } catch (err: any) {
    console.error("[turn] failed:", err?.message);
    res.status(502).json({ error: err?.message || "turn failed" });
  }
});

// One free-conversation turn (E2 only) — scenario-less, bounded by the durable learner model. Audio is
// fetched from /api/speak exactly like /api/turn (voice=character is irrelevant here → teacher voice).
app.post("/api/converse", async (req, res) => {
  const { audioBase64, mimeType, history, level, seedId, begin, role, focusLearnables, context, runId } = req.body ?? {};
  // Every turn needs audio EXCEPT an opening (begin): the seed's step 0 or free chat's "Začnemo?" line
  // is the tutor speaking first, with no learner audio yet.
  if (!begin && (!audioBase64 || !mimeType)) {
    return res.status(400).json({ error: "audioBase64 and mimeType are required" });
  }
  try {
    const result = await converse({
      audioBase64,
      mimeType,
      history: Array.isArray(history) ? history : [],
      level: level === 1 ? 1 : 2,
      seedId: seedId ? String(seedId) : undefined,
      begin: !!begin,
      role: typeof role === "string" && role.trim() ? role : null,
      focusLearnables: Array.isArray(focusLearnables)
        ? focusLearnables.filter((id: unknown): id is string => typeof id === "string")
        : [],
      // Scene priming from a rehearsal handoff: a situation string + the practiced objective descriptors.
      context:
        context && typeof context.scene === "string" && context.scene.trim()
          ? {
              scene: context.scene,
              practiced: Array.isArray(context.practiced)
                ? context.practiced.filter((s: unknown): s is string => typeof s === "string")
                : [],
            }
          : null,
    });

    // M6-for-free-chat (MVP Phase 3): capture the live session so Replays can play it back. Legacy
    // capture only ran on /api/turn; free chat wrote nothing — that's the gap this closes. Best-effort:
    // never fail a turn because the record couldn't be written. Skip the seed (its own tutorial) and the
    // static opening (no learner audio). One record per runId = one continuous free chat until exit.
    if (runId && !seedId && !begin) {
      try {
        const e3 = getE3();
        const teacherTag = e3.voiceTagFor(undefined); // free-chat replies are the teacher voice
        const tutorKey = (text: string) => store.audioKey(e3.name, teacherTag, text);
        // On the first turn, seed the record with the opening "Začnemo?" the tutor spoke first.
        const opening = getLearnable("zacnemo").sl;
        const seedTurns = sessions.load(String(runId))
          ? undefined
          : [{ role: "tutor" as const, text: opening, audioKey: tutorKey(opening) }];
        sessions.appendTurns({
          id: String(runId),
          scenarioId: "free-chat",
          seedTurns,
          turns: [
            { role: "student", text: result.userSaid, userVerbatim: result.userVerbatim },
            { role: "tutor", text: result.tutorReply, audioKey: tutorKey(result.tutorReply) },
          ],
          finalObjectives: [], // free chat has no objectives; the engine stays invisible here
          complete: false, // a free chat is never "complete" — it stays open until the learner exits
        });
      } catch (capErr: any) {
        console.error("[converse capture] failed:", capErr?.message);
      }
    }

    res.json(result);
  } catch (err: any) {
    console.error("[converse] failed:", err?.message);
    res.status(502).json({ error: err?.message || "converse failed" });
  }
});

// Stream the tutor's Slovenian audio progressively (Level 1), with persistent caching for replay.
// GET so an <audio> element can stream it natively. Text is short so the query param is fine.
// Lookup: L1 in-memory → L2 disk store. On a miss we stream from the provider AND persist the bytes
// to the store, so every later request for the same text is served free — even after a restart.
app.get("/api/speak", async (req, res) => {
  const text = String(req.query.text || "");
  if (!text.trim()) return res.status(400).json({ error: "text is required" });

  const e3 = getE3();
  // Voice selection: `voice=character` → the scenario character's profile (in-scene lines: the tutor
  // reply / opening); `voice=<catalog profile id>` (e.g. shop-assistant, male-speaker) → that profile
  // (rehearsal-dialogue speakers); anything else/absent → the teacher voice (targets, narration, practice).
  const scenarioIdQ = req.query.scenarioId ? String(req.query.scenarioId) : undefined;
  const voiceQ = String(req.query.voice || "");
  const voiceProfile =
    voiceQ === "character"
      ? characterVoiceProfile(getScenario(scenarioIdQ))
      : voiceQ && CATALOG.voiceProfiles[voiceQ]
        ? voiceQ
        : undefined;
  const key = store.audioKey(e3.name, e3.voiceTagFor(voiceProfile), text);

  // Hit if it's hot in L1 or already on disk (the disk hit is what survives restart).
  const cached = audioCache.get(key) ?? store.read(key, "audio");
  if (cached) {
    cachePut(key, cached); // promote disk hit into L1 for the next replay
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Audio-Cache", "hit");
    return res.end(cached);
  }

  // Scenario tags (optional) so live clips are queryable by scenario/objective in the manifest.
  const objectiveId = req.query.objectiveId ? String(req.query.objectiveId) : undefined;
  const meta = { provider: e3.name, voiceOrModel: e3.voiceTagFor(voiceProfile), text, scenarioId: scenarioIdQ, objectiveId };

  try {
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Audio-Cache", "miss");

    if (e3.stream) {
      // Tee: write each chunk to the client as it arrives AND buffer it to persist after streaming.
      const reader = (await e3.stream({ text, voiceProfile })).getReader();
      const chunks: Buffer[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        chunks.push(chunk);
        res.write(chunk);
      }
      res.end();
      const buf = Buffer.concat(chunks);
      store.put(key, "audio", buf, meta);
      cachePut(key, buf);
    } else {
      // Provider without streaming: send + persist the full buffer.
      const { audioBase64 } = await e3.synthesize({ text, voiceProfile });
      const buf = Buffer.from(audioBase64, "base64");
      store.put(key, "audio", buf, meta);
      cachePut(key, buf);
      res.end(buf);
    }
  } catch (err: any) {
    console.error("[speak] failed:", err?.message);
    if (!res.headersSent) res.status(502).json({ error: err?.message || "speak failed" });
    else res.end();
  }
});

// M4 — serve a scenario's story-frame / scene image from the store (read-only: playback never
// bills; `npm run build:assets` pre-generates them). objectiveId="scene" => the final all-in image.
app.get("/api/image", (req, res) => {
  const scenario = getScenario(String(req.query.scenarioId || ""));
  const story = scenario.scene?.story;
  if (!story) return res.status(404).json({ error: "no story for scenario" });

  const objectiveId = String(req.query.objectiveId || "");
  const isScene = objectiveId === "scene";
  const prompt = isScene
    ? story.sceneImagePrompt
    : story.frames.find((f) => f.objectiveId === objectiveId)?.imagePrompt;
  if (!prompt) return res.status(404).json({ error: "no frame for that objective" });

  // Recompute the key with the SAME per-type format used at build time (frames 4:3, scene 16:9).
  const fmt = isScene ? IMAGE_FORMAT.scene : IMAGE_FORMAT.frame;
  const e4 = getE4();
  const key = store.imageKey(e4.name, e4.model, IMAGE_STYLE.id, fmt.aspectRatio, fmt.resolution, prompt);
  const buf = store.read(key, "image");
  if (!buf) return res.status(404).json({ error: "image not built — run: npm run build:assets -- " + scenario.id });

  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Asset-Cache", "hit");
  res.end(buf);
});

// M6 — captured session records (replay + versioning). All read from assets/sessions/.
//
// These records hold `userVerbatim` (exact learner speech) and are UNSCOPED — any caller sees every
// run. On a public deploy with no auth that is a cross-user PII leak (audit #3), so the whole surface
// is OFF unless OPERATOR_TOOLS=1. Fails CLOSED: a forgotten flag exposes nothing. Set it locally to
// use the Replays view. (Records are never written on Railway anyway — capture sits behind the E2 key,
// which the alpha doesn't set — this gate just guarantees the read path can't leak if that changes.)
const OPERATOR_TOOLS = process.env.OPERATOR_TOOLS === "1";

// List runs (newest first) with a lightweight summary for a "my runs" view.
app.get("/api/sessions", (_req, res) => {
  // Gated off → an empty list, so the client's Replays panel shows its normal "no sessions yet" state.
  if (!OPERATOR_TOOLS) return res.json({ sessions: [] });
  const summary = sessions.list().map((r) => ({
    id: r.id,
    scenarioId: r.scenarioId,
    createdAt: r.createdAt,
    status: r.status,
    turns: r.turns.length,
    label: r.label,
    favorite: !!r.favorite,
    completed: r.finalObjectives.filter((o) => o.status === "completed").length,
    objectives: r.finalObjectives.length,
  }));
  res.json({ sessions: summary });
});

// Full record for one run — the ordered turns the replay UI steps through.
app.get("/api/sessions/:id", (req, res) => {
  if (!OPERATOR_TOOLS) return res.status(404).json({ error: "no such session" });
  const rec = sessions.load(req.params.id);
  if (!rec) return res.status(404).json({ error: "no such session" });
  res.json(rec);
});

// Promote a run: set a human label and/or mark it favorite (UC3).
app.post("/api/sessions/:id/meta", (req, res) => {
  if (!OPERATOR_TOOLS) return res.status(404).json({ error: "no such session" });
  const { label, favorite } = req.body ?? {};
  try {
    res.json(sessions.setMeta(req.params.id, { label, favorite }));
  } catch (err: any) {
    res.status(404).json({ error: err?.message || "no such session" });
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`▶ lango-slovenian demo on http://localhost:${port}`);
  console.log(`  E2=${process.env.E2_PROVIDER || "gemini"}  E3=${process.env.E3_PROVIDER || "elevenlabs"}`);
});
