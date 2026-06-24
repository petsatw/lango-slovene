// Asset-graph audit (the STOP/review checkpoint). Emits a standalone HTML page the user opens in a
// browser to SEE the asset GRAPH — canonical assets (nodes) deduped across scenarios, with their
// identity metadata, what each is used-by, and what each composed image is built-from — plus the
// voice model laid over every clip, with FLAGS on what plainly doesn't make sense today.
//
// The model is relational, not a per-scenario migration: an image is a node; "built-from" / "used-by"
// are edges (the manifest already records referenceKeys as provenance). Reuse/regen is a JUDGEMENT made
// per node with the metadata in hand — the audit PRESENTS the graph + flags the gaps; it does not
// classify by rule. Reads assets/manifest.jsonl for what EXISTS; computes the rest from scenarios +
// catalog + adapters. Generates NOTHING and bills NOTHING.
//
//   npm run audit:assets        # writes assets/migration-audit.html

import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as store from "../assets/store";
import { getE3, getE4 } from "../adapters/index";
import { IMAGE_STYLE, IMAGE_FORMAT, relevantLabels, stripTokens, token } from "../adapters/image-style";
import { assetRenderKey } from "../assets/images";
import { SCENARIOS, characterVoiceProfile, type Scenario } from "../scenarios";
import { CATALOG, getCharacter, getAssetVisual, TEACHER_VOICE_PROFILE } from "../catalog";

const e3 = getE3();
const e4 = getE4();
const teacherTag = e3.voiceTagFor(TEACHER_VOICE_PROFILE);
const here = path.dirname(fileURLToPath(import.meta.url));

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
const byKey = new Map<string, any>();
for (const e of manifest) byKey.set(e.key, e); // newest per key wins (append-only)

// ---- raw catalog JSON — to surface DECLARED identity metadata (gender, etc.) the typed loader drops.
// This is where point-3 metadata lands; until a field exists, the audit flags it as a gap. ----------
const catalogDir = path.join(here, "..", "catalog");
const rawObjects: Record<string, any> = JSON.parse(readFileSync(path.join(catalogDir, "objects.json"), "utf8"));
const rawChars: Record<string, any> = JSON.parse(readFileSync(path.join(catalogDir, "characters.json"), "utf8"));
const rawRecord = (catalogId?: string) => (catalogId ? rawObjects[catalogId] ?? rawChars[catalogId] ?? null : null);
const isPerson = (catalogId?: string) => !!catalogId && (catalogId in rawChars || catalogId === "customer");

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const short = (k: string) => esc(k.slice(0, 12)) + "…";

function audioPlayer(key: string): string {
  const rel = `audio/${key}.mp3`;
  if (!existsSync(path.join(store.ASSET_DIR, rel))) return `<span class="missing">no clip on disk</span>`;
  return `<audio controls preload="none" src="${rel}"></audio>`;
}
function imageThumb(key: string | undefined): string {
  if (!key) return `<div class="thumb missing">— no render —</div>`;
  const rel = `image/${key}.jpg`;
  if (!existsSync(path.join(store.ASSET_DIR, rel))) return `<div class="thumb missing">— no render —</div>`;
  return `<a href="${rel}" target="_blank"><img class="thumb" loading="lazy" src="${rel}" alt="${short(key)}"></a>`;
}
const yes = `<span class="badge regen">re-render</span>`;
const keep = `<span class="badge keep">cached</span>`;
const rekeyBadge = `<span class="badge rekey">re-key</span>`;
const flagBadge = (t: string) => `<span class="badge flag">⚠ ${esc(t)}</span>`;
const sharedBadge = (id: string) => `<span class="badge shared">catalog · ${esc(id)}</span>`;
const localBadge = `<span class="badge local">local</span>`;
const chip = (t: string) => `<span class="chip">${esc(t)}</span>`;
const edge = (t: string) => `<span class="chip edge">${esc(t)}</span>`;

// =====================================================================================================
// THE ASSET GRAPH — nodes (canonical assets) + edges (used-by / built-from), deduped across scenarios.
// A SHARED asset (catalogId) collapses to ONE node everywhere it's referenced; LOCAL assets are grouped
// by label so a would-be-canonical implemented as divergent locals (e.g. DOORWAY) is visible.
// =====================================================================================================
interface AssetNode {
  groupKey: string;
  label: string;
  shared: boolean;
  catalogId?: string;
  descriptors: Map<string, string[]>; // descriptor -> scenarioIds declaring it
  usedBy: string[]; // "scnId·objId" of composed images that reference this label
}
const active = SCENARIOS.filter((s) => s.status === "active");
const nodes = new Map<string, AssetNode>();
const labelGroupByScn = new Map<string, Map<string, string>>(); // scnId -> (label -> groupKey)
const frameLabels = new Map<string, string[]>(); // "scnId·objId" -> labels it references
const useImgKey = new Map<string, string | undefined>(); // "scnId·objId" -> the frame's on-disk image key

