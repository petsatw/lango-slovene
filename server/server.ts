// Thin backend: holds keys (from .env), runs the turn loop, serves the PWA.
// The browser only ever calls these /api endpoints — keys never leave this process.
//
// Level 1 streaming: /api/turn returns the tutor text fast (E2 only); /api/speak streams the
// Slovenian audio (E3) so the browser plays it progressively, starting on the first chunk.

import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { understand } from "./orchestrator";
import { getE2, getE3, getE4 } from "./adapters/index";
import * as store from "./assets/store";
import * as sessions from "./assets/sessions";
import { IMAGE_STYLE, IMAGE_FORMAT } from "./adapters/image-style";
import { SCENARIOS, freshSession, getScenario } from "./scenarios";

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
    session: freshSession(scenario),
    scenarios: SCENARIOS.map((s) => ({ id: s.id, name: s.name ?? s.title, title: s.title, status: s.status })),
  });
});

// Liveness only. Does not touch providers or keys.
app.get("/api/health", (_req, res) => res.json({ ok: true }));

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
        const tutorKey = (text: string) => store.audioKey(e3.name, e3.voiceTag, text);
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

// Stream the tutor's Slovenian audio progressively (Level 1), with persistent caching for replay.
// GET so an <audio> element can stream it natively. Text is short so the query param is fine.
// Lookup: L1 in-memory → L2 disk store. On a miss we stream from the provider AND persist the bytes
// to the store, so every later request for the same text is served free — even after a restart.
app.get("/api/speak", async (req, res) => {
  const text = String(req.query.text || "");
  if (!text.trim()) return res.status(400).json({ error: "text is required" });

  const e3 = getE3();
  const key = store.audioKey(e3.name, e3.voiceTag, text);

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
  const scenarioId = req.query.scenarioId ? String(req.query.scenarioId) : undefined;
  const objectiveId = req.query.objectiveId ? String(req.query.objectiveId) : undefined;
  const meta = { provider: e3.name, voiceOrModel: e3.voiceTag, text, scenarioId, objectiveId };

  try {
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Audio-Cache", "miss");

    if (e3.stream) {
      // Tee: write each chunk to the client as it arrives AND buffer it to persist after streaming.
      const reader = (await e3.stream({ text })).getReader();
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
      const { audioBase64 } = await e3.synthesize({ text });
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

// List runs (newest first) with a lightweight summary for a "my runs" view.
app.get("/api/sessions", (_req, res) => {
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
  const rec = sessions.load(req.params.id);
  if (!rec) return res.status(404).json({ error: "no such session" });
  res.json(rec);
});

// Promote a run: set a human label and/or mark it favorite (UC3).
app.post("/api/sessions/:id/meta", (req, res) => {
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
