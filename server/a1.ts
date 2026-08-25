// A1 Readiness (MVP Phase 4) — the coverage map: A1 competency → the catalog learnables that evidence
// it + the scenario levels that advance it. The competency list is GROUNDED in the official Slovene A1
// taxonomy (docs/a1-taxonomy.md): 3 foundational layers (phonology/numbers · morphosyntax · pragmatics)
// + the 10 thematic domains. Progress is read from the durable learner model, making this the ONLY
// learner-visible progress surface. A `foundational|thematic` bucket may be EMPTY (a domain the shipped
// scenarios don't reach yet — the readiness frontier), which is legitimate, not an error.
//
// The map answers WHICH LIFE DOMAIN an item serves and HOW FAR the learner is in that domain. It does not
// answer whether an item is core — that is the learnable's own `core: true` flag. Membership is many-to-many
// by design (`hvala` serves both pragmatics and personal_relations), which is what makes it a coverage map.
//
// Loaded + validated once at startup from server/catalog/a1-map.json. `lint:a1` adds the reverse check
// the loader can't: every core and/or A1-tagged learnable is mapped here or on the explicit `excluded`
// list — an unmapped one can be mastered with nothing moving on the readiness screen.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { LEARNABLES } from "./learnables";

export interface A1ScenarioRef {
  scenarioId: string;
  level: number;
}

export type A1CompetencyKind = "foundational" | "thematic";

export interface A1Competency {
  id: string;
  /** foundational = a cross-modal layer (§1); thematic = one of the 10 domains (§3). */
  kind: A1CompetencyKind;
  label: string;
  descriptor: string;
  /** CAN-DO functions this competency covers (thematic domains; optional). */
  functions?: string[];
  /** Sample formulaic exponents (thematic domains; optional). */
  exponents?: string[];
  learnables: string[]; // catalog learnable ids that evidence this competency (may be [] for a frontier domain)
  scenarios: A1ScenarioRef[]; // the scenario levels that advance it (may be [])
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A1_FILE = path.join(__dirname, "catalog", "a1-map.json");

function fail(msg: string): never {
  throw new Error(`Invalid a1-map.json: ${msg}`);
}

function strArray(v: any, where: string): string[] {
  if (!Array.isArray(v)) fail(`${where} must be an array`);
  for (const s of v) if (typeof s !== "string") fail(`${where} must be an array of strings`);
  return v;
}

export interface A1Map {
  competencies: A1Competency[];
  /** learnable ids deliberately left off the map (keeps lint:a1 honest — an unmapped learnable that is
   *  NOT excluded is a coverage error). */
  excluded: string[];
}

export function loadA1Map(): A1Map {
  const raw = JSON.parse(readFileSync(A1_FILE, "utf8"));
  if (!Array.isArray(raw.competencies)) fail(`"competencies" must be an array`);
  const seen = new Set<string>();
  for (const c of raw.competencies) {
    if (!c.id || !c.label || !c.descriptor) fail(`competency missing id/label/descriptor`);
    if (seen.has(c.id)) fail(`duplicate competency id "${c.id}"`);
    seen.add(c.id);
    if (c.kind !== "foundational" && c.kind !== "thematic") fail(`competency "${c.id}": kind must be "foundational" | "thematic"`);
    if (!Array.isArray(c.learnables)) fail(`competency "${c.id}": learnables must be an array`);
    for (const id of c.learnables) {
      if (!LEARNABLES[id]) fail(`competency "${c.id}": learnable "${id}" is not in the catalog`);
    }
    if (c.functions !== undefined) strArray(c.functions, `competency "${c.id}": functions`);
    if (c.exponents !== undefined) strArray(c.exponents, `competency "${c.id}": exponents`);
    if (!Array.isArray(c.scenarios)) fail(`competency "${c.id}": scenarios must be an array`);
    for (const s of c.scenarios) {
      if (typeof s.scenarioId !== "string" || typeof s.level !== "number")
        fail(`competency "${c.id}": each scenario needs { scenarioId, level }`);
    }
  }
  const excluded = raw.excluded !== undefined ? strArray(raw.excluded, `"excluded"`) : [];
  for (const id of excluded) if (!LEARNABLES[id]) fail(`excluded id "${id}" is not in the catalog`);
  return { competencies: raw.competencies as A1Competency[], excluded };
}

const loaded = loadA1Map();
export const A1_MAP: A1Competency[] = loaded.competencies;
export const A1_EXCLUDED: string[] = loaded.excluded;
