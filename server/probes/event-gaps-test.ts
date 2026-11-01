// Acceptance check for the event gaps: a live handoff from a tap level, finder searches that settle while
// typing, and a level opened from a finder match each leave exactly one row in the log. A search that is
// cleared, left or opened before it settles records nothing, and no row or event payload holds query text.
//   npx tsx server/probes/event-gaps-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "event-gaps-"));
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], {
  env: { ...process.env, PORT: String(port), DATA_DIR: data, TESTER_CODES: "TEST-01" },
  stdio: "ignore",
});

async function up() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start");
}

const NO_MATCH = "zxqv wibble frumious";
const CLEARED = "qqzx plonk";
const LEFT = "vvkk blorp";
const log = path.join(data, "events", "events.jsonl");
const rows = () => {
  try { return readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
};

let pass = false;
try {
  await up();
  const practice = await (await fetch(`${base}/api/practice`)).json();
  const lv = practice.domains
    .flatMap((sc: any) => sc.dialogues.map((d: any) => ({ sc, d })))
    .find((x: any) => (x.d.advance ?? "tap") !== "audio" && !x.d.intro && x.d.introduces?.length);
  if (!lv) throw new Error("no tap level with introduces");
  const index = await (await fetch(`${base}/api/match/index`)).json();
  const entry = index.entries.find((e: any) => e.dialogueId === lv.d.id);
  const word = entry?.nodes.flatMap((n: any) => n.tokens).find((t: string) => t.length > 3 && /^[a-z]+$/.test(t) && !t.endsWith("s"));
  if (!word) throw new Error("no line word for the finder match");
  const MATCH = `${lv.sc.name} ${word}`;
  const QUERIES = [NO_MATCH, CLEARED, LEFT, MATCH];

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const payloads: string[] = [];
  page.on("request", (r) => { if (r.url().endsWith("/api/event")) payloads.push(r.postData() || ""); });
  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  await page.evaluate(() => document.getElementById("scene-quit")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);

  // Handoff from a tap level.
  await page.locator('.tile[data-go="practice"]').click();
  await page.locator(".domain-card").filter({ hasText: lv.sc.name }).first().click();
  await page.locator("#level-list .level-card").nth(lv.sc.dialogues.indexOf(lv.d)).click();
  await page.locator("#dialogue-handoff").click();
  await page.waitForFunction(() => !document.getElementById("tutor")!.hidden);
  await page.evaluate(() => document.getElementById("back")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);

  // Finder, no match: typed query settles by the timer; Enter on the same query adds nothing.
  await page.locator('.tile[data-go="practice"]').click();
  const input = page.locator("#finder-input");
  await input.pressSequentially(NO_MATCH, { delay: 20 });
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => /No lessons match/.test(document.getElementById("finder-results")!.textContent || ""));
  await input.press("Enter");
  await page.waitForFunction(() => !/Finding the best match/.test(document.getElementById("finder-results")!.textContent || ""));

  // Unsettled searches record nothing: one cleared before the second is up, one left by going home.
  await input.fill("");
  await input.pressSequentially(CLEARED, { delay: 20 });
  await input.fill("");
  await page.waitForTimeout(1500);
  await input.pressSequentially(LEFT, { delay: 20 });
  await page.evaluate(() => document.getElementById("back")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);
  await page.waitForTimeout(1500);
  await page.locator('.tile[data-go="practice"]').click();

  // Finder, match: the domain name plus a word from one of the level's lines, so its card carries a
  // snippet and opens at that line (openLevelAt). The settled count is the number of cards shown.
  const card = page.locator("#finder-results .level-card").filter({ hasText: lv.d.title });
  await input.fill("");
  await input.pressSequentially(MATCH, { delay: 20 });
  await page.waitForTimeout(1500);
  await card.first().waitFor();
  const shown = await page.locator("#finder-results .level-card").count();

  // The same search in capitals is a distinct query; opening its match before it settles records no search.
  await input.fill("");
  await input.pressSequentially(MATCH.toUpperCase(), { delay: 10 });
  await card.first().click();
  await page.waitForFunction(() => !document.getElementById("dialogue")!.hidden);
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  for (let i = 0; i < 20 && !rows().some((r) => r.name === "finder_match_opened"); i++) await page.waitForTimeout(250);
  await browser.close();

  const all = rows();
  for (const r of all) console.log([r.name, JSON.stringify(r.props)].join("\t"));
  const q = all.filter((r) => r.name === "finder_query");
  const opened_i = all.findIndex((r) => r.name === "finder_match_opened");
  const startedAfter = opened_i >= 0 ? all.slice(opened_i + 1).filter((r) => r.name === "level_started") : [];
  // Each level_started is closed by one level_completed or level_abandoned before the next one begins.
  let open = false, paired = true;
  for (const r of all) {
    if (r.name === "level_started") { if (open) paired = false; open = true; }
    if (r.name === "level_completed" || r.name === "level_abandoned") { if (!open) paired = false; open = false; }
  }
  const leaks = (s: string) => QUERIES.some((t) => s.toLowerCase().includes(t.toLowerCase()));
  const checks = {
    "one handoff_tapped, from level": all.filter((r) => r.name === "handoff_tapped").length === 1
      && all.some((r) => r.name === "handoff_tapped" && r.props?.from === "level"),
    "two settled finder_query (no-match, then match)": q.length === 2 && q[0].props?.resultCount === 0 && q[1].props?.resultCount > 0,
    "resultCount equals the cards shown": q[1]?.props?.resultCount === shown,
    "one finder_no_match": all.filter((r) => r.name === "finder_no_match").length === 1,
    "one finder_match_opened": all.filter((r) => r.name === "finder_match_opened").length === 1,
    "one level_started after finder_match_opened": startedAfter.length === 1
      && startedAfter[0].props?.domainId === all[opened_i].props?.domainId && startedAfter[0].props?.level === lv.d.level,
    "level_started pairs with completed/abandoned": paired,
    "no query text in the log": !leaks(readFileSync(log, "utf8")),
    "no query text in event payloads": payloads.length > 0 && !payloads.some(leaks),
  };
  for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  pass = Object.values(checks).every(Boolean);
} finally {
  child.kill("SIGKILL");
}
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
