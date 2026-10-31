// A learner's history and what deleting it removes (docs/features/learning-history/spec.md,
// docs/features/data-deletion/spec.md). Every function takes the learnerId and touches only that
// learner's records.

import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./store";
import { LOG_PATH as TURNLOG_PATH } from "./turnlog";
import { EVENTS_PATH } from "../events";
import type { LiveTranscript } from "../live/log";
import { DIALOGUES } from "../dialogues";
import { LEARNABLES } from "../learnables";
import { SCENARIOS } from "../scenarios";

export interface HistoryEntry {
  id: string;
  kind: "live" | "tap";
  lessonId: string;
  /** The name of the scenario the lesson belongs to; the lessonId when none resolves. */
  scenario: string;
  startedAt: string;
  endedAt: string;
  /** Learner-facing names of the objectives the session made progress on. */
  progressed: string[];
  transcripts: LiveTranscript[];
}

/** A lesson id is a scenario id (a scene) or a dialogue id (a tree of a scenario). */
function scenarioOf(lessonId: string) {
  const scenarioId = Object.values(DIALOGUES).flat().find((d) => d.id === lessonId)?.scenarioId ?? lessonId;
  return SCENARIOS.find((s) => s.id === scenarioId);
}

const scenarioName = (lessonId: string): string => {
  const s = scenarioOf(lessonId);
  return s ? s.name ?? s.title : lessonId;
};

const LIVE_DIR = () => path.join(DATA_DIR, "live");
const SESSIONS_DIR = () => path.join(DATA_DIR, "sessions");
const IMPROVE_DIR = () => path.join(DATA_DIR, "improve");
const LEARNERS_DIR = () => process.env.LEARNERS_DIR || path.join(DATA_DIR, "learners");

const readJson = (p: string): any => {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};

function jsonFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(".gloss.json")) : [];
}

function fromLive(log: any): HistoryEntry {
  return {
    id: log.sessionId,
    kind: "live",
    lessonId: log.lessonId,
    scenario: scenarioName(log.lessonId),
    startedAt: log.startedAt,
    endedAt: log.endedAt,
    progressed: ((log.progressed ?? []) as string[]).map((id) => LEARNABLES[id]?.sl ?? id),
    transcripts: log.transcripts ?? [],
  };
}

function fromTap(rec: any): HistoryEntry {
  const objectives: any[] = rec.finalObjectives ?? [];
  return {
    id: rec.id,
    kind: "tap",
    lessonId: rec.scenarioId,
    scenario: scenarioName(rec.scenarioId),
    startedAt: rec.createdAt,
    endedAt: rec.updatedAt,
    progressed: objectives
      .filter((o) => o.status === "completed")
      .map((o) => scenarioOf(rec.scenarioId)?.objectives.find((x) => x.id === o.id)?.label ?? o.id),
    transcripts: (rec.turns ?? []).map((t: any) => ({
      ts: rec.createdAt,
      role: t.role === "student" ? "user" : "tutor",
      text: (t.role === "student" ? t.userVerbatim : null) ?? t.text,
    })),
  };
}

/** Every history entry of the learner, newest first. */
export function listHistory(learnerId: string): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const f of jsonFiles(LIVE_DIR())) {
    const log = readJson(path.join(LIVE_DIR(), f));
    if (log?.learnerId === learnerId && log.noSave !== true) entries.push(fromLive(log));
  }
  for (const f of jsonFiles(SESSIONS_DIR())) {
    const rec = readJson(path.join(SESSIONS_DIR(), f));
    if (rec?.learnerId === learnerId) entries.push(fromTap(rec));
  }
  return entries.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

/** One entry, or null when it does not exist or belongs to another learner. */
export function getHistory(learnerId: string, id: string): HistoryEntry | null {
  return listHistory(learnerId).find((e) => e.id === id) ?? null;
}

/** Rewrite a JSONL file without the lines `drop` selects; a line that does not parse is kept. */
function dropLines(file: string, drop: (row: any) => boolean): void {
  if (!existsSync(file)) return;
  const kept = readFileSync(file, "utf8")
    .split("\n")
    .filter((raw) => {
      if (!raw.trim()) return false;
      try {
        return !drop(JSON.parse(raw));
      } catch {
        return true;
      }
    });
  writeFileSync(file, kept.length ? kept.join("\n") + "\n" : "");
}

/** Delete one entry and what hangs off it. Returns false when the learner has no such entry. */
export function deleteHistory(learnerId: string, id: string): boolean {
  const entry = getHistory(learnerId, id);
  if (!entry) return false;
  const file = path.join(entry.kind === "live" ? LIVE_DIR() : SESSIONS_DIR(), `${id}.json`);
  rmSync(file, { force: true });
  rmSync(path.join(LIVE_DIR(), `${id}.gloss.json`), { force: true });
  rmSync(path.join(IMPROVE_DIR(), `${id}.json`), { force: true });
  dropLines(TURNLOG_PATH, (r) => r.learnerId === learnerId && (r.sessionId === id || r.runId === id));
  return true;
}

export function deleteAllHistory(learnerId: string): void {
  for (const e of listHistory(learnerId)) deleteHistory(learnerId, e.id);
}

/** Delete everything held about the learner: the model, the history, turn-log rows, event rows and
 *  improvement copies. */
export function deleteLearner(learnerId: string): void {
  deleteAllHistory(learnerId);
  rmSync(path.join(LEARNERS_DIR(), `${learnerId}.json`), { force: true });
  dropLines(TURNLOG_PATH, (r) => r.learnerId === learnerId);
  dropLines(EVENTS_PATH, (r) => r.learnerId === learnerId);
  for (const f of jsonFiles(IMPROVE_DIR())) {
    if (readJson(path.join(IMPROVE_DIR(), f))?.learnerId === learnerId) rmSync(path.join(IMPROVE_DIR(), f), { force: true });
  }
}
