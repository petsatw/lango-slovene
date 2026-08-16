// build:dialogue-intros — synthesize each dialogue level's INTRO monologue to public/intros/.
//
// The sibling of build:dialogue-assets. That builder does the per-node LINE audio (keyed on node.sl);
// this one does the separate scene-setting INTRO clip it deliberately skips — the short first-person
// monologue that plays over the background before a level's tree begins (dialogue.intro).
//
// The intro is the LEARNER's own voice, so it is synthesized in the scenario's CLIENT voice profile
// (dialogue.voices.client), from intro.text — the delivery-tagged source (e.g. "[yawning] Uf…"). The clip
// is written to public/intros/<intro.audio>, the filename the dialogue already declares.
//
//   npm run build:dialogue-intros -- <scenarioId> [--level <n>] [--regen]
//   npm run build:dialogue-intros -- library
//   npm run build:dialogue-intros -- restaurant --level 1 --regen
//
// Like the asset builder it is PREFLIGHT-gated (fails before spending a cent if a voice binding or the API
// key is missing), IDEMPOTENT (skips a clip that already exists unless --regen), and SEQUENTIAL so a billed
// run can never half-complete silently. It writes an audio FILE (not the content-addressed store) because
// intros are referenced by filename, exactly like operator-supplied backgrounds.
import "dotenv/config";
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getE3 } from "../adapters/index";
import { validateDialogue, type Dialogue } from "../dialogues";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIALOGUES_DIR = path.join(__dirname, "..", "dialogues");
const INTROS_DIR = path.join(__dirname, "..", "..", "public", "intros");

const args = process.argv.slice(2);
const scenarioId = args.find(
  (a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--level",
);
const levelIdx = args.indexOf("--level");
const onlyLevel = levelIdx >= 0 ? Number(args[levelIdx + 1]) : undefined;
const regen = args.includes("--regen");

if (!scenarioId) {
  console.error("Usage: npm run build:dialogue-intros -- <scenarioId> [--level <n>] [--regen]");
  process.exit(1);
}

(async () => {
  // Load the scenario's dialogue files that carry an intro (optionally one level).
  const files = readdirSync(DIALOGUES_DIR)
    .filter((f) => f.startsWith(`${scenarioId}-`) && f.endsWith(".json"))
    .map((f) => ({ f, d: validateDialogue(f, JSON.parse(readFileSync(path.join(DIALOGUES_DIR, f), "utf8"))) as Dialogue }))
    .filter(({ d }) => (onlyLevel === undefined || d.level === onlyLevel) && d.intro?.text)
    .sort((a, b) => a.d.level - b.d.level);

  if (!files.length) {
    console.error(`No dialogue files for "${scenarioId}"${onlyLevel !== undefined ? ` level ${onlyLevel}` : ""} carry an intro.text — nothing to synthesize.`);
    process.exit(1);
  }

  const e3 = getE3();

  // PREFLIGHT — every client voice profile the targets use must resolve, and the API key must be set;
  // fail fast so a billed run can't stop half-way.
  const profiles = new Set(files.map(({ d }) => d.voices.client));
  const problems: string[] = [];
  for (const p of profiles) {
    let voiceId = "";
    try { voiceId = e3.voiceTagFor(p).split(":")[0] ?? ""; }
    catch (err: any) { problems.push(`voice profile "${p}": ${err?.message}`); continue; }
    if (!voiceId) problems.push(`voice profile "${p}": no voice id configured (see docs/SECRETS.md)`);
  }
  if (e3.name === "elevenlabs" && !process.env.ELEVENLABS_API_KEY) problems.push(`ELEVENLABS_API_KEY is not set (see docs/SECRETS.md)`);
  if (problems.length) {
    console.error(`\n❌ preflight failed for "${scenarioId}" — nothing synthesized:`);
    for (const p of problems) console.error(`   • ${p}`);
    process.exit(1);
  }
  if (!existsSync(INTROS_DIR)) mkdirSync(INTROS_DIR, { recursive: true });
  console.log(`\n✓ preflight ok — e3=${e3.name}, client voice(s): ${[...profiles].join(", ")}${regen ? "  (--regen)" : ""}`);

  let made = 0, skipped = 0, failed = 0;
  for (const { d } of files) {
    const out = path.join(INTROS_DIR, d.intro!.audio);
    const tag = `L${d.level} ${d.intro!.audio}`;
    if (existsSync(out) && !regen) { console.log(`   skip ${tag} (exists)`); skipped++; continue; }
    process.stdout.write(`   gen  ${tag} [${d.voices.client}]… `);
    try {
      const r = await e3.synthesize({ text: d.intro!.text!, voiceProfile: d.voices.client });
      const bytes = Buffer.from(r.audioBase64, "base64");
      writeFileSync(out, bytes);
      console.log(`ok (${Math.round(bytes.length / 1024)} kb)`);
      made++;
    } catch (err: any) {
      console.log(`❌ ${err?.message}`);
      failed++;
    }
  }

  console.log(`\n${failed ? "⚠️ " : "✅"} intros — ${made} generated, ${skipped} skipped${failed ? `, ${failed} failed` : ""} → ${path.relative(path.join(__dirname, "..", ".."), INTROS_DIR)}/`);
  process.exit(failed ? 1 : 0);
})();
