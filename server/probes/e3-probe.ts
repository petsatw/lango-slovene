// E3 contract probe — confirms the E3 key + endpoint work and return real audio, against the
// REAL provider. Writes the sample to fixtures/out/e3-probe.mp3 so you can LISTEN once and judge
// native quality by ear (the one human check that matters for E3). NEVER prints the key.

import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getE3 } from "../adapters/index";

const SAMPLE_SL = "Dober dan! Ena kava, prosim. Hvala lepa.";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "..", "fixtures", "out");

const t0 = performance.now();
try {
  const e3 = getE3();
  const { audioBase64, mimeType } = await e3.synthesize({ text: SAMPLE_SL });
  const ms = Math.round(performance.now() - t0);
  const bytes = Buffer.from(audioBase64, "base64");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "e3-probe.mp3");
  writeFileSync(outPath, bytes);
  console.log(`✅ E3 OK  provider=${e3.name}  latency=${ms}ms  bytes=${bytes.length}  mime=${mimeType}`);
  console.log(`   ▶ Listen: ${outPath}  ("${SAMPLE_SL}") — judge native quality by ear.`);
  process.exit(0);
} catch (err: any) {
  console.error(`❌ E3 FAILED  provider=${process.env.E3_PROVIDER || "elevenlabs"}  reason=${err?.message}`);
  process.exit(1);
}
