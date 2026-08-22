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
let runId = null;            // unique id for THIS free-chat session — groups its turns into one replayable record

// ---- Screen router — one screen visible at a time; the tree + obs are overlays on top. ----
const SCREENS = ["home", "practice", "levels", "tutor", "replays", "a1", "scene"];
let currentScreen = "home";

function showScreen(id) {
  currentScreen = id;
  for (const s of SCREENS) $(s).hidden = s !== id;
  $("back").hidden = id === "home" || id === "scene";
  $("obs").hidden = id !== "tutor"; // observability panel is a dev affordance on the live surface only
  // The scene owns the whole viewport — beat 15 is zero chrome, header included.
  document.body.classList.toggle("in-scene", id === "scene");
}

function openHome() { stopAllAudio(); showScreen("home"); }
function openPractice() { showScreen("practice"); loadPractice(); }
function openReplays() { showScreen("replays"); loadRuns(); }
function openA1() { showScreen("a1"); renderA1(); }

function stopAllAudio() { stopDialogueAudio(); }

// A readable, filesystem-safe run id: <prefix>-<timestamp>-<rand>. One run per tutor session, so leaving
// and re-entering the live tutor starts a fresh replayable record.
function newRunId(prefix) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix || "free-chat"}-${ts}-${rand}`;
}

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
      body: JSON.stringify({ audioBase64, mimeType: "audio/wav", history, level: CHAT_LEVEL, role: chatRole, focusLearnables: chatFocus, context: chatContext, runId }),
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
        `<span class="scenario-meta">${n} lesson${n === 1 ? "" : "s"}</span>` +
        `<span class="level-chevron">›</span>`;
      card.addEventListener("click", () => openScenario(s));
      el.appendChild(card);
    }
  } catch (err) {
    el.innerHTML = `<p class='muted'>Failed: ${err.message}</p>`;
  }
}

// The scenario TASK is the headline; difficulty is a glanceable chip, not encoded jargon. Every dialogue
// in the MVP is A1, so the CEFR band is constant noise — we collapse the (inconsistent) authored labels
// ("Survival"/"Beginning A1"/"Basic A1"/"Advanced A1"/"Full A1") into one plain 3-tier ladder.
const DIFFICULTY_TIERS = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
function difficultyTier(levelLabel) {
  const l = (levelLabel || "").toLowerCase();
  // Handles both the computed bands (Basic/Intermediate/Advanced — docs/dialogue-difficulty-model.md)
  // and legacy authored labels (Survival / Beginning A1 / Basic A1 / Full A1 / A2).
  if (l.includes("advanced") || l.includes("full")) return "advanced";
  if (l.includes("intermediate") || l.includes("basic a1")) return "intermediate"; // computed "Intermediate"; legacy "Basic A1" = middle rung
  if (l === "basic") return "beginner"; // computed entry band
  return "beginner"; // "Survival", "Beginning A1", "A2", and anything unrecognized read as the entry rung
}

// The crisp variant selector: one big card per level — the TASK up front, a difficulty chip beside it,
// a quiet ordinal — not a row of ambiguous tabs. Tap a level → its rehearsal tree.
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
    const tier = difficultyTier(d.levelLabel);
    card.innerHTML =
      `<span class="level-ordinal">${d.level}</span>` +
      `<span class="level-main">` +
        `<span class="level-title">${d.title}</span>` +
        `<span class="level-chip chip-${tier}">${DIFFICULTY_TIERS[tier]}</span>` +
      `</span>` +
      `<span class="level-chevron">›</span>`;
    card.addEventListener("click", () => openLevel(i));
    list.appendChild(card);
  });
  showScreen("levels");
}

function openLevel(i) {
  dialogue = dialogues[i];
  applyDialogueBackground(); // apply the scene background first so the intro can show it alone
  $("dialogue").hidden = false;
  if (dialogue.intro) runIntro();
  else startDialogueTree();
}

// The optional scene background makes the whole card a fixed mobile-portrait frame the image fills.
// Applied once on open (before the intro), so the picture is fully visible while the intro audio plays.
function applyDialogueBackground() {
  const card = $("dialogue-convo").closest(".dialogue-card");
  card.style.setProperty("--bg", dialogue.background ? `url("/backgrounds/${dialogue.background}")` : "none");
  card.classList.toggle("has-bg", !!dialogue.background);
}

// ---- Intro phase: a brief audio "story" over the full background before the tree begins ----
let introAudio = null;    // the intro clip (separate channel from dialogue lines)
let introTimer = null;    // the "play intro" linger timer for a returning (skipped-before) learner
const INTRO_PROMPT_MS = 2500; // how long "play intro" lingers before auto-continuing
const introSkipKey = (d) => `introSkipped:${d.id}`;

function stopIntro() {
  if (introTimer) { clearTimeout(introTimer); introTimer = null; }
  if (introAudio) { try { introAudio.pause(); } catch {} introAudio = null; }
}

function setIntroButton(btn, kind, onClick) {
  btn.textContent = kind === "skip" ? "Skip ›››" : "▶ Play intro";
  btn.onclick = onClick;
}

// Show only the background + one control. First visit: auto-play the audio with a "skip" control.
// Returning after a skip: offer "play intro" briefly, auto-continuing if it's not taken.
function runIntro() {
  const card = $("dialogue-convo").closest(".dialogue-card");
  const btn = $("dialogue-intro");
  card.classList.add("intro-active"); // hides the conversation interface until the intro resolves
  btn.classList.remove("fade-out");
  btn.hidden = false;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    stopIntro();
    endIntro(card, btn);
  };

  const playNow = () => {
    if (introTimer) { clearTimeout(introTimer); introTimer = null; }
    setIntroButton(btn, "skip", () => { localStorage.setItem(introSkipKey(dialogue), "1"); finish(); });
    stopIntro();
    const audio = new Audio(`/intros/${dialogue.intro.audio}`);
    introAudio = audio;
    const done = () => { if (introAudio === audio) introAudio = null; finish(); };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  };

  if (localStorage.getItem(introSkipKey(dialogue)) === "1") {
    setIntroButton(btn, "play", playNow);
    introTimer = setTimeout(finish, INTRO_PROMPT_MS);
  } else {
    playNow();
  }
}

// Fade the intro control out (≤0.5s) while the conversation interface fades in (~1s), then start the tree.
function endIntro(card, btn) {
  btn.classList.add("fade-out");
  setTimeout(() => { btn.hidden = true; btn.classList.remove("fade-out"); }, 500);
  card.classList.remove("intro-active");
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

// Show an npc node, then offer its client-reply choices (or a restart if it's terminal). The choices +
// hint are held back until the shopkeeper's line finishes playing, so the student listens/reads the
// dialogue first instead of jumping to the buttons. (No audio → nothing to wait on; show immediately.)
async function presentNpcNode(nodeId) {
  const node = dialogue.nodes[nodeId];
  if (!node) return;
  dialogueBubble(node);
  if (dialogue.audio === "ready") await playDialogueLine(node);
  renderChoices(node);
}

function renderChoices(npcNode) {
  const wrap = $("dialogue-choices");
  wrap.innerHTML = "";
  // Keep each choice's id (nodes are keyed by id but don't carry it) alongside the node for its text/voice.
  const choiceIds = (npcNode.next || []).filter((cid) => dialogue.nodes[cid]);
  const choices = choiceIds.map((cid) => dialogue.nodes[cid]);

  if (!choices.length) {
    wrap.classList.add("is-terminal"); // drop the panel chrome — a lone restart button, no hint
    const btn = document.createElement("button");
    btn.className = "dialogue-choice restart";
    btn.type = "button";
    btn.textContent = "↻ Start over";
    btn.addEventListener("click", startDialogueTree);
    wrap.appendChild(btn);
    return;
  }
  wrap.classList.remove("is-terminal");

  const list = document.createElement("div");
  list.className = "choice-list";
  const buttons = [];
  choiceIds.forEach((cid, idx) => {
    const cn = choices[idx];
    const btn = document.createElement("button");
    btn.className = "dialogue-choice";
    btn.type = "button";
    const num = document.createElement("span"); // leading "1"/"2" badge: unmistakably "pick one of these"
    num.className = "choice-num";
    num.textContent = String(idx + 1);
    num.setAttribute("aria-hidden", "true");
    btn.appendChild(num);
    const body = document.createElement("span");
    body.className = "choice-body";
    if (cn.context) {
      // A muted parenthetical: the situation this branch selects when the context can't ride on the line
      // itself (e.g. "the book is damaged"). Shown always — it's the signpost for picking this option.
      const ctx = document.createElement("span");
      ctx.className = "choice-context";
      ctx.textContent = `(${cn.context})`;
      body.appendChild(ctx);
    }
    const sl = document.createElement("span");
    sl.className = "choice-sl";
    sl.textContent = cn.sl;
    body.appendChild(sl);
    if (cn.en) {
      const en = document.createElement("span");
      en.className = "choice-en";
      en.textContent = cn.en;
      body.appendChild(en);
    }
    btn.appendChild(body);
    btn.addEventListener("click", () => chooseClient(cid));
    list.appendChild(btn);
    buttons.push(btn);
  });

  // Hint control: a centered chevron pill above the choices. Down = Slovene only; tapping reveals the
  // English for every option at once (an explicit, reversible peek), chevron flips up. Tapping again hides.
  if (choices.some((c) => c.en)) {
    const hint = document.createElement("button");
    hint.className = "hint-btn";
    hint.type = "button";
    hint.innerHTML = `<span class="hint-label">hint</span><span class="chev">▾</span>`;
    hint.addEventListener("click", () => {
      const show = !hint.classList.contains("expanded");
      hint.classList.toggle("expanded", show);
      buttons.forEach((b) => b.classList.toggle("reveal", show));
    });
    const row = document.createElement("div");
    row.className = "hint-row";
    row.appendChild(hint);
    wrap.appendChild(row);
  }

  wrap.appendChild(list);

  // "More choices" cue: a fork with more than two choices (a complication branch) overflows the
  // fixed-height panel. Show a labeled amber pill counting what's still below; hide it once scrolled to the
  // end. Gated on the choice COUNT (>2), so a 2-choice fork never shows it and a 3+-choice fork always does.
  const hasMore = choices.length > 2;
  if (hasMore) {
    const cue = document.createElement("div");
    cue.className = "choice-scroll-cue";
    cue.setAttribute("aria-hidden", "true");
    cue.innerHTML = `<span class="cue-pill"><span class="cue-count"></span><span class="cue-chev">⌄</span></span>`;
    wrap.appendChild(cue);
    const countEl = cue.querySelector(".cue-count");
    const updateCue = () => {
      // How many choice cards start below the visible fold — the number still to be revealed by scrolling.
      const below = buttons.filter((b) => b.offsetTop - list.scrollTop >= list.clientHeight - 4).length;
      const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 4;
      countEl.textContent = below > 0 ? `${below} more` : "more choices";
      wrap.classList.toggle("has-scroll", !atBottom);
    };
    list.addEventListener("scroll", updateCue);
    requestAnimationFrame(updateCue);
  }
}

// The learner picks a client line: show it and (with audio) let the client speak first, THEN present
// the npc's response so the two voices play in turn, not on top of each other.
async function chooseClient(clientNodeId) {
  const cn = dialogue.nodes[clientNodeId];
  // Clear the choices (the hint vanishes with them — nothing to do during the reply). The panel keeps its
  // fixed height, so the hint reappears in the exact same spot when the next fork renders.
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

function closeDialogue() {
  stopIntro();
  stopDialogueAudio();
  const card = $("dialogue-convo").closest(".dialogue-card");
  card.classList.remove("intro-active");
  $("dialogue-intro").hidden = true;
  $("dialogue").hidden = true;
}

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
  runId = newRunId("free-chat"); // a fresh replayable session record for this sitting
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

// ---- Spoken scene: the first meeting. One character, one caption, one mic. ------------------------
//
// The learner's recording is never uploaded and never inspected — releasing the button IS the advance
// signal, so the turn cannot be failed. What the server sends back is the next character line plus its
// pacing: how long to hold before the caption appears, when the English arrives, whether the line gets
// re-spoken slowly, and what to say if the learner goes quiet.

// Every engineered silence in the run comes from the server's PACING PROFILE (server/catalog/pacing.json)
// — there are no timing constants in this file. Pacing is a teaching decision, so it lives with the rest
// of the pedagogy, is named, and is dialed per lesson; a renderer that invents its own durations is how
// the ladder drifted eleven seconds out of true in the first place.
let scene = { scenarioId: null, voice: null, node: null, stalls: [], armed: false, backchannel: null, pacing: null };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sceneSay(text) {
  return new Promise((resolve) => {
    stopDialogueAudio();
    const params = new URLSearchParams({ text });
    if (scene.voice) params.set("voice", scene.voice);
    const audio = new Audio(`/api/speak?${params.toString()}`);
    dialogueAudio = audio;
    const done = () => { if (dialogueAudio === audio) dialogueAudio = null; resolve(); };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}

function sceneCaption(text, { slow = false } = {}) {
  const el = $("scene-caption");
  el.textContent = text;
  el.classList.toggle("slow", slow);
  el.classList.add("shown");
}

function sceneClearStalls() {
  for (const t of scene.stalls) clearTimeout(t);
  scene.stalls = [];
}

// The quiet-learner ladder. Someone who hasn't spoken is not short of Slovene — they're stuck, and
// answering that with MORE Slovene is the one thing the scene must never do. So a rung either draws the
// eye back to what is already there, models the target again, or lowers the bar in the learner's own
// language. The bar never disappears. Cancelled the instant the learner touches the button.
function sceneArmStalls(handlers, npc) {
  sceneClearStalls();
  for (const h of handlers) {
    scene.stalls.push(setTimeout(async () => {
      if (!scene.armed) return;
      if (h.kind === "pulse") {
        const cap = $("scene-caption");
        cap.classList.remove("pulse");
        void cap.offsetWidth; // restart the animation
        cap.classList.add("pulse");
      } else if (h.kind === "respeak" && npc.slowSL) {
        // The character takes the floor back for a moment: the button says so, then returns the turn.
        const label = $("scene-talk-label").textContent;
        sceneSetPhase("speaking");
        sceneCaption(npc.slowSL, { slow: true });
        await sceneSay(npc.slowSL);
        sceneCaption(npc.sl);
        if (scene.armed) sceneSetPhase("ready", label);
      } else if (h.kind === "soften" && h.label) {
        $("scene-talk-label").textContent = h.label;
      }
    }, h.afterMs));
  }
}

// Beats 1-11 — the English on-ramp, before any Slovene is spoken. Where you are, that nothing is being
// asked of you yet, and that forgetting is not your fault.
// The button is the one object that is always on screen and never moves; it changes PHASE instead of
// appearing and disappearing. "speaking" wears a level meter and no words (sound is happening, and it is
// not yours); "ready" carries the single action the learner is meant to take.
function sceneSetPhase(phase, label) {
  const btn = $("scene-talk");
  btn.classList.toggle("speaking", phase === "speaking");
  btn.classList.toggle("waiting", phase === "ready");
  btn.setAttribute("aria-disabled", phase === "speaking" ? "true" : "false");
  if (label !== undefined) $("scene-talk-label").textContent = label;
  // The character's line recedes the moment the turn stops being his, so the only thing at full
  // brightness is the line the learner is being asked for.
  const handed = phase === "ready";
  $("scene-caption").classList.toggle("receded", handed);
  $("scene-gloss").classList.toggle("receded", handed);
}

// How long one on-ramp line takes to swap for the next. Not a pacing knob — it is the transition itself,
// the same in every profile; the dwell either side of it is what gets dialed.
const FRAME_CROSSFADE_MS = 300;

async function scenePlayFrame(lines) {
  const pace = scene.pacing;
  const el = $("scene-frame");
  el.innerHTML = "";
  el.appendChild(document.createElement("p"));
  // Staggered in, held, then gone — long enough to read, short enough that it reads as a title card
  // rather than a wall of instructions. Each line stays on screen once shown, so the learner reads the
  // whole frame at the end rather than chasing lines that vanish.
  // ONE line at a time, in one place. Stacking them made the frame grow downward and the learner's eye
  // chase it; a single line that is replaced holds the gaze still and reads as someone talking to you.
  el.hidden = false;
  el.classList.add("shown");
  const p = el.firstElementChild;
  p.style.transition = `opacity ${FRAME_CROSSFADE_MS}ms ease`;
  p.style.opacity = "0";
  for (const [i, line] of lines.entries()) {
    p.textContent = line;
    p.style.opacity = "1";
    // Dwell scales with the length of the line — these are the first sentences the learner ever reads,
    // and a fixed interval either rushes the long one or strands the short one. Nothing can be re-read
    // once it is replaced, so each line has to be legible the first time.
    await sleep(pace.frameLineMs + pace.frameCharMs * line.length);
    if (i === lines.length - 1) break;          // the last line stays up for the frame's own hold
    p.style.opacity = "0";
    await sleep(FRAME_CROSSFADE_MS);
  }
  await sleep(pace.frameHoldMs);
  el.classList.remove("shown");
  await sleep(pace.frameFadeMs);
  el.hidden = true;
}

async function scenePlayBeat(npc) {
  const pace = scene.pacing;
  scene.node = npc;
  scene.armed = false;
  const cap = $("scene-caption");
  const gloss = $("scene-gloss");
  cap.classList.remove("shown", "pulse");
  gloss.classList.remove("shown");
  gloss.textContent = "";
  $("scene-prompt").classList.remove("shown");
  sceneSetPhase("speaking");              // the button stays put and shows that the character has the floor

  // The line lands as SOUND, then the silence is held, and only then does it become text (beats 19-22).
  // These are three steps in sequence, not three timers racing: a hold that runs concurrently with the
  // beat gets pre-empted by whatever comes next (the slow re-speak reveals the caption the instant the
  // line ends), and the silence never actually happens.
  // The caption and the voice are ONE event: the text goes up and the line is spoken over it. Awaiting
  // the clip before setting the caption — which is what this used to do — put the text a whole sentence
  // behind the audio, so the learner could never match what they heard to what they were reading.
  sceneCaption(npc.sl);
  if (npc.captionLeadMs) await sleep(npc.captionLeadMs);
  await sceneSay(npc.sl);

  // Chunked-slow re-speak: same words, slower, with the caption chunking in step (beats 23-27). The
  // caption has to be READ in its plain form first — setting it and re-setting it in the same tick means
  // the learner only ever sees the chunked one, and the "appears, then re-speaks" beat collapses.
  if (npc.slowSL) {
    await sleep(pace.captionReadMs);
    sceneCaption(npc.slowSL, { slow: true });
    await sceneSay(npc.slowSL);
    sceneCaption(npc.sl);
  }

  // The gloss comes second when it comes at all — Slovene first, English confirming (beats 64-65, 82).
  if (npc.glossPolicy === "after") {
    await sleep(pace.glossDelayMs);
    gloss.textContent = npc.en;
    gloss.classList.add("shown");
  } else if (npc.glossPolicy === "tap") {
    cap.onclick = () => { gloss.textContent = npc.en; gloss.classList.add("shown"); };
  }

  // A closing beat hands the turn to nobody. The goodbye is left up long enough to land and the run
  // ends — the button never invites a turn that does not exist.
  if (npc.terminal) {
    await sleep(pace.closeHoldMs);
    sceneFinish();
    return;
  }

  // The turn is handed over. The pause first, so the hand-over reads as an offer rather than a cue.
  await sleep(pace.handoverMs);
  // What they are being asked to say — their own line, beside the button that produces it. When the turn
  // expects no Slovene (the learner says their own name) there is no stem, and the English instruction
  // stands on its own rather than under a bold blank.
  const sl = npc.prompt?.sl ?? "";
  $("scene-prompt-sl").textContent = sl;
  $("scene-prompt-sl").hidden = !sl;
  $("scene-prompt-en").textContent = npc.prompt?.en ?? "";
  $("scene-prompt").classList.toggle("bare", !!npc.prompt && !sl);
  if (npc.prompt) $("scene-prompt").classList.add("shown");
  // Same button, same place — the meter gives way to the one action being asked for.
  sceneSetPhase("ready", "Continue");
  if (npc.stallHandlers?.length) sceneArmStalls(npc.stallHandlers, npc);
  scene.armed = true;
}

// `ack` is the character's backchannel, already playing. The fetch overlaps with it, but the next line
// must not START until it has finished — `sceneSay` stops whatever is playing, so without this the
// "Mhm." is cut off within ~50ms and the instant-acknowledgement beat never reaches the learner at all.
async function sceneStep(from, ack) {
  const res = await fetch("/api/scene", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId: scene.scenarioId, ...(from ? { from } : {}) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  scene.voice = data.voice;
  if (data.pacing) scene.pacing = data.pacing;
  if (data.backchannel) scene.backchannel = data.backchannel;
  if (data.background) $("scene-bg").style.backgroundImage = `url(/backgrounds/${data.background})`;
  if (ack) await ack;
  if (data.frameEN?.length) await scenePlayFrame(data.frameEN);
  if (data.npc) await scenePlayBeat(data.npc);
  else sceneFinish();
}

function sceneFinish() {
  sceneClearStalls();
  scene.armed = false;
  sceneSetPhase("speaking");
  learnerStarted = true;
  openHome(); // the scene hands off to the app proper
}

async function openScene(scenarioId) {
  scene = { scenarioId, voice: null, node: null, stalls: [], armed: false, backchannel: null, pacing: null };
  showScreen("scene");
  $("scene-bg").style.backgroundImage = "";
  $("scene-prompt").classList.remove("shown");
  // The button is on screen from the first frame, anchored, showing that it is not yet the learner's.
  sceneSetPhase("speaking", "");
  try {
    await sceneStep(null, null);
  } catch (err) {
    obs.error(`scene: ${err.message}`);
    openHome();
  }
}

// The scene's button ADVANCES; it does not record. The learner practises the line out loud in their own
// time and presses when they are ready, so the app never opens the microphone: there is no permission
// prompt, no capture, and nothing on screen that could be mistaken for one. (The audio was always
// discarded unheard, so holding it only ever bought an OS dialog and the suspicion of being recorded.)
function wireSceneAdvance() {
  const btn = $("scene-talk");
  const buzz = (ms) => { try { navigator.vibrate?.(ms); } catch {} };

  const advance = async (e) => {
    e.preventDefault();
    if (!scene.armed) return;
    sceneClearStalls();
    buzz(10);
    const from = scene.node?.id;
    scene.armed = false;
    sceneSetPhase("speaking");
    $("scene-prompt").classList.remove("shown");
    // The character answers the BODY before anything answers the words — a cached "Mhm." fires now,
    // sooner than any processing could have returned. Perceived latency: zero. It is held for at least
    // the profile's `backchannelMs` so the next line cannot talk over the acknowledgement.
    const ack = scene.backchannel
      ? Promise.all([sceneSay(scene.backchannel), sleep(scene.pacing?.backchannelMs ?? 0)])
      : null;
    try { await sceneStep(from, ack); } catch (err) { obs.error(`scene: ${err.message}`); }
  };
  // A plain click: no hold, so a slipped thumb cannot end the turn early and there is no gesture to
  // learn. `click` also covers keyboard activation for free.
  btn.addEventListener("click", advance);
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

// ---- ④ A1 Readiness — the coverage map (the only place progress is visible). A hand-authored
// competency → scenarios mapping; progress read from the durable learner model. List → drill-down. ----
let a1Competencies = [];

async function renderA1() {
  const el = $("a1-body");
  el.innerHTML = "<p class='muted'>Loading…</p>";
  try {
    const { competencies } = await (await fetch("/api/a1")).json();
    a1Competencies = competencies;
    if (!competencies.length) { el.innerHTML = "<p class='muted'>No competencies yet.</p>"; return; }
    el.innerHTML = "<p class='a1-intro'>How far each everyday skill has come — and where to go next.</p>";
    for (const c of competencies) {
      const pct = c.total ? Math.round((c.mastered / c.total) * 100) : 0;
      const card = document.createElement("button");
      card.className = "a1-card";
      card.type = "button";
      card.innerHTML =
        `<div class="a1-card-head"><span class="a1-label">${c.label}</span>` +
        `<span class="a1-count">${c.mastered}/${c.total}</span></div>` +
        `<div class="a1-bar"><div class="a1-bar-fill" style="width:${pct}%"></div></div>`;
      card.addEventListener("click", () => openCompetency(c.id));
      el.appendChild(card);
    }
  } catch (err) {
    el.innerHTML = `<p class='muted'>Failed: ${err.message}</p>`;
  }
}

// Drill into one competency: its descriptor, the scenarios/levels that move it forward (tap → practice
// that level), and the learnables with their owned/shaky/unseen status.
function openCompetency(id) {
  const c = a1Competencies.find((x) => x.id === id);
  if (!c) return;
  const el = $("a1-body");
  const back = document.createElement("button");
  back.className = "a1-back";
  back.type = "button";
  back.textContent = "‹ All skills";
  back.addEventListener("click", renderA1);

  const sym = { mastered: "●", attempted: "◐", unseen: "○" };
  const scnRows = c.scenarios
    .map(
      (s) =>
        `<button class="a1-scenario" data-sc="${s.scenarioId}" data-lv="${s.level}">` +
        `<span class="level-badge">${s.level}</span>` +
        `<span class="level-main"><span class="level-label">${s.name} · ${s.levelLabel}</span>` +
        `<span class="level-title">${s.title}</span></span><span class="level-chevron">›</span></button>`,
    )
    .join("");
  const itemRows = c.items
    .map((i) => `<div class="a1-item a1-${i.status}"><span>${sym[i.status]}</span> ${i.sl} <em>${i.gloss}</em></div>`)
    .join("");

  el.innerHTML = "";
  el.appendChild(back);
  const body = document.createElement("div");
  body.innerHTML =
    `<h3 class="a1-detail-title">${c.label}</h3>` +
    `<p class="a1-descriptor">${c.descriptor}</p>` +
    `<p class="a1-section">Practice these to move forward</p>` +
    `<div class="level-list">${scnRows}</div>` +
    `<p class="a1-section">What it covers</p>` +
    `<div class="a1-items">${itemRows}</div>`;
  el.appendChild(body);
  // Tapping a scenario level jumps straight into that rehearsal tree.
  body.querySelectorAll(".a1-scenario").forEach((b) =>
    b.addEventListener("click", () => jumpToLevel(b.dataset.sc, Number(b.dataset.lv))),
  );
}

// From A1, open a specific scenario level's rehearsal tree (fetches the practice list, finds the scenario).
async function jumpToLevel(scenarioId, level) {
  try {
    const { scenarios } = await (await fetch("/api/practice")).json();
    const s = scenarios.find((x) => x.id === scenarioId);
    if (!s) return;
    openScenario(s);
    const idx = s.dialogues.findIndex((d) => d.level === level);
    if (idx >= 0) openLevel(idx);
  } catch (err) {
    obs.error(`a1 jump: ${err.message}`);
  }
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

  wireSceneAdvance();

  // Boot metadata: providers (for obs) + the zero-state flag (empty learner → tutor routes to the seed).
  try {
    const info = await (await fetch("/api/practice")).json();
    obs.providers(`${info.providers.e2} + ${info.providers.e3}`);
    learnerStarted = !!info.started;
    // D9 — a learner who has produced nothing meets the scene FIRST, ahead of the shell. `started`
    // has to be in hand before this decision, which is why the route is settled here and not at paint.
    //
    // `?scene=<scenarioId>` forces it open for anyone. The zero-state route is real but unreachable for
    // an existing learner, so without this the only way to look at the scene is to wipe the learner
    // model — which is their actual history, not test data.
    const forced = new URLSearchParams(location.search).get("scene");
    if (forced) openScene(forced);
    else if (!learnerStarted && info.scene) openScene(info.scene);
  } catch (err) {
    obs.error(`config: ${err.message}`);
  }
}

init();
