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

// ---- Difficulty band classification (docs/dialogue-difficulty-model.md §3) ------------------------
// Difficulty is COMPUTED after authoring, not authored, against two A1 tiers:
//   - CORE      = the learnable's own `core: true` flag (the narrow, high-frequency survival core).
//   - Tagged-A1 = the superset "also A1 material" (CORE ⊆ Tagged-A1). A learnable is Tagged-A1 iff it is
//                 CORE or carries the catalog `a1` tag.
// Both callers (reconcile — the writer; lint:a1 — the yardstick) share `bandFor` so the band a level ships
// with is byte-identical to the band the lint reports. Pure: callers pass the two id sets in.

export type DialogueBand = "basic" | "intermediate" | "advanced" | "above-a1";

/** The A1-density threshold basic + intermediate clear (docs §3). */
export const A1_DENSITY_THRESHOLD = 0.8;
/** The looser A1 density advanced clears, and the core density intermediate clears (docs §3). */
export const ADVANCED_DENSITY_THRESHOLD = 0.75;
export const INTERMEDIATE_CORE_THRESHOLD = 0.5;

/** How one line lands. A CORE line carries at least one core item with everything else A1-or-core — the
 *  core item is the frame, and A1 vocabulary dropped into its slots rides along. */
export type LineClass = "core" | "a1" | "outside";

/** Classify one line from the learnable ids it is made of (docs §3 "Classifying one line"). */
export function classifyLine(ids: string[], coreIds: Set<string>, taggedA1Ids: Set<string>): LineClass {
  if (ids.some((id) => !coreIds.has(id) && !taggedA1Ids.has(id))) return "outside";
  return ids.some((id) => coreIds.has(id)) ? "core" : "a1";
}

export interface BandTally {
  band: DialogueBand;
  /** What was counted: one entry per line, or one per `introduces` id on a not-yet-tagged tapped tree. */
  basis: "line" | "introduces";
  core: number;
  a1: number;
  outside: number;
  /** Counted units carrying no learnables at all — excluded from the ratios (docs §3, open question). */
  unmeasured: number;
  /** core + a1 + outside — the denominator the ratios use. */
  counted: number;
}

function tallyToBand(core: number, a1: number, outside: number): DialogueBand {
  const n = core + a1 + outside;
  if (n === 0) return "basic";               // nothing measurable: a pure-review tree is not hard
  const coreRatio = core / n;
  const a1Ratio = (core + a1) / n;
  if (coreRatio >= A1_DENSITY_THRESHOLD) return "basic";
  if (a1Ratio >= A1_DENSITY_THRESHOLD && coreRatio >= INTERMEDIATE_CORE_THRESHOLD) return "intermediate";
  if (a1Ratio >= ADVANCED_DENSITY_THRESHOLD) return "advanced";
  return "above-a1";
}

/** The per-line band (docs §3). `lines` is the learnable ids on each COUNTED line — client nodes only for
 *  a spoken lesson, every node for a rehearsal dialogue. */
export function classifyLines(
  lines: string[][],
  coreIds: Set<string>,
  taggedA1Ids: Set<string>,
): BandTally {
  let core = 0, a1 = 0, outside = 0, unmeasured = 0;
  for (const ids of lines) {
    if (!ids.length) { unmeasured++; continue; }
    const cls = classifyLine(ids, coreIds, taggedA1Ids);
    if (cls === "core") core++;
    else if (cls === "a1") a1++;
    else outside++;
  }
  return { band: tallyToBand(core, a1, outside), basis: "line", core, a1, outside, unmeasured, counted: core + a1 + outside };
}

/** The per-item band over a level's `introduces` set — the basis for a tapped tree whose nodes carry no
 *  `learnables` yet. It counts a noun as a demand equal in weight to the frame it sits inside, which is
 *  what the per-line model exists to fix; a tree reaches `classifyLines` as soon as its nodes are tagged. */
export function classifyIntroduces(
  introduces: string[],
  coreIds: Set<string>,
  taggedA1Ids: Set<string>,
): BandTally {
  let core = 0, a1 = 0, outside = 0;
  for (const id of introduces) {
    if (coreIds.has(id)) core++;
    else if (taggedA1Ids.has(id)) a1++;
    else outside++;
  }
  const n = introduces.length;
  const coreRatio = n === 0 ? 1 : core / n;
  const taggedRatio = n === 0 ? 1 : (core + a1) / n;
  const band: DialogueBand =
    coreRatio >= A1_DENSITY_THRESHOLD ? "basic"
    : taggedRatio >= A1_DENSITY_THRESHOLD ? "intermediate"
    : "advanced";
  return { band, basis: "introduces", core, a1, outside, unmeasured: 0, counted: n };
}

export interface BandSubject {
  /** "audio" = a spoken lesson (client nodes are the denominator); "tap" = a rehearsal dialogue (all nodes). */
  advance?: string;
  /** The level's declared catalog delta — the fallback basis while the nodes are untagged. */
  introduces: string[];
  nodes: Record<string, { speaker: "npc" | "client"; learnables?: string[] }>;
}

/** Band one level. Length is not an input: it measures amount, not difficulty. */
export function bandFor(d: BandSubject, coreIds: Set<string>, taggedA1Ids: Set<string>): BandTally {
  const spoken = (d.advance ?? "tap") === "audio";
  const counted = Object.values(d.nodes).filter((n) => !spoken || n.speaker === "client");
  const tagged = counted.filter((n) => n.learnables?.length);
  if (!tagged.length) return classifyIntroduces(d.introduces, coreIds, taggedA1Ids);
  return classifyLines(counted.map((n) => n.learnables ?? []), coreIds, taggedA1Ids);
}

const BAND_LABELS: Record<DialogueBand, string> = {
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
  "above-a1": "Above A1",
};

/** The human `levelLabel` written onto the dialogue + manifest, derived from the computed band. */
export function bandToLabel(band: DialogueBand): string {
  return BAND_LABELS[band];
}

const BAND_ORDER: Record<DialogueBand, number> = { basic: 0, intermediate: 1, advanced: 2, "above-a1": 3 };

/** Ordinal rank of a band (basic < intermediate < advanced) — for the ascending-order check. */
export function bandRank(band: DialogueBand): number {
  return BAND_ORDER[band];
}

/** Does this node become an audio clip? In a SPOKEN scene (`advance: "audio"`) the client lines are what
 *  the LEARNER says aloud — they are never synthesized and never played back, so they own no clip and can
 *  collide with nothing. Every tool that reasons about clips asks this rather than re-deriving it, so the
 *  asset builder and `lint:dialogue` agree on which files exist. */
export function isSynthesized(
  dialogue: { advance?: string },
  node: { speaker: "npc" | "client" },
): boolean {
  return !((dialogue.advance ?? "tap") === "audio" && node.speaker === "client");
}
