// What the server keeps, and when it lets go (docs/features/data-deletion/spec.md#3-sweeps).
//
// `sweep()` runs at startup and every 24 hours and handles four cases:
//   - a learner whose `lastSeenAt` is more than 12 months ago: `deleteLearner`
//   - an improvement copy more than 90 days old: deleted
//   - a no-save live log whose session ended or passed SESSION_TTL_SEC: deleted with its turn-log rows
//     and translations
//   - a candidate row more than 12 months old: dropped
// A saved session keeps its live log, session record and turn-log rows in full until one of those
// applies.
//
// The shared, content-addressed stores (assets/audio, its manifest line, the gloss cache, the
// catalog-candidates queue) are keyed by content, not by session. A session that declined retention
// reads them and writes nothing; callers ask `retainFrom` / `retain` before writing.

import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./store";
import { LOG_PATH as TURNLOG_PATH } from "./turnlog";
import { CANDIDATES_PATH } from "./candidates";
import { deleteLearner } from "./deletion";

const DAY_MS = 86_400_000;
const LEARNER_LIMIT_MS = 365 * DAY_MS;
const CANDIDATE_LIMIT_MS = 365 * DAY_MS;
const IMPROVE_LIMIT_MS = 90 * DAY_MS;

/** The header a request carries when the learner declined. Absent means keep, so nothing that predates
 *  the checkbox — or any client that does not send it — changes behaviour. */
export function retainFrom(supplied: unknown): boolean {
  return String(supplied ?? "") !== "0";
}

/** Delete what a no-save live session left: its log, its turn-log rows and its translations
 *  (docs/features/no-save-session/spec.md#2-session-end). Idempotent; best-effort. */
export function purgeSession(sessionId: string): void {
  try {
    const live = path.join(DATA_DIR, "live");
    rmSync(path.join(live, `${sessionId}.json`), { force: true });
    rmSync(path.join(live, `${sessionId}.gloss.json`), { force: true });
    if (!existsSync(TURNLOG_PATH)) return;
    const lines = readFileSync(TURNLOG_PATH, "utf8").split("\n").filter((raw) => {
      if (!raw.trim()) return false;
      try {
        return JSON.parse(raw).sessionId !== sessionId;
      } catch {
        return true;
      }
    });
    writeFileSync(TURNLOG_PATH, lines.length ? lines.join("\n") + "\n" : "");
  } catch (err: any) {
    console.error("[retention] purge failed:", err?.message);
  }
}

/** Sessions this process is scoring right now. Their end step deletes them, so the sweep skips them. */
export const settling = new Set<string>();

/** Purge every no-save live log whose session ended or passed SESSION_TTL_SEC, except one this process
 *  is still scoring. */
function sweepNoSave(now: number): number {
  const dir = path.join(DATA_DIR, "live");
  if (!existsSync(dir)) return 0;
  const ttlMs = Number(process.env.SESSION_TTL_SEC || 600) * 1000;
  let purged = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json") || name.endsWith(".gloss.json")) continue;
    try {
      const rec = JSON.parse(readFileSync(path.join(dir, name), "utf8"));
      const sessionId = rec.sessionId ?? name.slice(0, -5);
      if (rec.noSave !== true || settling.has(sessionId)) continue;
      if (Number.isFinite(Date.parse(rec.endedAt)) || now - Date.parse(rec.startedAt) > ttlMs) {
        purgeSession(sessionId);
        purged++;
      }
    } catch {
      /* unreadable record — leave it alone */
    }
  }
  return purged;
}

const jsonIn = (dir: string) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json") && !f.endsWith(".gloss.json")) : [];

/** Delete every learner whose `lastSeenAt` is over 12 months old. */
function sweepLearners(now: number): number {
  const dir = process.env.LEARNERS_DIR || path.join(DATA_DIR, "learners");
  let deleted = 0;
  for (const name of jsonIn(dir)) {
    try {
      const rec = JSON.parse(readFileSync(path.join(dir, name), "utf8"));
      const seen = Date.parse(rec.lastSeenAt ?? rec.updatedAt);
      if (Number.isFinite(seen) && now - seen > LEARNER_LIMIT_MS) {
        deleteLearner(name.slice(0, -5));
        deleted++;
      }
    } catch {
      /* unreadable record — leave it alone */
    }
  }
  return deleted;
}

/** Delete every improvement copy over 90 days old. */
function sweepImprove(now: number): number {
  const dir = path.join(DATA_DIR, "improve");
  let deleted = 0;
  for (const name of jsonIn(dir)) {
    try {
      const created = Date.parse(JSON.parse(readFileSync(path.join(dir, name), "utf8")).createdAt);
      if (Number.isFinite(created) && now - created > IMPROVE_LIMIT_MS) {
        rmSync(path.join(dir, name), { force: true });
        deleted++;
      }
    } catch {
      /* unreadable record — leave it alone */
    }
  }
  return deleted;
}

/** Drop every candidate row over 12 months old; a line that does not parse is kept. */
function sweepCandidates(now: number): number {
  if (!existsSync(CANDIDATES_PATH)) return 0;
  const lines = readFileSync(CANDIDATES_PATH, "utf8").split("\n").filter((raw) => raw.trim());
  const kept = lines.filter((raw) => {
    try {
      return !(now - Date.parse(JSON.parse(raw).at) > CANDIDATE_LIMIT_MS);
    } catch {
      return true;
    }
  });
  if (kept.length !== lines.length) writeFileSync(CANDIDATES_PATH, kept.length ? kept.join("\n") + "\n" : "");
  return lines.length - kept.length;
}

/** The four cases above. Best-effort: a failure in one never stops the others. */
export function sweep(now = Date.now()): void {
  const cases: [string, (now: number) => number][] = [
    ["learners", sweepLearners],
    ["improvement copies", sweepImprove],
    ["no-save live sessions", sweepNoSave],
    ["candidate rows", sweepCandidates],
  ];
  for (const [what, run] of cases) {
    try {
      const n = run(now);
      if (n) console.log(`[retention] deleted ${n} ${what}`);
    } catch (err: any) {
      console.error(`[retention] ${what} sweep failed:`, err?.message);
    }
  }
}
