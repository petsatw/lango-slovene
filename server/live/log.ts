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
}

function dir(): string {
  return path.join(ASSET_DIR, "live");
}

export function write(log: LiveSessionLog): void {
  const d = dir();
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  writeFileSync(path.join(d, `${log.sessionId}.json`), JSON.stringify(log, null, 2));
}
