// Memory-only microphone framing. The output is silent; no local echo or recording.
class GnaniCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frame = new Uint8Array(1024);
    this.view = new DataView(this.frame.buffer);
    this.offset = 0;
    this.phase = 0;
    this.sum = 0;
    this.count = 0;
    this.flushed = false;
    this.port.onmessage = ({ data }) => {
      if (data?.type !== "flush" || this.flushed) return;
      this.flushed = true;
      if (this.offset) this.port.postMessage(this.frame);
      this.port.postMessage({ type: "flushed" });
    };
  }
  process(inputs) {
    if (this.flushed) return true;
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    // Averaging downsampler: preserve a continuous phase across render quanta.
    // The browser's actual AudioContext rate is used, never relabelled as 16kHz.
    for (const value of channel) {
      this.sum += value;
      this.count++;
      this.phase += 16000;
      if (this.phase >= sampleRate) {
        this.phase -= sampleRate;
        const sample = Math.max(-1, Math.min(1, this.sum / this.count));
        this.view.setInt16(
          this.offset * 2,
          Math.round(sample * (sample < 0 ? 32768 : 32767)),
          true,
        );
        this.sum = 0;
        this.count = 0;
        if (++this.offset === 512) {
          this.port.postMessage(this.frame);
          this.frame = new Uint8Array(1024);
          this.view = new DataView(this.frame.buffer);
          this.offset = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("gnani-capture", GnaniCapture);
