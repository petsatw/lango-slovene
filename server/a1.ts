// A1 Readiness (MVP Phase 4) — the coverage map: A1 competency → the catalog learnables that evidence
// it + the scenario levels that advance it. A HAND-AUTHORED placeholder mapping (no mapping engine);
// progress is read from the durable learner model, making this the ONLY learner-visible progress surface.
// Loaded + validated once at startup from server/catalog/a1-map.json.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { LEARNABLES } from "./learnables";

export interface A1ScenarioRef {
  scenarioId: string;
  level: number;
}

export interface A1Competency {
  id: string;
  label: string;
  descriptor: string;
  learnables: string[]; // catalog learnable ids that evidence this competency
  scenarios: A1ScenarioRef[]; // the scenario levels that advance it
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A1_FILE = path.join(__dirname, "catalog", "a1-map.json");

function fail(msg: string): never {
  throw new Error(`Invalid a1-map.json: ${msg}`);
}

export function loadA1Map(): A1Competency[] {
  const raw = JSON.parse(readFileSync(A1_FILE, "utf8"));
  if (!Array.isArray(raw.competencies)) fail(`"competencies" must be an array`);
  for (const c of raw.competencies) {
    if (!c.id || !c.label || !c.descriptor) fail(`competency missing id/label/descriptor`);
    if (!Array.isArray(c.learnables) || !c.learnables.length) fail(`competency "${c.id}": learnables must be a non-empty array`);
    for (const id of c.learnables) {
      if (!LEARNABLES[id]) fail(`competency "${c.id}": learnable "${id}" is not in the catalog`);
    }
    if (!Array.isArray(c.scenarios)) fail(`competency "${c.id}": scenarios must be an array`);
    for (const s of c.scenarios) {
      if (typeof s.scenarioId !== "string" || typeof s.level !== "number")
        fail(`competency "${c.id}": each scenario needs { scenarioId, level }`);
    }
  }
  return raw.competencies as A1Competency[];
}

export const A1_MAP: A1Competency[] = loadA1Map();
