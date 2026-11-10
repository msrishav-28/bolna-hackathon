import "server-only";
/** Wake only the configured owned gateway before any quota/grant is reserved. */
export async function gatewayReady(websocketUrl: string) {
  const url = new URL(websocketUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = "/health";
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return false;
    }
    const reader = response.body?.getReader();
    if (!reader) return false;
    let size = 0;
    const parts: Uint8Array[] = [];
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 1024) {
        await reader.cancel();
        return false;
      }
      parts.push(part.value);
    }
    return JSON.parse(Buffer.concat(parts).toString()).status === "ok";
  } catch {
    return false;
  }
}
