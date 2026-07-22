// Dialogue-loader tests — the schema + referential-integrity rules for rehearsal dialogues, focused on
// the `introduces` link that ties a level to catalog learnables (roadmap 12a). Real files, real
// validator, no mocks: the three shipped bakery levels must validate, and a bad `introduces` id must be
// rejected — that rejection is what guarantees "what this dialogue introduces" is always a real set.
// Run: `npm run test:dialogue`.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateDialogue } from "../dialogues";
import { LEARNABLES } from "../learnables";

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name}${detail ? `  — ${detail}` : ""}`);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "..", "dialogues");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const load = (f: string) => JSON.parse(readFileSync(path.join(DIR, f), "utf8"));

console.log("dialogue loader — introduces link:");
{
  // Every shipped dialogue validates, carries an `introduces` array, and every id resolves in the catalog.
  for (const f of files) {
    const raw = load(f);
    let d: any;
    try {
      d = validateDialogue(f, raw);
    } catch (err: any) {
      check(`${f} validates`, false, err?.message);
      continue;
    }
    check(`${f} validates`, true);
    check(`${f} has an introduces array`, Array.isArray(d.introduces));
    check(`${f} introduces only real catalog ids`, d.introduces.every((id: string) => !!LEARNABLES[id]),
      d.introduces.filter((id: string) => !LEARNABLES[id]).join());
  }

  // Negative: an unknown introduces id is rejected (referential integrity — no dangling "introduced" set).
  const base = load(files[0]!);
  let threw = false;
  try {
    validateDialogue("bad.json", { ...base, introduces: ["definitely_not_a_learnable"] });
  } catch {
    threw = true;
  }
  check("unknown introduces id is rejected by the loader", threw);

  // Negative: a non-array introduces is rejected.
  threw = false;
  try {
    validateDialogue("bad.json", { ...base, introduces: "kruh" });
  } catch {
    threw = true;
  }
  check("non-array introduces is rejected", threw);
}

if (failures) {
  console.log(`\n❌ ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\n✅ all dialogue-loader checks passed");
process.exit(0);
