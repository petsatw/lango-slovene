// MVP front-end. Four learner destinations behind a home shell:
//   ① Practice scenarios  ② Live AI tutor  ③ Replays  ④ A1 Readiness
// The live tutor is the single production surface (push-to-talk → /api/converse). Rehearsal trees are
// exposure only (no mic, no credit). The "engine" stays invisible everywhere except A1 Readiness.

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

const CHAT_LEVEL = 2; // the internal free-chat ceiling — server-side only, never a learner-visible knob.

const history = [];
let mediaRecorder = null;
let chunks = [];
let recMime = "audio/webm";
let lastE2Ms = 0;

let learnerStarted = false;  // has the learner produced anything yet? (from /api/practice) — if not, tutor → seed
let seedActive = false;      // the zero-state tutorial is running through the same chat surface
let chatRole = null;         // free chat: the role the tutor pinned this session (carried back each turn)
let chatFocus = [];          // free chat: learnable ids to bias this session toward (set by a rehearsal handoff)
let chatContext = null;      // free chat: the scene the learner arrived from (situation + practiced objectives)

// ---- Screen router — one screen visible at a time; the tree + obs are overlays on top. ----
const SCREENS = ["home", "practice", "levels", "tutor", "replays", "a1"];
let currentScreen = "home";

function showScreen(id) {
  currentScreen = id;
  for (const s of SCREENS) $(s).hidden = s !== id;
  $("back").hidden = id === "home";
  $("obs").hidden = id !== "tutor"; // observability panel is a dev affordance on the live surface only
}

function openHome() { stopAllAudio(); showScreen("home"); }
function openPractice() { showScreen("practice"); loadPractice(); }
function openReplays() { showScreen("replays"); loadRuns(); }
function openA1() { showScreen("a1"); renderA1(); }

function stopAllAudio() { stopDialogueAudio(); }

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
  }
  return ""; // let the browser choose
}

function addBubble(role, text, sub, replayOpts = {}) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;

  const span = document.createElement("span");
  span.className = "bubble-text";
  span.textContent = text;
  div.appendChild(span);

  // Tutor bubbles get a replay icon — re-streams the cached audio for that line (teacher voice: the free
  // tutor has no scenario character).
  if (role === "tutor") {
    const replay = document.createElement("button");
    replay.className = "replay";
    replay.type = "button";
    replay.title = "Replay";
    replay.setAttribute("aria-label", "Replay this line");
    replay.textContent = "▶";
    replay.addEventListener("click", (e) => { e.stopPropagation(); playReplyStreaming(text, replayOpts); });
    div.appendChild(replay);
  }

  // Translation stays HIDDEN until the learner taps the bubble — keeps the chat immersive.
  if (sub) {
    const s = document.createElement("small");
    s.className = "translation";
    s.textContent = sub;
    div.appendChild(s);
    div.classList.add("has-translation");
    div.addEventListener("click", () => div.classList.toggle("show-translation"));
  }
  const tr = $("transcript");
  tr.appendChild(div);
  tr.scrollTo({ top: tr.scrollHeight, behavior: "smooth" });
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

