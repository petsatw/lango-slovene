// Front-end turn loop: push-to-talk capture -> POST /api/turn -> play native Slovenian reply.
// The push-to-talk gesture also unlocks mobile audio (iOS requires a user gesture).
// Everything observable is mirrored into the overlay so failures are visible, not mysterious.

const $ = (id) => document.getElementById(id);
const obs = {
  state: (s) => ($("obs-state").textContent = s),
  providers: (p) => ($("obs-providers").textContent = p),
  heard: (t) => ($("obs-heard").textContent = t || "—"),
  tutor: (t) => ($("obs-tutor").textContent = t || "—"),
  correction: (t) => ($("obs-correction").textContent = t || "—"),
  timings: (t) => ($("obs-timings").textContent = t || "—"),
  error: (t) => ($("obs-error").textContent = t || "—"),
};

const history = [];
let mediaRecorder = null;
let chunks = [];
let recMime = "audio/webm";
let lastE2Ms = 0;
let session = null;          // SessionState — objective progress, held client-side
let objectivesMeta = [];     // [{ id, label, targetSL }] from /api/config

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
  }
  return ""; // let the browser choose
}

function addBubble(role, text, sub) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;

  const span = document.createElement("span");
  span.className = "bubble-text";
  span.textContent = text;
  div.appendChild(span);

  // Tutor bubbles get a replay icon — re-streams the cached audio for that line.
  if (role === "tutor") {
    const replay = document.createElement("button");
    replay.className = "replay";
    replay.type = "button";
    replay.title = "Replay";
    replay.setAttribute("aria-label", "Replay this line");
    replay.textContent = "▶";
    replay.addEventListener("click", () => playReplyStreaming(text));
    div.appendChild(replay);
  }

  if (sub) {
    const s = document.createElement("small");
    s.textContent = sub;
    div.appendChild(s);
  }
  $("transcript").appendChild(div);
  div.scrollIntoView({ behavior: "smooth", block: "end" });
}

// Objective dots: pending ○ → recast ◐ → completed ●.
function renderObjectives() {
  const el = $("objectives");
  if (!el || !session) return;
  const sym = { pending: "○", recast: "◐", completed: "●" };
  el.innerHTML = "";
  for (const meta of objectivesMeta) {
    const st = (session.objectives.find((o) => o.id === meta.id) || {}).status || "pending";
    const chip = document.createElement("span");
    chip.className = `dot ${st}`;
    chip.textContent = `${sym[st]} ${meta.label}`;
    el.appendChild(chip);
  }
}

// End-of-session takeaway: the phrases the student completed, each replayable.
function showTakeaway() {
  const el = $("takeaway");
  if (!el) return;
  el.innerHTML = "<h2>Bravo! 🎉</h2><p>You can now do this in Slovenian:</p>";
  const list = document.createElement("div");
  for (const meta of objectivesMeta) {
    const row = document.createElement("div");
    row.className = "takeaway-row";
    const span = document.createElement("span");
    span.textContent = meta.targetSL;
    const btn = document.createElement("button");
    btn.className = "replay";
    btn.type = "button";
    btn.title = "Hear it";
    btn.textContent = "▶";
    btn.addEventListener("click", () => playReplyStreaming(meta.targetSL));
    row.appendChild(span);
    row.appendChild(btn);
    list.appendChild(row);
  }
  el.appendChild(list);
  el.hidden = false;
  $("talk").disabled = true;
  $("talk-label").textContent = "Session complete";
  el.scrollIntoView({ behavior: "smooth", block: "end" });
}

// Gemini accepts wav/mp3/aiff/aac/ogg/flac — NOT the webm (Chrome) or mp4 (Safari) that
// MediaRecorder produces. So decode the recording and re-encode to 16 kHz mono WAV before sending.
async function blobToWavBase64(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();

  const targetRate = 16000;
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetRate), targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering(); // mono, 16 kHz
  return wavBase64FromBuffer(rendered);
}

function wavBase64FromBuffer(buffer) {
  const samples = buffer.getChannelData(0);
  const sampleRate = buffer.sampleRate;
  const dataLen = samples.length * 2;
  const ab = new ArrayBuffer(44 + dataLen);
  const view = new DataView(ab);
  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLen, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);   // PCM chunk size
  view.setUint16(20, 1, true);    // PCM
  view.setUint16(22, 1, true);    // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);    // block align
  view.setUint16(34, 16, true);   // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataLen, true);

  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }

  const bytes = new Uint8Array(ab);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// Level 1 streaming playback: point an <audio> element at /api/speak; the browser streams and
