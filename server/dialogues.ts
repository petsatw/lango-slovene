// DIALOGUE framework — predetermined BRANCHING rehearsal dialogues paired with a scenario.
//
// A dialogue is a fully authored decision tree: an NPC (waiter, baker, …) speaks, the learner picks
// among a few canned client replies, the NPC responds, and so on. It is REHEARSAL ONLY — exposure before the live
// mic. Nothing here credits mastery (contrast the seed, which plants attempts): the learner clicks
// through to see/hear/translate a typical exchange, then produces it for real in the live tutor.
//
// Not the visual scenario engine and not the seed: no images, no objectives, no model — just a node
// graph plus (once built) pregenerated per-speaker audio. `audio` gates the client's play affordance so
// a no-audio click-through preview can't trigger a billed live synthesis.
//
// Loaded + validated once at startup from server/dialogues/*.json, keyed by scenarioId.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CATALOG } from "./catalog";
import { LEARNABLES } from "./learnables";

export type DialogueSpeaker = "npc" | "client";
export type DialogueAudioState = "pending" | "ready";

/** How the learner moves a tree forward.
 *  - `"tap"` (the default, and every dialogue shipped before this existed): the learner PICKS a client
 *    line. Pure rehearsal — no mic, no server turn, no crediting.
 *  - `"audio"`: the learner SPEAKS and the tree advances on the audio ARRIVING, never on what it says
 *    (nothing here inspects or judges the recording). Client nodes are then the expected production
 *    rather than a menu, and the beat's `learnables` are planted as ATTEMPTS — never masteries.
 *  Both are driven by the same adapter (adapters/dialogue-scripted.ts). */
export type DialogueAdvance = "tap" | "audio";

/** When this beat's English gloss reaches the learner.
 *  - `"tap"` (the default): revealed on tap, the click-to-reveal every rehearsal tree uses.
 *  - `"after"`: shown on its own once the Slovene has landed — meaning arrives second, so the learner
 *    meets the Slovene first and the English confirms it.
 *  - `"held"`: the beat carries its meaning by situation alone, and the gloss stays available to the
 *    surface without being surfaced here. */
export type GlossPolicy = "tap" | "after" | "held";

/** One escalating prompt for a learner who has gone quiet — the character filling a silence, at a
 *  measured wait. Several on a node form a ladder (each `afterMs` later than the last), so a pause gets
 *  gentler company before it gets clearer help. Each is a real spoken line and gets its own clip. */
export interface DialogueStallHandler {
  /** Milliseconds of silence after which this line plays, measured from the learner's turn opening. */
  afterMs: number;
  /** The line, in Slovene — the caption and the audio cache key, exactly as `DialogueNode.sl` is. */
  sl: string;
  /** English gloss. */
  en: string;
  /** Optional delivery-tagged variant, synthesized in place of `sl` while `sl` stays the key. */
  deliverySL?: string;
}

