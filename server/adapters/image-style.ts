// Shared visual system for ALL generated images, so every scenario's reference sheet, frames, and
// scene read as one cohesive set. `id` is part of the image cache key (store.imageKey).
//
// IMPORTANT: `id` represents the WHOLE visual system — the art style AND each scenario's reference
// sheet. If you change the prefix, or regenerate a scenario's reference sheet so output shifts,
// BUMP `id` (e.g. v2-…) so keys change and stale images aren't served for the new look.

export const IMAGE_STYLE = {
  id: "v1-flat-warm",

  // Scenario-agnostic art style. The SETTING comes from each frame/scene prompt + the reference
  // sheet, never from here — so this prefix must not name a specific place (café, bakery, …).
  prefix:
    "Flat, warm, friendly children's-book illustration. Soft rounded shapes, clean vector style, " +
    "cohesive muted palette, gentle Slovenian feel. ",

  // STUB — extra style-guidance text appended to frame/scene prompts. Empty today.
  referenceText: "",
};

// Aspect ratio + resolution are a property of the ASSET TYPE, set by the engine (explicit API args,
// never prose). Per-asset-type so they can diverge; today: focused 4:3 frames, 16:9 sheet/scene.
export const IMAGE_FORMAT = {
  sheet: { aspectRatio: "16:9", resolution: "2k" }, // wide labeled lineup; it's the anchor → 2k
  frame: { aspectRatio: "4:3", resolution: "2k" }, // single-objective focus
  scene: { aspectRatio: "16:9", resolution: "2k" }, // establishing tableau; video-native
} as const;

// Frame/scene prompt: house style + the authored prompt + any style-reference text.
export function styledPrompt(prompt: string): string {
  return [IMAGE_STYLE.prefix, prompt, IMAGE_STYLE.referenceText]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}

// The reference-sheet ("model sheet") prompt — a DISTINCT path: art-style words but an explicit
// neutral-background, labeled-catalog instruction (no scene). This image becomes the anchor that
// every frame/scene is generated against, which is what holds character/setting consistent.
export function referenceSheetPrompt(assets: { label: string; descriptor: string }[]): string {
  const lines = assets.map((a) => `• ${a.label} — ${a.descriptor}.`).join("\n");
  return (
    "A character-and-prop model sheet (reference sheet) on a plain off-white background — a neat, " +
    "evenly-spaced catalog of separate, isolated items, NOT a scene. " +
    IMAGE_STYLE.prefix +
    "Draw each item once, isolated, and print its NAME in small clean capital letters directly " +
    "beneath it. No background scenery, no story, no interaction between items — just the labeled " +
    "items on the plain background, all in one consistent style and palette.\n\n" +
    "Items (draw each once, label exactly as written):\n" +
    lines
  );
}