for (const s of active) {
  const m = new Map<string, string>();
  for (const a of s.scene?.assets ?? []) {
    const gk = a.catalogId ? `cat:${a.catalogId}` : `local:${a.label}`;
    m.set(a.label, gk);
    let n = nodes.get(gk);
    if (!n) {
      n = { groupKey: gk, label: a.label, shared: !!a.catalogId, catalogId: a.catalogId, descriptors: new Map(), usedBy: [] };
      nodes.set(gk, n);
    }
    const scn = n.descriptors.get(a.descriptor) ?? [];
    if (!scn.includes(s.id)) scn.push(s.id);
    n.descriptors.set(a.descriptor, scn);
  }
  labelGroupByScn.set(s.id, m);
}
for (const s of active) {
  const labels = (s.scene?.assets ?? []).map((a) => a.label);
  const m = labelGroupByScn.get(s.id)!;
  const addUse = (objId: string, prompt: string, fmt: { aspectRatio: string; resolution: string }) => {
    const use = `${s.id}·${objId}`;
    const rel = relevantLabels(prompt, labels);
    frameLabels.set(use, rel);
    for (const lbl of rel) {
      const gk = m.get(lbl);
      if (gk) nodes.get(gk)!.usedBy.push(use);
    }
    // The frame's on-disk image: cached key, else the rekey source (same picture), else the last
    // manifest entry for this objective. Recorded so a SOLE-asset frame can serve as the canonical
    // render's harvest source instead of being regenerated.
    const nk = imageKeyFor(prompt, fmt);
    let dk: string | undefined;
    if (store.has(nk, "image")) dk = nk;
    else {
      const old = oldRenderForPrompt(prompt);
      dk = old ? old.key : manifest.find((e) => e.type === "image" && e.scenarioId === s.id && e.objectiveId === objId)?.key;
    }
    useImgKey.set(use, dk);
  };
  for (const fr of s.scene?.story?.frames ?? []) addUse(fr.objectiveId, fr.imagePrompt, IMAGE_FORMAT.frame);
  if (s.scene?.story?.sceneImagePrompt) addUse("scene", s.scene.story.sceneImagePrompt, IMAGE_FORMAT.scene);
}

// tallies surfaced in the summary
let missingMeta = 0;
let divergentLocal = 0;
let wholeCount = 0; // canonical assets that now have a render at the canonical key (valid catalog entries)
const missingRender: string[] = []; // canonical assets with NO render anywhere → must generate
const noRenderHarvestable: string[] = []; // canonical assets with no canonical render but a sole-asset frame

