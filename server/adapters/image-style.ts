// Shared visual style for ALL generated images, so every scenario's frames and scenes look like
// one cohesive set. The styleId is part of the image cache key (store.imageKey), so changing the
// style produces NEW assets rather than serving stale ones. Tune `prefix` at the M2 provider gate
// once a provider/model is chosen and you can eyeball real output.

export const IMAGE_STYLE = {
  id: "v1-flat-warm",
  prefix:
    "Flat, warm, friendly children's-book illustration. Soft rounded shapes, clean vector style, " +
    "gentle Slovenian café/town setting, cohesive muted palette, no text in the image. ",
};

export function styledPrompt(prompt: string): string {
  return IMAGE_STYLE.prefix + prompt;
}