// Streaming playback: point an <audio> at /api/speak; the browser streams and plays the mp3
// progressively, so audio starts on the first chunk. Default voice = teacher (no scenario character).
async function playReplyStreaming(text, opts = {}) {
  const audio = new Audio();
  audio.preload = "auto";
  const params = new URLSearchParams({ text });
  if (opts.scenarioId) params.set("scenarioId", opts.scenarioId);
  if (opts.objectiveId) params.set("objectiveId", opts.objectiveId);
  if (opts.voice) params.set("voice", opts.voice);
  audio.src = `/api/speak?${params.toString()}`;
  obs.state("speaking…");

  const t0 = performance.now();
  audio.addEventListener("playing", () => {
    const ttfa = Math.round(performance.now() - t0);
    obs.timings(`e2=${lastE2Ms}ms  audio-start=${ttfa}ms`);
  }, { once: true });
  audio.onended = () => obs.state("idle");
  audio.onerror = () => { obs.state("error"); obs.error("audio stream failed"); };

  try {
    await audio.play();
    $("play-fallback").hidden = true;
  } catch {
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

// One live turn — always the free-chat witness path (/api/converse). The seed rides the same gesture.
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
    if (seedActive) { await seedTurn(audioBase64); return; } // zero-state tutorial → scripted adapter

    const res = await fetch("/api/converse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64, mimeType: "audio/wav", history, level: CHAT_LEVEL, role: chatRole, focusLearnables: chatFocus, context: chatContext }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    lastE2Ms = data.timings.e2Ms;
    obs.heard(data.userVerbatim || data.userSaid);
    obs.tutor(data.tutorReply);
    obs.timings(`e2=${data.timings.e2Ms}ms  audio streaming…`);

    addBubble("user", data.userVerbatim || data.userSaid, data.userSaid ? `≈ ${data.userSaid}` : "");
    addBubble("tutor", data.tutorReply, data.replyGloss ? `≈ ${data.replyGloss}` : "");
    history.push({ role: "user", text: data.userSaid });
    history.push({ role: "tutor", text: data.tutorReply });

    // Pin the role the tutor chose on its first reply so it holds for the rest of the session.
    if (data.role) chatRole = data.role;
    await playReplyStreaming(data.tutorReply, {}); // teacher voice
  } catch (err) {
    obs.state("error");
    obs.error(err.message);
  }
}

// ---- ① Practice scenarios: list → variant/level selector → the rehearsal tree ----
let dialogues = [];    // the open scenario's levels: [{ level, levelLabel, title, objectives, audio, voices, root, nodes, scenarioId }]
let dialogue = null;   // the level currently open in the tree overlay
let currentScenario = null; // the scenario meta {id, name, role, dialogues} whose levels are open

async function loadPractice() {
  const el = $("scenario-list");
  el.innerHTML = "<p class='muted'>Loading…</p>";
  try {
    const { scenarios } = await (await fetch("/api/practice")).json();
    if (!scenarios.length) { el.innerHTML = "<p class='muted'>No scenarios yet.</p>"; return; }
    el.innerHTML = "";
    for (const s of scenarios) {
      const card = document.createElement("button");
      card.className = "scenario-card";
      card.type = "button";
      const n = s.dialogues.length;
      card.innerHTML =
        `<span class="scenario-name">${s.name}</span>` +
        `<span class="scenario-meta">${n} level${n === 1 ? "" : "s"}</span>` +
        `<span class="level-chevron">›</span>`;
      card.addEventListener("click", () => openScenario(s));
      el.appendChild(card);
    }
  } catch (err) {
    el.innerHTML = `<p class='muted'>Failed: ${err.message}</p>`;
  }
}

// The crisp variant selector: one big card per level — number, label, and what it teaches — not a row
// of ambiguous tabs. Tap a level → its rehearsal tree.
function openScenario(s) {
  currentScenario = s;
  dialogues = s.dialogues;
  $("levels-title").textContent = s.name;
  const list = $("level-list");
  list.innerHTML = "";
  dialogues.forEach((d, i) => {
    const card = document.createElement("button");
    card.className = "level-card";
    card.type = "button";
    card.innerHTML =
      `<span class="level-badge">${d.level}</span>` +
      `<span class="level-main">` +
        `<span class="level-label">${d.levelLabel}</span>` +
        `<span class="level-title">${d.title}</span>` +
      `</span>` +
      `<span class="level-chevron">›</span>`;
    card.addEventListener("click", () => openLevel(i));
    list.appendChild(card);
  });
  showScreen("levels");
}

function openLevel(i) {
  dialogue = dialogues[i];
  $("dialogue").hidden = false;
  startDialogueTree();
}

let dialogueAudio = null; // the single dialogue clip currently playing (one channel — never overlap)

function stopDialogueAudio() {
  if (dialogueAudio) { try { dialogueAudio.pause(); } catch {} dialogueAudio = null; }
}

// Play one dialogue line in its speaker's voice; resolves when it ends. Supersedes any clip already
// playing, so the two voices never sound at once. Keyed on node.sl.
function playDialogueLine(node) {
  return new Promise((resolve) => {
    stopDialogueAudio();
    const voice = dialogue.voices[node.speaker];
    const params = new URLSearchParams({ text: node.sl });
    if (dialogue.scenarioId) params.set("scenarioId", dialogue.scenarioId);
    if (voice) params.set("voice", voice);
    const audio = new Audio(`/api/speak?${params.toString()}`);
    dialogueAudio = audio;
    obs.state("speaking…");
    const doneFn = () => { if (dialogueAudio === audio) { dialogueAudio = null; obs.state("idle"); } resolve(); };
    audio.onended = doneFn;
    audio.onerror = doneFn;
    audio.play().catch(doneFn);
  });
}

// Render one node as a chat bubble in the tree card. Npc → tutor (left), client → user (right).
function dialogueBubble(node) {
  const div = document.createElement("div");
  div.className = `bubble ${node.speaker === "npc" ? "tutor" : "user"}`;

  const span = document.createElement("span");
  span.className = "bubble-text";
  span.textContent = node.sl;
  div.appendChild(span);

  // Play button only once the audio is pregenerated — otherwise a click would live-synthesize (bills).
  if (dialogue.audio === "ready") {
    const play = document.createElement("button");
    play.className = "replay";
    play.type = "button";
    play.title = "Hear it";
    play.textContent = "▶";
    play.addEventListener("click", (e) => { e.stopPropagation(); playDialogueLine(node); });
    div.appendChild(play);
  }

  if (node.en) {
    const s = document.createElement("small");
    s.className = "translation";
    s.textContent = node.en;
    div.appendChild(s);
    div.classList.add("has-translation");
    div.addEventListener("click", () => div.classList.toggle("show-translation"));
  }

  const convo = $("dialogue-convo");
  convo.appendChild(div);
  convo.scrollTo({ top: convo.scrollHeight, behavior: "smooth" });
}

// Show an npc node, then offer its client-reply choices (or a restart if it's terminal).
function presentNpcNode(nodeId) {
  const node = dialogue.nodes[nodeId];
  if (!node) return;
  dialogueBubble(node);
  if (dialogue.audio === "ready") playDialogueLine(node);
  renderChoices(node);
}

function renderChoices(npcNode) {
  const wrap = $("dialogue-choices");
  wrap.innerHTML = "";
  const choices = npcNode.next || [];
  if (!choices.length) {
    const btn = document.createElement("button");
    btn.className = "dialogue-choice restart";
    btn.type = "button";
    btn.textContent = "↻ Start over";
    btn.addEventListener("click", startDialogueTree);
    wrap.appendChild(btn);
    return;
  }
  for (const cid of choices) {
    const cn = dialogue.nodes[cid];
    const btn = document.createElement("button");
    btn.className = "dialogue-choice";
    btn.type = "button";
    btn.textContent = cn.sl;
    btn.addEventListener("click", () => chooseClient(cid));
    wrap.appendChild(btn);
  }
}

// The learner picks a client line: show it and (with audio) let the client speak first, THEN present
// the npc's response so the two voices play in turn, not on top of each other.
async function chooseClient(clientNodeId) {
  const cn = dialogue.nodes[clientNodeId];
  $("dialogue-choices").innerHTML = "";
  dialogueBubble(cn);
  const nextNpc = (cn.next || [])[0];
  const advance = () => (nextNpc ? presentNpcNode(nextNpc) : renderChoices(cn));
  if (dialogue.audio === "ready") {
    await playDialogueLine(cn); // client speaks…
    advance();                  // …then the npc replies
  } else {
    advance();
  }
}

// (Re)start the current level's tree from its root.
function startDialogueTree() {
  stopDialogueAudio();
  $("dialogue-title").textContent = dialogue.title;
  $("dialogue-convo").innerHTML = "";
  $("dialogue-choices").innerHTML = "";
  // Offer the "try it for real" handoff whenever this level ties itself to catalog learnables.
  $("dialogue-handoff").hidden = !(dialogue.introduces && dialogue.introduces.length);
  presentNpcNode(dialogue.root);
}

function closeDialogue() { stopDialogueAudio(); $("dialogue").hidden = true; }

// Introduce→reinforce handoff: leave the rehearsed tree and open a live chat biased toward exactly the
// learnables THIS level introduced. Rehearsal credits nothing; the live chat is where mastery accrues.
function reinforceFromDialogue() {
  const focus = (dialogue && dialogue.introduces) || [];
  // Carry the scene into the live chat: the tutor pins the scenario's role and is told the situation +
  // the objectives this level rehearsed, so it keeps the scene alive while still tutoring.
  const scene = currentScenario ? (currentScenario.name || currentScenario.title) : null;
  const practiced = (dialogue && dialogue.objectives) ? dialogue.objectives.map((o) => o.descriptorEN) : [];
  const context = scene ? { scene: `${scene} — ${dialogue.title}`, practiced } : null;
  const role = currentScenario ? (currentScenario.role || null) : null;
  closeDialogue();
  openTutor({ focus, role, context });
}

// ---- ② Live AI tutor: the single live surface. Zero-state → seed; otherwise → free chat. ----
function openTutor(opts = {}) {
  chatFocus = opts.focus || [];
  chatRole = opts.role || null;
  chatContext = opts.context || null;
  showScreen("tutor");
  startTutorSession();
}

function startTutorSession() {
  stopAllAudio();
  $("transcript").innerHTML = "";
  history.length = 0;
  seedActive = false;
  $("play-fallback").hidden = true;
  $("talk").disabled = false;
  obs.state("idle");
  if (!learnerStarted) { enterSeed(); return; } // no attempts yet → the how-to-talk-to-the-tutor tutorial
  beginFreeChat();
}

// Free chat opens with the tutor speaking first — a static Slovene "Začnemo?" (the learner knows it from
// the tutorial). No learner audio, no model call, no credit; it just seeds the thread.
async function beginFreeChat() {
  // Do NOT reset chatRole here — a rehearsal handoff may have pinned the scenario's role already.
  obs.state("free conversation");
  try {
    const res = await fetch("/api/converse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ begin: true, level: CHAT_LEVEL }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    addBubble("tutor", data.tutorReply, data.replyGloss ? `≈ ${data.replyGloss}` : "");
    history.push({ role: "tutor", text: data.tutorReply });
    await playReplyStreaming(data.tutorReply, {}); // teacher voice
  } catch (err) {
    obs.error(`opening: ${err.message}`);
  }
}

// ---- Seed onboarding: the zero-context learner's first conversation, delivered through the SAME chat
// surface. Only the brain differs — a server-side scripted adapter supplies the tutor lines. ----
function playTeacherToEnd(text) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.src = `/api/speak?${new URLSearchParams({ text }).toString()}`;
    audio.onended = resolve;
    audio.onerror = resolve;
    audio.play().catch(resolve);
  });
}

