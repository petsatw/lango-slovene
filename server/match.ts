// Scenario finder — the learner says, in their own words, the situation they want to practise; this
// ranks the published rehearsal/spoken levels against it. Two stages:
//   1. keywordScore — pure, deterministic, no model call (token overlap + a small synonym map). Always
//      runs; it is the whole answer when the model is unavailable.
//   2. an optional E2 `rankScenarios` re-rank over the SAME candidate list (the catalog is small enough
//      to send whole). The server still owns the decision: the threshold + the cut to 3 live here.
// The "Practise this live" fallback is a scene string for the existing free-chat handoff (openTutor).

import type { E2Adapter, ScenarioCandidate, ScenarioRanking } from "./types";

/** One dialogue line, indexed so a result can preview WHERE in the lesson the match is. */
export interface IndexNode {
  id: string;
  speaker: string;
  sl: string;
  en: string;
  next: string[];
  tokens: Set<string>; // stemmed tokens of sl + en
}

/** The 1–2 line preview on a result card: the best-matching line (+ the line that answers it). */
export interface Snippet {
  nodeId: string;
  lines: { speaker: string; sl: string; en: string }[];
  terms: string[]; // matched stemmed tokens — the client highlights words that stem to these
}

export interface IndexEntry extends Omit<ScenarioCandidate, "lines"> {
  scenarioName: string;
  level: number;
  levelTitle: string;
  role: string | null;
  tokens: Set<string>; // stemmed tokens of the level's own text (title + objectives)
  scenarioTokens: Set<string>; // stemmed tokens of the scenario's title + tags + summary
  nodes: IndexNode[]; // in authored order (root first)
}

export interface IndexInput {
  id: string;
  name: string;
  title: string;
  role?: string | null;
  summaryEN?: string;
  tags?: string[];
  dialogues: {
    id: string; level: number; title: string; objectives?: { descriptorEN?: string }[];
    nodes?: Record<string, { speaker: string; sl: string; en: string; next?: string[] }>;
  }[];
}

export interface Match {
  dialogueId: string;
  scenarioId: string;
  scenarioName: string;
  level: number;
  levelTitle: string;
  score: number; // 0..1
  reason: string;
  snippet: Snippet | null;
}

export interface MatchResult {
  query: string;
  matches: Match[];
  fallback: { scene: string; role: string | null };
  ranker: "model" | "keyword";
}

/** Below this, a match isn't shown — only the "Practise this live" card. */
export const MATCH_THRESHOLD = 0.25;
const MAX_MATCHES = 3;

// Words that carry no situation. Kept short on purpose.
export const STOP = new Set(
  "a an the and or of to in at on for with by from i me my we you your it is are be want would like to practise practice practicing learn learning how do some something things thing different".split(" "),
);

// Small synonym map: a learner word → the words our content actually uses. One direction (query side).
export const SYNONYMS: Record<string, string[]> = {
  farmer: ["market", "stall"], farmers: ["market", "stall"], trznica: ["market"], tržnica: ["market"],
  produce: ["fruit", "vegetable"], veggie: ["vegetable"], veggies: ["vegetable"], greengrocer: ["fruit", "vegetable", "market"],
  groceries: ["market", "shop", "bakery"], grocery: ["market", "shop"], shopping: ["shop", "buy"], buying: ["buy"],
  weigh: ["weight", "kilo"], weights: ["weight", "kilo"], kg: ["kilo"], kilogram: ["kilo"], kilograms: ["kilo"], gram: ["grams"],
  amount: ["quantity"], amounts: ["quantity"], number: ["quantity", "numbers"], count: ["quantity", "numbers"],
  cost: ["price"], costs: ["price"], pay: ["price", "pay"], paying: ["pay"],
  coffee: ["coffee", "cafe", "kava", "kavo"], kava: ["coffee", "kavo"], kavo: ["coffee", "kava"], bread: ["bread", "bakery"], kruh: ["bread"],
  meat: ["butcher"], doctor: ["pharmacy", "health"], medicine: ["pharmacy"], drugs: ["pharmacy"],
  eat: ["restaurant", "food"], eating: ["restaurant"], dinner: ["restaurant"], lunch: ["restaurant"], food: ["restaurant", "dish"],
  permit: ["permit", "residence"], visa: ["permit", "residence"], bureaucracy: ["administrative", "office"],
  book: ["library", "book"], books: ["library", "book"], introduce: ["meet", "name"], introduction: ["meet", "name"],
};

/** Lowercase, strip diacritics + punctuation, split, crude stem (drop plural "s"/"es"). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

function stem(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && /(ches|shes|oes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Query tokens + their synonyms (each synonym tokenized the same way). */
export function expandQuery(text: string): Set<string> {
  const out = new Set<string>();
  const raw = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
  for (const w of raw) for (const s of SYNONYMS[w] ?? []) tokenize(s).forEach((t) => out.add(t));
  tokenize(text).forEach((t) => out.add(t));
  return out;
}

/** One entry per published level. Pure: takes plain scenario+dialogue data. */
export function buildIndex(scenarios: IndexInput[]): IndexEntry[] {
  return scenarios.flatMap((s) => {
    const scenarioText = [s.name, s.title, s.summaryEN ?? "", ...(s.tags ?? [])].join(" ");
    const scenarioTokens = new Set(tokenize(scenarioText));
    return s.dialogues.map((d) => {
      const objectives = (d.objectives ?? []).map((o) => o.descriptorEN ?? "").filter(Boolean);
      const nodes: IndexNode[] = Object.entries(d.nodes ?? {}).map(([id, n]) => ({
        id, speaker: n.speaker, sl: n.sl, en: n.en, next: n.next ?? [], tokens: new Set(tokenize(`${n.sl} ${n.en}`)),
      }));
      return {
        dialogueId: d.id,
        scenarioId: s.id,
        scenarioName: s.name,
        level: d.level,
        levelTitle: d.title,
        role: s.role ?? null,
        description: `${s.name} — ${d.title}. ${s.summaryEN ?? ""} Objectives: ${objectives.join("; ")}`.trim(),
        tokens: new Set(tokenize(`${d.title} ${objectives.join(" ")}`)), // node lines feed the snippet, not the score
        scenarioTokens,
        nodes,
      };
    });
  });
}

