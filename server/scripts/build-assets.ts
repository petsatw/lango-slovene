// M3 prebuild — materialize a scenario's STATIC audio assets into the local store.
// Walks a scenario and getOrCreate's every authored clip it owns today (audio only; images are M2):
//   - the tutor's opening line
//   - each objective's canonical targetSL phrase (the per-objective "recap" set)
//   - each story-narration sentence (scene.story)
// Idempotent and FREE on re-run: anything already in the store is a disk hit, no provider call.
// Every clip is scenario-tagged in the manifest (scenarioId / objectiveId) so "all assets for
// scenario X" queries and §M6 session replay can find them.
//
//   npm run build:assets -- <scenarioId>     (defaults to "cafe")

import "dotenv/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getE3 } from "../adapters/index";
import * as store from "../assets/store";
import { getOrCreateImage, asDataUri } from "../assets/images";
import { IMAGE_FORMAT, referenceSheetPrompt } from "../adapters/image-style";
import { SCENARIOS } from "../scenarios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Args after `--`. tsx forwards them as process.argv from index 2.
const requestedId = process.argv[2] || "cafe";

const scenario = SCENARIOS.find((s) => s.id === requestedId && s.status === "active");
if (!scenario) {
  const active = SCENARIOS.filter((s) => s.status === "active").map((s) => s.id);
  console.error(`No active scenario "${requestedId}". Active: ${active.join(", ") || "(none)"}`);
  process.exit(1);
}

const story = scenario.scene?.story;

// AUDIO: opening + each objective's targetSL + each story-narration sentence. label is for logs only.
const audioItems: { label: string; text: string; objectiveId?: string }[] = [
  { label: "opening", text: scenario.opening },
  ...scenario.objectives.map((o) => ({ label: `audio:objective:${o.id}`, text: o.targetSL, objectiveId: o.id })),
  ...(story?.sentences ?? []).map((s, i) => ({ label: `audio:story[${i}]`, text: s })),
];

// IMAGES (M2/M4): reference sheet FIRST (the consistency anchor), then every frame + the scene
// generated ANCHORED to it — one representative moment per frame, all objects present in the scene.
const assets = scenario.scene?.assets ?? [];
const frames = story?.frames ?? [];
const sceneImagePrompt = story?.sceneImagePrompt;
const imageCount = (assets.length ? 1 : 0) + frames.length + (sceneImagePrompt ? 1 : 0);

const e3 = getE3();
console.log(
  `▶ build:assets  scenario=${scenario.id}  e3=${e3.name}  audio=${audioItems.length}  images=${imageCount}\n`,
);

let hits = 0;
let made = 0;
let failures = 0;

for (const item of audioItems) {
  if (!item.text?.trim()) {
    console.log(`   —  ${item.label}: empty text, skipped`);
    continue;
  }
  const key = store.audioKey(e3.name, e3.voiceTag, item.text);
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

// 1) Reference sheet — the anchor. Generated once, no reference, verbatim prompt (styled: false).
let refImages: string[] | undefined;
if (assets.length) {
  try {
    const { hit, key, bytes } = await getOrCreateImage(referenceSheetPrompt(assets), {
      ...IMAGE_FORMAT.sheet,
      scenarioId: scenario.id,
      objectiveId: "reference-sheet",
      styled: false,
    });
    hit ? hits++ : made++;
    refImages = [asDataUri(bytes)];
    console.log(`   ${hit ? "hit " : "gen "} image:reference-sheet  ${key.slice(0, 12)}…`);
  } catch (err: any) {
    failures++;
    console.log(`   ❌  image:reference-sheet: ${err?.message}`);
  }
}

// 2) Frames — each anchored to the reference sheet (background suppressed, 4:3).
for (const f of frames) {
  try {
    const { hit, key } = await getOrCreateImage(f.imagePrompt, {
      ...IMAGE_FORMAT.frame,
      scenarioId: scenario.id,
      objectiveId: f.objectiveId,
      referenceImages: refImages,
    });
    hit ? hits++ : made++;
    console.log(`   ${hit ? "hit " : "gen "} image:frame:${f.objectiveId}  ${key.slice(0, 12)}…`);
  } catch (err: any) {
    failures++;
    console.log(`   ❌  image:frame:${f.objectiveId}: ${err?.message}`);
  }
}

// 3) Scene — establishing tableau, anchored to the reference sheet (16:9).
if (sceneImagePrompt) {
  try {
    const { hit, key } = await getOrCreateImage(sceneImagePrompt, {
      ...IMAGE_FORMAT.scene,
      scenarioId: scenario.id,
      objectiveId: "scene",
      referenceImages: refImages,
    });
    hit ? hits++ : made++;
    console.log(`   ${hit ? "hit " : "gen "} image:scene  ${key.slice(0, 12)}…`);
  } catch (err: any) {
    failures++;
    console.log(`   ❌  image:scene: ${err?.message}`);
  }
}

console.log(`\nDone. ${made} generated, ${hits} reused (free)` + (failures ? `, ${failures} failed.` : "."));
process.exit(failures > 0 ? 1 : 0);
