// Scenario + objective data. The active café scenario drives the MVP mastery loop.
// Planned scenarios and the visual `scene` field are stubbed (see docs/ARCHITECTURE.md › Planned).

import type { Objective, SessionState } from "./types";

/** One visual story frame = one learning concept (image + its SL line + that line's audio). */
export interface StoryFrame {
  objectiveId: string; // ties the frame to an objective (and thus its targetSL audio)
  lineSL: string; // the Slovenian line shown/spoken on this frame (usually the objective's targetSL)
  imagePrompt: string; // raw prompt for the frame image (the house style prefix is added at gen time)
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
  // Visual story layer (M3): narrated opener + one frame per objective + a final all-in scene.
  scene: {
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
            "A friendly barista behind a small café counter waving hello to a customer who has just " +
            "walked in, warm welcoming smile.",
        },
        {
          objectiveId: "order_coffee",
          lineSL: "Eno kavo, prosim.",
          imagePrompt:
            "A customer at the café counter ordering one coffee, holding up one finger; the barista " +
            "listening; a single espresso cup ready on the counter.",
        },
        {
          objectiveId: "with_milk",
          lineSL: "Z mlekom, prosim.",
          imagePrompt:
            "The barista pouring milk from a small jug into a cup of coffee at the café counter; cozy " +
            "and warm.",
        },
        {
          objectiveId: "pay_leave",
          lineSL: "Koliko stane? Hvala, nasvidenje.",
          imagePrompt:
            "A customer handing a few coins to the smiling barista across the café counter and waving " +
            "goodbye.",
        },
      ],
      sceneImagePrompt:
        "A lively café scene in Ljubljana showing the whole interaction at once: a customer greeting " +
        "the barista, a coffee with milk on the counter, coins being paid, and a friendly goodbye wave.",
    },
  },
};

// PLANNED scenarios (Feature 1 — choose-your-own-adventure). Declared, not yet implemented.
export const PLANNED_SCENARIOS: Scenario[] = [
  { id: "bakery", title: "At the bakery (pekarna)", status: "planned", character: "", setup: "", opening: "", objectives: [] },
  { id: "upravna_enota", title: "Registering at the upravna enota", status: "planned", character: "", setup: "", opening: "", objectives: [] },
  { id: "pharmacy", title: "At the pharmacy (lekarna)", status: "planned", character: "", setup: "", opening: "", objectives: [] },
];

export const SCENARIOS: Scenario[] = [CAFE, ...PLANNED_SCENARIOS];

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
