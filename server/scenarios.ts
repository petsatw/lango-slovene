// Scenario + objective data. The active café scenario drives the MVP mastery loop.
// Planned scenarios and the visual `scene` field are stubbed (see docs/ARCHITECTURE.md › Planned).

import type { Objective, SessionState } from "./types";

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
  /** PLANNED (Feature 2 — visual story panels). Stubbed, not rendered in the MVP. */
  scene?: {
    image?: string; // backdrop asset
    story?: string[]; // ≤5 short simple-Slovenian sentences, one per story panel
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
  // PLANNED visual layer — content sketch only; not rendered yet.
  scene: {
    image: undefined,
    story: [
      "Vstopiš v majhno kavarno v Ljubljani.",
      "Za pultom te prijazno pozdravi natakar.",
      "Naročiš kavo z mlekom.",
      "Vprašaš, koliko stane.",
      "Plačaš in se posloviš.",
    ],
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
