// Shared by server-only callers and local CLI checks. Never import into client UI.
// Official provider defaults rechecked 9 November 2026; no automatic fallback.
export const REASONING_PROFILES = Object.freeze({
  gemini: Object.freeze({
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.8-flash",
    label: "Google Gemini",
    keyName: "GEMINI_API_KEY",
    modelName: "GEMINI_MODEL",
  }),
  groq: Object.freeze({
    baseUrl: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-120b",
    label: "Groq",
    keyName: "GROQ_API_KEY",
    modelName: "GROQ_MODEL",
  }),
});

/** @param {Record<string, string | undefined>} env */
export function reasoningProfile(env) {
  // Preserve fully manual integrations; partial manual config must fail closed too.
  const provider =
    env.REASONING_PROVIDER ||
    (env.REASONING_BASE_URL || env.REASONING_MODEL ? "custom" : "gemini");
  if (provider === "gemini" || provider === "groq") {
    const profile = REASONING_PROFILES[provider];
    const model = env[profile.modelName] || profile.model;
    if (!model.trim() || model !== model.trim() || /[\r\n]/.test(model))
      throw new Error("CONFIGURATION");
    return { ...profile, provider, model };
  }
  if (provider !== "custom") throw new Error("CONFIGURATION");
  try {
    const url = new URL(env.REASONING_BASE_URL || "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !env.REASONING_MODEL?.trim() ||
      env.REASONING_MODEL !== env.REASONING_MODEL.trim() ||
      /[\r\n]/.test(env.REASONING_MODEL)
    )
      throw new Error();
    return {
      provider,
      baseUrl: url.toString().replace(/\/$/, ""),
      model: env.REASONING_MODEL,
      label: env.REASONING_PROVIDER_LABEL || "Configured reasoning provider",
      keyName: "REASONING_API_KEY",
      modelName: "REASONING_MODEL",
    };
  } catch {
    throw new Error("CONFIGURATION");
  }
}

/** @param {Record<string, string | undefined>} env */
export function resolveReasoning(env) {
  const profile = reasoningProfile(env);
  const apiKey = env[profile.keyName];
  if (
    !apiKey ||
    !apiKey.trim() ||
    apiKey !== apiKey.trim() ||
    /[\r\n]/.test(apiKey)
  )
    throw new Error("CONFIGURATION");
  return { ...profile, apiKey };
}
