type Result<T, E> = { data: T; error: E; status: number };

/** Transport failure after the bounded RPC retry; never a semantic database rejection. */
export class SpeechStorageUnavailableError extends Error {
  constructor() {
    super("GATEWAY_STORAGE_FAILED");
    this.name = "SpeechStorageUnavailableError";
  }
}

/** Only operations with database-enforced exact replay may survive an uncertain response. */
export async function speechStorageRequest<T, E>(
  name: string,
  args: Record<string, unknown>,
  request: () => PromiseLike<Result<T, E>>,
) {
  const replayable =
    name === "speech_event" &&
    ["student", "delivery", "heartbeat"].includes(String(args.p_action));
  let result = await request();
  if (
    replayable &&
    result.error &&
    [0, 502, 503, 504].includes(result.status)
  ) {
    result = await request();
  }
  return result;
}
