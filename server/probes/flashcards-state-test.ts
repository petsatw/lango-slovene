// Acceptance check for flashcard rating state in the learner model and the API
// (docs/features/flashcards/spec.md §7, §8, §10).
//   npx tsx server/probes/flashcards-state-test.ts
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CARD = "star_sem_let";
const CODE_A = "FC-A";
const CODE_B = "FC-B"; // a code derives the learner id, so each learner carries their own code
process.env.TESTER_CODES = `${CODE_A},${CODE_B}`; // so resolveId here derives the ids the server derives
const temps: string[] = [];
const tempDir = (prefix: string) => { const d = mkdtempSync(path.join(tmpdir(), prefix)); temps.push(d); return d; };
const data = tempDir("fc-state-");
process.env.DATA_DIR = data; // the in-process learner store below reads it on import
const learner = await import("../assets/learner");
const { applyCredit } = await import("../mastery");
const { resolveId } = learner;

const fail = (m: string): never => { throw new Error(m); };
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

let child: ChildProcess | undefined;
let base = "";
async function start(extra: Record<string, string> = {}, dataDir = data) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  base = `http://127.0.0.1:${port}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env, E3_PROVIDER: "elevenlabs",
    ELEVENLABS_MODEL_ID: "eleven_v3",
    ELEVENLABS_VOICE_ID: "fSzEIez35vDdOs4DQwVh",
    ELEVENLABS_VOICE_ID_MALE: "Jcyy5bkqt86ud0xdZhfW",
    ELEVENLABS_VOICE_ID_SHOP_ASSISTANT: "MMDUS1hxcZnX8i9ZdqNf",
    PORT: String(port), DATA_DIR: dataDir, TESTER_CODES: `${CODE_A},${CODE_B}`, ...extra,
  };
  delete env.ELEVENLABS_API_KEY;
  delete env.GEMINI_API_KEY;
  child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], { env, stdio: "ignore" });
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  fail("server did not start");
}
async function stop() {
  if (!child) return;
  const c = child;
  c.kill("SIGKILL");
  await new Promise((r) => c.once("exit", r));
  child = undefined;
}

const call = (code: string, method: string, url: string, body?: unknown) =>
  fetch(`${base}${url}`, {
    method,
    headers: { "x-tester-code": code, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
const cards = async (code: string, domainId = "sprehod") => {
  const r = await call(code, "GET", `/api/flashcards?domainId=${domainId}`);
  const text = await r.text();
  return { status: r.status, text, body: r.status === 200 ? JSON.parse(text) : null };
};
const rateCard = async (code: string, result: string, id = CARD, domainId = "sprehod") => {
  const r = await call(code, "POST", "/api/flashcards/rate", { domainId, id, result });
  return { status: r.status, body: await r.json() };
};
const cardOf = (b: any, id = CARD) => b.cards.find((c: any) => c.id === id);
const fileOf = (dir: string, code: string) => path.join(dir, "learners", `${resolveId(code, "")}.json`);
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));

async function fiveNails(code: string) {
  for (let i = 1; i <= 5; i++) eq(`nail ${i}`, (await rateCard(code, "nailed")).body, { memorised: i === 5, due: i !== 5 });
}

try {
  await start();
  const fileA = fileOf(data, CODE_A);

  // 2. The list.
  const first = await cards(CODE_A);
  eq("list status", first.status, 200);
  eq("card count", first.body.cards.length, 80);
  const keys = ["due", "en", "example", "id", "memorised", "sl"];
  for (const c of first.body.cards) {
    const k = Object.keys(c).filter((x) => x !== "note").sort();
    eq(`keys of ${c.id}`, k, keys);
    eq(`state of ${c.id}`, [c.memorised, c.due], [false, true]);
  }
  if (/"(nailed|memorisedAt|lastRatedAt)"/.test(first.text)) fail("list body carries a count or a date");

  // 3. Five nails; the learner file keeps mastery and facts as they were.
  const before = read(fileA);
  await fiveNails(CODE_A);
  const after = read(fileA);
  eq("nailed", after.flashcards[CARD].nailed, 5);
  if (!after.flashcards[CARD].memorisedAt || !after.flashcards[CARD].lastRatedAt) fail("dates not set");
  eq("learnables untouched", after.learnables, before.learnables);
  eq("facts untouched", after.facts, before.facts);

  // 4. Oops keeps the count and moves lastRatedAt.
  const rated = after.flashcards[CARD].lastRatedAt;
  await new Promise((r) => setTimeout(r, 20));
  await rateCard(CODE_A, "oops");
  const afterOops = read(fileA).flashcards[CARD];
  eq("oops keeps nailed", afterOops.nailed, 5);
  if (afterOops.lastRatedAt === rated) fail("oops did not move lastRatedAt");

  // 5. Per learner.
  const b = await cards(CODE_B);
  eq("B memorised", cardOf(b.body).memorised, false);

  // 6. touch() keeps flashcards (fresh process: touch stamps at most hourly per process).
  await stop();
  await start();
  const stale = read(fileA);
  const old = new Date(Date.now() - 2 * 3600_000).toISOString();
  writeFileSync(fileA, JSON.stringify({ ...stale, lastSeenAt: old }));
  eq("list after touch", (await cards(CODE_A)).status, 200);
  const touched = read(fileA);
  if (touched.lastSeenAt === old) fail("lastSeenAt not renewed");
  eq("flashcards after touch", touched.flashcards, stale.flashcards);

  // 7. Crediting keeps flashcards and adds mastery: tap through Walking the Dogs level 1.
  // Walking the Dogs levels are tap trees, which /api/scene does not serve, so the crediting write path
  // /api/scene uses is run in-process against the same data dir.
  const idA = resolveId(CODE_A, "");
  const learnablesBefore = Object.keys(read(fileA).learnables).length;
  learner.save(idA, applyCredit(learner.load(idA), [{ id: "dober_dan", result: "attempt" }]));
  const credited = read(fileA);
  if (Object.keys(credited.learnables).length <= learnablesBefore) fail("no learnable credited");
  eq("flashcards after credit", credited.flashcards, stale.flashcards);

  // 8. Due after 30 days.
  const memorisedAt = new Date(Date.now() - 31 * 86_400_000).toISOString();
  writeFileSync(fileA, JSON.stringify({ ...credited, flashcards: { ...credited.flashcards, [CARD]: { ...credited.flashcards[CARD], memorisedAt } } }));
  const overdue = cardOf((await cards(CODE_A)).body);
  eq("overdue", [overdue.memorised, overdue.due], [true, true]);

  // 9. Restart on the same DATA_DIR.
  await stop();
  await start();
  eq("after restart", cardOf((await cards(CODE_A)).body).memorised, true);

  // 10. History deletion keeps flashcards; deleting the learner removes the file.
  eq("delete history", (await call(CODE_A, "DELETE", "/api/history")).status, 204);
  eq("flashcards after history delete", read(fileA).flashcards[CARD].nailed, 5);
  eq("delete me", (await call(CODE_A, "DELETE", "/api/me")).status, 204);
  if (existsSync(fileA)) fail("learner file survived DELETE /api/me");
  eq("after delete me", cardOf((await cards(CODE_A)).body).memorised, false);

  // 11. Errors.
  eq("unknown domain GET", (await cards(CODE_A, "no-such-domain")).status, 404);
  eq("unknown domain POST", (await rateCard(CODE_A, "nailed", CARD, "no-such-domain")).status, 404);
  eq("id outside sprehod", (await rateCard(CODE_A, "nailed", "kruh")).status, 400); // a bakery card
  eq("bad result", (await rateCard(CODE_A, "great")).status, 400);

  // 12. Other stores.
  for (const extra of <Record<string, string>[]>[{ LEARNER_STORE: "memory" }, { LEARNER_STORE: "file", LEARNER_PATH: path.join(tempDir("fc-file-"), "learner.json") }]) {
    await stop();
    await start(extra, tempDir("fc-store-"));
    await fiveNails(CODE_A);
    eq(`${extra.LEARNER_STORE} memorised`, cardOf((await cards(CODE_A)).body).memorised, true);
    await cards(CODE_A, "bakery");
    eq(`${extra.LEARNER_STORE} still memorised`, cardOf((await cards(CODE_A)).body).memorised, true);
  }

  await stop();
  console.log("PASS");
} catch (e: any) {
  console.log("FAIL", e.message);
  await stop();
  process.exitCode = 1;
} finally {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
}
process.exit(process.exitCode ?? 0);
