// Delete everything held about one learner — the same function "Delete my data" calls, for a request that
// arrives by email. Run: `npm run delete-learner -- <code or learnerId>`.

import "dotenv/config";
import { createHash } from "node:crypto";
import { deleteLearner } from "../assets/deletion";

const arg = process.argv[2]?.trim();
if (!arg) {
  console.error("usage: npm run delete-learner -- <code or learnerId>");
  process.exit(1);
}
const learnerId = /^t-[0-9a-f]{16}$/.test(arg) ? arg : "t-" + createHash("sha256").update(arg).digest("hex").slice(0, 16);
deleteLearner(learnerId);
console.log(`deleted ${learnerId}`);
