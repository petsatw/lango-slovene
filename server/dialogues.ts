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
  /** Next node ids. On an npc node: the client-reply choices the learner picks between. On a client
   *  node: the npc's response (one id). Empty = end of the dialogue. */
  next: string[];
}

/** A competency this rehearsal level demonstrates — DISPLAY ONLY (no crediting; mastery is earned live).
 *  Shown to the learner so each level's "what you can do" is explicit. */
export interface DialogueObjective {
  label: string;
  descriptorEN: string;
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
  /** Optional portrait background image for this level's rehearsal — a filename under public/backgrounds/
   *  (e.g. "restaurant-1.jpg"). The conversation scrolls over it while the image stays fixed. Absent →
   *  the plain panel background. */
  background?: string;
  /** Optional audio intro for this level — a filename under public/intros/ (e.g. "restaurant-1.mp3").
   *  Played over the background (full picture, no bubbles yet) before the tree begins; the learner can
   *  skip it, and a skip is remembered so it won't auto-play again. Absent → the tree starts immediately. */
  intro?: string;
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
  if (raw.background !== undefined) asString(file, raw, "background", "dialogue");
  if (raw.intro !== undefined) asString(file, raw, "intro", "dialogue");
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
