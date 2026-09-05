// The session log — the only durable artifact a live session leaves, and the whole basis of the
// provider comparison. One JSON per session under assets/live/, written on close.
//
// It holds transcripts and nothing else: no audio bytes, no vendor payloads, no analytics. Scoring
// "Slovene-only / on-plan / English leak / recovery" is a read of the transcript, so a transcript is
// what it stores.
//
// Like assets/sessions/, this is learner speech and stays OUT of the deploy (see docs/DEPLOY.md).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ASSET_DIR } from "../assets/store";
import type { LearnableProgress } from "../types";
import type { LiveProvider } from "./types";

export interface LiveTranscript {
  ts: string;
  role: "user" | "tutor";
  text: string;
}

export interface LiveSessionLog {
  sessionId: string;
  /** The sitting: the id the same tester's tap-to-speak turns are recorded under, so one run of a lesson
   *  can be read next to the other (server/scripts/runs.ts). Null when the client named none. */
  runId: string | null;
  lessonId: string;
  provider: LiveProvider;
  startedAt: string;
  endedAt: string;
  transcripts: LiveTranscript[];
  error: string | null;
  /** What the session credited — the per-learnable verdicts the grader's evidence earned through the
   *  shared firewall (server/live/grader.ts), the same verdicts a tap turn records on its student turn.
   *  Written by a second pass once grading finishes, so it is absent on a session that put no targets in
   *  play, produced no speech, credited nothing, or whose grade failed. */
  credit?: LearnableProgress[];
  /** Did this session agree to its data being kept. `false` marks the log for the retention sweep,
   *  which empties the transcript text and leaves the shape and the credit
   *  (server/assets/retention.ts). Omitted = kept. */
  retain?: boolean;
  /** When the sweep emptied this log's transcripts. Present only on a redacted log. */
  redactedAt?: string;
}

function dir(): string {
  return path.join(ASSET_DIR, "live");
}

export function write(log: LiveSessionLog): void {
  const d = dir();
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  writeFileSync(path.join(d, `${log.sessionId}.json`), JSON.stringify(log, null, 2));
}
