// lint-audio — does every dialogue that CLAIMS its audio is built actually have the bytes?
//
//   npm run lint:audio                            # every dialogue — are the bytes ON DISK?
//   npm run lint:audio -- slavko-intro            # one scenario
//   npm run lint:audio -- --shipped               # are the bytes IN THE BRANCH? (the deploy question)
//   npm run lint:audio -- slavko-intro --shipped
//
// TWO DIFFERENT QUESTIONS. By default this asks whether a clip is in the local store — the question that
// matters while authoring. `--shipped` asks whether it is committed to the branch — the question that
// matters at release, and a strictly harder one: `assets/` is GITIGNORED and its contents are force-added
// (docs/DEPLOY.md), so a clip can be present, playing perfectly on localhost, and absent from every deploy.
//
// That gap cannot be found by diffing. A gitignored file never appears in `git diff` until someone has
// already force-added it, so any release check keyed on "does the diff touch assets/audio?" goes quiet
// exactly when the bytes are missing and speaks up only once they are not. The question has to be asked
// per REQUIRED KEY, against the index — which is what --shipped does.
//
// WHY THIS EXISTS. A spoken scene degrades silently. When a clip is missing, `/api/speak` returns 502,
// the browser's <audio> fires `onerror`, and the renderer's `await sceneSay(...)` resolves INSTANTLY —
// so the scene plays through fully captioned, completely silent, and much too fast (every pause whose
// length came from the clip collapses to zero). Nothing throws. Nothing is skipped. It looks like it
// works. That is the worst failure mode a lesson can have, and no other lint catches it: `lint:dialogue`
// checks the JSON, `lint:tree` checks the graph, neither checks that a byte exists.
//
// It also catches something subtler. An audio key is `sha256(provider|voiceTag|text)` where voiceTag is
// `voiceId:modelId`. So changing E3_PROVIDER, ELEVENLABS_MODEL_ID, or a profile's voice-id env var
// silently orphans EVERY clip keyed under the old tag — the files are still on disk, they are just no
// longer reachable. This lint reports that as a re-key (copy the bytes) rather than sending you off to
// regenerate audio you have already paid for.
//
// Client nodes are never checked: in a spoken scene the client line is what the LEARNER says aloud, so it
// is never synthesized and has no clip of its own by design. Where the close screen offers to play one, it
// is replaying a clip of the CHARACTER saying the same shape — `lint:keyphrase-audio` checks those.

import "dotenv/config"; // voice bindings live in env — without this every computed key is wrong
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getE3 } from "../adapters/index";
import * as store from "../assets/store";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const DIALOGUES_DIR = path.join(__dirname, "..", "dialogues");
const VOICES_FILE = path.join(__dirname, "..", "catalog", "voices.json");
const MANIFEST = path.join(ROOT, "assets", "manifest.jsonl");

type Miss = {
  scenarioId: string; level: number; node: string; field: string;
  voiceProfile: string; text: string; key: string; rekeyFrom: string | null;
  /** --shipped only: the bytes ARE on disk, they are simply not committed. A completely different fix —
   *  force-add them, never re-synthesize something already paid for and already sitting there. */
  uncommitted: boolean;
};

const argv = process.argv.slice(2);
const only = argv.find((a) => !a.startsWith("--"));
/** Ask the BRANCH, not the disk — the release question (see the header). */
const shipped = argv.includes("--shipped");

/** Every audio key committed under assets/audio, by key. Empty outside a git work tree, which is itself
 *  reported rather than silently passing — a check that cannot see the index has not checked anything. */
function loadTrackedKeys(): Set<string> | null {
  try {
    const out = execFileSync("git", ["ls-files", "-z", "assets/audio"], { cwd: ROOT, maxBuffer: 1 << 28 });
    return new Set(
      out.toString("utf8").split("\0").filter(Boolean)
        .map((p) => path.basename(p).replace(/\.mp3$/, "")),
    );
  } catch {
    return null;
  }
}
const trackedKeys = shipped ? loadTrackedKeys() : null;
if (shipped && !trackedKeys) {
  console.error(`\n❌ lint:audio --shipped: not a git work tree (or git unavailable) — cannot tell what the branch carries.\n`);
  process.exit(1);
}

