// Mic capture for the live tutor. Deliberately dumb: it accumulates the graph's 128-sample render
// quanta into one frame of the requested size and hands it to the main thread as Float32.
//
// It does NOT resample and does NOT convert to PCM16. Both are cheap, and doing them here would put
// format decisions inside an audio-thread callback where a mistake shows up as a glitch rather than an
// error. The frame size is passed in rather than hard-coded because it is derived from the context's
// real sample rate, which the browser — not us — decides.

class CaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.frameSize = options?.processorOptions?.frameSize || 1600;
    this.buf = new Float32Array(this.frameSize);
    this.filled = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true; // mic not yet delivering; keep the node alive

    for (let i = 0; i < channel.length; i++) {
      this.buf[this.filled++] = channel[i];
      if (this.filled === this.frameSize) {
        // Transfer, don't copy — the buffer is replaced rather than reused, so nothing is shared.
        const out = this.buf;
        this.buf = new Float32Array(this.frameSize);
        this.filled = 0;
        this.port.postMessage(out, [out.buffer]);
      }
    }
    return true;
  }
}

registerProcessor("live-capture", CaptureProcessor);
