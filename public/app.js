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
    // Two groups, because they are two different things to do: the spoken lessons are the course, the
    // rehearsal trees are conversations to read through.
    for (const [heading, mode] of [["Practice!", "spoken"], ["Example Conversations", "rehearsal"]]) {
      const group = scenarios.filter((s) => s.mode === mode);
      if (!group.length) continue;
      const h = document.createElement("p");
      h.className = "scenario-group";
      h.textContent = heading;
      el.appendChild(h);
      for (const s of group) {
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
  // A spoken level is a lesson the app plays, not a tree to click through — same authored data, a
  // different surface. Which one is named by the level's own advance mode.
  if ((dialogue.advance ?? "tap") === "audio") { openScene(dialogue.scenarioId, dialogue.level); return; }
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
  // Bias toward everything this level had the learner PRODUCE, not only what it was first to introduce.
  // `introduces` is new-to-the-learner by design, so on a level that mostly re-practises earlier phrases
  // it is nearly empty — and those phrases are exactly what the chat should keep working. Derived from
  // the client nodes rather than stored, so there is one fact and no second field to keep in step.
  const produced = dialogue
    ? [...new Set(Object.values(dialogue.nodes || {})
        .filter((n) => n.speaker === "client")
        .flatMap((n) => n.learnables || []))]
    : [];
  const focus = produced.length ? produced : ((dialogue && dialogue.introduces) || []);
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
// `trail` is every line the character has said this run, in order, with `trailAt` pointing at the one on
// screen. It exists so `«` can put a line back WITHOUT asking the server: /api/scene only ever walks
// forward, and there is no beat to re-fetch — the client already holds the shaped node it played.
let scene = { scenarioId: null, level: null, voice: null, audio: null, node: null, stalls: [], armed: false,
              backchannel: null, pacing: null, nextLevel: null, keyPhrases: null, trail: [], trailAt: -1 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Emphasis carries the segmenting a beginner cannot do: the span the lesson is working sits at full
// weight and the rest of the line steps down. Contrast only — no box, no colour, no label, so it
// answers "which part is mine?" without announcing that a lesson is happening.
function writeFocused(el, text, span) {
  el.textContent = "";
  const at = span ? text.indexOf(span) : -1;
  if (at < 0) { el.textContent = text; return; }
  const put = (t, cls) => {
    if (!t) return;
    const s = document.createElement("span");
    if (cls) s.className = cls;
    s.textContent = t;
    el.appendChild(s);
  };
  put(text.slice(0, at), "unfocused");
  put(span, "focused");
  put(text.slice(at + span.length), "unfocused");
}

// The character speaks only from clips that are already built. A level that honestly declares its audio
// "pending" plays SILENT — and faster, since nothing is being waited on — rather than live-synthesizing.
// This is the same gate the rehearsal tree puts on its play buttons, and it matters more here: the
// scene asks for `sl`, while the build asks for `deliverySL` under the `sl` key, so a miss would both
// bill and permanently seat undirected audio where the directed clip belongs.
//
// A clip is ABORTABLE. The promise settles on `onended`/`onerror`, and `pause()` fires neither — so a
// beat whose audio is cut (the skip chip, the ✕, a new lesson) would otherwise sit awaiting a promise
// that can never settle, and the run would hang mid-sentence. The pending resolve is therefore held on
// a module handle that `sceneCancel` can release by hand.
let scenePendingSay = null;
// The run's generation. Bumped whenever an in-flight beat is superseded; the player re-checks it after
// every await and returns rather than racing the beat that replaced it.
let sceneGen = 0;
// The slow re-speak currently playing, if any. The beat player waits on it before it advances.
let sceneSlowPass = null;

function sceneSay(text) {
  if (scene.audio !== "ready") return Promise.resolve();
  return new Promise((resolve) => {
    // STOP FIRST, then release. `done` clears `dialogueAudio`, so releasing the awaiter ahead of the
    // stop leaves `stopDialogueAudio` with nothing to pause and the old clip playing on underneath
    // the new one — two voices at once, which is what an interrupting re-speak would otherwise be.
    stopDialogueAudio();
    scenePendingSay?.();
    const params = new URLSearchParams({ text });
    if (scene.voice) params.set("voice", scene.voice);
    const audio = new Audio(`/api/speak?${params.toString()}`);
    dialogueAudio = audio;
    const done = () => {
      if (dialogueAudio === audio) dialogueAudio = null;
      if (scenePendingSay === done) scenePendingSay = null;
      resolve();
    };
    scenePendingSay = done;
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done);
  });
}

// Cut the run short: stop the voice, release whoever is awaiting it, disarm the stall ladder, and
// supersede the beat that is in flight. Everything that interrupts a beat goes through here.
function sceneCancel() {
  sceneGen++;
  sceneClearStalls();
  scene.armed = false;
  sceneSlowPass = null;
  $("scene-slower").classList.remove("blinking");
  const pending = scenePendingSay;
  scenePendingSay = null;
  stopDialogueAudio();
  pending?.();
}

// Which run controls this beat offers. Set on every beat, so a node with no slow clip, the first line
// and the closing one dim rather than disappear. ✕ is never dimmed — the way out is always live.
function sceneChips({ slower = false, back = false, skip = false } = {}) {
  $("scene-slower").setAttribute("aria-disabled", slower ? "false" : "true");
  $("scene-back").setAttribute("aria-disabled", back ? "false" : "true");
  $("scene-skip").setAttribute("aria-disabled", skip ? "false" : "true");
}

function sceneCaption(text, { slow = false, focus = null } = {}) {
  const el = $("scene-caption");
  writeFocused(el, text, focus);
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
        await scenePlaySlow(npc);
      } else if (h.kind === "soften" && h.label) {
        $("scene-talk-label").textContent = h.label;
      }
    }, h.afterMs));
  }
}

