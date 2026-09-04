// M6 session capture — persist the ordered transcript of ONE played run as
// assets/sessions/<id>.json. Written incrementally on each live turn, so an abandoned run
// (server or browser killed mid-session) still leaves its partial record on disk (UC1).
//
// A record references clips by `audioKey` and NEVER copies bytes — the audio already lives in the
// content-addressed store, so a record is tiny and a replay is free. Each run is a distinct record
// (a redo is a new file, never an overwrite) — that is the versioning in UC3.

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ASSET_DIR } from "./store";
import type { ObjectiveState } from "../types";

const SESSIONS_DIR = path.join(ASSET_DIR, "sessions");

// Per spec: only two terminal states. The last write of an incomplete run stays "abandoned"
// (abandoned-so-far); the completing turn flips it to "completed".
export type SessionStatus = "completed" | "abandoned";

export interface SessionTurn {
  index: number; // 0-based order
  role: "tutor" | "student";
  text: string; // SL text spoken/heard this turn
  userVerbatim?: string; // student turns: exactly what was heard (errors preserved)
  audioKey?: string; // store key of the clip voicing this turn (absent if not voiced)
  objectiveId?: string;
}

export interface SessionRecord {
  id: string;
  scenarioId: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  finalObjectives: ObjectiveState[];
  turns: SessionTurn[];
  label?: string; // optional human name (UC3: "the one I like")
  favorite?: boolean; // a promoted/preferred run
  /** Which provider answered these turns. The live log has carried its provider since it shipped; a run
   *  of the other mode is only comparable to it if it says the same thing (server/scripts/runs.ts). */
  provider?: string;
}

// runId can originate client-side — keep it filesystem-safe and reject path traversal.
function safeId(id: string): string {
  const cleaned = String(id).replace(/[^A-Za-z0-9._-]/g, "");
  if (!cleaned || cleaned.startsWith(".")) throw new Error("invalid session id");
  return cleaned;
}

function fileFor(id: string): string {
  return path.join(SESSIONS_DIR, `${safeId(id)}.json`);
}

function nowIso(): string {
  return new Date().toISOString();
}

export function load(id: string): SessionRecord | null {
  const p = fileFor(id);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as SessionRecord) : null;
}

function write(rec: SessionRecord): void {
  mkdirSync(SESSIONS_DIR, { recursive: true });
  writeFileSync(fileFor(rec.id), JSON.stringify(rec, null, 2));
}

export function list(): SessionRecord[] {
  if (!existsSync(SESSIONS_DIR)) return [];
  return readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(SESSIONS_DIR, f), "utf8")) as SessionRecord)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // newest first
}

// Append turns to a run's record (creating it on the first call), then persist.
export function appendTurns(args: {
  id: string;
  scenarioId: string;
  seedTurns?: Omit<SessionTurn, "index">[]; // e.g. the opening line — only used when creating the record
  turns: Omit<SessionTurn, "index">[];
  finalObjectives: ObjectiveState[];
  complete: boolean;
  provider?: string;
}): SessionRecord {
  const ts = nowIso();
  const rec: SessionRecord = load(args.id) ?? {
    id: safeId(args.id),
    scenarioId: args.scenarioId,
    createdAt: ts,
    updatedAt: ts,
    status: "abandoned",
    finalObjectives: args.finalObjectives,
    turns: (args.seedTurns ?? []).map((t, i) => ({ ...t, index: i })),
  };
  let next = rec.turns.length;
  for (const t of args.turns) rec.turns.push({ ...t, index: next++ });
  rec.finalObjectives = args.finalObjectives;
  if (args.provider) rec.provider = args.provider;
  rec.status = args.complete ? "completed" : "abandoned";
  rec.updatedAt = ts;
  write(rec);
  return rec;
}

// UC3 promotion: name a run and/or mark it favorite.
export function setMeta(id: string, patch: { label?: string; favorite?: boolean }): SessionRecord {
  const rec = load(id);
  if (!rec) throw new Error(`no session ${id}`);
  if (patch.label !== undefined) rec.label = patch.label;
  if (patch.favorite !== undefined) rec.favorite = patch.favorite;
  write(rec);
  return rec;
}
