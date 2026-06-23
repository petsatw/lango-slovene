// The shared asset CATALOG — the studio-style registry of identity-bearing assets that scenarios
// reference by stable id. Three entity kinds, each a JSON file under server/catalog/:
//   - voices.json     — named voice profiles (provider-agnostic) + which profile is the teacher voice
//   - characters.json — characters that BUNDLE a visual identity + a voice profile
//   - objects.json    — shared objects/figures with one canonical descriptor (→ one canonical render)
//
// Reuse is OPT-IN and INTENTFUL: a scenario shares an asset only by referencing its catalog id
// (scene.assets `{ ref }` / Scenario.characterRef). Because a catalog descriptor is identical wherever
// it's referenced, the content-addressed image store renders it ONCE and reuses it everywhere (money
// = the canary). Audio reuse keys by the speaker's voice PROFILE, not the literal character.
//
// NOTE (same trick as scenarios.ts): `from "./catalog"` resolves to THIS file; the sibling catalog/
// dir has no index, so there is no import collision.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import type { AssetDef } from "./scenarios";

/** A named, provider-agnostic voice profile. The concrete provider voice is bound in the E3 adapter
 *  (provider-specific), never here — so the catalog stays adapter-neutral. */
export interface VoiceProfile {
  id: string;
  description: string;
}

/** A character ENTITY: one stable identity = a visual (the model-sheet asset) + a voice profile.
 *  Recurring characters keep this identity across scenarios (outfit/setting may vary; identity does not). */
export interface CatalogCharacter {
  id: string;
  name: string;
  voiceProfile: string; // a VoiceProfile id
  visual: AssetDef; // { label, descriptor } — the canonical look
}

/** A shared object/figure with one canonical descriptor → one canonical render reused across scenarios. */
export interface CatalogObject extends AssetDef {
  id: string;
}

export interface Catalog {
  teacherVoiceProfile: string;
  voiceProfiles: Record<string, VoiceProfile>;
  characters: Record<string, CatalogCharacter>;
  objects: Record<string, CatalogObject>;
}

// ---- Loader ---------------------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_DIR = path.join(__dirname, "catalog");

function read(file: string): any {
  return JSON.parse(readFileSync(path.join(CATALOG_DIR, file), "utf8"));
}

function fail(msg: string): never {
  throw new Error(`Invalid catalog: ${msg}`);
}

function asString(obj: any, key: string, where: string): string {
  const v = obj?.[key];
  if (typeof v !== "string" || v.length === 0) fail(`${where}: field "${key}" must be a non-empty string`);
  return v;
}

function loadCatalog(): Catalog {
  // voices
  const rawVoices = read("voices.json");
  const teacherVoiceProfile = asString(rawVoices, "teacher", "voices.json");
  const voiceProfiles: Record<string, VoiceProfile> = {};
  const profiles = rawVoices.profiles ?? {};
  for (const id of Object.keys(profiles)) {
    voiceProfiles[id] = { id, description: asString(profiles[id], "description", `voices.json/${id}`) };
  }
  if (!voiceProfiles[teacherVoiceProfile]) fail(`teacher voice "${teacherVoiceProfile}" is not a declared profile`);

  // characters
  const rawChars = read("characters.json");
  const characters: Record<string, CatalogCharacter> = {};
  for (const id of Object.keys(rawChars)) {
    const c = rawChars[id];
    const voiceProfile = asString(c, "voiceProfile", `characters.json/${id}`);
    if (!voiceProfiles[voiceProfile]) fail(`character "${id}" uses unknown voiceProfile "${voiceProfile}"`);
    characters[id] = {
      id,
      name: asString(c, "name", `characters.json/${id}`),
      voiceProfile,
      visual: {
        label: asString(c.visual, "label", `characters.json/${id}.visual`),
        descriptor: asString(c.visual, "descriptor", `characters.json/${id}.visual`),
      },
    };
  }

  // objects
  const rawObjects = read("objects.json");
  const objects: Record<string, CatalogObject> = {};
  for (const id of Object.keys(rawObjects)) {
    const o = rawObjects[id];
    objects[id] = {
      id,
      label: asString(o, "label", `objects.json/${id}`),
      descriptor: asString(o, "descriptor", `objects.json/${id}`),
    };
  }

  return { teacherVoiceProfile, voiceProfiles, characters, objects };
}

export const CATALOG: Catalog = loadCatalog();

export function getCharacter(id: string): CatalogCharacter {
  const c = CATALOG.characters[id];
  if (!c) throw new Error(`Unknown catalog character "${id}". Known: ${Object.keys(CATALOG.characters).join(", ")}`);
  return c;
}

export function getObject(id: string): CatalogObject {
  const o = CATALOG.objects[id];
  if (!o) throw new Error(`Unknown catalog object "${id}". Known: ${Object.keys(CATALOG.objects).join(", ")}`);
  return o;
}

export function getVoiceProfile(id: string): VoiceProfile {
  const v = CATALOG.voiceProfiles[id];
  if (!v) throw new Error(`Unknown voice profile "${id}". Known: ${Object.keys(CATALOG.voiceProfiles).join(", ")}`);
  return v;
}

/** The teacher/default voice profile id — learner-facing narration + practice audio. */
export const TEACHER_VOICE_PROFILE = CATALOG.teacherVoiceProfile;