async function renderSeedTutor(data) {
  // Bilingual by ear: play the simple Slovene line, then the English back-to-back, so meaning lands.
  addBubble("tutor", data.tutorReply, data.correction || "");
  history.push({ role: "tutor", text: data.tutorReply });
  obs.state("speaking…");
  await playTeacherToEnd(data.tutorReply);
  if (data.correction) await playTeacherToEnd(data.correction);
  obs.state("idle");
}

async function enterSeed() {
  seedActive = true;
  obs.state("getting started");
  try {
    const res = await fetch("/api/converse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seedId: "getting-started", begin: true }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    await renderSeedTutor(data);
  } catch (err) {
    seedActive = false;
    obs.error(`seed: ${err.message}`);
  }
}

// One seed turn: same push-to-talk, routed to the scripted adapter via /api/converse.
async function seedTurn(audioBase64) {
  obs.state("…");
  try {
    const res = await fetch("/api/converse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64, mimeType: "audio/wav", history, seedId: "getting-started" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    if (data.userVerbatim) {
      addBubble("user", data.userVerbatim, data.userSaid ? `≈ ${data.userSaid}` : "");
      history.push({ role: "user", text: data.userSaid || data.userVerbatim });
    }
    await renderSeedTutor(data);
    if (data.seedDone) {
      // Tutorial finished — hand straight into free chat so the learner keeps going.
      seedActive = false;
      learnerStarted = true;
      obs.state("idle");
      beginFreeChat();
    }
  } catch (err) {
    obs.state("error");
    obs.error(err.message);
  }
}

// ---- ③ Replays: play back a captured live session turn-by-turn, free (audio served from the store) ----
function playClipToEnd(text) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.src = `/api/speak?${new URLSearchParams({ text }).toString()}`; // teacher voice — the free tutor
    audio.onended = resolve;
    audio.onerror = resolve;
    audio.play().catch(resolve);
  });
}

