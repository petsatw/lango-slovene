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
const OUT_RATE = 24000; // what we receive, and the rate the one AudioContext runs at
const FRAME_MS = 100;

// The learner's own speech has to be able to cut the tutor off mid-sentence — that is what makes it a
// conversation rather than a lecture with a queue. We do it locally on mic energy rather than waiting
// for the server to report an interruption, because a round trip is exactly the delay that makes
// talking over someone feel broken.
//
// It is deliberately hard to trigger. The first run had the tutor cutting ITSELF off: the mic heard the
// speakers, and every tutor line died a word in. Echo cancellation (below) is the real fix; these
// numbers are the second line of defence, and they err toward letting the tutor finish.
const BARGE_RMS = 0.12;
const BARGE_FRAMES = 4; // ~400 ms of sustained speech before the tutor is cut off
const FADE_MS = 60; // never stop a buffer dead — a cut mid-sample is an audible click

// HALF DUPLEX. While the tutor is speaking we stop SENDING the mic upstream — we keep listening to it
// locally for barge-in, but nothing leaves the browser. Echo cancellation alone did not hold: session
// logs showed the tutor's own line coming back as the learner's 600 ms later ("Začnemo?" → "Začnimo."),
// which then fed the vendor its own words as conversation. The surest way not to transmit the echo is
// not to transmit. The tail covers the speaker ringing on after the last sample.
const DUPLEX_TAIL_MS = 250;

// Nothing is sent until the learner has actually made a sound since the tutor stopped. Feeding a
// transcriber pure room tone makes it invent — a 22-second silence came back as "I know." Once speech
// starts the stream is continuous again, so the vendor's own VAD still sees a whole utterance.
const SPEECH_RMS = 0.02;

let ws = null;
let micStream = null;
let audioCtx = null; // ONE context for capture and playback — see startLive
let playGain = null;
let playhead = 0;
let playing = new Set(); // scheduled sources, so barge-in can stop what has not been heard yet
let loudFrames = 0;
let muteUntil = 0; // context-time until which the upstream stays closed (half duplex tail)
let speechStarted = false; // has the learner made a sound since the tutor stopped?
let listeners = {};

// The tutor's speech is kept, per utterance, so ▶ on a bubble replays THE LINE THE LEARNER HEARD.
// Nothing else can: this audio is improvised by the live vendor in the vendor's own voice and never
// reaches /api/speak, so re-synthesising the text bills a fresh ElevenLabs call and answers in a
// different voice. Chunks carry no id — the association is made here, from the two facts the stream
// does give us: chunks belong to the most recent tutor transcript id, and a drained playback queue
// means that utterance is over and the next chunk starts a new one.
const utterances = new Map(); // transcript id → Int16Array[]
let unclaimed = []; // audio that arrived before its transcript line did
let speakingId = null; // the utterance chunks are currently being filed under
let replayCtx = null; // outlives the session: a bubble is still replayable after the tutor hangs up

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
  if (!audioCtx || !playGain) return;

  // Nothing left to hear means the previous utterance finished, so this chunk opens a new one and
  // waits to be claimed by whichever transcript id names it.
  if (!stillSpeaking()) speakingId = null;
  if (speakingId) utterances.get(speakingId).push(pcm16);
  else unclaimed.push(pcm16);

  const frames = pcm16.length;
  const buf = audioCtx.createBuffer(1, frames, OUT_RATE);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) ch[i] = pcm16[i] / 0x8000;

  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.connect(playGain);
  const startAt = Math.max(audioCtx.currentTime, playhead);
  src.start(startAt);
  playhead = startAt + frames / OUT_RATE;
  playing.add(src);
  src.onended = () => playing.delete(src);
}

// A tutor line names the audio arriving around it. A revision carries the SAME id, so it claims
// nothing twice; only a genuinely new utterance takes over the filing.
function claimAudio(id) {
  if (speakingId === id) return;
  speakingId = id;
  const held = utterances.get(id) || [];
  utterances.set(id, held.concat(unclaimed));
  unclaimed = [];
}

/** Is there retained audio for this utterance? The ▶ on a live bubble is drawn only if there is. */
export function hasLiveAudio(id) {
  const chunks = utterances.get(id);
  return !!chunks && chunks.length > 0;
}

/** Replay one tutor utterance from the audio the learner actually heard. Free, correct voice, no
 *  server hop — and it keeps working after the session has ended, which is when a learner reviewing
 *  the transcript will reach for it. */
export async function playLiveUtterance(id) {
  const chunks = utterances.get(id);
  if (!chunks || !chunks.length) return false;

  replayCtx = replayCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (replayCtx.state === "suspended") await replayCtx.resume();

  const total = chunks.reduce((n, c) => n + c.length, 0);
  // Authored at the stream's rate whatever the context runs at — Web Audio resamples on playback.
  const buf = replayCtx.createBuffer(1, total, OUT_RATE);
  const ch = buf.getChannelData(0);
  let off = 0;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++) ch[off + i] = c[i] / 0x8000;
    off += c.length;
  }
  const src = replayCtx.createBufferSource();
  src.buffer = buf;
  src.connect(replayCtx.destination);
  src.start();
  return true;
}

