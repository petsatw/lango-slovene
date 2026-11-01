// Team readout: GET /v1/team/events returns event rows and live session summaries behind TEAM_READ_KEY.
// Spec: docs/features/team-readout/spec.md. Read-only; holds no transcripts.

import { createHash, timingSafeEqual } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { DATA_DIR } from "./assets/store";
import { EVENTS_PATH } from "./events";
import { LEARNABLES } from "./learnables";

export const teamRouter = Router();

const SETTLE_MS = 300_000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const SESSION_TTL_SEC = Number(process.env.SESSION_TTL_SEC || 600);

const sha = (s: string) => createHash("sha256").update(s).digest();
const windows = new Map<string, { start: number; n: number }>();

type Row = Record<string, unknown> & { ts: string };
type Keyed = { ts: string; k: string; row: Row };

function eventRows(): Keyed[] {
  let text: string;
  try {
    text = readFileSync(EVENTS_PATH, "utf8");
  } catch {
    return [];
  }
  const seen = new Map<string, number>();
  const out: Keyed[] = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    const base = createHash("sha256").update(line).digest("hex");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    let e: any;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (!e || typeof e !== "object" || typeof e.ts !== "string" || Number.isNaN(Date.parse(e.ts))) continue;
    const row: Row = {
      kind: "event",
      name: e.name,
      ts: e.ts,
      learnerId: e.learnerId,
      tester: e.testerCode != null,
      props: e.props,
    };
    if (e.name === "feedback_submitted" && typeof e.text === "string") row.text = e.text;
    out.push({ ts: e.ts, k: `${base}#${n}`, row });
  }
  return out;
}

function liveRows(): Keyed[] {
  const dir = path.join(DATA_DIR, "live");
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }
  const out: Keyed[] = [];
  for (const f of files) {
    if (!/^[0-9a-f-]{36}\.json$/.test(f)) continue;
    let l: any;
    try {
      l = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    } catch {
      continue;
    }
    if (!l || l.noSave === true || typeof l.endedAt !== "string" || Number.isNaN(Date.parse(l.endedAt))) continue;
    const secs = (Date.parse(l.endedAt) - Date.parse(l.startedAt)) / 1000;
    const row: Row = {
      kind: "live_session",
      ts: l.endedAt,
      sessionId: l.sessionId,
      learnerId: l.learnerId,
      tester: l.testerCode != null,
      lessonId: l.lessonId,
      provider: l.provider,
      start: l.startedAt,
      end: l.endedAt,
      reason: l.error ? "error" : secs >= SESSION_TTL_SEC ? "ttl" : "user",
      error: l.error ?? null,
      progressed: Array.isArray(l.progressed)
        ? l.progressed.map((id: string) => ({ id, name: LEARNABLES[id]?.sl ?? id }))
        : null,
    };
    out.push({ ts: l.endedAt, k: `live:${l.sessionId}`, row });
  }
  return out;
}

const after = (a: { ts: string; k: string }, b: { ts: string; k: string }) =>
  a.ts !== b.ts ? a.ts > b.ts : a.k > b.k;

teamRouter.get("/v1/team/events", (req, res, next) => {
  // Express routes HEAD to a GET handler; the readout is GET only (spec §1), so HEAD falls through to 404.
  if (req.method !== "GET") return next();
  const key = process.env.TEAM_READ_KEY;
  const auth = req.get("authorization");
  if (!key || !auth || !auth.startsWith("Bearer ")) return next();
  const digest = sha(auth.slice(7));
  if (!timingSafeEqual(digest, sha(key))) return next();

  const id = digest.toString("hex");
  const now = Date.now();
  let w = windows.get(id);
  if (!w || now - w.start >= WINDOW_MS) windows.set(id, (w = { start: now, n: 0 }));
  if (++w.n > MAX_PER_WINDOW) {
    res.set("Retry-After", String(Math.max(1, Math.ceil((w.start + WINDOW_MS - now) / 1000))));
    return void res.status(429).json({ error: "rate limit" });
  }

  const q = req.query;
  const bad = (p: string) => res.status(400).json({ error: p });
  let limit = 500;
  if (q.limit !== undefined) {
    if (typeof q.limit !== "string" || !/^-?\d+$/.test(q.limit) || Number(q.limit) < 1) return void bad("limit");
    limit = Math.min(Number(q.limit), 1000);
  }
  let since = -Infinity;
  if (q.since !== undefined) {
    since = typeof q.since === "string" ? Date.parse(q.since) : NaN;
    if (Number.isNaN(since)) return void bad("since");
  }
  let cursor: { ts: string; k: string } | null = null;
  if (q.cursor !== undefined) {
    try {
      const c = JSON.parse(Buffer.from(String(q.cursor), "base64url").toString("utf8"));
      if (typeof c?.ts !== "string" || typeof c?.k !== "string" || Number.isNaN(Date.parse(c.ts))) throw new Error("shape");
      cursor = { ts: c.ts, k: c.k };
    } catch {
      return void bad("cursor");
    }
  }

  try {
    const cutoff = now - SETTLE_MS;
    const rows = [...eventRows(), ...liveRows()]
      .filter((r) => Date.parse(r.ts) <= cutoff && Date.parse(r.ts) >= since && (!cursor || after(r, cursor)))
      .sort((a, b) => (a.ts === b.ts ? (a.k < b.k ? -1 : 1) : a.ts < b.ts ? -1 : 1));
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const next = last
      ? Buffer.from(JSON.stringify({ ts: last.ts, k: last.k })).toString("base64url")
      : typeof q.cursor === "string"
        ? q.cursor
        : null;
    res.set("Cache-Control", "no-store").json({ rows: page.map((r) => r.row), next, more: rows.length > page.length });
  } catch (err: any) {
    console.error("[team] readout failed:", err?.message);
    res.status(500).json({ error: "readout failed" });
  }
});
