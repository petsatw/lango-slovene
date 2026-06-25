// M3 prebuild — materialize a scenario's STATIC assets into the local store.
// Walks a scenario and getOrCreate's every authored clip/image it owns:
//   - the tutor's opening line audio (character voice) + each targetSL + story sentence (teacher voice)
//   - each asset's canonical render, each atomic frame image, the scene image
// Idempotent and FREE on re-run: anything already in the store is a disk hit, no provider call. Shared
// (catalog) assets render ONCE and are reused across scenarios (identical descriptor → identical key).
//
//   npm run build:assets -- <scenarioId>                 (defaults to "cafe")
//
// Surgical force-regenerate ONE leaf — delete that one key and regenerate only it; everything else is
// left untouched. Frame/scene regens read the EXISTING per-asset renders to anchor (they do NOT
// regenerate them):
//   npm run build:assets -- <id> --regen frame:<objectiveId>
//   npm run build:assets -- <id> --regen scene
//   npm run build:assets -- <id> --regen audio:opening | audio:<objectiveId> | audio:story[<i>]

import "dotenv/config";
import { getE3, getE4 } from "../adapters/index";
import * as store from "../assets/store";
import { getOrCreateImage, getOrCreateAssetRender, assetRenderKey, asDataUri } from "../assets/images";
import { getOrCreateReferenceSheet } from "../assets/reference-sheet";
import { renderConcept } from "../assets/compose";
import { IMAGE_STYLE, IMAGE_FORMAT, relevantLabels } from "../adapters/image-style";
import { CATALOG } from "../catalog";
import { SCENARIOS, characterVoiceProfile } from "../scenarios";

// ---- args: <scenarioId> [--regen <selector>] -----------------------------------------------------
const rawArgs = process.argv.slice(2);
const consumed = new Set<number>();
let regen: string | undefined;
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === "--regen") {
    regen = rawArgs[i + 1];
    consumed.add(i);
    consumed.add(i + 1);
  }
}
const requestedId = rawArgs.find((a, i) => !consumed.has(i) && !a.startsWith("--")) || "cafe";

const scenario = SCENARIOS.find((s) => s.id === requestedId && s.status === "active");
if (!scenario) {
  const active = SCENARIOS.filter((s) => s.status === "active").map((s) => s.id);
  console.error(`No active scenario "${requestedId}". Active: ${active.join(", ") || "(none)"}`);
  process.exit(1);
}

const story = scenario.scene?.story;
const assets = scenario.scene?.assets ?? [];
const frames = story?.frames ?? [];
const sceneImagePrompt = story?.sceneImagePrompt;

// Which kind of regen (if any)?
const regenAudio = regen?.startsWith("audio:") ? regen.slice("audio:".length) : undefined; // opening | <id> | story[i]
const regenFrame = regen?.startsWith("frame:") ? regen.slice("frame:".length) : undefined; // <objectiveId>
const regenScene = regen === "scene";
const regenIsImage = regenFrame !== undefined || regenScene;
if (regen && !regenAudio && !regenIsImage) {
  console.error(`Unknown --regen selector "${regen}". Use frame:<id> | scene | audio:opening|<id>|story[i].`);
  process.exit(2);
}

const e3 = getE3();
const e4 = getE4();

// AUDIO items. label is for logs + audio-regen matching. The opening is an IN-SCENE character line →
// the character's voice profile; objective targets + story narration are learner-facing → teacher voice.
const audioItems: { label: string; text: string; objectiveId?: string; sel: string; voiceProfile?: string }[] = [
  { label: "opening", text: scenario.opening, sel: "opening", voiceProfile: characterVoiceProfile(scenario) },
  ...scenario.objectives.map((o) => ({ label: `audio:objective:${o.id}`, text: o.targetSL, objectiveId: o.id, sel: o.id })),
  ...(story?.sentences ?? []).map((s, i) => ({ label: `audio:story[${i}]`, text: s, sel: `story[${i}]` })),
];

