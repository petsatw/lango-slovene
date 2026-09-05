// Detecting a KNOWN phrase in a line of live transcript — the ASR channel of live-mode crediting.
//
// The targets are a closed set of 5–8 phrases the server chose before the session opened, so the
// question is never "what did the learner say" but "is this one of the eight". That is a DETECTION
// problem, and it is what makes crediting tractable on a transcript whose Slovene competence is
// undocumented: a consistently wrong mapping is a decodable code, and this file decodes it.
//
// Three ways a target can land, weakest last:
//   surface — the canonical Slovene is there once case, diacritics and punctuation stop counting
//   alias   — a mishearing observed in a real session log (Živjo → "Zero")
//   fuzzy   — close enough by edit distance over a same-length window of the line
//
// Pure: strings in, verdict out. No I/O, no model, no learner state. Tested by `npm run test:live-match`.

import type { Learnable } from "../learnables";

export type MatchVia = "surface" | "alias" | "fuzzy";

export interface Match {
  matched: boolean;
  via: MatchVia | null;
}

/** Mishearings seen in real session logs, per learnable id. This list is grown from `npm run runs`:
 *  a target the tutor plainly answered while the learner's own line read as something else is an alias
 *  waiting to be written down. Compared after normalisation, so case and punctuation are irrelevant. */
export const ALIASES: Record<string, string[]> = {
  zivjo: ["zero"],
};

const FOLD: Record<string, string> = { č: "c", ć: "c", ž: "z", š: "s", đ: "d" };

/** Case-fold, strip diacritics, drop everything that is not a letter or digit. What survives is the
 *  shape of the sounds, which is the level at which a transcriber and a learner can be compared. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[čćžšđ]/g, (c) => FOLD[c]!)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A catalog surface may carry one alternation — "Rad / Rada bi ___." is two frames written once.
 *  Each side is a phrase the learner might actually produce, so each is matched on its own. */
export function variantsOf(sl: string): string[] {
  const alt = /(\S+)\s*\/\s*(\S+)/.exec(sl);
  if (!alt) return [sl];
  return [sl.replace(alt[0], alt[1]!), sl.replace(alt[0], alt[2]!)];
}

/** The literal words of a surface, in order, with the pattern slot removed: "Eno ___, prosim." is the
 *  two runs "eno" and "prosim", and a line carries the frame when both are there in that order. A run
 *  of one letter carries no evidence and is dropped. */
export function segmentsOf(sl: string): string[] {
  return sl
    .split("___")
    .map(normalise)
    .filter((s) => s.length >= 2);
}

function tokens(s: string): string[] {
  return s ? s.split(" ") : [];
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** How far a window may sit from the segment and still count as the same production. One edit is always
 *  allowed; longer phrases get proportionally more, because a longer phrase mangled by the same amount
 *  is still recognisably itself. */
function tolerance(seg: string): number {
  return Math.max(1, Math.floor(seg.length / 4));
}

/** Find one segment in the line at or after `from`, exact first. Returns where the match ended, so the
 *  next segment is looked for AFTER this one — a frame's words have to arrive in their own order. */
function findSegment(
  lineTokens: string[],
  seg: string,
  from: number,
): { at: number; fuzzy: boolean } | null {
  const n = tokens(seg).length;
  let fuzzyAt: number | null = null;
  for (let i = from; i + n <= lineTokens.length; i++) {
    const window = lineTokens.slice(i, i + n).join(" ");
    if (window === seg) return { at: i + n, fuzzy: false };
    // Fuzzy is for phrases with enough letters to be recognisable when mangled; "ja" and "ne" are one
    // edit away from half the language, so they are matched exactly or not at all.
    if (fuzzyAt === null && seg.length >= 4 && editDistance(window, seg) <= tolerance(seg)) {
      fuzzyAt = i + n;
    }
  }
  return fuzzyAt === null ? null : { at: fuzzyAt, fuzzy: true };
}

/** All segments present, in order. Returns how they landed, or null if any is missing. */
function matchSegments(lineTokens: string[], segments: string[]): "surface" | "fuzzy" | null {
  if (!segments.length) return null;
  let from = 0;
  let fuzzy = false;
  for (const seg of segments) {
    const hit = findSegment(lineTokens, seg, from);
    if (!hit) return null;
    from = hit.at;
    fuzzy = fuzzy || hit.fuzzy;
  }
  return fuzzy ? "fuzzy" : "surface";
}

/** Did this line of transcript carry this target? An exact landing anywhere beats a fuzzy one, and a
 *  recorded mishearing beats a guess — so all three channels are tried before the weakest one answers. */
export function matchTarget(line: string, target: Learnable): Match {
  const lineTokens = tokens(normalise(line));
  if (!lineTokens.length) return { matched: false, via: null };

  let fuzzy = false;
  for (const variant of variantsOf(target.sl)) {
    const how = matchSegments(lineTokens, segmentsOf(variant));
    if (how === "surface") return { matched: true, via: "surface" };
    if (how === "fuzzy") fuzzy = true;
  }

  for (const alias of ALIASES[target.id] ?? []) {
    if (matchSegments(lineTokens, [normalise(alias)]) === "surface") {
      return { matched: true, via: "alias" };
    }
  }

  return fuzzy ? { matched: true, via: "fuzzy" } : { matched: false, via: null };
}

/** The transcriber's hint list: every literal word-run of every target, plus the mishearings we already
 *  know it makes. It biases the transcriber toward the only words this session is scored on, which
 *  attacks the mishearing at its source rather than after it. Bounded to the vendor's ceiling — 100
 *  terms of at most 50 characters. */
export function keytermsFor(targets: Learnable[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (term: string) => {
    const t = term.trim();
    if (!t || t.length > 50 || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push(t);
  };
  for (const t of targets) {
    for (const variant of variantsOf(t.sl)) {
      for (const literal of variant.split("___")) {
        add(literal.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""));
      }
    }
    for (const alias of ALIASES[t.id] ?? []) add(alias);
  }
  return out.slice(0, 100);
}
