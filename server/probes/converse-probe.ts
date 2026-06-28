// Free-conversation probe — runs a REAL student clip through the scenario-less converse() path on real
// Gemini and prints the reply + the per-learnable verdicts credited to the durable model. No mocks.
// Uses fixtures/out/e3-probe.mp3 (run `npm run probe:e3` first). Writes to a TEMP learner model so it
// never pollutes the real assets/learner.json.

import "dotenv/config";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clip = path.join(__dirname, "..", "..", "fixtures", "out", "e3-probe.mp3");

if (!existsSync(clip)) {
  console.error(`Need a student clip at ${clip}. Run: npm run probe:e3`);
  process.exit(1);
}

const dir = mkdtempSync(path.join(os.tmpdir(), "converse-probe-"));
process.env.LEARNER_PATH = path.join(dir, "learner.json");

try {
  const { converse } = await import("../orchestrator");
  const learner = await import("../assets/learner");
  const { applyCredit } = await import("../mastery");
  const audioBase64 = readFileSync(clip).toString("base64");

  // Seed a little history so the conversation is in-reach of what the fixture actually says ("Dober dan…
  // kava…") — free conversation is normally entered AFTER some scenario practice, not from zero.
  learner.save(
    applyCredit(learner.load(), [
      { id: "dober_dan", result: "attempt" },
      { id: "kava", result: "attempt" },
    ]),
  );

  const r = await converse({ audioBase64, mimeType: "audio/mp3", history: [], level: 2 });
  console.log(`✅ converse turn OK  e2=${r.timings.e2Ms}ms`);
  console.log(`   verbatim: ${r.userVerbatim}`);
  console.log(`   english:  ${r.userSaid}`);
  console.log(`   tutor:    ${r.tutorReply}`);
  console.log(`   recast:   ${r.correction || "—"}`);
  console.log(`   learnable_progress: ${r.learnableProgress.map((p) => `${p.id}:${p.result}`).join("  ") || "(none)"}`);

  const model = learner.load();
  const credited = Object.keys(model.learnables).length;
  if (!r.tutorReply.trim()) throw new Error("empty tutor reply");
  console.log(`   durable model now tracks ${credited} learnable(s)`);
  process.exit(0);
} catch (err: any) {
  console.error(`❌ converse probe FAILED: ${err?.message}`);
  process.exit(1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
