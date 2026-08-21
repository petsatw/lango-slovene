// Scenario + objective data. Scenarios live as per-file JSON under server/scenarios/ (one file per
// scenario, written by the create-scenario engine on commit). This module keeps the TS interfaces,
// loads + validates the JSON at startup, and exposes SCENARIOS / getScenario / freshSession unchanged.
//
// NOTE: the data dir is server/scenarios/ (a sibling directory to this file). `from "./scenarios"`
// still resolves to THIS file — the dir has no index, so there is no import collision.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import type { Objective, SessionState } from "./types";
import { CATALOG, getCharacter, TEACHER_VOICE_PROFILE } from "./catalog";
import { LEARNABLES } from "./learnables";

/** One visual story frame = one learning concept (image + its SL line + audio). */
export interface StoryFrame {
  objectiveId: string; // ties the frame to an objective (and thus its targetSL audio)
  lineSL: string; // the Slovenian line shown/spoken on this frame (usually the objective's targetSL)
  imagePrompt: string; // raw prompt for the frame image (the house style prefix is added at gen time)
}

/** A canonical asset (character / setting / object) for a scenario. Each asset gets its own canonical
 *  render; the LABEL is the token reused in every frame/scene prompt to anchor that render. */
export interface AssetDef {
  label: string; // ALL-CAPS token, e.g. BAKER — referenced in prompts, anchors the per-asset render
  descriptor: string; // minimal canonical description that fixes the look
  catalogId?: string; // set when resolved from a shared catalog ref (a SHARED asset, not scenario-local)
}

/** A scene.assets entry can instead be a SHARED-asset reference by catalog id (opt-in reuse). Resolves
 *  to the catalog object's, or character's-visual, `{ label, descriptor }` — one canonical descriptor,
 *  so the content-addressed store renders it once and reuses it across scenarios. */
export interface AssetRef {
  ref: string; // a catalog object id (objects.json) or character id (characters.json → its visual)
}

/** Register the tutor speaks in. Student target lines are usually register-neutral; this colours the
 *  tutor's (character's) voice — declared first in the system prompt so replies stay native + short. */
export interface Register {
  form: "ti" | "vi"; // tikanje (informal) vs vikanje (formal)
  variety: "pogovorni" | "knjizni"; // colloquial vs standard/bookish
}

/** One rehearsal level the scenario package declares (the manifest's view of a dialogue file). The
 *  per-level `server/dialogues/<id>-<level>.json` is the RENDERED surface; this is the manifest's
 *  DECLARATION of it. `lint:tree` checks the two agree (level + label + voices). */
export interface DialogueSurfaceLevel {
  level: number;
  levelLabel: string;
}

/** The `dialogue` surface of a scenario package: the shared per-speaker voice profiles + the levels the
 *  manifest declares. The dialogue JSON files are keyed to this (D2 — manifest as source of truth). */
export interface DialogueSurface {
  voices: { npc: string; client: string };
  /** How the learner advances this scenario's levels — "tap" (rehearsal choices, the default) or
   *  "audio" (spoken turns; see DialogueAdvance in dialogues.ts). Declared here as the manifest's
   *  statement of it; `lint:tree` checks each dialogue file agrees, exactly as it does for voices. */
  advance?: "tap" | "audio";
  levels: DialogueSurfaceLevel[];
}

/** The surfaces a scenario package renders from its one canonical spine (D1/D2). Optional + additive:
 *  legacy scenarios that predate the manifest simply omit it. Today only `dialogue` is materialized;
 *  `a1: true` marks that this package's levels are referenced by the A1 coverage map. Future surfaces
 *  (guided-live, visual) slot in here without touching the loader. */
export interface ScenarioSurfaces {
  dialogue?: DialogueSurface;
  a1?: boolean;
}

export interface Scenario {
  id: string;
  /** Short label for the picker dropdown (e.g. "Café"). Falls back to title if absent. */
  name?: string;
  title: string;
  status: "active" | "planned";
  /** Who the tutor plays (free-text role — drives the tutor prompt). */
  character: string;
  /** Short Slovene role noun the LIVE tutor adopts when the learner arrives from this scenario's
   *  rehearsal handoff (e.g. "natakarica", "prodajalka v pekarni"). Persona awareness only — never a
   *  voice id (free chat is always the teacher voice). Absent → the tutor decides its own role. */
  role?: string;
  /** Optional catalog character id — bundles the character's visual identity + VOICE PROFILE. Its
   *  voiceProfile voices in-scene character lines (opening + live tutor reply); its visual is the
   *  canonical look. Absent → in-scene lines use the teacher voice (back-compat). */
  characterRef?: string;
  /** The situation, used to set the tutor's role. */
  setup: string;
  /** The tutor's first Slovenian line (shown/spoken at session start). */
  opening: string;
  /** The register the tutor holds across the scenario (ti/vi + pogovorni/knjizni). */
  register?: Register;
  /** The surfaces this package renders (D1/D2 — the manifest's declaration of what exists). Optional +
   *  additive; legacy scenarios omit it. `lint:tree` checks the `dialogue` surface agrees with the
   *  per-level dialogue files. */
  surfaces?: ScenarioSurfaces;
  objectives: Objective[];
  /** Visual story layer (M3/M4) — narrated opener, one frame per objective, one final all-in scene. */
  scene?: {
    /** The labeled asset bible — always RESOLVED `AssetDef[]` after load. Raw JSON entries may be
     *  scenario-local `{ label, descriptor }` OR shared `{ ref }` to the catalog (see AssetRef /
     *  validateScenario). Each asset gets its own canonical render anchored by its label. */
    assets?: AssetDef[];
    story?: {
      sentences: string[]; // ≤5 short simple-Slovenian narration sentences
      frames: StoryFrame[]; // one visual frame per learning objective
      sceneImagePrompt: string; // final image: ALL objectives in one picture
    };
  };
}

