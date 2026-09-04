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
import { getFact, factValues } from "./facts";
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

/** Where a CLIENT line's play button gets its sound from (docs/keyphrase-span-playback.md §3.5).
 *
 *  In a spoken scene the learner's lines are never synthesized — we own no recording of them, and putting
 *  the character's voice on their line and calling it theirs would be a lie. But the Key Phrases panel
 *  still wants a "hear it": the phrase was TAUGHT, and the character models it himself somewhere in the
 *  scenario. So this points at the npc node that says it, and — when only part of that line is the phrase —
 *  at the word range within it. Nothing is ever synthesized to satisfy a pointer; it can only ever aim at
 *  a clip that already exists.
 *
 *  The join it records is an ID EQUALITY, made upstream by the `voice-key-phrases` skill and re-checked by
 *  `lint:keyphrase-audio`: the client node and the npc node share a catalog learnable, and the catalog
 *  frame for it declares where the slot is. Fixed words are fixed; only the slot may differ. */
export interface DialogueVoicing {
  /** The npc node id whose clip is played. A node id, never raw text, so a reviewer reading the diff sees
   *  WHICH of the character's lines this phrase was taken from. */
  from: string;
  /** Which level of this scenario `from` lives in. Sourcing across levels is allowed — the best delivery
   *  of a phrase is not always in the lesson that teaches it. */
  level: number;
  /** `"whole"` — play the clip end to end (the phrase IS the whole line: no seek, no cut, true prosody).
   *  `"span"` — play only a word range of it. */
  kind: "whole" | "span";
  /** For `"span"`: the inclusive first/last word index into that clip's stored alignment. THIS is what the
   *  skill chooses; the milliseconds below are derived from it and gate-checked against it, so a
   *  hand-edited or invented timestamp fails rather than plays. */
  words?: [number, number];
  /** For `"span"`: the derived play window, in milliseconds from the start of the clip. */
  startMs?: number;
  endMs?: number;
  /** The words the learner will ACTUALLY hear, when they differ from the phrase on screen — the frame's
   *  slot filled with the character's own word ("Sem ___." heard as "Sem Slavko."). Present ⇒ the panel
   *  shows the phrase as its catalog FRAME, so nothing on screen contradicts the ear. */
  heard?: string;
}

/** A beat that asks the learner for one FACT about themselves (server/facts.ts) instead of simply
 *  handing the turn over.
 *
 *  A spoken lesson has one input channel: the button that says the learner is ready to move on. That is
 *  enough to run a scene and it is not enough to learn anything about the person in it — the recording is
 *  never inspected, so a lesson can ask "which of these are you?" and hear nothing back. This is the
 *  channel that answers it. The beat hands the turn over as SEVERAL buttons rather than one, each one a
 *  whole line the learner can say; the one they press is both the line they produce and the answer they
 *  give. Pressing it stores the fact and advances the spine exactly as the plain button does.
 *
 *  The options are not authored here. They come from the fact's declared values, rendered through the
 *  upcoming client node's own variants — so the learner reads the Slovene they are about to say, and the
 *  set of answers is decided in one place (the fact) rather than restated per lesson.
 *
 *  Gender is the first fact to use this. Nothing about the mechanism is about gender: a later lesson can
 *  ask anything the course declares, and its lines vary the same way. */
export interface DialogueChoice {
  /** The fact id this beat asks for. Must resolve in server/catalog/facts.json. */
  fact: string;
}

/** One node's line, said in the form a single fact value calls for.
 *
 *  A variant is the SAME beat in a different shape — the same moment, the same turn, the same catalog
 *  items — so it may override text and nothing else. `next`, `learnables`, `stallHandlers` and the
 *  timings belong to the beat and are shared by every form of it; a node that wants a different one of
 *  those wants a different node.
 *
 *  Because the audio key is (provider, voiceTag, text), a variant's `sl` is automatically its own clip:
 *  adding one can never disturb a clip already on disk. */
export interface DialogueVariant {
  sl?: string;
  en?: string;
  deliverySL?: string;
  slowSL?: string;
  deliverySlowSL?: string;
  focusSpan?: string;
}

/** The text fields a variant may carry — the closed set, so a field the loader would silently ignore is
 *  rejected instead. */
