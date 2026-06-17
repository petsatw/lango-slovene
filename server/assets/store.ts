// Persistent, content-addressed local asset library — the reuse engine.
// Retrofits the in-memory audio cache into a durable store on disk: any generated clip is
// reused free/instant and SURVIVES RESTARTS, accumulating a reusable content library.
//
// Hot-path lookup = file existence (fs.existsSync), NOT a manifest read. The manifest
// (manifest.jsonl) is an append-only metadata sidecar for queries / the future library view.
//
// Content-addressed: an asset's key is sha256 over its *inputs* (provider|voice|text for audio),
// so identical inputs always map to the same file. TTS is not byte-deterministic, so the FIRST
// generation is canonical and reused thereafter — one clip per phrase, by design.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export type AssetType = "audio" | "image";

const EXT: Record<AssetType, string> = { audio: "mp3", image: "png" };

// Gitignored assets/ at repo root by default; override with ASSET_DIR (absolute, or relative to cwd).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.join(__dirname, "..", "..", "assets");
export const ASSET_DIR = process.env.ASSET_DIR ? path.resolve(process.env.ASSET_DIR) : DEFAULT_DIR;
const MANIFEST = path.join(ASSET_DIR, "manifest.jsonl");

export interface AssetMeta {
  provider: string;
  voiceOrModel: string; // voiceTag for audio, model+style for images
  text?: string; // audio source text
  prompt?: string; // image prompt (M2)
  scenarioId?: string;
  objectiveId?: string;
}

// Audio key — unchanged from the original server.ts audioKey, so existing keys stay compatible.
export function audioKey(provider: string, voiceTag: string, text: string): string {
  return createHash("sha256").update(`${provider}|${voiceTag}|${text}`).digest("hex");
}

// Image key (M2) — includes styleId so a style change is a distinct asset, never a stale hit.
export function imageKey(provider: string, model: string, styleId: string, prompt: string): string {
  return createHash("sha256").update(`${provider}|${model}|${styleId}|${prompt}`).digest("hex");
}

export function getPath(key: string, type: AssetType): string {
  return path.join(ASSET_DIR, type, `${key}.${EXT[type]}`);
}

// The hot-path cache check: a hit is simply the file existing on disk.
export function has(key: string, type: AssetType): boolean {
  return existsSync(getPath(key, type));
}

export function read(key: string, type: AssetType): Buffer | null {
  const p = getPath(key, type);
  return existsSync(p) ? readFileSync(p) : null;
}

// Write the file + append one manifest line. Content-addressed, so an existing key is a no-op
// (identical key ⇒ identical content) — never rewrite the file or duplicate the manifest entry.
export function put(key: string, type: AssetType, bytes: Buffer, meta: AssetMeta): void {
  const p = getPath(key, type);
  if (existsSync(p)) return;
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, bytes);
  const entry = {
    key,
    type,
    path: path.relative(ASSET_DIR, p),
    provider: meta.provider,
    voiceOrModel: meta.voiceOrModel,
    ...(meta.text !== undefined ? { text: meta.text } : {}),
    ...(meta.prompt !== undefined ? { prompt: meta.prompt } : {}),
    ...(meta.scenarioId !== undefined ? { scenarioId: meta.scenarioId } : {}),
    ...(meta.objectiveId !== undefined ? { objectiveId: meta.objectiveId } : {}),
    createdAt: new Date().toISOString(),
  };
  appendFileSync(MANIFEST, JSON.stringify(entry) + "\n");
}

// The core reuse primitive: hit → return from disk (free); miss → run the generator, persist, return.
export async function getOrCreate(
  key: string,
  type: AssetType,
  meta: AssetMeta,
  gen: () => Promise<{ bytes: Buffer; mimeType: string }>,
): Promise<{ bytes: Buffer; hit: boolean }> {
  const existing = read(key, type);
  if (existing) return { bytes: existing, hit: true };
  const { bytes } = await gen();
  put(key, type, bytes, meta);
  return { bytes, hit: false };
}
