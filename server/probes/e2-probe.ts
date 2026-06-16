// E2 contract probe — confirms the E2 key + endpoint actually work, against the REAL provider.
// Credential/reachability check only (text ping); the audio path is exercised by `npm run replay`.
// Prints provider name + latency + a one-word reply. NEVER prints the key.

import "dotenv/config";
import { getE2 } from "../adapters/index";

const t0 = performance.now();
try {
  const e2 = getE2();
  const reply = await e2.ping();
  const ms = Math.round(performance.now() - t0);
  console.log(`✅ E2 OK  provider=${e2.name}  latency=${ms}ms  reply="${reply}"`);
  process.exit(0);
} catch (err: any) {
  console.error(`❌ E2 FAILED  provider=${process.env.E2_PROVIDER || "gemini"}  reason=${err?.message}`);
  process.exit(1);
}
