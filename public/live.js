// The live tutor: continuous speech, both directions, over one WebSocket.
//
// This is a different animal from the push-to-talk surface next door. Push-to-talk records a whole
// utterance, re-encodes it, and POSTs it; nothing streams and the round trip is the unit. Here the mic
// runs continuously as ~100 ms PCM16 frames, the tutor's voice arrives as PCM16 while it is still being
// spoken, and the learner can talk over it. So this file owns three things the rest of the app has
// never needed: a capture worklet, a scheduled playback queue, and barge-in.
//
// It knows nothing about which vendor is answering. The server does not say, and there is no message
// in the protocol that would let it — that is the point of the comparison.

const IN_RATE = 16000; // what we send: PCM16 LE mono
const OUT_RATE = 24000; // what we receive
const FRAME_MS = 100;

// The learner's own speech has to be able to cut the tutor off mid-sentence — that is what makes it a
// conversation rather than a lecture with a queue. We do it locally on mic energy rather than waiting
// for the server to report an interruption, because a round trip is exactly the delay that makes
// talking over someone feel broken.
const BARGE_RMS = 0.045;
const BARGE_FRAMES = 2; // ~200 ms of speech, so a cough or a keystroke does not cut the tutor off

let ws = null;
let micStream = null;
let captureCtx = null;
let playCtx = null;
let playhead = 0;
let playing = new Set(); // scheduled sources, so barge-in can stop what has not been heard yet
let loudFrames = 0;
let listeners = {};

const isOpen = () => ws && ws.readyState === WebSocket.OPEN;

function emit(event, detail) {
  (listeners[event] || []).forEach((fn) => fn(detail));
}

export function onLive(event, fn) {
  (listeners[event] = listeners[event] || []).push(fn);
}

// ---- format ----

// Linear resample to 16 kHz. Most browsers honour an AudioContext sampleRate of 16000 and this is a
// no-op; Safari has historically ignored it, and a silently-wrong rate would reach the vendor as a
// chipmunk the transcriber cannot read — so the conversion is unconditional and cheap.
function toRate(samples, from, to) {
  if (from === to) return samples;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const pos = i * ratio;
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, samples.length - 1);
    out[i] = samples[lo] + (samples[hi] - samples[lo]) * (pos - lo);
  }
  return out;
}

function toPcm16(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

// ---- playback ----

// Tutor audio arrives faster than real time and in fragments, so each chunk is scheduled to start where
// the last one ended rather than played on arrival. `playhead` is that seam; when it falls behind the
// context clock (a gap in the stream) it resets to now, which is what keeps a pause from compounding.
function playChunk(pcm16) {
  if (!playCtx) return;
  const frames = pcm16.length;
  const buf = playCtx.createBuffer(1, frames, OUT_RATE);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) ch[i] = pcm16[i] / 0x8000;

  const src = playCtx.createBufferSource();
  src.buffer = buf;
  src.connect(playCtx.destination);
  const startAt = Math.max(playCtx.currentTime, playhead);
  src.start(startAt);
  playhead = startAt + frames / OUT_RATE;
  playing.add(src);
  src.onended = () => playing.delete(src);
}

function stopPlayback() {
  for (const src of playing) {
    try {
      src.stop();
    } catch {
      /* already finished */
    }
  }
  playing.clear();
  playhead = 0;
}

// ---- session ----

export async function startLive({ lessonId, accessCode, provider }) {
  if (ws) return; // one live session per tab, by construction

  const res = await fetch("/v1/live/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lessonId, accessCode, provider }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

  // Echo cancellation is not optional here: the mic is open while the tutor is speaking through the
  // speakers, and without it the tutor hears itself and answers itself.
  micStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

  captureCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: IN_RATE });
  playCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: OUT_RATE });
  playhead = 0;
  loudFrames = 0;

  await captureCtx.audioWorklet.addModule("/live-capture-worklet.js");
  const frameSize = Math.round((captureCtx.sampleRate * FRAME_MS) / 1000);
  const node = new AudioWorkletNode(captureCtx, "live-capture", { processorOptions: { frameSize } });
  captureCtx.createMediaStreamSource(micStream).connect(node);
  // The worklet must be pulled by the graph to run, but nothing should be heard: a zero-gain sink
  // keeps it alive without routing the learner's own voice back at them.
  const sink = captureCtx.createGain();
  sink.gain.value = 0;
  node.connect(sink).connect(captureCtx.destination);

  ws = new WebSocket(data.wsUrl);
  ws.binaryType = "arraybuffer";

  node.port.onmessage = (e) => {
    const raw = new Float32Array(e.data);

    // Barge-in, measured on the pre-resample signal: sustained speech while the tutor is talking stops
    // the tutor. The vendor's own VAD will reach the same conclusion a moment later; this just spares
    // the learner the moment.
    if (playing.size > 0) {
      loudFrames = rms(raw) > BARGE_RMS ? loudFrames + 1 : 0;
      if (loudFrames >= BARGE_FRAMES) {
        stopPlayback();
        loudFrames = 0;
        emit("state", "listening");
      }
    } else {
      loudFrames = 0;
    }

    if (!isOpen()) return;
    const pcm = toPcm16(toRate(raw, captureCtx.sampleRate, IN_RATE));
    ws.send(pcm.buffer);
  };

  ws.onmessage = (e) => {
    if (typeof e.data !== "string") {
      playChunk(new Int16Array(e.data));
      return;
    }
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    if (msg.type === "transcript") emit("transcript", msg);
    else if (msg.type === "state") {
      // The server saying "listening" means the tutor's turn is over — anything still queued is stale.
      if (msg.status === "listening") stopPlayback();
      emit("state", msg.status);
    } else if (msg.type === "error") emit("error", msg.code);
  };

  ws.onclose = () => {
    teardown();
    emit("state", "ended");
  };
  ws.onerror = () => emit("error", "vendor_connect");

  return { sessionId: data.sessionId, ttlSec: data.ttlSec };
}

export function stopLive() {
  if (isOpen()) ws.send(JSON.stringify({ type: "end" }));
  teardown();
}

function teardown() {
  stopPlayback();
  try {
    ws?.close();
  } catch {
    /* already closing */
  }
  ws = null;
  micStream?.getTracks().forEach((t) => t.stop());
  micStream = null;
  captureCtx?.close().catch(() => {});
  playCtx?.close().catch(() => {});
  captureCtx = null;
  playCtx = null;
}

export const liveActive = () => !!ws;
