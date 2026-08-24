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
import { PACING, DEFAULT_PACING, pacingFor } from "./pacing";

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

/** One rung of the ladder for a learner who has gone quiet.
 *
 *  Crucially these are NOT extra lines of Slovene. Someone who has not spoken is not short of Slovene —
 *  they are stuck, and answering that with more of the language they don't have is the cruellest thing
 *  the scene could do. So each rung either draws the eye back to what is already there, models the
 *  target again, or LOWERS THE BAR in the learner's own language. The bar never disappears.
 *
 *  - `"pulse"`   — the caption pulses once, gently. No copy at all.
 *  - `"respeak"` — the character says the line again, slower (the node's slow clip). Modelling, never
 *                  prompting: never "are you still there?".
 *  - `"soften"`  — the button's label softens to `label` (e.g. "Whisper it if you like."). English, on
 *                  the control, where an instruction belongs. */
export interface DialogueStallHandler {
  /** Milliseconds of silence after which this rung fires, measured FROM THE LEARNER'S TURN OPENING
   *  (i.e. from when the button appears — NOT from the start of the run). Optional, and normally absent:
   *  the rung takes its timing from the dialogue's pacing profile by position (`stallMs[i]`), so a lesson
   *  is paced in one place instead of being re-specified on every node. Set it only to override one rung
   *  of one beat. The original ladder was mis-transcribed as absolute clock times precisely because the
   *  numbers lived here, per node, with nothing to compare them against. */
  afterMs?: number;
  kind: "pulse" | "respeak" | "soften";
  /** For `"soften"`: the English label the button lowers to. Required for that kind, unused otherwise. */
  label?: string;
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
  /** Optional `slowSL` WITH inline delivery tags — what actually gets SYNTHESIZED for the slow clip,
   *  while `slowSL` stays the chunked caption and the cache key. Exactly the `sl`/`deliverySL` split,
   *  and it exists for a measured reason: a ` … ` separator alone does NOT slow eleven_v3 down (two
   *  authored slow lines came back 1.00× and 0.92× the length of their natural clips). Slower speech
   *  has to be DIRECTED, and the direction must not appear on screen. Absent → `slowSL` is synthesized
   *  as written, which will not be slower. */
  deliverySlowSL?: string;
  /** The catalog learnable ids this line IS MADE OF — what the difficulty classifier measures the line
   *  against (docs/dialogue-difficulty-model.md §3). Valid on every node, npc included, since a band
   *  counts lines and an npc line is one.
   *
   *  On a `client` node it carries a second, narrower job: it is also the allowlist the `"audio"` advance
   *  mode plants as attempts (the role `SeedStep.learnables` plays in the seed). **Crediting reads it
   *  only there** — every consumer filters to `speaker === "client"` first — so tagging an npc line
   *  describes it and never credits the learner for hearing it.
   *
   *  MAY BE EMPTY: a beat whose utterance is not Slovene at all (the learner saying their own name)
   *  exercises no catalog item, and an empty list says so rather than leaving it unanswered. Absent →
   *  untagged, which leaves the line unmeasured. */
  learnables?: string[];
  /** Optional short parenthetical CONTEXT for a client choice (docs/dialogue-difficulty-model.md §5) —
   *  the situation that choice selects when one branch depends on context the line itself can't carry
   *  (e.g. "if the book is damaged", "no ID on you"). Rendered as a muted "(…)" tag on the choice, never
   *  spoken. Absent → a plain choice. */
  context?: string;
  /** The substring of `sl` to render at full weight while the rest of the caption steps down —
   *  emphasis doing the segmenting a beginner cannot do for themselves. A learner who hears nine words
   *  and must produce two has nothing on screen telling them which two; contrast tells them, without a
   *  label, a box or a colour announcing that a lesson is happening.
   *
   *  It marks a SHAPE and its variations, wherever they appear — the character's captions included — and
   *  only while that shape is being INTRODUCED; once a phrase is the learner's it stops being marked.
   *  Must occur exactly once in `sl`. */
  focusSpan?: string;
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

/** What the learner is being asked to say, surfaced at the moment their turn opens. It is the upcoming
 *  CLIENT node's own line — not a translation of what the character just said — which is the whole point:
 *  a beginner who has just heard nine words and must produce two cannot tell which two, and the caption
 *  of the character's line cannot tell them. Derived, never authored separately. */
export interface DialoguePrompt {
  /** The Slovene stem the learner produces, e.g. "Sem ___." Blank-slot lines are authored as "___". */
  sl: string;
  /** Its English, e.g. "I'm ___." — for a non-Slovene turn this is the instruction itself, e.g.
   *  "(your own name, spoken on its own)". */
  en: string;
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
  /** The English lines shown BEFORE the scene opens, then faded (the first thing in the run). This is
   *  the on-ramp: it names where the learner is, tells them they are not required to do anything yet,
   *  and promises that forgetting is not their fault. It is what earns the right to withhold English
   *  once the character starts speaking — a scene that opens straight onto un-glossed Slovene, with no
   *  frame and nothing to look at, is unusable by the beginner it exists for. Absent → straight in. */
  frameEN?: string[];
  /** How the learner advances this level — tapped choices (default) or spoken turns. Absent → "tap", so
   *  every dialogue authored before this field keeps its behaviour. See DialogueAdvance. */
  advance?: DialogueAdvance;
  /** Which PACING PROFILE times this lesson (server/catalog/pacing.json) — every engineered silence in
   *  the run, named and dialed in one place. Absent → the default profile. Only meaningful for
   *  `advance: "audio"`; a tapped tree is paced by the learner's own finger. */
  pacing?: string;
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
  if (raw.pacing !== undefined) {
    asString(file, raw, "pacing", "dialogue");
    if (!PACING[raw.pacing])
      fail(file, `"pacing": no such profile "${raw.pacing}" (have: ${Object.keys(PACING).join(", ")})`);
  }
  if (raw.frameEN !== undefined) {
    if (!Array.isArray(raw.frameEN) || !raw.frameEN.length) fail(file, `"frameEN" must be a non-empty array of strings`);
    for (const l of raw.frameEN) if (typeof l !== "string" || !l) fail(file, `"frameEN": every line must be a non-empty string`);
  }
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
    if (n.deliverySlowSL !== undefined) {
      asString(file, n, "deliverySlowSL", where);
      if (!n.slowSL) fail(file, `${where}: "deliverySlowSL" needs a "slowSL" to direct`);
    }
    if (n.learnables !== undefined) {
      if (!Array.isArray(n.learnables)) fail(file, `${where}: "learnables" must be an array of catalog ids`);
      for (const id of n.learnables) {
        if (typeof id !== "string" || !LEARNABLES[id]) fail(file, `${where}: learnable "${id}" is not in the catalog`);
      }
    }
    if (n.captionDelayMs !== undefined) {
      if (typeof n.captionDelayMs !== "number" || !Number.isFinite(n.captionDelayMs) || n.captionDelayMs < 0)
        fail(file, `${where}: "captionDelayMs" must be a non-negative number of milliseconds`);
    }
    if (n.focusSpan !== undefined) {
      asString(file, n, "focusSpan", where);
      // Exactly once, or the renderer has to guess which occurrence carries the emphasis — and a span
      // that isn't in the line at all marks nothing while looking authored.
      const hits = n.sl.split(n.focusSpan).length - 1;
      if (hits !== 1) fail(file, `${where}: "focusSpan" occurs ${hits} times in "sl" — it must occur exactly once`);
    }
    if (n.glossPolicy !== undefined && !["tap", "after", "held"].includes(n.glossPolicy))
      fail(file, `${where}: "glossPolicy" must be "tap" | "after" | "held"`);
    if (n.stallHandlers !== undefined) {
      if (!Array.isArray(n.stallHandlers)) fail(file, `${where}: "stallHandlers" must be an array`);
      if (n.speaker !== "npc") fail(file, `${where}: "stallHandlers" is only valid on an npc node (it is the character's silence to fill)`);
      // The ladder's TIMING lives in the pacing profile, by position; a rung may override its own.
      const profile = pacingFor(raw.pacing);
      if (n.stallHandlers.length > profile.stallMs.length)
        fail(file, `${where}: ${n.stallHandlers.length} stall rungs, but pacing profile "${raw.pacing ?? DEFAULT_PACING}" defines only ${profile.stallMs.length} (stallMs)`);
      let prev = -1;
      for (const [i, h] of n.stallHandlers.entries()) {
        const hw = `${where} stallHandler[${i}]`;
        if (h?.afterMs !== undefined && (typeof h.afterMs !== "number" || !Number.isFinite(h.afterMs) || h.afterMs <= 0))
          fail(file, `${hw}: "afterMs" must be a positive number of milliseconds when present`);
        const atMs = h?.afterMs ?? profile.stallMs[i]!;
        if (atMs <= prev) fail(file, `${hw}: fires at ${atMs}ms, which is not after the previous rung (${prev}ms)`);
        prev = atMs;
        if (!["pulse", "respeak", "soften"].includes(h.kind)) fail(file, `${hw}: "kind" must be "pulse" | "respeak" | "soften"`);
        if (h.kind === "soften") asString(file, h, "label", hw);
        if (h.kind === "respeak" && !n.slowSL) fail(file, `${hw}: "respeak" needs the node to have a "slowSL" to re-speak`);
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
