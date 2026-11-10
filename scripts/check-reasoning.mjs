import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolveReasoning } from "../src/lib/reasoning-config.mjs";

// --live lists model availability only. It never sends a prompt or transcript.
export async function checkReasoning(env, live = false) {
  const config = resolveReasoning(env);
  const report = {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    credentialConfigured: true,
    catalogChecked: false,
    modelAvailable: false,
    inferenceVerified: false,
    freeQuotaVerified: false,
  };
  if (!live) return report;
  const response = await fetch(config.baseUrl + "/models", {
    headers: { Authorization: `Bearer ${config.apiKey}` },
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`PROVIDER_HTTP_${response.status}`);
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body ?? []) {
    bytes += chunk.byteLength;
    if (bytes > 262144) throw new Error("INVALID_MODEL_CATALOG");
    chunks.push(chunk);
  }
  const catalog = JSON.parse(Buffer.concat(chunks).toString());
  if (!Array.isArray(catalog.data)) throw new Error("INVALID_MODEL_CATALOG");
  return {
    ...report,
    catalogChecked: true,
    modelAvailable: catalog.data.some(
      (item) =>
        item?.id === config.model || item?.id === `models/${config.model}`,
    ),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (existsSync(".env.local")) process.loadEnvFile(".env.local");
    if (process.argv.slice(2).some((arg) => arg !== "--live"))
      throw new Error("INVALID_ARGUMENT");
    const result = await checkReasoning(
      process.env,
      process.argv.includes("--live"),
    );
    console.log(JSON.stringify(result, null, 2));
    console.log(
      "No prompt, transcript or inference request sent. Catalog access does not verify free quota, billing status, JSON quality or latency.",
    );
    process.exitCode = result.catalogChecked && !result.modelAvailable ? 1 : 0;
  } catch (error) {
    const code =
      error instanceof Error &&
      /^(CONFIGURATION|INVALID_ARGUMENT|INVALID_MODEL_CATALOG|PROVIDER_HTTP_\d{3})$/.test(
        error.message,
      )
        ? error.message
        : "REASONING_CHECK_FAILED";
    console.error(JSON.stringify({ code }));
    process.exitCode = 1;
  }
}
