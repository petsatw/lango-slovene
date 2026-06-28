// The SEED adapter — stands in exactly where the E2 model call would be, but serves a STATIC,
// predetermined dialogue instead of going out to a model. The free-conversation pipeline + chat UI +
// push-to-talk are reused unchanged; only the "brain" is swapped. (docs/free-conversation.md, Phase 1)
//
// It is pure (no I/O, no network). Crediting is done by the caller (orchestrator.converse). The step is
// derived from the conversation so far: the learner's spoken turns count = which scripted step they just
// produced. The seed only ever plants ENTRIES (attempts) — it mints no masteries; it does not judge the
// audio (there is no model here), it advances the script.

import type { Seed } from "../seeds";
import type { ConversationTurn, LearnableProgress } from "../types";

export interface ScriptedTurn {
  userVerbatim: string; // the line the learner just practiced (the scripted target), or "" on the opener
  userSaid: string; // its English gloss
  tutorReply: string; // the next scripted tutor line (Slovene) — or a warm closing when the script ends
  correction: string; // the tutor line's English gloss — shown as the bubble sub-line (seed bilingual aid)
  learnableProgress: LearnableProgress[]; // the just-practiced step's learnables, as attempts (entries)
  seedDone: boolean; // true once the final step has been practiced
}

const CLOSING_SL = "Bravo! Zdaj lahko klepetava. 🎉";
const CLOSING_EN = "Well done! Now we can chat. 🎉";

/** Produce the next turn of the scripted seed.
 *  - `begin` (no learner audio yet): return the opening line (step 0); credit nothing.
 *  - otherwise: the learner just produced step K (K = how many times they've spoken so far). Credit
 *    step K's learnables as attempts and return step K+1's line (or the closing). */
export function scriptedSeedTurn(seed: Seed, history: ConversationTurn[], begin: boolean): ScriptedTurn {
  if (begin) {
    const first = seed.steps[0];
    if (!first) return { userVerbatim: "", userSaid: "", tutorReply: CLOSING_SL, correction: CLOSING_EN, learnableProgress: [], seedDone: true };
    return { userVerbatim: "", userSaid: "", tutorReply: first.tutorSL, correction: first.tutorEN, learnableProgress: [], seedDone: false };
  }

  const k = history.filter((t) => t.role === "user").length; // the step the learner just practiced
  const cur = seed.steps[k];
  const next = seed.steps[k + 1];

  const learnableProgress: LearnableProgress[] = cur
    ? cur.learnables.map((id) => ({ id, result: "attempt" as const }))
    : [];

  return {
    userVerbatim: cur ? cur.targetSL : "",
    userSaid: cur ? cur.targetEN : "",
    tutorReply: next ? next.tutorSL : CLOSING_SL,
    correction: next ? next.tutorEN : CLOSING_EN,
    learnableProgress,
    seedDone: !next,
  };
}
