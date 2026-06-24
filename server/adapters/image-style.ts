// Shared visual system for ALL generated images, so every scenario's reference sheet, frames, and
// scene read as one cohesive set. `id` is part of the image cache key (store.imageKey).
//
// IMPORTANT: `id` represents the WHOLE visual system — the art style AND each scenario's reference
// sheet. If you change the prefix, or regenerate a scenario's reference sheet so output shifts,
// BUMP `id` (e.g. v2-…) so keys change and stale images aren't served for the new look.

export const IMAGE_STYLE = {
  // styleId folds the visual SYSTEM into the cache key. Bump it ONLY for a deliberate global re-render
  // (a changed art style / look). The v3 per-asset-reference mechanism did NOT bump it: it changes how
  // an image is anchored when it (re)generates, but it must not force-regenerate images whose pixels
  // are still good — a key change is bookkeeping, regeneration is a content decision (see store keying:
  // frame/scene keys strip the {{TOKEN}} braces, so adding that notation doesn't churn the cache).
  id: "v2-flat-warm",

  // Scenario-agnostic art style. The SETTING comes from each frame/scene prompt + the reference
  // sheet, never from here — so this prefix must not name a specific place (café, bakery, …).
  // NOTE: "rounded" here means soft EDGES/linework (the approachable look), NOT body shape — the style
  // never dictates build; people render in all natural shapes. The prefix is in the per-asset render
  // prompt (singleAssetSheetPrompt) but NOT in frame
  // keys (those key on the authored prompt + styleId), so editing it re-keys only asset renders; rekey
  // the ones whose picture is unchanged, re-render the people.
  prefix:
    "Flat, warm, friendly children's-book illustration with soft edges and clean, gently rounded " +
    "linework, a cohesive muted palette, and a contemporary Ljubljana old-town feel — present-day " +
    "Slovenia, dressed and styled for today, with only a few subtle traditional accents. ",

  // STUB — extra style-guidance text appended to frame/scene prompts. Empty today.
  referenceText: "",
};

// Aspect ratio + resolution are a property of the ASSET TYPE, set by the engine (explicit API args,
// never prose). Per-asset-type so they can diverge; today: focused 4:3 frames, 16:9 scene.
export const IMAGE_FORMAT = {
  asset: { aspectRatio: "1:1", resolution: "1k" }, // one isolated canonical render → the reference unit
  frame: { aspectRatio: "4:3", resolution: "2k" }, // single-objective focus
  scene: { aspectRatio: "16:9", resolution: "2k" }, // establishing tableau; video-native
} as const;

// A bible asset is referenced in a prompt by an UNAMBIGUOUS delimited token: `{{CUSTOMER}}`. The
// braces are the marker — they distinguish a reference from ALL-CAPS used for plain emphasis
// (INSIDE, ONE, TWO) and need no whitelist. They are NOT stripped: the sheet builder prints the same
// `{{LABEL}}` under each tile and the reference instruction names the same token, so the generator
// sees one identical marker in the prose, the instruction, and printed on the sheet → exact match.
export const TOKEN_RE = /\{\{([A-Z0-9_]+)\}\}/g;

/** Wrap a bible label as its reference token. */
export function token(label: string): string {
  return `{{${label}}}`;
}

/** Strip the {{ }} from reference tokens ({{CUSTOMER}} → CUSTOMER). NOT used for keying — image keys
 *  are the literal prompt. This is a one-shot helper for the {{TOKEN}} migration (rekey-assets): an
 *  image whose only change is adding the braces is the same picture, so its existing bytes are re-keyed
 *  to the new prompt rather than regenerated. */
export function stripTokens(prompt: string): string {
  return prompt.replace(TOKEN_RE, "$1");
}

// Which bible assets a prompt actually references (greet shouldn't pull LOAF/ROLLS/COINS), returned in
// the bible's order so the montage tiles + the instruction list agree.
export function relevantLabels(prompt: string, allLabels: string[]): string[] {
  const referenced = new Set<string>();
  for (const m of prompt.matchAll(TOKEN_RE)) if (m[1]) referenced.add(m[1]);
  return allLabels.filter((label) => referenced.has(label));
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

// The reference-usage instruction, built PER frame/scene from just the relevant labels. Added only
// when an image is anchored. The reference image is ONE labelled sheet, composed locally for this image
// from the assets it uses (each tile is named beneath it) — so match by label.
export function referenceInstruction(labels: string[]): string {
  return (
    `To compose the scene, match each of these tokens to the item printed with the same label on the ` +
    `reference sheet: ${formatList(labels.map(token))}. Use those items as the exact style and identity ` +
    `references — same design, colour, and proportions — and compose them naturally into a new scene, ` +
    `changing perspective, angle, size and position to best represent the scene description. Do not ` +
    `draw the {{...}} tokens or any labels in the image; they are only there to match each item.`
  );
}

// The MINIMAL-COMPOSE instruction — the atomic-flashcard variant of referenceInstruction. Where the
// scene path "composes a new scene", a flashcard ISOLATES only the disambiguating assets on a neutral
// background with NO printed label, still anchored to the per-asset reference renders so the card's
// assets are pixel-consistent with the scene. The depiction prose (greet = entering the doorway)
// carries the disambiguating context; this instruction just constrains the composition.
export function minimalComposeInstruction(labels: string[]): string {
  return (
    `Match each token to the item printed with the same label on the reference sheet: ${formatList(labels.map(token))}. ` +
    `Those reference items define each thing's identity and style — keep its design, colour, and proportions — ` +
    `but you are free to recompose them: change perspective, angle, size, and position as needed to best depict ` +
    `the description. This is a single atomic flashcard: place only these assets (plus the minimal context the ` +
    `description names) on a plain, neutral, uncluttered background — no setting, no extra props or people, and ` +
    `no printed words, letters, or {{...}} tokens anywhere in the image. Keep it centered and clear.`
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
  // The authored DEPICTION leads (what to draw), then the house style + composition instructions. Keying
  // is on the raw authored prompt, not this assembled string, so reordering churns no cache.
  return [prompt, IMAGE_STYLE.prefix, ref, IMAGE_STYLE.referenceText]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}

// The per-asset CANONICAL RENDER prompt — one isolated item on a plain background, in the house style.
// This is the reference UNIT of the v3 system: each asset is rendered once and reused as the anchor
// for every frame/scene that uses it. Because a shared (catalog) asset's descriptor is identical
// wherever it's referenced, the content-addressed store renders it ONCE and reuses it across scenarios
// (money = the canary). No printed label — the image IS the single asset, identified by position.
export function singleAssetSheetPrompt(label: string, descriptor: string): string {
  return (
    "A single isolated item on a plain, neutral off-white background — one clean catalog render, NOT a " +
    "scene. " +
    IMAGE_STYLE.prefix +
    `Draw exactly one thing: ${descriptor}. ` +
    "Centered, fully visible, no background scenery, no other objects or people, no printed words, " +
    "letters, or labels anywhere in the image."
  );
}