// The slow re-speak — the same sentence, spoken slower. It is ASKED FOR, never volunteered: either the
// learner was handed the turn and let the wait run out (the `respeak` rung), or they tapped the tortoise.
// Playing it after every line taught that the first pass need not be listened to.
//
// What changes on screen is the TORTOISE, not the words. `slowSL` chunks the line with ` … ` to direct
// the voice; on screen that reads as studio notation and means nothing to a learner. So the clean
// sentence stays up — spaced a little, with the tortoise blinking beside it — while the chunked text
// goes to the synthesiser only.
function scenePlaySlow(npc) {
  if (!npc?.slowSL) return Promise.resolve();
  const chip = $("scene-slower");
  if (chip.classList.contains("blinking")) return Promise.resolve();  // a second tap is not a queue
  const gen = sceneGen;
  // The character takes the floor back for a moment: the button says so, then returns the turn.
  const handed = scene.armed;
  const label = $("scene-talk-label").textContent;
  if (handed) sceneSetPhase("speaking");
  chip.classList.add("blinking");
  sceneCaption(npc.sl, { slow: true, focus: npc.focusSpan });
  const run = (async () => {
    await sceneSay(npc.slowSL);
    chip.classList.remove("blinking");
    // The run may have moved on underneath a late tap — a skip, a ✕, a `«`. Restoring this node's
    // caption over the next node's line would be worse than not restoring it at all.
    if (gen !== sceneGen || scene.node !== npc) return;
    sceneCaption(npc.sl, { focus: npc.focusSpan });
    if (handed && scene.armed) sceneSetPhase("ready", label);
  })();
  const gate = run.then(() => { if (sceneSlowPass === gate) sceneSlowPass = null; });
  sceneSlowPass = gate;
  return gate;
}