const imageCount = assets.length + frames.length + (sceneImagePrompt ? 1 : 0);
console.log(
  regen
    ? `▶ build:assets  scenario=${scenario.id}  --regen ${regen}\n`
    : `▶ build:assets  scenario=${scenario.id}  e3=${e3.name}  audio=${audioItems.length}  images=${imageCount}\n`,
);

let hits = 0;
let made = 0;
let failures = 0;

// ---- AUDIO ---------------------------------------------------------------------------------------
for (const item of audioItems) {
  if (regen && (!regenAudio || regenAudio !== item.sel)) continue; // regen mode: only the selected clip
  if (!item.text?.trim()) {
    console.log(`   —  ${item.label}: empty text, skipped`);
    continue;
  }
  const voiceTag = e3.voiceTagFor(item.voiceProfile);
  const key = store.audioKey(e3.name, voiceTag, item.text);
  if (regenAudio) store.remove(key, "audio"); // force a miss → re-roll
  try {
    const { hit } = await store.getOrCreate(
      key,
      "audio",
      { provider: e3.name, voiceOrModel: voiceTag, text: item.text, scenarioId: scenario.id, objectiveId: item.objectiveId },
      async () => {
        const r = await e3.synthesize({ text: item.text, voiceProfile: item.voiceProfile });
        return { bytes: Buffer.from(r.audioBase64, "base64"), mimeType: r.mimeType };
      },
    );
    hit ? hits++ : made++;
    console.log(`   ${hit ? "hit " : "gen "} ${item.label}  ${key.slice(0, 12)}…  "${item.text}"`);
  } catch (err: any) {
    failures++;
    console.log(`   ❌  ${item.label}: ${err?.message}`);
  }
}

if (regenAudio) {
  // Audio regen never touches images — done.
  console.log(`\nDone. ${made} generated, ${hits} reused (free)` + (failures ? `, ${failures} failed.` : "."));
  process.exit(failures > 0 ? 1 : 0);
}

// ---- IMAGES (per-asset renders are LAZY: only built to anchor a frame/scene that's actually
// (re)generating — so a build where every frame is a cache hit makes ZERO provider calls and KEEPS the
// existing good images. A key change is bookkeeping; regeneration is a content decision.) -------------
const allLabels = assets.map((a) => a.label);
const frameKey = (prompt: string, fmt: { aspectRatio: string; resolution: string }) =>
  store.imageKey(e4.name, e4.model, IMAGE_STYLE.id, fmt.aspectRatio, fmt.resolution, prompt);

// Lazily render-or-reuse one asset's canonical render (content-addressed; a hit if it already exists).
// Shared (catalog) assets render once and are reused across scenarios.
const renderCache = new Map<string, { bytes: Buffer; key: string }>();
async function getRender(a: { label: string; descriptor: string; catalogId?: string }) {
  const cached = renderCache.get(a.label);
  if (cached) return cached;
  // A scene asset may be a CONCEPT (a location like `cafe`) — render it through the composed path so the
  // scene anchors on its render; otherwise it's a plain per-asset canonical render.
  const concept = a.catalogId ? CATALOG.concepts[a.catalogId] : undefined;
  const { hit, key, bytes } = concept ? await renderConcept(concept) : await getOrCreateAssetRender(a);
  hit ? hits++ : made++;
  const tag = concept ? ` (concept:${a.catalogId})` : a.catalogId ? ` (shared:${a.catalogId})` : "";
  console.log(`   ${hit ? "hit " : "gen "} image:asset:${a.label}${tag}  ${key.slice(0, 12)}…`);
  const entry = { bytes, key };
  renderCache.set(a.label, entry);
  return entry;
}

