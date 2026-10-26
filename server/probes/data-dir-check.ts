// Acceptance check for DATA_DIR: learner progress, a session, a live log and a gloss-cache entry written
// under DATA_DIR survive a server restart; with DATA_DIR unset the same files land under ASSET_DIR.
//   npx tsx server/probes/data-dir-check.ts
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ID = "datadir-check";
const SCENARIOS = ["slavko-intro", "trznica", "sprehod", "library", "bakery", "demo", "restaurant"];
let port = 20000 + Math.floor(Math.random() * 20000);

async function start(env: Record<string, string>): Promise<{ child: ChildProcess; base: string }> {
  const base = `http://127.0.0.1:${++port}`;
  const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], {
    env: { ...process.env, PORT: String(port), TURNLOG: "0", ...env },
    stdio: "ignore",
  });
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/learner`)).ok) return { child, base }; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error("server did not start");
}

async function stop(child: ChildProcess) {
  child.kill("SIGKILL");
  await new Promise((r) => setTimeout(r, 500));
}

/** Learner progress through the API, then a session, live log and gloss entry through their module functions. */
async function seed(base: string, env: Record<string, string>): Promise<void> {
  let ok = false;
  for (const scenarioId of SCENARIOS) {
    const r = await fetch(`${base}/api/scene`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-learner-id": ID },
      body: JSON.stringify({ scenarioId }),
    });
    if (r.ok) { ok = true; console.log("progress via /api/scene scenarioId =", scenarioId, (await r.text()).slice(0, 80)); break; }
  }
  if (!ok) throw new Error("no spoken scene answered /api/scene");
  // The module functions run in a child process so they read the same env the server did.
  await new Promise<void>((resolve, reject) => {
    const p = spawn("npx", ["tsx", "-e", `
      import * as sessions from "./server/assets/sessions";
      import * as live from "./server/live/log";
      import * as gloss from "./server/live/gloss";
      import { DATA_DIR } from "./server/assets/store";
      sessions.appendTurns({ id: "${ID}", scenarioId: "demo", turns: [], finalObjectives: [], complete: false });
      live.write({ sessionId: "${ID}", runId: null, lessonId: "x", provider: "grok", startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(), transcripts: [], error: null });
      import("node:fs").then((fs) => { fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(DATA_DIR + "/gloss-cache.json", JSON.stringify({ "zxq check": "check" })); });
      void gloss;
    `], { env: { ...process.env, TURNLOG: "0", ...env }, stdio: "inherit" });
    p.on("exit", (c) => (c === 0 ? resolve() : reject(new Error("seed exited " + c))));
  });
}

const found = (root: string) => ({
  learner: existsSync(path.join(root, "learners", `${ID}.json`)),
  session: existsSync(path.join(root, "sessions", `${ID}.json`)),
  live: existsSync(path.join(root, "live")),
  gloss: existsSync(path.join(root, "gloss-cache.json")),
});

const progress = async (base: string) => JSON.stringify(await (await fetch(`${base}/api/learner`, { headers: { "x-learner-id": ID } })).json());

// 1. DATA_DIR set: seed, restart, compare.
const data = mkdtempSync(path.join(tmpdir(), "data-"));
const assets = mkdtempSync(path.join(tmpdir(), "assets-"));
const env = { DATA_DIR: data, ASSET_DIR: assets };
let s = await start(env);
await seed(s.base, env);
const before = await progress(s.base);
await stop(s.child);
s = await start(env);
const after = await progress(s.base);
await stop(s.child);
const underData = found(data);
const underAssetsWhenSet = found(assets);
console.log("DATA_DIR set  — files under DATA_DIR:", underData);
console.log("DATA_DIR set  — files under ASSET_DIR:", underAssetsWhenSet);
console.log("learner unchanged after restart:", before === after, before.slice(0, 120));

// 2. DATA_DIR unset: same files land under ASSET_DIR.
const assets2 = mkdtempSync(path.join(tmpdir(), "assets-"));
const s2 = await start({ ASSET_DIR: assets2 });
await seed(s2.base, { ASSET_DIR: assets2 });
await stop(s2.child);
const unset = found(assets2);
console.log("DATA_DIR unset — files under ASSET_DIR:", unset);

const all = (o: Record<string, boolean>) => Object.values(o).every(Boolean);
const none = (o: Record<string, boolean>) => Object.values(o).every((v) => !v);
const pass = before === after && all(underData) && none(underAssetsWhenSet) && all(unset);
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
