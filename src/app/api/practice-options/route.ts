import { authConfigured } from "@/lib/server/config";
import { endpoint, fail, user, response } from "@/lib/server/http";
import { practiceOptions } from "@/lib/server/practice-options";

export const runtime = "nodejs";
export const GET = () =>
  endpoint(async () => {
    if (!authConfigured()) fail("SERVICE_UNAVAILABLE", 503);
    const owner = await user();
    return response(await practiceOptions(owner.id));
  });
