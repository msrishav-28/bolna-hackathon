# Conversation policy configuration

Reviewed 9 November 2026. The selected route uses Gnani API Platform Speech and Samvaad-owned conversation control, not Gnani Agent Builder.

Authoritative current policies come from modeContext in [practice-mode.ts](../src/lib/domain/practice-mode.ts). They supply trusted mode/rubric version, topic, pressure, duration and protected presentation length. Scoring instructions are separate in src/lib/server/scoring.ts.

Use GNANI_SPEECH_API_KEY plus the selected Gemini/Groq key from [.env.example](../.env.example). URLs/model defaults are owned by src/lib/reasoning-config.mjs. Do not create Gnani agents, collect agent IDs or configure Platform webhooks for this route. The old caller/transport and webhook route are removed. Groq is selected in local/template settings for integration tests; no automatic reasoning fallback is used.

src/lib/voice/gateway.ts now enforces the authoritative deadline, actor scheduling, protected presentation, cancellation, audio bounds and private evidence operations. Dialogue instructions live separately in src/lib/voice/dialogue.ts. The applied direct-Speech and readiness-clock migrations supply single-use grants, immutable finals and a full practice duration after warmup; keep VOICE_RUNTIME_ENABLED=false outside authorized testing until acceptance passes. Provisional voices and advanced panel/interrupt proposals are not release-accepted. Prompts alone do not enforce timing or provenance.
