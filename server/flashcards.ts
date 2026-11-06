// Flashcard decks (docs/features/flashcards/spec.md §1, §5, §6): a domain's learnables in domain order,
// each with its card text and an example line whose clip is already in the disk store.
import { DIALOGUES, getPublishedDialogues, type Dialogue, type DialogueNode } from "./dialogues";
import { LEARNABLES } from "./learnables";
import { CATALOG } from "./catalog";
import { getE3 } from "./adapters/index";
import { isSynthesized } from "./scripts/dialogue-lib";
import * as store from "./assets/store";
import type { LearnerModel } from "./types";

export interface FlashcardExample { sl: string; en: string; voice: string | undefined }
export interface Flashcard { id: string; en: string; note?: string; sl: string; example: FlashcardExample | null }

const words = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);

/** Spec §6.2 key 1: some slash alternative of the card's `sl` has every word in the line. */
function formMatch(cardSl: string, line: string): boolean {
  const have = new Set(words(line));
  return cardSl.split("/").some((alt) => {
    const w = words(alt);
    return w.length > 0 && w.every((x) => have.has(x));
  });
}

function domainOrder(levels: Dialogue[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => { if (!seen.has(id)) { seen.add(id); ids.push(id); } };
  for (const d of levels) {
    for (const n of Object.values(d.nodes)) for (const id of n.learnables ?? []) add(id);
    for (const id of d.introduces) add(id);
  }
  return ids;
}

/** The store key of a line spoken in `voice`, resolved the way /api/speak resolves its `voice` param. */
function clipKey(voice: string | undefined, sl: string): string {
  const e3 = getE3();
  const profile = voice && CATALOG.voiceProfiles[voice] ? voice : undefined;
  return store.audioKey(e3.name, e3.voiceTagFor(profile), sl);
}

function exampleFor(id: string, cardSl: string, levels: Dialogue[]): FlashcardExample | null {
  const cands: { d: Dialogue; n: DialogueNode; order: number; form: boolean; client: boolean; len: number }[] = [];
  for (const d of levels) {
    if (d.audio !== "ready") continue;
    Object.values(d.nodes).forEach((n, order) => {
      if (!n.learnables?.includes(id) || !isSynthesized(d, n)) return;
      cands.push({ d, n, order, form: formMatch(cardSl, n.sl), client: n.speaker === "client", len: words(n.sl).length });
    });
  }
  cands.sort((a, b) =>
    Number(b.form) - Number(a.form) || Number(b.client) - Number(a.client) || a.len - b.len ||
    a.d.level - b.d.level || a.order - b.order);
  // A card with a multi-word alternative takes only a form-matching line; single words may fall through to an inflected one.
  const strict = cardSl.split("/").some((alt) => words(alt).length > 1);
  for (const c of cands) {
    if (strict && !c.form) break;
    const voice = c.d.voices[c.n.speaker];
    if (store.has(clipKey(voice, c.n.sl), "audio")) return { sl: c.n.sl, en: c.n.en, voice };
  }
  return null;
}

const decks = new Map<string, Flashcard[] | null>();

/** The domain's deck, computed once per domain; `null` for a domain with no published levels. */
export function deckFor(domainId: string): Flashcard[] | null {
  if (!Object.hasOwn(DIALOGUES, domainId)) return null; // not cached: the audio route passes any query string here
  if (decks.has(domainId)) return decks.get(domainId)!;
  const levels = getPublishedDialogues(domainId);
  const deck = levels.length === 0 ? null : domainOrder(levels).map((id) => {
    const l = LEARNABLES[id]!; // dialogues.ts refuses to load a level naming a learnable not in the catalog
    const cut = l.gloss.indexOf(" — ");
    return {
      id,
      en: cut < 0 ? l.gloss : l.gloss.slice(0, cut),
      ...(cut < 0 ? {} : { note: l.gloss.slice(cut + 3) }),
      sl: l.sl,
      example: exampleFor(id, l.sl, levels),
    };
  });
  decks.set(domainId, deck);
  return deck;
}

/** The card's example clip from the disk store only; `null` on any miss. */
export function exampleClip(domainId: string, id: string): Buffer | null {
  const ex = deckFor(domainId)?.find((c) => c.id === id)?.example;
  return ex ? store.read(clipKey(ex.voice, ex.sl), "audio") : null;
}

export const FLASHCARD_THRESHOLD = 5;
const DUE_AFTER_MS = 30 * 86_400_000;

/** A rating applied to the model: a new model, `learnables` and `facts` untouched (spec §7). */
export function rate(model: LearnerModel, learnableId: string, result: "nailed" | "oops", now: Date): LearnerModel {
  const at = now.toISOString();
  const prev = model.flashcards?.[learnableId] ?? { nailed: 0 };
  const next = { ...prev, lastRatedAt: at };
  if (result === "nailed") {
    next.nailed = prev.nailed + 1;
    if (next.nailed >= FLASHCARD_THRESHOLD) next.memorisedAt = at;
  }
  return { ...model, flashcards: { ...model.flashcards, [learnableId]: next } };
}

/** `memorised` and `due` for one card, derived at read time (spec §1). */
export function status(model: LearnerModel, learnableId: string, now: Date): { memorised: boolean; due: boolean } {
  const st = model.flashcards?.[learnableId];
  const memorised = (st?.nailed ?? 0) >= FLASHCARD_THRESHOLD;
  const at = st?.memorisedAt ? Date.parse(st.memorisedAt) : NaN;
  return { memorised, due: !memorised || (Number.isFinite(at) && now.getTime() - at > DUE_AFTER_MS) };
}