function canonicalAssetsSection(): string {
  const cards = [...nodes.values()]
    .sort((a, b) => Number(b.shared) - Number(a.shared) || a.label.localeCompare(b.label))
    .map((n) => {
      const descs = [...n.descriptors.entries()];
      const divergent = !n.shared && descs.length > 1;
      if (divergent) divergentLocal++;

      // render: a render at the canonical KEY, if one exists for any descriptor.
      let thumbKey: string | undefined;
      let canonicalKeyBuilt = false;
      for (const [d] of descs) {
        const k = assetRenderKey({ label: n.label, descriptor: d });
        if (store.has(k, "image")) { thumbKey = k; canonicalKeyBuilt = true; break; }
      }
      // sole-asset frames (this label is the ONLY asset the frame references) — the frame image already
      // depicts this asset as-is, so it IS the canonical render: harvest its bytes, never regenerate.
      const sole = [...new Set(n.usedBy)].filter((u) => {
        const ls = frameLabels.get(u);
        return ls && ls.length === 1 && ls[0] === n.label;
      });
      const harvest = canonicalKeyBuilt ? undefined : sole.map((u) => ({ u, key: useImgKey.get(u) })).find((x) => x.key);
      if (harvest) {
        thumbKey = harvest.key; // show the existing frame image AS the canonical render
        noRenderHarvestable.push(n.label);
      }
      if (canonicalKeyBuilt) wholeCount++;
      else if (!harvest) missingRender.push(n.label);

      // identity metadata (point 3) — declared on the catalog record; flagged when a person lacks it.
      const rec = rawRecord(n.catalogId);
      const gender: string | undefined = rec?.gender;
      const metaMissing = isPerson(n.catalogId) && !gender;
      if (metaMissing) missingMeta++;
      const metaRow = gender
        ? `<div class="meta"><b>identity</b> gender: <code>${esc(gender)}</code></div>`
        : isPerson(n.catalogId)
          ? `<div class="meta">${flagBadge("no identity metadata (declare gender)")}</div>`
          : "";

      const descRows = divergent
        ? descs.map(([d, scns]) => `<div class="desc"><span class="scns">${scns.map(esc).join(", ")}:</span> ${esc(d)}</div>`).join("") +
          `<div class="meta">${flagBadge("divergent local descriptors → canonicalize?")}</div>`
        : `<div class="desc">${esc(descs[0]?.[0] ?? "")}</div>`;

      const usedByChips = [...new Set(n.usedBy)].map((u) => edge(u)).join(" ") || `<span class="muted">used by nothing</span>`;
      const prov = thumbKey ? byKey.get(thumbKey)?.provider : undefined;
      const provLabel = prov === "harvest" ? "harvested from frame" : prov === "extract" ? "extracted from sheet" : prov === "local" ? "" : prov ? "generated" : "";
      const provNote = provLabel ? ` <span class="muted">· ${esc(provLabel)}</span>` : "";
      const renderNote = canonicalKeyBuilt
        ? `<span class="badge whole">✅ whole · canonical render</span>${provNote}`
        : harvest
          ? `${rekeyBadge} <span class="muted">canonical bytes already exist in <code>${esc(harvest.u)}</code> → harvest (free byte-copy), don't regenerate</span>`
          : `${flagBadge("no render — must generate")}`;

      return (
        `<figure class="node">${imageThumb(thumbKey)}` +
        `<figcaption><div class="ntitle"><b>${esc(n.label)}</b> ${n.shared ? sharedBadge(n.catalogId!) : localBadge}</div>` +
        descRows + metaRow +
        `<div class="meta"><b>render</b> ${renderNote}</div>` +
        `<div class="meta"><b>used-by</b> ${usedByChips}</div>` +
        `</figcaption></figure>`
      );
    });
  return (
    `<section class="scn graph"><h2>Canonical assets <span class="id">the graph nodes</span> ` +
    `<span class="tally">${wholeCount}/${nodes.size} whole${missingRender.length ? ` · ${missingRender.length} need render` : ""}</span></h2>` +
    `<p class="muted"><b>✅ whole</b> = a canonical render now exists at the asset's key (a valid catalog entry, reusable everywhere). ` +
    `Every asset is a catalog item, shown ONCE across scenarios. ` +
    `<b>used-by</b> = composed images that anchor on it (the edges). Reuse/regen is your judgement with the metadata in hand — flags mark gaps, they don't decide.</p>` +
    `<div class="gallery nodes">${cards.join("")}</div></section>`
  );
}

// =====================================================================================================
// CATALOG CONCEPTS — composed, reusable depictions (greet, leave …) built FROM canonical assets. Their
// render is the content-addressed image at the concept prompt, shared by every frame with that depiction.
// =====================================================================================================
let conceptWhole = 0;
function conceptsSection(): string {
  const ids = Object.keys(CATALOG.concepts);
  if (!ids.length) return "";
  const cards = ids.map((id) => {
    const c = CATALOG.concepts[id]!;
    const key = imageKeyFor(c.prompt, IMAGE_FORMAT.frame);
    const built = store.has(key, "image");
    if (built) conceptWhole++;
    const usedBy: string[] = [];
    for (const s of active) for (const fr of s.scene?.story?.frames ?? []) if (fr.imagePrompt === c.prompt) usedBy.push(`${s.id}·${fr.objectiveId}`);
    const from = c.composedFrom.map((a) => edge(token(getAssetVisual(a).label))).join(" ");
    const usedChips = usedBy.length ? usedBy.map((u) => edge(u)).join(" ") : `<span class="muted">no frame uses this depiction yet</span>`;
    const renderNote = built ? `<span class="badge whole">✅ whole · concept render</span> <span class="muted">· generated</span>` : `${flagBadge("no render — must generate")}`;
    return (
      `<figure class="node">${imageThumb(built ? key : undefined)}` +
      `<figcaption><div class="ntitle"><b>${esc(c.label)}</b> <span class="badge concept">concept · ${esc(id)}</span></div>` +
      `<div class="desc">${esc(c.prompt.length > 130 ? c.prompt.slice(0, 130) + "…" : c.prompt)}</div>` +
      `<div class="meta"><b>built-from</b> ${from}</div>` +
      `<div class="meta"><b>render</b> ${renderNote}</div>` +
      `<div class="meta"><b>used-by</b> ${usedChips}</div>` +
      `</figcaption></figure>`
    );
  });
  return (
    `<section class="scn graph"><h2>Catalog concepts <span class="id">composed, reusable depictions</span> ` +
    `<span class="tally">${conceptWhole}/${ids.length} whole</span></h2>` +
    `<p class="muted">A concept is a depiction built FROM canonical assets (its <b>built-from</b>). Its render is the content-addressed image at the concept's prompt — so every frame with that same depiction shares ONE canonical image (<b>used-by</b>).</p>` +
    `<div class="gallery nodes">${cards.join("")}</div></section>`
  );
}