function fmtWhen(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

async function loadRuns() {
  const panel = $("runs-panel");
  panel.innerHTML = "<p class='muted'>Loading…</p>";
  try {
    const { sessions } = await (await fetch("/api/sessions")).json();
    if (!sessions.length) { panel.innerHTML = "<p class='muted'>No sessions yet. Talk to the tutor, then come back to hear it.</p>"; return; }
    panel.innerHTML = "";
    for (const s of sessions) {
      const row = document.createElement("div");
      row.className = "run-row";
      const star = s.favorite ? "★" : "☆";
      const name = s.label || s.id;
      row.innerHTML =
        `<button class="run-play" type="button" title="Replay this session">▶</button>` +
        `<span class="run-name">${name}</span>` +
        `<span class="run-meta">${s.turns} turns · ${fmtWhen(s.createdAt)}</span>` +
        `<button class="run-fav" type="button" title="Favorite">${star}</button>`;
      row.querySelector(".run-play").addEventListener("click", () => replayRun(s.id));
      row.querySelector(".run-fav").addEventListener("click", () => toggleFavorite(s.id, !s.favorite));
      panel.appendChild(row);
    }
  } catch (err) {
    panel.innerHTML = `<p class='muted'>Failed: ${err.message}</p>`;
  }
}

async function toggleFavorite(id, favorite) {
  await fetch(`/api/sessions/${encodeURIComponent(id)}/meta`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ favorite }),
  });
  loadRuns();
}

