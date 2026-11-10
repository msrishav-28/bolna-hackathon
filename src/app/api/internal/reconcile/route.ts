import { endpoint, fail, response } from "@/lib/server/http";
import { required } from "@/lib/server/config";
import { secretMatches } from "@/lib/server/secrets";
import { recoverDueSessions } from "@/lib/server/workflow";
export const runtime = "nodejs";
export const maxDuration = 120;
export const GET = (request: Request) =>
  endpoint(async () => {
    const secret = required("CRON_SECRET");
    if (secret.length < 32) throw new Error("CONFIGURATION");
    if (
      !secretMatches(request.headers.get("Authorization"), `Bearer ${secret}`)
    )
      fail("FORBIDDEN", 403);
    return response(await recoverDueSessions());
  });