export interface DialogueNode {
  speaker: DialogueSpeaker;
  /** The line, in Slovene. This is the DISPLAY caption AND the audio cache key. */
  sl: string;
  /** English gloss — revealed on tap, same click-to-reveal as the live transcript. */
  en: string;
  /** Optional Slovene WITH inline eleven_v3 audio tags (e.g. "[hesitant] Dober dan…"). When present it
   *  is what gets SYNTHESIZED, while `sl` stays the clean caption + cache key — so the tags steer the
   *  voice without ever showing on screen or changing the key. Null/absent → synthesize `sl` plainly. */
  deliverySL?: string;
  /** Optional CHUNKED-SLOW variant of this line — the same content re-spoken slowly, broken into chunks
   *  (e.g. "Jaz sem … Slavko."), for a beat that says the line once at natural speed and then again
   *  slower. Like `sl` it does double duty: it is the chunked CAPTION and the audio cache KEY for the
   *  slow clip. It must therefore differ textually from `sl` — identical text would key to the same clip
   *  and the "slow" version would silently be the natural one. `build:dialogue-assets` emits both. */
  slowSL?: string;
  /** Catalog learnable ids this beat expects the learner to PRODUCE — the allowlist the `"audio"`
   *  advance mode plants as attempts (the same role `SeedStep.learnables` plays in the seed). Valid on
   *  `client` nodes only, and MAY BE EMPTY: a beat whose expected utterance is not Slovene at all (the
   *  learner saying their own name) exercises no catalog item. Ignored in `"tap"` mode, which credits
   *  nothing. Absent → nothing to plant. */
  learnables?: string[];
  /** Optional short parenthetical CONTEXT for a client choice (docs/dialogue-difficulty-model.md §5) —
   *  the situation that choice selects when one branch depends on context the line itself can't carry
   *  (e.g. "if the book is damaged", "no ID on you"). Rendered as a muted "(…)" tag on the choice, never
   *  spoken. Absent → a plain choice. */
  context?: string;
  /** Milliseconds to hold after this line is spoken before its caption appears — the silent beat that
   *  lets a line land as sound before it becomes text. Absent/0 → the caption appears with the line. */
  captionDelayMs?: number;
  /** When this beat's gloss reaches the learner. Absent → "tap", the click-to-reveal every rehearsal
   *  tree already uses. */
  glossPolicy?: GlossPolicy;
  /** Escalating prompts for a learner who has gone quiet, ascending by `afterMs`. Valid on `npc` nodes
   *  — the character is the one who fills the silence while awaiting the learner's turn. Each carries a
   *  real spoken line, so `build:dialogue-assets` gives each its own clip. */
  stallHandlers?: DialogueStallHandler[];
  /** Next node ids. On an npc node: the client-reply choices the learner picks between (may be more than
   *  two — the renderer scrolls). On a client node: the npc's response (one id). Empty = end. */
  next: string[];
}

/** A competency this rehearsal level demonstrates — DISPLAY ONLY (no crediting; mastery is earned live).
 *  Shown to the learner so each level's "what you can do" is explicit. */
export interface DialogueObjective {
  label: string;
  descriptorEN: string;
}

/** An optional audio "story" that plays over the background before a level's tree begins. */
export interface DialogueIntro {
  /** Filename under public/intros/ (e.g. "restaurant-1.mp3"). */
  audio: string;
  /** The exact text sent to TTS, including inline v3 delivery tags — the source of truth for the audio. */
  text?: string;
  /** Plain-English translation of the intro, for display. */
  en?: string;
}