// ---- Loader: read + validate every server/scenarios/*.json at startup -------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCENARIOS_DIR = path.join(__dirname, "scenarios");

function fail(file: string, msg: string): never {
  throw new Error(`Invalid scenario "${file}": ${msg}`);
}

function asString(file: string, obj: any, key: string): string {
  const v = obj?.[key];
  if (typeof v !== "string" || v.length === 0) fail(file, `field "${key}" must be a non-empty string`);
  return v;
}

/** Resolve one raw scene.assets entry to a concrete AssetDef. A `{ ref }` points at the catalog (a
 *  shared object, or a character's visual) and carries its catalogId through for provenance; an inline
 *  `{ label, descriptor }` is scenario-local. */
function resolveAsset(file: string, a: any): AssetDef {
  if (a && typeof a.ref === "string") {
    const id = a.ref;
    const obj = CATALOG.objects[id];
    if (obj) return { label: obj.label, descriptor: obj.descriptor, catalogId: id };
    const ch = CATALOG.characters[id];
    if (ch) {
      const v = CATALOG.objects[ch.visualRef];
      if (!v) fail(file, `character "${id}" visualRef "${ch.visualRef}" is not a known object`);
      return { label: v.label, descriptor: v.descriptor, catalogId: id };
    }
    // A concept ref (e.g. a location like `cafe`) — it owns no descriptor; its render is composed from
    // its constituents at build time (see assets/compose.ts). Carry the id through for that dispatch.
    const concept = CATALOG.concepts[id];
    if (concept) return { label: concept.label, descriptor: "", catalogId: id };
    fail(file, `scene asset ref "${id}" is not a known catalog object, character, or concept`);
  }
  asString(file, a, "label");
  asString(file, a, "descriptor");
  return { label: a.label, descriptor: a.descriptor };
}

/** Validate + RESOLVE one parsed JSON object into a Scenario (the loader is the data contract). Also
 *  used by the --file draft paths (lint / show-prompts) so a draft's catalog `{ ref }`s resolve exactly
 *  as they do at load. `file` is only used to label errors. */
