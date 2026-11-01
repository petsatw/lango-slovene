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

const learnable = Object.values(LEARNABLES)[0] ?? fail("no learnables");
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
  if (i === 30) row.text = "stray text"; // text is returned on feedback_submitted only
  lines.push(JSON.stringify(row));
}
lines.push(JSON.stringify({ name: "app_open", ts: new Date().toISOString(), learnerId: "unsettled", testerCode: null, props: {} }));
lines.push("this line is not json");
// Settling: 4 minutes old is still inside the 5-minute window.
lines.push(JSON.stringify({ name: "app_open", ts: new Date(Date.now() - 4 * 60_000).toISOString(), learnerId: "unsettled4", testerCode: null, props: {} }));
// Same-ts ties: three identical lines (keys sha#1..#3), two distinct lines and (below) a live log, all at TIE.
const TIE = "2026-10-03T00:00:00.000Z";
const dupLine = JSON.stringify({ name: "tie_dup", ts: TIE, learnerId: "LtieDup", testerCode: null, props: {} });
const tieA = JSON.stringify({ name: "tie", ts: TIE, learnerId: "LtieA", testerCode: null, props: {} });
const tieB = JSON.stringify({ name: "tie", ts: TIE, learnerId: "LtieB", testerCode: null, props: {} });
lines.push(dupLine, tieA, dupLine, tieB, dupLine);
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
const liveTie = liveLog({}, "2026-10-02T23:59:00.000Z", 60); // ends at TIE
writeFileSync(path.join(data, "live", `${randomUUID()}.gloss.json`), JSON.stringify({ x: "probe transcript line" }));
// A valid-looking log under a non-36-char id is not read.
writeFileSync(path.join(data, "live", "abc.json"), JSON.stringify({ sessionId: "abc", learnerId: "Lshort", testerCode: null, lessonId: "x", provider: "grok", startedAt: "2026-10-02T09:00:00.000Z", endedAt: "2026-10-02T09:01:00.000Z", transcripts: [], error: null }));
const eventBytes = () => readFileSync(eventsPath);

// --- server ---
type Get = (p: string, init?: RequestInit) => Promise<Response>;
const seen: string[] = []; // every status line, header and body the probe received, checked for the key at the end
let authed = 0; // authorised GETs on the route in the current server run (rate-limit accounting)
async function withServer(teamKey: string | undefined, fn: (get: Get, output: () => string) => Promise<void>) {
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
    authed = 0;
    const get: Get = async (p, init) => {
      const r = await fetch(base + p, init);
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (teamKey && auth === `Bearer ${teamKey}` && p.startsWith("/v1/team/events") && (init?.method ?? "GET") === "GET") authed++;
      seen.push(`${r.status} ${JSON.stringify([...r.headers])} ${await r.clone().text()}`);
      return r;
    };
    await fn(get, () => out);
  } finally {
    child.kill("SIGKILL");
    await new Promise((r) => setTimeout(r, 300));
  }
}

const bearer = (k: string) => ({ headers: { Authorization: `Bearer ${k}` } });

