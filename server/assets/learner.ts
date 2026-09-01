// The durable LEARNER MODEL — one small JSON file on disk, single learner / one device / no accounts
// (spec §2.3). Same durable-JSON pattern as sessions.ts. Path is LEARNER_PATH (default
// assets/learner.json) so tests can point it at a temp file without touching the real model.
//
// The model holds per-learnable counts and per-fact answers. Status (unseen/attempted/mastered) is
// DERIVED at read time (see mastery.ts), so the stored state stays small and swappable (US-16).
//
// BOTH functions below rebuild the model FIELD BY FIELD, in and out. That is deliberate — it is what
// keeps a half-written or hand-edited file from carrying junk into the turn loop — and it has one
// consequence worth stating plainly: a field added to `LearnerModel` reaches disk only once it is named
// in `save`, and comes back only once it is named in `load`. Adding a field is a three-file edit
// (types.ts and both functions here), and the two functions are the ones easiest to miss.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ASSET_DIR } from "./store";
import type { LearnerModel } from "../types";

function learnerPath(): string {
  return process.env.LEARNER_PATH || path.join(ASSET_DIR, "learner.json");
}

function emptyModel(): LearnerModel {
  return { learnables: {}, facts: {}, updatedAt: new Date().toISOString() };
}

export function load(): LearnerModel {
  const p = learnerPath();
  if (!existsSync(p)) return emptyModel();
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    return {
      learnables: raw?.learnables ?? {},
      // A model written before facts existed simply has none, which is the same state as a learner who
      // has not been asked yet — so an older file loads as a learner at the start of the course.
      facts: raw?.facts ?? {},
      updatedAt: raw?.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    // A corrupt/half-written file should not brick the turn loop — start fresh (it gets rewritten).
    return emptyModel();
  }
}

export function save(model: LearnerModel): LearnerModel {
  const p = learnerPath();
  mkdirSync(path.dirname(p), { recursive: true });
  const out: LearnerModel = {
    learnables: model.learnables,
    facts: model.facts ?? {},
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(p, JSON.stringify(out, null, 2));
  return out;
}

/** Record one answer about the learner and persist it — the whole write path for a fact.
 *
 *  The value is checked against the fact's declared domain by the caller that has the fact in hand
 *  (/api/scene); this function owns the storage, not the vocabulary. Returns the saved model so a caller
 *  can go straight on to reading the facts it just wrote. */
export function setFact(id: string, value: string): LearnerModel {
  const model = load();
  return save({ ...model, facts: { ...model.facts, [id]: value } });
}

/** Everything currently known about the learner as a person. The read path every variant resolution
 *  goes through, so there is one answer to "what does the app know?". */
export function facts(): Record<string, string> {
  return load().facts;
}
