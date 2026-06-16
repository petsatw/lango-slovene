// Turn logic + the deterministic mastery rules (server-owned, not left to the model's whim).
// `understand` is the session-aware E2 step used by /api/turn. `runTurn` is the full
// non-streaming path used by the replay harness.

import { getE2, getE3 } from "./adapters/index";
import { buildSystemPrompt } from "./prompt";
import { getScenario, freshSession, type Scenario } from "./scenarios";
import type { ConversationTurn, ObjectiveProgress, SessionState, TurnResult, UnderstandResult } from "./types";

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
  const systemPrompt = buildSystemPrompt(scenario, session);
  const e2 = getE2();

  const t0 = performance.now();
  const r = await e2.understand({
    audioBase64: input.audioBase64,
    mimeType: input.mimeType,
    systemPrompt,
    history: input.history,
  });
  const e2Ms = Math.round(performance.now() - t0);

  return {
    userVerbatim: r.userVerbatim,
    userSaid: r.userSaid,
    tutorReply: r.tutorReply,
    correction: r.correction,
    session: applyProgress(scenario, session, r.objectiveProgress),
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

  const t1 = performance.now();
  const audio = await e3.synthesize({ text: u.tutorReply });
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
