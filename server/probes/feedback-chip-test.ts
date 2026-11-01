// Acceptance check for the floating Feedback chip: it is on the spoken lesson, the tap-dialogue overlay and
// the live session (with its wrap-up), covers no lesson control, opens the sheet without disturbing the
// lesson or session, and every feedback_submitted carries its screen and lesson context.
//   npx tsx server/probes/feedback-chip-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "feedback-chip-"));
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

const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  ${detail}`}`);
  if (!ok) failures.push(name);
};

type Box = { x: number; y: number; width: number; height: number };
const meets = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

let pass = false;
try {
  await up();
  const browser = await chromium.launch({
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
  });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const sent: string[] = [];
  let socket: any = null;
  await page.route("**/v1/live/sessions", (route) =>
    route.fulfill({
      status: 201, contentType: "application/json",
      body: JSON.stringify({ sessionId: "11111111-2222-3333-4444-555555555555", wsUrl: `ws://127.0.0.1:${port}/v1/live/sessions/probe`, ttlSec: 60, scenario: "Probe scenario" }),
    }));
  await page.routeWebSocket(/\/v1\/live\/sessions\//, (ws) => {
    socket = ws;
    ws.onMessage((m: any) => {
      if (typeof m !== "string") return;
      sent.push(m);
      if (JSON.parse(m).type !== "end") return;
      ws.send(JSON.stringify({ type: "state", status: "ended" }));
      setTimeout(() => { ws.send(JSON.stringify({ type: "progress", ending: "ended", objectives: [] })); ws.close(); }, 200);
    });
    ws.send(JSON.stringify({ type: "state", status: "connected" }));
  });

  const box = async (sel: string): Promise<Box | null> => page.locator(sel).first().boundingBox();
  // Every visible control matching `sels`, so a chip over any one of them is caught.
  const boxes = (sels: string) => page.locator(sels).evaluateAll((els) =>
    els.filter((e) => (e as HTMLElement).offsetParent && e.id !== "feedback-chip").map((e) => ({ id: e.id || e.className, ...e.getBoundingClientRect().toJSON() })));
  const topAtCentre = async () => {
    const b = await box("#feedback-chip");
    return !!b && (await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest("#feedback-chip"), [b.x + b.width / 2, b.y + b.height / 2]));
  };
  // The chip's place checked on this phone and on a small one (320×568).
  const clearOf = async (when: string, sels: string) => {
    for (const [w, h] of [[390, 844], [320, 568]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(150);
      const b = await box("#feedback-chip");
      const others = await boxes(sels);
      check(`${when} @${w}x${h}: the chip is visible`, await page.locator("#feedback-chip").isVisible());
      check(`${when} @${w}x${h}: the chip covers no control`, !!b && others.length > 0 && others.every((o: Box) => !meets(b, o)),
        JSON.stringify({ b, hit: others.filter((o: Box) => b && meets(b, o)) }));
      check(`${when} @${w}x${h}: the chip is the top element at its centre`, await topAtCentre());
    }
  };
  const chipBox = () => box("#feedback-chip");
  const chipVisible = () => page.locator("#feedback-chip").isVisible();
  const send = async (text: string) => {
    await page.locator("#feedback-text").fill(text);
    await page.locator("#feedback-send").click();
    await page.waitForSelector("#feedback", { state: "hidden" });
  };
  const flush = () => page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const text = (sel: string) => page.locator(sel).evaluate((e) => e.textContent ?? "");
  const talkState = () => page.locator("#scene-talk").evaluate((e) => `${e.className}|${(e as HTMLElement).hidden}`);
  const sceneState = async () => `${await text("#scene-caption")}|${await talkState()}`;

  // 1. The first-open spoken lesson.
  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  check("spoken: the chip is visible from the first frame", await chipVisible());
  const cb = await chipBox();
  for (const sel of ["#scene-talk", "#scene-chips", "#scene-prompt"]) {
    const b = await box(sel);
    check(`spoken: the chip does not cover ${sel}`, !!cb && (!b || !meets(cb, b)), JSON.stringify({ cb, b }));
  }
  await clearOf("spoken", "#scene button, #scene-chips, #scene-prompt");
  // A beat that waits for the learner's tap is a stable moment to open the sheet over.
  const stepScene = async () => {
    if (await page.locator("#scene-choice").isVisible()) await page.locator("#scene-choice button").first().click({ timeout: 2000 }).catch(() => {});
    else if ((await page.locator("#scene-talk").getAttribute("class"))?.includes("waiting")) await page.locator("#scene-talk").click({ force: true, timeout: 2000 }).catch(() => {});
    else await page.locator("#scene-skip").click({ force: true, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(200);
  };
  for (let i = 0; i < 120 && !((await text("#scene-caption")).trim() && (await talkState()).includes("waiting")); i++) await stepScene();
  const before = await sceneState();
  await page.locator("#feedback-chip").click();
  check("spoken: the sheet label is \"Let us know what you think.\"", (await text("#feedback-prompt")).trim() === "Let us know what you think.");
  await send("chip spoken");
  const after = await sceneState();
  check("spoken: caption and talk-button phase are unchanged by the sheet", before === after, `${before} -> ${after}`);

  // Walk to the close screen with the skip chip.
  for (let i = 0; i < 300 && (await page.locator("#scene-close").isHidden()); i++) await stepScene();
  check("spoken: the close screen was reached", await page.locator("#scene-close").isVisible());
  check("spoken: the chip is visible on the close screen", await chipVisible());
  await page.locator("#scene-feedback").click();
  await send("level end spoken");
  await page.evaluate(() => document.getElementById("scene-quit")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);

  // 2. Home: header link, no chip.
  check("home: the chip is hidden", !(await chipVisible()));
  await page.locator("#header-feedback").click();
  await send("header home");

  // 3. A tap level.
  const practice = await (await fetch(`${base}/api/practice`)).json();
  const lv = practice.scenarios
    .flatMap((sc: any) => sc.dialogues.map((d: any) => ({ sc, d })))
    .find((x: any) => (x.d.advance ?? "tap") === "tap");
  if (!lv) throw new Error("no tap level to play");
  await page.locator('.tile[data-go="practice"]').click();
  await page.locator(".scenario-card").filter({ hasText: lv.sc.name }).first().click();
  await page.locator("#level-list .level-card").nth(lv.sc.dialogues.indexOf(lv.d)).click();
  await page.waitForSelector("#dialogue:not([hidden])");
  const clear = async (when: string) => {
    const b = await chipBox();
    const others = await page.locator(".dialogue-choice, #dialogue-controls, .dialogue-controls").evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetParent).map((e) => e.getBoundingClientRect().toJSON()));
    check(`dialogue ${when}: the chip is visible`, await chipVisible());
    check(`dialogue ${when}: the chip covers no choice or control`, !!b && others.every((o: Box) => !meets(b, o)), JSON.stringify({ b, others }));
    check(`dialogue ${when}: the chip is the top element at its centre`, await topAtCentre());
    await clearOf(`dialogue ${when}`, "#dialogue button, .dialogue-choice, .dialogue-controls");
  };
  if (await page.locator("#dialogue-intro").isVisible()) await clear("intro");
  for (let i = 0; i < 20 && !(await page.locator("#dialogue-choices .dialogue-choice").count()); i++) {
    if (await page.locator("#dialogue-intro").isVisible()) await page.locator("#dialogue-intro").click().catch(() => {});
    await page.waitForTimeout(300);
  }
  await clear("conversation");
  const convo = () => page.evaluate(() => `${document.getElementById("dialogue-convo")!.children.length}|${document.getElementById("dialogue-choices")!.innerText}`);
  const convoBefore = await convo();
  await page.locator("#feedback-chip").click();
  await send("chip dialogue");
  check("dialogue: bubbles and choices are unchanged by the sheet", convoBefore === (await convo()), `${convoBefore} -> ${await convo()}`);
  for (let i = 0; i < 40 && !(await page.locator("#dialogue-choices.is-terminal").count()); i++) {
    await page.locator("#dialogue-choices .dialogue-choice").first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  check("dialogue: the level reached its end", (await page.locator("#dialogue-choices.is-terminal").count()) > 0);
  await page.locator("#level-feedback").click();
  await send("level end dialogue");
  await page.locator("#dialogue-close").click();

  // 4. Finder request.
  for (let i = 0; i < 4 && (await page.locator("#home").isHidden()); i++) await page.locator("#back").click();
  await page.locator('.tile[data-go="practice"]').click();
  await page.locator("#finder-input").fill("zxqv wibble frumious");
  await page.locator("#finder-input").press("Enter");
  await page.locator("#finder-request").click();
  await send("finder request");

  // 5. Live session, for a lesson named in the address.
  await flush();
  await page.goto(`${base}/?lesson=demo-l1`);
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);
  await page.locator('.tile[data-go="tutor"]').click();
  await page.waitForSelector("#consent:not([hidden])");
  check("tutor start screen: no live session, no chip", !(await chipVisible()));
  await page.locator("#consent-continue").click();
  await page.locator("#practice-talk").click();
  await page.waitForFunction(() => document.getElementById("practice-talk-label")?.textContent === "End session");
  for (let i = 0; i < 50 && !socket; i++) await page.waitForTimeout(100);
  check("live: the chip is visible during the session", await chipVisible());
  const lb = await chipBox();
  for (const sel of ["#practice-talk", "#transcript"]) {
    const b = await box(sel);
    check(`live: the chip does not cover ${sel}`, !!lb && (!b || !meets(lb, b)), JSON.stringify({ lb, b }));
  }
  // The tutor screen keeps the app header: "‹ Home", Settings and Feedback are controls too.
  await clearOf("live", "header button, #tutor button");
  await page.locator("#feedback-chip").click();
  socket.send(JSON.stringify({ type: "transcript", id: "t1", role: "tutor", text: "Dober dan, kako ste?" }));
  await page.waitForFunction(() => document.getElementById("transcript")!.textContent!.includes("Dober dan, kako ste?"));
  check("live: the sheet is open over the transcript line", await page.locator("#feedback").isVisible());
  await send("chip live");
  check("live: no end message was sent", !sent.some((m) => JSON.parse(m).type === "end"), sent.join(" "));
  check("live: the talk button still reads End session", (await text("#practice-talk-label")) === "End session");
  await page.locator("#header-feedback").click();
  await send("header live");

  // 6. Live wrap-up.
  await page.locator("#practice-talk").click({ force: true });
  await page.waitForSelector("#live-wrapup:not([hidden])");
  check("wrap-up: the chip is visible", await chipVisible());
  await clearOf("wrap-up", "header button, #tutor button");
  await page.locator("#live-feedback").click();
  await send("live end");

  await flush();
  const want = 9;
  for (let i = 0; i < 20 && rows().filter((r) => r.name === "feedback_submitted").length < want; i++) await page.waitForTimeout(250);
  await browser.close();

  const fb = rows().filter((r) => r.name === "feedback_submitted");
  const by = (t: string) => fb.find((r) => r.text === t);
  const expect = (t: string, props: Record<string, unknown>, absent: string[] = []) => {
    const r = by(t);
    const p = r?.props ?? {};
    const ok = !!r && Object.entries(props).every(([k, v]) => v === "*" ? p[k] !== undefined : v === "?" ? p[k] === undefined || typeof p[k] === "number" : p[k] === v)
      && absent.every((k) => p[k] === undefined);
    check(`row "${t}"`, ok, JSON.stringify(p));
  };
  check("nine feedback_submitted rows", fb.length === want, String(fb.length));
  // Props that don't apply are left out, never sent empty (feedback spec §3).
  check("no feedback_submitted prop is null or empty", fb.every((r) => Object.values(r.props ?? {}).every((v) => v !== null && v !== "")),
    JSON.stringify(fb.map((r) => r.props)));
  // A spoken lesson without a level (the first-open one) carries no `level`.
  expect("chip spoken", { surface: "chip", screen: "spoken", scenarioId: "*", level: "?" }, ["lessonId"]);
  expect("chip dialogue", { surface: "chip", screen: "dialogue", scenarioId: lv.sc.id, level: lv.d.level }, ["lessonId"]);
  expect("chip live", { surface: "chip", screen: "live", lessonId: "*" }, ["scenarioId", "level"]);
  expect("header home", { surface: "header", screen: "home" }, ["scenarioId", "level", "lessonId"]);
  expect("level end dialogue", { surface: "level_end", screen: "dialogue", scenarioId: lv.sc.id, level: lv.d.level });
  expect("level end spoken", { surface: "level_end", screen: "spoken", scenarioId: "*", level: "?" }, ["lessonId"]);
  expect("live end", { surface: "live_end", screen: "live", lessonId: "*" });
  expect("finder request", { surface: "finder_request", screen: "practice" }, ["scenarioId", "level", "lessonId"]);
  expect("header live", { surface: "header", screen: "live", lessonId: "*" });

  pass = failures.length === 0;
} catch (err) {
  console.log(err);
} finally {
  child.kill("SIGKILL");
}
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
