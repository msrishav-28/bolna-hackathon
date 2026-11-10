# Samvaad

Status reviewed 13 November 2026; tracker owns dated evidence and unresolved work.

Voice-first student practice for interviews, vivas, debates, group discussions and presentations. The frontend follows the founder-selected academic design. Gnani is the sole voice provider selected on 7 November 2026. Design-source archives are retained locally and excluded from publication.

## Current state

Direct Gnani Speech now has a local owned gateway, browser protocol, server dialogue controller, immutable-transcript migration and scoring handoff. The retired Agent Builder caller/webhook/browser protocol are removed. Synthetic REST/WebSocket probes and three complete local three-minute Chrome/Gnani/Groq GD rounds with grounded reports passed. A full hosted Chrome/Gnani/Groq three-minute GD also passed with a rendered transcript and scorecard. Repeated live runs have also hit voice disconnects and temporary storage errors, so hosted consistency remains an open acceptance gate. Physical microphone and student acceptance remain outstanding.

`npm run speech:check` checks direct-Speech credential presence locally without network calls or exposing values. `npm run speech:probe` prints instructions; adding `-- --live` explicitly runs the bounded synthetic REST test. This prepares provider testing, not a complete browser session. The developer guide lists credentials and the current reasoning-provider candidates.

Supply GROQ_API_KEY for the selected template/local profile, Groq GPT-OSS 120B; Gemini remains an explicitly selectable alternative. The code owns official URLs/models/labels and never falls back automatically. npm run reasoning:check is offline; its -- --live option checks the catalog only. See the developer guide for configuration and compatibility evidence.

The approved Supabase setup includes all seven migrations/history, schema exposure and local port-3013 callbacks. Seven tables have RLS and privileged functions exclude browser roles. The approved sign-in policy is email/password without verification, SMTP or Google; email ownership is unverified and automated forgotten-password recovery is unavailable. Public signup, sign-in and signed-in password changes passed an isolated Chrome test. Three complete synthetic Chrome/Gnani/Groq three-minute GD rounds produced validated reports; the regular local runtime is now enabled for physical-microphone acceptance. Physical microphone, complete final-word drain, grounded report, privacy/cost/device and student acceptance remain release gates. Vercel web and Render voice deployments are live; a full hosted synthetic voice-to-report round passed.

## Run

Node 24 and npm. Copy .env.example to .env.local and follow setup.

~~~sh
npm ci
npm run dev
npm run gateway:build
npm run gateway:start
npm run check
npm run build
npm run config:check
~~~

The ongoing review server uses http://127.0.0.1:3013. UI_PREVIEW_ENABLED=true enables /preview with visibly synthetic examples; disable it for release. Webpack is explicit for this Windows environment.

## Source map

- src/app: routes, public/auth/privacy/account and product journey; /dashboard redirects to /practice.
- src/components/marketing: preserved ZIP landing components, synthetic specimens only.
- src/components/ui: WordGlobe and reusable ThinkingOrb; components.json configures shadcn paths, with the existing Tailwind v4 theme in src/app/globals.css.
- src/components/product: setup, microphone, room, processing, report, history and account.
- src/lib/domain: scoring, transcript and session policy.
- src/lib/practice-contracts.ts and product-contracts.ts: runtime API validation.
- src/lib/client: abortable resources and owned Gnani browser transport.
- src/lib/server: authentication, owned single-use grants, repository, durable processing and scoring.
- src/lib/voice: owned gateway/typed protocol, dialogue controller and private Prisma/Timbre WebSocket adapters.
- gateway/main.ts: separately hosted persistent WebSocket service; TLS is required outside loopback.
- public/audio: microphone AudioWorklet; public/fonts: self-hosted licensed fonts.
- supabase/migrations: seven applied migrations, including direct Speech and its readiness clock. Other targets need their own reviewed procedure.
- tests: synthetic behavior, provider boundary and embedded database checks.

## Read next

[One-page solution pitch](docs/solution-pitch.md) and [shareable PDF](output/pdf/samvaad-solution-pitch.pdf).

[User guide](docs/user-guide.md) for students; [developer guide](docs/developer-guide.md) for engineers and backend handoff.

Product brief, engineering brief, behavior, design, architecture, port plan, backend handoff, Gnani evidence, release acceptance.

## Hosting

Vercel hosts the Next.js web app; Render hosts the persistent voice gateway using Dockerfile.gateway and render.yaml. Supabase remains the database/authentication provider. See the [developer guide](docs/developer-guide.md#hosted-deployment) for the exact environment split and deployment sequence. The pilot web app is deployed at https://samvaad-pied.vercel.app and the gateway at https://samvaad-voice.onrender.com. Render Free can take about a minute to wake after inactivity; the room explains this and waits before reserving a voice grant. Hosted synthetic three-minute GD acceptance passed: immutable transcript, eight dimensions, three actions, all GD roles, real mute controls and rendered report. Physical microphone/student acceptance remains outstanding.