// plays the mp3 progressively, so audio starts on the first chunk instead of after full synthesis.
async function playReplyStreaming(text) {
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = `/api/speak?text=${encodeURIComponent(text)}`;
  obs.state("speaking…");

  const t0 = performance.now();
  audio.addEventListener(
    "playing",
    () => {
      const ttfa = Math.round(performance.now() - t0);
      obs.timings(`e2=${lastE2Ms}ms  audio-start=${ttfa}ms`);
    },
    { once: true },
  );
  audio.onended = () => obs.state("idle");
  audio.onerror = () => { obs.state("error"); obs.error("audio stream failed"); };

  try {
    await audio.play();
    $("play-fallback").hidden = true;
  } catch {
    // Autoplay blocked — offer a one-tap fallback (still satisfies the gesture requirement).
    const btn = $("play-fallback");
    btn.hidden = false;
    btn.onclick = () => { audio.play(); btn.hidden = true; };
  }
}

async function startRecording() {
  obs.error("");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recMime = pickMimeType();
  mediaRecorder = recMime ? new MediaRecorder(stream, { mimeType: recMime }) : new MediaRecorder(stream);
  recMime = mediaRecorder.mimeType || recMime || "audio/webm";
  chunks = [];
  mediaRecorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  mediaRecorder.start();
  obs.state("recording");
  $("talk").classList.add("recording");
  $("talk-label").textContent = "Listening…";
}

async function stopRecordingAndSend() {
  if (!mediaRecorder) return;
  $("talk").classList.remove("recording");
  $("talk-label").textContent = "Hold to speak";

  const done = new Promise((resolve) => (mediaRecorder.onstop = resolve));
  mediaRecorder.stop();
  mediaRecorder.stream.getTracks().forEach((t) => t.stop());
  await done;

  const blob = new Blob(chunks, { type: recMime });
  if (blob.size < 1200) { obs.state("idle"); return; } // ignore accidental taps

  obs.state("understanding…");
  try {
    const audioBase64 = await blobToWavBase64(blob);
    const res = await fetch("/api/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64, mimeType: "audio/wav", history, session }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    lastE2Ms = data.timings.e2Ms;
    obs.heard(data.userVerbatim || data.userSaid);
    obs.tutor(data.tutorReply);
    obs.correction(data.correction);
    obs.timings(`e2=${data.timings.e2Ms}ms  audio streaming…`);

    // Show what the tutor actually heard (verbatim), with the English interpretation beneath.
    addBubble("user", data.userVerbatim || data.userSaid, data.userSaid ? `≈ ${data.userSaid}` : "");
    addBubble("tutor", data.tutorReply, data.correction ? `↳ ${data.correction}` : "");
    history.push({ role: "user", text: data.userSaid });
    history.push({ role: "tutor", text: data.tutorReply });

    // Update objective progress from the server's authoritative session state.
    session = data.session;
    renderObjectives();

    // Text is on screen now; audio streams in and starts on the first chunk.
    await playReplyStreaming(data.tutorReply);

    if (session && session.complete) showTakeaway();
  } catch (err) {
    obs.state("error");
    obs.error(err.message);
  }
}

async function init() {
  try {
    const cfg = await (await fetch("/api/config")).json();
    $("scenario").textContent = cfg.scenario.title;
    obs.providers(`${cfg.providers.e2} + ${cfg.providers.e3}`);
    objectivesMeta = cfg.scenario.objectives || [];
    session = cfg.session || null;
    renderObjectives();
    if (cfg.scenario.opening) addBubble("tutor", cfg.scenario.opening);
  } catch (err) {
    obs.error(`config: ${err.message}`);
  }

  const btn = $("talk");
  btn.disabled = false;
  // Pointer events cover mouse + touch with one path.
  btn.addEventListener("pointerdown", async (e) => {
    e.preventDefault();
    try { await startRecording(); }
    catch (err) { obs.state("error"); obs.error(`mic: ${err.message}`); }
  });
  const stop = (e) => { e.preventDefault(); stopRecordingAndSend(); };
  btn.addEventListener("pointerup", stop);
  btn.addEventListener("pointercancel", stop);
  btn.addEventListener("pointerleave", stop);
}

init();
