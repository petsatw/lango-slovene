// Shared, side-effect-free helpers for the dialogue authoring pipeline — imported by reconcile-dialogue
// (the L-lane writer), lint-tree (the structural gate) and lint-dialogue (the catalog gate). Keeping the
// canonical-surface normalizer and the tree-analysis in ONE place means the dedup invariant the writer
// enforces is byte-identical to the one the lint checks.
//
// Pure functions only. No imports of server modules that load data at startup (so importing this never
// triggers a catalog/dialogue read); callers pass plain objects in.

/** Normalize a Slovene surface for the DRY-dedup invariant: lowercase, drop the slot marker + punctuation,
 *  collapse whitespace. Two learnables that normalize to the same string are the SAME lexical unit and must
 *  share one id (a word is minted once, referenced by id everywhere). This is a conservative EXACT-collision
 *  detector, NOT a semantic-similarity judge — deciding whether two DIFFERENT surfaces mean the same thing
 *  is the author/critic's (LLM) job upstream; this only catches surfaces that are already identical. */
export function normSurface(s: string): string {
  return s
    .toLowerCase()
    .replace(/___/g, "")
    .replace(/[.,!?¿¡;:"'()«»/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The closed set of learnable kinds (mirrors LearnableKind in server/learnables.ts) + the aliases the
 *  reconcile normalizes. An author delta may say "vocab"/"word"/"phrase"; everything else is rejected
 *  fail-loud rather than passed through to fragment the taxonomy. */
export const CANONICAL_KINDS = ["vocabulary", "chunk", "pattern"] as const;
export type CanonicalKind = (typeof CANONICAL_KINDS)[number];

const KIND_ALIASES: Record<string, CanonicalKind> = {
  vocabulary: "vocabulary",
  vocab: "vocabulary",
  word: "vocabulary",
  chunk: "chunk",
  phrase: "chunk",
  pattern: "pattern",
  frame: "pattern",
};

/** Normalize a raw kind string to its canonical form, or return null if it is not a known kind/alias
 *  (the caller fails loud on null — a closed enum, never a silent pass-through). */
export function normalizeKind(raw: string): CanonicalKind | null {
  return KIND_ALIASES[raw?.toLowerCase?.().trim()] ?? null;
}

// ---- Tree analysis (a dialogue node graph) --------------------------------------------------------
// A minimal structural view of a node so these helpers work on both the runtime Dialogue and a draft.

export interface TreeNodeLike {
  speaker: "npc" | "client";
  next: string[];
}
export type TreeNodes = Record<string, TreeNodeLike>;

/** Incoming-edge count for every node id (0 for the root / any unreferenced node). A count > 1 means the
 *  node is a re-convergence point — coherent authoring reuses shared later nodes, but a convergence target
 *  is only coherent if it reads on EVERY incoming path, so these are surfaced for human review. */
export function inDegrees(nodes: TreeNodes): Map<string, number> {
  const deg = new Map<string, number>();
  for (const id of Object.keys(nodes)) deg.set(id, 0);
  for (const n of Object.values(nodes)) {
    for (const next of n.next) deg.set(next, (deg.get(next) ?? 0) + 1);
  }
  return deg;
}

/** Node ids reachable from `root` by following `next`. Anything not in the returned set is dead content. */
export function reachableFrom(root: string, nodes: TreeNodes): Set<string> {
  const seen = new Set<string>();
  const stack = [root];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || !nodes[id]) continue;
    seen.add(id);
    for (const next of nodes[id]!.next) stack.push(next);
  }
  return seen;
}

/** Node ids that can reach a TERMINAL (a node with `next: []`) — computed by reverse reachability from the
 *  terminals. Any reachable node NOT in this set is on a path that never ends (a cycle, or a dead spur):
 *  the dialogue would trap the learner. */
export function canReachTerminal(nodes: TreeNodes): Set<string> {
  const reverse = new Map<string, string[]>();
  const terminals: string[] = [];
  for (const [id, n] of Object.entries(nodes)) {
    if (n.next.length === 0) terminals.push(id);
    for (const next of n.next) (reverse.get(next) ?? reverse.set(next, []).get(next)!).push(id);
  }
  const ok = new Set<string>();
  const stack = [...terminals];
  while (stack.length) {
    const id = stack.pop()!;
    if (ok.has(id)) continue;
    ok.add(id);
    for (const parent of reverse.get(id) ?? []) stack.push(parent);
  }
  return ok;
}

// ---- Difficulty band classification (docs/dialogue-difficulty-model.md) ---------------------------
// Difficulty is COMPUTED after authoring, not authored. A dialogue's band is measured over its PRODUCED
// (client) learnables — its `introduces` set — against two A1 tiers:
//   - CORE      = the curated a1-map mappings (narrow, high-frequency survival core).
//   - Tagged-A1 = the superset "also A1 material" (CORE ⊆ Tagged-A1). A learnable is Tagged-A1 iff it is
//                 CORE or carries the catalog `a1` tag.
// Both callers (reconcile — the writer; lint:a1 — the yardstick) share this one function so the band a
// level ships with is byte-identical to the band the lint reports. Pure: callers pass the two id sets in.

export type DialogueBand = "basic" | "intermediate" | "advanced";

/** The A1-density threshold both A1-focused bands clear (docs §3). */
export const A1_DENSITY_THRESHOLD = 0.8;

export interface BandInputs {
  /** The level's produced/client learnable ids (its `introduces` — the measurement basis). */
  introduces: string[];
  /** Learnable ids that are CORE (mapped by ≥1 a1-map competency). */
  coreIds: Set<string>;
  /** Learnable ids that are Tagged-A1 (CORE OR carrying the `a1` tag). */
  taggedA1Ids: Set<string>;
}

/** Classify a dialogue into basic/intermediate/advanced, on the LANGUAGE IT DEMANDS and nothing else.
 *
 *  Length is deliberately not an input. It used to be — `basic` required a node ceiling as a "short &
 *  simple" proxy — but length is amount, not difficulty: a long lesson built entirely of core survival
 *  language, heavily scaffolded and recycling what the learner already owns, is EASIER than a short one
 *  carrying three above-core items. The proxy also punished good scaffolding, since splitting a line into
 *  smaller nodes to lower the load per beat raised the count. Length still matters — it is reported
 *  beside the band by `lint:a1`, and the per-level size guidance lives in AGENTS.md — it just no longer
 *  decides how hard a lesson is.
 *
 *  A level that produces nothing measurable (introduces == []) is treated as fully-A1 (ratios = 1), so a
 *  pure-review tree lands basic. */
export function classifyBand({ introduces, coreIds, taggedA1Ids }: BandInputs): DialogueBand {
  const n = introduces.length;
  const coreRatio = n === 0 ? 1 : introduces.filter((id) => coreIds.has(id)).length / n;
  const taggedRatio = n === 0 ? 1 : introduces.filter((id) => taggedA1Ids.has(id)).length / n;
  if (coreRatio >= A1_DENSITY_THRESHOLD) return "basic";
  if (taggedRatio >= A1_DENSITY_THRESHOLD) return "intermediate";
  return "advanced";
}

const BAND_LABELS: Record<DialogueBand, string> = {
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** The human `levelLabel` written onto the dialogue + manifest, derived from the computed band. */
export function bandToLabel(band: DialogueBand): string {
  return BAND_LABELS[band];
}

const BAND_ORDER: Record<DialogueBand, number> = { basic: 0, intermediate: 1, advanced: 2 };

/** Ordinal rank of a band (basic < intermediate < advanced) — for the ascending-order check. */
export function bandRank(band: DialogueBand): number {
  return BAND_ORDER[band];
}

/** Does this node become an audio clip? In a SPOKEN scene (`advance: "audio"`) the client lines are what
 *  the LEARNER says aloud — they are never synthesized and never played back, so they own no clip and can
 *  collide with nothing. Every tool that reasons about clips must ask this rather than re-derive it: the
 *  rule lived inline in the asset builder and was simply missing from `lint:dialogue`, which then warned
 *  about a delivery collision between audio files that do not exist. */
export function isSynthesized(
  dialogue: { advance?: string },
  node: { speaker: "npc" | "client" },
): boolean {
  return !((dialogue.advance ?? "tap") === "audio" && node.speaker === "client");
}
