// E2 adapter — Google Gemini (native audio input + in-character tutoring).
// Clip-based (push-to-talk) via generateContent. Key is sent as a header, never in the URL.
// NOTE: verify GEMINI_MODEL against current docs; it is env-configurable so a swap is a config change.

import type {
  ConversationTurn,
  E2Adapter,
  E2Result,
  LiveTargetReading,
  WitnessResult,
  WitnessTarget,
} from "../types";

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function requireKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set (see docs/SECRETS.md)");
  return key;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    user_verbatim: { type: "STRING" },
    user_said: { type: "STRING" },
    reply_sl: { type: "STRING" },
    correction: { type: "STRING" },
    objective_progress: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          result: { type: "STRING" },
        },
        required: ["id", "result"],
      },
    },
    learnable_progress: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          result: { type: "STRING" },
        },
        required: ["id", "result"],
      },
    },
    focus_objective_id: { type: "STRING" },
  },
  required: [
    "user_verbatim",
    "user_said",
    "reply_sl",
    "correction",
    "objective_progress",
    "learnable_progress",
    "focus_objective_id",
  ],
};

// Free-conversation WITNESS schema (the model↔server handoff): the model reports linguistic evidence
// over a server-supplied target set and decides NO credit. `said`/`said_lang` may be empty when a
// target wasn't produced (Gemini schemas don't express null cleanly → "" means "not produced").
const WITNESS_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING" },
    reply_gloss: { type: "STRING" },
    transcript_verbatim: { type: "STRING" },
    user_gloss: { type: "STRING" },
    utterance_lang: { type: "STRING" },
    targets: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          produced: { type: "BOOLEAN" },
          said: { type: "STRING" },
          said_lang: { type: "STRING" },
          correct: { type: "BOOLEAN" },
          confidence: { type: "NUMBER" },
        },
        required: ["id", "produced", "correct"],
      },
    },
    observed: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { surface: { type: "STRING" }, gloss: { type: "STRING" } },
        required: ["surface"],
      },
    },
    // "" = plain tutor (Gemini schemas don't express null cleanly, same convention as said/said_lang).
    role: { type: "STRING" },
  },
  required: ["reply", "transcript_verbatim", "utterance_lang", "targets", "observed"],
};

// The live GRADER schema — one row per target, facts only. The learner line is named by NUMBER rather
// than quoted, so the server resolves it against the transcript it supplied and a reading can only point
// at a line that was really there.
const GRADE_SCHEMA = {
  type: "OBJECT",
  properties: {
    targets: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          uptake: { type: "BOOLEAN" },
          correct: { type: "BOOLEAN" },
          recast: { type: "BOOLEAN" },
          said_line: { type: "INTEGER" },
          said_lang: { type: "STRING" },
        },
        required: ["id", "uptake", "correct", "recast", "said_line", "said_lang"],
      },
    },
  },
  required: ["targets"],
};

// The grader is NOT the tutor. It is told so in its first line, because the same model in its teaching
// persona is built to accept imperfect input warmly — which is rapport, not marking.
const GRADE_INSTRUCTION = [
  "You are reading the transcript of a finished beginner Slovene lesson and reporting what happened.",
  "You are not the tutor, you are not teaching, and you decide no scores — something else does that.",
  "",
  "Every line is numbered. LEARNER lines are speech-to-text and are OFTEN WRONG about Slovene: a word",
  "the learner said clearly can arrive as an unrelated English one. TUTOR lines are what the tutor",
  "actually said back, and the tutor heard the AUDIO rather than this transcript — so a tutor line that",
  "answers a phrase is evidence the phrase was said even when the learner's own line does not show it.",
  "",
  "For each target phrase you are given, report:",
  "  said_line — the number of the ONE LEARNER line this phrase rests on. 0 if no learner line does.",
  "  uptake    — did the TUTOR LINE IMMEDIATELY AFTER said_line reply as though the learner had just",
  "              produced this phrase (greeted back, served what was ordered, answered the question)?",
  "              A tutor opening, greeting or introducing itself is not a reply to anything: uptake is",
  "              the tutor RESPONDING to that learner line, and it is false when said_line is 0.",
  "  correct   — reading both that learner line and the tutor's reply, was the learner's form correct",
  "              Slovene for this phrase? Any case, gender or number that works is correct.",
  "  recast    — did the tutor say the phrase back in a corrected form?",
  "  said_lang — the language the WORDS of that line are in: sl, en or other. A line written in English",
  "              words is en even when it means exactly what the Slovene target means.",
  "",
  "Report a row for EVERY target. A target that never came up gets false, false, false, 0, \"other\".",
].join("\n");

