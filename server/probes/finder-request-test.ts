// Acceptance check for the "Request a scenario" sheet: text leads and is required, the thumbs are an optional
// add-on after it, and the header Feedback sheet keeps the rating layout.
//   npx tsx server/probes/finder-request-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "finder-request-"));
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
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  await page.evaluate(() => document.getElementById("scene-quit")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);

  // The sheet's parts in document order, by id.
  const sheet = () => page.evaluate(() => {
    const ids = ["feedback-prompt", "feedback-text", "feedback-rating-label", "feedback-up"];
    const order = ids.slice().sort((a, b) =>
      (document.getElementById(a)!.compareDocumentPosition(document.getElementById(b)!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    return {
      title: document.getElementById("feedback-title")!.textContent,
      label: document.getElementById("feedback-prompt")!.textContent,
      placeholder: document.getElementById("feedback-text")!.getAttribute("placeholder"),
      line: document.getElementById("feedback-rating-label")!.textContent,
      order,
      sendDisabled: (document.getElementById("feedback-send") as HTMLButtonElement).disabled,
    };
  });

  await page.locator('.tile[data-go="practice"]').click();
  const request = async () => {
    await page.locator("#finder-input").fill("zxqv wibble frumious");
    await page.locator("#finder-input").press("Enter");
    await page.locator("#finder-request").click();
  };
  await request();
  const first = await sheet();

  await page.locator("#feedback-text").fill("a scenario about wibbles");
  const enabledByText = await page.locator("#feedback-send").isEnabled();
  await page.locator("#feedback-send").click();
  const thanks = await page.locator("#feedback-thanks").isVisible();
  await page.waitForSelector("#feedback", { state: "hidden" });

  await request();
  await page.locator("#feedback-text").fill("a scenario about frumious things");
  await page.locator("#feedback-down").click();
  await page.locator("#feedback-send").click();
  await page.waitForSelector("#feedback", { state: "hidden" });

  await page.evaluate(() => document.getElementById("header-feedback")!.click());
  const header = await sheet();
  await page.locator("#feedback-text").fill("typed only");
  const headerTextOnly = await page.locator("#feedback-send").isDisabled();
  await page.locator("#feedback-up").click();
  const headerRated = await page.locator("#feedback-send").isEnabled();

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  for (let i = 0; i < 20 && rows().filter((r) => r.name === "feedback_submitted").length < 2; i++) await page.waitForTimeout(250);
  await browser.close();

  const fb = rows().filter((r) => r.name === "feedback_submitted");
  for (const r of fb) console.log([r.props.surface, r.props.rating, r.props.hasText, r.text].join("\t"));
  const checks = {
    "request title": first.title === "Request a scenario",
    "request label": first.label === "What would you like to practise?",
    "request placeholder": first.placeholder === "For example, ordering at a bakery",
    "request line text": first.line === "How's Vadi so far? (optional)",
    "request order: label, field, line, thumbs": first.order.join() === "feedback-prompt,feedback-text,feedback-rating-label,feedback-up",
    "request Send disabled when empty": first.sendDisabled,
    "text alone enables Send": enabledByText,
    "Thanks shown, sheet closed": thanks,
    "two finder_request rows, ratings null and down": fb.length === 2 && fb.every((r) => r.props.surface === "finder_request" && r.props.hasText === true && typeof r.text === "string") && fb[0].props.rating === null && fb[1].props.rating === "down",
    "header title Feedback": header.title === "Feedback",
    "header thumbs before field": header.order.indexOf("feedback-up") < header.order.indexOf("feedback-text"),
    "header Send disabled until thumb": header.sendDisabled && headerTextOnly && headerRated,
  };
  for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  pass = Object.values(checks).every(Boolean);
} finally {
  child.kill("SIGKILL");
}
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
