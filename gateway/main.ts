import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { WebSocketServer } from "ws";
import { SpeechConnection } from "../src/lib/voice/gateway.js";
import { resolveReasoning } from "../src/lib/reasoning-config.mjs";
import {
  speechStorageRequest,
  SpeechStorageUnavailableError,
} from "../src/lib/voice/storage-retry.js";

for (const name of [
  "GNANI_SPEECH_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "APP_ORIGIN",
]) {
  if (!process.env[name]) throw new Error("GATEWAY_CONFIGURATION");
}
resolveReasoning(process.env);
const dataUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
if (
  dataUrl.protocol !== "https:" ||
  dataUrl.username ||
  dataUrl.password ||
  dataUrl.search ||
  dataUrl.hash
)
  throw new Error("GATEWAY_CONFIGURATION");
const port = Number(
  process.env.SPEECH_GATEWAY_PORT || process.env.PORT || 3015,
);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("GATEWAY_CONFIGURATION");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, init) =>
        fetch(url, {
          ...init,
          signal: AbortSignal.timeout(8000),
          redirect: "error",
        }),
    },
  },
);
const store = {
  async rpc(name: string, args: Record<string, unknown>) {
    const { data, error, status } = await speechStorageRequest(name, args, () =>
      db.schema("samvaad").rpc(name, args),
    );
    if (error) {
      const codes = new Set([
        "VALIDATION_ERROR",
        "EVIDENCE_CONFLICT",
        "EVIDENCE_IMMUTABLE",
        "EVIDENCE_EMPTY",
        "SESSION_NOT_ACTIVE",
        "SESSION_EXPIRED",
        "SESSION_NOT_FOUND",
        "CAPACITY_LIMIT",
      ]);
      const actions = new Set([
        "ready",
        "student",
        "assistant",
        "delivery",
        "heartbeat",
        "drain",
        "complete",
        "fail",
      ]);
      console.warn(
        JSON.stringify({
          event: "gateway_storage_rejected",
          operation: [
            "speech_event",
            "consume_speech_grant",
            "start_speech",
          ].includes(name)
            ? name
            : "unknown",
          action: actions.has(String(args.p_action)) ? args.p_action : null,
          code: codes.has(error.message)
            ? error.message
            : "DATABASE_UNAVAILABLE",
          sqlState: /^[A-Z0-9]{5,10}$/.test(error.code || "")
            ? error.code
            : null,
        }),
      );
      if ([0, 502, 503, 504].includes(status) && !codes.has(error.message))
        throw new SpeechStorageUnavailableError();
      throw new Error("GATEWAY_STORAGE_FAILED");
    }
    return data;
  },
};
const server = createServer((request, response) => {
  response.writeHead(request.url === "/health" ? 200 : 404, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(
    JSON.stringify({ status: request.url === "/health" ? "ok" : "not_found" }),
  );
});
const sockets = new WebSocketServer({
  noServer: true,
  maxPayload: 4096,
  perMessageDeflate: false,
});
const connections = new Set<SpeechConnection>();
server.on("upgrade", (request, socket, head) => {
  // Authentication still requires the expiring single-use grant; Origin is additional protection.
  if (
    request.url !== "/speech" ||
    request.headers.origin !== process.env.APP_ORIGIN ||
    sockets.clients.size >= 8
  ) {
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    return;
  }
  sockets.handleUpgrade(request, socket, head, (ws) => {
    // Keep both directions active through the host's WebSocket proxy while listening.
    const keepalive = setInterval(() => {
      if (ws.readyState === 1) ws.ping();
    }, 2000);
    ws.once("close", () => clearInterval(keepalive));
    const connection = new SpeechConnection(
      ws,
      store,
      process.env.GNANI_SPEECH_API_KEY!,
      (reason) =>
        console.warn(
          JSON.stringify({ event: "speech_run_failed", code: reason }),
        ),
    );
    connections.add(connection);
    ws.once("close", () => connections.delete(connection));
  });
});
server.headersTimeout = 5000;
server.listen(port, process.env.SPEECH_GATEWAY_HOST || "127.0.0.1", () =>
  console.log(JSON.stringify({ event: "speech_gateway_listening", port })),
);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    for (const connection of connections) void connection.fail();
    server.close();
    setTimeout(() => process.exit(0), 3000).unref();
  });
