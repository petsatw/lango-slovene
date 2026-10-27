// Acceptance check for tester identity: an allowlisted code derives the learnerId whatever the browser
// id, an unknown code or none falls back to the per-browser id, and every turn-log row carries both.
//   npx tsx server/probes/tester-identity-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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
} finally {
  child.kill("SIGKILL");
}
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
