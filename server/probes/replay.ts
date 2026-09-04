// Replay harness — the centerpiece verification. Feeds REAL recorded beginner audio clips
// (fixtures/audio/*) through the REAL, unmocked pipeline (E2 audio understanding -> E3 speech).
// Deterministic, repeatable, fast end-to-end proof — without a human talking each run.
//
// This is the deliberate exception to "no fixtures": the fixtures are real captured audio going
// to real services, NOT mock responses standing in for services. We test the actual system.
//
// Record clips with fixtures/README.md, then: npm run replay

import "dotenv/config";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runTurn } from "../orchestrator";
import { DEFAULT_LEARNER_ID } from "../assets/learner";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audioDir = path.join(__dirname, "..", "..", "fixtures", "audio");
const outDir = path.join(__dirname, "..", "..", "fixtures", "out");

// Gemini-supported audio formats only. NOT webm/mp4/m4a — convert those first (see fixtures/README.md).
const MIME_BY_EXT: Record<string, string> = {
  ".wav": "audio/wav",
  ".mp3": "audio/mp3",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
  ".aiff": "audio/aiff",
};

// A soft budget: if total turn time blows past this, the demo will feel laggy.
const LATENCY_BUDGET_MS = 4000;

if (!existsSync(audioDir)) {
  console.error(`No fixtures found. Create ${audioDir} and record clips — see fixtures/README.md`);
  process.exit(1);
}

const files = readdirSync(audioDir).filter((f) => MIME_BY_EXT[path.extname(f).toLowerCase()]);
if (files.length === 0) {
  console.error(`No audio clips in ${audioDir}. See fixtures/README.md`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
console.log(`▶ Replaying ${files.length} real clip(s) through the live pipeline...\n`);

let failures = 0;
let slow = 0;

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  const mimeType = MIME_BY_EXT[ext]!;
  const audioBase64 = readFileSync(path.join(audioDir, file)).toString("base64");

  try {
    const r = await runTurn({ audioBase64, mimeType, history: [], learnerId: DEFAULT_LEARNER_ID });
    const overBudget = r.timings.totalMs > LATENCY_BUDGET_MS;
    if (overBudget) slow++;

    writeFileSync(path.join(outDir, `${path.parse(file).name}.mp3`), Buffer.from(r.audio.audioBase64, "base64"));

    console.log(`▣ ${file}  [${r.providers.e2}+${r.providers.e3}]`);
    console.log(`   heard:   ${r.userSaid}`);
    console.log(`   tutor:   ${r.tutorReply}`);
    console.log(`   correct: ${r.correction || "—"}`);
    console.log(
      `   timing:  e2=${r.timings.e2Ms}ms  e3=${r.timings.e3Ms}ms  total=${r.timings.totalMs}ms` +
        `${overBudget ? `  ⚠ over ${LATENCY_BUDGET_MS}ms budget` : ""}`,
    );
    console.log(`   audio:   fixtures/out/${path.parse(file).name}.mp3\n`);
  } catch (err: any) {
    failures++;
    console.log(`▣ ${file}\n   ❌ FAILED: ${err?.message}\n`);
  }
}

console.log(`Done. ${files.length - failures}/${files.length} passed` + (slow ? `, ${slow} over latency budget.` : "."));
process.exit(failures > 0 ? 1 : 0);
