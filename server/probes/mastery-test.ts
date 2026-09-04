// Mastery-loop probe — runs a REAL student clip through the session-aware understand() and prints
// the tutor reply, the recast, and the per-objective progress + updated session. No mocks.
// Uses fixtures/out/e3-probe.mp3 ("Dober dan! Ena kava, prosim. Hvala lepa.") — note the deliberate
// beginner error "ena kava", which should be recast to "eno kavo". Run `npm run probe:e3` first.

import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { understand } from "../orchestrator";
import { getScenario, freshSession } from "../scenarios";
import { DEFAULT_LEARNER_ID } from "../assets/learner";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clip = path.join(__dirname, "..", "..", "fixtures", "out", "e3-probe.mp3");

if (!existsSync(clip)) {
  console.error(`Need a student clip at ${clip}. Run: npm run probe:e3`);
  process.exit(1);
}

const scenario = getScenario("cafe");
const audioBase64 = readFileSync(clip).toString("base64");

try {
  const r = await understand({ audioBase64, mimeType: "audio/mp3", history: [], session: freshSession(scenario),
                              learnerId: DEFAULT_LEARNER_ID });
  console.log(`✅ mastery turn OK  e2=${r.timings.e2Ms}ms`);
  console.log(`   verbatim: ${r.userVerbatim}`);
  console.log(`   english:  ${r.userSaid}`);
  console.log(`   tutor:    ${r.tutorReply}`);
  console.log(`   recast:   ${r.correction || "—"}`);
  console.log(`   progress: ${r.session.objectives.map((o) => `${o.id}:${o.status}`).join("  ")}`);
  console.log(`   complete: ${r.session.complete}`);
  process.exit(0);
} catch (err: any) {
  console.error(`❌ mastery turn FAILED: ${err?.message}`);
  process.exit(1);
}