// Every text already synthesized, whatever key it landed under — the re-key oracle. If a missing clip's
// TEXT is in here, the bytes exist and were paid for; only the key changed.
function loadManifestTexts(): Map<string, string> {
  const byText = new Map<string, string>();
  if (!existsSync(MANIFEST)) return byText;
  for (const line of readFileSync(MANIFEST, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (typeof e?.text === "string" && typeof e?.key === "string" && !byText.has(e.text)) {
        byText.set(e.text, e.key);
      }
    } catch { /* a half-written line is not a reason to fail the lint */ }
  }
  return byText;
}

const e3 = getE3();
const manifestTexts = loadManifestTexts();
const voicesCatalog = JSON.parse(readFileSync(VOICES_FILE, "utf8"));

const misses: Miss[] = [];
const pendingNotes: string[] = [];
const bindingErrors: string[] = [];
let readyLevels = 0;
let checkedClips = 0;

function voiceTag(profile: string): string {
  const tag = e3.voiceTagFor(profile);
  // `voiceIdFor` returns "" when the profile's env var is unset, which yields a tag like ":eleven_v3".
  // Every key computed from that is wrong, so this is a hard error rather than a pile of misses.
  if (tag.startsWith(":")) {
    const msg = `voice profile "${profile}" has no ${e3.name} voice id bound (its env var is unset)`;
    if (!bindingErrors.includes(msg)) bindingErrors.push(msg);
  }
  return tag;
}

function checkClip(d: any, node: string, field: string, profile: string, text: string): void {
  checkedClips++;
  const key = store.audioKey(e3.name, voiceTag(profile), text);
  const onDisk = store.has(key, "audio");
  // Default mode asks the store; --shipped asks the branch. A clip must clear BOTH to reach a deploy, and
  // --shipped is the stricter of the two: everything the disk check would fail, it fails as well.
  const present = shipped ? trackedKeys!.has(key) : onDisk;
  if (present) return;
  const prior = manifestTexts.get(text) ?? null;
  misses.push({
    scenarioId: d.scenarioId, level: d.level, node, field,
    voiceProfile: profile, text, key,
    rekeyFrom: prior && prior !== key ? prior : null,
    uncommitted: shipped && onDisk,
  });
}

const files = existsSync(DIALOGUES_DIR)
  ? readdirSync(DIALOGUES_DIR).filter((f) => f.endsWith(".json")).sort()
  : [];

for (const f of files) {
  const d = JSON.parse(readFileSync(path.join(DIALOGUES_DIR, f), "utf8"));
  if (only && d.scenarioId !== only) continue;

  const npcProfile: string = d.voices?.npc;
  const spoken = (d.advance ?? "tap") === "audio";

  // A level that honestly declares itself unbuilt is not a failure — that is what "pending" is FOR.
  // Report it so a headless run can see there is generation still to do, but never fail on it.
  if (d.audio !== "ready") {
    pendingNotes.push(`${d.scenarioId} L${d.level} — audio: "pending" (not checked; run build:dialogue-assets)`);
    continue;
  }
  readyLevels++;

  for (const [id, n] of Object.entries<any>(d.nodes ?? {})) {
    if (n.speaker !== "npc") continue; // client lines are the learner's own — never synthesized
    checkClip(d, id, "sl", npcProfile, n.sl);
    if (n.slowSL) checkClip(d, id, "slowSL", npcProfile, n.slowSL);
  }

  // The spoken scene's backchannel ("Mhm.") is fired the instant the learner releases — it is the beat
  // that makes the character feel present, and it is served from the same store as everything else.
  if (spoken) {
    const bc = voicesCatalog?.[npcProfile]?.backchannels?.[0];
    if (bc) checkClip(d, "(backchannel)", "backchannel", npcProfile, bc);
  }
}

