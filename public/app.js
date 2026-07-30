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
let runId = null;            // unique id for THIS run — groups turns into one captured SessionRecord
let freeChat = 0;            // 0 = off (scenario turns) ; 1 = free-conversation level 1 ; 2 = level 2
let chatRole = null;         // free chat: the role the tutor pinned this session (carried back each turn)
let chatFocus = [];          // free chat: learnable ids to bias this session toward (set by a rehearsal handoff)
let learnerStarted = false;  // has the learner produced anything yet? (from /api/config) — if not, free chat → seed

// A readable, filesystem-safe run id: <scenario>-<timestamp>-<rand>. One run per page load, so a
// redo (reload) is a new record — that's the versioning (UC3).
function newRunId(scenarioId) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${scenarioId || "session"}-${ts}-${rand}`;
}

function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
  }
  return ""; // let the browser choose
}

function addBubble(role, text, sub, replayOpts) {
  const div = document.createElement("div");
  div.className = `bubble ${role}`;

  const span = document.createElement("span");
  span.className = "bubble-text";
  span.textContent = text;
  div.appendChild(span);

  // Tutor bubbles get a replay icon — re-streams the cached audio for that line. The seed passes {} so
  // it replays in the teacher voice (no scenario character), matching how the seed line was first spoken.
  if (role === "tutor") {
    const opts = replayOpts ?? { scenarioId: session?.scenarioId, voice: "character" };
    const replay = document.createElement("button");
    replay.className = "replay";
    replay.type = "button";
    replay.title = "Replay";
    replay.setAttribute("aria-label", "Replay this line");
    replay.textContent = "▶";
    // Stop the click from also toggling the translation under the bubble.
    replay.addEventListener("click", (e) => { e.stopPropagation(); playReplyStreaming(text, opts); });
    div.appendChild(replay);
  }

  // Translation stays HIDDEN until the learner taps the bubble — keeps the chat immersive, reveals the
  // English on demand. Tapping again hides it. (Tapping the ▶ replay button never toggles it.)
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
  // Scroll WITHIN the transcript (not the window) so the page — and the Hold-to-speak button — stay put.
  tr.scrollTo({ top: tr.scrollHeight, behavior: "smooth" });
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
    btn.addEventListener("click", () => playReplyStreaming(meta.targetSL, { scenarioId: session?.scenarioId, objectiveId: meta.id }));
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
async function playReplyStreaming(text, opts = {}) {
  const audio = new Audio();
  audio.preload = "auto";
  const params = new URLSearchParams({ text });
  if (opts.scenarioId) params.set("scenarioId", opts.scenarioId);
  if (opts.objectiveId) params.set("objectiveId", opts.objectiveId);
  if (opts.voice) params.set("voice", opts.voice); // "character" → the scenario character's voice
  audio.src = `/api/speak?${params.toString()}`;
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
    // Seed onboarding rides the SAME push-to-talk; it just talks to the scripted adapter.
    if (seedActive) { await seedTurn(audioBase64); return; }
    // Free conversation routes to the scenario-less /api/converse (no session/objectives); a normal
    // scenario turn routes to /api/turn. Same capture + playback path otherwise.
    const res = freeChat
      ? await fetch("/api/converse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioBase64, mimeType: "audio/wav", history, level: freeChat, role: chatRole, focusLearnables: chatFocus }),
        })
      : await fetch("/api/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioBase64, mimeType: "audio/wav", history, session, runId }),
        });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    lastE2Ms = data.timings.e2Ms;
    obs.heard(data.userVerbatim || data.userSaid);
    obs.tutor(data.tutorReply);
    obs.correction(data.correction);
    obs.timings(`e2=${data.timings.e2Ms}ms  audio streaming…`);

    // Show what the tutor actually heard (verbatim); tap a bubble to reveal the English beneath.
    // Free chat carries reply_gloss (translation of the Slovene reply); scenario turns carry a correction.
    addBubble("user", data.userVerbatim || data.userSaid, data.userSaid ? `≈ ${data.userSaid}` : "");
    addBubble(
      "tutor",
      data.tutorReply,
      data.replyGloss ? `≈ ${data.replyGloss}` : data.correction ? `↳ ${data.correction}` : "",
    );
    history.push({ role: "user", text: data.userSaid });
    history.push({ role: "tutor", text: data.tutorReply });

    if (freeChat) {
      // Pin the role the tutor chose on its first reply so it holds for the rest of the session.
      if (data.role) chatRole = data.role;
      // No scenario voice in free conversation → teacher voice; no objectives/takeaway.
      await playReplyStreaming(data.tutorReply, {});
    } else {
      // Update objective progress from the server's authoritative session state.
      session = data.session;
      renderObjectives();

      // Text is on screen now; audio streams in and starts on the first chunk (the character's voice).
      await playReplyStreaming(data.tutorReply, { scenarioId: session?.scenarioId, voice: "character" });

      if (session && session.complete) showTakeaway();
    }
  } catch (err) {
    obs.state("error");
    obs.error(err.message);
  }
}

// ---- M5: Free practice — hear the canonical phrase, record your own try locally, compare. No API spend. ----
let practiceIdx = 0;
let practiceRec = null;
let practiceChunks = [];
let practiceUrl = null; // object URL of the last local attempt

function renderPracticeStep() {
  const o = objectivesMeta[practiceIdx];
  if (!o) return;
  $("practice-label").textContent = o.label;
  $("practice-target").textContent = o.targetSL;
  $("practice-progress").textContent = `${practiceIdx + 1} / ${objectivesMeta.length}`;
  $("practice-prev").disabled = practiceIdx === 0;
  $("practice-next").disabled = practiceIdx === objectivesMeta.length - 1;
  if (practiceUrl) { URL.revokeObjectURL(practiceUrl); practiceUrl = null; }
  $("practice-playback").hidden = true;
  hearCanonical(); // auto-play the model phrase (free — served from the store)
}

function hearCanonical() {
  const o = objectivesMeta[practiceIdx];
  if (o) playReplyStreaming(o.targetSL, { scenarioId: session?.scenarioId, objectiveId: o.id });
}

function openPractice() {
  if (!objectivesMeta.length) return;
  practiceIdx = 0;
  $("practice").hidden = false;
  renderPracticeStep();
}
function closePractice() {
  $("practice").hidden = true;
  if (practiceRec && practiceRec.state !== "inactive") practiceRec.stop();
}
function practiceGo(delta) {
  practiceIdx = Math.max(0, Math.min(objectivesMeta.length - 1, practiceIdx + delta));
  renderPracticeStep();
}

async function startPracticeRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = pickMimeType();
    practiceRec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    practiceChunks = [];
    practiceRec.ondataavailable = (e) => e.data.size && practiceChunks.push(e.data);
    practiceRec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (!practiceChunks.length) return;
      const blob = new Blob(practiceChunks, { type: practiceRec.mimeType || mime || "audio/webm" });
      practiceUrl = URL.createObjectURL(blob);
      $("practice-playback").hidden = false;
    };
    practiceRec.start();
    $("practice-record").classList.add("recording");
  } catch (err) {
    $("practice-hint").textContent = `mic: ${err.message}`;
  }
}
function stopPracticeRecording() {
  $("practice-record").classList.remove("recording");
  if (practiceRec && practiceRec.state !== "inactive") practiceRec.stop();
}
function playPracticeAttempt() {
  if (practiceUrl) new Audio(practiceUrl).play().catch(() => {});
}

// ---- M4: Story player — one frame per objective (image + SL line + audio), ending on the scene ----
let storyMeta = null;   // { sentences, frames:[{objectiveId,lineSL}], hasScene } from /api/config
let storySteps = [];    // [{ objectiveId, lineSL, scene? }]
let storyIdx = 0;
let storyNarrationToken = 0; // bumped to cancel an in-flight narration sequence (on nav / close)
let storyNarrationAudio = null;

// Cancel any narration currently playing (e.g. the learner advanced off the scene or closed the story).
function stopSceneNarration() {
  storyNarrationToken++;
  if (storyNarrationAudio) { try { storyNarrationAudio.pause(); } catch {} storyNarrationAudio = null; }
}

// The scene screen is the comprehensible-input preview: auto-play the story narration sentences in
// order (free store hits from build:assets). Cancellable mid-sequence via the token.
async function playSceneNarration() {
  const sentences = storyMeta?.sentences || [];
  stopSceneNarration();                 // supersede any prior sequence
  const token = storyNarrationToken;
  if (!sentences.length) return;
  obs.state("story…");
  for (const sentence of sentences) {
    if (token !== storyNarrationToken) return; // cancelled
    await new Promise((resolve) => {
      if (token !== storyNarrationToken) return resolve();
      const audio = new Audio();
      storyNarrationAudio = audio;
      const params = new URLSearchParams({ text: sentence });
      if (storyMeta?.scenarioId) params.set("scenarioId", storyMeta.scenarioId);
      audio.src = `/api/speak?${params.toString()}`;
      audio.onended = resolve;
      audio.onerror = resolve;
      audio.play().catch(resolve); // autoplay shouldn't be blocked (opened via a click), but don't stall
    });
  }
  if (token === storyNarrationToken) obs.state("idle");
}

function buildStorySteps() {
  if (!storyMeta) return [];
  const steps = storyMeta.frames.map((f) => ({ objectiveId: f.objectiveId, lineSL: f.lineSL }));
  // The full scene opens the story: the user clicks › off it to start into the per-objective frames.
  if (storyMeta.hasScene) steps.unshift({ objectiveId: "scene", lineSL: "", scene: true });
  return steps;
}

function renderStoryStep() {
  const step = storySteps[storyIdx];
  if (!step) return;
  const img = $("story-img");
  img.alt = step.scene ? "Full scene" : step.lineSL;
  img.src = `/api/image?scenarioId=${encodeURIComponent(storyMeta.scenarioId)}&objectiveId=${encodeURIComponent(step.objectiveId)}`;
  $("story-line").textContent = step.scene ? "🎬" : step.lineSL;
  $("story-progress").textContent = `${storyIdx + 1} / ${storySteps.length}`;
  $("story-prev").disabled = storyIdx === 0;
  $("story-next").disabled = storyIdx === storySteps.length - 1;
  // Scene screen → auto-play the full story narration; frame screens → stop narration and play the
  // frame's own line from the store (free if pre-built).
  if (step.scene) {
    playSceneNarration();
  } else {
    stopSceneNarration();
    if (step.lineSL) {
      playReplyStreaming(step.lineSL, { scenarioId: storyMeta.scenarioId, objectiveId: step.objectiveId });
    }
  }
}

function openStory() {
  storySteps = buildStorySteps();
  if (!storySteps.length) return;
  storyIdx = 0;
  $("story").hidden = false;
  renderStoryStep();
}

function closeStory() { stopSceneNarration(); $("story").hidden = true; }
function storyGo(delta) {
  storyIdx = Math.max(0, Math.min(storySteps.length - 1, storyIdx + delta));
  renderStoryStep();
}

// ---- Rehearsal: predetermined BRANCHING dialogue (decision tree). Click through a typical exchange;
// the NPC ("baker") speaks, you pick among canned client replies, the NPC responds. Exposure only —
// no mic, no server turn, no mastery credit. `dialogue.audio` gates the play buttons: while "pending"
// (no audio built yet) the lines are click-through/translate only, so a preview can't bill a synth. ----
let dialogues = [];  // [{ level, levelLabel, title, objectives, audio, voices, root, nodes }] from /api/config
let dialogue = null; // the level currently open

let dialogueAudio = null; // the single dialogue clip currently playing (one channel — never overlap)

function stopDialogueAudio() {
  if (dialogueAudio) { try { dialogueAudio.pause(); } catch {} dialogueAudio = null; }
}

// Play one dialogue line in its speaker's voice; resolves when it ends (or errors). Supersedes any clip
// already playing, so the customer and shop-assistant lines never sound at once. Keyed on node.sl.
function playDialogueLine(node) {
  return new Promise((resolve) => {
    stopDialogueAudio();
    const voice = dialogue.voices[node.speaker];
    const params = new URLSearchParams({ text: node.sl });
    if (session?.scenarioId) params.set("scenarioId", session.scenarioId);
    if (voice) params.set("voice", voice);
    const audio = new Audio(`/api/speak?${params.toString()}`);
    dialogueAudio = audio;
    obs.state("speaking…");
    const done = () => { if (dialogueAudio === audio) { dialogueAudio = null; obs.state("idle"); } resolve(); };
    audio.onended = done;
    audio.onerror = done;
    audio.play().catch(done); // gesture already unlocked audio (the tap that opened / advanced the tree)
  });
}

// Render one node as a chat bubble in the dialogue card. Npc → tutor (left), client → user (right).
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

  // Same click-to-reveal English as the live transcript.
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

// Show a baker node, then offer its client-reply choices (or a restart if it's terminal).
function presentBakerNode(nodeId) {
  const node = dialogue.nodes[nodeId];
  if (!node) return;
  dialogueBubble(node);
  if (dialogue.audio === "ready") playDialogueLine(node);
  renderChoices(node);
}

function renderChoices(bakerNode) {
  const wrap = $("dialogue-choices");
  wrap.innerHTML = "";
  const choices = bakerNode.next || [];
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

// The learner picks a client line: show it and (with audio) let the customer speak first, THEN present
// the baker's response so the two voices play in turn, not on top of each other.
async function chooseClient(clientNodeId) {
  const cn = dialogue.nodes[clientNodeId];
  $("dialogue-choices").innerHTML = "";
  dialogueBubble(cn);
  const nextBaker = (cn.next || [])[0];
  const advance = () => (nextBaker ? presentBakerNode(nextBaker) : renderChoices(cn));
  if (dialogue.audio === "ready") {
    await playDialogueLine(cn); // customer speaks…
    advance();                  // …then the shop assistant replies
  } else {
    advance();
  }
}

// Level tabs — one per authored level (hidden when a scenario has only one).
function renderLevelTabs() {
  const bar = $("dialogue-levels");
  bar.innerHTML = "";
  if (dialogues.length < 2) return;
  dialogues.forEach((d, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `dialogue-level${d === dialogue ? " active" : ""}`;
    b.textContent = `${d.level}. ${d.levelLabel}`;
    b.addEventListener("click", () => selectDialogueLevel(i));
    bar.appendChild(b);
  });
}

// (Re)start the current level's tree from its root.
function startDialogueTree() {
  stopDialogueAudio();
  $("dialogue-title").textContent = dialogue.title;
  $("dialogue-convo").innerHTML = "";
  $("dialogue-choices").innerHTML = "";
  // Offer the "try it for real" handoff whenever this level ties itself to catalog learnables.
  $("dialogue-handoff").hidden = !(dialogue.introduces && dialogue.introduces.length);
  presentBakerNode(dialogue.root);
}

// Introduce→reinforce handoff (roadmap 12b): leave the rehearsed tree and open a free chat biased toward
// exactly the learnables THIS level introduced. Rehearsal credits nothing; the free chat is where mastery
// accrues — the server puts the introduced set in play and the existing witness crediting takes over.
function reinforceFromDialogue() {
  const focus = (dialogue && dialogue.introduces) || [];
  closeDialogue();
  applyChatMode(3, focus); // 3 = L2 free chat, carrying the just-introduced set as the focus bias
}

function selectDialogueLevel(idx) {
  dialogue = dialogues[idx];
  renderLevelTabs();
  startDialogueTree();
}

function openDialogue() {
  if (!dialogues.length) return;
  dialogue = dialogues[0];
  $("dialogue").hidden = false;
  renderLevelTabs();
  startDialogueTree();
}
function closeDialogue() { stopDialogueAudio(); $("dialogue").hidden = true; }

// ---- M6: Past runs — replay a captured session turn-by-turn, free (audio served from the store) ----

// Play one stored clip to completion (resolves on 'ended'); used to step a replay turn-by-turn.
function playClipToEnd(text, scenarioId) {
  return new Promise((resolve) => {
    const audio = new Audio();
    const params = new URLSearchParams({ text });
    if (scenarioId) params.set("scenarioId", scenarioId);
    params.set("voice", "character"); // replayed clips are tutor (character) turns
    audio.src = `/api/speak?${params.toString()}`;
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
  panel.innerHTML = "<p class='runs-empty'>Loading…</p>";
  try {
    const { sessions } = await (await fetch("/api/sessions")).json();
    if (!sessions.length) { panel.innerHTML = "<p class='runs-empty'>No past runs yet.</p>"; return; }
    panel.innerHTML = "";
    for (const s of sessions) {
      const row = document.createElement("div");
      row.className = "run-row";
      const star = s.favorite ? "★" : "☆";
      const name = s.label || s.id;
      row.innerHTML =
        `<button class="run-play" type="button" title="Replay this run">▶</button>` +
        `<span class="run-name">${name}</span>` +
        `<span class="run-meta">${s.scenarioId} · ${s.completed}/${s.objectives} · ${s.status} · ${fmtWhen(s.createdAt)}</span>` +
        `<button class="run-fav" type="button" title="Favorite">${star}</button>`;
      row.querySelector(".run-play").addEventListener("click", () => replayRun(s.id, row));
      row.querySelector(".run-fav").addEventListener("click", () => toggleFavorite(s.id, !s.favorite));
      panel.appendChild(row);
    }
  } catch (err) {
    panel.innerHTML = `<p class='runs-empty'>Failed: ${err.message}</p>`;
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

// Turn-based static replay: step the record in order, playing tutor turns from the store (free)
// and showing the student lines. Renders into the transcript so it reads like the original encounter.
async function replayRun(id, row) {
  const rec = await (await fetch(`/api/sessions/${encodeURIComponent(id)}`)).json();
  if (rec.error) { obs.error(rec.error); return; }
  $("transcript").innerHTML = "";
  $("takeaway").hidden = true;
  obs.state(`replaying ${rec.id}…`);
  for (const t of rec.turns) {
    if (t.role === "tutor") {
      addBubble("tutor", t.text);
      await playClipToEnd(t.text, rec.scenarioId);
    } else {
      addBubble("user", t.userVerbatim || t.text, t.text && t.userVerbatim ? `≈ ${t.text}` : "");
      await new Promise((r) => setTimeout(r, 700)); // a beat to read the student line
    }
  }
  obs.state("idle");
}

// Fill the picker once with every scenario. Planned ones are listed but disabled.
function populateScenarioPicker(scenarios, currentId) {
  const sel = $("scenario-select");
  sel.innerHTML = "";
  for (const s of scenarios || []) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.status === "planned" ? `${s.name} (soon)` : s.name;
    opt.disabled = s.status === "planned";
    if (s.id === currentId) opt.selected = true;
    sel.appendChild(opt);
  }
}

// Apply a /api/config payload to the view, resetting the conversation for a fresh scenario run.
function applyConfig(cfg) {
  obs.providers(`${cfg.providers.e2} + ${cfg.providers.e3}`);
  $("scenario-desc").textContent = cfg.scenario.title;

  // Fresh session: clear transcript, history and any prior takeaway, re-enable the talk button.
  history.length = 0;
  $("transcript").innerHTML = "";
  const takeaway = $("takeaway");
  takeaway.hidden = true;
  takeaway.innerHTML = "";
  $("talk").disabled = false;
  $("talk-label").textContent = "Hold to speak";

  objectivesMeta = cfg.scenario.objectives || [];
  session = cfg.session || null;
  runId = newRunId(session?.scenarioId || cfg.scenario.id);
  renderObjectives();

  if (cfg.scenario.story) {
    storyMeta = { ...cfg.scenario.story, scenarioId: cfg.scenario.id };
    $("story-open").hidden = false;
  } else {
    storyMeta = null;
    $("story-open").hidden = true;
  }
  $("practice-open").hidden = !objectivesMeta.length;

  // Rehearsal dialogues (optional per scenario): every level's branching tree ships in the config.
  dialogues = cfg.dialogues || [];
  dialogue = null;
  $("dialogue-open").hidden = !dialogues.length;

  learnerStarted = !!cfg.started;
  if (cfg.scenario.opening) addBubble("tutor", cfg.scenario.opening);
}

// ---- Seed onboarding: the zero-context learner's first conversation, delivered through the SAME free-
// chat surface (transcript + push-to-talk). Only the brain differs — a server-side scripted adapter
// supplies the predetermined tutor lines instead of the model. No new UI, no new endpoint. ----
let seedActive = false;
let chatModeIdx = 0; // free-chat toggle position: 0 off · 1 Tutorial · 2 L1 · 3 L2

// Play one teacher-voice clip to completion (resolves on 'ended') — used to chain SL then EN in the seed.
function playTeacherToEnd(text) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.src = `/api/speak?${new URLSearchParams({ text }).toString()}`;
    audio.onended = resolve;
    audio.onerror = resolve;
    audio.play().catch(resolve); // gesture already unlocked audio (the toggle/push-to-talk that got us here)
  });
}

async function renderSeedTutor(data) {
  // Slovene line + its English translation as the bubble sub-line. The bubble's ▶ replays the Slovene in
  // the teacher voice. Bilingual BY EAR: play the simple Slovene line, then the English back-to-back, so
  // meaning lands without the learner having to tap — tapping is reserved for free chat.
  addBubble("tutor", data.tutorReply, data.correction || "", {});
  history.push({ role: "tutor", text: data.tutorReply });
  obs.state("speaking…");
  await playTeacherToEnd(data.tutorReply);
  if (data.correction) await playTeacherToEnd(data.correction);
  obs.state("idle");
}

// A zero-context learner who taps Free chat lands here: the scripted opener, then ordinary push-to-talk.
async function enterSeed() {
  seedActive = true;
  freeChat = 0;
  $("transcript").innerHTML = "";
  $("takeaway").hidden = true;
  history.length = 0;
  $("objectives-bar").hidden = true;
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

// One seed turn: same push-to-talk as live dialogue, routed to the scripted adapter via /api/converse.
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
    // The script supplies what the learner just practiced (no model judges the audio in the seed).
    if (data.userVerbatim) {
      addBubble("user", data.userVerbatim, data.userSaid ? `≈ ${data.userSaid}` : "");
      history.push({ role: "user", text: data.userSaid || data.userVerbatim });
    }
    await renderSeedTutor(data);
    if (data.seedDone) {
      // Tutorial finished — drop back to "off" without wiping the just-finished transcript.
      seedActive = false;
      learnerStarted = true;
      chatModeIdx = 0;
      const t = $("freechat-toggle");
      t.textContent = "💬 Free chat: off";
      t.setAttribute("aria-pressed", "false");
      obs.state("idle");
    }
  } catch (err) {
    obs.state("error");
    obs.error(err.message);
  }
}

// Free chat opens with the tutor speaking first — a static Slovene "Začnemo?" (the learner already
// knows it from the tutorial). No learner audio, no model call, no credit; it just seeds the thread so
// the conversation has a natural opening instead of an empty history.
async function beginFreeChat() {
  chatRole = null; // fresh session — the tutor re-decides its role on the first real reply
  obs.state("free conversation");
  try {
    const res = await fetch("/api/converse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ begin: true, level: freeChat }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    addBubble("tutor", data.tutorReply, data.replyGloss ? `≈ ${data.replyGloss}` : "", {});
    history.push({ role: "tutor", text: data.tutorReply });
    await playReplyStreaming(data.tutorReply, {}); // teacher voice
  } catch (err) {
    obs.error(`opening: ${err.message}`);
  }
}

// The free-chat toggle cycles: off → Tutorial (replay the seed anytime) → L1 → L2 → off. Each switch
// clears the chat surface; Tutorial hands off to the scripted seed, L1/L2 to model free conversation.
const CHAT_MODES = ["off", "tutorial", "L1", "L2"];
const CHAT_LABELS = { off: "off", tutorial: "Tutorial", L1: "L1", L2: "L2" };
function applyChatMode(idx, focus = []) {
  chatModeIdx = idx;
  const mode = CHAT_MODES[idx];
  seedActive = false;
  freeChat = 0;
  chatFocus = focus; // biased only when a rehearsal handoff passes the just-introduced set; else a plain chat
  const t = $("freechat-toggle");
  t.textContent = `💬 Free chat: ${CHAT_LABELS[mode]}`;
  t.setAttribute("aria-pressed", String(mode !== "off"));
  $("transcript").innerHTML = "";
  $("takeaway").hidden = true;
  history.length = 0;
  $("objectives-bar").hidden = mode !== "off";
  if (mode === "tutorial") enterSeed();
  else if (mode === "L1") { freeChat = 1; beginFreeChat(); }
  else if (mode === "L2") { freeChat = 2; beginFreeChat(); }
  else obs.state("idle");
}

// Switch scenarios: re-boot the chosen one from the server, then apply it.
async function selectScenario(scenarioId) {
  try {
    const cfg = await (await fetch(`/api/config?scenarioId=${encodeURIComponent(scenarioId)}`)).json();
    applyConfig(cfg);
  } catch (err) {
    obs.error(`config: ${err.message}`);
  }
}

async function init() {
  try {
    const cfg = await (await fetch("/api/config")).json();
    populateScenarioPicker(cfg.scenarios, cfg.scenario.id);
    $("scenario-select").addEventListener("change", (e) => selectScenario(e.target.value));
    applyConfig(cfg);
  } catch (err) {
    obs.error(`config: ${err.message}`);
  }

  // Past-runs panel: lazy-load the list the first time it's opened.
  const runsToggle = $("runs-toggle");
  runsToggle.addEventListener("click", () => {
    const panel = $("runs-panel");
    const open = panel.hidden;
    panel.hidden = !open;
    runsToggle.setAttribute("aria-expanded", String(open));
    if (open) loadRuns();
  });

  // Objectives bar: tap to slide the descriptor card down, tap again to slide it up.
  $("objectives-toggle").addEventListener("click", () => {
    const open = $("objectives-bar").classList.toggle("open");
    $("objectives-toggle").setAttribute("aria-expanded", String(open));
  });

  // Rehearsal dialogue controls.
  $("dialogue-open").addEventListener("click", openDialogue);
  $("dialogue-close").addEventListener("click", closeDialogue);
  $("dialogue-handoff").addEventListener("click", reinforceFromDialogue);

  // Story player controls.
  $("story-open").addEventListener("click", openStory);
  $("story-close").addEventListener("click", closeStory);
  $("story-prev").addEventListener("click", () => storyGo(-1));
  $("story-next").addEventListener("click", () => storyGo(1));

  // Practice controls (M5). Record is hold-to-talk; playback compares your try to the model.
  $("practice-open").addEventListener("click", openPractice);
  $("practice-close").addEventListener("click", closePractice);
  $("practice-prev").addEventListener("click", () => practiceGo(-1));
  $("practice-next").addEventListener("click", () => practiceGo(1));
  $("practice-hear").addEventListener("click", hearCanonical);
  $("practice-playback").addEventListener("click", playPracticeAttempt);
  const pRec = $("practice-record");
  pRec.addEventListener("pointerdown", (e) => { e.preventDefault(); startPracticeRecording(); });
  const pStop = (e) => { e.preventDefault(); stopPracticeRecording(); };
  pRec.addEventListener("pointerup", pStop);
  pRec.addEventListener("pointercancel", pStop);
  pRec.addEventListener("pointerleave", pStop);

  // Free-chat toggle: cycles off → Tutorial → L1 → L2 → off. Tutorial replays the seed at any time.
  $("freechat-toggle").addEventListener("click", () => applyChatMode((chatModeIdx + 1) % CHAT_MODES.length));

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

  // Verification/preview hook: ?seed=1 starts the seed conversation directly.
  if (new URLSearchParams(location.search).get("seed") === "1") enterSeed();
}

init();