const VARIANT_FIELDS = ["sl", "en", "deliverySL", "slowSL", "deliverySlowSL", "focusSpan"] as const;

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
  /** The English shown ONCE above the options at a beat that asks the learner about themselves — what
   *  they are being asked to do with the buttons.
   *
   *  It lives on the CLIENT node because it stands in for that line's own gloss: the line has several
   *  forms here, so the prompt slot cannot show one of them without contradicting the other. Each option
   *  carries its own `en` on its own button; this is the one line that speaks for the whole beat, and it
   *  is on screen from the moment the turn opens rather than waiting on the stall ladder — a learner
   *  meeting a new control should not have to fall silent to find out what it is for.
   *
   *  Shared by every form of the line, so it is not something a variant may override. A `\n` in it reaches
   *  the screen as a line break. Absent → the slot stays empty and the options speak for themselves. */
  chooseEN?: string;
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
  /** Where this CLIENT line's Key Phrases play button gets its sound. Absent → no button, which is a valid
   *  and often correct answer: a badly-cut excerpt teaches wrong prosody, which is worse than silence. */
  audio?: DialogueVoicing;
  /** This beat asks the learner for a fact about themselves. Valid on an `npc` node in a spoken lesson —
   *  the character is the one who asks, and the beat he asks on is the one that hands the turn over.
   *  Absent → the turn is handed over as the single "Continue" button, which is every other beat. */
  choice?: DialogueChoice;
  /** The fact id this line's wording depends on. Present ⇒ `variants` says what each answer changes.
   *
   *  On a `client` node this costs nothing: a spoken lesson never synthesizes the learner's lines, so a
   *  variant there is a second caption and no second clip. On an `npc` node it forks a RECORDING, which
   *  is the one place a variant is expensive — see docs/rehearsal-dialogues.md › Learner facts. */
  variesBy?: string;
  /** fact VALUE → what that answer changes about this line. A partial map: a value with no entry keeps
   *  the node as authored, so the base `sl` is the form the unmarked answer takes and only the answers
   *  that differ from it are written out. */
  variants?: Record<string, DialogueVariant>;
  /** Next node ids. On an npc node: the client-reply choices the learner picks between (may be more than
   *  two — the renderer scrolls). On a client node: the npc's response (one id). Empty = end. */
  next: string[];
}

/** This node's line as it reaches a learner the app knows `facts` about — the ONE place a variant is
 *  chosen, so the caption, the audio key, the prompt and the asset builder can never disagree about
 *  which words this beat says.
 *
 *  A node that varies on a fact with no stored answer resolves to its base. That is the honest fallback
 *  for the learner's own captions and it must never reach a synthesized line, which is why `lint:tree`
 *  requires an npc line's fact to be known before the beat can be played. */
export function resolveNode(node: DialogueNode, facts: Record<string, string>): DialogueNode {
  if (!node.variesBy) return node;
  const variant = node.variants?.[facts[node.variesBy] ?? ""];
  return variant ? { ...node, ...variant } : node;
}

/** Every form this node can take, keyed by the fact value that produces it (`""` = the base). What the
 *  asset builder synthesizes and what `lint:audio` checks: a forked line is two clips, and both have to
 *  exist before the level can honestly call its audio ready. */