export interface Dialogue {
  id: string;
  scenarioId: string;
  /** Competency level within the scenario: 1..N, ascending difficulty. A scenario may pair several. */
  level: number;
  /** Short human label for the level (e.g. "Survival", "Basic A1", "Full A1"). */
  levelLabel: string;
  title: string;
  /** What this level demonstrates — display only, drives the level's objective list. */
  objectives: DialogueObjective[];
  /** The catalog learnable ids this level INTRODUCES — the concrete "what was just introduced" set that
   *  the rehearsal→free-chat handoff biases free conversation toward (roadmap 12a). Every id must resolve
   *  in the learnable catalog; a word is minted in the catalog ONCE and referenced by id here (and by any
   *  other dialogue that reuses it). May be empty for a pure-review level that introduces nothing new. */
  introduces: string[];
  /** "pending" until per-speaker audio is pregenerated; the client hides play buttons while pending so a
   *  preview click-through can't bill a live synthesis. Flip to "ready" only after `build:dialogue-assets`. */
  audio: DialogueAudioState;
  /** Per-speaker voice profile id (catalog voices.json) — the tag pregenerated audio is keyed on. */
  voices: Record<DialogueSpeaker, string>;
  /** How the learner advances this level — tapped choices (default) or spoken turns. Absent → "tap", so
   *  every dialogue authored before this field keeps its behaviour. See DialogueAdvance. */
  advance?: DialogueAdvance;
  /** Optional portrait background image for this level's rehearsal — a filename under public/backgrounds/
   *  (e.g. "restaurant-1.jpg"). The conversation scrolls over it while the image stays fixed. Absent →
   *  the plain panel background. */
  background?: string;
  /** Optional audio intro for this level, played over the background (full picture, no bubbles yet)
   *  before the tree begins; the learner can skip it, and a skip is remembered so it won't auto-play
   *  again. Absent → the tree starts immediately. */
  intro?: DialogueIntro;
  root: string;
  nodes: Record<string, DialogueNode>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIALOGUES_DIR = path.join(__dirname, "dialogues");

function fail(file: string, msg: string): never {
  throw new Error(`Invalid dialogue "${file}": ${msg}`);
}

function asString(file: string, obj: any, key: string, where: string): string {
  const v = obj?.[key];
  if (typeof v !== "string" || v.length === 0) fail(file, `${where}: field "${key}" must be a non-empty string`);
  return v;
}

function asProfile(file: string, obj: any, key: string, where: string): string {
  const id = asString(file, obj, key, where);
  if (!CATALOG.voiceProfiles[id]) fail(file, `${where}: voice profile "${id}" is not in the catalog`);
  return id;
}

export function validateDialogue(file: string, raw: any): Dialogue {
  if (!raw || typeof raw !== "object") fail(file, "not an object");
  asString(file, raw, "id", "dialogue");
  asString(file, raw, "scenarioId", "dialogue");
  asString(file, raw, "title", "dialogue");
  if (typeof raw.level !== "number" || !Number.isInteger(raw.level) || raw.level < 1)
    fail(file, `"level" must be a positive integer`);
  asString(file, raw, "levelLabel", "dialogue");
  if (!Array.isArray(raw.objectives) || !raw.objectives.length)
    fail(file, `"objectives" must be a non-empty array`);
  for (const o of raw.objectives) {
    asString(file, o, "label", "objective");
    asString(file, o, "descriptorEN", "objective");
  }
  if (!Array.isArray(raw.introduces)) fail(file, `"introduces" must be an array of learnable ids`);
  for (const id of raw.introduces) {
    if (typeof id !== "string" || !LEARNABLES[id])
      fail(file, `introduces: learnable "${id}" is not in the catalog`);
  }
  if (raw.audio !== "pending" && raw.audio !== "ready") fail(file, `"audio" must be "pending" | "ready"`);
  if (!raw.voices || typeof raw.voices !== "object") fail(file, `"voices" must be an object`);
  asProfile(file, raw.voices, "npc", "voices");
  asProfile(file, raw.voices, "client", "voices");
  if (raw.advance !== undefined && raw.advance !== "tap" && raw.advance !== "audio")
    fail(file, `"advance" must be "tap" | "audio"`);
  if (raw.background !== undefined) asString(file, raw, "background", "dialogue");
  if (raw.intro !== undefined) {
    if (!raw.intro || typeof raw.intro !== "object") fail(file, `"intro" must be an object { audio, text?, en? }`);
    asString(file, raw.intro, "audio", "intro");
    if (raw.intro.text !== undefined) asString(file, raw.intro, "text", "intro");
    if (raw.intro.en !== undefined) asString(file, raw.intro, "en", "intro");
  }
  if (!raw.nodes || typeof raw.nodes !== "object" || !Object.keys(raw.nodes).length)
    fail(file, `"nodes" must be a non-empty object`);
  const ids = new Set(Object.keys(raw.nodes));
  asString(file, raw, "root", "dialogue");
  if (!ids.has(raw.root)) fail(file, `root "${raw.root}" is not a node`);
  if (raw.nodes[raw.root].speaker !== "npc") fail(file, `root node "${raw.root}" must be spoken by the npc`);
  for (const [nid, n] of Object.entries<any>(raw.nodes)) {
    const where = `node "${nid}"`;
    if (n?.speaker !== "npc" && n?.speaker !== "client") fail(file, `${where}: speaker must be "npc" | "client"`);
    asString(file, n, "sl", where);
    asString(file, n, "en", where);
    if (n.deliverySL !== undefined) asString(file, n, "deliverySL", where);
    if (n.slowSL !== undefined) {
      asString(file, n, "slowSL", where);
      // Same text ⇒ same audio key ⇒ one clip. The slow variant would silently be the natural one.
      if (n.slowSL === n.sl) fail(file, `${where}: "slowSL" must differ from "sl" (identical text is one audio clip)`);
    }
    if (n.learnables !== undefined) {
      if (!Array.isArray(n.learnables)) fail(file, `${where}: "learnables" must be an array of catalog ids`);
      if (n.speaker !== "client") fail(file, `${where}: "learnables" is only valid on a client node (what the LEARNER produces)`);
      for (const id of n.learnables) {
        if (typeof id !== "string" || !LEARNABLES[id]) fail(file, `${where}: learnable "${id}" is not in the catalog`);
      }
    }
    if (n.captionDelayMs !== undefined) {
      if (typeof n.captionDelayMs !== "number" || !Number.isFinite(n.captionDelayMs) || n.captionDelayMs < 0)
        fail(file, `${where}: "captionDelayMs" must be a non-negative number of milliseconds`);
    }
    if (n.glossPolicy !== undefined && !["tap", "after", "held"].includes(n.glossPolicy))
      fail(file, `${where}: "glossPolicy" must be "tap" | "after" | "held"`);
    if (n.stallHandlers !== undefined) {
      if (!Array.isArray(n.stallHandlers)) fail(file, `${where}: "stallHandlers" must be an array`);
      if (n.speaker !== "npc") fail(file, `${where}: "stallHandlers" is only valid on an npc node (the character fills the silence)`);
      let prev = -1;
      for (const [i, h] of n.stallHandlers.entries()) {
        const hw = `${where} stallHandler[${i}]`;
        if (typeof h?.afterMs !== "number" || !Number.isFinite(h.afterMs) || h.afterMs <= 0)
          fail(file, `${hw}: "afterMs" must be a positive number of milliseconds`);
        // Ascending: a ladder only escalates if each rung waits longer than the one before it.
        if (h.afterMs <= prev) fail(file, `${hw}: "afterMs" (${h.afterMs}) must be greater than the previous handler's (${prev})`);
        prev = h.afterMs;
        asString(file, h, "sl", hw);
        asString(file, h, "en", hw);
        if (h.deliverySL !== undefined) asString(file, h, "deliverySL", hw);
      }
    }
    if (n.context !== undefined) {
      asString(file, n, "context", where);
      if (n.speaker !== "client") fail(file, `${where}: "context" is only valid on a client choice`);
    }
    if (!Array.isArray(n.next)) fail(file, `${where}: next must be an array of node ids`);
    for (const id of n.next) {
      if (typeof id !== "string" || !ids.has(id)) fail(file, `${where}: next references unknown node "${id}"`);
    }
  }
  return raw as Dialogue;
}

/** All rehearsal dialogues, grouped by scenarioId and sorted ascending by level. */
export function loadDialogues(): Record<string, Dialogue[]> {
  const out: Record<string, Dialogue[]> = {};
  let files: string[];
  try {
    files = readdirSync(DIALOGUES_DIR).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return out; // no dialogues dir yet — the feature is optional per scenario
  }
  for (const f of files) {
    const d = validateDialogue(f, JSON.parse(readFileSync(path.join(DIALOGUES_DIR, f), "utf8")));
    (out[d.scenarioId] ??= []).push(d);
  }
  for (const [scenarioId, list] of Object.entries(out)) {
    list.sort((a, b) => a.level - b.level);
    const levels = list.map((d) => d.level);
    if (new Set(levels).size !== levels.length)
      throw new Error(`Duplicate dialogue level for scenario "${scenarioId}": ${levels.join(", ")}`);
  }
  return out;
}

export const DIALOGUES: Record<string, Dialogue[]> = loadDialogues();

/** The rehearsal dialogues paired with a scenario (ascending by level), or [] if none is authored. */
export function getDialoguesForScenario(scenarioId: string): Dialogue[] {
  return DIALOGUES[scenarioId] ?? [];
}
