// The LEARNABLE catalog — the language catalog of masterable units, parallel to the asset CATALOG
// (catalog.ts). Three kinds (vocabulary · chunk · pattern); only learnables carry durable, cross-session
// mastery (see docs/learnable-subsystem-spec.md). Objectives reference these by id; the learner model
// counts per-learnable productions against them.
//
// Loaded + validated once at startup from server/catalog/learnables.json (id = the JSON key). Same
// loader shape as catalog.ts; `from "./learnables"` resolves to THIS file.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export type LearnableKind = "vocabulary" | "chunk" | "pattern";

export interface Learnable {
  id: string;
  kind: LearnableKind;
  /** Canonical Slovene: the word (vocab), the whole phrase (chunk), or the frame with the slot marked
   *  "___" (pattern, e.g. "Eno ___, prosim."). */
  sl: string;
  gloss: string; // short English gloss
  /** CORE — the narrow, high-frequency set of survival frames. The single source of truth for core
   *  membership: the difficulty classifier, mastery selection and the authoring gates all read this flag.
   *  Default false. */
  core?: boolean;
  rank?: number; // leverage rank from the core pattern library; consulted only for core patterns
  predictableError?: string; // the one predictable beginner error, surfaced by presentation
  /** The "Tagged-A1" superset tag (docs/dialogue-difficulty-model.md §2). A deliberate at-mint decision:
   *  set true when the item is A1 material even if it is not core (CORE ⊆ Tagged-A1). It widens what the
   *  difficulty classifier counts as A1; an item that is neither core nor tagged is above-A1 and simply
   *  raises a dialogue's computed band. Core and/or tagged items must also be placed in the a1-map, which
   *  is what the A1 Readiness screen reads (`lint:a1` gates on it). */
  a1?: boolean;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEARNABLES_FILE = path.join(__dirname, "catalog", "learnables.json");

const KINDS: LearnableKind[] = ["vocabulary", "chunk", "pattern"];

function fail(msg: string): never {
  throw new Error(`Invalid learnables catalog: ${msg}`);
}

function asString(obj: any, key: string, where: string): string {
  const v = obj?.[key];
  if (typeof v !== "string" || v.length === 0) fail(`${where}: field "${key}" must be a non-empty string`);
  return v;
}

export function loadLearnables(): Record<string, Learnable> {
  const raw = JSON.parse(readFileSync(LEARNABLES_FILE, "utf8"));
  const out: Record<string, Learnable> = {};
  for (const id of Object.keys(raw)) {
    const l = raw[id];
    const kind = l?.kind;
    if (!KINDS.includes(kind)) fail(`learnable "${id}": kind must be one of ${KINDS.join(" | ")}`);
    if (l.core !== undefined && typeof l.core !== "boolean") fail(`learnable "${id}": core must be a boolean`);
    if (l.a1 !== undefined && typeof l.a1 !== "boolean") fail(`learnable "${id}": a1 must be a boolean`);
    if (l.rank !== undefined && typeof l.rank !== "number") fail(`learnable "${id}": rank must be a number`);
    if (l.predictableError !== undefined && typeof l.predictableError !== "string")
      fail(`learnable "${id}": predictableError must be a string`);
    out[id] = {
      id,
      kind,
      sl: asString(l, "sl", `learnable "${id}"`),
      gloss: asString(l, "gloss", `learnable "${id}"`),
      ...(l.core !== undefined ? { core: l.core } : {}),
      ...(l.a1 !== undefined ? { a1: l.a1 } : {}),
      ...(l.rank !== undefined ? { rank: l.rank } : {}),
      ...(l.predictableError !== undefined ? { predictableError: l.predictableError } : {}),
    };
  }
  return out;
}

export const LEARNABLES: Record<string, Learnable> = loadLearnables();

export function getLearnable(id: string): Learnable {
  const l = LEARNABLES[id];
  if (!l) throw new Error(`Unknown learnable "${id}". Known: ${Object.keys(LEARNABLES).join(", ")}`);
  return l;
}

/** Resolve a list of learnable ids to their catalog entries, failing on any unknown id. Used by the
 *  scenario loader to validate objective.learnables references at startup. */
export function resolveLearnables(ids: string[]): Learnable[] {
  return ids.map(getLearnable);
}