export function nodeForms(node: DialogueNode): Array<{ value: string; node: DialogueNode }> {
  const forms = [{ value: "", node }];
  for (const value of Object.keys(node.variants ?? {})) {
    forms.push({ value, node: resolveNode(node, { [node.variesBy!]: value }) });
  }
  return forms;
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

/** The run controls a tutorial step can point at — the four things the learner can always do TO THE RUN.
 *  A closed set, because each id names a real button on the scene and a typo would spotlight nothing. */
export type TutorialTarget = "slower" | "back" | "skip" | "quit";
const TUTORIAL_TARGETS: TutorialTarget[] = ["slower", "back", "skip", "quit"];

/** One control, lifted out of a dimmed screen with a line of English beside it. */
export interface TutorialStep {
  target: TutorialTarget;
  /** What this control does, in the learner's own language, as one short sentence. */
  text: string;
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
  /** The run controls this level teaches, one at a time, after the on-ramp and before the first line.
   *  Each step lifts ONE control out of a dimmed screen and says in English what it does. The controls
   *  are on screen from the first frame of every lesson, so a learner who has not been shown them has
   *  been given help they cannot find — and the tortoise in particular is the difference between a line
   *  they can follow and one they can't. Authored per level, so a lesson teaches a control at the point
   *  the learner has a reason to want it. Absent → straight into the scene. */
  tutorial?: TutorialStep[];
  /** The rehearsal dialogue this lesson sends the learner to read and listen through — the same material
   *  worked in a real transaction, at their own pace, with the English one tap away. Authored per level,
   *  because which dialogue pays off a lesson is a teaching decision and belongs beside the lesson.
   *  Absent → the close screen offers the live tutor alone. */
  practice?: { scenarioId: string; level: number };
  /** How the learner advances this level — tapped choices (default) or spoken turns. Absent → "tap", so
   *  every dialogue authored before this field keeps its behaviour. See DialogueAdvance. */
  advance?: DialogueAdvance;
  /** Learner facts (server/facts.ts) this level takes as ALREADY ANSWERED — a lesson that speaks to the
   *  learner in a gendered form without stopping to ask, because an earlier lesson asked.
   *
   *  It is a declaration to the gates, and the gate it satisfies is the one that matters: `lint:tree`
   *  lets a character's line vary on a fact only where that fact is known by the time the beat plays —
   *  asked on this level's own spine, or named here. Reaching a level whose needs are unanswered plays
   *  the base form of every line, so the declaration is also the record of which lesson has to come
   *  first. Absent → the level asks for whatever it varies on. */
  needs?: string[];
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

/** The text invariants one FORM of a node must satisfy — the base line, or the line a variant resolves
 *  to. Each form is a caption in its own right and an audio key in its own right, so each answers for
 *  itself. */
function checkForm(file: string, where: string, n: any): void {
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
  if (n.focusSpan !== undefined) {
    asString(file, n, "focusSpan", where);
    // Exactly once, or the renderer has to guess which occurrence carries the emphasis — and a span
    // that isn't in the line at all marks nothing while looking authored.
    const hits = n.sl.split(n.focusSpan).length - 1;
    if (hits !== 1) fail(file, `${where}: "focusSpan" occurs ${hits} times in "sl" — it must occur exactly once`);
  }
}

/** The `variesBy` / `variants` pair on one node: a declared fact, a closed set of its answers, and text
 *  overrides only. The per-form text invariants are checked separately (checkForm), over each resolved
 *  line rather than over the override fragment. */
function checkVariants(file: string, where: string, n: any): void {
  if (n.variesBy === undefined && n.variants === undefined) return;
  if (n.variesBy === undefined) fail(file, `${where}: "variants" needs a "variesBy" naming which fact they answer`);
  asString(file, n, "variesBy", where);
  const fact = getFact(n.variesBy);
  if (!fact) fail(file, `${where}: "variesBy" names fact "${n.variesBy}", which is not in server/catalog/facts.json`);
  if (!n.variants || typeof n.variants !== "object" || !Object.keys(n.variants).length)
    fail(file, `${where}: "variesBy" needs a non-empty "variants" saying what each answer changes`);
  const allowed = factValues(n.variesBy);
  for (const [value, v] of Object.entries<any>(n.variants)) {
    const vw = `${where} variant "${value}"`;
    if (!allowed.has(value))
      fail(file, `${vw}: fact "${n.variesBy}" answers ${[...allowed].map((a) => `"${a}"`).join(" | ")} — "${value}" is not one of them`);
    if (!v || typeof v !== "object") fail(file, `${vw}: must be an object of text overrides`);
    if (!Object.keys(v).length) fail(file, `${vw}: is empty — a variant that changes nothing is the base line`);
    for (const [k, text] of Object.entries<any>(v)) {
      if (!VARIANT_FIELDS.includes(k as any))
        fail(file, `${vw}: "${k}" is not one of ${VARIANT_FIELDS.join(", ")}. A variant is the same beat in a `
          + `different form — its turn, its "next" and its learnables belong to the beat and are shared.`);
      if (typeof text !== "string" || !text) fail(file, `${vw}: "${k}" must be a non-empty string`);
    }
    // A focus span is a SUBSTRING match, and the two forms of a word usually share a stem — "Sem študent"
    // sits inside "Sem študentka." and passes the occurs-exactly-once test while marking two thirds of a
    // word. So a variant that rewrites the line states its own span rather than inheriting one that was
    // measured against different words.
    if (v.sl !== undefined && n.focusSpan !== undefined && v.focusSpan === undefined)
      fail(file, `${vw}: rewrites "sl", so it needs its own "focusSpan" — the base's was chosen against the base line, `
        + `and a span is matched as a substring, so an inherited one can mark part of a word without failing`);
  }
}

/** A beat that asks the learner for a fact. It stands or falls on the client node it hands over to: that
 *  node's variants are what the buttons say, so the question and the answers are one authored thing. */
function checkChoice(file: string, where: string, n: any, nodes: Record<string, any>): void {
  if (n.choice === undefined) return;
  if (!n.choice || typeof n.choice !== "object") fail(file, `${where}: "choice" must be an object { fact }`);
  if (n.speaker !== "npc")
    fail(file, `${where}: "choice" is only valid on an npc node — the character is the one who asks, and his beat is the one that hands the turn over`);
  asString(file, n.choice, "fact", `${where} "choice"`);
  const fact = getFact(n.choice.fact);
  if (!fact) fail(file, `${where}: "choice" asks for fact "${n.choice.fact}", which is not in server/catalog/facts.json`);

  const clientId = n.next.find((id: string) => nodes[id]?.speaker === "client");
  if (!clientId)
    fail(file, `${where}: "choice" hands the turn over, so this beat needs a client node in "next" whose lines the buttons carry`);
  const client = nodes[clientId];
  if (client.variesBy !== n.choice.fact)
    fail(file, `${where}: "choice" asks for "${n.choice.fact}", so its client line "${clientId}" must carry `
      + `"variesBy": "${n.choice.fact}" — the buttons ARE that line, said each way`);

  // Every answer gets a button, and each button has to read as a different sentence. Two answers that
  // resolve to the same line offer the learner a choice between two identical options.
  const bySurface = new Map<string, string>();
  for (const { value } of fact.values) {
    const sl = resolveNode(client, { [n.choice.fact]: value }).sl;
    const twin = bySurface.get(sl);
    if (twin)
      fail(file, `${where}: answers "${twin}" and "${value}" both put "${sl}" on a button — `
        + `"${clientId}" needs a variant for each answer that differs from the base line`);
    bySurface.set(sl, value);
  }
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
  if (raw.needs !== undefined) {
    if (!Array.isArray(raw.needs)) fail(file, `"needs" must be an array of fact ids`);
    for (const id of raw.needs) {
      if (typeof id !== "string" || !getFact(id))
        fail(file, `needs: fact "${id}" is not in server/catalog/facts.json`);
    }
  }
  if (raw.pacing !== undefined) {
    asString(file, raw, "pacing", "dialogue");
    if (!PACING[raw.pacing])
      fail(file, `"pacing": no such profile "${raw.pacing}" (have: ${Object.keys(PACING).join(", ")})`);
  }
  if (raw.frameEN !== undefined) {
    if (!Array.isArray(raw.frameEN) || !raw.frameEN.length) fail(file, `"frameEN" must be a non-empty array of strings`);
    for (const l of raw.frameEN) if (typeof l !== "string" || !l) fail(file, `"frameEN": every line must be a non-empty string`);
  }
  if (raw.tutorial !== undefined) {
    if (!Array.isArray(raw.tutorial) || !raw.tutorial.length)
      fail(file, `"tutorial" must be a non-empty array of { target, text }`);
    for (const s of raw.tutorial) {
      if (!s || typeof s !== "object") fail(file, `"tutorial": every step must be an object { target, text }`);
      if (!TUTORIAL_TARGETS.includes(s.target))
        fail(file, `"tutorial": target "${s.target}" is not one of ${TUTORIAL_TARGETS.join(", ")}`);
      asString(file, s, "text", "tutorial step");
    }
  }
  if (raw.practice !== undefined) {
    if (!raw.practice || typeof raw.practice !== "object")
      fail(file, `"practice" must be an object { scenarioId, level }`);
    asString(file, raw.practice, "scenarioId", "practice");
    if (typeof raw.practice.level !== "number" || !Number.isInteger(raw.practice.level) || raw.practice.level < 1)
      fail(file, `"practice.level" must be a positive integer`);
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
    checkVariants(file, where, n);
    // The text invariants hold PER FORM, not per node: each variant is its own caption and its own audio
    // key, so each has to satisfy them on its own terms. A variant that changes the surface of a line
    // needs its own `focusSpan` and its own `slowSL` to go with it.
    for (const { value, node } of nodeForms(n)) {
      checkForm(file, value ? `${where} variant "${value}"` : where, node);
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
        if (h.kind === "soften") {
          asString(file, h, "label", hw);
          // `soften` lowers the bar by relabelling the single button — and a beat that ASKS has no single
          // button, only its options. Its instruction is the client line's `chooseEN`, which says the same
          // thing and says it from the moment the turn opens, so there is one place a choice beat's English
          // is authored rather than two writing over each other.
          if (n.choice)
            fail(file, `${hw}: this beat asks the learner for "${n.choice.fact}", so its English belongs in the client line's "chooseEN" — shown immediately, above the options`);
        }
        if (h.kind === "respeak" && !n.slowSL) fail(file, `${hw}: "respeak" needs the node to have a "slowSL" to re-speak`);
      }
    }
    if (n.context !== undefined) {
      asString(file, n, "context", where);
      if (n.speaker !== "client") fail(file, `${where}: "context" is only valid on a client choice`);
    }
    if (n.chooseEN !== undefined) {
      asString(file, n, "chooseEN", where);
      if (n.speaker !== "client")
        fail(file, `${where}: "chooseEN" is only valid on a client node — it stands in for that line's own gloss while the learner picks between its forms`);
    }
    if (n.audio !== undefined) {
      const aw = `${where} "audio"`;
      if (!n.audio || typeof n.audio !== "object") fail(file, `${aw}: must be an object { from, level, kind, … }`);
      // Only the LEARNER's line needs a voicing pointer. The character's own lines have their own clips;
      // pointing one at another would be a way of playing the wrong bytes under the right caption.
      if (n.speaker !== "client") fail(file, `${aw}: only valid on a client node (it voices the LEARNER's phrase with a clip of the character's)`);
      asString(file, n.audio, "from", aw);
      if (typeof n.audio.level !== "number" || !Number.isInteger(n.audio.level) || n.audio.level < 1)
        fail(file, `${aw}: "level" must be a positive integer (which level "${n.audio.from}" lives in)`);
      if (n.audio.kind !== "whole" && n.audio.kind !== "span") fail(file, `${aw}: "kind" must be "whole" | "span"`);
      if (n.audio.heard !== undefined) asString(file, n.audio, "heard", aw);
      if (n.audio.kind === "span") {
        // A span without its word indices cannot be checked against the alignment, which is the only thing
        // standing between a real measurement and an invented number.
        const w = n.audio.words;
        if (!Array.isArray(w) || w.length !== 2 || !w.every((i: any) => Number.isInteger(i) && i >= 0))
          fail(file, `${aw}: a "span" needs "words": [firstIndex, lastIndex] into the clip's alignment`);
        if (w[1] < w[0]) fail(file, `${aw}: "words" [${w[0]}, ${w[1]}] runs backwards`);
        for (const k of ["startMs", "endMs"]) {
          if (typeof n.audio[k] !== "number" || !Number.isFinite(n.audio[k]) || n.audio[k] < 0)
            fail(file, `${aw}: a "span" needs a non-negative "${k}" derived from the alignment`);
        }
        if (n.audio.endMs <= n.audio.startMs) fail(file, `${aw}: "endMs" (${n.audio.endMs}) must be after "startMs" (${n.audio.startMs})`);
      } else if (n.audio.words !== undefined || n.audio.startMs !== undefined || n.audio.endMs !== undefined) {
        fail(file, `${aw}: a "whole" voicing plays the clip end to end — it must carry no "words"/"startMs"/"endMs"`);
      }
    }
    if (!Array.isArray(n.next)) fail(file, `${where}: next must be an array of node ids`);
    for (const id of n.next) {
      if (typeof id !== "string" || !ids.has(id)) fail(file, `${where}: next references unknown node "${id}"`);
    }
  }
  // Checked after the whole node map is known — a choice beat is judged against the client node it hands
  // the turn to, which may be validated later in the loop above.
  for (const [nid, n] of Object.entries<any>(raw.nodes)) checkChoice(file, `node "${nid}"`, n, raw.nodes);
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
