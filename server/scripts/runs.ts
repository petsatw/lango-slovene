// One reading of a sitting on the practice surface, across both speaking modes.
//
// The two modes leave their records in different places and different shapes: tap-to-speak writes turn
// records to assets/sessions/<runId>.json, live writes a transcript to assets/live/<sessionId>.json. The
// join between them is the RUN ID — the client mints one per sitting and sends it to both — so what this
// script does is read both stores, normalise each record to the same four facts and the same transcript,
// and group them under the sitting they belong to.
//
//   npm run runs           # every sitting, newest first
//   npm run runs -- --json # the same, as JSON
//   npm run runs -- <id>   # one sitting, with its full transcript
//
// It reads; it never writes and never bills.

import "dotenv/config";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ASSET_DIR } from "../assets/store";
import * as sessions from "../assets/sessions";
import type { LiveSessionLog } from "../live/log";

interface Run {
  runId: string | null;
  mode: "live" | "tap";
  /** The lesson the live session was working, or the scenario the turns were recorded under. */
  subject: string;
  provider: string | null;
  startedAt: string;
  endedAt: string | null;
  /** What was SAID. For a learner's line that is the Slovene they attempted, errors preserved — the
   *  English is carried alongside, never in its place, because the Slovene is the thing being judged. */
  lines: { role: "user" | "tutor"; text: string; gloss?: string }[];
  /** What the run moved in the learner model — one entry per learnable, successes first. Live earns it
   *  from the grader at teardown, tap from the evidence contract per turn; both arrive at the same
   *  durable counts, which is what makes the two halves of a sitting comparable at all. */
  credit: { id: string; successes: number; attempts: number }[];
  error?: string | null;
}

/** Verdicts → per-learnable counts, in the shape both stores are read into. */
function tally(progress: { id: string; result: string }[]): Run["credit"] {
  const by = new Map<string, { id: string; successes: number; attempts: number }>();
  for (const p of progress) {
    const e = by.get(p.id) ?? { id: p.id, successes: 0, attempts: 0 };
    e.attempts += 1;
    if (p.result === "success") e.successes += 1;
    by.set(p.id, e);
  }
  return [...by.values()].sort((a, b) => b.successes - a.successes || a.id.localeCompare(b.id));
}

function creditLine(credit: Run["credit"]): string {
  if (!credit.length) return "—";
  return credit.map((c) => `${c.id} ${c.successes}✓/${c.attempts}`).join("  ");
}

function liveRuns(): Run[] {
  const dir = path.join(ASSET_DIR, "live");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as LiveSessionLog)
    .map((log) => ({
      runId: log.runId ?? null,
      mode: "live" as const,
      subject: log.lessonId,
      provider: log.provider,
      startedAt: log.startedAt,
      endedAt: log.endedAt,
      lines: log.transcripts.map((t) => ({ role: t.role, text: t.text })),
      credit: tally(log.credit ?? []),
      error: log.error,
    }));
}

function tapRuns(): Run[] {
  return sessions.list().map((rec) => ({
    runId: rec.id,
    mode: "tap" as const,
    subject: rec.scenarioId,
    provider: rec.provider ?? null,
    startedAt: rec.createdAt,
    endedAt: rec.updatedAt,
    // "student" and "user" are the two stores' words for the same speaker — one of the differences this
    // normalisation exists to remove. `text` on a student turn is the ENGLISH gloss and `userVerbatim` is
    // what they actually produced, so the two swap places here to match how the live log reads.
    lines: rec.turns.map((t) =>
      t.role === "student"
        ? { role: "user" as const, text: t.userVerbatim ?? t.text, gloss: t.userVerbatim ? t.text : undefined }
        : { role: "tutor" as const, text: t.text },
    ),
    credit: tally(rec.turns.flatMap((t) => t.learnableProgress ?? [])),
  }));
}

/** Every run under the sitting it belongs to, newest sitting first. A run whose client named no id is a
 *  sitting of its own — it is still a run, and dropping it would quietly shrink the comparison. */
function bySitting(runs: Run[]): { id: string; runs: Run[] }[] {
  const groups = new Map<string, Run[]>();
  for (const r of runs) {
    const key = r.runId ?? `(unnamed) ${r.startedAt}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups]
    .map(([id, rs]) => ({ id, runs: rs.sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1)) }))
    .sort((a, b) => (a.runs[0]!.startedAt < b.runs[0]!.startedAt ? 1 : -1));
}

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const only = args.find((a) => !a.startsWith("--"));

const all = [...liveRuns(), ...tapRuns()];
const sittings = bySitting(all).filter((s) => !only || s.id === only);

if (asJson) {
  console.log(JSON.stringify(sittings, null, 2));
} else if (!sittings.length) {
  console.log(all.length ? `no sitting matches "${only}"` : "no runs recorded yet");
} else {
  for (const s of sittings) {
    console.log(`\n${s.id}`);
    for (const r of s.runs) {
      const mins = r.endedAt ? Math.round((Date.parse(r.endedAt) - Date.parse(r.startedAt)) / 60000) : 0;
      console.log(
        `  ${r.mode.padEnd(4)} ${r.subject.padEnd(20)} provider=${(r.provider ?? "—").padEnd(12)}` +
          ` lines=${String(r.lines.length).padStart(3)}  ${r.startedAt.slice(0, 16).replace("T", " ")}  ${mins}m` +
          (r.error ? `  error=${r.error}` : ""),
      );
      console.log(`       credit  ${creditLine(r.credit)}`);
      // The transcript is the comparison — but only when a sitting was asked for by name, since printing
      // every line of every sitting is how a list stops being readable.
      if (only)
        for (const l of r.lines)
          console.log(`      ${l.role === "user" ? "·" : "»"} ${l.text}${l.gloss ? `   (≈ ${l.gloss})` : ""}`);
    }
  }
  console.log();
}