/** Trim a provider error body so we never echo anything sensitive and keep logs short. */
function shortError(status: number, body: string): Error {
  return new Error(`Gemini HTTP ${status}: ${body.slice(0, 300)}`);
}

export class GeminiE2 implements E2Adapter {
  readonly name = "gemini";
  private model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  async understand(input: {
    audioBase64: string;
    mimeType: string;
    systemPrompt: string;
    history: ConversationTurn[];
  }): Promise<E2Result> {
    const key = requireKey();

    const contents = [
      ...input.history.map((t) => ({
        role: t.role === "tutor" ? "model" : "user",
        parts: [{ text: t.text }],
      })),
      {
        role: "user",
        parts: [{ inlineData: { mimeType: input.mimeType, data: input.audioBase64 } }],
      },
    ];

    const res = await fetch(`${BASE}/${this.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.systemPrompt }] },
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          temperature: 0.6,
        },
      }),
    });

    if (!res.ok) throw shortError(res.status, await res.text());

    const data: any = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no text candidate");

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
    }

    const progress = Array.isArray(parsed.objective_progress) ? parsed.objective_progress : [];
    const objectiveProgress = progress
      .map((p: any) => ({ id: String(p?.id ?? ""), result: p?.result === "completed" ? "completed" : "attempted" }))
      .filter((p: any) => p.id) as E2Result["objectiveProgress"];

    const learnable = Array.isArray(parsed.learnable_progress) ? parsed.learnable_progress : [];
    const learnableProgress = learnable
      .map((p: any) => ({ id: String(p?.id ?? ""), result: p?.result === "success" ? "success" : "attempt" }))
      .filter((p: any) => p.id) as E2Result["learnableProgress"];

    return {
      userVerbatim: String(parsed.user_verbatim ?? ""),
      userSaid: String(parsed.user_said ?? ""),
      tutorReply: String(parsed.reply_sl ?? ""),
      correction: String(parsed.correction ?? ""),
      objectiveProgress,
      learnableProgress,
      focusObjectiveId: String(parsed.focus_objective_id ?? ""),
    };
  }

  async witness(input: {
    audioBase64: string;
    mimeType: string;
    systemPrompt: string;
    history: ConversationTurn[];
  }): Promise<WitnessResult> {
    const key = requireKey();

    const contents = [
      ...input.history.map((t) => ({
        role: t.role === "tutor" ? "model" : "user",
        parts: [{ text: t.text }],
      })),
      {
        role: "user",
        parts: [{ inlineData: { mimeType: input.mimeType, data: input.audioBase64 } }],
      },
    ];

    const res = await fetch(`${BASE}/${this.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: input.systemPrompt }] },
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: WITNESS_SCHEMA,
          temperature: 0.6,
        },
      }),
    });

    if (!res.ok) throw shortError(res.status, await res.text());

    const data: any = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no text candidate");

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
    }

    const targets = Array.isArray(parsed.targets) ? parsed.targets : [];
    const observed = Array.isArray(parsed.observed) ? parsed.observed : [];
    const blank = (s: any) => (typeof s === "string" && s.trim() ? s : null);

    return {
      reply: String(parsed.reply ?? ""),
      replyGloss: String(parsed.reply_gloss ?? ""),
      transcriptVerbatim: String(parsed.transcript_verbatim ?? ""),
      userGloss: String(parsed.user_gloss ?? ""),
      utteranceLang: String(parsed.utterance_lang ?? ""),
      targets: targets
        .map((t: any) => ({
          id: String(t?.id ?? ""),
          produced: t?.produced === true,
          said: blank(t?.said),
          saidLang: blank(t?.said_lang),
          correct: t?.correct === true,
          confidence: typeof t?.confidence === "number" ? t.confidence : 0,
        }))
        .filter((t: any) => t.id),
      observed: observed
        .map((o: any) => ({ surface: String(o?.surface ?? ""), gloss: String(o?.gloss ?? "") }))
        .filter((o: any) => o.surface),
      role: blank(parsed.role),
    };
  }

  // Text in, JSON out, once per finished live session — off the hot path by construction, because the
  // session it reads is already over. The transcript is rendered with plain role labels: the model has
  // to see who spoke each line, since the whole two-channel reading turns on the alternation.
  async grade(input: {
    transcript: ConversationTurn[];
    targets: WitnessTarget[];
  }): Promise<LiveTargetReading[]> {
    const key = requireKey();
    const conversation = input.transcript
      .map((t, i) => `${i + 1}. ${t.role === "tutor" ? "TUTOR" : "LEARNER"}: ${t.text}`)
      .join("\n");
    const targets = input.targets
      .map((t) => `- ${t.id} — «${t.sl}» (${t.kind}) = ${t.gloss}`)
      .join("\n");

    const res = await fetch(`${BASE}/${this.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: GRADE_INSTRUCTION }] },
        contents: [
          { role: "user", parts: [{ text: `TARGET PHRASES:\n${targets}\n\nTRANSCRIPT:\n${conversation}` }] },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GRADE_SCHEMA,
          temperature: 0,
        },
      }),
    });
    if (!res.ok) throw shortError(res.status, await res.text());

    const data: any = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no text candidate");

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`Gemini returned non-JSON: ${text.slice(0, 200)}`);
    }

    const rows = Array.isArray(parsed.targets) ? parsed.targets : [];
    return rows
      .map((r: any) => ({
        id: String(r?.id ?? ""),
        uptake: r?.uptake === true,
        correct: r?.correct === true,
        recast: r?.recast === true,
        saidLine: Number.isInteger(r?.said_line) ? r.said_line : 0,
        saidLang: String(r?.said_lang ?? ""),
      }))
      .filter((r: LiveTargetReading) => r.id);
  }

  // Text in, text out — the cheapest call this adapter makes. Deliberately unconstrained by the
  // learner model: the learner is asking what a line MEANS, and answering only for catalog words
  // would leave exactly the unfamiliar ones blank.
  async gloss(sl: string): Promise<string> {
    const key = requireKey();
    const res = await fetch(`${BASE}/${this.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "Translate the Slovene into short, plain English. Reply with the translation ALONE — " +
                "no quotes, no notes, no grammar, no alternatives. Keep a question a question.",
            },
          ],
        },
        contents: [{ role: "user", parts: [{ text: sl }] }],
        // A thinking model spends maxOutputTokens on reasoning BEFORE it answers, so a tight cap
        // truncates the translation rather than shortening it ("One coffee, right"). Translating one
        // sentence needs no reasoning at all: switch thinking off and leave real headroom.
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 512,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!res.ok) throw shortError(res.status, await res.text());
    const data: any = await res.json();
    return String(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  }

  async ping(): Promise<string> {
    const key = requireKey();
    const res = await fetch(`${BASE}/${this.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with the single word: OK" }] }],
      }),
    });
    if (!res.ok) throw shortError(res.status, await res.text());
    const data: any = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "(empty)";
  }
}
