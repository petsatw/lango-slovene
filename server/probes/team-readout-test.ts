// Acceptance check for the team readout: GET /v1/team/events behind TEAM_READ_KEY returns settled event
// rows and live session summaries in one ts order with a resumable cursor (docs/features/team-readout/spec.md).
//   npx tsx server/probes/team-readout-test.ts
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LEARNABLES } from "../learnables";

const fail = (m: string): never => { throw new Error(m); };
const check = (ok: unknown, m: string) => { if (!ok) fail(m); };

const learnable = Object.values(LEARNABLES)[0];
const data = mkdtempSync(path.join(tmpdir(), "team-"));
mkdirSync(path.join(data, "events"), { recursive: true });
mkdirSync(path.join(data, "live"), { recursive: true });
const eventsPath = path.join(data, "events", "events.jsonl");

// --- seed ---
const t0 = Date.parse("2026-10-01T00:00:00.000Z");
const lines: string[] = [];
for (let i = 0; i < 1100; i++) {
  const row: Record<string, unknown> = {
    name: "screen_viewed",
    ts: new Date(t0 + i * 60_000).toISOString(),
    learnerId: `L${i % 7}`,
    testerCode: i % 3 === 0 ? "TEST-01" : null,
    props: { screen: "home" },
  };
  if (i === 10) { row.name = "feedback_submitted"; row.props = { surface: "live_end" }; row.text = "probe feedback text"; }
  if (i === 20) { row.ip = "203.0.113.9"; row.ua = "probe-agent"; }
  lines.push(JSON.stringify(row));
}
lines.push(JSON.stringify({ name: "app_open", ts: new Date().toISOString(), learnerId: "unsettled", testerCode: null, props: {} }));
lines.push("this line is not json");
writeFileSync(eventsPath, lines.join("\n") + "\n");

const liveLog = (over: Record<string, unknown>, startIso: string, secs: number) => {
  const sessionId = randomUUID();
  const log = {
    sessionId, learnerId: "Llive", testerCode: "TEST-01", runId: null, lessonId: "lesson-x", provider: "grok",
    startedAt: startIso, endedAt: new Date(Date.parse(startIso) + secs * 1000).toISOString(),
    transcripts: [{ ts: startIso, role: "user", text: "probe transcript line" }], error: null, ...over,
  };
  writeFileSync(path.join(data, "live", `${sessionId}.json`), JSON.stringify(log));
  return sessionId;
};
const liveA = liveLog({ progressed: [learnable.id] }, "2026-10-02T10:00:00.000Z", 120);
const liveB = liveLog({ error: "vendor_connect" }, "2026-10-02T11:00:00.000Z", 30);
const liveC = liveLog({}, "2026-10-02T12:00:00.000Z", 600);
writeFileSync(path.join(data, "live", `${randomUUID()}.gloss.json`), JSON.stringify({ x: "probe transcript line" }));
const eventBytes = () => readFileSync(eventsPath);

// --- server ---
async function withServer(teamKey: string | undefined, fn: (get: (p: string, init?: RequestInit) => Promise<Response>, output: () => string) => Promise<void>) {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const base = `http://127.0.0.1:${port}`;
  const env: Record<string, string | undefined> = {
    ...process.env, PORT: String(port), DATA_DIR: data, TESTER_CODES: "TEST-01", SESSION_TTL_SEC: "600", TEAM_READ_KEY: teamKey,
  };
  if (teamKey === undefined) delete env.TEAM_READ_KEY;
  const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], { env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  child.stdout.on("data", (b) => (out += b));
  child.stderr.on("data", (b) => (out += b));
  try {
    let ok = false;
    for (let i = 0; i < 120 && !ok; i++) {
      try { ok = (await fetch(`${base}/api/health`)).ok; } catch {}
      if (!ok) await new Promise((r) => setTimeout(r, 500));
    }
    check(ok, "server did not start");
    await fn((p, init) => fetch(base + p, init), () => out);
  } finally {
    child.kill("SIGKILL");
    await new Promise((r) => setTimeout(r, 300));
  }
}

const bearer = (k: string) => ({ headers: { Authorization: `Bearer ${k}` } });

async function expectUnknown(get: (p: string, init?: RequestInit) => Promise<Response>, init: RequestInit | undefined, what: string) {
  const ref = await get("/v1/team/nope");
  const refBody = await ref.text();
  const r = await get("/v1/team/events", init);
  const body = await r.text();
  check(r.status === 404 && ref.status === 404, `${what}: expected 404, got ${r.status}`);
  check(body === refBody.replace("/v1/team/nope", "/v1/team/events"), `${what}: body differs from unknown path`);
}