// =====================================================================================================
// Per-scenario: CHARACTER & VOICE, AUDIO, and COMPOSED IMAGES (with built-from edges).
// =====================================================================================================
let imgCached = 0;
let imgRekey = 0;
const imgRegenList: string[] = [];
let totalAudioRegen = 0;
const audioRegenList: string[] = [];
const audioMismatch: string[] = [];
const rendersToGenerate = new Set<string>();

function scenarioSection(s: Scenario): string {
  const charVoice = characterVoiceProfile(s);
  const charName = s.characterRef ? getCharacter(s.characterRef).name : "(no catalog character)";
  const voiceMismatch = charVoice !== TEACHER_VOICE_PROFILE;
  const story = s.scene?.story;
  const labels = (s.scene?.assets ?? []).map((a) => a.label);

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
    const curKey = store.audioKey(e3.name, teacherTag, text);
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
        `<td><code>${esc(cur?.voiceOrModel ?? teacherTag)}</code></td>` +
        `<td>→ <code>${esc(profile)}</code> ${regen ? yes : keep} ${flag}</td></tr>`,
    );
  };
  addAudio("opening (character)", s.opening, charVoice);
  for (const o of s.objectives) addAudio(`target · ${o.id}`, o.targetSL, TEACHER_VOICE_PROFILE);
  (story?.sentences ?? []).forEach((sn, i) => addAudio(`story[${i}]`, sn, TEACHER_VOICE_PROFILE));
  parts.push(
    `<div class="block"><h3>Audio</h3><table class="grid"><thead><tr><th>clip</th><th>Slovenian</th><th>hear it (current)</th><th>current voice</th><th>proposed</th></tr></thead><tbody>${audioRows.join("")}</tbody></table></div>`,
  );

  // ---- COMPOSED IMAGES: frame/scene render-state + built-from edges ----
  const curImgByObj = new Map<string, any>();
  for (const e of manifest) if (e.type === "image" && e.scenarioId === s.id) curImgByObj.set(e.objectiveId, e);

  const imgCells: string[] = [];
  const addImg = (objectiveId: string, prompt: string, fmt: { aspectRatio: string; resolution: string }) => {
    const newKey = imageKeyFor(prompt, fmt);
    const cur = curImgByObj.get(objectiveId);
    let status: string;
    let thumbKey: string | undefined;
    if (store.has(newKey, "image")) {
      imgCached++;
      status = `${keep}`;
      thumbKey = newKey;
    } else {
      const old = oldRenderForPrompt(prompt);
      if (old) {
        imgRekey++;
        status = `${rekeyBadge} <span class="muted">same picture</span>`;
        thumbKey = old.key;
      } else {
        imgRegenList.push(`${s.id}·${objectiveId}`);
        for (const l of relevantLabels(prompt, labels)) rendersToGenerate.add(`${l}@${s.id}`);
        status = `${yes} <span class="muted">content changed</span>`;
        thumbKey = cur?.key;
      }
    }
    const builtFrom = relevantLabels(prompt, labels);
    const edges = builtFrom.length ? builtFrom.map((l) => edge(token(l))).join(" ") : `<span class="muted">no asset refs</span>`;
    imgCells.push(
      `<figure>${imageThumb(thumbKey)}<figcaption><b>${esc(objectiveId)}</b><br>${status}` +
        `<div class="meta"><b>built-from</b> ${edges}</div></figcaption></figure>`,
    );
  };
  for (const fr of story?.frames ?? []) addImg(fr.objectiveId, fr.imagePrompt, IMAGE_FORMAT.frame);
  if (story?.sceneImagePrompt) addImg("scene", story.sceneImagePrompt, IMAGE_FORMAT.scene);
  parts.push(
    `<div class="block"><h3>Composed images</h3>` +
      `<p class="muted"><b>cached</b> = at the new key · <b>re-key</b> = same picture, braces only (free: <code>npm run rekey:assets</code>) · <b>re-render</b> = content changed. ` +
      `<b>built-from</b> names the canonical assets each image anchors on — change one of those nodes and these are the dependents to judge.</p>` +
      `<div class="gallery">${imgCells.join("")}</div></div>`,
  );

  parts.push(`</section>`);
  return parts.join("\n");
}

