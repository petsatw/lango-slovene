// Acceptance check for export / import / copy of learner progress
// (docs/features/learner-progress/spec.md).
//   npx tsx server/probes/learner-progress-test.ts
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "progress-"));
const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port), DATA_DIR: data, TESTER_CODES: "TEST-01" };
delete env.LEARNER_STORE;
delete env.LEARNERS_DIR;
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], { env, stdio: "ignore" });

const fail = (m: string): never => { throw new Error(m); };
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const call = (who: string, method: string, url: string, body?: string) =>
  fetch(base + url, { method, headers: { "x-learner-id": who, "content-type": "application/json" }, body });
const json = async (who: string, method: string, url: string, body?: unknown) => {
  const r = await call(who, method, url, body === undefined ? undefined : JSON.stringify(body));
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
};
// The progress a learner holds, without the write times.
const progress = async (who: string) => {
  const { updatedAt, lastSeenAt, ...rest } = (await json(who, "GET", "/api/me/progress")).body;
  return rest;
};
const views = async (who: string) => ({
  deck: (await json(who, "GET", "/api/flashcards?domainId=sprehod")).body.cards.map((c: any) => [c.id, c.memorised, c.due]),
  learner: (await json(who, "GET", "/api/learner")).body,
});

try {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 500));
    if (i === 119) fail("server did not start");
  }

  // Source learner A: five nailed ratings on one card and one oops on another.
  const cards = (await json("A", "GET", "/api/flashcards?domainId=sprehod")).body.cards;
  const c1 = cards[0].id, c2 = cards[1].id;
  for (let i = 0; i < 5; i++) await json("A", "POST", "/api/flashcards/rate", { domainId: "sprehod", id: c1, result: "nailed" });
  await json("A", "POST", "/api/flashcards/rate", { domainId: "sprehod", id: c2, result: "oops" });
  const a = await progress("A");
  if (!a.flashcards?.[c1]?.memorisedAt) fail("A has no memorised card");
  eq("empty learner exports, not 404", (await json("nobody", "GET", "/api/me/progress")).status, 200);

  // Export A, import onto B: B's views match A's.
  const exported = (await json("A", "GET", "/api/me/progress")).body;
  eq("import status", (await json("B", "PUT", "/api/me/progress", { ...exported, id: "A", testerCode: "TEST-01" })).status, 200);
  eq("B progress", await progress("B"), a);
  eq("B views", await views("B"), await views("A"));
  eq("B identity unchanged", (await json("B", "GET", "/api/me")).body, { testerCode: null });

  // A tester model is reached through its code, not a disguised browser header.
  const testerHeaders = { "x-tester-code": "TEST-01", "content-type": "application/json" };
  eq("tester import", (await fetch(base + "/api/me/progress", {
    method: "PUT", headers: testerHeaders, body: JSON.stringify(exported),
  })).status, 200);
  const testerModel = await (await fetch(base + "/api/me/progress", { headers: testerHeaders })).json();
  const derived = "t-" + createHash("sha256").update("TEST-01").digest("hex").slice(0, 16);
  for (const header of [derived, "/" + derived]) {
    eq("browser header cannot export tester", (await json(header, "GET", "/api/me/progress")).body.flashcards, undefined);
    await json(header, "PUT", "/api/me/progress", { facts: { marker: "browser" } });
    eq("browser header cannot replace tester", await (await fetch(base + "/api/me/progress", { headers: testerHeaders })).json(), testerModel);
  }

  // Copy A onto C: C matches A, A is untouched.
  const aFile = JSON.stringify((await json("A", "GET", "/api/me/progress")).body);
  eq("copy status", (await json("C", "POST", "/api/me/progress/copy", { from: "A" })).status, 200);
  eq("C progress", await progress("C"), a);
  eq("C views", await views("C"), await views("A"));
  eq("A unchanged", JSON.stringify((await json("A", "GET", "/api/me/progress")).body), aFile);
  eq("copy onto self", (await json("A", "POST", "/api/me/progress/copy", { from: "A" })).status, 200);
  eq("A unchanged by self copy", JSON.stringify((await json("A", "GET", "/api/me/progress")).body), aFile);

  // Bad bodies and missing sources change nothing.
  eq("bad json", (await call("B", "PUT", "/api/me/progress", "{nope")).status, 400);
  eq("array body", (await json("B", "PUT", "/api/me/progress", [1])).status, 400);
  eq("missing source", (await json("B", "POST", "/api/me/progress/copy", { from: "ghost" })).status, 404);
  eq("no from", (await json("B", "POST", "/api/me/progress/copy", {})).status, 400);
  eq("derived id refused", (await json("B", "POST", "/api/me/progress/copy", { from: "t-0123456789abcdef" })).status, 400);
  eq("B unchanged after rejects", await progress("B"), a);

  // Junk rows are dropped by the shaper.
  await json("D", "PUT", "/api/me/progress", { learnables: {}, flashcards: { [c1]: { nailed: -1 }, [c2]: { nailed: 2 } }, junk: 1 });
  eq("shaped import", (await progress("D")).flashcards, { [c2]: { nailed: 2 } });

  // A malformed imported learnable must not poison the inspection/learning read paths.
  await json("D", "PUT", "/api/me/progress", { learnables: {
    valid: { attempts: 3, successes: 2, firstProducedAt: "2026-11-01T12:00:00Z", lastProducedAt: "2026-11-02T12:00:00Z", junk: 1 },
    absent: null, scalar: 1, array: [], missing: {}, negative: { attempts: -1, successes: 0 },
  }, facts: { gender: "f", bad: { toString: null }, count: 1 } });
  eq("shaped learnables", (await progress("D")).learnables, {
    valid: { attempts: 3, successes: 2, firstProducedAt: "2026-11-01T12:00:00Z", lastProducedAt: "2026-11-02T12:00:00Z" },
  });
  eq("shaped facts", (await progress("D")).facts, { gender: "f" });
  eq("imported learner remains inspectable", (await json("D", "GET", "/api/learner")).status, 200);
  await json("D", "PUT", "/api/me/progress", { learnables: "bad" });
  eq("non-object learnables dropped", (await progress("D")).learnables, {});

  console.log("PASS");
  child.kill("SIGKILL");
  process.exit(0);
} catch (e: any) {
  console.log("FAIL", e.message);
  child.kill("SIGKILL");
  process.exit(1);
}
