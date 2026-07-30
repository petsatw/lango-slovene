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
