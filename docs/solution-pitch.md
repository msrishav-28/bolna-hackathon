# Samvaad

**Practice the moment before you speak.**

## The problem

Students can prepare an answer and still struggle when someone challenges it. Placement interviews, vivas, debates, group discussions and presentations demand more than memorisation: students must explain their thinking, support a claim and recover when questioned. Access to a consistent practice partner is limited, and generic feedback rarely tells them what to change next.

## The solution

Samvaad is a voice-first practice partner that turns preparation into a repeatable learning loop: **speak, face a follow-up, reflect and try again.** Students choose a practice mode, a curated topic or brief, a difficulty level and a three- or five-minute session. Disclosed AI participants ask focused questions and challenge unsupported claims respectfully. Presentation practice protects delivery time before moving into questions.

## Feedback students can use

After a complete, verified session, students receive a transcript-grounded scorecard covering eight dimensions, with reasons, supporting quotes where available, strongest and weakest moments, and exactly three practice actions. History helps them revisit earlier sessions and compare compatible attempts. Feedback assesses the evidence in their words; it does not infer emotion, pronunciation or vocal confidence from text.

## Why Samvaad

The focus is the difficult next question, not just the prepared opening answer. Mode-specific practice, adjustable pressure and short sessions make repetition practical. Every round ends with a concrete next step rather than a vague judgement or an unsupported ranking.

## How it is built

The selected architecture combines Gnani Prisma speech recognition and Timbre speech synthesis with a separately configured conversation model. Samvaad's backend owns timing, mode rules and transcript integrity. Supabase provides authentication and Postgres; Next.js delivers the interface. The application does not store raw audio.
