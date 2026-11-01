// Acceptance check for the event gaps: a live handoff from a tap level, finder searches that settle while
// typing, and a level opened from a finder match each leave a row in the log; no row holds the query text.
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
const log = path.join(data, "events", "events.jsonl");
const rows = () => {
  try { return readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
};

let pass = false;
try {
  await up();
  const practice = await (await fetch(`${base}/api/practice`)).json();
  const lv = practice.scenarios
    .flatMap((sc: any) => sc.dialogues.map((d: any) => ({ sc, d })))
    .find((x: any) => (x.d.advance ?? "tap") !== "audio" && !x.d.intro && x.d.introduces?.length);
  if (!lv) throw new Error("no tap level with introduces");

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  await page.evaluate(() => document.getElementById("scene-quit")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);

  // Handoff from a tap level.
  await page.locator('.tile[data-go="practice"]').click();
  await page.locator(".scenario-card").filter({ hasText: lv.sc.name }).first().click();
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

  // Finder, match: type a tap level's scenario name and open a match.
  await input.fill("");
  await input.pressSequentially(lv.sc.name, { delay: 20 });
  await page.waitForTimeout(1500);
  await page.waitForSelector("#finder-results .level-card");
  const cards = page.locator("#finder-results .level-card");
  let opened = false;
  for (let i = 0; i < (await cards.count()) && !opened; i++) {
    await cards.nth(i).click();
    opened = await page.waitForFunction(() => !document.getElementById("dialogue")!.hidden, null, { timeout: 2000 }).then(() => true, () => false);
    if (!opened) {
      await page.evaluate(() => document.getElementById("back")!.click());
      await page.waitForFunction(() => !document.getElementById("practice")!.hidden);
    }
  }
  if (!opened) throw new Error("no finder match opened a tap level");

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  for (let i = 0; i < 20 && !rows().some((r) => r.name === "level_started" && rows().some((q) => q.name === "finder_match_opened")); i++) await page.waitForTimeout(250);
  await browser.close();

  const all = rows();
  for (const r of all) console.log([r.name, JSON.stringify(r.props)].join("\t"));
  const q = all.filter((r) => r.name === "finder_query");
  const opened_i = all.findIndex((r) => r.name === "finder_match_opened");
  const after = opened_i >= 0 ? all.slice(opened_i + 1).find((r) => r.name === "level_started") : undefined;
  const checks = {
    "handoff_tapped from level": all.some((r) => r.name === "handoff_tapped" && r.props?.from === "level"),
    "one no-match finder_query": q.filter((r) => r.props?.resultCount === 0).length === 1,
    "one finder_no_match": all.filter((r) => r.name === "finder_no_match").length === 1,
    "matching finder_query": q.some((r) => r.props?.resultCount > 0),
    "level_started after finder_match_opened": !!after && after.props?.scenarioId === all[opened_i].props?.scenarioId && after.props?.level != null,
    "no query text in the log": !/wibble/.test(readFileSync(log, "utf8")),
  };
  for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  pass = Object.values(checks).every(Boolean);
} finally {
  child.kill("SIGKILL");
}
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
