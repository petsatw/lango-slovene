// Scenario + objective data. The active café scenario drives the MVP mastery loop.
// Planned scenarios and the visual `scene` field are stubbed (see docs/ARCHITECTURE.md › Planned).

import type { Objective, SessionState } from "./types";

/** One visual story frame = one learning concept (image + its SL line + that line's audio). */
export interface StoryFrame {
  objectiveId: string; // ties the frame to an objective (and thus its targetSL audio)
  lineSL: string; // the Slovenian line shown/spoken on this frame (usually the objective's targetSL)
  imagePrompt: string; // raw prompt for the frame image (the house style prefix is added at gen time)
}

/** A canonical asset (character / setting / object) for a scenario. The minimal labeled set is drawn
 *  once on the reference sheet; the LABEL is the token reused in every frame/scene prompt. */
export interface AssetDef {
  label: string; // ALL-CAPS token, e.g. BAKER — printed on the sheet, referenced in prompts
  descriptor: string; // minimal canonical description that fixes the look
}

export interface Scenario {
  id: string;
  title: string;
  status: "active" | "planned";
  /** Who the tutor plays. */
  character: string;
  /** The situation, used to set the tutor's role. */
  setup: string;
  /** The tutor's first Slovenian line (shown/spoken at session start). */
  opening: string;
  objectives: Objective[];
  /** Visual story layer (M3/M4) — narrated opener, one frame per objective, one final all-in scene. */
  scene?: {
    /** The minimal labeled asset set → drives the reference sheet that anchors every image. */
    assets?: AssetDef[];
    story?: {
      sentences: string[]; // ≤5 short simple-Slovenian narration sentences
      frames: StoryFrame[]; // one visual frame per learning objective
      sceneImagePrompt: string; // final image: ALL objectives in one picture
    };
  };
}

export const CAFE: Scenario = {
  id: "cafe",
  title: "Ordering at a café in Ljubljana",
  status: "active",
  character: "a friendly barista at a small café in Ljubljana",
  setup:
    "You are a friendly barista at a small café in Ljubljana. A foreigner who is just starting " +
    "to learn Slovenian has come up to order. They live here and want to practice.",
  opening: "Dober dan! Izvolite?",
  objectives: [
    { id: "greet", label: "Greet", targetSL: "Dober dan.", hintEN: "Return the greeting." },
    {
      id: "order_coffee",
      label: "Order a coffee",
      targetSL: "Eno kavo, prosim.",
      hintEN: "Order one coffee. Accusative 'eno kavo' — common beginner error is the nominative 'ena kava'.",
    },
    {
      id: "with_milk",
      label: "With milk",
      targetSL: "Z mlekom, prosim.",
      hintEN: "Ask for it with milk. Instrumental 'z mlekom' — common beginner error is 'z mleko'.",
    },
    {
      id: "pay_leave",
      label: "Pay & leave",
      targetSL: "Koliko stane? Hvala, nasvidenje.",
      hintEN: "Ask the price, then thank and say goodbye.",
    },
  ],
  // Visual story layer — asset bible + narrated opener + one frame per objective + final all-in scene.
  scene: {
    // CUSTOMER is described identically to the bakery's, to begin a consistent cross-scenario student.
    assets: [
      { label: "BARISTA", descriptor: "friendly woman in her 30s, brown hair in a ponytail, denim apron over a white tee, warm smile; full body" },
      { label: "CUSTOMER", descriptor: "friendly adult, short brown hair, mustard-yellow coat, red scarf, canvas tote bag; full body" },
      { label: "CAFE", descriptor: "a small standalone vignette of a cozy Ljubljana café: a wooden counter with an espresso machine and a chalkboard menu behind it" },
      { label: "COFFEE", descriptor: "a single cup of coffee on a saucer" },
      { label: "MILK", descriptor: "a small jug of milk" },
      { label: "COINS", descriptor: "a small handful of a few euro coins" },
    ],
    story: {
      sentences: [
        "Vstopiš v majhno kavarno v Ljubljani.",
        "Za pultom te prijazno pozdravi natakar.",
        "Naročiš kavo z mlekom.",
        "Vprašaš, koliko stane.",
        "Plačaš in se posloviš.",
      ],
      frames: [
        {
          objectiveId: "greet",
          lineSL: "Dober dan.",
          imagePrompt:
            "BARISTA behind the counter, smiling and waving hello to CUSTOMER who has just walked in. " +
            "Focus on the warm greeting between them. Keep the CAFE background simple and uncluttered.",
        },
        {
          objectiveId: "order_coffee",
          lineSL: "Eno kavo, prosim.",
          imagePrompt:
            "CUSTOMER at the counter holding up one finger to order; BARISTA preparing a single COFFEE. " +
            "Focus on ordering one coffee. Keep the CAFE background simple and uncluttered.",
        },
        {
          objectiveId: "with_milk",
          lineSL: "Z mlekom, prosim.",
          imagePrompt:
            "BARISTA pouring MILK from a small jug into the COFFEE at the counter; CUSTOMER watching. " +
            "Focus on asking for the coffee with milk. Keep the CAFE background simple and uncluttered.",
        },
        {
          objectiveId: "pay_leave",
          lineSL: "Koliko stane? Hvala, nasvidenje.",
          imagePrompt:
            "CUSTOMER handing COINS to BARISTA across the counter and waving goodbye, a COFFEE cup in " +
            "hand. Focus on paying and saying goodbye. Keep the CAFE background simple and uncluttered.",
        },
      ],
      sceneImagePrompt:
        "A single warm establishing scene capturing the essence of ordering coffee at a café: CUSTOMER " +
        "at the counter of the CAFE while BARISTA serves them, with the COFFEE, the MILK jug, and COINS " +
        "all visible on the counter. Full, lived-in CAFE.",
    },
  },
};

