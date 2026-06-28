// Turn logic + the deterministic mastery rules (server-owned, not left to the model's whim).
// `understand` is the session-aware E2 step used by /api/turn. `runTurn` is the full
// non-streaming path used by the replay harness.

import { getE2, getE3 } from "./adapters/index";
import * as store from "./assets/store";
import * as learner from "./assets/learner";
import { applyCredit, presentObjectives } from "./mastery";
import { buildSystemPrompt, buildConversationPrompt } from "./prompt";
import { getScenario, freshSession, characterVoiceProfile, type Scenario } from "./scenarios";
import { getSeed } from "./seeds";
import { scriptedSeedTurn } from "./adapters/seed-scripted";
import type {
  ConversationTurn,
  ConverseResult,
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
}): Promise<UnderstandResult> {
  const scenario = getScenario(input.session?.scenarioId);
  const session = input.session ?? freshSession(scenario);

  // MASTERY layer: read the durable model so presentation can steer toward the still-unmastered
  // learnable within each objective (and stop pushing mastered ones).
  const model = learner.load();
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
  if (r.learnableProgress.length) learner.save(applyCredit(model, r.learnableProgress));

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
  begin?: boolean; // seed only: return the opening line, credit nothing
}): Promise<ConverseResult> {
  const model = learner.load();

  // Seed onboarding: same pipeline, same chat surface — only the brain is swapped for a static script.
  if (input.seedId) {
    const r = scriptedSeedTurn(getSeed(input.seedId), input.history, !!input.begin);
    if (r.learnableProgress.length) learner.save(applyCredit(model, r.learnableProgress));
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

  if (!input.audioBase64 || !input.mimeType) throw new Error("converse requires audio");
  const level: 1 | 2 = input.level === 1 ? 1 : 2;
  const systemPrompt = buildConversationPrompt(model, level);
  const e2 = getE2();

  const t0 = performance.now();
  const r = await e2.understand({
    audioBase64: input.audioBase64,
    mimeType: input.mimeType,
    systemPrompt,
    history: input.history,
  });
  const e2Ms = Math.round(performance.now() - t0);

  if (r.learnableProgress.length) learner.save(applyCredit(model, r.learnableProgress));

  return {
    userVerbatim: r.userVerbatim,
    userSaid: r.userSaid,
    tutorReply: r.tutorReply,
    correction: r.correction,
    learnableProgress: r.learnableProgress,
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
