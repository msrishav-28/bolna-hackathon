"use client";
import { z } from "zod";
import { ApiError } from "./api";

export async function productRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: { body?: unknown; key?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(15000);
  const signal = options.signal
    ? AbortSignal.any([timeout, options.signal])
    : timeout;
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.body === undefined ? "GET" : "POST",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      "We couldn’t reach the service. Check your connection and try again.",
      "NETWORK",
    );
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new ApiError(
      "The service returned an unreadable response. Please try again.",
      "INVALID_RESPONSE",
    );
  }
  if (!response.ok) {
    const parsed = z
      .object({
        error: z.object({
          code: z.string(),
          message: z.string(),
          retryable: z.boolean().optional(),
        }),
      })
      .safeParse(value);
    throw new ApiError(
      parsed.success
        ? parsed.data.error.message
        : "This service is temporarily unavailable. Try again shortly.",
      parsed.success ? parsed.data.error.code : "UNAVAILABLE",
      response.status,
      parsed.success ? parsed.data.error.retryable : undefined,
    );
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ApiError(
      "We couldn’t load a complete result. Please try again.",
      "INVALID_RESPONSE",
    );
  return parsed.data;
}
