// Acceptance check for live access (docs/features/tester-identity/spec.md §5): Go Live opens a masked
// access code sheet when the browser holds no code, a wrong code gets a plain line, and an allowlisted
// tester code opens live with no sheet. No provider keys: a passed gate answers 503, never 403.
//   npx tsx server/probes/live-access-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium, type Page } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "live-access-"));
const env = { ...process.env, PORT: String(port), DATA_DIR: data, LIVE_ACCESS_CODE: "GOOD-CODE", TESTER_CODES: "TEST-01" };
for (const k of ["GEMINI_API_KEY", "GOOGLE_API_KEY", "XAI_API_KEY", "GROK_API_KEY"]) delete env[k];
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], { env, stdio: "ignore" });

async function up() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start");
}

const lesson = "slavko-intro";
const checks: Record<string, boolean> = {};

/** Fresh profile → Live AI tutor → Go Live → past the start screen; resolves with the create call's status. */
async function goLive(page: Page): Promise<number> {
  const created = () => page.waitForResponse((r) => r.url().endsWith("/v1/live/sessions") && r.request().method() === "POST", { timeout: 4000 });
  await page.click('[data-go="tutor"]');
  await page.click("#consent-continue");
  await page.click("#practice-talk");
  return (await created().catch(() => null))?.status() ?? 0;
}

try {
  await up();
  const browser = await chromium.launch();
  const dialogs: string[] = [];
  const open = async (url: string) => {
    const page = await (await browser.newContext()).newPage();
    page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss(); });
    await page.goto(url);
    // A learner with no history meets the scene first; leave it for the home tiles.
    await page.waitForSelector("#scene:not([hidden])", { timeout: 8000 }).then(() => page.click("#scene-quit"), () => {});
    return page;
  };

  // 1–3: no code
  const a = await open(`${base}/?lesson=${lesson}`);
  const sheetOpened = a.waitForSelector("#access:not([hidden])", { timeout: 4000 }).then(() => true, () => false);
  await a.click('[data-go="tutor"]');
  await a.click("#consent-continue");
  await a.click("#practice-talk");
  checks["1 sheet opens"] = await sheetOpened;
  checks["1 field is password, labelled, no placeholder"] =
    (await a.getAttribute("#access-code", "type")) === "password" &&
    (await a.locator("label[for=access-code]").innerText()) === "Live tutor access code" &&
    !(await a.getAttribute("#access-code", "placeholder"));
  checks["1 Unlock disabled"] = await a.isDisabled("#access-unlock");

  const wrongRes = a.waitForResponse((r) => r.url().endsWith("/v1/live/sessions") && r.request().method() === "POST");
  await a.fill("#access-code", "WRONG");
  await a.click("#access-unlock");
  const wrong = (await wrongRes).status();
  await a.waitForSelector("#access-error:not([hidden])");
  checks["2 create answers 403"] = wrong === 403;
  checks["2 plain line shown"] = (await a.innerText("#access-error")) === "That code isn't recognised.";
  checks["2 field empty"] = (await a.inputValue("#access-code")) === "";
  checks["2 liveAccessCode cleared"] = (await a.evaluate(() => localStorage.getItem("liveAccessCode"))) === null;
  checks["2 page text has no 'forbidden'"] = !/forbidden/i.test(await a.innerText("body"));

  const goodRes = a.waitForResponse((r) => r.url().endsWith("/v1/live/sessions") && r.request().method() === "POST");
  await a.fill("#access-code", "GOOD-CODE");
  await a.click("#access-unlock");
  const good = (await goodRes).status();
  checks["3 create answers non-403"] = good !== 403;
  checks["3 liveAccessCode stored"] = (await a.evaluate(() => localStorage.getItem("liveAccessCode"))) === "GOOD-CODE";

  // 4: tester code
  const b = await open(`${base}/?c=TEST-01&lesson=${lesson}`);
  const status = await goLive(b);
  checks["4 no sheet"] = await b.isHidden("#access");
  checks["4 create answers non-403"] = status !== 0 && status !== 403;

  checks["no dialog fired"] = dialogs.length === 0;
  await browser.close();

  // 5: events
  const rows = readFileSync(path.join(data, "events", "events.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const vias = new Set(rows.filter((r) => r.name === "gate_passed").map((r) => r.props?.via));
  console.log(JSON.stringify({ wrong, good, tester: status, dialogs, vias: [...vias] }));
  checks["5 gate_passed via access_code and tester_code"] = vias.has("access_code") && vias.has("tester_code");
} finally {
  child.kill("SIGKILL");
}
for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
const pass = Object.values(checks).every(Boolean);
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