// ---- live tutor-reply clips (the CHARACTER speaking) — voice-model flags --------------------------
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
        const mism = !!e.voiceOrModel && e.voiceOrModel !== charTag;
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
    `<p class="muted">Tutor replies captured from past sessions (the character's own lines). They re-key to the character voice and regenerate on next play; a clip recorded in the wrong voice is flagged so the full gender mismatch is visible.</p>` +
    blocks.join("") +
    `</section>`
  );
}

// ---- assemble -------------------------------------------------------------------------------------
const canonical = canonicalAssetsSection(); // populates missingMeta / divergentLocal / noRenderHarvestable
const concepts = conceptsSection();
const sections = active.map(scenarioSection).join("\n");
const strays = straySection();

const sharedCount = [...nodes.values()].filter((n) => n.shared).length;
const localCount = nodes.size - sharedCount;

const summary =
  `<div class="summary"><h2>Asset graph — state &amp; gaps</h2><ul>` +
  `<li><b>Nodes:</b> ${nodes.size} canonical assets (${sharedCount} shared, ${localCount} local) across ${active.length} active scenarios. ` +
  `Catalog: objects ${Object.keys(CATALOG.objects).map((o) => `<code>${esc(o)}</code>`).join(", ")}; characters ${Object.keys(CATALOG.characters).map((c) => `<code>${esc(c)}</code>`).join(", ")}; voices ${Object.keys(CATALOG.voiceProfiles).map((v) => `<code>${esc(v)}</code>`).join(", ")} (teacher = <code>${esc(TEACHER_VOICE_PROFILE)}</code>).</li>` +
  `<li class="${missingMeta ? "flagline" : ""}"><b>Identity metadata (point 3):</b> ${missingMeta} person-asset(s) have <b>no declared gender</b> — the customer-gender drift is invisible until this is modelled on the catalog record.</li>` +
  `<li class="${divergentLocal ? "flagline" : ""}"><b>Canonicalization candidates:</b> ${divergentLocal} would-be-shared asset(s) implemented as <b>divergent locals</b> (e.g. DOORWAY per scenario) — promote to one canonical node to maximize reuse.</li>` +
  `<li><b>Canonical renders (Phase 2 result):</b> <b>${wholeCount} of ${nodes.size} whole</b> — a render now exists at the asset's key (valid, reusable catalog entries; extracted free from the model sheets). ` +
  `<b>${missingRender.length} still missing</b>${missingRender.length ? ` (${missingRender.map((l) => `<code>${esc(l)}</code>`).join(", ")})` : ""} → need a render (Phase 4).</li>` +
  `<li><b>Composed images:</b> ${imgCached} cached, <b>${imgRekey} re-key</b> (same picture, braces only → <code>npm run rekey:assets -- --apply</code>), <b>${imgRegenList.length} re-render</b>${imgRegenList.length ? ` (${imgRegenList.map((a) => `<code>${esc(a)}</code>`).join(", ")})` : ""}. A key change is bookkeeping; only changed content generates.</li>` +
  `<li><b>Audio:</b> ${audioRegenList.length} authored clip(s) re-render — ${audioRegenList.length ? audioRegenList.map((a) => `<code>${esc(a)}</code>`).join(", ") : "none"}; ${audioMismatch.length} live clip(s) mis-voiced. Teacher-voiced target/story audio <b>unchanged</b>.</li>` +
  `<li class="flagline"><b>⚠ Voice:</b> the <b>butcher</b> is male, but its <code>opening</code> + ${audioMismatch.length} live reply clip(s) on disk are the female teacher voice (needs <code>ELEVENLABS_VOICE_ID_MALE</code>).</li>` +
  `<li><b>Nothing generated.</b> This is the review gate — the audit presents the graph; regen is decision-gated per node.</li>` +
  `</ul></div>`;

