// The transcriber's hint list for a live session — the lesson's phrases, handed to the vendor at connect
// so its hearing leans toward the Slovene this lesson steers toward.
//
// Hints only. Whether the learner produced a learnable is the grader's reading (./grader.ts): a word
// changes form with its sentence ("kilo krompirja" carries `krompir`), and deciding that is language
// understanding, not string comparison.
//
// Pure: learnables in, strings out. Tested by `npm run test:live-match`.

import type { Learnable } from "../learnables";

/** Mishearings seen in real session logs, per learnable id, offered to the transcriber beside the real
 *  word. This list is grown from `npm run runs`: a target the tutor plainly answered while the learner's
 *  own line read as something else is a mishearing waiting to be written down. */
export const ALIASES: Record<string, string[]> = {
  zivjo: ["zero"],
};

/** A catalog surface may carry one alternation — "Rad / Rada bi ___." is two frames written once.
 *  Each side is a phrase the learner might actually produce, so each is offered on its own. */
export function variantsOf(sl: string): string[] {
  const alt = /(\S+)\s*\/\s*(\S+)/.exec(sl);
  if (!alt) return [sl];
  return [sl.replace(alt[0], alt[1]!), sl.replace(alt[0], alt[2]!)];
}

/** Every literal word-run of every target, plus the mishearings we already know the transcriber makes.
 *  Bounded to the vendor's ceiling — 100 terms of at most 50 characters. */
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
