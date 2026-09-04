// Pending live sessions, and the two ceilings that stand in for authentication.
//
// There are no accounts here (the learner model is single-learner, no login), and for the internal
// provider bake-off there don't need to be. What has to be true is narrower: a stranger who finds the
// URL cannot open a metered vendor socket, and no single run can bill unbounded. So:
//
//   - an ACCESS CODE gates the create call (one shared string, internal testers),
//   - a one-use short-lived TOKEN is what the WebSocket actually presents (the URL alone is useless),
//   - a TTL caps one session's minutes and a CONCURRENCY cap bounds simultaneous ones.
//
// These are the server's own ceilings. The real backstop is a provider-side spend cap, which lives in
// the vendor console and not in this file — a cap that only exists in our code is a cap we can bypass.

import { randomUUID, randomBytes, timingSafeEqual } from "node:crypto";
import type { LiveProvider } from "./types";

export const SESSION_TTL_SEC = Number(process.env.SESSION_TTL_SEC || 600);
export const MAX_CONCURRENT = Number(process.env.LIVE_MAX_CONCURRENT || 3);

/** Issued but not yet connected. A token is redeemed exactly once, by the WS upgrade. */
interface PendingSession {
  sessionId: string;
  token: string;
  lessonId: string;
  provider: LiveProvider;
  /** Whose palette the prompt is built from, and whose sitting the log belongs to. */
  learnerId: string;
  /** The sitting this session belongs to — the same id the tap-to-speak turns are recorded under, so
   *  the two modes can be lined up afterwards (server/scripts/runs.ts). */
  runId: string | null;
  expiresAt: number;
}

const pending = new Map<string, PendingSession>();
/** Sessions with a live vendor socket. Counted for the concurrency cap; cleared on teardown. */
const active = new Set<string>();

export function accessCodeOk(supplied: unknown): boolean {
  const expected = process.env.LIVE_ACCESS_CODE || "";
  if (!expected) return false; // unset = the live surface is closed, not open to everyone
  if (typeof supplied !== "string" || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

/** A tester may name the provider; everyone else gets the configured one. With an internal-only group
 *  this is on by default — running the SAME learner through both vendors back to back is exactly the
 *  comparison we want, and a restart between runs would only add noise. */
export function resolveProvider(requested: unknown): LiveProvider {
  const configured = (process.env.LIVE_PROVIDER || "gemini") as LiveProvider;
  if (requested === "gemini" || requested === "grok") return requested;
  return configured === "grok" ? "grok" : "gemini";
}

function sweep(): void {
  const now = Date.now();
  for (const [token, s] of pending) if (s.expiresAt <= now) pending.delete(token);
}

export function atCapacity(): boolean {
  sweep();
  return active.size + pending.size >= MAX_CONCURRENT;
}

export function create(args: {
  lessonId: string;
  provider: LiveProvider;
  learnerId: string;
  runId: string | null;
}): PendingSession {
  sweep();
  const s: PendingSession = {
    sessionId: randomUUID(),
    token: randomBytes(24).toString("base64url"),
    lessonId: args.lessonId,
    provider: args.provider,
    learnerId: args.learnerId,
    runId: args.runId,
    // The token has to survive only the round trip from the create call to the WS open, so it expires
    // far sooner than the session it authorizes.
    expiresAt: Date.now() + 60_000,
  };
  pending.set(s.token, s);
  return s;
}

/** One-use: redeeming removes it, so a replayed URL fails even inside the 60 s window. */
export function redeem(token: string | undefined): PendingSession | null {
  sweep();
  if (!token) return null;
  const s = pending.get(token);
  if (!s) return null;
  pending.delete(token);
  return s;
}

export function markActive(sessionId: string): void {
  active.add(sessionId);
}

export function markEnded(sessionId: string): void {
  active.delete(sessionId);
}
