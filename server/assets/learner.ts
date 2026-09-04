// The LEARNER MODEL — per-learnable counts and per-fact answers, held under a LEARNER ID.
//
// The id is the seam accounts arrive on. Today the client mints one per sitting at the consent gate and
// the default store keeps it in memory: progress accrues normally through a session — the learner is met
// where they left off five minutes ago — and is gone when the session ends. When accounts exist, the id
// becomes an account id and the store becomes durable. That is the whole change; no caller moves.
//
// Two stores:
//   - memory (the default) — one model per id, dropped after LEARNER_TTL_MIN without a write.
//   - file (LEARNER_STORE=file) — one model on disk at LEARNER_PATH (default assets/learner.json). It is
//     the operator's own, held for a single machine, so every id reads and writes the same file. This is
//     what `npm run learner` shows and what the probes point at a temp path.
//
// The model holds per-learnable counts and per-fact answers. Status (unseen/attempted/mastered) is
// DERIVED at read time (see mastery.ts), so the stored state stays small and swappable (US-16).
//
// The model is rebuilt FIELD BY FIELD on the way in and out of the file store. That is deliberate — it is
// what keeps a half-written or hand-edited file from carrying junk into the turn loop — and it has one
// consequence worth stating plainly: a field added to `LearnerModel` reaches disk only once it is named
// in both directions. Adding a field is a three-file edit (types.ts and both halves here).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ASSET_DIR } from "./store";
import type { LearnerModel } from "../types";

/** The id a request that names no learner is served under — the operator at their own machine. */
export const DEFAULT_LEARNER_ID = "local";

const TTL_MS = Number(process.env.LEARNER_TTL_MIN || 180) * 60_000;

/** Ids arrive from the client, so they are bounded and kept to characters a filename tolerates — the
 *  file store writes one, and a future durable store will key rows by it. */
export function idFrom(supplied: unknown): string {
  const cleaned = String(supplied ?? "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64);
  return cleaned && !cleaned.startsWith(".") ? cleaned : DEFAULT_LEARNER_ID;
}

function emptyModel(): LearnerModel {
  return { learnables: {}, facts: {}, updatedAt: new Date().toISOString() };
}

interface LearnerStore {
  read(id: string): LearnerModel;
  write(id: string, model: LearnerModel): LearnerModel;
}

function shape(raw: any): LearnerModel {
  return {
    learnables: raw?.learnables ?? {},
    // A model written before facts existed simply has none, which is the same state as a learner who has
    // not been asked yet — so an older file loads as a learner at the start of the course.
    facts: raw?.facts ?? {},
    updatedAt: raw?.updatedAt ?? new Date().toISOString(),
  };
}

function learnerPath(): string {
  return process.env.LEARNER_PATH || path.join(ASSET_DIR, "learner.json");
}

const fileStore: LearnerStore = {
  read() {
    const p = learnerPath();
    if (!existsSync(p)) return emptyModel();
    try {
      return shape(JSON.parse(readFileSync(p, "utf8")));
    } catch {
      // A corrupt/half-written file should not brick the turn loop — start fresh (it gets rewritten).
      return emptyModel();
    }
  },
  write(_id, model) {
    const p = learnerPath();
    mkdirSync(path.dirname(p), { recursive: true });
    const out = shape({ ...model, updatedAt: new Date().toISOString() });
    writeFileSync(p, JSON.stringify(out, null, 2));
    return out;
  },
};

const held = new Map<string, { model: LearnerModel; touchedAt: number }>();

const memoryStore: LearnerStore = {
  read(id) {
    return held.get(id)?.model ?? emptyModel();
  },
  write(id, model) {
    const now = Date.now();
    for (const [key, entry] of held) if (now - entry.touchedAt > TTL_MS) held.delete(key);
    const out = shape({ ...model, updatedAt: new Date().toISOString() });
    held.set(id, { model: out, touchedAt: now });
    return out;
  },
};

function store(): LearnerStore {
  return (process.env.LEARNER_STORE || "memory").toLowerCase() === "file" ? fileStore : memoryStore;
}

export function load(id: string): LearnerModel {
  return store().read(idFrom(id));
}

export function save(id: string, model: LearnerModel): LearnerModel {
  return store().write(idFrom(id), model);
}

/** Record one answer about the learner and persist it — the whole write path for a fact.
 *
 *  The value is checked against the fact's declared domain by the caller that has the fact in hand
 *  (/api/scene); this function owns the storage, not the vocabulary. Returns the saved model so a caller
 *  can go straight on to reading the facts it just wrote. */
export function setFact(id: string, factId: string, value: string): LearnerModel {
  const model = load(id);
  return save(id, { ...model, facts: { ...model.facts, [factId]: value } });
}

/** Everything currently known about this learner as a person. The read path every variant resolution
 *  goes through, so there is one answer to "what does the app know?". */
export function facts(id: string): Record<string, string> {
  return load(id).facts;
}
