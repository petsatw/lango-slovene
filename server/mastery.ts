// The durable MASTERY-layer rules — server-owned, deterministic, pure (the app owns the pedagogy, not
// the model). Two pure functions over the learner model + the learnable catalog:
//   - applyCredit   : fold a turn's per-learnable verdicts into the durable counts (threshold + flub)
//   - presentObjectives : decide, per objective, which learnable to steer toward this sitting
// See docs/learnable-subsystem-spec.md §3.1–3.2. The store (assets/learner.ts) and the turn loop
// (orchestrator.ts) call these; keeping them pure makes them unit-testable with plain inputs.

import { LEARNABLES, type Learnable } from "./learnables";
import type { LearnableMastery, LearnableProgress, LearnerModel, Objective } from "./types";

/** Successes needed to count a learnable as mastered. One tunable knob (interview-settled at 5). */
export const THRESHOLD = 5;

export function isMastered(m: LearnableMastery | undefined, threshold = THRESHOLD): boolean {
  return (m?.successes ?? 0) >= threshold;
}

export type LearnableStatus = "unseen" | "attempted" | "mastered";

export function statusOf(m: LearnableMastery | undefined, threshold = THRESHOLD): LearnableStatus {
  if (!m) return "unseen";
  return m.successes >= threshold ? "mastered" : "attempted";
}

/** Fold a turn's per-learnable verdicts into the durable counts. Pure: returns a NEW model, never
 *  mutates the input. Rules (spec §3.1):
 *   - every verdict raises attempts (entry into the model = first attempt; exposure does not enter).
 *   - "success" raises successes (climbs past threshold).
 *   - "attempt" on an already-mastered learnable is a FLUB → decrement successes by 1 (clamp ≥ 0).
 *   - "attempt" on a not-yet-mastered learnable STALLS (no penalty before mastery). */
export function applyCredit(
  model: LearnerModel,
  progress: LearnableProgress[],
  threshold = THRESHOLD,
): LearnerModel {
  const learnables: Record<string, LearnableMastery> = {};
  for (const [id, m] of Object.entries(model.learnables)) learnables[id] = { ...m };

  for (const p of progress) {
    if (!p?.id) continue;
    const entry = learnables[p.id] ?? { attempts: 0, successes: 0 };
    const wasMastered = entry.successes >= threshold;
    entry.attempts += 1;
    if (p.result === "success") {
      entry.successes += 1;
    } else if (wasMastered) {
      entry.successes = Math.max(0, entry.successes - 1); // flub → decrement
    } // else: pre-mastery miss → stall (no change)
    learnables[p.id] = entry;
  }

  return { learnables, updatedAt: model.updatedAt };
}

/** What the prompt needs to know about one objective this turn — which learnable to steer toward, the
 *  effective target line, the predictable error to watch for, and whether the whole group is mastered
 *  (light review). Objectives with no `learnables` produce `null` and the prompt falls back to today's
 *  behaviour. (spec §3.2) */
export interface ObjectivePresentation {
  objectiveId: string;
  activeTargetSL: string; // the line to steer toward (filler-specific if authored, else objective.targetSL)
  focusLearnables: Learnable[]; // the not-yet-mastered carrier(s) + active filler — the items to push
  masteredLearnables: Learnable[];
  reviewMode: boolean; // every learnable in the objective is mastered → light "review with teeth"
  predictableError?: string;
}

