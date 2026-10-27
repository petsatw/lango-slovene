// Acceptance check for events: a fresh browser opened on an invite link plays a level to its close and
// submits a finder search with no match; the log on the volume holds the journey in order, every row
// stamped with one learnerId and the tester code, and none of it holds the query text.
//   npx tsx server/probes/events-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "events-"));
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

const QUERY = "zxqv wibble frumious";
const log = path.join(data, "events", "events.jsonl");
const rows = () => {
  try { return readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
};

let pass = false;
try {
  await up();
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${base}/?c=TEST-01`);

  // A new learner is put into their first lesson; leave it, then play a tap-through level to its end.
  const practice = await (await fetch(`${base}/api/practice`)).json();
  const lv = practice.scenarios
    .flatMap((sc: any) => sc.dialogues.map((d: any) => ({ sc, d })))
    .find((x: any) => (x.d.advance ?? "tap") === "tap" && !x.d.intro);
  if (!lv) throw new Error("no tap-through level to play");
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  await page.evaluate(() => document.getElementById("scene-quit")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);
  await page.locator('.tile[data-go="practice"]').click();
  await page.locator(".scenario-card").filter({ hasText: lv.sc.name }).first().click();
  await page.locator("#level-list .level-card").nth(lv.sc.dialogues.indexOf(lv.d)).click();
  for (let i = 0; i < 40 && !(await page.locator("#dialogue-choices.is-terminal").count()); i++) {
    await page.locator("#dialogue-choices .dialogue-choice").first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  if (!(await page.locator("#dialogue-choices.is-terminal").count())) throw new Error("the level did not reach its end");
  await page.locator("#dialogue-close").click();
  await page.locator("#back").click();
  await page.locator("#back").click();
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);
  await page.locator('.tile[data-go="practice"]').click();
  await page.locator("#finder-input").fill(QUERY);
  await page.locator("#finder-input").press("Enter");
  await page.waitForFunction(() => /No lessons match/.test(document.getElementById("finder-results")!.textContent || ""));

  // The client sends on a 10 s timer and when hidden; hide the page to flush the rest.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  for (let i = 0; i < 20 && !rows().some((r) => r.name === "finder_no_match"); i++) await page.waitForTimeout(250);
  await browser.close();

  const all = rows();
  for (const r of all) console.log([r.ts, r.learnerId, r.testerCode ?? "-", r.name, JSON.stringify(r.props)].join("\t"));

  const wanted = ["app_open", "tester_code_seen", "level_started", "level_completed", "finder_query", "finder_no_match"];
  let at = -1;
  const inOrder = wanted.every((n) => (at = all.findIndex((r, i) => i > at && r.name === n)) >= 0);
  const checks = {
    "journey events in order": inOrder,
    "one learnerId": new Set(all.map((r) => r.learnerId)).size === 1 && /^t-[0-9a-f]{16}$/.test(all[0]?.learnerId),
    "testerCode TEST-01 on every row": all.length > 0 && all.every((r) => r.testerCode === "TEST-01"),
    "no finder query text in the log": !readFileSync(log, "utf8").includes("wibble"),
  };
  for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  pass = Object.values(checks).every(Boolean);
} finally {
  child.kill("SIGKILL");
}
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
