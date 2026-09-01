// Print the durable learner model (US-17 inspection, CLI form). Read-only; bills nothing. Reads the
// same assets/learner.json the turn loop writes (override with LEARNER_PATH). Run: `npm run learner`.

import "dotenv/config";
import * as learner from "../assets/learner";
import { inspect } from "../mastery";
import { FACTS } from "../facts";

const model = learner.load();
const view = inspect(model);
const { owned, shaky, unseen } = view.counts;

console.log(`Learner model — threshold ${view.threshold}`);
console.log(`  owned ${owned} · shaky ${shaky} · unseen ${unseen}`);

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
  const mark = { mastered: "●", attempted: "◐", unseen: "○" } as const;
  for (const l of view.learnables) {
    console.log(
      `  ${mark[l.status]} ${l.id.padEnd(18)} ${String(l.successes)}/${view.threshold}` +
        `  (att ${l.attempts})  ${l.kind} "${l.sl}"`,
    );
  }
}
