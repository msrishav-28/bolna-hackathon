import { response } from "@/lib/server/http";
export function GET() {
  // Liveness only. No provider calls, paid requests or configuration values.
  return response({ status: "ok", time: new Date().toISOString() });
}
