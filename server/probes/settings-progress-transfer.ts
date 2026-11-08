// Acceptance check for the Settings export / import / copy progress controls
// (docs/features/learner-progress/spec.md §4).
//   npx tsx server/probes/settings-progress-transfer.ts
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "settings-progress-"));
const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port), DATA_DIR: data, TURNLOG: "0" };
delete env.LEARNER_STORE;
delete env.LEARNERS_DIR;
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], { env, stdio: "ignore" });

let failed = false;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed = true;
};
const call = async (who: string, method: string, url: string, body?: unknown) => {
  const r = await fetch(base + url, {
    method, headers: { "x-learner-id": who, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
};
// A model without its write/visit times, which the browser visit itself moves.
const stable = (m: any) => { const { updatedAt, lastSeenAt, ...rest } = m; return JSON.stringify(rest); };
const deck = async (who: string) =>
  JSON.stringify((await call(who, "GET", "/api/flashcards?domainId=sprehod")).body.cards.map((c: any) => [c.id, c.memorised, c.due]));

try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    if (i > 120) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 500));
  }

  // Source learner SRC: one memorised card, one lapsed.
  const cards = (await call("SRC", "GET", "/api/flashcards?domainId=sprehod")).body.cards;
  for (let i = 0; i < 5; i++) await call("SRC", "POST", "/api/flashcards/rate", { domainId: "sprehod", id: cards[0].id, result: "nailed" });
  await call("SRC", "POST", "/api/flashcards/rate", { domainId: "sprehod", id: cards[1].id, result: "oops" });
  const seeded = (await call("SRC", "GET", "/api/me/progress")).body;
  check("source has a memorised card", !!seeded.flashcards?.[cards[0].id]?.memorisedAt);

  const browser = await chromium.launch();
  const openSettings = async (learner: string) => {
    const ctx = await browser.newContext({ acceptDownloads: true });
    await ctx.addInitScript((id) => localStorage.setItem("learnerId", id), learner);
    const page = await ctx.newPage();
    const dialogs: string[] = [];
    let accept = true;
    page.on("dialog", (d) => { dialogs.push(d.message()); accept ? d.accept() : d.dismiss(); });
    await page.goto(base);
    await page.waitForTimeout(1500); // a learner with no progress is routed into the scene; Settings leaves it
    await page.evaluate(() => document.getElementById("header-settings")!.click());
    await page.waitForFunction(() => document.getElementById("settings-code")!.textContent !== "—");
    return { page, dialogs, setAccept: (v: boolean) => { accept = v; } };
  };
  const status = (page: any) => page.textContent("#settings-status");
  const writes = (page: any) => {
    const seen: string[] = [];
    page.on("request", (r: any) => { if (/\/api\/me\/progress/.test(r.url()) && r.method() !== "GET") seen.push(r.method() + " " + r.url()); });
    return seen;
  };

  // Export from SRC: the downloaded file is the GET body.
  const a = await openSettings("SRC");
  const srcModel = (await call("SRC", "GET", "/api/me/progress")).body; // the visit itself marks the scene seen
  const srcDeck = await deck("SRC");
  const [download] = await Promise.all([a.page.waitForEvent("download"), a.page.click("#settings-export")]);
  const file = path.join(data, "export.json");
  await download.saveAs(file);
  check("export file name", download.suggestedFilename() === "vadi-progress.json", download.suggestedFilename());
  check("export is the GET body", stable(JSON.parse(readFileSync(file, "utf8"))) === stable(srcModel));
  check("export asks no confirm", a.dialogs.length === 0);

  // Import onto DST1: cancel writes nothing, accept matches SRC.
  const b = await openSettings("DST1");
  const bWrites = writes(b.page);
  const before = await deck("DST1");
  b.setAccept(false);
  await b.page.setInputFiles("#settings-import-file", file);
  await b.page.waitForTimeout(500);
  check("import confirm text", b.dialogs[0] === "Replace progress on this device with this file? This can't be undone.", String(b.dialogs[0]));
  check("import cancel writes nothing", bWrites.length === 0 && (await deck("DST1")) === before);
  b.setAccept(true);
  await b.page.setInputFiles("#settings-import-file", file);
  await b.page.waitForFunction(() => document.getElementById("settings-status")!.textContent === "Progress imported");
  check("import matches source deck", (await deck("DST1")) === srcDeck);
  check("import shows a short status", (await status(b.page)) === "Progress imported");

  // Bad file: no confirm, no write, plain message.
  const bad = path.join(data, "bad.json");
  writeFileSync(bad, "not json{");
  const n = b.dialogs.length;
  await b.page.setInputFiles("#settings-import-file", bad);
  await b.page.waitForFunction(() => document.getElementById("settings-status")!.textContent === "That file can't be imported.");
  check("bad file: no write", b.dialogs.length === n && bWrites.length === 1);
  writeFileSync(bad, "[1,2]");
  await b.page.setInputFiles("#settings-import-file", bad);
  await b.page.waitForFunction(() => document.getElementById("settings-status")!.textContent === "That file can't be imported.");
  check("array file: server 400 shown plainly, deck unchanged", (await deck("DST1")) === srcDeck);

  // Copy onto DST2.
  const c = await openSettings("DST2");
  const cWrites = writes(c.page);
  await c.page.click("#settings-copy");
  await c.page.waitForTimeout(300);
  check("empty field: no confirm, no request", c.dialogs.length === 0 && cWrites.length === 0);
  await c.page.fill("#settings-copy-from", "nobody-here");
  await c.page.click("#settings-copy");
  await c.page.waitForFunction(() => document.getElementById("settings-status")!.textContent === "No progress found for that code.");
  await c.page.fill("#settings-copy-from", "t-abc123");
  await c.page.click("#settings-copy");
  await c.page.waitForFunction(() => document.getElementById("settings-status")!.textContent === "That code can't be used here.");
  const copyConfirm = "Replace progress on this device with progress from that code? This can't be undone. The other code is left as it is.";
  check("copy confirm text", c.dialogs[0] === copyConfirm, String(c.dialogs[0]));
  const empty = await deck("DST2");
  c.setAccept(false);
  await c.page.fill("#settings-copy-from", "  SRC  ");
  const w = cWrites.length;
  await c.page.click("#settings-copy");
  await c.page.waitForTimeout(300);
  check("copy cancel writes nothing", cWrites.length === w && (await deck("DST2")) === empty);
  c.setAccept(true);
  await c.page.click("#settings-copy");
  await c.page.waitForFunction(() => document.getElementById("settings-status")!.textContent === "Progress copied");
  check("copy matches source deck", (await deck("DST2")) === srcDeck);
  check("source unchanged", stable((await call("SRC", "GET", "/api/me/progress")).body) === stable(srcModel));
  check("code shown unchanged", (await c.page.textContent("#settings-code")) === "DST2");
  // Transfer failures stay visible in Settings, including a dropped connection.
  const pageErrors: string[] = [];
  c.page.on("pageerror", (e) => pageErrors.push(e.message));
  for (const action of ["export", "import", "copy"]) {
    await c.page.route("**/api/me/progress{,/copy}", (route) => route.abort("failed"));
    if (action === "import") await c.page.setInputFiles("#settings-import-file", file);
    else await c.page.click(`#settings-${action}`);
    await c.page.waitForTimeout(300);
    check(`${action}: network failure shown plainly`, (await status(c.page)) === `Couldn't ${action} progress.`);
    await c.page.unroute("**/api/me/progress{,/copy}");
  }
  check("transfer failures have no unhandled rejection", pageErrors.length === 0);
  for (const action of ["import", "copy"]) {
    await c.page.route("**/api/me/progress{,/copy}", (route) => route.fulfill({ status: 500, body: "internal error" }));
    if (action === "import") await c.page.setInputFiles("#settings-import-file", file);
    else await c.page.click("#settings-copy");
    await c.page.waitForTimeout(300);
    check(`${action}: server failure is not blamed on file or code`, (await status(c.page)) === `Couldn't ${action} progress.`);
    await c.page.unroute("**/api/me/progress{,/copy}");
  }
  await browser.close();
} finally {
  child.kill("SIGKILL");
}
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
