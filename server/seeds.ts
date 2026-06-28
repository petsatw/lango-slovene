// SEED framework — audio-only guided onboarding dialogues for the zero-context learner.
//
// A seed is a SCRIPTED, ordered sequence of steps delivered through the SAME free-conversation pipeline
// and chat surface as a live dialogue — the only difference is that the tutor's lines come from a static
// adapter (adapters/seed-scripted.ts) instead of the model. There is NO model in the seed loop: the
// audio isn't judged; each practiced step just plants its learnables as ATTEMPTS (entries). It is
// deliberately NOT the visual scenario engine — no scene/images/flashcards, just lines + audio. The
// structure is reusable (more seeds later for harder topics); for now there is one: getting-started.
//
// `mode` ("introduce" | "recall") is advisory authoring intent (introduce = first showing; recall =
// re-elicit an earlier form). The current static adapter treats both the same (attempt-only); a future
// model-backed seed could use it to allow cold-recall successes.
//
// Loaded + validated once at startup from server/seeds/*.json. `from "./seeds"` resolves to THIS file.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { LEARNABLES } from "./learnables";

export type SeedStepMode = "introduce" | "recall";

export interface SeedStep {
  id: string;
  mode: SeedStepMode;
  /** The tutor's scripted line (Slovene) — scaffolding + setup for this step (e.g. "Zdaj ti. Reci: …"). */
  tutorSL: string;
  /** English gloss of the tutor's line + the intent — shown to the learner (seed-only bilingual aid). */
  tutorEN: string;
  /** The line the learner should produce. Its teacher-voice audio is the "hear it" example. */
  targetSL: string;
  /** English gloss of the target line. */
  targetEN: string;
  /** Catalog learnable ids this step exercises — the ONLY creditable set for this step (the allowlist). */
  learnables: string[];
}

export interface Seed {
  id: string;
  title: string;
  steps: SeedStep[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEEDS_DIR = path.join(__dirname, "seeds");

function fail(file: string, msg: string): never {
  throw new Error(`Invalid seed "${file}": ${msg}`);
}

function asString(file: string, obj: any, key: string, where: string): string {
  const v = obj?.[key];
  if (typeof v !== "string" || v.length === 0) fail(file, `${where}: field "${key}" must be a non-empty string`);
  return v;
}

export function validateSeed(file: string, raw: any): Seed {
  if (!raw || typeof raw !== "object") fail(file, "not an object");
  asString(file, raw, "id", "seed");
  asString(file, raw, "title", "seed");
  if (!Array.isArray(raw.steps) || raw.steps.length === 0) fail(file, `"steps" must be a non-empty array`);
  for (const s of raw.steps) {
    const where = `step "${s?.id ?? "?"}"`;
    asString(file, s, "id", where);
    if (s.mode !== "introduce" && s.mode !== "recall") fail(file, `${where}: mode must be "introduce" | "recall"`);
    asString(file, s, "tutorSL", where);
    asString(file, s, "tutorEN", where);
    asString(file, s, "targetSL", where);
    asString(file, s, "targetEN", where);
    if (!Array.isArray(s.learnables) || s.learnables.length === 0)
      fail(file, `${where}: learnables must be a non-empty array of catalog ids`);
    for (const id of s.learnables) {
      if (typeof id !== "string" || !LEARNABLES[id]) fail(file, `${where}: learnable "${id}" is not in the catalog`);
    }
  }
  return raw as Seed;
}

export function loadSeeds(): Record<string, Seed> {
  const out: Record<string, Seed> = {};
  for (const f of readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const seed = validateSeed(f, JSON.parse(readFileSync(path.join(SEEDS_DIR, f), "utf8")));
    out[seed.id] = seed;
  }
  return out;
}

export const SEEDS: Record<string, Seed> = loadSeeds();

/** The seed a zero-context learner starts with. Single purpose for now. */
export const STARTER_SEED_ID = "getting-started";

export function getSeed(id: string): Seed {
  const s = SEEDS[id];
  if (!s) throw new Error(`Unknown seed "${id}". Known: ${Object.keys(SEEDS).join(", ")}`);
  return s;
}
