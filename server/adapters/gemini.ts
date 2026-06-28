// E2 adapter — Google Gemini (native audio input + in-character tutoring).
// Clip-based (push-to-talk) via generateContent. Key is sent as a header, never in the URL.
// NOTE: verify GEMINI_MODEL against current docs; it is env-configurable so a swap is a config change.

import type { ConversationTurn, E2Adapter, E2Result } from "../types";

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