// ---- Report ----------------------------------------------------------------------------------------
const rel = (p: string) => path.relative(ROOT, p);
console.log(`\nlint:audio — ${e3.name}${only ? `  (scenario: ${only})` : ""}${shipped ? "  [--shipped: asking the BRANCH, not the disk]" : ""}`);
console.log(`  ${readyLevels} level(s) marked "ready", ${checkedClips} clip(s) checked`);
if (shipped) console.log(`  ${trackedKeys!.size} clip(s) committed under assets/audio\n`);
else console.log("");

for (const note of pendingNotes) console.log(`  ℹ️  ${note}`);
if (pendingNotes.length) console.log("");

if (bindingErrors.length) {
  for (const b of bindingErrors) console.error(`  ❌ ${b}`);
  console.error(`\n❌ FAIL — a voice binding is unset, so every key below is computed wrong. Fix the env first (docs/SECRETS.md).\n`);
  process.exit(1);
}

if (!misses.length) {
  console.log(shipped
    ? `✅ PASS — every "ready" level has all of its clips COMMITTED to this branch.\n`
    : `✅ PASS — every "ready" level has all of its clips in the store.\n`);
  process.exit(0);
}

const uncommitted = misses.filter((m) => m.uncommitted);
const rekeys = misses.filter((m) => !m.uncommitted && m.rekeyFrom);
const fresh = misses.filter((m) => !m.uncommitted && !m.rekeyFrom);

// The whole point of --shipped: these clips exist, sound right, and cost money already. They are simply
// not in the branch, so the deploy would serve nothing for them. Report them first and separately — the
// fix is one force-add, and confusing this with "needs synthesis" would re-bill for bytes on disk.
if (uncommitted.length) {
  const scenarios = [...new Set(uncommitted.map((m) => m.scenarioId))];
  console.error(`❌ ${uncommitted.length} clip(s) are ON DISK but NOT COMMITTED — the deploy would ship without them.`);
  console.error(`   scenario(s): ${scenarios.join(", ")}`);
  console.error(`   assets/ is gitignored by design (docs/DEPLOY.md); clips are force-added. These never were.`);
  console.error(`   Nothing needs generating — the bytes exist and are already paid for.\n`);
  console.error(`   fix: git add -f assets/audio assets/align && git commit -m "chore(assets): ship the clips"\n`);
}

const byLevel = new Map<string, Miss[]>();
for (const m of misses.filter((x) => !x.uncommitted)) {
  const k = `${m.scenarioId} L${m.level}`;
  (byLevel.get(k) ?? byLevel.set(k, []).get(k)!).push(m);
}

for (const [level, ms] of byLevel) {
  console.error(`❌ ${level} — ${ms.length} missing clip(s), but the level is marked "ready"`);
  for (const m of ms) {
    console.error(`   node ${m.node} · field ${m.field} · voice ${m.voiceProfile}`);
    console.error(`   text: ${JSON.stringify(m.text)}`);
    console.error(`   key:  ${m.key.slice(0, 16)}…  (${e3.name}, voiceTag ${voiceTag(m.voiceProfile)})`);
    if (m.rekeyFrom) {
      console.error(`   → bytes ALREADY EXIST under key ${m.rekeyFrom.slice(0, 16)}… — this is a RE-KEY, not a regeneration.`);
      console.error(`     Copy the bytes (npm run rekey:assets); do NOT re-synthesize, it is already paid for.`);
    } else {
      console.error(`   → not in the store under any key — synthesis required (THIS BILLS).`);
    }
    console.error("");
  }
  const [scenarioId, lvl] = level.split(" L");
  console.error(`   fix: npm run build:dialogue-assets -- ${scenarioId} --level ${lvl}\n`);
}

console.error(`❌ FAIL — ${misses.length} missing clip(s): `
  + `${uncommitted.length} on disk but uncommitted (free — force-add), `
  + `${fresh.length} need synthesis (bills), ${rekeys.length} are re-keys (free).`);
console.error(`   A "ready" level with missing audio ships a scene that plays SILENT and too fast without erroring.`);
console.error(`   Either generate the clips, or set the level's "audio" back to "pending" so it is honestly declared.\n`);
process.exit(1);
