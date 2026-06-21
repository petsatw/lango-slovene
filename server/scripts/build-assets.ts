// M3 prebuild — materialize a scenario's STATIC assets into the local store.
// Walks a scenario and getOrCreate's every authored clip/image it owns:
//   - the tutor's opening line audio
//   - each objective's canonical targetSL phrase audio
//   - each story-narration sentence audio
//   - the reference sheet (anchor), each atomic frame image, the scene image
// Idempotent and FREE on re-run: anything already in the store is a disk hit, no provider call.
//
//   npm run build:assets -- <scenarioId>                 (defaults to "cafe")
//
// Surgical force-regenerate ONE leaf (per the contract's dependency map) — delete that one key and
// regenerate only it; everything else is left untouched. Frame/scene regens read the EXISTING
// reference sheet to anchor (they do NOT regenerate it):
//   npm run build:assets -- <id> --regen frame:<objectiveId>
//   npm run build:assets -- <id> --regen scene
//   npm run build:assets -- <id> --regen audio:opening | audio:<objectiveId> | audio:story[<i>]
// The reference sheet is an INTERIOR node (it anchors every frame + the scene), so `--regen sheet`
// is REJECTED — regenerating it is a cascade; do a full rebuild or bump IMAGE_STYLE.id instead.

import "dotenv/config";
import { getE3, getE4 } from "../adapters/index";
import * as store from "../assets/store";
import { getOrCreateImage, asDataUri } from "../assets/images";
import { IMAGE_STYLE, IMAGE_FORMAT, referenceSheetPrompt } from "../adapters/image-style";
import { SCENARIOS } from "../scenarios";

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

// Reject the forbidden surgical target up front (contract: the reference sheet cascades).
if (regen === "sheet" || regen === "bible" || regen === "reference-sheet") {
  console.error(
    `Refusing --regen ${regen}: the reference sheet is an INTERIOR node — it anchors every frame and ` +
      `the scene, so regenerating it cascades to all of them. Do a full rebuild ` +
      `(npm run build:assets -- ${scenario.id}) or bump IMAGE_STYLE.id for a one-time global re-key.`,
  );
  process.exit(2);
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

// AUDIO items. label is for logs + audio-regen matching.
const audioItems: { label: string; text: string; objectiveId?: string; sel: string }[] = [
  { label: "opening", text: scenario.opening, sel: "opening" },
  ...scenario.objectives.map((o) => ({ label: `audio:objective:${o.id}`, text: o.targetSL, objectiveId: o.id, sel: o.id })),
  ...(story?.sentences ?? []).map((s, i) => ({ label: `audio:story[${i}]`, text: s, sel: `story[${i}]` })),
];

const imageCount = (assets.length ? 1 : 0) + frames.length + (sceneImagePrompt ? 1 : 0);
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
  const key = store.audioKey(e3.name, e3.voiceTag, item.text);
  if (regenAudio) store.remove(key, "audio"); // force a miss → re-roll
  try {
    const { hit } = await store.getOrCreate(
      key,
      "audio",
      { provider: e3.name, voiceOrModel: e3.voiceTag, text: item.text, scenarioId: scenario.id, objectiveId: item.objectiveId },
      async () => {
        const r = await e3.synthesize({ text: item.text });
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

// ---- REFERENCE SHEET (the anchor) ----------------------------------------------------------------
// Non-regen: generate it if missing (verbatim prompt, styled:false). Image-regen: READ the existing
// sheet to anchor — never regenerate it here (that's the forbidden cascade).
let refImages: string[] | undefined;
let refKeys: string[] | undefined;
if (assets.length) {
  const sheetPrompt = referenceSheetPrompt(assets);
  const sheetKey = store.imageKey(
    e4.name,
    e4.model,
    IMAGE_STYLE.id,
    IMAGE_FORMAT.sheet.aspectRatio,
    IMAGE_FORMAT.sheet.resolution,
    sheetPrompt,
  );
  if (regenIsImage) {
    const bytes = store.read(sheetKey, "image");
    if (!bytes) {
      console.error(
        `Cannot --regen ${regen}: no reference sheet on disk for "${scenario.id}" at the current style. ` +
          `Run a full build first (npm run build:assets -- ${scenario.id}).`,
      );
      process.exit(2);
    }
    refImages = [asDataUri(bytes)];
    refKeys = [sheetKey];
    console.log(`   use  image:reference-sheet  ${sheetKey.slice(0, 12)}…  (anchor, not regenerated)`);
  } else {
    try {
      const { hit, key, bytes } = await getOrCreateImage(sheetPrompt, {
        ...IMAGE_FORMAT.sheet,
        scenarioId: scenario.id,
        objectiveId: "reference-sheet",
        styled: false,
      });
      hit ? hits++ : made++;
      refImages = [asDataUri(bytes)];
      refKeys = [key];
      console.log(`   ${hit ? "hit " : "gen "} image:reference-sheet  ${key.slice(0, 12)}…`);
    } catch (err: any) {
      failures++;
      console.log(`   ❌  image:reference-sheet: ${err?.message}`);
    }
  }
}

// ---- FRAMES (atomic flashcards, anchored, minimal-compose) ---------------------------------------
for (const f of frames) {
  if (regen && !(regenFrame !== undefined && regenFrame === f.objectiveId)) continue;
  const key = store.imageKey(
    e4.name,
    e4.model,
    IMAGE_STYLE.id,
    IMAGE_FORMAT.frame.aspectRatio,
    IMAGE_FORMAT.frame.resolution,
    f.imagePrompt,
  );
  if (regenFrame !== undefined) store.remove(key, "image"); // force a miss → re-roll
  try {
    const { hit, key: k } = await getOrCreateImage(f.imagePrompt, {
      ...IMAGE_FORMAT.frame,
      mode: "flashcard",
      scenarioId: scenario.id,
      objectiveId: f.objectiveId,
      referenceImages: refImages,
      referenceKeys: refKeys,
      assetLabels: assets.map((a) => a.label),
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

// ---- SCENE (establishing tableau, anchored) ------------------------------------------------------
if (sceneImagePrompt && (!regen || regenScene)) {
  const key = store.imageKey(
    e4.name,
    e4.model,
    IMAGE_STYLE.id,
    IMAGE_FORMAT.scene.aspectRatio,
    IMAGE_FORMAT.scene.resolution,
    sceneImagePrompt,
  );
  if (regenScene) store.remove(key, "image"); // force a miss → re-roll
  try {
    const { hit, key: k } = await getOrCreateImage(sceneImagePrompt, {
      ...IMAGE_FORMAT.scene,
      mode: "scene",
      scenarioId: scenario.id,
      objectiveId: "scene",
      referenceImages: refImages,
      referenceKeys: refKeys,
      assetLabels: assets.map((a) => a.label),
    });
    hit ? hits++ : made++;
    console.log(`   ${hit ? "hit " : "gen "} image:scene  ${k.slice(0, 12)}…`);
  } catch (err: any) {
    failures++;
    console.log(`   ❌  image:scene: ${err?.message}`);
  }
}

console.log(`\nDone. ${made} generated, ${hits} reused (free)` + (failures ? `, ${failures} failed.` : "."));
process.exit(failures > 0 ? 1 : 0);
