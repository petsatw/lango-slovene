// E4 adapter — xAI Grok image generation. Key as a Bearer header (server-side only, never logged).
// Verified against xAI docs (2026-06): model grok-imagine-image-quality, response_format b64_json -> JPEG.
//   - text-to-image:  POST https://api.x.ai/v1/images/generations  { model, prompt, aspect_ratio, resolution }
//   - with reference: POST https://api.x.ai/v1/images/edits        { ..., image: {url, type:"image_url"} }
// The edits endpoint anchors output to ≤3 source images (URL / base64 data URI / file_id) — that's
// how we pin character/setting consistency to the scenario's reference sheet.

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
    aspectRatio?: string;
    resolution?: string;
    referenceImages?: string[];
    params?: Record<string, unknown>;
  }): Promise<ImageResult> {
    const key = requireKey();
    const refs = (input.referenceImages ?? []).filter(Boolean).slice(0, 3);

    const common: Record<string, unknown> = {
      model: this.model,
      prompt: input.prompt,
      response_format: "b64_json",
      ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
      ...(input.resolution ? { resolution: input.resolution } : {}),
      ...(input.params ?? {}),
    };

    // Reference path (edits) anchors to the source image(s); else plain text-to-image.
    const url = refs.length ? `${BASE}/images/edits` : `${BASE}/images/generations`;
    const body = refs.length
      ? { ...common, image: refs.length === 1 ? { url: refs[0], type: "image_url" } : refs.map((r) => ({ url: r, type: "image_url" })) }
      : { ...common, n: 1 };

    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Grok image HTTP ${res.status}: ${errBody.slice(0, 300)}`);
    }

    const data: any = await res.json();
    const b64: string | undefined = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("Grok image returned no b64_json");
    return { bytes: Buffer.from(b64, "base64"), mimeType: "image/jpeg" };
  }
}