async function expectUnknown(get: Get, init: RequestInit | undefined, what: string, query = "") {
  const ref = await get("/v1/team/nope" + query, init);
  const refBody = await ref.text();
  const r = await get("/v1/team/events" + query, init);
  const body = await r.text();
  check(r.status === 404 && ref.status === 404, `${what}: expected 404, got ${r.status}`);
  check(!r.headers.get("retry-after") && !r.headers.get("cache-control"), `${what}: 404 carries readout headers`);
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
    await expectUnknown(get, bearer(key.slice(0, 8)), "wrong key, short");
    await expectUnknown(get, { headers: { Authorization: "Bearer " } }, "empty bearer");
    await expectUnknown(get, { headers: { Authorization: key } }, "bare key, no scheme");
    // Parameters are checked only after the key: bad params without the key are still the unknown path.
    await expectUnknown(get, bearer(flipped), "wrong key, bad params", "?limit=0&since=x&cursor=x");
    await expectUnknown(get, undefined, "no header, bad params", "?limit=0");
    // HEAD is not GET: Express would otherwise route it to the GET handler.
    const head = await get("/v1/team/events", { method: "HEAD", ...bearer(key) });
    const headRef = await get("/v1/team/nope", { method: "HEAD", ...bearer(key) });
    check(head.status === 404 && headRef.status === 404, `HEAD: ${head.status}`);
    check(authed === 0, "unauthorised requests were counted as authed");

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
    check(events.length === 1105 && lives.length === 4, `walk: ${events.length} events, ${lives.length} live`);
    for (let i = 1; i < all.length; i++) check(all[i - 1].ts <= all[i].ts, "ts decreased");
    const plain = events.filter((r) => !String(r.learnerId).startsWith("Ltie"));
    check(plain.length === 1100 && new Set(plain.map((r) => r.ts)).size === 1100, "duplicate or missing event rows");
    check(events.filter((r) => r.learnerId === "LtieDup").length === 3, "identical lines not returned once each");
    check(!events.some((r) => r.learnerId === "unsettled" || r.learnerId === "unsettled4"), "unsettled row returned");
    check(!lives.some((r) => r.sessionId === "abc" || r.learnerId === "Lshort"), "non-36-char log returned");
    check(!lives.some((r) => r.sessionId === noSaveId), "noSave log returned");
    const evKeys = new Set(["kind", "name", "ts", "learnerId", "tester", "props", "text"]);
    for (const r of events) {
      check(Object.keys(r).every((k) => evKeys.has(k)), `event row keys: ${Object.keys(r)}`);
      if (String(r.learnerId).startsWith("Ltie")) continue;
      const i = Math.round((Date.parse(r.ts) - t0) / 60_000);
      check(r.tester === (i % 3 === 0), `tester wrong at row ${i}`);
    }
    check(events.find((r) => r.name === "feedback_submitted")?.text === "probe feedback text", "feedback text missing");
    check(events.filter((r) => "text" in r).length === 1, "text returned on a non-feedback row");
    const liveKeys = ["kind", "ts", "sessionId", "learnerId", "tester", "lessonId", "provider", "start", "end", "reason", "error", "progressed"].sort();
    for (const r of lives) check(JSON.stringify(Object.keys(r).sort()) === JSON.stringify(liveKeys), `live keys: ${Object.keys(r)}`);
    check(lives.every((r) => r.tester === true && r.start && r.end === r.ts), "live tester/start/end");
    const live = (id: string) => lives.find((r) => r.sessionId === id);
    check(live(liveA)?.reason === "user" && live(liveB)?.reason === "error" && live(liveC)?.reason === "ttl", "live reasons");
    check(live(liveB)?.error === "vendor_connect", "live error code");
    check(live(liveA)?.progressed?.[0]?.name === learnable.sl && live(liveA)?.progressed?.[0]?.id === learnable.id, "progressed name");
    check(live(liveB)?.progressed === null, "error log progressed not null");
    const blob = bodies.join("");
    check(!blob.includes("probe transcript line") && !blob.includes("TEST-01") && !blob.includes("stray text"), "body leaks transcript, tester code or stray text");
    check(!blob.includes("203.0.113.9") && !blob.includes("probe-agent"), "body leaks ip/ua");

    // 5. query
    const big = await (await get("/v1/team/events?limit=5000", bearer(key))).json();
    check(big.rows.length === 1000, `limit=5000 gave ${big.rows.length}`);
    const badTs = Buffer.from(JSON.stringify({ ts: "nonsense", k: "x" })).toString("base64url");
    for (const q of ["limit=0", "limit=-1", "limit=1.5", "limit=abc", "since=nonsense", "cursor=nonsense", `cursor=${badTs}`]) {
      const r = await get(`/v1/team/events?${q}`, bearer(key));
      const body = await r.json();
      check(r.status === 400 && body.error === q.split("=")[0], `${q}: ${r.status} ${JSON.stringify(body)}`);
    }
    const one = await (await get("/v1/team/events?limit=1", bearer(key))).json();
    check(one.rows.length === 1 && one.more === true, "limit=1");
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
    // A malformed JSON body is rejected by the body parser before any route, exactly as on an unknown path.
    const badJson = { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: "{not json" };
    const bj = await get("/v1/team/events", badJson);
    const bjRef = await get("/v1/team/nope", badJson);
    check(bj.status === bjRef.status, `malformed POST: ${bj.status} vs ${bjRef.status}`);
    check(before.equals(eventBytes()), "events.jsonl changed");

    // 8. rate limit: exactly 30 authorised requests per window, counting only authorised ones.
    check(authed < 30, `steps 3-7 made ${authed} authorised requests`);
    const allowed = 30 - authed;
    const statuses: number[] = [];
    let retryAfter: string | null = null;
    for (let i = 0; i < 61; i++) {
      const r = await get("/v1/team/events?limit=1", bearer(key));
      statuses.push(r.status);
      if (r.status === 429) retryAfter = r.headers.get("retry-after");
      await r.text();
    }
    check(statuses.includes(429) && retryAfter, "no 429 with Retry-After");
    const firstLimited = statuses.indexOf(429);
    check(firstLimited === allowed && statuses.slice(firstLimited).every((s) => s === 429), `429 after ${firstLimited} requests, expected ${allowed}: ${statuses.join(",")}`);
    const ra = Number(retryAfter);
    check(Number.isInteger(ra) && ra >= 1 && ra <= 60, `Retry-After ${retryAfter}`);
    await expectUnknown(get, bearer(flipped), "wrong bearer after limit");

    // 9. output
    await new Promise((r) => setTimeout(r, 300));
    const out = output();
    check(!out.includes(key) && !out.includes("Bearer"), "server output holds key or Bearer");
  });

  // Cursor edge cases on a fresh server (fresh rate-limit window): same-ts ties, identical lines,
  // mixed event and live rows, empty pages, since + cursor, and deletes.
  await withServer(key, async (get, output) => {
    const pull = async (q: string) => {
      const r = await get(`/v1/team/events?${q}`, bearer(key));
      check(r.status === 200, `${q}: ${r.status}`);
      return r.json() as Promise<{ rows: any[]; next: string | null; more: boolean }>;
    };
    const id = (r: any) => JSON.stringify(r);
    const ref = (await pull(`since=${TIE}&limit=1000`)).rows; // 6 rows at TIE, then the resumed row
    check(ref.length === 7 && ref.slice(0, 6).every((r) => r.ts === TIE) && ref[6].learnerId === "resumed", `since=TIE gave ${ref.map((r) => r.learnerId)}`);
    check(ref[5].kind === "live_session" && ref[5].sessionId === liveTie, "live row does not sort after events at the same ts (live:<id> > hex)");
    check(ref.filter((r) => r.learnerId === "LtieDup").length === 3, "identical lines at TIE");
    for (const limit of [2, 1]) { // limit=1 last: it deletes a row
      const got: any[] = [];
      const nexts: string[] = [];
      let c = "";
      for (let i = 0; i < 10; i++) {
        const b = await pull(`since=${TIE}&limit=${limit}${c}`);
        got.push(...b.rows);
        if (b.next) nexts.push(b.next);
        if (!b.more) break;
        c = `&cursor=${b.next}`;
      }
      check(got.map(id).join() === ref.map(id).join(), `limit=${limit} walk across ties differs from one page`);
      if (limit === 1) {
        // since + cursor: the cursor past the 3rd TIE row and an older since → rows 4..7.
        const sc = await pull(`since=2026-01-01T00:00:00.000Z&cursor=${nexts[2]}&limit=1000`);
        check(sc.rows.map(id).join() === ref.slice(3).map(id).join(), "since + older cursor");
        // since later than the cursor → since wins.
        const sc2 = await pull(`since=2026-10-04T00:00:00.000Z&cursor=${nexts[2]}&limit=1000`);
        check(sc2.rows.length === 1 && sc2.rows[0].learnerId === "resumed", "since + cursor: since later than cursor");
        // Deletes: remove the distinct TIE line the cursor points at; resuming from it and from the row
        // before it returns the rest with nothing repeated or skipped.
        const j = ref.findIndex((r) => r.learnerId === "LtieA" || r.learnerId === "LtieB");
        const gone = ref[j].learnerId === "LtieA" ? tieA : tieB;
        writeFileSync(eventsPath, readFileSync(eventsPath, "utf8").split("\n").filter((l) => l !== gone).join("\n"));
        const rest = ref.filter((_, i) => i !== j);
        const fromJ = await pull(`cursor=${nexts[j]}&limit=1000`);
        check(fromJ.rows.map(id).join() === ref.slice(j + 1).map(id).join(), "resume from a deleted row's cursor");
        const fromBefore = await pull(`since=${TIE}${j > 0 ? `&cursor=${nexts[j - 1]}` : ""}&limit=1000`);
        check(fromBefore.rows.map(id).join() === rest.slice(j).map(id).join(), "resume across a deleted row");
      }
    }
    // Empty pages: no cursor sent → next null; cursor sent → that cursor back.
    const empty = await pull("since=2099-01-01T00:00:00.000Z");
    check(empty.rows.length === 0 && empty.next === null && empty.more === false, "empty page without cursor");
    const end = await pull(`since=${TIE}&limit=1000`);
    const empty2 = await pull(`cursor=${end.next}`);
    check(empty2.rows.length === 0 && empty2.next === end.next && empty2.more === false, "empty page with cursor");
    await new Promise((r) => setTimeout(r, 300));
    check(!output().includes(key) && !output().includes("Bearer"), "server output holds key or Bearer");
  });
  check(!seen.some((s) => s.includes(key)), "a response holds the key");
  console.log("PASS");
} catch (err: any) {
  console.error("FAIL:", err?.message ?? err);
  process.exit(1);
}
