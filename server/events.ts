// Core-journey events: POST /api/event validates a client batch and appends one JSONL row per event to
// DATA_DIR/events/events.jsonl, stamped with the learner. The server's own live events use the same row.
// Spec: docs/features/events/spec.md. Best-effort: a write failure never breaks the request it rides on.

import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type express from "express";
import { DATA_DIR } from "./assets/store";

const DIR = path.join(DATA_DIR, "events");
export const EVENTS_PATH = path.join(DIR, "events.jsonl");

const MAX_EVENTS = 50;
const MAX_BYTES = 16 * 1024;
const MAX_VALUE = 64;
const MAX_TEXT = 1000;

/** Event name → the prop keys it may carry (spec §4). */
const EVENTS: Record<string, string[]> = {
  app_open: ["standalone", "isFirstOpen", "path"],
  tester_code_seen: [],
  screen_viewed: ["screen"],
  intro_completed: ["kind", "id"],
  intro_quit: ["kind", "id"],
  level_started: ["scenarioId", "level"],
  level_completed: ["scenarioId", "level", "ms"],
  level_abandoned: ["scenarioId", "level", "ms", "nodeId"],
  handoff_tapped: ["from"],
  gate_passed: ["via"],
  live_started: ["lessonId", "provider", "noSave"],
  live_ended: ["lessonId", "provider", "sec", "reason"],
  live_failed: ["lessonId", "provider", "reason"],
  finder_query: ["resultCount"],
  finder_no_match: [],
  finder_match_opened: ["scenarioId"],
  feedback_submitted: ["surface", "rating", "hasText"],
};

type Who = { learnerId: string; testerCode: string | null };
type Prop = string | number | boolean | null;

function cleanProps(name: string, raw: unknown): Record<string, Prop> {
  const props: Record<string, Prop> = {};
  if (!raw || typeof raw !== "object") return props;
  for (const key of EVENTS[name] ?? []) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === "string") props[key] = v.slice(0, MAX_VALUE);
    else if (typeof v === "number" && Number.isFinite(v)) props[key] = v;
    else if (typeof v === "boolean" || v === null) props[key] = v;
  }
  return props;
}

function append(rows: object[]): void {
  if (!rows.length) return;
  try {
    mkdirSync(DIR, { recursive: true });
    appendFileSync(EVENTS_PATH, rows.map((r) => JSON.stringify(r) + "\n").join(""));
  } catch (err: any) {
    console.error("[events] write failed:", err?.message);
  }
}

/** The server's own events (gate_passed, live_*): same row, stamped from the learner it already holds. */
export function emit(name: string, who: Who, props: Record<string, Prop>): void {
  if (!Object.hasOwn(EVENTS, name)) return;
  append([{ name, ts: new Date().toISOString(), ...who, props: cleanProps(name, props) }]);
}

/** A client batch, stamped with the learner the route resolved (`learnerOf` / `testerCodeOf`). */
export function handle(req: express.Request, res: express.Response, who: Who): void {
  const events = req.body?.events;
  if (!Array.isArray(events)) return void res.status(400).json({ error: "events required" });
  if (events.length > MAX_EVENTS || Buffer.byteLength(JSON.stringify(req.body)) > MAX_BYTES) {
    return void res.status(413).json({ error: "too many events" });
  }
  const rows: object[] = [];
  for (const e of events) {
    if (!e || typeof e.name !== "string" || !Object.hasOwn(EVENTS, e.name)) continue;
    const t = new Date(e.ts);
    const row: Record<string, unknown> = {
      name: e.name,
      ts: (Number.isNaN(t.getTime()) ? new Date() : t).toISOString(),
      ...who,
      props: cleanProps(e.name, e.props),
    };
    if (e.name === "feedback_submitted" && typeof e.text === "string") row.text = e.text.slice(0, MAX_TEXT);
    rows.push(row);
  }
  append(rows);
  res.status(204).end();
}
