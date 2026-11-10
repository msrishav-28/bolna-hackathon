import { content } from "@/lib/content";

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status?: number,
    public retryable?: boolean,
  ) {
    super(message);
  }
}
export async function request<T = Record<string, unknown>>(
  url: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const r = await fetch(url, {
    method: body === undefined ? "GET" : method,
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  let data;
  try {
    data = await r.json();
  } catch {
    throw new ApiError(content.auth.responseError, "INVALID_RESPONSE");
  }
  if (!r.ok)
    throw new ApiError(
      data.error?.message ?? content.auth.responseError,
      data.error?.code ?? "NETWORK",
    );
  return data;
}
export const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : content.auth.networkError;