/** True while there is tutor audio still to be heard — the scheduled queue reaching past now. Note
 *  this is NOT "the vendor is still generating": generation finishes long before playback does, which
 *  is why nothing may stop playback on a `state` message. */
function stillSpeaking() {
  return !!audioCtx && playhead > audioCtx.currentTime;
}

/** Tutor speech is audible right now. The surface draws "he is talking" from this rather than from a
 *  `state` message: generation finishes long before playback does, so the vendor's own "listening"
 *  arrives while the learner is still hearing the previous sentence. */
export const liveSpeaking = () => stillSpeaking();

// Barge-in only. A hard stop mid-buffer clicks, so the gain is ramped down first and the sources are
// dropped after it lands — the tutor ducks out rather than being chopped.
function stopPlayback() {
  if (!audioCtx || !playGain) return;
  const now = audioCtx.currentTime;
  playGain.gain.cancelScheduledValues(now);
  playGain.gain.setValueAtTime(playGain.gain.value, now);
  playGain.gain.linearRampToValueAtTime(0, now + FADE_MS / 1000);

  const dying = [...playing];
  playing.clear();
  playhead = 0;
  setTimeout(() => {
    for (const src of dying) {
      try {
        src.stop();
      } catch {
        /* already finished */
      }
    }
    // Back to full volume for whatever the tutor says next.
    if (audioCtx && playGain) playGain.gain.setValueAtTime(1, audioCtx.currentTime);
  }, FADE_MS + 20);
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

  // ONE AudioContext for both directions. This is not tidiness — it is what makes echo cancellation
  // work. On two contexts the browser has no reliable reference for what it is playing, so the mic
  // hears the tutor, the vendor transcribes the tutor's own words as the learner, and barge-in cuts the
  // tutor off a word in. All three happened on the first real session. It runs at the PLAYBACK rate
  // and the mic is resampled down to 16 kHz on the way out, since only playback needs its rate exact.
  audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: OUT_RATE });
  playGain = audioCtx.createGain();
  playGain.gain.value = 1;
  playGain.connect(audioCtx.destination);
  playhead = 0;
  loudFrames = 0;
  muteUntil = 0;
  speechStarted = false;
  // Retained audio is per session, like the transcript ids that address it.
  utterances.clear();
  unclaimed = [];
  speakingId = null;

  await audioCtx.audioWorklet.addModule("/live-capture-worklet.js");
  const frameSize = Math.round((audioCtx.sampleRate * FRAME_MS) / 1000);
  const node = new AudioWorkletNode(audioCtx, "live-capture", { processorOptions: { frameSize } });
  audioCtx.createMediaStreamSource(micStream).connect(node);
  // The worklet must be pulled by the graph to run, but nothing should be heard: a zero-gain sink
  // keeps it alive without routing the learner's own voice back at them.
  const sink = audioCtx.createGain();
  sink.gain.value = 0;
  node.connect(sink).connect(audioCtx.destination);

  ws = new WebSocket(data.wsUrl);
  ws.binaryType = "arraybuffer";

  node.port.onmessage = (e) => {
    const raw = new Float32Array(e.data);

    // Barge-in, measured on the pre-resample signal: sustained speech while the tutor is talking stops
    // the tutor. The vendor's own VAD will reach the same conclusion a moment later; this just spares
    // the learner the moment. Held to a high bar on purpose — see BARGE_RMS.
    if (stillSpeaking()) {
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

    // Half duplex: while the tutor is audible (plus a tail), send nothing. Barge-in above has already
    // had its look at this frame, so talking over him still works — it just cuts him off first, which
    // ends the tutor-speaking window and reopens the upstream.
    const now = audioCtx.currentTime;
    if (stillSpeaking()) {
      muteUntil = now + DUPLEX_TAIL_MS / 1000;
      speechStarted = false; // the next utterance has to announce itself again
      return;
    }
    if (now < muteUntil) return;

    if (!speechStarted) {
      if (rms(raw) < SPEECH_RMS) return; // room tone — do not feed the transcriber
      speechStarted = true;
    }

    const pcm = toPcm16(toRate(raw, audioCtx.sampleRate, IN_RATE));
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
    // Carries an id: a later message with the same id REVISES that line rather than adding one.
    if (msg.type === "transcript") {
      if (msg.role === "tutor") claimAudio(msg.id);
      emit("transcript", msg);
    }
    else if (msg.type === "state") {
      // NOTHING here may touch playback. "listening" means the vendor finished GENERATING, which
      // happens well before the audio it generated has been heard — stopping on it truncated every
      // tutor line in the first real session. Only barge-in cuts the tutor off.
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
  audioCtx?.close().catch(() => {});
  audioCtx = null;
  playGain = null;
}

export const liveActive = () => !!ws;