const css = `
:root{--bg:#fafafa;--card:#fff;--line:#e4e4e7;--ink:#18181b;--muted:#71717a;--flag:#b91c1c;--regen:#b45309;--keep:#15803d;--shared:#1d4ed8}
*{box-sizing:border-box}body{margin:0;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);background:var(--bg)}
header{padding:24px 28px;background:#111;color:#fff}header h1{margin:0 0 4px}header p{margin:0;color:#a1a1aa}
.wrap{max-width:1100px;margin:0 auto;padding:24px 28px}
.summary{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 20px;margin-bottom:28px}
.summary ul{margin:0;padding-left:18px}.summary li{margin:6px 0}.flagline{color:var(--flag)}
section.scn{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px 20px;margin-bottom:24px}
section.graph{border-color:#c7d2fe;background:#fbfcff}
h2{margin:0 0 6px;font-size:20px}h2 .id{font:12px monospace;color:var(--muted);background:#f4f4f5;padding:2px 6px;border-radius:5px}
.role{margin:0 0 14px;color:var(--muted);font-style:italic}
.block{margin:18px 0}.block h3{margin:0 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:6px 8px;vertical-align:middle;border-bottom:1px solid var(--line);font-size:14px}
table.grid th{font-size:12px;text-transform:uppercase;color:var(--muted)}
td.lbl,.sl{font-size:13px}.sl{font-weight:600}code{font:12px monospace;background:#f4f4f5;padding:1px 5px;border-radius:4px}
audio{height:32px;vertical-align:middle}
.gallery{display:flex;flex-wrap:wrap;gap:14px}
.gallery.nodes figure.node{width:280px;text-align:left;border:1px solid var(--line);border-radius:10px;padding:10px;background:#fff}
figure{margin:0;width:160px;text-align:center}figcaption{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.4}
figure.node figcaption{text-align:left}
.ntitle{font-size:14px;color:var(--ink);margin-bottom:4px}
.desc{color:var(--ink);font-size:12px;margin:2px 0}.desc .scns{color:var(--muted);font-weight:600}
.meta{margin-top:5px;font-size:12px}.meta b{color:var(--muted);text-transform:uppercase;letter-spacing:.03em;font-size:10px;margin-right:4px}
.thumb{width:160px;height:120px;object-fit:contain;background:#f4f4f5;border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px}
figure.node .thumb{width:100%;height:150px}
img.thumb{object-fit:cover}
.badge{display:inline-block;font-size:11px;font-weight:700;padding:1px 7px;border-radius:20px;color:#fff}
.badge.regen{background:var(--regen)}.badge.keep{background:var(--keep)}.badge.flag{background:var(--flag)}.badge.rekey{background:#0d9488}
.badge.shared{background:var(--shared)}.badge.local{background:#52525b}.badge.whole{background:#16a34a}.badge.concept{background:#7c3aed}
.tally{font:12px monospace;color:#166534;background:#dcfce7;padding:2px 8px;border-radius:5px}
.chip{display:inline-block;font:11px monospace;background:#f4f4f5;border:1px solid var(--line);padding:1px 6px;border-radius:5px;margin:1px}
.chip.edge{background:#eef2ff;border-color:#c7d2fe;color:#3730a3}
.muted{color:var(--muted);font-size:12px}.missing{color:var(--muted);font-style:italic}
th{white-space:nowrap}`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Asset graph audit — lango-slovenian</title><style>${css}</style></head>
<body><header><h1>Asset graph audit</h1><p>Canonical nodes · used-by / built-from edges · identity metadata · voice model. Review gate — nothing generated.</p></header>
<div class="wrap">${summary}${canonical}${concepts}${sections}${strays}</div></body></html>`;

const outPath = path.join(store.ASSET_DIR, "migration-audit.html");
writeFileSync(outPath, html);
console.log(`✅ wrote ${path.relative(process.cwd(), outPath)}`);
console.log(`   nodes: ${nodes.size} (${sharedCount} shared, ${localCount} local) · missing-meta: ${missingMeta} · divergent-local: ${divergentLocal} · harvestable: ${noRenderHarvestable.length}`);
console.log(`   images: ${imgCached} cached, ${imgRekey} re-key, ${imgRegenList.length} re-render · audio re-render: ${totalAudioRegen}, mis-voiced live: ${audioMismatch.length}`);
console.log(`   open it: open ${path.relative(process.cwd(), outPath)}`);