export function validateScenario(file: string, raw: any): Scenario {
  if (!raw || typeof raw !== "object") fail(file, "not an object");
  asString(file, raw, "id");
  asString(file, raw, "title");
  asString(file, raw, "character");
  asString(file, raw, "setup");
  asString(file, raw, "opening");
  if (raw.role !== undefined && (typeof raw.role !== "string" || !raw.role.length))
    fail(file, `"role", if present, must be a non-empty string`);
  if (raw.characterRef !== undefined) {
    if (typeof raw.characterRef !== "string" || !CATALOG.characters[raw.characterRef]) {
      fail(file, `characterRef "${raw.characterRef}" is not a known catalog character`);
    }
  }
  if (raw.status !== "active" && raw.status !== "planned") fail(file, `status must be "active" | "planned"`);
  if (!Array.isArray(raw.objectives)) fail(file, `"objectives" must be an array`);
  for (const o of raw.objectives) {
    asString(file, o, "id");
    asString(file, o, "label");
    asString(file, o, "targetSL");
    asString(file, o, "hintEN");
    if (o.learnables !== undefined) {
      if (!Array.isArray(o.learnables)) fail(file, `objective "${o.id}": learnables must be an array of ids`);
      for (const id of o.learnables) {
        if (typeof id !== "string" || !LEARNABLES[id])
          fail(file, `objective "${o.id}": learnable "${id}" is not in the learnable catalog`);
      }
    }
    if (o.fillerLines !== undefined) {
      if (typeof o.fillerLines !== "object" || Array.isArray(o.fillerLines))
        fail(file, `objective "${o.id}": fillerLines must be an object map of learnableId → line`);
      for (const id of Object.keys(o.fillerLines)) {
        if (!Array.isArray(o.learnables) || !o.learnables.includes(id))
          fail(file, `objective "${o.id}": fillerLines key "${id}" must be one of the objective's learnables`);
        if (typeof o.fillerLines[id] !== "string" || !o.fillerLines[id])
          fail(file, `objective "${o.id}": fillerLines["${id}"] must be a non-empty string`);
      }
    }
  }
  if (raw.register) {
    if (raw.register.form !== "ti" && raw.register.form !== "vi") fail(file, `register.form must be "ti" | "vi"`);
    if (raw.register.variety !== "pogovorni" && raw.register.variety !== "knjizni") {
      fail(file, `register.variety must be "pogovorni" | "knjizni"`);
    }
  }
  if (raw.surfaces !== undefined) {
    if (typeof raw.surfaces !== "object" || Array.isArray(raw.surfaces)) fail(file, `"surfaces" must be an object`);
    const dlg = raw.surfaces.dialogue;
    if (dlg !== undefined) {
      if (typeof dlg !== "object" || Array.isArray(dlg)) fail(file, `surfaces.dialogue must be an object`);
      if (!dlg.voices || typeof dlg.voices !== "object") fail(file, `surfaces.dialogue.voices must be an object`);
      for (const speaker of ["npc", "client"] as const) {
        const p = asString(file, dlg.voices, speaker);
        if (!CATALOG.voiceProfiles[p]) fail(file, `surfaces.dialogue.voices.${speaker}: voice profile "${p}" is not in the catalog`);
      }
      if (dlg.advance !== undefined && dlg.advance !== "tap" && dlg.advance !== "audio")
        fail(file, `surfaces.dialogue.advance must be "tap" | "audio"`);
      if (!Array.isArray(dlg.levels) || !dlg.levels.length) fail(file, `surfaces.dialogue.levels must be a non-empty array`);
      const seen = new Set<number>();
      for (const lv of dlg.levels) {
        if (typeof lv.level !== "number" || !Number.isInteger(lv.level) || lv.level < 1)
          fail(file, `surfaces.dialogue.levels: each "level" must be a positive integer`);
        if (seen.has(lv.level)) fail(file, `surfaces.dialogue.levels: duplicate level ${lv.level}`);
        seen.add(lv.level);
        asString(file, lv, "levelLabel");
      }
    }
    if (raw.surfaces.a1 !== undefined && typeof raw.surfaces.a1 !== "boolean")
      fail(file, `surfaces.a1 must be a boolean`);
  }
  if (raw.scene) {
    // Resolve every scene asset (inline or shared `{ ref }`) to a concrete AssetDef in place, so all
    // downstream (build-assets, images, lint) sees one uniform resolved bible.
    if (raw.scene.assets !== undefined) {
      if (!Array.isArray(raw.scene.assets)) fail(file, `scene.assets must be an array`);
      raw.scene.assets = raw.scene.assets.map((a: any) => resolveAsset(file, a));
    }
    if (raw.scene.story) {
      if (!Array.isArray(raw.scene.story.sentences)) fail(file, `scene.story.sentences must be an array`);
      for (const f of raw.scene.story.frames ?? []) {
        asString(file, f, "objectiveId");
        asString(file, f, "lineSL");
        asString(file, f, "imagePrompt");
      }
    }
  }
  return raw as Scenario;
}

export function loadScenarios(): Scenario[] {
  const files = readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort(); // stable, deterministic order
  const loaded = files.map((f) => validateScenario(f, JSON.parse(readFileSync(path.join(SCENARIOS_DIR, f), "utf8"))));
  return [...loaded, ...PLANNED_SCENARIOS];
}

// PLANNED scenarios (Feature 1 — choose-your-own-adventure). Declared, not yet implemented. Kept as
// TS stubs (they own no data file); the create-scenario engine writes real scenarios as JSON.
export const PLANNED_SCENARIOS: Scenario[] = [
  { id: "upravna_enota", name: "Upravna enota", title: "Registering at the upravna enota", status: "planned", character: "", setup: "", opening: "", objectives: [] },
  { id: "pharmacy", name: "Pharmacy", title: "At the pharmacy (lekarna)", status: "planned", character: "", setup: "", opening: "", objectives: [] },
];

export const SCENARIOS: Scenario[] = loadScenarios();

export function getScenario(id: string | undefined): Scenario {
  const found =
    SCENARIOS.find((s) => s.id === id && s.status === "active") ??
    SCENARIOS.find((s) => s.id === "cafe" && s.status === "active") ??
    SCENARIOS.find((s) => s.status === "active") ??
    SCENARIOS[0];
  if (!found) throw new Error("No scenarios loaded — server/scenarios/ has no valid JSON files.");
  return found;
}

/** The voice profile that voices this scenario's IN-SCENE character lines — the opening and the live
 *  tutor reply (the tutor playing the character). Falls back to the teacher voice when no characterRef. */
export function characterVoiceProfile(scenario: Scenario): string {
  return scenario.characterRef ? getCharacter(scenario.characterRef).voiceProfile : TEACHER_VOICE_PROFILE;
}

export function freshSession(scenario: Scenario): SessionState {
  return {
    scenarioId: scenario.id,
    objectives: scenario.objectives.map((o) => ({ id: o.id, status: "pending", attempts: 0 })),
    complete: false,
    turns: 0,
  };
}
