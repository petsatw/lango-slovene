// The live-tutor seam. One interface, one implementation per vendor — the same shape the E2/E3/E4
// adapters already use, with one difference that drives everything else here: a live session is a
// long-lived BIDIRECTIONAL stream, not a request. So the adapter is constructed with callbacks and
// then pushed audio, rather than awaited for a result.
//
// The rest of the stack never sees vendor sample rates, vendor event names, or vendor errors. Audio
// crosses this boundary as PCM16 LE mono at fixed rates — 16 kHz in, 24 kHz out — and any resampling
// a vendor forces is the adapter's private problem.

export type LiveProvider = "gemini" | "grok";

/** What the app is told the session is doing. Deliberately coarse: the client draws a state, not a log. */
export type LiveState = "connected" | "listening" | "speaking" | "ended";

/** The only error vocabulary the app ever sees. Vendor error bodies stop at the adapter — they can
 *  carry account ids and quota detail, and the app has no use for either. */
export type LiveErrorCode = "vendor_connect" | "vendor_setup" | "vendor_audio" | "ended";

export interface LiveCallbacks {
  /** Tutor speech, PCM16 LE mono 24 kHz, forwarded to the app as a binary frame. */
  onAudio(pcm24k: Buffer): void;
  onTranscript(role: "user" | "tutor", text: string): void;
  onState(status: LiveState): void;
  onError(code: LiveErrorCode): void;
}

export interface LiveAdapter {
  readonly provider: LiveProvider;
  /** Open the vendor socket and configure it with the lesson prompt. Resolves once the vendor has
   *  acknowledged setup — audio sent before that is dropped by both vendors, so callers wait. */
  connect(sessionId: string, instructions: string): Promise<void>;
  /** Learner speech, PCM16 LE mono 16 kHz. Safe to call before connect resolves; buffered internally. */
  sendPcm16(bytes: Buffer): void;
  close(): void;
}
