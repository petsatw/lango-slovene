// Thin backend: holds keys (from .env), runs the turn loop, serves the PWA.
// The browser only ever calls these /api endpoints — keys never leave this process.
//
// Level 1 streaming: /api/turn returns the tutor text fast (E2 only); /api/speak streams the
// Slovenian audio (E3) so the browser plays it progressively, starting on the first chunk.

import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { understand } from "./orchestrator";
import { getE2, getE3 } from "./adapters/index";
import * as store from "./assets/store";
import { CAFE, SCENARIOS, freshSession } from "./scenarios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// L1: a small in-memory LRU of hot clips. L2 (the source of truth) is the persistent disk store
// (server/assets/store.ts), which survives restarts. L1 is just to skip a disk read on hot replays;
// it's wiped on restart, after which L2 serves the same bytes for free — no re-synthesis, no re-billing.
const audioCache = new Map<string, Buffer>();
const AUDIO_CACHE_MAX = 200;

function cachePut(key: string, buf: Buffer): void {
  if (audioCache.has(key)) return;
  if (audioCache.size >= AUDIO_CACHE_MAX) {
    const oldest = audioCache.keys().next().value;
    if (oldest) audioCache.delete(oldest);
  }
  audioCache.set(key, buf);
}

// Audio clips arrive as base64 JSON — allow a generous body size.
app.use(express.json({ limit: "25mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// Active providers, the scenario (with objectives for the dots + a fresh session), and the
// scenario list (active + PLANNED) for the future selector. NO keys — safe for the client.
app.get("/api/config", (_req, res) => {
  res.json({
    providers: { e2: getE2().name, e3: getE3().name },
    scenario: {
      id: CAFE.id,
      title: CAFE.title,
      opening: CAFE.opening,
      objectives: CAFE.objectives.map((o) => ({ id: o.id, label: o.label, targetSL: o.targetSL })),
    },
    session: freshSession(CAFE),
    scenarios: SCENARIOS.map((s) => ({ id: s.id, title: s.title, status: s.status })), // PLANNED selector
  });
});

// Liveness only. Does not touch providers or keys.
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// One conversational turn — E2 only. Returns text fast; audio is fetched from /api/speak.
app.post("/api/turn", async (req, res) => {
  const { audioBase64, mimeType, history, session } = req.body ?? {};
  if (!audioBase64 || !mimeType) {
    return res.status(400).json({ error: "audioBase64 and mimeType are required" });
  }
  try {
    const result = await understand({
      audioBase64,
      mimeType,
      history: Array.isArray(history) ? history : [],
      session,
    });
    res.json(result);
  } catch (err: any) {
    console.error("[turn] failed:", err?.message);
    res.status(502).json({ error: err?.message || "turn failed" });
  }
});

// Stream the tutor's Slovenian audio progressively (Level 1), with persistent caching for replay.
// GET so an <audio> element can stream it natively. Text is short so the query param is fine.
// Lookup: L1 in-memory → L2 disk store. On a miss we stream from the provider AND persist the bytes
// to the store, so every later request for the same text is served free — even after a restart.
app.get("/api/speak", async (req, res) => {
  const text = String(req.query.text || "");
  if (!text.trim()) return res.status(400).json({ error: "text is required" });

  const e3 = getE3();
  const key = store.audioKey(e3.name, e3.voiceTag, text);

  // Hit if it's hot in L1 or already on disk (the disk hit is what survives restart).
  const cached = audioCache.get(key) ?? store.read(key, "audio");
  if (cached) {
    cachePut(key, cached); // promote disk hit into L1 for the next replay
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Audio-Cache", "hit");
    return res.end(cached);
  }

  const meta = { provider: e3.name, voiceOrModel: e3.voiceTag, text };

  try {
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Audio-Cache", "miss");

    if (e3.stream) {
      // Tee: write each chunk to the client as it arrives AND buffer it to persist after streaming.
      const reader = (await e3.stream({ text })).getReader();
      const chunks: Buffer[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        chunks.push(chunk);
        res.write(chunk);
      }
      res.end();
      const buf = Buffer.concat(chunks);
      store.put(key, "audio", buf, meta);
      cachePut(key, buf);
    } else {
      // Provider without streaming: send + persist the full buffer.
      const { audioBase64 } = await e3.synthesize({ text });
      const buf = Buffer.from(audioBase64, "base64");
      store.put(key, "audio", buf, meta);
      cachePut(key, buf);
      res.end(buf);
    }
  } catch (err: any) {
    console.error("[speak] failed:", err?.message);
    if (!res.headersSent) res.status(502).json({ error: err?.message || "speak failed" });
    else res.end();
  }
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`▶ lango-slovenian demo on http://localhost:${port}`);
  console.log(`  E2=${process.env.E2_PROVIDER || "gemini"}  E3=${process.env.E3_PROVIDER || "elevenlabs"}`);
});
