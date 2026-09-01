// LEARNER FACTS — the things the course knows about the PERSON, as named server-owned data.
//
// The durable learner model holds two separate kinds of knowledge. `learnables` is what the learner can
// SAY: per-item counts, earned on the mic, derived into mastery. A fact is what the learner IS: one small
// answer about them that the language itself requires before it can address them or put words in their
// mouth. Slovene asks for the first of these in the opening minute — it inflects a speaker's own words
// for their gender — and a course that does not know it either guesses or writes around the gap forever.
//
// A fact is DECLARED here rather than discovered from the lessons that use it, so that:
//   - a lesson can offer the learner the choice and the option set comes from one place;
//   - a lesson authored later can vary its lines on a fact the learner answered lessons ago;
//   - the gates can check both against the same closed value set.
//
// One learner, one device, no accounts (spec §2.3): a fact is a single stored string, and the person who
// gave it is the only person it describes.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** One answer a fact accepts. `value` is what gets stored; `label` names it in English for the operator
 *  tools and the gates. The learner never reads either — a lesson offering the choice labels its buttons
 *  with the Slovene the learner is about to say. */
export interface FactValue {
  value: string;
  label: string;
}

export interface LearnerFact {
  /** What this fact is, in English. Operator-facing. */
  label: string;
  /** Why the course needs it — the linguistic reason, so the next person to read this knows what breaks
   *  without it. */
  why: string;
  /** The closed, ORDERED set of answers. Order is authored: it is the order a lesson's choice buttons
   *  appear in, so the two are decided in one place rather than drifting apart. */
  values: FactValue[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FACTS_FILE = path.join(__dirname, "catalog", "facts.json");

function fail(msg: string): never {
  throw new Error(`Invalid facts.json: ${msg}`);
}

function load(): Record<string, LearnerFact> {
  const raw = JSON.parse(readFileSync(FACTS_FILE, "utf8"));
  const facts = raw?.facts;
  if (!facts || typeof facts !== "object") fail(`"facts" must be an object`);
  const out: Record<string, LearnerFact> = {};
  for (const [id, f] of Object.entries<any>(facts)) {
    if (!/^[a-z0-9_]+$/.test(id)) fail(`fact id "${id}" must be snake_case lowercase`);
    for (const k of ["label", "why"]) {
      if (typeof f?.[k] !== "string" || !f[k]) fail(`fact "${id}": "${k}" must be a non-empty string`);
    }
    if (!Array.isArray(f.values) || f.values.length < 2)
      fail(`fact "${id}": "values" must list at least two answers (a fact with one answer asks nothing)`);
    const seen = new Set<string>();
    for (const v of f.values) {
      if (typeof v?.value !== "string" || !v.value) fail(`fact "${id}": every value needs a non-empty "value"`);
      if (typeof v?.label !== "string" || !v.label) fail(`fact "${id}": value "${v.value}" needs a "label"`);
      if (seen.has(v.value)) fail(`fact "${id}": duplicate value "${v.value}"`);
      seen.add(v.value);
    }
    out[id] = { label: f.label, why: f.why, values: f.values.map((v: any) => ({ value: v.value, label: v.label })) };
  }
  return out;
}

/** Every declared learner fact, validated once at startup. */
export const FACTS: Record<string, LearnerFact> = load();

/** The fact with this id, or undefined. Callers that must have one fail loud on the undefined. */
export function getFact(id: string): LearnerFact | undefined {
  return FACTS[id];
}

/** The answers this fact accepts, as a set — the closed domain every gate checks against. */
export function factValues(id: string): Set<string> {
  return new Set((FACTS[id]?.values ?? []).map((v) => v.value));
}
