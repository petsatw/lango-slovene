// Turn logic + the deterministic mastery rules (server-owned, not left to the model's whim).
// `understand` is the session-aware E2 step used by /api/turn. `runTurn` is the full
// non-streaming path used by the replay harness.

import { getE2, getE3 } from "./adapters/index";
import * as store from "./assets/store";
import * as learner from "./assets/learner";
import * as turnlog from "./assets/turnlog";
import * as candidates from "./assets/candidates";
import {
  applyCredit,
  countsFor,
  creditFromEvidence,
  presentObjectives,
  selectForWitness,
} from "./mastery";
import { buildSystemPrompt, buildConversationPrompt, type ScenarioContext } from "./prompt";
import { getLearnable } from "./learnables";
import { getScenario, freshSession, characterVoiceProfile, type Scenario } from "./scenarios";
import { getSeed } from "./seeds";
import { scriptedSeedTurn } from "./adapters/seed-scripted";
import type {
  ConversationTurn,
  ConverseResult,
  LearnerModel,
  ObjectiveProgress,
  SessionState,
  TurnResult,
  UnderstandResult,
} from "./types";

const TURN_CAP = 14; // safety stop so a session can't run forever

// Apply the model's per-turn verdicts to session state. Rules:
//  - "completed"  → status completed
//  - "attempted" → status recast (must resurface before it can be completed)
// Session completes when all objectives are completed, or the turn cap is hit.
function applyProgress(scenario: Scenario, prev: SessionState, progress: ObjectiveProgress[]): SessionState {
  const byId = new Map(prev.objectives.map((o) => [o.id, { ...o }]));

  for (const p of progress) {
    const o = byId.get(p.id);
    if (!o) continue;
    o.attempts += 1;
    if (p.result === "completed") o.status = "completed";
    else if (o.status !== "completed") o.status = "recast";
  }

  const objectives = scenario.objectives.map(
    (def) => byId.get(def.id) ?? { id: def.id, status: "pending" as const, attempts: 0 },
  );
  const turns = prev.turns + 1;
  const complete = objectives.every((o) => o.status === "completed") || turns >= TURN_CAP;

  return { scenarioId: scenario.id, objectives, complete, turns };
}

export async function understand(input: {
  audioBase64: string;
  mimeType: string;
  history: ConversationTurn[];
  session?: SessionState;
  learnerId: string;
  /** Did this session agree to its data being kept (server/assets/retention.ts). */
  retain?: boolean;
}): Promise<UnderstandResult> {
  const scenario = getScenario(input.session?.scenarioId);
  const session = input.session ?? freshSession(scenario);

  // MASTERY layer: read the model so presentation can steer toward the still-unmastered learnable
  // within each objective (and stop pushing mastered ones).
  const model = learner.load(input.learnerId);
  const presentation = presentObjectives(scenario.objectives, model);
  const systemPrompt = buildSystemPrompt(scenario, session, presentation);
  const e2 = getE2();

  const t0 = performance.now();
  const r = await e2.understand({
    audioBase64: input.audioBase64,
    mimeType: input.mimeType,
    systemPrompt,
    history: input.history,
  });
  const e2Ms = Math.round(performance.now() - t0);

  // Credit the durable mastery layer (independent of the scene layer) and persist. A turn with no
  // learnable verdicts (un-authored scenario) is a no-op write of the unchanged model.
  let saved = model;
  if (r.learnableProgress.length) {
    saved = applyCredit(model, r.learnableProgress);
    learner.save(input.learnerId, saved);
  }

  turnlog.record({
    path: "scenario",
    retain: input.retain,
    scenarioId: scenario.id,
    provider: e2.name,
    model: process.env.GEMINI_MODEL,
    e2Ms,
    systemPrompt,
    history: input.history,
    audio: { mimeType: input.mimeType, base64: input.audioBase64 },
    output: r,
    creditedCounts: countsFor(saved, r.learnableProgress),
  });

  return {
    userVerbatim: r.userVerbatim,
    userSaid: r.userSaid,
    tutorReply: r.tutorReply,
    correction: r.correction,
    session: applyProgress(scenario, session, r.objectiveProgress),
    learnableProgress: r.learnableProgress,
    timings: { e2Ms },
    providers: { e2: e2.name },
  };
}