export function presentObjective(
  objective: Objective,
  model: LearnerModel,
  threshold = THRESHOLD,
): ObjectivePresentation | null {
  const ids = objective.learnables ?? [];
  if (ids.length === 0) return null;

  const items = ids.map((id) => LEARNABLES[id]).filter(Boolean) as Learnable[];
  const mastered = (l: Learnable) => isMastered(model.learnables[l.id], threshold);

  const patterns = items.filter((l) => l.kind === "pattern"); // carriers
  const fillers = items.filter((l) => l.kind !== "pattern"); // vocab + chunks

  // The active filler is the next unmastered one in authored order; if all mastered, the first (review).
  const activeFiller = fillers.find((l) => !mastered(l)) ?? fillers[0];

  const focusLearnables = [
    ...patterns.filter((l) => !mastered(l)),
    ...(activeFiller && !mastered(activeFiller) ? [activeFiller] : []),
  ];
  const masteredLearnables = items.filter(mastered);
  const reviewMode = items.length > 0 && items.every(mastered);

  const activeTargetSL =
    (activeFiller && objective.fillerLines?.[activeFiller.id]) || objective.targetSL;

  const predictableError = focusLearnables.find((l) => l.predictableError)?.predictableError;

  return {
    objectiveId: objective.id,
    activeTargetSL,
    focusLearnables,
    masteredLearnables,
    reviewMode,
    ...(predictableError ? { predictableError } : {}),
  };
}

export function presentObjectives(
  objectives: Objective[],
  model: LearnerModel,
  threshold = THRESHOLD,
): Map<string, ObjectivePresentation> {
  const out = new Map<string, ObjectivePresentation>();
  for (const o of objectives) {
    const p = presentObjective(o, model, threshold);
    if (p) out.set(o.id, p);
  }
  return out;
}

/** Operator inspection (US-17, spec §3.6) — a read-only, derived view of the learner model: every
 *  learnable the learner has touched, with its derived status, plus owned/shaky/unseen counts. Includes
 *  unseen items only in the totals (not the rows) so the view scales with what's been practised. */
export interface LearnerInspection {
  threshold: number;
  counts: { owned: number; shaky: number; unseen: number };
  learnables: Array<{
    id: string;
    kind: string;
    sl: string;
    gloss: string;
    attempts: number;
    successes: number;
    status: LearnableStatus;
  }>;
}

export function inspect(model: LearnerModel, threshold = THRESHOLD): LearnerInspection {
  const rows = Object.entries(model.learnables)
    .map(([id, m]) => {
      const l = LEARNABLES[id];
      return {
        id,
        kind: l?.kind ?? "unknown",
        sl: l?.sl ?? "",
        gloss: l?.gloss ?? "",
        attempts: m.attempts,
        successes: m.successes,
        status: statusOf(m, threshold),
      };
    })
    .sort((a, b) => b.successes - a.successes || a.id.localeCompare(b.id));

  const owned = rows.filter((r) => r.status === "mastered").length;
  const shaky = rows.filter((r) => r.status === "attempted").length;
  const unseen = Object.keys(LEARNABLES).filter((id) => !model.learnables[id]).length;
  return { threshold, counts: { owned, shaky, unseen }, learnables: rows };
}

/** Free-conversation selection (spec §3.5). `familiar` = every learnable the learner has touched
 *  (attempted + mastered); `working` = the familiar-but-not-mastered ones to steer toward mastery;
 *  `newItems` = 1–2 UN-attempted catalog items (preferring core, by rank) introduced only at level 2 —
 *  the tiny edge expansion, still from the existing starter pack (no generation). A learner with no
 *  history is bootstrapped with new items regardless of level, so the mode is usable from zero. */
export interface ConversationSelection {
  familiar: Learnable[];
  working: Learnable[];
  newItems: Learnable[];
}

export function selectForConversation(
  model: LearnerModel,
  level: 1 | 2,
  threshold = THRESHOLD,
): ConversationSelection {
  const familiar = Object.keys(model.learnables)
    .map((id) => LEARNABLES[id])
    .filter(Boolean) as Learnable[];
  const working = familiar.filter((l) => !isMastered(model.learnables[l.id], threshold));

  const introduce = level >= 2 || familiar.length === 0;
  let newItems: Learnable[] = [];
  if (introduce) {
    const unattempted = Object.values(LEARNABLES).filter((l) => !model.learnables[l.id]);
    newItems = unattempted
      .sort((a, b) => Number(!!b.core) - Number(!!a.core) || (a.rank ?? 1e9) - (b.rank ?? 1e9))
      .slice(0, 2);
  }
  return { familiar, working, newItems };
}
