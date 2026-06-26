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

/** A character ENTITY: a cross-media ACTOR (image ↔ voice) that owns no pixels itself — it REFERENCES
 *  catalog objects. `type` = the object id(s) it is a kind of; `visualRef` = the object used as its
 *  reference image (the same object as its type in the simple case; a named individual's own canonical
 *  render — e.g. `natasa_the_baker` — in the advanced case). Recurring characters keep this identity
 *  across scenarios. */
export interface CatalogCharacter {
  id: string;
  /** Object id(s) this actor IS A KIND OF — the figure-type image(s). Simple case: `["baker"]`. */
  type: string[];
  /** Object id used as this actor's reference image. Simple case: same as its type (`"baker"`); a named
   *  individual points at their own canonical render (`"natasa_the_baker"`). */
  visualRef: string;
  voiceProfile: string; // a VoiceProfile id
  /** Identity metadata that BOTH constrains the depiction and drives the language (pronoun/agreement).
   *  e.g. gender "feminine" — a render that contradicts it is unsuitable. */
  gender?: "feminine" | "masculine";
  /** Optional individual name ("Nataša"); absent for a generic role actor. */
  name?: string;
}

/** A shared object/figure with one canonical descriptor → one canonical render reused across scenarios. */
export interface CatalogObject extends AssetDef {
  id: string;
  gender?: "feminine" | "masculine"; // for figure assets (e.g. the customer avatar); see CatalogCharacter.gender
}

/** A COMPOSED concept: a reusable depiction built FROM other catalog assets (the ontology's composite
 *  node). Its identity is the depiction `prompt` (which names its assets as `{{TOKEN}}`s) + the assets it
 *  `composedFrom`. The render is the content-addressed image at that prompt — so every frame that uses the
 *  same depiction shares one canonical image (greet/leave are the same picture in every scenario). */
export interface CatalogConcept {
  id: string;
  label: string;
  prompt: string;
  composedFrom: string[]; // catalog asset ids this concept anchors on
  /** Render dimensions. Defaults to the frame ratio "4:3" (a focused flashcard); an establishing
   *  scene-tableau concept sets "16:9". Composed concepts render at 2k regardless. */
  aspectRatio?: "1:1" | "4:3" | "16:9";
  /** Composition styling (maps to the render `mode`): "flashcard" = atomic, isolated on a neutral
   *  background (greet/leave/…); "scene" = compose the referenced assets into a full tableau.
   *  Defaults to "flashcard". */
  format?: "flashcard" | "scene";
}

export interface Catalog {
  teacherVoiceProfile: string;
  voiceProfiles: Record<string, VoiceProfile>;
  characters: Record<string, CatalogCharacter>;
  objects: Record<string, CatalogObject>;
  concepts: Record<string, CatalogConcept>;
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

export function loadCatalog(): Catalog {
  // voices
  const rawVoices = read("voices.json");
  const teacherVoiceProfile = asString(rawVoices, "teacher", "voices.json");
  const voiceProfiles: Record<string, VoiceProfile> = {};
  const profiles = rawVoices.profiles ?? {};
  for (const id of Object.keys(profiles)) {
    voiceProfiles[id] = { id, description: asString(profiles[id], "description", `voices.json/${id}`) };
  }
  if (!voiceProfiles[teacherVoiceProfile]) fail(`teacher voice "${teacherVoiceProfile}" is not a declared profile`);

  // objects (loaded before characters — a character's type/visualRef reference object ids)
  const rawObjects = read("objects.json");
  const objects: Record<string, CatalogObject> = {};
  for (const id of Object.keys(rawObjects)) {
    const o = rawObjects[id];
    objects[id] = {
      id,
      label: asString(o, "label", `objects.json/${id}`),
      descriptor: asString(o, "descriptor", `objects.json/${id}`),
      ...(o.gender !== undefined ? { gender: o.gender } : {}),
    };
  }

  // characters — cross-media actors that REFERENCE objects (no embedded visual)
  const rawChars = read("characters.json");
  const characters: Record<string, CatalogCharacter> = {};
  for (const id of Object.keys(rawChars)) {
    const c = rawChars[id];
    const voiceProfile = asString(c, "voiceProfile", `characters.json/${id}`);
    if (!voiceProfiles[voiceProfile]) fail(`character "${id}" uses unknown voiceProfile "${voiceProfile}"`);
    const type = Array.isArray(c.type) && c.type.length ? c.type : fail(`characters.json/${id}: type must be a non-empty array of object ids`);
    for (const t of type) if (!objects[t]) fail(`character "${id}" type references unknown object "${t}"`);
    const visualRef = asString(c, "visualRef", `characters.json/${id}`);
    if (!objects[visualRef]) fail(`character "${id}" visualRef references unknown object "${visualRef}"`);
    characters[id] = {
      id,
      type,
      visualRef,
      voiceProfile,
      ...(c.gender !== undefined ? { gender: c.gender } : {}),
      ...(c.name !== undefined ? { name: asString(c, "name", `characters.json/${id}`) } : {}),
    };
  }

  // concepts (composed) — optional file
  const concepts: Record<string, CatalogConcept> = {};
  let rawConcepts: any = {};
  try {
    rawConcepts = read("concepts.json");
  } catch {
    rawConcepts = {};
  }
  for (const id of Object.keys(rawConcepts)) {
    const c = rawConcepts[id];
    const composedFrom = Array.isArray(c.composedFrom) ? c.composedFrom : fail(`concepts.json/${id}: composedFrom must be an array`);
    for (const a of composedFrom) {
      if (!objects[a] && !characters[a]) fail(`concept "${id}" composedFrom unknown asset "${a}"`);
    }
    if (c.aspectRatio !== undefined && !["1:1", "4:3", "16:9"].includes(c.aspectRatio))
      fail(`concepts.json/${id}: aspectRatio must be "1:1", "4:3", or "16:9"`);
    if (c.format !== undefined && !["flashcard", "scene"].includes(c.format))
      fail(`concepts.json/${id}: format must be "flashcard" or "scene"`);
    concepts[id] = {
      id,
      label: asString(c, "label", `concepts.json/${id}`),
      prompt: asString(c, "prompt", `concepts.json/${id}`),
      composedFrom,
      ...(c.aspectRatio !== undefined ? { aspectRatio: c.aspectRatio } : {}),
      ...(c.format !== undefined ? { format: c.format } : {}),
    };
  }

  return { teacherVoiceProfile, voiceProfiles, characters, objects, concepts };
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

export function getConcept(id: string): CatalogConcept {
  const c = CATALOG.concepts[id];
  if (!c) throw new Error(`Unknown catalog concept "${id}". Known: ${Object.keys(CATALOG.concepts).join(", ")}`);
  return c;
}

/** Resolve a catalog asset id (object or character) to its { label, descriptor } — used to anchor a
 *  composed concept on its constituents' canonical renders. A character resolves to its `visualRef`
 *  object (the actor owns no pixels — it points at an object image). */
export function getAssetVisual(id: string): AssetDef {
  const o = CATALOG.objects[id];
  if (o) return { label: o.label, descriptor: o.descriptor };
  const ch = CATALOG.characters[id];
  if (ch) {
    const v = CATALOG.objects[ch.visualRef];
    if (!v) throw new Error(`character "${id}" visualRef "${ch.visualRef}" is not a known object`);
    return { label: v.label, descriptor: v.descriptor };
  }
  throw new Error(`Unknown catalog asset "${id}" (not an object or character).`);
}

/** The teacher/default voice profile id — learner-facing narration + practice audio. */
export const TEACHER_VOICE_PROFILE = CATALOG.teacherVoiceProfile;
