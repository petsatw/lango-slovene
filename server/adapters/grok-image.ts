// E4 adapter — xAI Grok image generation (text-to-image). The endpoint is OpenAI-compatible:
// POST https://api.x.ai/v1/images/generations, key as a Bearer header (server-side only, never logged).
// Verified against xAI docs (2026-06): model grok-imagine-image-quality, response_format b64_json -> JPEG.
//
// Reference images (xAI multi-image editing supports up to 3 source images, on a SEPARATE endpoint)
// are intentionally STUBBED here — the seam exists (generate accepts referenceImages) so style-
// consistency can be wired in later without touching callers. See docs/asset-engine-spec.md §M2.

import type { ImageAdapter, ImageResult } from "../types";

const BASE = "https://api.x.ai/v1";

function requireKey(): string {
  const key = process.env.GROK_API_KEY;
  if (!key) throw new Error("GROK_API_KEY is not set (see docs/SECRETS.md)");
  return key;
}

export class GrokImageE4 implements ImageAdapter {
  readonly name = "grok";
  // grok-imagine-image-quality is the current recommended model (grok-imagine-image-pro was
  // deprecated 2026-05-15). Env-overridable so a model swap is a config change, not a code change.
  readonly model = process.env.GROK_IMAGE_MODEL || "grok-imagine-image-quality";

  async generate(input: {
    prompt: string;
    referenceImages?: string[];
    params?: Record<string, unknown>;
  }): Promise<ImageResult> {
    const key = requireKey();

    // STUB: reference images go through xAI's multi-image-editing endpoint (≤3). Not wired yet —
    // warn rather than silently drop, so filling the stub in later is an obvious next step.
    if (input.referenceImages?.length) {
      console.warn(
        `[grok-image] ${input.referenceImages.length} reference image(s) ignored — multi-image editing not wired yet (stub).`,
      );
    }

    const res = await fetch(`${BASE}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: input.prompt,
        n: 1,
        response_format: "b64_json",
        ...(input.params ?? {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Grok image HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const data: any = await res.json();
    const b64: string | undefined = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("Grok image returned no b64_json");
    return { bytes: Buffer.from(b64, "base64"), mimeType: "image/jpeg" };
  }
}