// Turn-based static replay: step the record in order, playing tutor turns from the store (free) and
// showing the student lines. Renders into the live transcript so it reads like the original chat.
async function replayRun(id) {
  const rec = await (await fetch(`/api/sessions/${encodeURIComponent(id)}`)).json();
  if (rec.error) { obs.error(rec.error); return; }
  showScreen("tutor");
  $("talk").disabled = true; // replay is playback only
  $("transcript").innerHTML = "";
  obs.state(`replaying ${rec.id}…`);
  for (const t of rec.turns) {
    if (t.role === "tutor") {
      addBubble("tutor", t.text);
      await playClipToEnd(t.text);
    } else {
      addBubble("user", t.userVerbatim || t.text, t.text && t.userVerbatim ? `≈ ${t.text}` : "");
      await new Promise((r) => setTimeout(r, 700)); // a beat to read the student line
    }
  }
  obs.state("idle");
}

// ---- ④ A1 Readiness — the coverage map (mockup this cycle; the only place progress is visible). ----
function renderA1() {
  const el = $("a1-body");
  el.innerHTML = "<p class='muted'>Coming soon.</p>";
}

async function init() {
  // Home tiles → destinations.
  document.querySelectorAll(".tile").forEach((t) =>
    t.addEventListener("click", () => {
      const go = t.dataset.go;
      if (go === "practice") openPractice();
      else if (go === "tutor") openTutor();
      else if (go === "replays") openReplays();
      else if (go === "a1") openA1();
    }),
  );

  // Back: levels → practice; everything else → home.
  $("back").addEventListener("click", () => {
    if (currentScreen === "levels") showScreen("practice");
    else openHome();
  });

  // Rehearsal tree overlay controls.
  $("dialogue-close").addEventListener("click", closeDialogue);
  $("dialogue-handoff").addEventListener("click", reinforceFromDialogue);

  // Push-to-talk (pointer events cover mouse + touch with one path).
  const btn = $("talk");
  btn.disabled = false;
  btn.addEventListener("pointerdown", async (e) => {
    e.preventDefault();
    try { await startRecording(); }
    catch (err) { obs.state("error"); obs.error(`mic: ${err.message}`); }
  });
  const stop = (e) => { e.preventDefault(); stopRecordingAndSend(); };
  btn.addEventListener("pointerup", stop);
  btn.addEventListener("pointercancel", stop);
  btn.addEventListener("pointerleave", stop);

  // Boot metadata: providers (for obs) + the zero-state flag (empty learner → tutor routes to the seed).
  try {
    const info = await (await fetch("/api/practice")).json();
    obs.providers(`${info.providers.e2} + ${info.providers.e3}`);
    learnerStarted = !!info.started;
  } catch (err) {
    obs.error(`config: ${err.message}`);
  }
}

init();
