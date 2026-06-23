// Re-key utility (asset-store maintenance). Image keys are the LITERAL prompt, so any system-wide
// prompt change re-keys every affected image. When such a change leaves the PICTURE correct — a
// normalization of phrasing / ordering / style, not a depiction change — regenerating is waste. RE-KEY
// instead: copy the existing good bytes to the new prompt's key. Free, additive (old keys left in
// place), idempotent. Images whose depiction actually changed are reported as "RE-RENDER" and left
// untouched (they need build:assets).
//
// Each migration needs a "same picture?" rule. The current pass handles the {{TOKEN}} reference-brace
// addition: an image is unchanged iff its old recorded prompt equals the de-braced new prompt. Add a
// new rule here when a future normalization lands.
//
//   npm run rekey:assets             # dry run — what would be re-keyed vs needs re-render
//   npm run rekey:assets -- --apply  # copy the bytes to the new keys

import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import * as store from "../assets/store";
import { getE4 } from "../adapters/index";
import { IMAGE_STYLE, IMAGE_FORMAT, stripTokens } from "../adapters/image-style";
import { SCENARIOS } from "../scenarios";

const apply = process.argv.slice(2).includes("--apply");
const e4 = getE4();
const keyFor = (prompt: string, fmt: { aspectRatio: string; resolution: string }) =>
  store.imageKey(e4.name, e4.model, IMAGE_STYLE.id, fmt.aspectRatio, fmt.resolution, prompt);

const manifestPath = path.join(store.ASSET_DIR, "manifest.jsonl");
const manifest: any[] = existsSync(manifestPath)
  ? readFileSync(manifestPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];

let rekeyed = 0;
let present = 0;
let render = 0;
const renderList: string[] = [];

console.log(`\n=== rekey:assets (${IMAGE_STYLE.id})${apply ? "  --apply" : "  (dry run)"} ===`);

for (const s of SCENARIOS.filter((s) => s.status === "active")) {
  const story = s.scene?.story;
  if (!story) continue;
  const items = [
    ...story.frames.map((f) => ({ objectiveId: f.objectiveId, prompt: f.imagePrompt, fmt: IMAGE_FORMAT.frame })),
    ...(story.sceneImagePrompt ? [{ objectiveId: "scene", prompt: story.sceneImagePrompt, fmt: IMAGE_FORMAT.scene }] : []),
  ];
  for (const it of items) {
    const newKey = keyFor(it.prompt, it.fmt);
    if (store.has(newKey, "image")) {
      present++;
      console.log(`   present  ${s.id}/${it.objectiveId}  ${newKey.slice(0, 12)}…`);
      continue;
    }
    // The same picture iff its only change is the {{ }} notation: stripped new prompt == an old render's
    // prompt. Match by prompt CONTENT across all scenarios — frames with identical prompts (greet,
    // ask_price, pay_leave) are one shared image (content-addressed), as they were before.
    const target = stripTokens(it.prompt);
    const old = manifest.find((e) => e.type === "image" && e.prompt === target && store.has(e.key, "image"));
    if (old) {
      rekeyed++;
      console.log(`   ${apply ? "rekey  " : "would  "} ${s.id}/${it.objectiveId}  ${old.key.slice(0, 10)}… → ${newKey.slice(0, 10)}…`);
      if (apply) {
        const bytes = store.read(old.key, "image")!;
        store.put(newKey, "image", bytes, {
          provider: old.provider,
          voiceOrModel: old.voiceOrModel,
          prompt: it.prompt, // the literal new prompt (braces) this key now represents
          styleId: IMAGE_STYLE.id,
          aspectRatio: it.fmt.aspectRatio,
          resolution: it.fmt.resolution,
          mimeType: old.mimeType || "image/jpeg",
          scenarioId: s.id,
          objectiveId: it.objectiveId,
          referenceKeys: [old.key], // provenance: re-keyed from this old render
        });
      }
    } else {
      render++;
      renderList.push(`${s.id}/${it.objectiveId}`);
      console.log(`   RE-RENDER ${s.id}/${it.objectiveId}  (content changed — needs build:assets)`);
    }
  }
}

console.log(
  `\n${apply ? "Re-keyed" : "Would re-key"} ${rekeyed} image(s); ${present} already present; ` +
    `${render} need re-render${renderList.length ? ` (${renderList.join(", ")})` : ""}.`,
);
if (!apply && rekeyed) console.log(`Run with --apply to copy the bytes.`);