// The beat's own clock is not the learner's. A re-speak asked for during a hold used to run against the
// timer the beat was already on, so the next line arrived on schedule and cut the slow one off mid-word
// — the learner asked to hear it again and got half of it. Nothing progresses until the re-speak has
// finished; the loop covers a second one started while the first was settling.
async function sceneAwaitSlow() {
  while (sceneSlowPass) await sceneSlowPass;
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

// Help is one tap away and arrives like a friend handing it over. Tapping the learner's own slot brings
// the English back and replays the line they are answering. It is theirs to ask for — nothing here
// diagnoses a struggle, because there is nothing to diagnose once they have asked.
//
// The Slovene never withdraws; the English does. A line carries its translation the first time the
// learner produces it ("after") and is held after — held, never dropped, so a tap always returns it.
function scenePromptGloss(npc) {
  const en = $("scene-prompt-en");
  en.textContent = npc.prompt?.en ?? "";
  en.classList.toggle("held", (npc.prompt?.glossPolicy ?? "tap") !== "after");
  $("scene-prompt").onclick = () => { en.classList.remove("held"); sceneSay(npc.sl); };
}

async function scenePlayBeat(npc, { replay = false } = {}) {
  const pace = scene.pacing;
  // A line arriving from the server is a new place in the run; a line arriving from `«` is one the
  // learner has already been to. Only the first extends the trail, and it ends whatever forward path a
  // `«` had left behind — the run they are on is the one they are actually playing.
  if (!replay) {
    scene.trail.length = scene.trailAt + 1;
    scene.trail.push(npc);
    scene.trailAt = scene.trail.length - 1;
  }
  // This beat's claim on the run. A skip or a ✕ bumps the generation; every await below is followed by
  // a check, so a beat that has been superseded stops instead of playing on over the one that replaced
  // it. Without it, skipping mid-clip leaves two beats driving the same caption.
  const gen = sceneGen;
  const live = () => gen === sceneGen;
  scene.node = npc;
  scene.armed = false;
  const cap = $("scene-caption");
  const gloss = $("scene-gloss");
  cap.classList.remove("shown", "pulse");
  gloss.classList.remove("shown");
  gloss.textContent = "";
  $("scene-prompt").classList.remove("shown");
  sceneSetPhase("speaking");              // the button stays put and shows that the character has the floor
  // The tortoise is live from the character's first syllable. Someone who needs it slower knows within
  // two words, and making them sit through the rest of a sentence they are not following before they
  // may ask is the opposite of help. Tapping it INTERRUPTS: the natural pass stops mid-word and the
  // slow one starts.
  sceneChips({ slower: !!npc.slowSL, back: scene.trailAt > 0, skip: !npc.terminal });

  // The line lands as SOUND, then the silence is held, and only then does it become text (beats 19-22).
  // These are three steps in sequence, not three timers racing: a hold that runs concurrently with the
  // beat gets pre-empted by whatever comes next (the slow re-speak reveals the caption the instant the
  // line ends), and the silence never actually happens.
  // The caption and the voice are ONE event: the text goes up and the line is spoken over it. The caption
  // must therefore be set BEFORE the clip is awaited — await first and the text trails the audio by a
  // whole sentence, and the learner cannot match what they hear to what they are reading.
  sceneCaption(npc.sl, { focus: npc.focusSpan });
  if (npc.captionLeadMs) await sleep(npc.captionLeadMs);
  await sceneAwaitSlow();     // asked for before he even started: the slow pass goes first, uncut
  if (!live()) return;
  await sceneSay(npc.sl);
  // The tortoise may have cut that line short — `sceneSay` returns the moment the re-speak takes the
  // channel, so without this the beat would carry on over the top of the slow version it just started.
  // The slow re-speak is NOT automatic: replaying every line slower taught that the first pass need not
  // be listened to, and it spent the beat that should belong to the learner's silence. It happens only
  // when it is asked for — the `respeak` stall rung, or the tortoise.
  await sceneAwaitSlow();
  if (!live()) return;

  // The gloss comes second when it comes at all — Slovene first, English confirming (beats 64-65, 82).
  if (npc.glossPolicy === "after") {
    await sleep(pace.glossDelayMs);
    if (!live()) return;
    gloss.textContent = npc.en;
    gloss.classList.add("shown");
  } else if (npc.glossPolicy === "tap") {
    cap.onclick = () => { gloss.textContent = npc.en; gloss.classList.add("shown"); };
  }

  // A closing beat hands the turn to nobody. The goodbye is left up long enough to land and the run
  // ends — the button never invites a turn that does not exist.
  if (npc.terminal) {
    await sleep(pace.closeHoldMs);
    await sceneAwaitSlow();     // the goodbye is not over while it is still being said again
    if (!live()) return;
    sceneFinish();
    return;
  }

  // A beat that hands over to nobody: the character says something the learner is not being asked to
  // answer — an acknowledgement, a nudge onward — and simply carries on. Arming the button here would
  // ask for a turn that does not exist.
  if (!npc.handsOver) {
    // This caption is the only one the learner cannot go back to — the next line replaces it, whereas a
    // hand-over beat's line recedes but stays up beside their prompt. So it is held for reading time,
    // scaled to how much there is to read, rather than for the hand-over's pause-before-an-offer.
    const shown = Math.max(npc.sl.length, npc.glossPolicy === "after" ? npc.en.length : 0);
    await sleep(pace.beatHoldMs + pace.beatCharMs * shown);
    await sceneAwaitSlow();     // this line does not give way while it is still being said again
    if (!live()) return;
    await sceneStep(npc.id, null);
    return;
  }

  // The turn is handed over. The pause first, so the hand-over reads as an offer rather than a cue.
  await sleep(pace.handoverMs);
  await sceneAwaitSlow();     // the turn is not offered over the top of the line being said again
  if (!live()) return;
  // What they are being asked to say — their own line, beside the button that produces it. When the turn
  // expects no Slovene (the learner says their own name) there is no stem, and the English instruction
  // stands on its own rather than under a bold blank.
  const sl = npc.prompt?.sl ?? "";
  writeFocused($("scene-prompt-sl"), sl, npc.prompt?.focusSpan);
  $("scene-prompt-sl").hidden = !sl;
  scenePromptGloss(npc);
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
  // The fetch outlives a skip that lands while it is in flight, and its reply would otherwise overwrite
  // the state of the beat that superseded it.
  const gen = sceneGen;
  const res = await fetch("/api/scene", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenarioId: scene.scenarioId, ...(scene.level ? { level: scene.level } : {}), ...(from ? { from } : {}) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (gen !== sceneGen) return;
  scene.voice = data.voice;
  if (data.audio) scene.audio = data.audio;
  if (data.level) scene.level = data.level;
  if (data.keyPhrases) { scene.keyPhrases = data.keyPhrases; scene.nextLevel = data.nextLevel ?? null; }
  if (data.pacing) scene.pacing = data.pacing;
  if (data.backchannel) scene.backchannel = data.backchannel;
  if (data.background) $("scene-bg").style.backgroundImage = `url(/backgrounds/${data.background})`;
  if (ack) await ack;
  if (data.frameEN?.length) await scenePlayFrame(data.frameEN);
  if (data.npc) await scenePlayBeat(data.npc);
  else sceneFinish();
}

// The close: the character's last line, unglossed, still on screen — then a way to look back at the
// phrases and a way onward. Key Phrases is a button, never a screen you have to pass through, and it
// carries no counts, no badges, nothing that reads as a measure.
function sceneFinish() {
  sceneClearStalls();
  scene.armed = false;
  // Nothing is playing and there is nothing after this line. `«` stays live — the goodbye is exactly
  // where someone realises they missed the line before it — and so does ✕, which is the way out from a
  // close screen whose other button is "Next lesson".
  sceneChips({ back: scene.trailAt > 0 });
  learnerStarted = true;
  $("scene-controls").hidden = true;
  $("scene-phrases").hidden = true;
  const next = $("scene-next");
  next.textContent = scene.nextLevel ? "Next lesson" : "Done";
  next.onclick = () => (scene.nextLevel ? openScene(scene.scenarioId, scene.nextLevel) : openHome());
  const phrases = scene.keyPhrases;
  const toggle = $("scene-phrases-btn");
  toggle.hidden = !(phrases && (phrases.new.length || phrases.review.length));
  toggle.onclick = () => {
    const panel = $("scene-phrases");
    if (panel.hidden) renderKeyPhrases(phrases);
    panel.hidden = !panel.hidden;
  };
  $("scene-close").hidden = false;
}

// One row per phrase they met: the Slovene, and a play button where the clip is already on disk. Tap the
// text for the English — the same interaction as every other line in the app.
function renderKeyPhrases(phrases) {
  const panel = $("scene-phrases");
  panel.innerHTML = "";
  const h = document.createElement("h3");
  h.className = "phrases-title";
  h.textContent = "Key Phrases";
  panel.appendChild(h);
  for (const [heading, rows] of [["New", phrases.new], ["Review", phrases.review]]) {
    if (!rows.length) continue;
    const sub = document.createElement("p");
    sub.className = "phrases-sub";
    sub.textContent = heading;
    panel.appendChild(sub);
    for (const r of rows) {
      const row = document.createElement("div");
      row.className = "phrase-row";
      const sl = document.createElement("button");
      sl.type = "button";
      sl.className = "phrase-sl";
      sl.textContent = r.sl;
      const en = document.createElement("small");
      en.className = "phrase-en held";
      en.textContent = r.en;
      sl.addEventListener("click", () => en.classList.remove("held"));
      row.appendChild(sl);
      if (r.playable) {
        const play = document.createElement("button");
        play.type = "button";
        play.className = "replay";
        play.title = "Hear it";
        play.textContent = "▶";
        play.addEventListener("click", () => {
          const params = new URLSearchParams({ text: r.sl });
          if (phrases.voice) params.set("voice", phrases.voice);
          stopDialogueAudio();
          dialogueAudio = new Audio(`/api/speak?${params.toString()}`);
          dialogueAudio.play().catch(() => {});
        });
        row.appendChild(play);
      }
      row.appendChild(en);
      panel.appendChild(row);
    }
  }
}

async function openScene(scenarioId, level = null) {
  // Whatever the previous run was doing stops here — a beat still awaiting a clip would otherwise play
  // on over the lesson that replaced it.
  sceneCancel();
  scene = { scenarioId, level, voice: null, audio: null, node: null, stalls: [], armed: false,
            backchannel: null, pacing: null, nextLevel: null, keyPhrases: null, trail: [], trailAt: -1 };
  showScreen("scene");
  $("scene-close").hidden = true;
  $("scene-phrases").hidden = true;
  $("scene-controls").hidden = false;
  $("scene-bg").style.backgroundImage = "";
  // Clear the stage before the next lesson's on-ramp plays over it — the previous run's last line and
  // prompt are still up, and a new lesson opening onto the old one's goodbye reads as a stuck screen.
  $("scene-caption").classList.remove("shown", "pulse");
  $("scene-gloss").classList.remove("shown");
  $("scene-prompt").classList.remove("shown");
  // The button is on screen from the first frame, anchored, showing that it is not yet the learner's.
  sceneSetPhase("speaking", "");
  sceneChips({});
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

// The three run controls. None of them is a lesson action — they act on the RUN: hear that again slower,
// I'm done with this line, I'm done for now. They are wired once and stay wired; which of them is
// available in a given beat is `sceneChips`'s job, not a matter of adding and removing listeners.
function wireSceneChips() {
  $("scene-slower").addEventListener("click", () => scenePlaySlow(scene.node));

  // Skip: cut the voice, take the same step the talk button takes. `sceneCancel` first, because the
  // beat being abandoned is awaiting a clip that `pause()` will never end.
  $("scene-skip").addEventListener("click", async () => {
    const from = scene.node?.id;
    if (!from || scene.node.terminal) return;
    sceneCancel();
    // Both chips go dark until the next beat lights them again. A second tap landing while the step is
    // still in flight would cancel the beat it just asked for — the line would be cut a few frames in
    // and a node skipped that the learner never asked to skip.
    sceneChips({});
    sceneSetPhase("speaking");
    $("scene-prompt").classList.remove("shown");
    try { await sceneStep(from, null); } catch (err) { obs.error(`scene: ${err.message}`); }
  });

  // Back: the mirror of skip. Cut the voice and put the previous line back — replayed from the trail
  // rather than re-fetched, because /api/scene only walks forward and asking it for a beat again would
  // plant that beat's learnables as a second attempt for a line the learner is merely re-hearing.
  // It also un-ends a finished run: the goodbye is exactly where someone realises they missed the line
  // before it, and the close screen must give way to the lesson again.
  $("scene-back").addEventListener("click", async () => {
    if (scene.trailAt < 1) return;
    sceneCancel();
    sceneChips({});
    $("scene-close").hidden = true;
    $("scene-phrases").hidden = true;
    $("scene-controls").hidden = false;
    sceneSetPhase("speaking");
    $("scene-prompt").classList.remove("shown");
    scene.trailAt -= 1;
    try { await scenePlayBeat(scene.trail[scene.trailAt], { replay: true }); }
    catch (err) { obs.error(`scene: ${err.message}`); }
  });

  // Leave: the same exit as "Done" on the close screen.
  $("scene-quit").addEventListener("click", () => { sceneCancel(); openHome(); });
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
  wireSceneChips();

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
