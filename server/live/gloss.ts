// Tap-to-reveal English for a LIVE transcript line.
//
// Every other surface gets its gloss free: the turn loop and free chat both return one in the same JSON
// as the reply. A speech stream has no such return path, so the English has to be fetched separately —
// and the cheapest correct order is catalog, then cache, then the model.
//
// Resolved LAZILY, on tap. Translating every line as it arrives would bill for the many lines nobody
// asks about; this bills only for curiosity, and most beginner lines never reach the model at all
// because the tutor is told to build its speech out of the catalog palette in the first place.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ASSET_DIR } from "../assets/store";
import { findLearnableBySurface } from "../mastery";
import { getE2 } from "../adapters/index";

export type GlossSource = "catalog" | "cache" | "model";

/** Same normalisation the catalog lookup uses, so "Dober dan!" and "dober dan" are one cache entry. */
function norm(sl: string): string {
  return sl
    .toLowerCase()
    .replace(/[.,!?¿¡;:"'()«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cachePath(): string {
  return path.join(ASSET_DIR, "gloss-cache.json");
}

function loadCache(): Record<string, string> {
  const p = cachePath();
  if (!existsSync(p)) return {};
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {}; // a corrupt cache costs one model call, never an error
  }
}

function saveCache(cache: Record<string, string>): void {
  const dir = ASSET_DIR;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(cachePath(), JSON.stringify(cache, null, 2));
}

export async function glossOf(sl: string): Promise<{ gloss: string; source: GlossSource }> {
  const key = norm(sl);
  if (!key) return { gloss: "", source: "catalog" };

  // 1. The catalog already knows this phrase — free, instant, and the SAME English the rest of the app
  //    shows for it, so a word does not acquire two translations depending on where it was met.
  const known = findLearnableBySurface(sl);
  if (known) return { gloss: known.gloss, source: "catalog" };

  // 2. Asked before. The English for a given Slovene string does not change, so this is durable.
  const cache = loadCache();
  if (cache[key]) return { gloss: cache[key], source: "cache" };

  // 3. Ask the model, then remember the answer.
  const e2 = getE2();
  if (!e2.gloss) throw new Error(`E2 provider "${e2.name}" cannot translate`);
  const gloss = await e2.gloss(sl);
  if (gloss) {
    cache[key] = gloss;
    saveCache(cache);
  }
  return { gloss, source: "model" };
}
