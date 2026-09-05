// The live-tutor transport: one HTTP call to open a session, one WebSocket to speak through.
//
// The app's contract is frozen and provider-blind — PCM16 LE mono, 16 kHz up / 24 kHz down as binary
// frames, JSON text frames for control. Nothing in the messages the app sees names a vendor, and the
// create response deliberately does not say which one answered: the point of the bake-off is that the
// app binary is identical across both runs.
//
// This file owns the bridge and the ceilings. The vendors are behind ./adapters; the ceilings are in
// ./registry; the artifact is ./log.

import express from "express";
import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { getLiveAdapter, providerReady } from "./adapters/index";
import { buildLessonPrompt, lessonExists } from "./prompt";
import * as registry from "./registry";
import * as learner from "../assets/learner";
import * as retention from "../assets/retention";
import * as liveLog from "./log";
import { glossOf } from "./gloss";
import { creditSession } from "./grader";
import { keytermsFor } from "./match";
import type { LiveState, LiveErrorCode } from "./types";
import type { LiveTranscript } from "./log";
import type { Learnable } from "../learnables";

const WS_PATH = /^\/v1\/live\/sessions\/([0-9a-f-]{36})$/;

export const liveRouter = express.Router();

// Open a session. The response carries a wsUrl and NOT the provider — the app cannot know, and cannot
// accidentally start branching on, which vendor it is talking to.
liveRouter.post("/v1/live/sessions", (req, res) => {
  const { lessonId, accessCode, provider: requested, runId } = req.body ?? {};

  if (!registry.accessCodeOk(accessCode)) return res.status(403).json({ error: "forbidden" });
  if (typeof lessonId !== "string" || !lessonExists(lessonId)) {
    return res.status(400).json({ error: "unknown lessonId" });
  }
  // The cap is what keeps an unattended tab, or a tester who opens five, from running up minutes.
  if (registry.atCapacity()) return res.status(429).json({ error: "live sessions at capacity" });

  const provider = registry.resolveProvider(requested);
  if (!providerReady(provider)) return res.status(503).json({ error: "live tutor unavailable" });

  const s = registry.create({
    lessonId,
    provider,
    learnerId: learner.idFrom(req.get("x-learner-id")),
    runId: typeof runId === "string" && runId.trim() ? runId : null,
    retain: retention.retainFrom(req.get("x-retain")),
  });
  const host = req.get("host");
  const scheme = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "wss" : "ws";
  res.status(201).json({
    sessionId: s.sessionId,
    wsUrl: `${scheme}://${host}/v1/live/sessions/${s.sessionId}?token=${s.token}`,
    ttlSec: registry.SESSION_TTL_SEC,
  });
});

// Tap-to-reveal English for one transcript line. A GET so it caches and retries harmlessly; it takes no
// session, because a translation is not learner state. Catalog hits and cache hits bill nothing.
liveRouter.get("/api/gloss", async (req, res) => {
  const sl = String(req.query.sl ?? "").slice(0, 500);
  if (!sl.trim()) return res.status(400).json({ error: "sl required" });
  try {
    const { gloss, source } = await glossOf(sl, retention.retainFrom(req.get("x-retain")));
    res.json({ sl, gloss, source });
  } catch (err: any) {
    console.error("[gloss] failed:", err?.message);
    res.status(502).json({ error: "translation unavailable" });
  }
});

export function attachLive(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const match = WS_PATH.exec(url.pathname);
    if (!match) {
      socket.destroy(); // not ours — no other upgrade path exists on this server
      return;
    }

    // The token is redeemed here, once. A URL that reaches a second tab is already spent.
    const pending = registry.redeem(url.searchParams.get("token") ?? undefined);
    if (!pending || pending.sessionId !== match[1]) {
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => bridge(ws, pending));
  });
}

