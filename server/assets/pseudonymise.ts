// Removes personal context from learner text before it reaches a store that outlives the session.

import { LEARNABLES } from "../learnables";

const WORD = /[\p{L}\p{M}]+/gu;
let catalogWords: Set<string> | null = null;

function inCatalog(word: string): boolean {
  if (!catalogWords) {
    catalogWords = new Set(Object.values(LEARNABLES).flatMap((l) => l.sl.toLowerCase().match(WORD) ?? []));
  }
  return catalogWords.has(word.toLowerCase());
}

/** Replaces an email with `[email]`, a run of digits with `[number]`, and a capitalised word inside a
 *  sentence that no catalog line contains with `[name]`. The first word of a sentence is capitalised
 *  by position, so it is left alone, and so is the English pronoun "I". */
export function stripPersonal(text: string): string {
  return text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\d+/g, "[number]")
    .replace(/[\p{L}\p{M}]+/gu, (word, at: number, whole: string) => {
      const prev = whole.slice(0, at).trimEnd().slice(-1);
      const startsSentence = prev === "" || /[.!?¿¡]/.test(prev);
      return !startsSentence && word !== "I" && /^\p{Lu}/u.test(word) && !inCatalog(word) ? "[name]" : word;
    });
}
