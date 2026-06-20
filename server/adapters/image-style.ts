// Shared visual system for ALL generated images, so every scenario's reference sheet, frames, and
// scene read as one cohesive set. `id` is part of the image cache key (store.imageKey).
//
// IMPORTANT: `id` represents the WHOLE visual system — the art style AND each scenario's reference
// sheet. If you change the prefix, or regenerate a scenario's reference sheet so output shifts,
// BUMP `id` (e.g. v2-…) so keys change and stale images aren't served for the new look.

export const IMAGE_STYLE = {
  // v2: frames switched from "compose a new scene" to minimal-compose flashcards (atomic, neutral
  // background, no label). Same prompt at the old id would collide on existing 4:3 frames, so this is
  // a one-time global re-key — all images regenerate on the next build:assets.
  id: "v2-flat-warm",

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

// Which asset labels are actually used by a prompt — so the reference instruction names ONLY the
// assets relevant to this frame/scene (greet shouldn't reference LOAF/ROLLS/COINS). Whole-word match
// on the ALL-CAPS tokens, returned in the bible's order.
export function relevantLabels(prompt: string, allLabels: string[]): string[] {
  return allLabels.filter((label) => new RegExp(`\\b${label}\\b`).test(prompt));
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

// The reference-sheet usage instruction, built PER frame/scene from just the relevant labels.
// Added only when an image is anchored to the sheet.
export function referenceInstruction(labels: string[]): string {
  return (
    `To compose the scene, match the following to the corresponding labeled asset on the reference ` +
    `sheet: ${formatList(labels)}. Use the assets themselves as a style and character references, ` +
    `making sure to compose them naturally in a new scene, changing perspective, angle, size and ` +
    `position in order to best represent the scene description. Do not reproduce the labels, they are ` +
    `purely to asset matching and to establish context.`
  );
}

// The MINIMAL-COMPOSE instruction — the atomic-flashcard variant of referenceInstruction. Where the
// scene path "composes a new scene", a flashcard ISOLATES only the disambiguating assets on a neutral
// background with NO printed label, still anchored to the sheet so the card's assets are pixel-
// consistent with the scene. The depiction prose (greet = entering the doorway) carries the
// disambiguating context; this instruction just constrains the composition.
export function minimalComposeInstruction(labels: string[]): string {
  return (
    `This is a single atomic flashcard, NOT a scene. Match the following to the corresponding labeled ` +
    `asset on the reference sheet: ${formatList(labels)} — use them as exact style and identity ` +
    `references so they are pixel-consistent with the other images. Isolate ONLY these assets (plus the ` +
    `minimal disambiguating context the description names) on a plain, neutral, uncluttered background. ` +
    `No setting, no extra props, no people or objects beyond what is described, and NO printed words, ` +
    `letters, or labels anywhere in the image. Keep it centered and clear. Do not reproduce the label ` +
    `text — the labels are only for asset matching.`
  );
}

// Frame/scene prompt: house style + (when anchored) the reference instruction for the relevant
// labels + the authored prompt + any style-reference text. `mode` picks the composition instruction:
// "scene" composes a full tableau (referenceInstruction); "flashcard" minimal-composes an atomic card.
export function styledPrompt(
  prompt: string,
  opts?: { referenceLabels?: string[]; mode?: "flashcard" | "scene" },
): string {
  const labels = opts?.referenceLabels ?? [];
  const ref = labels.length
    ? opts?.mode === "flashcard"
      ? minimalComposeInstruction(labels)
      : referenceInstruction(labels)
    : "";
  return [IMAGE_STYLE.prefix, ref, prompt, IMAGE_STYLE.referenceText]
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
