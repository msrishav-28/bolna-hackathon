import "server-only";
import { AppError } from "./http";

// Never include upstream bodies, URLs, credentials or transcripts in thrown errors.
export async function providerJson(
  url: string,
  init: RequestInit,
  code: string,
  timeout = 10000,
  max = 256000,
): Promise<unknown> {
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) {
      console.warn(
        JSON.stringify({
          event: "provider_request_rejected",
          status: response.status,
          operation: code === "SCORING_FAILED" ? "scoring" : "provider",
        }),
      );
      throw new AppError(
        code,
        code === "GNANI_ERROR" && response.status === 429 ? 429 : 502,
        response.status === 429 ||
          response.status >= 500 ||
          response.status === 404,
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new AppError(code, 502);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > max) {
        await reader.cancel();
        throw new AppError(code, 502);
      }
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(code, 502, true);
  }
}
