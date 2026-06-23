// Migration audit (the STOP/review checkpoint). Emits a standalone HTML page the user opens in a
// browser to SEE every existing image and HEAR every existing clip, with the proposed migration to the
// shared-catalog + voice-profile + per-asset-reference model laid over each one: proposed catalog id,
// proposed voice, and whether it must regenerate — with FLAGS on assets that plainly don't make sense
// today (the canonical case: the butcher's images are male but its audio is the female teacher voice).
//
// Reads assets/manifest.jsonl for what EXISTS; computes the proposal from the (already-refactored)
// scenarios + catalog + adapters. Generates NOTHING and bills NOTHING.
//
//   npm run audit:assets        # writes assets/migration-audit.html

import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as store from "../assets/store";
import { getE3, getE4 } from "../adapters/index";
import { IMAGE_STYLE, IMAGE_FORMAT, relevantLabels, stripTokens } from "../adapters/image-style";
import { assetRenderKey } from "../assets/images";
import { SCENARIOS, characterVoiceProfile, type Scenario } from "../scenarios";
import { CATALOG, getCharacter, TEACHER_VOICE_PROFILE } from "../catalog";

const e3 = getE3();
const e4 = getE4();
const teacherTag = e3.voiceTagFor(TEACHER_VOICE_PROFILE);

// An image's cache key is the LITERAL prompt. If this key already exists → cached. If not, but an old
// render exists whose prompt == the stripped (de-braced) new prompt → same picture → free RE-KEY. Else
// the content changed → RE-RENDER.
const imageKeyFor = (prompt: string, fmt: { aspectRatio: string; resolution: string }) =>
  store.imageKey(e4.name, e4.model, IMAGE_STYLE.id, fmt.aspectRatio, fmt.resolution, prompt);
const oldRenderForPrompt = (prompt: string) =>
  manifest.find((e) => e.type === "image" && e.prompt === stripTokens(prompt) && store.has(e.key, "image"));

// ---- read the manifest (what exists on disk) -----------------------------------------------------
const manifestPath = path.join(store.ASSET_DIR, "manifest.jsonl");
const manifest: any[] = existsSync(manifestPath)
  ? readFileSync(manifestPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];
// newest entry per key wins (manifest is append-only).
const byKey = new Map<string, any>();
for (const e of manifest) byKey.set(e.key, e);

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const short = (k: string) => esc(k.slice(0, 12)) + "…";

function audioPlayer(key: string): string {
  const rel = `audio/${key}.mp3`;
  if (!existsSync(path.join(store.ASSET_DIR, rel))) return `<span class="missing">no clip on disk</span>`;
  return `<audio controls preload="none" src="${rel}"></audio>`;
}
function imageThumb(key: string | undefined): string {
  if (!key) return `<div class="thumb missing">— not built —</div>`;
  const rel = `image/${key}.jpg`;
  if (!existsSync(path.join(store.ASSET_DIR, rel))) return `<div class="thumb missing">— not built —</div>`;
  return `<a href="${rel}" target="_blank"><img class="thumb" loading="lazy" src="${rel}" alt="${short(key)}"></a>`;
}
const yes = `<span class="badge regen">re-render</span>`;
const keep = `<span class="badge keep">cached</span>`;
const rekeyBadge = `<span class="badge rekey">re-key</span>`;
const flagBadge = (t: string) => `<span class="badge flag">⚠ ${esc(t)}</span>`;
const sharedBadge = (id: string) => `<span class="badge shared">shared · ${esc(id)}</span>`;

// ---- per-scenario proposal ------------------------------------------------------------------------
let imgCached = 0; // already at the new key
let imgRekey = 0; // same picture, free re-key pending (run rekey:assets)
const imgRegenList: string[] = []; // content changed → real re-render
let totalAudioRegen = 0;
const audioRegenList: string[] = [];
const audioMismatch: string[] = []; // existing clips whose recorded voice ≠ the speaker's proposed voice
const rendersToGenerate = new Set<string>(); // assetRenderKeys that will actually be generated (deduped)

