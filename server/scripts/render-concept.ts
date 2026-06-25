// Generate the canonical render for COMPOSED catalog concept(s) — greet/leave, or a location like `cafe`.
// The composition logic lives in assets/compose.ts (shared with the scenario build, where a scene anchors
// on a location concept's render). Here we just drive it per id, honoring --force.
//
//   npm run render:concept -- greet cafe            # render (skips if the image already exists)
//   npm run render:concept -- cafe --force          # delete + regenerate (use when constituents changed)
//
// Billed: one E4 call per concept that actually renders (plus any missing constituent renders).

import "dotenv/config";
import * as store from "../assets/store";
import { getConcept, CATALOG } from "../catalog";
import { renderConcept, conceptRenderKey } from "../assets/compose";

const args = process.argv.slice(2);
const force = args.includes("--force");
const ids = args.filter((a) => !a.startsWith("--"));
if (!ids.length) {
  console.error(`usage: npm run render:concept -- <conceptId> [<conceptId> …] [--force]\n  known: ${Object.keys(CATALOG.concepts).join(", ")}`);
  process.exit(1);
}

for (const id of ids) {
  const concept = getConcept(id);
  if (force) {
    const key = conceptRenderKey(concept);
    if (store.has(key, "image")) {
      store.remove(key, "image");
      console.log(`   forced regen: removed existing ${key.slice(0, 12)}…`);
    }
  }
  const { hit, key, label } = await renderConcept(concept);
  console.log(`${hit ? "· cached " : "✓ rendered"} concept ${id}  ${label}  → ${key.slice(0, 12)}…  (built-from ${concept.composedFrom.join(", ")})`);
}
console.log("done.");
