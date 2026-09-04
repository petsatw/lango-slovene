// Provider selection, in one place. Same pattern as server/adapters/index.ts: the core names a slot,
// an env var names the implementation, and nothing above this line knows which vendor answered.

import type { LiveAdapter, LiveCallbacks, LiveProvider } from "../types";
import { GeminiAdapter } from "./gemini";
import { GrokAdapter } from "./grok";

export function getLiveAdapter(provider: LiveProvider, cb: LiveCallbacks): LiveAdapter {
  return provider === "grok" ? new GrokAdapter(cb) : new GeminiAdapter(cb);
}

/** Whether a provider has the credential it needs — so the create call can refuse cleanly instead of
 *  handing the app a socket that dies on open. */
export function providerReady(provider: LiveProvider): boolean {
  return provider === "grok"
    ? !!(process.env.XAI_API_KEY || process.env.GROK_API_KEY)
    : !!process.env.GEMINI_API_KEY;
}
