# Samvaad developer guide

Updated 13 November 2026. This is the engineering entry point. It links to the owning specifications rather than duplicating API definitions.

## Read in this order

1. [README](../README.md) for commands and source layout, and tracker for dated evidence and unresolved work.
2. Product behavior, product brief and engineering brief for requirements.
3. Architecture and frontend/backend handoff for implemented boundaries and contracts.
4. Setup, Gnani evidence and release acceptance before connecting services.
5. Design for the ZIP visual system and decisions for rationale. Follow AGENTS.md when contributing.

## Run and verify

Use Node 24. Install the lockfile with `npm ci`, copy `.env.example` to `.env.local`, and configure the selected services. Never commit credentials. Follow setup for environment names, reviewed migration order and the selected recovery lifecycle; no Platform webhook registration is required.

~~~sh
npm run dev
npm run config:check
npm run speech:check
npm run check
npm run build
~~~

`config:check` checks configuration presence/shape; it does not prove provider connectivity. `check` runs formatting, local documentation links, lint, TypeScript and synthetic tests. A successful build does not establish a working live voice round. The ongoing review server uses port 3013; the normal dev command also uses port 3013.

The selected route uses direct Gnani Speech through the owned Node gateway. Build it with npm run gateway:build and run npm run gateway:start alongside the web dev server. Loopback defaults are ports 3013 (web) and 3015 (gateway). Set SAMVAAD_VOICE_WS_URL to the owned /speech endpoint; keep VOICE_RUNTIME_ENABLED=false until the gateway and acceptance test setup are ready; the six migrations are already applied to the configured project. These are Samvaad settings, not provider endpoints. Production requires a persistent WSS host; web hosting alone does not run the gateway.

config:check and speech:check make no requests and do not establish migration/host/real-session acceptance; releaseReady remains false. speech:probe -- --live runs the bounded synthetic REST roundtrip, consuming credits. REST/server-WebSocket probes passed, but neither is a physical browser microphone/report test. The retired Agent Builder runtime and webhook route are removed.

Collect `GNANI_SPEECH_API_KEY` from Gnani API Platform; `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` from Supabase; and `GEMINI_API_KEY` and/or `GROQ_API_KEY` for text reasoning. URLs, model IDs and provider disclosure labels resolve from the selected built-in profile. Set APP_ORIGIN to the running origin and supply PRIVACY_CONTACT_EMAIL. Generate application secrets such as CRON_SECRET locally during service setup. No Agent Builder key, agent IDs or webhook registration is needed for the isolated Speech test. Keep all private values in ignored .env.local or the host's secret store; never use chat or source control.

`REASONING_PROVIDER=groq` is selected in local/template configuration, using only GROQ_API_KEY, openai/gpt-oss-120b and Groq's official URL. Gemini remains explicitly selectable with GEMINI_API_KEY and optional GEMINI_MODEL. Both keys may be present; only the selected one is sent. Missing credentials and rate limits never switch providers automatically. Custom integrations retain REASONING_PROVIDER=custom and the documented generic base/key/model/label fields. Named profiles never reuse the generic key. The shared resolver is src/lib/reasoning-config.mjs. Explicit selection is recommended; its historical no-selector default remains Gemini for compatibility.

`npm run reasoning:check` checks the selected profile offline, printing no key. Add `-- --live` for one authenticated GET to the official model catalog with bounded timeout/body and no redirects or retries. This sends no prompt/transcript and performs no inference. Model availability does not prove free quota, billing status, response quality or scoring acceptance. On 9 November both provider keys/catalogs accepted the selected models. Separate bounded synthetic JSON requests returned Gemini 503 without retry and Groq 200 with valid JSON. This is limited compatibility evidence, not a quality comparison or a transcript-derived report. No runtime provider switch occurred.

