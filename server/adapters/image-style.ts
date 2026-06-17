// Shared visual style for ALL generated images, so every scenario's frames and scenes look like
// one cohesive set. The styleId is part of the image cache key (store.imageKey), so changing the
// style produces NEW assets rather than serving stale ones.
//
// IMPORTANT: `referenceText` and `referenceImages` below are STUBS for future, sharper style
// guidance. When you fill either in (the output changes), BUMP `id` (e.g. v2-…) so the cache key
// changes and old images don't get served for the new style.

export const IMAGE_STYLE = {
  id: "v1-flat-warm",

  // Prompt prefix applied to every image — the house style in words.
  prefix:
    "Flat, warm, friendly children's-book illustration. Soft rounded shapes, clean vector style, " +
    "gentle Slovenian café/town setting, cohesive muted palette, no text in the image. ",

  // STUB — richer style-guidance text appended to every prompt (color notes, character look,
  // line weight, lighting, etc.). Empty today; fill in to tighten the house style.
  referenceText: "",

  // STUB — up to 3 style reference images for visual consistency (xAI Grok multi-image editing
  // accepts up to 3, at minimal added cost). Provide store keys / paths / URLs here once chosen;
  // they flow through ImageAdapter.generate(referenceImages). Empty today.
  referenceImages: [] as string[],
};

// Build the final image prompt: house prefix + the scene-specific prompt + any style-reference text.
export function styledPrompt(prompt: string): string {
  return [IMAGE_STYLE.prefix, prompt, IMAGE_STYLE.referenceText]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}
