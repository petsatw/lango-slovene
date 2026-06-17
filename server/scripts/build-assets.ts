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
import { getOrCreateImage } from "../assets/images";
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

// IMAGES: one frame per objective + the final all-objectives scene.
const imageItems: { label: string; prompt: string; objectiveId?: string }[] = [
  ...(story?.frames ?? []).map((f) => ({ label: `image:frame:${f.objectiveId}`, prompt: f.imagePrompt, objectiveId: f.objectiveId })),
  ...(story?.sceneImagePrompt ? [{ label: "image:scene", prompt: story.sceneImagePrompt, objectiveId: "scene" }] : []),
];

const e3 = getE3();
console.log(
  `▶ build:assets  scenario=${scenario.id}  e3=${e3.name}  audio=${audioItems.length}  images=${imageItems.length}\n`,
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

for (const item of imageItems) {
  try {
    const { hit, key } = await getOrCreateImage(item.prompt, { scenarioId: scenario.id, objectiveId: item.objectiveId });
    hit ? hits++ : made++;
    console.log(`   ${hit ? "hit " : "gen "} ${item.label}  ${key.slice(0, 12)}…`);
  } catch (err: any) {
    failures++;
    console.log(`   ❌  ${item.label}: ${err?.message}`);
  }
}

console.log(`\nDone. ${made} generated, ${hits} reused (free)` + (failures ? `, ${failures} failed.` : "."));
process.exit(failures > 0 ? 1 : 0);
