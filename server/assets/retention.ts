// What a session leaves behind when the learner did not agree to it being kept.
//
// The consent gate asks two things. The first is required and is about the vendor. The second is not:
// "allow anonymous session data to be used to improve the app", checked by default. Ticked, everything
// this app logs is kept, which is today's behaviour. Unticked, the session still teaches, still credits,
// still records — and then every part of the record that could name the learner is redacted on a short
// timer, while what they LEARNED survives.
//
// Two mechanisms, and which one applies is decided by what the artifact is:
//
//   REDACT ON A TIMER — the session records: turnlog rows, session records, live session logs. They are
//     written in full because an operator debugging a tester's session needs them for the next few
//     hours; RETENTION_TTL_MIN (default 240) is how long that is worth. The sweep then empties the text
//     fields in place, keeping ids, timestamps, providers, latencies, verdicts and durable counts, and
//     stamps the record `redactedAt` so it is idempotent and visible. Progress survives a purge — the
//     credit is the point of the record, and dropping whole rows would lose it.
//
//   NEVER WRITE — the shared, content-addressed stores: assets/audio, its manifest line, the gloss
//     cache, and the catalog-candidates queue. These are keyed by CONTENT, not by session: one entry
//     serves every learner and every authored lesson clip, so a purge that walked them would be
//     guessing which entries it is allowed to delete, and guessing wrong deletes lesson audio the
//     deploy needs. A non-retaining session therefore reads them freely and writes nothing to them.
//     Callers ask `retains(...)` before writing; nothing here has to delete afterwards.
//
// A record that says nothing about retention is a record from before this existed, and it is KEPT — the
// default is today's behaviour in both directions.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ASSET_DIR } from "./store";
import { LOG_PATH as TURNLOG_PATH } from "./turnlog";

const TTL_MS = Math.max(0, Number(process.env.RETENTION_TTL_MIN ?? 240)) * 60_000;

/** The header a request carries when the learner declined. Absent means keep, so nothing that predates
 *  the checkbox — or any client that does not send it — changes behaviour. */
export function retainFrom(supplied: unknown): boolean {
  return String(supplied ?? "") !== "0";
}

/** Does this record still hold text? A record is purgeable when it says `retain: false`; everything
 *  else, including a record with no opinion, is kept. */
function purgeable(rec: { retain?: boolean; redactedAt?: string }): boolean {
  return rec.retain === false && !rec.redactedAt;
}

function expired(iso: string | undefined, now: number): boolean {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? now - t > TTL_MS : true; // an unreadable timestamp is old
}

/** Empty every string in an array of {text} entries, in place. */
function blankText(rows: any[] | undefined, fields: string[]): void {
  for (const row of rows ?? []) for (const f of fields) if (typeof row?.[f] === "string") row[f] = "";
}

/** One turnlog row, redacted. Everything the mastery loop is judged on stays; everything the learner
 *  said, and everything the tutor said back to them, goes. */
function redactTurn(line: any, stamp: string): void {
  line.redactedAt = stamp;
  blankText(line.input?.history, ["text"]);
  if (line.output) {
    line.output.userVerbatim = "";
    line.output.userSaid = "";
    line.output.tutorReply = "";
    line.output.correction = "";
  }
  if (line.witness) {
    blankText(line.witness.targets, ["said"]);
    line.witness.observed = [];
    line.witness.candidates = [];
  }
  if (line.live) blankText(line.live.channels, ["said"]);
  // The clip itself is swept far sooner (TURNLOG_MEDIA_TTL_MIN); the pointer goes with the text.
  if (line.audio) line.audio.file = "(purged)";
}

function sweepTurnlog(now: number, stamp: string): number {
  if (!existsSync(TURNLOG_PATH)) return 0;
  let changed = 0;
  const out: string[] = [];
  for (const raw of readFileSync(TURNLOG_PATH, "utf8").split("\n")) {
    if (!raw.trim()) continue;
    let line: any;
    try {
      line = JSON.parse(raw);
    } catch {
      out.push(raw); // a half-written line is not ours to rewrite
      continue;
    }
    if (purgeable(line) && expired(line.ts, now)) {
      redactTurn(line, stamp);
      changed++;
    }
    out.push(JSON.stringify(line));
  }
  if (changed) writeFileSync(TURNLOG_PATH, out.join("\n") + "\n");
  return changed;
}

function sweepJsonDir(
  dir: string,
  now: number,
  stamp: string,
  at: (rec: any) => string | undefined,
  redact: (rec: any) => void,
): number {
  if (!existsSync(dir)) return 0;
  let changed = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const p = path.join(dir, name);
    try {
      const rec = JSON.parse(readFileSync(p, "utf8"));
      if (!purgeable(rec) || !expired(at(rec), now)) continue;
      redact(rec);
      rec.redactedAt = stamp;
      writeFileSync(p, JSON.stringify(rec, null, 2));
      changed++;
    } catch {
      /* unreadable record — leave it alone rather than rewrite it into something worse */
    }
  }
  return changed;
}

/** Redact every expired record whose session declined retention. Best-effort and idempotent: a failure
 *  here must never break a turn, and a record already stamped is skipped. Called at startup and on every
 *  turn log write, the same shape `sweepMedia` uses — no cron, no scheduler. */
export function sweep(now = Date.now()): void {
  if (TTL_MS <= 0) return;
  const stamp = new Date(now).toISOString();
  try {
    const turns = sweepTurnlog(now, stamp);
    const sessions = sweepJsonDir(
      path.join(ASSET_DIR, "sessions"),
      now,
      stamp,
      (r) => r.updatedAt ?? r.createdAt,
      (r) => {
        blankText(r.turns, ["text", "userVerbatim"]);
        // The audio key is sha256 over the sentence. A non-retaining session never persisted the clip,
        // so the key points at nothing — and a hash of a short sentence is a thing to check a guess
        // against, which is exactly what a redaction is for removing.
        for (const t of r.turns ?? []) delete t.audioKey;
      },
    );
    const live = sweepJsonDir(
      path.join(ASSET_DIR, "live"),
      now,
      stamp,
      (r) => r.endedAt ?? r.startedAt,
      (r) => blankText(r.transcripts, ["text"]),
    );
    if (turns || sessions || live) {
      console.log(`[retention] redacted ${turns} turns, ${sessions} sessions, ${live} live logs`);
    }
  } catch (err: any) {
    console.error("[retention] sweep failed:", err?.message);
  }
}
