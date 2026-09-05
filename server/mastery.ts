// The durable MASTERY-layer rules — server-owned, deterministic, pure (the app owns the pedagogy, not
// the model). Two pure functions over the learner model + the learnable catalog:
//   - applyCredit   : fold a turn's per-learnable verdicts into the durable counts (threshold + flub)
//   - presentObjectives : decide, per objective, which learnable to steer toward this sitting
// See docs/learnable-subsystem-spec.md §3.1–3.2. The store (assets/learner.ts) and the turn loop
// (orchestrator.ts) call these; keeping them pure makes them unit-testable with plain inputs.

import { LEARNABLES, type Learnable } from "./learnables";
import type {
  LearnableMastery,
  LearnableProgress,
  LearnerModel,
  ObservedItem,
  Objective,
  WitnessResult,
} from "./types";

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

  // Spread the incoming model so everything crediting has no business touching — `facts`, the answers
  // the learner gave about themselves — travels through untouched. This function decides mastery and
  // nothing else, and a caller does `learner.save(applyCredit(learner.load(), …))`, so a field rebuilt
  // by name here would be erased from disk by the next credited turn.
  return { ...model, learnables, updatedAt: model.updatedAt };
}

/** The durable counts, after crediting, for exactly the ids credited — what the turn log records so a
 *  verdict can be read against the state it produced. */