function scenarioSection(s: Scenario): string {
  const charVoice = characterVoiceProfile(s);
  const charName = s.characterRef ? getCharacter(s.characterRef).name : "(no catalog character)";
  const voiceMismatch = charVoice !== TEACHER_VOICE_PROFILE; // today every clip is the teacher (female) voice
  const story = s.scene?.story;
  const assets = s.scene?.assets ?? [];
  const allLabels = assets.map((a) => a.label);

  const parts: string[] = [];
  parts.push(`<section class="scn"><h2>${esc(s.name ?? s.title)} <span class="id">${esc(s.id)}</span></h2>`);
  parts.push(`<p class="role">${esc(s.character)}</p>`);

  // Character + voice
  parts.push(`<div class="block"><h3>Character &amp; voice</h3><table><tbody>`);
  parts.push(`<tr><th>catalog character</th><td>${s.characterRef ? `${esc(charName)} <code>${esc(s.characterRef)}</code>` : `<span class="missing">none — in-scene lines fall back to teacher voice</span>`}</td></tr>`);
  parts.push(`<tr><th>in-scene voice (opening, live reply)</th><td><code>${esc(charVoice)}</code>${voiceMismatch ? " " + flagBadge("differs from today's single voice") : ""}</td></tr>`);
  parts.push(`<tr><th>teacher voice (targets, story)</th><td><code>${esc(TEACHER_VOICE_PROFILE)}</code> ${keep}</td></tr>`);
  parts.push(`</tbody></table></div>`);

  // ---- AUDIO ----
  const audioRows: string[] = [];
  const addAudio = (label: string, text: string, profile: string) => {
    const curKey = store.audioKey(e3.name, teacherTag, text); // today everything was built teacher-voiced
    const proposed = e3.voiceTagFor(profile);
    const regen = proposed !== teacherTag;
    if (regen) {
      totalAudioRegen++;
      audioRegenList.push(`${s.id} · ${label}`);
    }
    const cur = byKey.get(curKey);
    const flag =
      regen && profile !== TEACHER_VOICE_PROFILE
        ? flagBadge(`current clip is ${TEACHER_VOICE_PROFILE}; ${charName} should be ${profile}`)
        : "";
    audioRows.push(
      `<tr><td class="lbl">${esc(label)}</td><td class="sl">${esc(text)}</td>` +
        `<td>${audioPlayer(curKey)}</td>` +
        `<td><code>${esc((cur?.voiceOrModel ?? teacherTag))}</code></td>` +
        `<td>→ <code>${esc(profile)}</code> ${regen ? yes : keep} ${flag}</td></tr>`,
    );
  };
  addAudio("opening (character)", s.opening, charVoice);
  for (const o of s.objectives) addAudio(`target · ${o.id}`, o.targetSL, TEACHER_VOICE_PROFILE);
  (story?.sentences ?? []).forEach((sn, i) => addAudio(`story[${i}]`, sn, TEACHER_VOICE_PROFILE));
  parts.push(
    `<div class="block"><h3>Audio</h3><table class="grid"><thead><tr><th>clip</th><th>Slovenian</th><th>hear it (current)</th><th>current voice</th><th>proposed</th></tr></thead><tbody>${audioRows.join("")}</tbody></table></div>`,
  );

  // ---- IMAGES: KEEP (existing bytes reused under the new key — free re-key) vs RE-RENDER (content changed) ----
  const curImgByObj = new Map<string, any>();
  for (const e of manifest) if (e.type === "image" && e.scenarioId === s.id) curImgByObj.set(e.objectiveId, e);

  const rendersNeeded = new Set<string>(); // asset labels whose render must exist to anchor a re-render
  const imgCells: string[] = [];
  const addImg = (objectiveId: string, prompt: string, fmt: { aspectRatio: string; resolution: string }) => {
    const newKey = imageKeyFor(prompt, fmt);
    const cur = curImgByObj.get(objectiveId);
    let status: string;
    let thumbKey: string | undefined;
    if (store.has(newKey, "image")) {
      imgCached++;
      status = `${keep} <span class="muted">cached</span>`;
      thumbKey = newKey;
    } else {
      const old = oldRenderForPrompt(prompt); // same picture, only braces added?
      if (old) {
        imgRekey++;
        status = `${rekeyBadge} <span class="muted">free — same picture</span>`;
        thumbKey = old.key;
      } else {
        imgRegenList.push(`${s.id}·${objectiveId}`);
        for (const l of relevantLabels(prompt, allLabels)) rendersNeeded.add(l);
        status = `${yes} <span class="muted">content changed</span>`;
        thumbKey = cur?.key;
      }
    }
    imgCells.push(`<figure>${imageThumb(thumbKey)}<figcaption><b>${esc(objectiveId)}</b><br>${status}</figcaption></figure>`);
  };
  for (const fr of story?.frames ?? []) addImg(fr.objectiveId, fr.imagePrompt, IMAGE_FORMAT.frame);
  if (story?.sceneImagePrompt) addImg("scene", story.sceneImagePrompt, IMAGE_FORMAT.scene);
  parts.push(
    `<div class="block"><h3>Images</h3><p class="muted"><b>cached</b> = already at the new key. <b>re-key</b> = same picture (only the {{ }} braces were added) → its bytes are copied to the new key for free (<code>npm run rekey:assets</code>). <b>re-render</b> = the picture's content actually changed.</p><div class="gallery">${imgCells.join("")}</div></div>`,
  );

  // Per-asset renders: built LAZILY, only to anchor an image that's re-rendering. Tally the ones that
  // will actually generate (deduped globally — shared renders generate once across scenarios).
  const assetCells = assets.map((a) => {
    const k = assetRenderKey(a);
    const built = store.has(k, "image");
    const willGen = rendersNeeded.has(a.label) && !built;
    if (willGen) rendersToGenerate.add(k);
    const note = built ? "built" : willGen ? "generate — anchors a re-render" : "not needed yet";
    return `<figure>${imageThumb(built ? k : undefined)}<figcaption><b>${esc(a.label)}</b><br>${a.catalogId ? sharedBadge(a.catalogId) : `<span class="badge local">local</span>`}<br><span class="muted">${esc(note)}</span></figcaption></figure>`;
  });
  parts.push(
    `<div class="block"><h3>Per-asset canonical renders</h3>` +
      `<p class="muted">Built lazily — only to anchor an image that's actually re-rendering. Shared (catalog) assets render once and are reused everywhere.</p>` +
      `<div class="gallery">${assetCells.join("")}</div></div>`,
  );

  // The old monolithic reference sheet is orphaned by the new mechanism — prunable, not regenerated;
  // the frames keep their existing bytes regardless.
  const sheetEntry = curImgByObj.get("reference-sheet");
  if (sheetEntry) {
    parts.push(
      `<div class="block"><h3>Old reference sheet</h3><div class="gallery"><figure>${imageThumb(sheetEntry.key)}<figcaption><span class="badge retire">retired</span><br><span class="muted">orphaned — prune anytime; frames keep their bytes</span></figcaption></figure></div></div>`,
    );
  }

  parts.push(`</section>`);
  return parts.join("\n");
}

