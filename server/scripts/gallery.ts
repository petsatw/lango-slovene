// Catalog gallery — a clean visual index of EVERYTHING we have rendered to date: every catalog object
// and actor, every composed concept (locations + atomic depictions), and every scenario's scene + frames.
// Read-only: resolves each node to its render key and links the on-disk image; generates nothing.
//
// Served live by the dev server at GET /gallery (server.ts): buildGalleryHtml() rebuilds the page from the
// CURRENT catalog + store on every request, so a plain browser refresh shows new/edited entries and new
// renders with no restart. There is no static-file output — this module exports only the builder.

import "dotenv/config";
import * as store from "../assets/store";
import { getE4 } from "../adapters/index";
import { IMAGE_STYLE, IMAGE_FORMAT } from "../adapters/image-style";
import { assetRenderKey } from "../assets/images";
import { conceptRenderKey } from "../assets/compose";
import { loadCatalog } from "../catalog";
import { loadScenarios } from "../scenarios";

const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

// Build the gallery page from the current catalog + on-disk renders. `imgBase` is the URL prefix for
// image links: "image" for the static file (opened from assets/), or an absolute path like
// "/gallery/image" when the dev server serves the page live.
export function buildGalleryHtml(opts: { imgBase?: string } = {}): string {
  const imgBase = opts.imgBase ?? "image";
  // Read catalog + scenarios FRESH from disk every call, so the live /gallery route reflects new or
  // edited entries on a plain browser refresh — no server restart. (The image store is already read live.)
  const catalog = loadCatalog();
  const scenarios = loadScenarios();
  const e4 = getE4();
  const imgKey = (prompt: string, fmt: { aspectRatio: string; resolution: string }) =>
    store.imageKey(e4.name, e4.model, IMAGE_STYLE.id, fmt.aspectRatio, fmt.resolution, prompt);

  // A render thumbnail (or a "missing" placeholder) for a store key.
  const thumb = (key: string, alt: string, cls = ""): string =>
    store.has(key, "image")
      ? `<a href="${imgBase}/${key}.jpg" target="_blank"><img class="thumb ${cls}" loading="lazy" src="${imgBase}/${key}.jpg" alt="${esc(alt)}"></a>`
      : `<div class="thumb ${cls} missing">— no render —</div>`;

  // Which objects are used as a character's figure (visualRef) — tagged in the objects grid.
  const figureIds = new Set<string>();
  for (const c of Object.values(catalog.characters)) {
    figureIds.add(c.visualRef);
    c.type.forEach((t) => figureIds.add(t));
  }

  // ---- OBJECTS ---------------------------------------------------------------------------------
  const objectCards = Object.values(catalog.objects)
    .map((o) => {
      const key = assetRenderKey({ label: o.label, descriptor: o.descriptor });
      const tags = [figureIds.has(o.id) ? `<span class="tag fig">figure</span>` : "", o.gender ? `<span class="tag">${o.gender}</span>` : ""].join("");
      return `<figure>${thumb(key, o.label)}<figcaption><b>${esc(o.label)}</b> <code>${esc(o.id)}</code>${tags}<div class="desc">${esc(o.descriptor)}</div></figcaption></figure>`;
    })
    .join("");

  // ---- ACTORS (characters) ---------------------------------------------------------------------
  const actorCards = Object.values(catalog.characters)
    .map((c) => {
      const key = assetRenderKey(catalog.objects[c.visualRef]!); // actor's pixels = its visualRef object (validated at load)
      const meta = `type [${c.type.join(", ")}] · visualRef <code>${esc(c.visualRef)}</code> · ${esc(c.gender ?? "—")} · voice <code>${esc(c.voiceProfile)}</code>`;
      return `<figure>${thumb(key, c.id)}<figcaption><b>${esc(c.name ?? c.id)}</b> <code>${esc(c.id)}</code><div class="desc">${meta}</div></figcaption></figure>`;
    })
    .join("");

  // ---- CONCEPTS (locations + atomic depictions) ------------------------------------------------
  const conceptCards = Object.values(catalog.concepts)
    .map((c) => {
      const key = conceptRenderKey(c);
      const ar = c.aspectRatio ?? IMAGE_FORMAT.frame.aspectRatio;
      const fmt = c.format ?? "flashcard";
      const isLoc = fmt === "scene";
      return `<figure class="${isLoc ? "wide" : ""}">${thumb(key, c.label, isLoc ? "wide" : "")}<figcaption><b>${esc(c.label)}</b> <code>${esc(c.id)}</code> <span class="tag ${isLoc ? "loc" : ""}">${fmt} · ${ar}</span><div class="desc">composedFrom: ${c.composedFrom.map((a) => `<code>${esc(a)}</code>`).join(" + ")}</div></figcaption></figure>`;
    })
    .join("");

  // ---- scenarios (scene + frames) --------------------------------------------------------------
  const scenarioSections = scenarios.filter((s) => s.status === "active")
    .map((s) => {
      const story = s.scene?.story;
      const sceneKey = story?.sceneImagePrompt ? imgKey(story.sceneImagePrompt, IMAGE_FORMAT.scene) : "";
      const scene = sceneKey ? `<div class="scene">${thumb(sceneKey, `${s.id} scene`, "wide")}</div>` : "";
      const objById = new Map(s.objectives.map((o) => [o.id, o]));
      const frames = (story?.frames ?? [])
        .map((f) => {
          const key = imgKey(f.imagePrompt, IMAGE_FORMAT.frame);
          const o = objById.get(f.objectiveId);
          return `<figure>${thumb(key, f.objectiveId)}<figcaption><b>${esc(o?.targetSL ?? f.objectiveId)}</b><div class="desc"><code>${esc(f.objectiveId)}</code></div></figcaption></figure>`;
        })
        .join("");
      return `<section class="scenario"><h2>${esc(s.name ?? s.title)} <code>${esc(s.id)}</code> <span class="role">${esc(s.character)}</span></h2>${scene}<div class="grid frames">${frames}</div></section>`;
    })
    .join("");

  const renderedCount = (() => {
    let n = 0;
    const keys: string[] = [
      ...Object.values(catalog.objects).map((o) => assetRenderKey({ label: o.label, descriptor: o.descriptor })),
      ...Object.values(catalog.concepts).map((c) => conceptRenderKey(c)),
    ];
    for (const k of keys) if (store.has(k, "image")) n++;
    return n;
  })();

  return `<!doctype html><html><head><meta charset="utf-8"><title>lango-slovenian — catalog gallery</title>
<style>
:root{--bg:#0f1115;--panel:#181b21;--muted:#9aa1ad;--line:#262b33;--accent:#7c3aed}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:#e6e8eb;font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.wrap{max-width:1280px;margin:0 auto;padding:24px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:0 0 12px;border-bottom:1px solid var(--line);padding-bottom:8px}
.lead{color:var(--muted);margin:0 0 24px}
section{margin:0 0 40px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px}
figure{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
figure.wide{grid-column:span 2}
.thumb{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:#0b0d11}
.thumb.wide{aspect-ratio:16/9}
.thumb.missing{display:flex;align-items:center;justify-content:center;color:var(--muted);font-style:italic;aspect-ratio:1/1}
figcaption{padding:8px 10px}figcaption b{font-size:13px}
code{background:#0b0d11;border:1px solid var(--line);border-radius:4px;padding:0 4px;color:#c7cbd1;font-size:11px}
.desc{color:var(--muted);font-size:11px;margin-top:4px}
.tag{display:inline-block;background:#2a2f38;color:#cfd3da;border-radius:4px;padding:0 6px;font-size:10px;margin-left:4px}
.tag.fig{background:#1d4ed8}.tag.loc{background:var(--accent)}
.scenario .scene{margin-bottom:14px}.scenario .scene .thumb{aspect-ratio:16/9;max-width:640px}
.role{color:var(--muted);font-weight:400;font-size:12px}
.frames{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.count{color:var(--muted);font-weight:400;font-size:12px}
</style></head><body><div class="wrap">
<h1>lango-slovenian — catalog gallery</h1>
<p class="lead">Every rendered object, actor, concept and scenario to date · style <code>${esc(IMAGE_STYLE.id)}</code> · ${renderedCount} canonical renders on disk</p>
<section><h2>Objects <span class="count">${Object.keys(catalog.objects).length}</span></h2><div class="grid">${objectCards}</div></section>
<section><h2>Actors <span class="count">${Object.keys(catalog.characters).length}</span></h2><div class="grid">${actorCards}</div></section>
<section><h2>Concepts &amp; locations <span class="count">${Object.keys(catalog.concepts).length}</span></h2><div class="grid">${conceptCards}</div></section>
${scenarioSections}
</div></body></html>`;
}
