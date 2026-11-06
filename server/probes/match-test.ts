// Domain-finder tests (server/match.ts): the keyword layer against the REAL domain + dialogue data
// (pure, no I/O beyond loading JSON).
// Run: `npm run test:match`

import { DOMAINS } from "../domains";
import { getPublishedDialogues } from "../dialogues";
import { buildIndex, keywordRank, matchSituation, selectMatches } from "../match";

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`  ✅ ${name}`);
  else { failures++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const index = buildIndex(
  DOMAINS.map((s) => ({ id: s.id, name: s.name ?? s.title, title: s.title, role: s.role ?? null,
    summaryEN: s.summaryEN, tags: s.tags, dialogues: getPublishedDialogues(s.id) }))
    .filter((s) => s.dialogues.length > 0),
);
const top = (text: string) => selectMatches(keywordRank(text, index));
const ids = (ms: { dialogueId: string }[]) => ms.map((m) => m.dialogueId).join(", ") || "(none)";

console.log("\n=== match — keyword layer (unit) ===");

const market = top("buying produce at the farmers market, ordering different weights and numbers of things");
check("farmers market + weights → trznica first", market[0]?.domainId === "trznica", ids(market));
check("farmers market → the by-weight level is offered", market.some((m) => m.dialogueId === "trznica-l3"), ids(market));

const permit = top("renew residence permit");
check("residence permit → upravna-enota first", permit[0]?.domainId === "upravna-enota", ids(permit));

const coffee = top("I would like to order a coffee");
check("coffee → cafe or restaurant first", ["cafe", "restaurant"].includes(coffee[0]?.domainId ?? ""), ids(coffee));

const sn = coffee[0]?.snippet;
check("coffee → snippet from a restaurant line containing kava/kavo",
  coffee[0]?.domainId === "restaurant" && !!sn && /\bkav[oa]\b/i.test(sn.lines[0]?.sl ?? ""), JSON.stringify(sn));
check("coffee snippet: node is a real line of that level + 'coffee' is a highlight term",
  !!sn && index.find((e) => e.dialogueId === coffee[0]!.dialogueId)!.nodes.some((n) => n.id === sn.nodeId) && sn.terms.includes("coffee"),
  JSON.stringify(sn));
check("top market + permit matches carry a snippet", !!market[0]?.snippet && !!permit[0]?.snippet, ids(market));
check("kilo of tomatoes → trznica-l3 with the tomato line", top("kilo of tomatoes")[0]?.snippet?.lines[0]?.sl.includes("paradižnika") === true, ids(top("kilo of tomatoes")));

const coffeeOne = top("coffee");
check("single word 'coffee' → restaurant with a kava/kavo snippet",
  coffeeOne[0]?.domainId === "restaurant" && /\bkav[oa]\b/i.test(coffeeOne[0]?.snippet?.lines[0]?.sl ?? ""), ids(coffeeOne));

const vet = top("I need to go to the vet");
check("vet → no match (live fallback only)", vet.length === 0, ids(vet));

const offline = await matchSituation("I need to go to the vet", index); // no adapter → keyword path
check("no adapter → ranker=keyword + a fallback scene naming the request",
  offline.ranker === "keyword" && offline.fallback.scene.includes("vet"), JSON.stringify(offline.fallback));

console.log(failures ? `\n${failures} failure(s).` : "\nAll match tests passed.");
process.exit(failures ? 1 : 0);
