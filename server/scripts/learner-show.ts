// Print the learner model on disk (US-17 inspection, CLI form). Read-only; bills nothing. Reads
// assets/learner.json (override with LEARNER_PATH) — the file store, which is the operator's own model
// and what a server run with LEARNER_STORE=file writes. Run: `npm run learner`.

import "dotenv/config";

process.env.LEARNER_STORE = "file"; // the file IS what this script is for
import * as learner from "../assets/learner";
import { inspect } from "../mastery";
import { FACTS } from "../facts";

const model = learner.load(learner.DEFAULT_LEARNER_ID);
const view = inspect(model);
const { mastered, attempted } = view.counts;

console.log(`Learner model — threshold ${view.threshold}`);
console.log(`  mastered ${mastered} · attempted ${attempted}`);

// What the course knows about the PERSON, beside what they can say. It decides which form of a line they
// are shown and hear (server/facts.ts), so an operator reading a lesson back needs it in the same view.
const answered = Object.entries(model.facts);
console.log(`\nAbout the learner`);
if (answered.length === 0) {
  console.log(`  (nothing asked yet — every line plays in its base form)`);
} else {
  for (const [id, value] of answered) {
    const fact = FACTS[id];
    const label = fact?.values.find((v) => v.value === value)?.label ?? value;
    console.log(`  ${id.padEnd(18)} ${label}  (stored as "${value}")`);
  }
}
console.log("");
if (view.learnables.length === 0) {
  console.log("  (no learnables practised yet)");
} else {
  // Only learnables the learner has produced are listed, so a row is one of two things.
  for (const l of view.learnables) {
    console.log(
      `  ${l.status === "mastered" ? "●" : "◐"} ${l.id.padEnd(18)} ${String(l.successes)}/${view.threshold}` +
        `  (att ${l.attempts})  ${l.kind} "${l.sl}"`,
    );
  }
}
