// Download the prebuilt scenario assets (scene images + audio) into the local store, so the
// ready-made scenarios work without paying to regenerate images. The bundle is content-addressed
// the same way the store is (provider|model|style|prompt), so a clip/image only counts as a "hit"
// when your config matches the bundle's — i.e. the DEFAULT providers in example-vars. Change the
// voice/model/E4 provider or IMAGE_STYLE.id and those assets simply regenerate on demand.
//
//   npm run fetch:assets
//   ASSET_BUNDLE_URL=<url> npm run fetch:assets     # override the source (e.g. a paid bundle)
//   ASSET_DIR=/path npm run fetch:assets            # override the destination (matches store.ts)

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = process.env.ASSET_DIR
  ? path.resolve(process.env.ASSET_DIR)
  : path.join(__dirname, "..", "..", "assets");

const BUNDLE_URL =
  process.env.ASSET_BUNDLE_URL ||
  "https://github.com/petsatw/lango-slovene/releases/download/assets-v2/scenario-assets-v2.tgz";

console.log(`Fetching prebuilt assets\n  from: ${BUNDLE_URL}\n  into: ${ASSET_DIR}\n`);

const res = await fetch(BUNDLE_URL);
if (!res.ok) {
  console.error(
    `Download failed: HTTP ${res.status} ${res.statusText}\n` +
      `If the release isn't published yet, generate assets locally instead:\n` +
      `  npm run build:assets -- cafe   (then bakery, butcher)`,
  );
  process.exit(1);
}

const tmp = path.join(os.tmpdir(), `lango-assets-${Date.now()}.tgz`);
writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
mkdirSync(ASSET_DIR, { recursive: true });

try {
  // tar ships on macOS, Linux, and Windows 10+; unpacks audio/, image/, manifest.jsonl into ASSET_DIR.
  execFileSync("tar", ["xzf", tmp, "-C", ASSET_DIR], { stdio: "inherit" });
} catch (err: any) {
  console.error(`Extract failed (is 'tar' on your PATH?): ${err?.message}`);
  process.exit(1);
}

console.log(
  `\nDone — assets unpacked into ${ASSET_DIR}.\n` +
    `These match the default providers in example-vars. Run \`npm run dev\` and pick a scenario.`,
);