export function countsFor(
  model: LearnerModel,
  progress: { id: string }[],
): Record<string, { successes: number; attempts: number }> {
  const out: Record<string, { successes: number; attempts: number }> = {};
  for (const p of progress) {
    const l = model.learnables[p.id];
    if (l) out[p.id] = { successes: l.successes, attempts: l.attempts };
  }
  return out;
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
 *  learnable the learner has touched, with its derived status, and how those rows split.
 *
 *  The counts are over the MODEL, not the catalog. A total for everything the learner has not produced
 *  would be the catalog's size minus these, which measures the catalog rather than the learner and moves
 *  every time an item is authored. The bounded per-competency version of that question is the A1
 *  Readiness screen (/api/a1), which asks it of a curated list where the answer means something. */
export interface LearnerInspection {
  threshold: number;
  counts: { mastered: number; attempted: number };
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

  const mastered = rows.filter((r) => r.status === "mastered").length;
  const attempted = rows.filter((r) => r.status === "attempted").length;
  return { threshold, counts: { mastered, attempted }, learnables: rows };
}

/** Free-conversation selection (spec §3.5). `knows` = every learnable in the learner model, which is
 *  every one they have tried to produce; `working` = the not-yet-mastered ones to steer toward mastery;
 *  `newItems` = 1–2 UN-attempted catalog items (preferring core, by rank) introduced only at level 2 —
 *  the tiny edge expansion, still from the existing starter pack (no generation). A learner with no
 *  history is bootstrapped with new items regardless of level, so the mode is usable from zero. */
export interface ConversationSelection {
  /** The tutor's palette. It reaches the prompt under the heading THE LEARNER KNOWS (server/prompt.ts),
   *  which is what it is: the words the learner has put in their own mouth at least once. */
  knows: Learnable[];
  working: Learnable[];
  newItems: Learnable[];
}

export function selectForConversation(
  model: LearnerModel,
  level: 1 | 2,
  threshold = THRESHOLD,
): ConversationSelection {
  const knows = Object.keys(model.learnables)
    .map((id) => LEARNABLES[id])
    .filter(Boolean) as Learnable[];
  const working = knows.filter((l) => !isMastered(model.learnables[l.id], threshold));

  const introduce = level >= 2 || knows.length === 0;
  let newItems: Learnable[] = [];
  if (introduce) {
    const unattempted = Object.values(LEARNABLES).filter((l) => !model.learnables[l.id]);
    newItems = unattempted
      .sort((a, b) => Number(!!b.core) - Number(!!a.core) || (a.rank ?? 1e9) - (b.rank ?? 1e9))
      .slice(0, 2);
  }
  return { knows, working, newItems };
}

// ---- Free-conversation WITNESS selection + crediting (the model↔server handoff) ----
// The server, not the model, picks the bounded in-play TARGET set and hands the model the palette of
// what the learner already says, so the chat stays natural. The model reports evidence; crediting is
// deterministic here.

/** Max in-play targets the model reports on per turn — bounds the prompt + schema as the catalog grows. */
export const WITNESS_TARGET_CAP = 8;

export interface WitnessSelection {
  /** Everything in the learner model — the tutor's conversational palette. */
  knows: Learnable[];
  /** The bounded in-play set to drive THIS turn — the not-yet-mastered items (closest to mastery first)
   *  plus any freshly-introduced ones. Only these can earn a success. */
  targets: Learnable[];
}

export function selectForWitness(
  model: LearnerModel,
  level: 1 | 2,
  focusIds: string[] = [],
  threshold = THRESHOLD,
): WitnessSelection {
  const { knows, working, newItems } = selectForConversation(model, level, threshold);
  const orderedWorking = [...working].sort(
    (a, b) =>
      (model.learnables[b.id]?.successes ?? 0) - (model.learnables[a.id]?.successes ?? 0) ||
      Number(!!b.core) - Number(!!a.core),
  );

  // The rehearsal→free-chat handoff (roadmap 12b) hands in the just-introduced learnable set. Those
  // FOCUS items LEAD the target list — the reinforce half of introduce-then-reinforce — and are
  // force-included even if the learner has never touched them (a freshly-introduced item is unseen but
  // must still be creditable so producing it live earns a success). Then the ripest working items, then
  // the generic edge; dedup by id and cap. The credit firewall is unchanged: only `targets` can earn a
  // success (creditFromEvidence gates on this set), so biasing WHAT is in play never widens the surface.
  const focus = focusIds.map((id) => LEARNABLES[id]).filter(Boolean) as Learnable[];
  const seen = new Set<string>();
  const targets: Learnable[] = [];
  for (const l of [...focus, ...orderedWorking, ...newItems]) {
    if (!seen.has(l.id)) {
      seen.add(l.id);
      targets.push(l);
    }
  }
  return { knows, targets: targets.slice(0, WITNESS_TARGET_CAP) };
}

/** Normalize a Slovene surface for catalog lookup: lowercase, drop punctuation, collapse whitespace. */
function normSurface(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?¿¡;:"'()«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map a produced Slovene surface to a known catalog learnable (vocab/chunk only — a bare surface can't
 *  evidence a pattern frame). Credits OBSERVED off-target Slovene against the right id. */
export function findLearnableBySurface(surface: string): Learnable | undefined {
  const n = normSurface(surface);
  if (!n) return undefined;
  return Object.values(LEARNABLES).find((l) => l.kind !== "pattern" && normSurface(l.sl) === n);
}

export interface WitnessCreditResult {
  /** The updated durable model (successes/attempts folded in). */
  model: LearnerModel;
  /** What was credited this turn — for the turn log and back-compat. */
  progress: LearnableProgress[];
  /** Novel Slovene the learner produced with NO catalog match — the catalog-growth queue. */
  candidates: ObservedItem[];
}

/** Deterministic server-side crediting from the model's witness evidence (the firewall):
 *   - SUCCESS is gated to the in-play TARGET set AND Slovene language AND a transcript span check.
 *     A target produced correctly in Slovene → success; produced in Slovene but wrong → an attempt
 *     (stalls before mastery, decrements after — the flub rule in applyCredit).
 *   - produced:false / English / span-mismatch → NO-OP (no credit, no attempt, no decrement).
 *   - OBSERVED off-target Slovene → an ATTEMPT only (never a success); a known catalog item is credited
 *     by id, novel Slovene becomes a catalog candidate. Successes can never come off-target. */
export function creditFromEvidence(
  model: LearnerModel,
  evidence: WitnessResult,
  targets: Learnable[],
  threshold = THRESHOLD,
): WitnessCreditResult {
  const targetIds = new Set(targets.map((t) => t.id));
  const transcript = (evidence.transcriptVerbatim || "").toLowerCase();
  const progress: LearnableProgress[] = [];
  const seen = new Set<string>();

  for (const e of evidence.targets ?? []) {
    if (!e?.id || !targetIds.has(e.id) || seen.has(e.id)) continue; // allowlist + dedup
    const said = (e.said ?? "").toLowerCase().trim();
    const spanOk = said.length > 0 && transcript.includes(said); // evidence must be in the transcript
    if (e.produced && e.saidLang === "sl" && spanOk) {
      seen.add(e.id);
      progress.push({ id: e.id, result: e.correct ? "success" : "attempt" });
    }
    // else: produced:false / English / span mismatch → no-op
  }

  const candidates: ObservedItem[] = [];
  for (const o of evidence.observed ?? []) {
    if (!o?.surface) continue;
    const l = findLearnableBySurface(o.surface);
    if (l && !targetIds.has(l.id) && !seen.has(l.id)) {
      // Correct reuse of a MASTERED item is a no-op — observed carries no correctness signal, so we must
      // not let natural reuse trip the flub-decrement and erode mastery. Only unmastered items take an attempt.
      if (isMastered(model.learnables[l.id], threshold)) continue;
      seen.add(l.id);
      progress.push({ id: l.id, result: "attempt" }); // off-target unmastered Slovene → attempt only
    } else if (!l) {
      candidates.push({ surface: o.surface, gloss: o.gloss ?? "" });
    }
  }

  return { model: applyCredit(model, progress, threshold), progress, candidates };
}
