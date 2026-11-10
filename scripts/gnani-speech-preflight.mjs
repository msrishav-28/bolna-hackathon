// Isolated synthetic REST probe. Audio stays in memory; no product sessions change.
import { pathToFileURL } from "node:url";

const PHRASE = "This is a synthetic Samvaad speech connection test.";
const BASE = "https://api.vachana.ai";
const MAX_BYTES = 2 * 1024 * 1024;

export async function boundedBody(response, maxBytes = MAX_BYTES) {
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of response.body ?? []) {
      size += chunk.byteLength;
      if (size > maxBytes) throw new Error("RESPONSE_TOO_LARGE");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch {
    throw new Error("RESPONSE_INVALID");
  }
}

async function request(path, options) {
  const response = await fetch(BASE + path, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`PROVIDER_HTTP_${response.status}`);
  }
  return response;
}

export async function probe(key) {
  if (!key?.trim()) throw new Error("MISSING_SPEECH_KEY");
  const started = Date.now();
  const synthesis = await request("/api/v1/tts/inference", {
    method: "POST",
    headers: { "X-API-Key-ID": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: PHRASE,
      model: "timbre-v3.0",
      voice: "Shivani",
      language: "en-IN",
      speed: 1,
      audio_config: {
        sample_rate: 16000,
        num_channels: 1,
        sample_width: 2,
        encoding: "linear_pcm",
        container: "wav",
      },
    }),
  });
  const audio = await boundedBody(synthesis);
  if (
    audio.length < 44 ||
    audio.toString("ascii", 0, 4) !== "RIFF" ||
    audio.toString("ascii", 8, 12) !== "WAVE"
  )
    throw new Error("INVALID_SYNTHESIS_AUDIO");
  const form = new FormData();
  form.append(
    "audio_file",
    new Blob([audio], { type: "audio/wav" }),
    "probe.wav",
  );
  form.append("model", "prisma-v3.0");
  form.append("language_code", "en-IN");
  form.append("format", "verbatim");
  const recognition = await request("/stt/v3", {
    method: "POST",
    headers: { "X-API-Key-ID": key },
    body: form,
  });
  const result = JSON.parse((await boundedBody(recognition, 32000)).toString());
  if (
    result.success !== true ||
    result.model !== "prisma-v3.0" ||
    result.truncated === true ||
    typeof result.transcript !== "string" ||
    !result.transcript.trim()
  )
    throw new Error("INVALID_RECOGNITION_RESULT");
  // Return only safe metrics. Do not return or log the transcript/provider body.
  return {
    test: "synthetic-rest-roundtrip",
    checkedAt: new Date().toISOString(),
    audioBytes: audio.length,
    elapsedMs: Date.now() - started,
    nonemptyTranscript: true,
    phraseRecognized: /synthetic/i.test(result.transcript),
    realtimeVerified: false,
    browserVerified: false,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.length !== 3 || process.argv[2] !== "--live") {
    console.log(
      "Opt-in synthetic probe: node --env-file=.env.local scripts/gnani-speech-preflight.mjs --live\nRequires server-only GNANI_SPEECH_API_KEY. Makes one TTS and one STT request, consuming credits. Keeps audio in memory and prints no transcript. Does not verify realtime/browser audio.",
    );
  } else {
    try {
      console.log(
        JSON.stringify(await probe(process.env.GNANI_SPEECH_API_KEY)),
      );
    } catch (error) {
      const known = new Set([
        "MISSING_SPEECH_KEY",
        "RESPONSE_INVALID",
        "INVALID_SYNTHESIS_AUDIO",
        "INVALID_RECOGNITION_RESULT",
      ]);
      const code =
        error instanceof Error &&
        (known.has(error.message) ||
          /^PROVIDER_HTTP_\d{3}$/.test(error.message))
          ? error.message
          : "SPEECH_PROBE_FAILED";
      console.error(JSON.stringify({ test: "synthetic-rest-roundtrip", code }));
      process.exitCode = 1;
    }
  }
}
