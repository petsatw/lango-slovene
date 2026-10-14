// Scenario-finder tests (server/match.ts).
//   (unit)   the keyword layer against the REAL scenario + dialogue data (pure, no I/O beyond loading JSON)
//   (--live) the Gemini NLU layer on real Gemini (needs GEMINI_API_KEY; bills a few cheap text calls)
// Run: `npm run test:match`  (add `-- --live` for the real-Gemini leg).

import "dotenv/config";
import { SCENARIOS } from "../scenarios";
import { getPublishedDialogues } from "../dialogues";
import { getE2 } from "../adapters/index";
import { buildIndex, keywordRank, matchSituation, selectMatches, tokenize } from "../match";

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`  ✅ ${name}`);
  else { failures++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const index = buildIndex(
  SCENARIOS.map((s) => ({ id: s.id, name: s.name ?? s.title, title: s.title, role: s.role ?? null,
    summaryEN: s.summaryEN, tags: s.tags, dialogues: getPublishedDialogues(s.id) }))
    .filter((s) => s.dialogues.length > 0),
);
const top = (text: string) => selectMatches(keywordRank(text, index));
const ids = (ms: { dialogueId: string }[]) => ms.map((m) => m.dialogueId).join(", ") || "(none)";

console.log("\n=== match — keyword layer (unit) ===");
check("tokenize strips diacritics + plural", tokenize("Tržnica apples").join(" ") === "trznica apple");

const market = top("buying produce at the farmers market, ordering different weights and numbers of things");
check("farmers market + weights → trznica first", market[0]?.scenarioId === "trznica", ids(market));
check("farmers market → the by-weight level is offered", market.some((m) => m.dialogueId === "trznica-l3"), ids(market));

const permit = top("renew residence permit");
check("residence permit → upravna-enota first", permit[0]?.scenarioId === "upravna-enota", ids(permit));

const coffee = top("I would like to order a coffee");
check("coffee → cafe or restaurant first", ["cafe", "restaurant"].includes(coffee[0]?.scenarioId ?? ""), ids(coffee));

const vet = top("I need to go to the vet");
check("vet → no match (live fallback only)", vet.length === 0, ids(vet));

const offline = await matchSituation("I need to go to the vet", index); // no adapter → keyword path
check("no adapter → ranker=keyword + a fallback scene naming the request",
  offline.ranker === "keyword" && offline.fallback.scene.includes("vet"), JSON.stringify(offline.fallback));

if (process.argv.includes("--live")) {
  console.log("\n=== match — Gemini NLU layer (--live) ===");
  if (!process.env.GEMINI_API_KEY) {
    console.log("  ⏭  skipped: GEMINI_API_KEY not set");
  } else {
    const e2 = getE2();
    const run = (t: string) => matchSituation(t, index, e2);
    const m1 = await run("buying produce at the farmers market, ordering different weights and numbers of things");
    check("live: market → trznica first, ranker=model", m1.ranker === "model" && m1.matches[0]?.scenarioId === "trznica", ids(m1.matches));
    const m2 = await run("renew residence permit");
    check("live: permit → upravna-enota first", m2.matches[0]?.scenarioId === "upravna-enota", ids(m2.matches));
    const m3 = await run("I would like to order a coffee");
    check("live: coffee → cafe/restaurant first", ["cafe", "restaurant"].includes(m3.matches[0]?.scenarioId ?? ""), ids(m3.matches));
    const m4 = await run("I need to go to the vet");
    check("live: vet → no level above threshold + a vet fallback scene",
      m4.matches.length === 0 && /vet/i.test(m4.fallback.scene), `${ids(m4.matches)} | ${m4.fallback.scene}`);
  }
}

console.log(failures ? `\n${failures} failure(s).` : "\nAll match tests passed.");
process.exit(failures ? 1 : 0);
