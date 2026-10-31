// Acceptance check for the live session's End session button and wrap-up
// (docs/features/live-session/spec.md): the progress frame, the real server's ending sequence, and the
// wrap-up screen driven in headless Chromium against a scripted socket.
//   npx tsx server/probes/live-wrap-up-test.ts
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { WebSocket } from "ws";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "live-wrap-up-"));
process.env.DATA_DIR = data;
const { progressMessage } = await import("../live/index");
const { scenarioName } = await import("../assets/deletion");

const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], {
  env: { ...process.env, PORT: String(port), DATA_DIR: data, LIVE_ACCESS_CODE: "probe", XAI_API_KEY: "probe-unreachable" },
  stdio: "ignore",
});

let failed = false;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : " — " + detail}`);
  if (!ok) failed = true;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1. The pure frame.
  check("progressMessage(true, [])", same(progressMessage(true, []), { type: "progress", ending: "time", objectives: [] }));
  check("progressMessage(false, null)", same(progressMessage(false, null), { type: "progress", ending: "ended", objectives: null }));

  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    if (i > 120) throw new Error("server did not start");
    await sleep(500);
  }

  // 2. The real server: End session at once.
  const res = await fetch(`${base}/v1/live/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-learner-id": "wrap-up-probe" },
    body: JSON.stringify({ lessonId: "demo-l1", accessCode: "probe", noSave: true }),
  });
  const created: any = await res.json();
  check("create answers 201", res.status === 201, String(res.status));
  check("create carries the lesson's scenario name", created.scenario === scenarioName("demo-l1") && !!created.scenario, String(created.scenario));
  const frames: any[] = [];
  await new Promise<void>((resolve) => {
    const sock = new WebSocket(created.wsUrl);
    sock.on("open", () => sock.send(JSON.stringify({ type: "end" })));
    sock.on("message", (d, binary) => { if (!binary) frames.push(JSON.parse(d.toString())); });
    sock.on("error", () => {});
    sock.on("close", () => resolve());
    setTimeout(resolve, 20_000);
  });
  const tail = frames.filter((f) => f.type !== "objectives" && f.type !== "error");
  check("then state ended, then progress", same(tail, [{ type: "state", status: "ended" }, { type: "progress", ending: "ended", objectives: [] }]), JSON.stringify(tail));
  await sleep(500);
  const liveDir = path.join(data, "live");
  const left = existsSync(liveDir) ? readdirSync(liveDir).filter((f) => f.includes(created.sessionId)) : [];
  check("the no-save session left no file in live/", left.length === 0, left.join(","));

  // 3. The wrap-up screen.
  const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
  const page = await (await browser.newContext()).newPage();
  const sent: string[] = [];
  let sockets = 0;
  let onSocket: (ws: any) => void = () => {};
  await page.route("**/v1/live/sessions", (route) =>
    route.fulfill({
      status: 201, contentType: "application/json",
      body: JSON.stringify({ sessionId: "11111111-2222-3333-4444-555555555555", wsUrl: `ws://127.0.0.1:${port}/v1/live/sessions/probe`, ttlSec: 60, scenario: "Probe scenario" }),
    }));
  await page.routeWebSocket(/\/v1\/live\/sessions\//, (ws) => {
    sent.length = 0;
    sockets++;
    ws.onMessage((m) => sent.push(String(m)));
    onSocket(ws);
  });
  await page.route("**/api/practice", async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, json: { ...(await r.json()), started: true } });
  });
  await page.addInitScript(() => localStorage.setItem("liveAccessCode", "probe"));

  const talkLabel = () => page.innerText("#practice-talk-label");
  const wrapText = () => page.innerText("#live-wrapup");
  const begin = async (noSave: boolean) => {
    await page.goto(`${base}/?lesson=demo-l1`);
    await page.click('.tile[data-go="tutor"]');
    await page.waitForSelector("#consent:not([hidden])");
    if (noSave) await page.check("#start-nosave");
    await page.click("#consent-continue");
    await page.click("#practice-talk");
  };
  const settle = async (text: string) => {
    for (let i = 0; i < 40; i++) {
      if ((await wrapText().catch(() => "")).includes(text)) return;
      await page.waitForTimeout(100);
    }
  };
  const noNoise = async (run: string) => check(`${run}: no counts, score or error in the wrap-up`, !/\d+\/\d+|score|error/i.test(await wrapText()));

  // Run A: End session before the socket has said anything.
  await begin(true);
  await page.waitForFunction(() => document.getElementById("practice-talk-label")?.textContent === "End session");
  check("before connected: the button reads End session and is enabled", (await talkLabel()) === "End session" && (await page.isEnabled("#practice-talk")));
  for (let i = 0; i < 50 && !sockets; i++) await page.waitForTimeout(100);
  await page.click("#practice-talk", { force: true });
  await settle("Checking your progress");
  let t = await wrapText();
  check("End session sends {\"type\":\"end\"}", sent.some((m) => same(JSON.parse(m), { type: "end" })), sent.join(" "));
  check("wrap-up: Session ended", t.includes("Session ended"));
  check("wrap-up: You practised: {scenario}", t.includes("You practised: Probe scenario"));
  check("wrap-up: Checking your progress…", t.includes("Checking your progress…"));
  check("wrap-up: the no-save line", t.includes("This conversation wasn't saved."));
  check("the transcript and talk button are gone", !(await page.isVisible("#practice-talk")) && !(await page.isVisible("#transcript")));
  await noNoise("A");

  // Run A2: the same flow, the scripted server answering End session with a progress result.
  onSocket = (ws) => {
    ws.onMessage((m: any) => {
      if (JSON.parse(String(m)).type !== "end") return;
      ws.send(JSON.stringify({ type: "state", status: "ended" }));
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "progress", ending: "ended", objectives: [{ id: "a", name: "A" }, { id: "b", name: "B" }] }));
        ws.close();
      }, 300);
    });
  };
  await begin(true);
  await page.waitForFunction(() => document.getElementById("practice-talk-label")?.textContent === "End session");
  await page.click("#practice-talk", { force: true });
  await settle("You made progress on");
  t = await wrapText();
  check("progress: \"You made progress on\"", t.includes("You made progress on"));
  const items = await page.$$eval("#wrapup-progress li", (ls) => ls.map((l) => l.textContent));
  check("progress: A and B on separate lines", same(items, ["A", "B"]), JSON.stringify(items));
  check("progress: the title stays Session ended", t.includes("Session ended"));
  await noNoise("A2");

  // Give feedback, then What next.
  await page.click("#live-feedback");
  check("Give feedback opens the rating sheet", await page.isVisible("#feedback"));
  await page.click("#feedback-up");
  await page.click("#feedback-send");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const eventsFile = path.join(data, "events", "events.jsonl");
  const rows = () => (existsSync(eventsFile) ? readFileSync(eventsFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
  for (let i = 0; i < 20 && !rows().some((r) => r.name === "feedback_submitted"); i++) await page.waitForTimeout(250);
  check("feedback_submitted with surface live_end", rows().some((r) => r.name === "feedback_submitted" && r.props?.surface === "live_end"));
  await page.waitForSelector("#feedback", { state: "hidden" });
  check("the wrap-up is back after the sheet", await page.isVisible("#live-wrapup"));
  await page.click("#wrapup-next");
  check("What next opens the lessons screen", await page.isVisible("#practice") && !(await page.isVisible("#tutor")));

  // Run B: the time limit, no button press.
  onSocket = (ws) => {
    ws.send(JSON.stringify({ type: "state", status: "ended" }));
    ws.send(JSON.stringify({ type: "progress", ending: "time", objectives: [] }));
    ws.close();
  };
  await begin(false);
  await settle("This session was practice.");
  t = await wrapText();
  check("time: Session time reached", t.includes("Session time reached"));
  check("time: This session was practice.", t.includes("This session was practice."));
  check("saved session: no no-save line", !t.includes("wasn't saved"));
  await noNoise("B");

  // Run C: the socket closes with no progress frame.
  onSocket = (ws) => {
    ws.send(JSON.stringify({ type: "state", status: "ended" }));
    ws.close();
  };
  await begin(false);
  await settle("couldn't be checked");
  t = await wrapText();
  check("closed early: Session ended", t.includes("Session ended"));
  check("closed early: progress couldn't be checked", t.includes("Progress couldn't be checked for this session."));
  await noNoise("C");

  // Run D: the header back button leaves with no wrap-up.
  onSocket = () => {};
  await begin(false);
  await page.waitForFunction(() => document.getElementById("practice-talk-label")?.textContent === "End session");
  await page.click("#back");
  await page.waitForTimeout(500);
  check("back button: no wrap-up", !(await page.isVisible("#live-wrapup")) && !(await page.locator(".practice-surface.wrapped").count()));

  await browser.close();
}

main()
  .catch((e) => { console.log("FAIL ", e.message); failed = true; })
  .finally(() => {
    child.kill("SIGKILL");
    console.log(failed ? "FAIL" : "PASS");
    process.exit(failed ? 1 : 0);
  });
