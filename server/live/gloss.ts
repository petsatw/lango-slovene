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
import { DATA_DIR } from "../assets/store";
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

/** A translation of a live line is learner content, so it is cached with its session and goes when the
 *  session does. `gloss-cache.json` holds catalog lines only. */
function cachePath(sessionId: string): string {
  return path.join(DATA_DIR, "live", `${sessionId}.gloss.json`);
}

function loadCache(sessionId: string): Record<string, string> {
  const p = cachePath(sessionId);
  if (!existsSync(p)) return {};
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {}; // a corrupt cache costs one model call, never an error
  }
}

function saveCache(sessionId: string, cache: Record<string, string>): void {
  const dir = path.join(DATA_DIR, "live");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(cachePath(sessionId), JSON.stringify(cache, null, 2));
}

export async function glossOf(
  sl: string,
  /** The live session the line belongs to; only a UUID names a cache file. Without one the answer is
   *  not remembered. */
  sessionId: string | undefined,
  /** Whether an answer from the model may be REMEMBERED. A session that declined retention reads its
   *  cache and writes nothing (server/assets/retention.ts). Catalog hits are free and unaffected. */
  retain = true,
): Promise<{ gloss: string; source: GlossSource }> {
  const session = sessionId && /^[\w-]+$/.test(sessionId) ? sessionId : undefined;
  const key = norm(sl);
  if (!key) return { gloss: "", source: "catalog" };

  // 1. The catalog already knows this phrase — free, instant, and the SAME English the rest of the app
  //    shows for it, so a word does not acquire two translations depending on where it was met.
  const known = findLearnableBySurface(sl);
  if (known) return { gloss: known.gloss, source: "catalog" };

  // 2. Asked before. The English for a given Slovene string does not change, so this is durable.
  const cache = session ? loadCache(session) : {};
  if (cache[key]) return { gloss: cache[key], source: "cache" };

  // 3. Ask the model, then remember the answer.
  const e2 = getE2();
  if (!e2.gloss) throw new Error(`E2 provider "${e2.name}" cannot translate`);
  const gloss = await e2.gloss(sl);
  if (gloss && retain && session) {
    cache[key] = gloss;
    saveCache(session, cache);
  }
  return { gloss, source: "model" };
}
