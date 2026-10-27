// Acceptance check for tester identity: an allowlisted code derives the learnerId whatever the browser
// id, an unknown code or none falls back to the per-browser id, and every turn-log row carries both. A
// fresh browser opening the invite link stores the code, strips ?c= and sends it on its next request.
//   npx tsx server/probes/tester-identity-test.ts
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "tester-"));
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], {
  env: { ...process.env, PORT: String(port), DATA_DIR: data, TESTER_CODES: "TEST-01", TURNLOG: "1" },
  stdio: "ignore",
});

async function up() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start");
}

async function seedTurn(headers: Record<string, string>) {
  const r = await fetch(`${base}/api/converse`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ seedId: "getting-started", begin: true }),
  });
  if (!r.ok) throw new Error(`converse ${r.status}: ${await r.text()}`);
}

let pass = false;
try {
  await up();
  await seedTurn({ "x-tester-code": "TEST-01", "x-learner-id": "browser-a" });
  await seedTurn({ "x-tester-code": "TEST-01", "x-learner-id": "browser-b" });
  await seedTurn({ "x-tester-code": "NOT-A-CODE", "x-learner-id": "browser-c" });
  const read = () => readFileSync(path.join(data, "turnlog", "turns.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const derived = read()[0]?.learnerId;
  await seedTurn({ "x-learner-id": derived });
  const rows = read();
  for (const r of rows) console.log(JSON.stringify({ path: r.path, seedId: r.seedId, learnerId: r.learnerId, testerCode: r.testerCode }));
  const [a, b, c, d] = rows;
  pass =
    rows.length === 4 &&
    /^t-[0-9a-f]{16}$/.test(derived) &&
    a.testerCode === "TEST-01" && b.testerCode === "TEST-01" && b.learnerId === derived &&
    c.learnerId === "browser-c" && c.testerCode === null &&
    d.learnerId !== derived;

  // The invite link, on a fresh profile.
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const codes: (string | undefined)[] = [];
  // The learner-scoped calls; /api/speak and /api/image serve media and name no learner.
  page.on("request", (r) => {
    const p = new URL(r.url()).pathname;
    if (p.startsWith("/api/") && p !== "/api/speak" && p !== "/api/image") codes.push(r.headers()["x-tester-code"]);
  });
  const sceneWritten = page.waitForResponse((r) => r.url().endsWith("/api/scene"));
  await page.goto(`${base}/?c=TEST-01`);
  await sceneWritten;
  const stored = await page.evaluate(() => localStorage.getItem("testerCode"));
  const url = page.url();
  await browser.close();
  const expected = "t-" + createHash("sha256").update("TEST-01").digest("hex").slice(0, 16);
  const learnerFile = path.join(data, "learners", `${expected}.json`);
  const browserChecks = {
    "localStorage.testerCode": stored === "TEST-01",
    "?c= stripped": !new URL(url).searchParams.has("c"),
    "next requests carry x-tester-code": codes.length > 0 && codes.every((c) => c === "TEST-01"),
    [`server wrote learner ${expected}`]: existsSync(learnerFile) && derived === expected,
  };
  console.log(JSON.stringify({ url, testerCode: stored, apiRequests: codes.length, learnerFile: path.relative(data, learnerFile) }));
  for (const [name, ok] of Object.entries(browserChecks)) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  pass = pass && Object.values(browserChecks).every(Boolean);
} finally {
  child.kill("SIGKILL");
}
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