/** Score 0..1: share of the query's terms the level covers. The scenario's tags/summary decide WHERE
 *  (weight 0.6), the level's own title + objectives decide WHICH level (weight 0.4). */
export function keywordScore(query: Set<string>, e: IndexEntry, words = query.size): number {
  if (!query.size) return 0;
  let where = 0, which = 0;
  for (const t of query) {
    if (e.scenarioTokens.has(t)) where++;
    if (e.tokens.has(t)) which++;
  }
  // Normalised by the learner's own word count (synonyms add matches, not dilution).
  return Math.min(1, (0.6 * where + 0.4 * which) / Math.max(1, Math.min(words, 6)));
}

export function keywordRank(text: string, index: IndexEntry[]): Match[] {
  const q = expandQuery(text);
  const words = tokenize(text).length;
  return index
    .map((e) => {
      const hits = [...q].filter((t) => e.scenarioTokens.has(t) || e.tokens.has(t));
      const n = bestNode(q, e);
      const snippet = n ? snippetFor(e, n.id, q) : null;
      return { e, score: keywordScore(q, e, words), hits, snippet };
    })
    .filter((x) => x.score > 0)
    // Equal scores (levels of one scenario) → the level with an actual matching LINE, then more terms hit.
    .sort((a, b) => b.score - a.score || (b.snippet?.terms.length ?? 0) - (a.snippet?.terms.length ?? 0) || a.e.level - b.e.level)
    .map(({ e, score, hits, snippet }) => toMatch(e, score, `matches: ${hits.slice(0, 5).join(", ")}`, snippet));
}

function toMatch(e: IndexEntry, score: number, reason: string, snippet: Snippet | null = null): Match {
  return { dialogueId: e.dialogueId, scenarioId: e.scenarioId, scenarioName: e.scenarioName, level: e.level, levelTitle: e.levelTitle, score, reason, snippet };
}

/** The line with the most query-term hits (ties → earliest in authored order); null when none hit. */
export function bestNode(query: Set<string>, e: IndexEntry): IndexNode | null {
  let best: IndexNode | null = null, bestHits = 0;
  for (const n of e.nodes) {
    let hits = 0;
    for (const t of query) if (n.tokens.has(t)) hits++;
    if (hits > bestHits) { best = n; bestHits = hits; }
  }
  return best;
}

/** Preview = the node + the line that answers it (its first `next`), so a request shows its reply. */
export function snippetFor(e: IndexEntry, nodeId: string, query: Set<string>): Snippet | null {
  const n = e.nodes.find((x) => x.id === nodeId);
  if (!n) return null;
  const after = e.nodes.find((x) => x.id === n.next[0]);
  const lines = [n, ...(after ? [after] : [])].map(({ speaker, sl, en }) => ({ speaker, sl, en }));
  const terms = [...query].filter((t) => lines.some((l) => tokenize(`${l.sl} ${l.en}`).includes(t)));
  return { nodeId, lines, terms };
}

/** Server-side decision over either ranking: drop unknown ids, apply threshold, cap, one per level. */
export function selectMatches(ranked: Match[]): Match[] {
  const seen = new Set<string>();
  return ranked
    .filter((m) => m.score >= MATCH_THRESHOLD && !seen.has(m.dialogueId) && seen.add(m.dialogueId))
    .slice(0, MAX_MATCHES);
}

/** The free-chat framing used when nothing fits (and always offered as the last card). */
export function fallbackScene(text: string, ranking?: ScenarioRanking): { scene: string; role: string | null } {
  const scene = ranking?.fallback?.scene?.trim() || `The learner wants to practise: ${text.trim()}`;
  return { scene, role: ranking?.fallback?.role?.trim() || null };
}

export async function matchSituation(text: string, index: IndexEntry[], e2?: E2Adapter): Promise<MatchResult> {
  const keyword = keywordRank(text, index);
  if (e2?.rankScenarios) {
    try {
      const ranking = await e2.rankScenarios({
        query: text,
        candidates: index.map(({ dialogueId, scenarioId, description, nodes }) => ({
          dialogueId, scenarioId, description,
          lines: nodes.map((n) => ({ id: n.id, sl: n.sl, en: n.en })),
        })),
      });
      const byId = new Map(index.map((e) => [e.dialogueId, e]));
      const ranked = ranking.matches
        .filter((m) => byId.has(m.dialogueId))
        .map((m) => {
          const e = byId.get(m.dialogueId)!;
          // The model's node is trusted only if it really is a line of THAT level; else keyword's pick.
          const q = expandQuery(text);
          const nodeId = m.nodeId && e.nodes.some((n) => n.id === m.nodeId) ? m.nodeId : bestNode(q, e)?.id;
          return toMatch(e, Math.max(0, Math.min(1, m.score)), m.reason, nodeId ? snippetFor(e, nodeId, q) : null);
        })
        .sort((a, b) => b.score - a.score);
      return { query: text, matches: selectMatches(ranked), fallback: fallbackScene(text, ranking), ranker: "model" };
    } catch (err: any) {
      console.error("[match] model re-rank failed, keyword fallback:", err?.message);
    }
  }
  return { query: text, matches: selectMatches(keyword), fallback: fallbackScene(text), ranker: "keyword" };
}