// The bakery — the second daily transaction. Reuses greet + pay/leave from the café verbatim (free
// audio reuse, cross-context reinforcement) and adds one beginner stretch: the Slovenian dual.
export const BAKERY: Scenario = {
  id: "bakery",
  title: "At the bakery (pekarna)",
  status: "active",
  character: "a friendly baker at a small neighbourhood bakery (pekarna) in Ljubljana",
  setup:
    "You are a friendly baker at a small neighbourhood pekarna in Ljubljana. A foreigner who is just " +
    "starting to learn Slovenian has come in to buy bread. They live here and want to practice.",
  opening: "Dober dan! Kaj bo dobrega?",
  objectives: [
    // greet + pay_leave are deliberately identical to the café → their audio is reused for free.
    { id: "greet", label: "Greet", targetSL: "Dober dan.", hintEN: "Return the greeting." },
    {
      id: "order_bread",
      label: "Order bread",
      targetSL: "En kruh, prosim.",
      hintEN: "Order one loaf of bread. Masculine 'en kruh' — common beginner error is the feminine 'ena kruh'.",
    },
    {
      id: "order_rolls",
      label: "Two rolls",
      targetSL: "Dve žemlji, prosim.",
      hintEN:
        "Ask for two bread rolls. Slovenian DUAL 'dve žemlji' — common beginner errors are the plural " +
        "'dve žemlje' or the wrong number 'dva žemlja'.",
    },
    {
      id: "pay_leave",
      label: "Pay & leave",
      targetSL: "Koliko stane? Hvala, nasvidenje.",
      hintEN: "Ask the price, then thank and say goodbye.",
    },
  ],
  scene: {
    // The minimal labeled asset set (the reference-sheet "bible"). Labels are reused verbatim in the
    // frame/scene prompts below; the sheet is generated once and anchors every frame for consistency.
    assets: [
      { label: "BAKER", descriptor: "friendly woman in her 40s, dark hair in a bun, green apron over a striped shirt, warm smile; full body" },
      { label: "CUSTOMER", descriptor: "friendly adult, short brown hair, mustard-yellow coat, red scarf, canvas tote bag; full body" },
      { label: "BAKERY", descriptor: "a small standalone vignette of a Slovenian bakery counter: a wooden counter with shelves of bread loaves behind it" },
      { label: "LOAF", descriptor: "a single rustic oval loaf of bread" },
      { label: "ROLLS", descriptor: "exactly two round bread rolls, side by side" },
      { label: "COINS", descriptor: "a small handful of a few euro coins" },
    ],
    story: {
      sentences: [
        "Vstopiš v pekarno v Ljubljani.",
        "Za pultom te pozdravi pek.",
        "Naročiš kruh.",
        "Vzameš še dve žemlji.",
        "Plačaš in se posloviš.", // identical to the café's last line → reused
      ],
      // Frame prompts are objective-first and reference the sheet's LABELS, with the background
      // deliberately suppressed so nothing competes with the objective.
      frames: [
        {
          objectiveId: "greet",
          lineSL: "Dober dan.",
          imagePrompt:
            "BAKER behind the counter, smiling and waving hello to CUSTOMER who has just walked in. " +
            "Focus on the warm greeting between them. Keep the BAKERY background simple and uncluttered.",
        },
        {
          objectiveId: "order_bread",
          lineSL: "En kruh, prosim.",
          imagePrompt:
            "CUSTOMER at the counter pointing at one LOAF; BAKER reaching for it. Focus on asking for a " +
            "single loaf of bread. Keep the BAKERY background simple and uncluttered.",
        },
        {
          objectiveId: "order_rolls",
          lineSL: "Dve žemlji, prosim.",
          imagePrompt:
            "CUSTOMER holding up two fingers while BAKER places the two ROLLS into a paper bag; the two " +
            "ROLLS clearly shown. Focus on the number two — unmistakably two rolls. Keep the BAKERY " +
            "background simple and uncluttered.",
        },
        {
          objectiveId: "pay_leave",
          lineSL: "Koliko stane? Hvala, nasvidenje.",
          imagePrompt:
            "CUSTOMER handing COINS to BAKER across the counter and waving goodbye, a paper bag of bread " +
            "in hand. Focus on paying and saying goodbye. Keep the BAKERY background simple and uncluttered.",
        },
      ],
      // Scene = establishing tableau: one representative moment, ALL objects present, full setting.
      sceneImagePrompt:
        "A single warm establishing scene capturing the essence of ordering and buying bread at a bakery: " +
        "CUSTOMER at the counter of the BAKERY while BAKER serves them, with the LOAF, the two ROLLS, and " +
        "COINS all visible on the counter. Full, lived-in BAKERY.",
    },
  },
};

// PLANNED scenarios (Feature 1 — choose-your-own-adventure). Declared, not yet implemented.
export const PLANNED_SCENARIOS: Scenario[] = [
  { id: "upravna_enota", title: "Registering at the upravna enota", status: "planned", character: "", setup: "", opening: "", objectives: [] },
  { id: "pharmacy", title: "At the pharmacy (lekarna)", status: "planned", character: "", setup: "", opening: "", objectives: [] },
];

export const SCENARIOS: Scenario[] = [CAFE, BAKERY, ...PLANNED_SCENARIOS];

export function getScenario(id: string | undefined): Scenario {
  return SCENARIOS.find((s) => s.id === id && s.status === "active") ?? CAFE;
}

export function freshSession(scenario: Scenario): SessionState {
  return {
    scenarioId: scenario.id,
    objectives: scenario.objectives.map((o) => ({ id: o.id, status: "pending", attempts: 0 })),
    complete: false,
    turns: 0,
  };
}