try {
  // 2. key unset, then empty
  for (const k of [undefined, ""]) {
    await withServer(k, async (get) => { await expectUnknown(get, bearer("anything"), `TEAM_READ_KEY=${JSON.stringify(k)}`); });
  }

  // 3-9. key set
  const key = randomBytes(32).toString("base64url");
  await withServer(key, async (get, output) => {
    const noSaveId = liveLog({ noSave: true }, "2026-10-02T13:00:00.000Z", 60);
    await expectUnknown(get, undefined, "no header");
    await expectUnknown(get, { headers: { Authorization: `Basic ${key}` } }, "Basic scheme");
    const flipped = (key[0] === "A" ? "B" : "A") + key.slice(1);
    await expectUnknown(get, bearer(flipped), "wrong key, same length");
    await expectUnknown(get, bearer(key + "x"), "wrong key, other length");

    const first = await get("/v1/team/events", bearer(key));
    check(first.status === 200, `right bearer: ${first.status}`);
    check(first.headers.get("cache-control") === "no-store", "Cache-Control no-store missing");
    const fb = await first.json();
    check(fb.rows.length === 500 && fb.more === true, `default page: ${fb.rows.length} rows, more=${fb.more}`);

    // 4. walk
    const all: any[] = [];
    const bodies: string[] = [JSON.stringify(fb)];
    let cursor = "";
    let lastNext: string | null = null;
    for (let i = 0; i < 10; i++) {
      const r = await get(`/v1/team/events?limit=400${cursor}`, bearer(key));
      check(r.status === 200, `walk page ${i}: ${r.status}`);
      const text = await r.text();
      bodies.push(text);
      const b = JSON.parse(text);
      all.push(...b.rows);
      lastNext = b.next;
      if (!b.more) break;
      cursor = `&cursor=${b.next}`;
      check(i < 9, "walk did not finish");
    }
    const events = all.filter((r) => r.kind === "event");
    const lives = all.filter((r) => r.kind === "live_session");
    check(events.length === 1100 && lives.length === 3, `walk: ${events.length} events, ${lives.length} live`);
    for (let i = 1; i < all.length; i++) check(all[i - 1].ts <= all[i].ts, "ts decreased");
    check(new Set(events.map((r) => r.ts)).size === 1100, "duplicate event rows");
    check(!events.some((r) => r.learnerId === "unsettled"), "unsettled row returned");
    check(!lives.some((r) => r.sessionId === noSaveId), "noSave log returned");
    const evKeys = new Set(["kind", "name", "ts", "learnerId", "tester", "props", "text"]);
    for (const r of events) {
      check(Object.keys(r).every((k) => evKeys.has(k)), `event row keys: ${Object.keys(r)}`);
      const i = Math.round((Date.parse(r.ts) - t0) / 60_000);
      check(r.tester === (i % 3 === 0), `tester wrong at row ${i}`);
    }
    check(events.find((r) => r.name === "feedback_submitted")?.text === "probe feedback text", "feedback text missing");
    const liveKeys = ["kind", "ts", "sessionId", "learnerId", "tester", "lessonId", "provider", "start", "end", "reason", "error", "progressed"].sort();
    for (const r of lives) check(JSON.stringify(Object.keys(r).sort()) === JSON.stringify(liveKeys), `live keys: ${Object.keys(r)}`);
    const live = (id: string) => lives.find((r) => r.sessionId === id);
    check(live(liveA)?.reason === "user" && live(liveB)?.reason === "error" && live(liveC)?.reason === "ttl", "live reasons");
    check(live(liveB)?.error === "vendor_connect", "live error code");
    check(live(liveA)?.progressed?.[0]?.name === learnable.sl && live(liveA)?.progressed?.[0]?.id === learnable.id, "progressed name");
    check(live(liveB)?.progressed === null, "error log progressed not null");
    const blob = bodies.join("");
    check(!blob.includes("probe transcript line") && !blob.includes("TEST-01"), "body leaks transcript or tester code");
    check(!blob.includes("203.0.113.9") && !blob.includes("probe-agent"), "body leaks ip/ua");

    // 5. query
    const big = await (await get("/v1/team/events?limit=5000", bearer(key))).json();
    check(big.rows.length === 1000, `limit=5000 gave ${big.rows.length}`);
    for (const q of ["limit=0", "since=nonsense", "cursor=nonsense"]) {
      const r = await get(`/v1/team/events?${q}`, bearer(key));
      check(r.status === 400, `${q}: ${r.status}`);
    }
    const nth = events[999].ts;
    const sinceRows = (await (await get(`/v1/team/events?since=${encodeURIComponent(nth)}&limit=1000`, bearer(key))).json()).rows;
    check(sinceRows.length > 0 && sinceRows.every((r: any) => r.ts >= nth), "since returned older rows");

    // 6. resume
    const added = new Date(Date.now() - 10 * 60_000).toISOString();
    appendFileSync(eventsPath, JSON.stringify({ name: "app_open", ts: added, learnerId: "resumed", testerCode: null, props: {} }) + "\n");
    const resumed = await (await get(`/v1/team/events?cursor=${lastNext}`, bearer(key))).json();
    check(resumed.rows.length === 1 && resumed.rows[0].learnerId === "resumed", `resume gave ${resumed.rows.length} rows`);
    const again = await (await get(`/v1/team/events?cursor=${resumed.next}`, bearer(key))).json();
    check(again.rows.length === 0 && again.next === resumed.next && again.more === false, "resume after resume");

    // 7. other methods
    const before = eventBytes();
    for (const method of ["POST", "PUT", "DELETE"]) {
      const r = await get("/v1/team/events", { method, ...bearer(key) });
      check(r.status === 404, `${method}: ${r.status}`);
    }
    check(before.equals(eventBytes()), "events.jsonl changed");

    // 8. rate limit
    const statuses: number[] = [];
    let retryAfter: string | null = null;
    for (let i = 0; i < 61; i++) {
      const r = await get("/v1/team/events?limit=1", bearer(key));
      statuses.push(r.status);
      if (r.status === 429) retryAfter = r.headers.get("retry-after");
      await r.text();
    }
    check(statuses.includes(429) && retryAfter, "no 429 with Retry-After");
    await expectUnknown(get, bearer(flipped), "wrong bearer after limit");

    // 9. output
    await new Promise((r) => setTimeout(r, 300));
    const out = output();
    check(!out.includes(key) && !out.includes("Bearer"), "server output holds key or Bearer");
  });
  console.log("PASS");
} catch (err: any) {
  console.error("FAIL:", err?.message ?? err);
  process.exit(1);
}
