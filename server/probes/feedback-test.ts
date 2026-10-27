// Acceptance check for the feedback points: a sheet submitted at level end, at "Request this scenario" on a
// finder no-match and from the header link, plus one sheet closed unsent, leave exactly three
// feedback_submitted rows in the event log.
//   npx tsx server/probes/feedback-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "feedback-"));
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

  const practice = await (await fetch(`${base}/api/practice`)).json();
  const lv = practice.scenarios
    .flatMap((sc: any) => sc.dialogues.map((d: any) => ({ sc, d })))
    .find((x: any) => (x.d.advance ?? "tap") === "tap" && !x.d.intro);
  if (!lv) throw new Error("no tap-through level to play");
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  await page.evaluate(() => document.getElementById("scene-quit")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);

  const send = async (text: string) => {
    await page.locator("#feedback-up").click();
    await page.locator("#feedback-text").fill(text);
    await page.locator("#feedback-send").click();
    await page.waitForSelector("#feedback", { state: "hidden" });
  };

  // 1. Header link, from home: a sheet closed without sending, then one sent.
  await page.locator("#header-feedback").click();
  await page.locator("#feedback-down").click();
  await page.locator("#feedback-text").fill("closed unsent");
  await page.locator("#feedback-close").click();
  await page.locator("#header-feedback").click();
  await send("header note");

  // 2. Finder no-match → "Request this scenario".
  await page.locator('.tile[data-go="practice"]').click();
  await page.locator("#finder-input").fill("zxqv wibble frumious");
  await page.locator("#finder-input").press("Enter");
  await page.locator("#finder-request").click();
  await send("a scenario about wibbles");

  // 3. Level end: play a tap-through level to its terminal screen.
  await page.locator(".scenario-card").filter({ hasText: lv.sc.name }).first().click();
  await page.locator("#level-list .level-card").nth(lv.sc.dialogues.indexOf(lv.d)).click();
  for (let i = 0; i < 40 && !(await page.locator("#dialogue-choices.is-terminal").count()); i++) {
    await page.locator("#dialogue-choices .dialogue-choice").first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  if (!(await page.locator("#dialogue-choices.is-terminal").count())) throw new Error("the level did not reach its end");
  await page.locator("#level-feedback").click();
  await send("level note");

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  for (let i = 0; i < 20 && rows().filter((r) => r.name === "feedback_submitted").length < 3; i++) await page.waitForTimeout(250);
  await browser.close();

  const fb = rows().filter((r) => r.name === "feedback_submitted");
  for (const r of fb) console.log([r.ts, r.props.surface, r.props.rating, r.props.hasText, r.text].join("\t"));
  const checks = {
    "exactly three feedback_submitted rows": fb.length === 3,
    "surfaces header, finder_request, level_end": JSON.stringify(fb.map((r) => r.props.surface).sort()) === JSON.stringify(["finder_request", "header", "level_end"]),
    "the unsent sheet recorded nothing": !readFileSync(log, "utf8").includes("closed unsent"),
    "text and rating stored": fb.every((r) => r.props.rating === "up" && r.props.hasText === true && typeof r.text === "string"),
  };
  for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  pass = Object.values(checks).every(Boolean);
} finally {
  child.kill("SIGKILL");
}
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