// ---- other (non-authored) cached clips: live tutor replies (the CHARACTER speaking). These are also
// subject to the voice model — a butcher reply recorded in the old single female voice is wrong-gendered
// today and re-keys to male on next play. Grouped per scenario and flagged when mis-voiced. ----------
function straySection(): string {
  const authoredTexts = new Set<string>();
  for (const s of SCENARIOS) {
    authoredTexts.add(s.opening);
    for (const o of s.objectives) authoredTexts.add(o.targetSL);
    for (const sn of s.scene?.story?.sentences ?? []) authoredTexts.add(sn);
  }
  const stray = manifest.filter((e) => e.type === "audio" && !authoredTexts.has(e.text ?? ""));
  if (!stray.length) return "";

  const byScn = new Map<string, any[]>();
  for (const e of stray) {
    const id = e.scenarioId ?? "(unknown)";
    (byScn.get(id) ?? byScn.set(id, []).get(id)!).push(e);
  }

  const blocks: string[] = [];
  for (const [sid, clips] of byScn) {
    const scn = SCENARIOS.find((x) => x.id === sid);
    const charVoice = scn ? characterVoiceProfile(scn) : TEACHER_VOICE_PROFILE;
    const charTag = e3.voiceTagFor(charVoice);
    const rows = clips
      .map((e) => {
        const mism = !!e.voiceOrModel && e.voiceOrModel !== charTag; // live reply = the character speaking
        if (mism) audioMismatch.push(`${sid}·live`);
        const proposed = mism
          ? flagBadge(`wrong voice today → re-key to ${charVoice}`)
          : `<span class="muted">ok (${esc(charVoice)})</span>`;
        return `<tr><td class="sl">${esc((e.text ?? "").slice(0, 80))}</td><td>${audioPlayer(e.key)}</td><td>${proposed}</td></tr>`;
      })
      .join("");
    blocks.push(
      `<div class="block"><h3>${esc(sid)} <span class="muted">(character voice: ${esc(charVoice)})</span></h3>` +
        `<table class="grid"><thead><tr><th>text</th><th>hear</th><th>voice</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    );
  }
  return (
    `<section class="scn"><h2>Live / cached clips <span class="id">the character speaking</span></h2>` +
    `<p class="muted">Tutor replies captured from past sessions (the character's own lines). These aren't pre-built assets — they re-key to the character voice and regenerate on next play — but a clip recorded in the wrong voice is flagged so the full extent of the gender mismatch is visible, not just the opening.</p>` +
    blocks.join("") +
    `</section>`
  );
}

// ---- assemble -------------------------------------------------------------------------------------
const active = SCENARIOS.filter((s) => s.status === "active");
const sections = active.map(scenarioSection).join("\n");
const strays = straySection();

const summary =
  `<div class="summary"><h2>Proposed migration — summary</h2><ul>` +
  `<li><b>Catalog introduced:</b> objects ${Object.keys(CATALOG.objects).map((o) => `<code>${esc(o)}</code>`).join(", ")}; characters ${Object.keys(CATALOG.characters).map((c) => `<code>${esc(c)}</code>`).join(", ")}; voice profiles ${Object.keys(CATALOG.voiceProfiles).map((v) => `<code>${esc(v)}</code>`).join(", ")} (teacher = <code>${esc(TEACHER_VOICE_PROFILE)}</code>).</li>` +
  `<li><b>Images:</b> ${imgCached} cached, <b>${imgRekey} re-key</b> (same picture, only the {{ }} braces were added → bytes copied to the new key, free: <code>npm run rekey:assets -- --apply</code>), <b>${imgRegenList.length} re-render</b> because the picture changed${imgRegenList.length ? ` (${imgRegenList.map((a) => `<code>${esc(a)}</code>`).join(", ")})` : ""}. A cache-key change is bookkeeping; only changed content is generated.</li>` +
  `<li><b>New renders to generate:</b> ${rendersToGenerate.size} per-asset canonical render(s) — built lazily, only to anchor the re-render(s) above. (Composed reference sheets are assembled locally, free.)</li>` +
  `<li><b>Audio:</b> ${audioRegenList.length} authored clip(s) re-render — ${audioRegenList.length ? audioRegenList.map((a) => `<code>${esc(a)}</code>`).join(", ") : "none"}; ${audioMismatch.length} live clip(s) currently mis-voiced (re-key to the character voice on next play). All teacher-voiced target/story audio is <b>unchanged</b>.</li>` +
  `<li class="flagline"><b>⚠ Key flag:</b> the <b>butcher</b> is male, but its <code>opening</code> and ${audioMismatch.length} live reply clip(s) on disk are the female teacher voice. The opening re-renders as <code>male-speaker</code>; the live clips re-key to male on next play (requires <code>ELEVENLABS_VOICE_ID_MALE</code> in env).</li>` +
  `<li><b>Nothing has been generated.</b> This is the review gate. <code>npm run rekey:assets -- --apply</code> re-keys the unchanged images for free; then <code>npm run build:assets -- &lt;id&gt;</code> generates only the ${imgRegenList.length} changed image(s) + the ${rendersToGenerate.size} render(s) they need + the butcher's male opening.</li>` +
  `</ul></div>`;

const css = `
:root{--bg:#fafafa;--card:#fff;--line:#e4e4e7;--ink:#18181b;--muted:#71717a;--flag:#b91c1c;--regen:#b45309;--keep:#15803d;--shared:#1d4ed8}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);background:var(--bg)}
header{padding:24px 28px;background:#111;color:#fff}header h1{margin:0 0 4px}header p{margin:0;color:#a1a1aa}
.wrap{max-width:1100px;margin:0 auto;padding:24px 28px}
.summary{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 20px;margin-bottom:28px}
.summary ul{margin:0;padding-left:18px}.summary li{margin:6px 0}.flagline{color:var(--flag)}
section.scn{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px 20px;margin-bottom:24px}
h2{margin:0 0 6px;font-size:20px}h2 .id{font:12px monospace;color:var(--muted);background:#f4f4f5;padding:2px 6px;border-radius:5px}
.role{margin:0 0 14px;color:var(--muted);font-style:italic}
.block{margin:18px 0}.block h3{margin:0 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:6px 8px;vertical-align:middle;border-bottom:1px solid var(--line);font-size:14px}
table.grid th{font-size:12px;text-transform:uppercase;color:var(--muted)}
td.lbl,.sl{font-size:13px}.sl{font-weight:600}code{font:12px monospace;background:#f4f4f5;padding:1px 5px;border-radius:4px}
audio{height:32px;vertical-align:middle}
.gallery{display:flex;flex-wrap:wrap;gap:14px}
figure{margin:0;width:160px;text-align:center}figcaption{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.35}
.thumb{width:160px;height:120px;object-fit:contain;background:#f4f4f5;border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px}
img.thumb{object-fit:cover}
.badge{display:inline-block;font-size:11px;font-weight:700;padding:1px 7px;border-radius:20px;color:#fff}
.badge.regen{background:var(--regen)}.badge.keep{background:var(--keep)}.badge.flag{background:var(--flag)}.badge.rekey{background:#0d9488}
.badge.shared{background:var(--shared)}.badge.local{background:#52525b}.badge.retire{background:#9f1239}
.muted{color:var(--muted);font-size:12px}.missing{color:var(--muted);font-style:italic}
th{white-space:nowrap}`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Asset migration audit — lango-slovenian</title><style>${css}</style></head>
<body><header><h1>Asset migration audit</h1><p>Shared catalog · voice profiles · per-asset references. Review gate — nothing generated yet.</p></header>
<div class="wrap">${summary}${sections}${strays}</div></body></html>`;

const outPath = path.join(store.ASSET_DIR, "migration-audit.html");
writeFileSync(outPath, html);
console.log(`✅ wrote ${path.relative(process.cwd(), outPath)}`);
console.log(`   images: ${imgCached} cached, ${imgRekey} re-key (free), ${imgRegenList.length} re-render (${imgRegenList.join(", ") || "none"}) · new renders: ${rendersToGenerate.size} · audio re-render: ${totalAudioRegen} (${audioRegenList.join(", ") || "none"}), mis-voiced live: ${audioMismatch.length}`);
console.log(`   open it: open ${path.relative(process.cwd(), outPath)}`);
