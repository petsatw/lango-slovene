// Print the durable learner model (US-17 inspection, CLI form). Read-only; bills nothing. Reads the
// same assets/learner.json the turn loop writes (override with LEARNER_PATH). Run: `npm run learner`.

import "dotenv/config";
import * as learner from "../assets/learner";
import { inspect } from "../mastery";

const view = inspect(learner.load());
const { owned, shaky, unseen } = view.counts;

console.log(`Learner model — threshold ${view.threshold}`);
console.log(`  owned ${owned} · shaky ${shaky} · unseen ${unseen}`);
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
