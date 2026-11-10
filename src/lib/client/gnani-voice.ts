"use client";
import { productRequest } from "./product-api";
import { ApiError } from "./api";
import {
  speechGrantSchema,
  serverControlSchema,
  SPEECH_PROTOCOL,
  type Actor,
} from "../voice/protocol";

type Events = {
  "call-start": { deadline: string; remainingMilliseconds: number };
  "call-end": { reason: string };
  "volume-level": number;
  state: { state: "listening" | "thinking" | "speaking"; actor: Actor };
  error: { code: string };
};
// Allow four seconds of upload jitter without retaining an unbounded microphone queue.
const maxBufferedAudioBytes = 128 * 1024;
// This is Samvaad's owned protocol, not Gnani Agent Builder's browser hook.
export const voiceSessionSchema = speechGrantSchema;
export class GnaniVoice {
  private listeners: { [K in keyof Events]?: (value: Events[K]) => void } = {};
  private audio: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private socket: WebSocket | null = null;
  private worklet: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private output: GainNode | null = null;
  private playing = new Set<AudioBufferSourceNode>();
  private nextAudio = 0;
  private generation = 0;
  private audioGeneration = 0;
  private state = "idle";
  private muted = false;
  private outputMuted = false;
  private abort: AbortController | null = null;
  private endWaiter: (() => void) | null = null;
  private flushWaiter: (() => void) | null = null;
  private keepalive: ReturnType<typeof setInterval> | null = null;
  constructor(private options: { sessionUrl: string; debug?: boolean }) {}
  on<K extends keyof Events>(name: K, listener: (value: Events[K]) => void) {
    this.listeners[name] = listener as (typeof this.listeners)[K];
  }
  private emit<K extends keyof Events>(name: K, value: Events[K]) {
    this.listeners[name]?.(value);
  }
  getState() {
    return this.state;
  }
  setMuted(value: boolean) {
    this.muted = value;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !value;
    });
  }
  setOutputMuted(value: boolean) {
    this.outputMuted = value;
    if (this.output) this.output.gain.value = value ? 0 : 1;
  }
  private send(value: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(value));
  }
  private prepareCapture(audio: AudioContext, media: MediaStream) {
    this.source = audio.createMediaStreamSource(media);
    this.worklet = new AudioWorkletNode(audio, "gnani-capture");
    this.worklet.port.onmessage = ({
      data,
    }: MessageEvent<Uint8Array | { type: string }>) => {
      if (data instanceof Uint8Array) {
        // Drain capture during connection warmup, but transmit only the active round.
        if (this.state !== "active" && this.state !== "ending") return;
        const socket = this.socket;
        if (
          socket?.readyState !== WebSocket.OPEN ||
          socket.bufferedAmount > maxBufferedAudioBytes
        ) {
          this.fail();
          return;
        }
        socket.send(this.muted ? new Uint8Array(1024) : data);
      } else if (data.type === "flushed") this.flushWaiter?.();
    };
    this.source.connect(this.worklet);
    this.worklet.connect(audio.destination);
  }
  async start() {
    if (this.state !== "idle") throw new Error("Already attempted");
    this.state = "connecting";
    const run = ++this.generation;
    this.abort = new AbortController();
    this.audio = new AudioContext({ sampleRate: 16000 });
    const audio = this.audio;
    try {
      await audio.resume();
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
      if (run !== this.generation) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = media;
      this.setMuted(this.muted);
      await audio.audioWorklet.addModule("/audio/gnani-capture.js");
      if (run !== this.generation) return;
      this.prepareCapture(audio, media);
      const warmupDeadline = performance.now() + 90000;
      const getGrant = async (): Promise<
        ReturnType<typeof speechGrantSchema.parse>
      > => {
        try {
          return await productRequest(
            this.options.sessionUrl,
            speechGrantSchema,
            { body: {}, signal: this.abort!.signal },
          );
        } catch (error) {
          // This explicit response guarantees no reservation was made. Never retry an uncertain mint.
          if (
            !(error instanceof ApiError) ||
            error.code !== "VOICE_WARMING" ||
            performance.now() >= warmupDeadline ||
            this.abort!.signal.aborted
          )
            throw error;
          await new Promise<void>((resolve, reject) => {
            const signal = this.abort!.signal;
            const cancelled = () => {
              clearTimeout(timer);
              reject(new Error("Cancelled"));
            };
            const timer = setTimeout(() => {
              signal.removeEventListener("abort", cancelled);
              resolve();
            }, 3000);
            signal.addEventListener("abort", cancelled, { once: true });
          });
          return getGrant();
        }
      };
      const grant = await getGrant();
      if (run !== this.generation) return;
      // Grant expiry is enforced by the database, not the browser's wall clock.
      this.output = audio.createGain();
      this.output.connect(audio.destination);
      this.setOutputMuted(this.outputMuted);
      const socket = new WebSocket(grant.websocketUrl);
      this.socket = socket;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          socket.close();
          reject(new Error("Connection timeout"));
        }, 20000);
        socket.onopen = () => {
          if (run !== this.generation) {
            clearTimeout(timer);
            socket.close();
            resolve();
            return;
          }
          this.send({
            type: "authenticate",
            grant: grant.grant,
            protocol: SPEECH_PROTOCOL,
          });
        };
        socket.onmessage = (event) => {
          if (run !== this.generation || this.state === "ended") return;
          try {
            if (typeof event.data !== "string" || event.data.length > 300000)
              throw new Error();
            const message = serverControlSchema.parse(JSON.parse(event.data));
            if (message.type === "ready") {
              if (this.state !== "connecting" || message.runId !== grant.runId)
                throw new Error();
              clearTimeout(timer);
              this.state = "active";
              // Keep bidirectional traffic through hosted WebSocket proxies during listening.
              this.keepalive = setInterval(() => {
                if (this.state !== "active") return;
                try {
                  this.send({ type: "ping" });
                } catch {
                  this.fail();
                }
              }, 2000);
              this.emit("call-start", {
                deadline: message.deadline,
                remainingMilliseconds: message.remainingMilliseconds,
              });
              resolve();
            } else if (message.type === "clear") {
              this.audioGeneration = message.generation;
              this.clearPlayback();
            } else if (message.type === "audio") {
              if (message.generation < this.audioGeneration) return;
              this.audioGeneration = message.generation;
              this.play(message.pcm);
            } else if (message.type === "state") this.emit("state", message);
            else if (message.type === "ended") {
              this.state = "ended";
              this.endWaiter?.();
              void this.cleanup();
              this.emit("call-end", { reason: "completed" });
            } else if (message.type === "error") {
              clearTimeout(timer);
              reject(new Error("Voice failed"));
              this.fail();
            }
          } catch {
            clearTimeout(timer);
            reject(new Error("Invalid voice event"));
            this.fail();
          }
        };
        socket.onerror = () => {
          clearTimeout(timer);
          reject(new Error("Voice unavailable"));
          this.fail();
        };
        socket.onclose = () => {
          clearTimeout(timer);
          if (this.state === "ended" || run !== this.generation) {
            resolve();
            return;
          }
          reject(new Error("Voice closed"));
          this.fail();
        };
      });
    } catch (cause) {
      if (run !== this.generation) return;
      this.fail(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "microphone_denied"
          : "connect_failed",
      );
      throw new Error("Voice connection failed");
    }
  }
  private fail(code = "connect_failed") {
    if (this.state === "ended") return;
    this.state = "ended";
    this.endWaiter?.();
    void this.cleanup();
    this.emit("error", { code });
  }
  private clearPlayback() {
    for (const source of this.playing) {
      source.onended = null;
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    this.playing.clear();
    this.nextAudio = 0;
    this.emit("volume-level", 0);
  }
  private play(encoded: string) {
    if (!this.audio || !this.output || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
      throw new Error("Invalid audio");
    const pcm = atob(encoded);
    if (
      !pcm.length ||
      pcm.length % 2 ||
      this.nextAudio - this.audio.currentTime > 25
    )
      throw new Error("Audio backlog");
    const buffer = this.audio.createBuffer(1, pcm.length / 2, 16000);
    const samples = buffer.getChannelData(0);
    let power = 0;
    for (let i = 0; i < samples.length; i++) {
      let value = pcm.charCodeAt(i * 2) | (pcm.charCodeAt(i * 2 + 1) << 8);
      if (value >= 32768) value -= 65536;
      samples[i] = value / 32768;
      power += samples[i] ** 2;
    }
    const source = this.audio.createBufferSource();
    source.buffer = buffer;
    source.connect(this.output);
    this.playing.add(source);
    source.onended = () => {
      this.playing.delete(source);
      source.disconnect();
      if (!this.playing.size) this.emit("volume-level", 0);
    };
    source.start(Math.max(this.audio.currentTime + 0.02, this.nextAudio));
    this.nextAudio =
      Math.max(this.audio.currentTime + 0.02, this.nextAudio) + buffer.duration;
    this.emit(
      "volume-level",
      Math.min(1, Math.sqrt(power / Math.max(1, samples.length)) * 4),
    );
  }
  async stop() {
    if (this.state === "active") {
      this.state = "ending";
      if (this.worklet)
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 250);
          this.flushWaiter = () => {
            clearTimeout(timer);
            resolve();
          };
          this.worklet!.port.postMessage({ type: "flush" });
        });
      this.worklet?.disconnect();
      this.source?.disconnect();
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = null;
      this.clearPlayback();
      await new Promise<void>((resolve) => {
        // Leave time for the bounded hosted queue, provider finals and durable writes.
        const timer = setTimeout(resolve, 45000);
        this.endWaiter = () => {
          clearTimeout(timer);
          resolve();
        };
        this.send({ type: "end" });
      });
    }
    this.state = "ended";
    ++this.generation;
    await this.cleanup();
  }
  private async cleanup() {
    if (this.keepalive) clearInterval(this.keepalive);
    this.keepalive = null;
    this.abort?.abort();
    this.clearPlayback();
    this.socket?.close();
    this.socket = null;
    this.worklet?.disconnect();
    this.worklet = null;
    this.source?.disconnect();
    this.source = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    const audio = this.audio;
    this.audio = null;
    if (audio && audio.state !== "closed") await audio.close().catch(() => {});
  }
}
