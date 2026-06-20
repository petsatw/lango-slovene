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

/** One visual story frame = one learning concept (image + its SL line + audio). */
export interface StoryFrame {
  objectiveId: string; // ties the frame to an objective (and thus its targetSL audio)
  lineSL: string; // the Slovenian line shown/spoken on this frame (usually the objective's targetSL)
  imagePrompt: string; // raw prompt for the frame image (the house style prefix is added at gen time)
}

/** A canonical asset (character / setting / object) for a scenario. The minimal labeled set is drawn
 *  once on the reference sheet; the LABEL is the token reused in every frame/scene prompt. */
export interface AssetDef {
  label: string; // ALL-CAPS token, e.g. BAKER — printed on the sheet, referenced in prompts
  descriptor: string; // minimal canonical description that fixes the look
}

/** Register the tutor speaks in. Student target lines are usually register-neutral; this colours the
 *  tutor's (character's) voice — declared first in the system prompt so replies stay native + short. */
export interface Register {
  form: "ti" | "vi"; // tikanje (informal) vs vikanje (formal)
  variety: "pogovorni" | "knjizni"; // colloquial vs standard/bookish
}

export interface Scenario {
  id: string;
  /** Short label for the picker dropdown (e.g. "Café"). Falls back to title if absent. */
  name?: string;
  title: string;
  status: "active" | "planned";
  /** Who the tutor plays. */
  character: string;
  /** The situation, used to set the tutor's role. */
  setup: string;
  /** The tutor's first Slovenian line (shown/spoken at session start). */
  opening: string;
  /** The register the tutor holds across the scenario (ti/vi + pogovorni/knjizni). */
  register?: Register;
  objectives: Objective[];
  /** Visual story layer (M3/M4) — narrated opener, one frame per objective, one final all-in scene. */
  scene?: {
    /** The minimal labeled asset set → drives the reference sheet that anchors every image. */
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

/** Validate one parsed JSON object against the Scenario interface (the loader is the data contract). */
function validateScenario(file: string, raw: any): Scenario {
  if (!raw || typeof raw !== "object") fail(file, "not an object");
  asString(file, raw, "id");
  asString(file, raw, "title");
  asString(file, raw, "character");
  asString(file, raw, "setup");
  asString(file, raw, "opening");
  if (raw.status !== "active" && raw.status !== "planned") fail(file, `status must be "active" | "planned"`);
  if (!Array.isArray(raw.objectives)) fail(file, `"objectives" must be an array`);
  for (const o of raw.objectives) {
    asString(file, o, "id");
    asString(file, o, "label");
    asString(file, o, "targetSL");
    asString(file, o, "hintEN");
  }
  if (raw.register) {
    if (raw.register.form !== "ti" && raw.register.form !== "vi") fail(file, `register.form must be "ti" | "vi"`);
    if (raw.register.variety !== "pogovorni" && raw.register.variety !== "knjizni") {
      fail(file, `register.variety must be "pogovorni" | "knjizni"`);
    }
  }
  if (raw.scene) {
    for (const a of raw.scene.assets ?? []) {
      asString(file, a, "label");
      asString(file, a, "descriptor");
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

function loadScenarios(): Scenario[] {
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

export function freshSession(scenario: Scenario): SessionState {
  return {
    scenarioId: scenario.id,
    objectives: scenario.objectives.map((o) => ({ id: o.id, status: "pending", attempts: 0 })),
    complete: false,
    turns: 0,
  };
}