// Compose-or-reuse the labelled reference SHEET for one prompt: algorithmically gather the assets it
// uses (in bible order), lazily render each, and montage them into ONE local sheet (free, no provider
// call). That single sheet is the anchor; its labels build the reference instruction.
async function sheetFor(prompt: string): Promise<{ dataUri: string; key: string; labels: string[] } | null> {
  const tiles: { label: string; bytes: Buffer; key: string }[] = [];
  for (const l of relevantLabels(prompt, allLabels)) {
    const a = assets.find((x) => x.label === l);
    if (!a) continue;
    const r = await getRender(a);
    tiles.push({ label: l, bytes: r.bytes, key: r.key });
  }
  if (!tiles.length) return null;
  const { bytes, key, hit } = await getOrCreateReferenceSheet(tiles);
  console.log(`   ${hit ? "hit " : "mk  "} sheet[${tiles.map((t) => t.label).join("+")}]  ${key.slice(0, 12)}… (local)`);
  return { dataUri: asDataUri(bytes), key, labels: tiles.map((t) => t.label) };
}

// ---- FRAMES (atomic flashcards, anchored to a composed labelled sheet, minimal-compose) -----------
for (const f of frames) {
  if (regen && !(regenFrame !== undefined && regenFrame === f.objectiveId)) continue;
  const key = frameKey(f.imagePrompt, IMAGE_FORMAT.frame);
  if (regenFrame !== undefined) {
    store.remove(key, "image"); // forced re-roll of THIS frame
  } else if (store.has(key, "image")) {
    hits++;
    console.log(`   keep image:frame:${f.objectiveId}  ${key.slice(0, 12)}… (unchanged)`);
    continue; // existing good image — no sheet, no render, no provider call
  }
  const sheet = await sheetFor(f.imagePrompt);
  try {
    const { hit, key: k } = await getOrCreateImage(f.imagePrompt, {
      ...IMAGE_FORMAT.frame,
      mode: "flashcard",
      scenarioId: scenario.id,
      objectiveId: f.objectiveId,
      referenceImages: sheet ? [sheet.dataUri] : undefined,
      referenceKeys: sheet ? [sheet.key] : undefined,
      sheetLabels: sheet?.labels,
    });
    hit ? hits++ : made++;
    console.log(`   ${hit ? "hit " : "gen "} image:frame:${f.objectiveId}  ${k.slice(0, 12)}…`);
  } catch (err: any) {
    failures++;
    console.log(`   ❌  image:frame:${f.objectiveId}: ${err?.message}`);
  }
}
if (regenFrame !== undefined && !frames.some((f) => f.objectiveId === regenFrame)) {
  console.error(`No frame for objective "${regenFrame}" in "${scenario.id}".`);
  process.exit(2);
}

// ---- SCENE (establishing tableau, anchored to its composed labelled sheet of all its assets) ------
if (sceneImagePrompt && (!regen || regenScene)) {
  const key = frameKey(sceneImagePrompt, IMAGE_FORMAT.scene);
  let skip = false;
  if (regenScene) {
    store.remove(key, "image"); // forced re-roll
  } else if (store.has(key, "image")) {
    hits++;
    console.log(`   keep image:scene  ${key.slice(0, 12)}… (unchanged)`);
    skip = true;
  }
  if (!skip) {
    const sheet = await sheetFor(sceneImagePrompt);
    try {
      const { hit, key: k } = await getOrCreateImage(sceneImagePrompt, {
        ...IMAGE_FORMAT.scene,
        mode: "scene",
        scenarioId: scenario.id,
        objectiveId: "scene",
        referenceImages: sheet ? [sheet.dataUri] : undefined,
        referenceKeys: sheet ? [sheet.key] : undefined,
        sheetLabels: sheet?.labels,
      });
      hit ? hits++ : made++;
      console.log(`   ${hit ? "hit " : "gen "} image:scene  ${k.slice(0, 12)}…`);
    } catch (err: any) {
      failures++;
      console.log(`   ❌  image:scene: ${err?.message}`);
    }
  }
}

console.log(`\nDone. ${made} generated, ${hits} reused (free)` + (failures ? `, ${failures} failed.` : "."));
process.exit(failures > 0 ? 1 : 0);
