// DIALOGUE framework — predetermined BRANCHING rehearsal dialogues paired with a scenario.
//
// A dialogue is a fully authored decision tree: an NPC ("baker") speaks, the learner picks among a few
// canned client replies, the NPC responds, and so on. It is REHEARSAL ONLY — exposure before the live
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

export type DialogueSpeaker = "baker" | "client";
export type DialogueAudioState = "pending" | "ready";

export interface DialogueNode {
  speaker: DialogueSpeaker;
  /** The line, in Slovene. */
  sl: string;
  /** English gloss — revealed on tap, same click-to-reveal as the live transcript. */
  en: string;
  /** Next node ids. On a baker node: the client-reply choices the learner picks between. On a client
   *  node: the baker's response (one id). Empty = end of the dialogue. */
  next: string[];
}

export interface Dialogue {
  id: string;
  scenarioId: string;
  title: string;
  /** "pending" until per-speaker audio is pregenerated; the client hides play buttons while pending so a
   *  preview click-through can't bill a live synthesis. Flip to "ready" only after `build:dialogue-assets`. */
  audio: DialogueAudioState;
  /** Per-speaker voice profile id (catalog voices.json) — the tag pregenerated audio is keyed on. */
  voices: Record<DialogueSpeaker, string>;
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
  if (raw.audio !== "pending" && raw.audio !== "ready") fail(file, `"audio" must be "pending" | "ready"`);
  if (!raw.voices || typeof raw.voices !== "object") fail(file, `"voices" must be an object`);
  asProfile(file, raw.voices, "baker", "voices");
  asProfile(file, raw.voices, "client", "voices");
  if (!raw.nodes || typeof raw.nodes !== "object" || !Object.keys(raw.nodes).length)
    fail(file, `"nodes" must be a non-empty object`);
  const ids = new Set(Object.keys(raw.nodes));
  asString(file, raw, "root", "dialogue");
  if (!ids.has(raw.root)) fail(file, `root "${raw.root}" is not a node`);
  if (raw.nodes[raw.root].speaker !== "baker") fail(file, `root node "${raw.root}" must be spoken by the baker`);
  for (const [nid, n] of Object.entries<any>(raw.nodes)) {
    const where = `node "${nid}"`;
    if (n?.speaker !== "baker" && n?.speaker !== "client") fail(file, `${where}: speaker must be "baker" | "client"`);
    asString(file, n, "sl", where);
    asString(file, n, "en", where);
    if (!Array.isArray(n.next)) fail(file, `${where}: next must be an array of node ids`);
    for (const id of n.next) {
      if (typeof id !== "string" || !ids.has(id)) fail(file, `${where}: next references unknown node "${id}"`);
    }
  }
  return raw as Dialogue;
}

export function loadDialogues(): Record<string, Dialogue> {
  const out: Record<string, Dialogue> = {};
  let files: string[];
  try {
    files = readdirSync(DIALOGUES_DIR).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return out; // no dialogues dir yet — the feature is optional per scenario
  }
  for (const f of files) {
    const d = validateDialogue(f, JSON.parse(readFileSync(path.join(DIALOGUES_DIR, f), "utf8")));
    out[d.scenarioId] = d;
  }
  return out;
}

export const DIALOGUES: Record<string, Dialogue> = loadDialogues();

/** The rehearsal dialogue paired with a scenario, or null if none is authored. */
export function getDialogueForScenario(scenarioId: string): Dialogue | null {
  return DIALOGUES[scenarioId] ?? null;
}
