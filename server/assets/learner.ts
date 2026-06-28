// The durable LEARNER MODEL — one small JSON file on disk, single learner / one device / no accounts
// (spec §2.3). Same durable-JSON pattern as sessions.ts. Path is LEARNER_PATH (default
// assets/learner.json) so tests can point it at a temp file without touching the real model.
//
// The model holds only per-learnable counts; status (unseen/attempted/mastered) is DERIVED at read
// time (see mastery.ts), so the stored state stays small and swappable (US-16).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ASSET_DIR } from "./store";
import type { LearnerModel } from "../types";

function learnerPath(): string {
  return process.env.LEARNER_PATH || path.join(ASSET_DIR, "learner.json");
}

function emptyModel(): LearnerModel {
  return { learnables: {}, updatedAt: new Date().toISOString() };
}

export function load(): LearnerModel {
  const p = learnerPath();
  if (!existsSync(p)) return emptyModel();
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    return { learnables: raw?.learnables ?? {}, updatedAt: raw?.updatedAt ?? new Date().toISOString() };
  } catch {
    // A corrupt/half-written file should not brick the turn loop — start fresh (it gets rewritten).
    return emptyModel();
  }
}

export function save(model: LearnerModel): LearnerModel {
  const p = learnerPath();
  mkdirSync(path.dirname(p), { recursive: true });
  const out: LearnerModel = { learnables: model.learnables, updatedAt: new Date().toISOString() };
  writeFileSync(p, JSON.stringify(out, null, 2));
  return out;
}