// Free conversation (spec §3.5) — a scenario-less turn bounded by the durable learner model. Same E2
// hop, same per-learnable crediting; no objectives, no scene, no session.
export async function converse(input: {
  audioBase64?: string;
  mimeType?: string;
  history: ConversationTurn[];
  level?: 1 | 2;
  seedId?: string; // when set, the SEED adapter serves a scripted dialogue instead of the model
  begin?: boolean; // return the opening line, credit nothing (seed step 0, or free chat's "Začnemo?")
  role?: string | null; // free chat: the pinned role the client carries back each turn (null = decide)
  focusLearnables?: string[]; // rehearsal→free-chat handoff: bias this turn's targets toward these ids
  context?: ScenarioContext | null; // rehearsal→free-chat handoff: the scene + practiced objectives (English priming)
  learnerId: string;
  e2Provider?: string; // a tester naming the understand+tutor provider for THIS turn (adapters/index.ts)
  /** Did this session agree to its data being kept (server/assets/retention.ts). */
  retain?: boolean;
}): Promise<ConverseResult> {
  const model = learner.load(input.learnerId);

  // Seed onboarding: same pipeline, same chat surface — only the brain is swapped for a static script.
  if (input.seedId) {
    const r = scriptedSeedTurn(getSeed(input.seedId), input.history, !!input.begin);
    let saved = model;
    if (r.learnableProgress.length) {
      saved = applyCredit(model, r.learnableProgress);
      learner.save(input.learnerId, saved);
    }
    turnlog.record({
      path: "seed",
      retain: input.retain,
      seedId: input.seedId,
      provider: "scripted-seed",
      e2Ms: 0,
      systemPrompt: "(scripted seed — no model prompt)",
      history: input.history,
      audio: input.audioBase64 ? { mimeType: input.mimeType ?? "", base64: input.audioBase64 } : undefined,
      output: { ...r, objectiveProgress: [], focusObjectiveId: "" },
      creditedCounts: countsFor(saved, r.learnableProgress),
    });
    return {
      userVerbatim: r.userVerbatim,
      userSaid: r.userSaid,
      tutorReply: r.tutorReply,
      correction: r.correction,
      learnableProgress: r.learnableProgress,
      seedDone: r.seedDone,
      timings: { e2Ms: 0 },
      providers: { e2: "scripted-seed" },
    };
  }

  // Free-chat opening: the tutor speaks first (no learner audio yet). A static line — no model call, no
  // credit — mirroring the seed's begin path. The learner already knows "Začnemo?" from the tutorial.
  if (input.begin) {
    const z = getLearnable("zacnemo");
    return {
      userVerbatim: "",
      userSaid: "",
      tutorReply: z.sl,
      replyGloss: z.gloss,
      correction: "",
      learnableProgress: [],
      role: null,
      timings: { e2Ms: 0 },
      providers: { e2: "opening" },
    };
  }

  if (!input.audioBase64 || !input.mimeType) throw new Error("converse requires audio");
  const level: 1 | 2 = input.level === 1 ? 1 : 2;
  const { knows, targets } = selectForWitness(model, level, input.focusLearnables ?? []);
  const systemPrompt = buildConversationPrompt(knows, targets, undefined, input.role, input.context);
  const e2 = getE2(input.e2Provider);
  if (!e2.witness) {
    throw new Error(`E2 provider "${e2.name}" does not support free-conversation witness turns`);
  }

  const t0 = performance.now();
  const w = await e2.witness({
    audioBase64: input.audioBase64,
    mimeType: input.mimeType,
    systemPrompt,
    history: input.history,
  });
  const e2Ms = Math.round(performance.now() - t0);

  // Server owns ALL crediting: successes gated to the in-play targets + Slovene + transcript span;
  // off-target Slovene earns attempts; novel Slovene becomes a catalog candidate (mastery.ts).
  const credit = creditFromEvidence(model, w, targets);
  if (credit.progress.length) learner.save(input.learnerId, credit.model);
  // The candidate queue is a durable product artifact, not a session record, and a candidate is by
  // definition unrecognised speech — a spoken name lands here as readily as a real word. A session that
  // declined retention therefore never writes one, rather than writing one for a sweep to find later.
  if (credit.candidates.length && input.retain !== false) candidates.record(credit.candidates);

  turnlog.record({
    path: "free",
    retain: input.retain,
    level,
    provider: e2.name,
    model: process.env.GEMINI_MODEL,
    e2Ms,
    systemPrompt,
    history: input.history,
    audio: { mimeType: input.mimeType, base64: input.audioBase64 },
    output: {
      userVerbatim: w.transcriptVerbatim,
      userSaid: w.userGloss,
      tutorReply: w.reply,
      correction: "",
      learnableProgress: credit.progress,
      objectiveProgress: [],
      focusObjectiveId: "",
    },
    witness: {
      utteranceLang: w.utteranceLang,
      targets: w.targets,
      observed: w.observed,
      candidates: credit.candidates,
    },
    creditedCounts: countsFor(credit.model, credit.progress),
  });

  return {
    userVerbatim: w.transcriptVerbatim,
    userSaid: w.userGloss,
    tutorReply: w.reply,
    replyGloss: w.replyGloss,
    correction: "",
    learnableProgress: credit.progress,
    // Honor the client-pinned role once set; otherwise relay the model's fresh first-turn choice so the
    // client can pin it. Free chat is stateless, so the role lives on the client between turns.
    role: input.role ?? w.role ?? null,
    timings: { e2Ms },
    providers: { e2: e2.name },
  };
}

// Full pipeline (E2 + buffered E3) — kept for the replay harness / end-to-end verification.
export async function runTurn(input: {
  audioBase64: string;
  mimeType: string;
  history: ConversationTurn[];
  session?: SessionState;
  learnerId: string;
}): Promise<TurnResult> {
  const u = await understand(input);
  const e3 = getE3();

  // The tutor reply IS the character speaking → synthesize in the character's voice profile.
  const voiceProfile = characterVoiceProfile(getScenario(u.session.scenarioId));
  const voiceTag = e3.voiceTagFor(voiceProfile);

  // Through the persistent store: reuse the canonical clip if we've already synthesized this
  // reply (free, survives restart); otherwise synthesize once and persist for next time.
  const t1 = performance.now();
  const key = store.audioKey(e3.name, voiceTag, u.tutorReply);
  const { bytes } = await store.getOrCreate(
    key,
    "audio",
    { provider: e3.name, voiceOrModel: voiceTag, text: u.tutorReply },
    async () => {
      const r = await e3.synthesize({ text: u.tutorReply, voiceProfile });
      return { bytes: Buffer.from(r.audioBase64, "base64"), mimeType: r.mimeType };
    },
  );
  const audio = { audioBase64: bytes.toString("base64"), mimeType: "audio/mpeg" };
  const e3Ms = Math.round(performance.now() - t1);

  return {
    userSaid: u.userSaid,
    tutorReply: u.tutorReply,
    correction: u.correction,
    audio,
    timings: { e2Ms: u.timings.e2Ms, e3Ms, totalMs: u.timings.e2Ms + e3Ms },
    providers: { e2: u.providers.e2, e3: e3.name },
  };
}
