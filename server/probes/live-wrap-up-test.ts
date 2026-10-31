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
const { settleSession } = await import("../live/grader");
const { GeminiE2 } = await import("../adapters/gemini");
const learner = await import("../assets/learner");
const { buildLessonPrompt } = await import("../live/prompt");

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
const parse = (m: string) => { try { return JSON.parse(m); } catch { return null; } };
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

  // 2b. Grading, in process, with the grader stubbed: a completed check saves the learner model BEFORE
  // settleSession resolves (finish() sends the progress frame only after it resolves), names each
  // objective by its learnable's `sl` and writes `progressed` to the live log; a grade that times out
  // (LIVE_GRADE_TIMEOUT_SEC) resolves to null, so the frame carries objectives: null.
  {
    const lid = "wrap-up-grader";
    const built = buildLessonPrompt("demo-l1", lid);
    const obj = built.objectives[0]!;
    const logOf = (sessionId: string) => ({
      sessionId, learnerId: lid, testerCode: null, runId: null, lessonId: "demo-l1", provider: "grok",
      startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), error: null,
      transcripts: [
        { ts: "", role: "tutor", text: "Dober dan." },
        { ts: "", role: "user", text: obj.sl },
        { ts: "", role: "tutor", text: "Odlično." },
      ],
    }) as any;
    const before = JSON.stringify(learner.load(lid).learnables[obj.id] ?? null);
    const orig = GeminiE2.prototype.grade;
    (GeminiE2.prototype as any).grade = async () =>
      [{ id: obj.id, uptake: true, correct: true, recast: false, saidLine: 2, saidLang: "sl" }];
    let savedAtResolve = "";
    const got = await settleSession({ learnerId: lid, instructions: built.instructions, targets: built.targets,
      objectives: built.objectives, log: logOf("grade-ok") }).then((r) => {
      savedAtResolve = JSON.stringify(learner.load(lid).learnables[obj.id] ?? null);
      return r;
    });
    check("grading: progressed objectives named by their sl", same(got, [{ id: obj.id, name: obj.sl }]), JSON.stringify(got));
    check("grading: the learner model is saved before the result resolves", savedAtResolve !== before, savedAtResolve);
    const okLog = JSON.parse(readFileSync(path.join(data, "live", "grade-ok.json"), "utf8"));
    check("grading: the live log holds progressed", same(okLog.progressed, [obj.id]), JSON.stringify(okLog.progressed));
    check("grading: the frame lists them", same(progressMessage(false, got), { type: "progress", ending: "ended", objectives: [{ id: obj.id, name: obj.sl }] }));

    const quiet = { ...logOf("grade-quiet"), transcripts: [{ ts: "", role: "tutor", text: "Dober dan." }] };
    const none = await settleSession({ learnerId: lid, instructions: built.instructions, targets: built.targets,
      objectives: built.objectives, log: quiet });
    check("no learner speech: the result is []", same(none, []), JSON.stringify(none));
    const quietLog = JSON.parse(readFileSync(path.join(data, "live", "grade-quiet.json"), "utf8"));
    check("no learner speech: the live log holds progressed: []", same(quietLog.progressed, []), JSON.stringify(quietLog.progressed));

    process.env.LIVE_GRADE_TIMEOUT_SEC = "1";
    (GeminiE2.prototype as any).grade = () => new Promise(() => {});
    const modelBefore = JSON.stringify(learner.load(lid));
    const late = await settleSession({ learnerId: lid, instructions: built.instructions, targets: built.targets,
      objectives: built.objectives, log: logOf("grade-late") });
    check("timeout: settleSession resolves to null", late === null, JSON.stringify(late));
    check("timeout: the frame carries objectives: null", same(progressMessage(false, late), { type: "progress", ending: "ended", objectives: null }));
    check("timeout: the learner model is unchanged", JSON.stringify(learner.load(lid)) === modelBefore);
    delete process.env.LIVE_GRADE_TIMEOUT_SEC;
    GeminiE2.prototype.grade = orig;
  }

  // 3. The wrap-up screen.
  const browser = await chromium.launch({
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
  });
  const page = await (await browser.newContext()).newPage();
  const sent: string[] = [];
  let sockets = 0;
  let micHeld = false;
  const holdMic = (on: boolean) => { micHeld = on; };
  let onSocket: (ws: any) => void = () => {};
  await page.route("**/v1/live/sessions", (route) =>
    route.fulfill({
      status: 201, contentType: "application/json",
      body: JSON.stringify({ sessionId: "11111111-2222-3333-4444-555555555555", wsUrl: `ws://127.0.0.1:${port}/v1/live/sessions/probe`, ttlSec: 60, scenario: "Probe scenario" }),
    }));
  await page.routeWebSocket(/\/v1\/live\/sessions\//, (ws) => {
    sent.length = 0;
    sockets++;
    // Playwright keeps ONE message handler per socket, so a script's handler also records what was sent.
    const record = (m: string | Buffer) => { if (typeof m === "string") sent.push(m); };
    const onMessage = ws.onMessage.bind(ws);
    onMessage(record);
    ws.onMessage = (h: (m: string | Buffer) => any) => onMessage((m) => { record(m); h(m); });
    onSocket(ws);
  });
  await page.route("**/api/practice", async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, json: { ...(await r.json()), started: true } });
  });
  await page.addInitScript(() => localStorage.setItem("liveAccessCode", "probe"));
  // When the probe asks for it, getUserMedia waits for window.__releaseMic(): the session is then created
  // but its socket is not open yet.
  await page.exposeFunction("__micHeld", () => micHeld);
  await page.addInitScript(() => {
    const md = navigator.mediaDevices;
    const real = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => {
      if (await (window as any).__micHeld()) await new Promise<void>((r) => ((window as any).__releaseMic = r));
      return real(c);
    };
  });

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
  // No score and no count of any kind: no digit at all, no %, no "score", no error code.
  const noNoise = async (run: string) => check(`${run}: no counts, score or error in the wrap-up`, !/\d|%|score|error/i.test(await wrapText()), await wrapText());

  // Run A: End session before the socket has said anything.
  await begin(true);
  await page.waitForFunction(() => document.getElementById("practice-talk-label")?.textContent === "End session");
  check("before connected: the button reads End session and is enabled", (await talkLabel()) === "End session" && (await page.isEnabled("#practice-talk")));
  for (let i = 0; i < 50 && !sockets; i++) await page.waitForTimeout(100);
  await page.click("#practice-talk", { force: true });
  await settle("Checking your progress");
  let t = await wrapText();
  check("End session sends {\"type\":\"end\"}", sent.some((m) => same(parse(m), { type: "end" })), sent.join(" "));
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
  await settle("Checking your progress");
  t = await wrapText();
  check("progress: Checking your progress… shows while the check runs", t.includes("Checking your progress…") && !t.includes("You made progress on"));
  check("progress: titled Session ended while the check runs", t.includes("Session ended"));
  await settle("You made progress on");
  t = await wrapText();
  check("progress: Checking your progress… is replaced in place", !t.includes("Checking your progress"));
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

  // Runs E: End session in every live state — before the socket opens, connected, the learner's turn,
  // and mid tutor speech. Each time the button reads End session and is enabled, pressing it sends end
  // (on the socket's open when it had none yet) and opens the wrap-up titled Session ended.
  const answerEnd = (ws: any) => ws.onMessage((m: any) => {
    if (typeof m !== "string" || parse(m)?.type !== "end") return;
    ws.send(JSON.stringify({ type: "state", status: "ended" }));
    setTimeout(() => { ws.send(JSON.stringify({ type: "progress", ending: "ended", objectives: [] })); ws.close(); }, 300);
  });
  const ready = async () => (await talkLabel()) === "End session" && (await page.isEnabled("#practice-talk"));
  const endAndCheck = async (run: string, opts: { socket: boolean }) => {
    await settle("Session ended");
    check(`${run}: wrap-up titled Session ended`, (await wrapText()).includes("Session ended"), await wrapText());
    await settle(opts.socket ? "This session was practice." : "couldn't be checked");
    if (opts.socket) check(`${run}: End session sent {"type":"end"}`, sent.some((m) => same(parse(m), { type: "end" })), sent.join(" "));
    t = await wrapText();
    check(`${run}: the progress block settles`, opts.socket ? t.includes("This session was practice.") : t.includes("Progress couldn't be checked for this session."), t);
    await noNoise(run);
  };

  // E1: still starting — the create response is in, the socket does not exist yet.
  // The microphone is held (an init script below) so the session sits between create and its socket.
  const release = () => page.evaluate(() => (window as any).__releaseMic?.());
  holdMic(true);
  const socketsBefore = sockets;
  onSocket = answerEnd;
  await begin(false);
  await page.waitForFunction(() => document.getElementById("practice-talk-label")?.textContent === "End session");
  check("starting: the button reads End session and is enabled", await ready());
  await page.click("#practice-talk", { force: true });
  await release();
  await endAndCheck("starting", { socket: false });
  check("starting: no socket was opened after End session", sockets === socketsBefore);
  holdMic(false);

  // E2–E4: connected, listening, speaking.
  const pcm = Buffer.alloc(24000 * 2 * 3); // 3 s of PCM16 24 kHz
  for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(3000 * Math.sin(i / 10)), i * 2);
  for (const [run, status] of [["connected", "connected"], ["listening", "listening"], ["speaking", "speaking"]] as const) {
    onSocket = (ws) => {
      answerEnd(ws);
      ws.send(JSON.stringify({ type: "state", status }));
      if (status === "speaking") ws.send(pcm);
    };
    await begin(false);
    if (status === "speaking") {
      await page.waitForSelector("#practice-talk.speaking", { timeout: 5000 }).catch(() => {});
      check("speaking: the tutor is audibly speaking", await page.locator("#practice-talk.speaking").count() === 1);
    } else {
      await page.waitForFunction((s) => document.getElementById("live-state")?.textContent === s, status, { timeout: 5000 }).catch(() => {});
    }
    check(`${run}: the button reads End session and is enabled`, await ready());
    await page.click("#practice-talk", { force: true }); // the button breathes, so it is never "stable"
    await endAndCheck(run, { socket: true });
    if (status === "speaking") {
      check("speaking: the tutor's audio stops on End session", !(await page.evaluate(async () => (await import("/live.js" as any)).liveSpeaking())));
    }
  }

  // E5: a provider error ends the session: Session ended, couldn't be checked, no error code shown.
  onSocket = (ws) => {
    ws.send(JSON.stringify({ type: "error", code: "vendor_connect" }));
    ws.send(JSON.stringify({ type: "state", status: "ended" }));
    ws.send(JSON.stringify({ type: "progress", ending: "ended", objectives: null }));
    ws.close();
  };
  await begin(false);
  await settle("couldn't be checked");
  t = await wrapText();
  check("provider error: Session ended", t.includes("Session ended"));
  check("provider error: progress couldn't be checked", t.includes("Progress couldn't be checked for this session."));
  await noNoise("provider error");

  // Run D0: the header back button while the session is still starting opens no socket and no wrap-up.
  holdMic(true);
  const socketsBack = sockets;
  onSocket = () => {};
  await begin(false);
  await page.waitForFunction(() => document.getElementById("practice-talk-label")?.textContent === "End session");
  await page.click("#back");
  await release();
  await page.waitForTimeout(800);
  check("back while starting: no socket opened", sockets === socketsBack);
  check("back while starting: no wrap-up", !(await page.locator(".practice-surface.wrapped").count()));
  holdMic(false);

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