function bridge(ws: WebSocket, pending: ReturnType<typeof registry.redeem> & object): void {
  const { sessionId, lessonId, provider, learnerId, runId, retain } = pending;
  const startedAt = new Date().toISOString();
  const transcripts: LiveTranscript[] = [];
  /** id → the entry in `transcripts`, so a revision overwrites rather than appends. */
  const byId = new Map<string, LiveTranscript>();
  let failure: string | null = null;
  let done = false;
  // The prompt and the set it was built from, filled in below and read again by the grader at teardown.
  let instructions = "";
  let targets: Learnable[] = [];

  registry.markActive(sessionId);

  const sendJson = (msg: unknown) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  // Both the adapter and the teardown below can reach the same conclusion — a dead vendor socket ends
  // the session and also closes it — so the terminal frames are emitted through these two, which fire
  // once each. Without that the app receives the same "ended" twice and has to guess which is real.
  let errorSent = false;
  const state = (status: LiveState) => {
    if (status === "ended") return; // `ended` belongs to finish(), which is the one place a session ends
    sendJson({ type: "state", status });
  };
  const emitError = (code: LiveErrorCode) => {
    if (errorSent || code === "ended") return;
    errorSent = true;
    failure = code;
    sendJson({ type: "error", code }); // the code only — vendor error bodies stop here
  };

  const adapter = getLiveAdapter(provider, {
    onAudio: (pcm24k) => {
      if (!done && ws.readyState === WebSocket.OPEN) ws.send(pcm24k, { binary: true });
    },
    // An utterance revises itself, so the log keeps ONE entry per id and overwrites its text. The
    // timestamp stays the FIRST one — when the learner started speaking, not when the transcriber
    // finally settled — which is what makes the log readable as a conversation.
    onTranscript: (role, text, id, final) => {
      if (done) return;
      const seen = byId.get(id);
      if (seen) seen.text = text;
      else {
        const entry = { ts: new Date().toISOString(), role, text };
        byId.set(id, entry);
        transcripts.push(entry);
      }
      sendJson({ type: "transcript", role, text, id, final });
    },
    onState: (status) => {
      if (!done) state(status);
    },
    onError: (code: LiveErrorCode) => {
      if (!done) emitError(code);
    },
  });

  // The session ceiling. It is a hard stop rather than a warning: an abandoned tab with an open mic is
  // exactly the shape of an unattended bill, and the learner losing a session is the cheaper failure.
  const ttl = setTimeout(() => finish("ended"), registry.SESSION_TTL_SEC * 1000);

  function finish(code: LiveErrorCode): void {
    if (done) return;
    emitError(code); // no-op for a clean close, and never a second copy of one the adapter already sent
    done = true;
    clearTimeout(ttl);
    adapter.close();
    registry.markEnded(sessionId);
    const log = {
      sessionId,
      runId,
      lessonId,
      provider,
      startedAt,
      endedAt: new Date().toISOString(),
      transcripts,
      error: failure,
      ...(retain ? {} : { retain: false }),
    };
    try {
      liveLog.write(log);
    } catch (err: any) {
      console.error("[live] session log failed:", err?.message);
    }
    sendJson({ type: "state", status: "ended" });
    if (ws.readyState === WebSocket.OPEN) ws.close();

    // Crediting reads the transcript that was just written and moves the learner model. It starts only
    // once the socket is closed and the learner is gone: assessment is never on the hot path, and a
    // grade that fails is a session with no credit, not a session that hung.
    void creditSession({ learnerId, instructions, targets, log }).catch((err: any) =>
      console.error("[live] credit failed:", err?.message),
    );
  }

  ws.on("message", (data, isBinary) => {
    // Binary is mic audio: PCM16 LE mono 16 kHz, ~100 ms frames. Straight through to the vendor.
    if (isBinary) {
      adapter.sendPcm16(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
      return;
    }
    try {
      const msg = JSON.parse(data.toString());
      if (msg?.type === "end") finish("ended");
    } catch {
      /* a malformed control frame is not worth killing a session over */
    }
  });

  ws.on("close", () => finish("ended"));
  ws.on("error", () => finish("ended"));

  // The prompt is built here, per session, from the lesson and the CURRENT learner model — a session
  // opened after a mastery run sees the wider palette the learner earned. Built ONCE: unlike free chat,
  // which rebuilds every turn, a live session's targets are fixed for its whole length.
  try {
    const built = buildLessonPrompt(lessonId, learnerId);
    instructions = built.instructions;
    targets = built.targets;
  } catch (err: any) {
    console.error("[live] prompt build failed:", err?.message);
    failure = "vendor_setup";
    finish("vendor_setup");
    return;
  }

  adapter.connect(sessionId, instructions, keytermsFor(targets)).catch((err: any) => {
    console.error(`[live/${provider}] connect failed:`, err?.message);
    failure = failure || "vendor_connect";
    finish("vendor_connect");
  });
}