Evaluation dated 9 November: Groq GPT-OSS 120B and Gemini 3.5 Flash-Lite passed the actual short synthetic scoring fixture; Gemini 3.8 Flash timed out. Groq is now selected deliberately for integration testing. A new synthetic conversation request passed the actual bounded dialogue function in 3,806ms with a 27-word reply; this is one compatibility observation, not quality/load or physical-microphone acceptance. Official bases: [Gemini compatibility](https://ai.google.dev/gemini-api/docs/openai) and [Groq compatibility](https://console.groq.com/docs/openai). Review [Gemini pricing/terms](https://ai.google.dev/gemini-api/terms), [Groq limits](https://console.groq.com/docs/rate-limits) and [Groq data controls](https://console.groq.com/docs/your-data) before real student rollout. Free access is limited and does not establish unlimited capacity or approved retention. No provider billing/account setting was changed.

## Architecture and ownership

| Area | Responsibility |
|---|---|
| src/app | Next routes, API handlers, authentication entry points and gated design review |
| src/components/marketing | ZIP landing presentation and illustrative interactions |
| src/components/product | Real product screens and UI recovery states |
| src/components/ui | Reusable UI, including the supplied-source WordGlobe used on the homepage and the separate ThinkingOrb utilities |
| src/lib/practice-contracts.ts | Runtime practice options, mode availability and versioned create payloads |
| src/lib/product-contracts.ts | Runtime session, report and history response validation |
| src/lib/domain | Transcript/scoring invariants and product policy |
| src/lib/client | API/resources and owned Gnani audio lifecycle |
| src/lib/server | Authentication, ownership, database operations, provider calls and durable processing |
| src/lib/voice | Owned gateway/protocol, bounded dialogue and private Prisma/Timbre transport |
| gateway/main.ts | Persistent Node WebSocket host; compiled separately, behind TLS in production |
| supabase/migrations | Fresh-database schema and transactional state transitions |
| tests | Synthetic contract, access, workflow, retry and database regression checks |

The server owns identity, ownership, quotas, state, timing and idempotency. Never accept a browser-supplied transcript, total or provider identity as authority. Generated content is data, never executable HTML or instructions. Keep provider keys server-side and validate all external responses.

Protected product APIs return retryable 503 when Supabase reports an auth transport outage; they still require a fresh successful identity check before returning data. Invalid/missing identity remains 401. Do not turn an upstream outage into a logout or authorize requests from cached user data.

Overall scores scale the integer dimension total before division, matching PostgreSQL percentage rounding. A database-backed regression covers every possible eight-dimension total, including 23 points becoming 58/100. Persisted reports must still pass the full evidence and total validator; this correction needs no report rewrite or migration.

## UI component conventions

TypeScript and Tailwind CSS v4 are already configured. Global styles and tokens live in `src/app/globals.css`; `@/*` resolves to `src/*`. `components.json` configures shadcn's UI alias as `@/components/ui`, so its actual folder is `src/components/ui`. Keep reusable components there to preserve imports and CLI installation paths; a second root-level components folder would bypass this convention. The existing academic theme is retained. `src/lib/utils.ts` supplies the standard `cn()` helper using clsx and tailwind-merge. No shadcn initialization or theme reset is needed; inspect with `npx shadcn@latest info --json` before adding components.

The homepage now uses the founder-supplied Originkit Word Globe, adapted in src/components/ui/word-globe.tsx and mounted by src/components/marketing/word-globe-hero.tsx. It replaces the prior landing-page ThinkingOrb; the separate reusable ThinkingOrb API remains available in the UI library and the product room visualization is unchanged. The globe repeats Samvaad's speak/reflect/repeat phrase, uses the existing serif/ink/clay styling, retains a fixed viewpoint and exposes keyboard pause/play. Canvas work is capped at 30 fps and 1.5 pixel ratio, stops offscreen or when hidden, and slows to 12% under reduced motion at the founder's explicit request to avoid a static alternative. The supplied source attribution is retained; no new renderer dependency is needed.


## Runtime and remaining acceptance

The direct runtime is implemented: gateway/main.ts hosts persistent WebSockets; src/lib/voice owns protocol, provider adapters and dialogue. POST voice-session reserves a single-use hashed grant through Supabase. The browser authenticates first and streams exact binary PCM frames; the server owns the deadline, allowed actor, generation cancellation and bounded queues. Student finals are persisted unchanged before dependent turns. No Platform conversation IDs, browser transcript submissions or old webhooks enter this path.

All seven migrations/exposure/local callbacks are verified remotely under scoped approvals. The additive direct-Speech and readiness-clock migrations are applied with matching history records. It adds private speech_runs/speech_turns, immutable final evidence, grant/work RPCs and gd-ensemble-v1 alongside historical rubrics. Existing reports are preserved. Heartbeats recover only classified transient transport failures without blocking later transcript writes; the unchanged database stale-run fence remains enforced. Recovery uses fenced leases, two persisted scoring attempts and /api/internal/reconcile; configure the protected schedule on the intended host.

GD has stable moderator/peer_a/peer_b identities and provisional distinct Gnani voices. Other modes use one coach. Presentation protection is enforced through pauses; deliberate AI talk-over and optional interview panels remain unimplemented. Report snapshots exclude interrupted/unsent AI turns. sent means server-transmitted audio, not verified listening. The scorer must not penalize absent responses as if delivery were proven.

Conversation generation retries once only on transport or HTTP 502/503/504 before storing or speaking a reply. Each attempt has a twelve-second timeout and respects student/deadline cancellation. Auth/quota errors and invalid model output are not retried; neither are partially spoken turns. A temporary failure can therefore extend the thinking pause without duplicating evidence.

Known-utterance draining is bounded and rejects gaps/conflicts/missing finals; it is not a documented provider commit acknowledgement. Physical final-word/disfluency/cancellation acceptance remains required. Hosted email/password signup/sign-in and signed-in password changes passed; no verification or email recovery is configured. A complete hosted synthetic Chrome/Gnani/Groq three-minute GD produced the immutable transcript and rendered eight-dimension/three-action report. Physical microphone/final-word acceptance, mobile Safari/accessibility, reasoning quality/capacity, provider retention/spending and real student acceptance remain release gates. See the architecture and validation owners rather than treating configuration or synthetic probes as release evidence.

## Change and handoff discipline

Preserve the ZIP composition; add UI only for required behavior or accessibility. Separate presentation, policy and provider transport. Missing service configuration must remain unavailable. Update the owning document when behavior changes and record verification in tracker.

Run relevant tests and the repository checks after significant code changes. The founder now requests the default browser rather than Ego; prefer API/command-based checks where sufficient. Review desktop/mobile, keyboard and reduced motion when UI changes. Validation remains the single release checklist, including remaining tablet/zoom, physical microphone, Safari, screen-reader, real transcript/scoring, cost and student acceptance.

For student-facing instructions and troubleshooting, use the [user guide](user-guide.md). It describes current availability rather than promising unimplemented modes.

## Hosted deployment

Deploy the web app on Vercel using vercel.json, and the persistent voice gateway on Render using render.yaml and Dockerfile.gateway. Supabase stays in the existing configured project; do not reapply its seven migrations. The gateway accepts SPEECH_GATEWAY_PORT or the managed host's PORT and binds 0.0.0.0 in the container. Do not upload .env.local or operator access tokens. Docker excludes local credentials, caches and review artifacts. The container recipe has not been locally Docker-built if Docker is unavailable.

Gateway secrets: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, GNANI_SPEECH_API_KEY, REASONING_PROVIDER=groq, GROQ_API_KEY, and APP_ORIGIN equal to the exact final HTTPS web origin. Omit local SPEECH_GATEWAY_PORT so Render supplies PORT. Set SPEECH_GATEWAY_HOST=0.0.0.0 when not using the Docker image. Render Free sleeps after inactivity; the first connection can take about a minute. Set VOICE_GATEWAY_WARMUP_ENABLED=true on the web service so wake-up finishes before any grant/quota reservation. The room displays a cold-start notice and bounds pre-reservation waiting to 90 seconds. Generate a public HTTPS gateway domain and verify /health. No provider key belongs in a public environment variable.

Web configuration: the Supabase URL/publishable key, SUPABASE_SECRET_KEY, the same selected reasoning profile/key, SAMVAAD_VOICE_WS_URL=wss://the-gateway-domain/speech, APP_ORIGIN equal to the exact production web origin, AUTH_EMAIL_VERIFICATION_REQUIRED=false matching the approved Supabase policy, PRIVACY_CONTACT_EMAIL, CRON_SECRET (32+ characters), session limits, UI_PREVIEW_ENABLED=false. Keep VOICE_RUNTIME_ENABLED=false during initial setup; enable only after the gateway origin and hosted acceptance are ready. Web uses its existing server-side config requirements; supply GNANI_SPEECH_API_KEY there as required, never with a public prefix.

Create the web project/domain first with voice disabled, then configure the gateway with that exact web origin, then update web WSS configuration and deploy. Confirm Supabase production site URL/redirect allowlist deliberately; preserve local callbacks and do not alter email policy. Hosted microphone use requires HTTPS. Run a real browser microphone-to-report round against production before advertising availability.

vercel.json schedules authenticated reconciliation once daily, compatible with a basic scheduler allowance; it does not promise minute-level unattended recovery. A more frequent protected scheduler is a separate host-plan decision. Never put CRON_SECRET in a URL or repository file. Pause new starts before redeploying the gateway; live runs are non-resumable. Review host costs within the INR 1,000/month ceiling; no plan purchase or billing upgrade is implied by deployment preparation.
