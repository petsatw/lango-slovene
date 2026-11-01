// Acceptance check for the one feedback form: every feedback point opens a sheet with a title, one labelled
// text box and Send (enabled only for non-blank text), no thumbs; feedback_submitted carries `surface` and the
// text and nothing else.
//   npx tsx server/probes/feedback-form-test.ts
// The spoken lesson's close is reached through a stubbed /api/scene reply with no beat; the live wrap-up
// through a scripted socket, as server/probes/live-wrap-up-test.ts does.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "feedback-form-"));
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], {
  env: { ...process.env, PORT: String(port), DATA_DIR: data, TESTER_CODES: "TEST-01", LIVE_ACCESS_CODE: "probe" },
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
const fbRows = () => rows().filter((r) => r.name === "feedback_submitted");

let failed = false;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : " — " + detail}`);
  if (!ok) failed = true;
};

try {
  await up();

  // 2. Server: only the allowed props are kept.
  const post = await fetch(`${base}/api/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-learner-id": "probe-server" },
    body: JSON.stringify({ events: [{ name: "feedback_submitted", ts: new Date().toISOString(),
      props: { surface: "header", rating: "up", hasText: true, screen: "home" }, text: "server check" }] }),
  });
  const stored = fbRows().find((r) => r.text === "server check");
  check("server keeps exactly surface and screen", post.ok && JSON.stringify(stored?.props) === JSON.stringify({ surface: "header", screen: "home" }), JSON.stringify(stored?.props));

  const browser = await chromium.launch({
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
  });
  const ctx = await browser.newContext();
  const flush = (p: any) => p.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const waitRows = async (n: number) => { for (let i = 0; i < 20 && fbRows().length < n; i++) await new Promise((r) => setTimeout(r, 250)); };

  // The sheet that is open: one text box, no thumbs, the spec's words, Send gated on non-blank text.
  const sheet = async (page: any, name: string, want: { title: string; label: string; placeholder?: string }, text: string) => {
    const s = await page.evaluate(() => {
      const el = document.getElementById("feedback")!;
      return {
        title: document.getElementById("feedback-title")!.textContent,
        label: document.getElementById("feedback-prompt")!.textContent,
        placeholder: document.getElementById("feedback-text")!.getAttribute("placeholder") || "",
        areas: el.querySelectorAll("textarea").length,
        thumbs: /👍|👎/.test(el.textContent || "") || el.querySelectorAll("[aria-pressed]").length > 0,
      };
    });
    check(`${name}: title and label`, s.title === want.title && s.label === want.label, JSON.stringify(s));
    check(`${name}: placeholder`, s.placeholder === (want.placeholder ?? ""), s.placeholder);
    check(`${name}: one textarea, no thumbs`, s.areas === 1 && !s.thumbs);
    const send = page.locator("#feedback-send");
    const emptyOff = await send.isDisabled();
    await page.locator("#feedback-text").fill("   ");
    const spacesOff = await send.isDisabled();
    await page.locator("#feedback-text").fill(text);
    const textOn = await send.isEnabled();
    check(`${name}: Send disabled when empty and for spaces, enabled for text`, emptyOff && spacesOff && textOn);
    await send.click();
    check(`${name}: Thanks shown`, await page.locator("#feedback-thanks").isVisible());
    await page.waitForSelector("#feedback", { state: "hidden" });
  };

  // 3. First page: the spoken lesson's close, then header, Finder request, a tap level's end.
  const page = await ctx.newPage();
  await page.route("**/api/scene", (route) =>
    route.fulfill({ json: { voice: "probe", audio: "ready", keyPhrases: { new: [], review: [] }, nextLevel: null } }));
  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForFunction(() => !document.getElementById("scene-close")!.hidden);
  await page.locator("#scene-feedback").click();
  await sheet(page, "spoken close", { title: "Feedback", label: "How did this go for you?" }, "spoken note");
  await page.evaluate(() => document.getElementById("scene-quit")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);

  await page.locator("#header-feedback").click();
  await sheet(page, "header", { title: "Feedback", label: "Let us know what you think." }, "header note");

  await page.locator('.tile[data-go="practice"]').click();
  await page.locator("#finder-input").fill("zxqv wibble frumious");
  await page.locator("#finder-input").press("Enter");
  await page.locator("#finder-request").click();
  await sheet(page, "finder request", {
    title: "Request a scenario", label: "Describe what you want to learn",
    placeholder: "For example, booking a table at a restaurant",
  }, "a scenario about wibbles");

  const practice = await (await fetch(`${base}/api/practice`)).json();
  const lv = practice.scenarios
    .flatMap((sc: any) => sc.dialogues.map((d: any) => ({ sc, d })))
    .find((x: any) => (x.d.advance ?? "tap") === "tap" && !x.d.intro);
  if (!lv) throw new Error("no tap-through level to play");
  await page.locator(".scenario-card").filter({ hasText: lv.sc.name }).first().click();
  await page.locator("#level-list .level-card").nth(lv.sc.dialogues.indexOf(lv.d)).click();
  for (let i = 0; i < 40 && !(await page.locator("#dialogue-choices.is-terminal").count()); i++) {
    await page.locator("#dialogue-choices .dialogue-choice").first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  if (!(await page.locator("#dialogue-choices.is-terminal").count())) throw new Error("the level did not reach its end");
  await page.locator("#level-feedback").click();
  await sheet(page, "tap level end", { title: "Feedback", label: "How did this go for you?" }, "level note");

  // 4. A header sheet filled and closed with ✕ records nothing.
  await page.evaluate(() => document.getElementById("header-feedback")!.click());
  await page.locator("#feedback-text").fill("closed unsent");
  await page.locator("#feedback-close").click();
  await flush(page);
  await waitRows(5);

  // Live session end, on a second page with a scripted socket.
  const live = await ctx.newPage();
  await live.route("**/v1/live/sessions", (route) =>
    route.fulfill({
      status: 201, contentType: "application/json",
      body: JSON.stringify({ sessionId: "11111111-2222-3333-4444-555555555555", wsUrl: `ws://127.0.0.1:${port}/v1/live/sessions/probe`, ttlSec: 60, scenario: "Probe scenario" }),
    }));
  await live.routeWebSocket(/\/v1\/live\/sessions\//, (ws) => {
    ws.onMessage((m: any) => {
      if (typeof m !== "string" || JSON.parse(m).type !== "end") return;
      ws.send(JSON.stringify({ type: "state", status: "ended" }));
      setTimeout(() => { ws.send(JSON.stringify({ type: "progress", ending: "ended", objectives: [] })); ws.close(); }, 300);
    });
  });
  await live.route("**/api/practice", async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, json: { ...(await r.json()), started: true } });
  });
  await live.addInitScript(() => localStorage.setItem("liveAccessCode", "probe"));
  await live.goto(`${base}/?lesson=demo-l1`);
  await live.click('.tile[data-go="tutor"]');
  await live.waitForSelector("#consent:not([hidden])");
  await live.check("#start-nosave");
  await live.click("#consent-continue");
  await live.click("#practice-talk");
  await live.waitForFunction(() => document.getElementById("practice-talk-label")?.textContent === "End session");
  await live.click("#practice-talk", { force: true });
  await live.waitForSelector("#live-feedback");
  await live.click("#live-feedback");
  await sheet(live, "live end", { title: "Feedback", label: "How did this go for you?" }, "live note");
  await flush(live);
  await waitRows(6);
  await browser.close();

  // 5. The log.
  const fb = fbRows().filter((r) => r.text !== "server check");
  for (const r of fb) console.log([r.props.surface, JSON.stringify(r.props), r.text].join("\t"));
  check("exactly five feedback_submitted rows", fb.length === 5, String(fb.length));
  check("surfaces header, finder_request, level_end, level_end, live_end",
    JSON.stringify(fb.map((r) => r.props.surface).sort()) === JSON.stringify(["finder_request", "header", "level_end", "level_end", "live_end"]));
  check("each row has text and no rating or hasText", fb.every((r) => r.text && !("rating" in r.props) && !("hasText" in r.props)));
  check("the unsent sheet recorded nothing", !readFileSync(log, "utf8").includes("closed unsent"));
} catch (e: any) {
  console.log("FAIL ", e.message);
  failed = true;
} finally {
  child.kill("SIGKILL");
}
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
