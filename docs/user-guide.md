# Samvaad user guide

Reviewed 13 November 2026. This guide describes the implemented interface. The pilot is available for testing at https://samvaad-pied.vercel.app. Earlier local and hosted synthetic browser-to-report rounds passed, but repeated hosted voice-upload interruptions remain unresolved. Consistent full-session operation and physical microphone/student acceptance are not yet confirmed.

## What you can practise

Samvaad supports interviews, vivas, debates, group discussions and presentations in English when enabled by the operator. The pilot app is enabled for testing. Group discussion is designed as you, a dedicated AI moderator and two AI peers with distinct views. This format passed hosted synthetic session-to-report testing; a student microphone/listening check remains outstanding. There are no shared rooms with other students.

Rounds last three or five minutes, subject to the options offered by the service. Choose Gentle, Standard or Intense pressure. Difficulty changes the challenge, not the scoring scale.

## Create your account

Use Sign in to create an email/password account with any valid email address. No verification email or Google account is required. Email ownership is not verified. Save your password securely: automated forgotten-password recovery is unavailable. You can change your password in Account while signed in. An email address alone does not prove ownership of an existing account.

## Start a round

1. Open Practice Studio and select an available mode and topic. No topic is selected automatically.
2. Choose pressure and duration, then choose Check your microphone.
3. Test microphone access. Speak a sentence during the four-second test. The level bars show input from your microphone; the test does not save audio.
4. Enter the room and choose Start discussion. Entering the room alone does not start a real call.
5. After inactivity, the voice service may take about a minute to wake up. Wait in the room; your practice timer starts once the voice connection is ready.
6. Listen and respond. In group discussion, AI peers contribute differing views and the moderator facilitates. Other modes use one AI counterpart. You can interrupt AI playback; AI questions wait for a response boundary. Presentation delivery is protected before questions.

Unavailable modes or service errors cannot be bypassed by selecting another duration. Follow the message shown by the service.

## During the discussion

Mute microphone controls your outgoing microphone; Mute speaker controls the panel sound. Use End round to finish early and confirm the dialog, or Keep speaking to continue. The room shows time and connection status. There are no live captions or live scores.

If the connection outcome is uncertain, use Check round status. The app checks the existing round rather than automatically starting a second call. A disconnected round may need time to reconcile; a new round is a separate attempt.

## Read your feedback

After the discussion, the processing page checks the completed conversation and prepares feedback. You can return through Past Sessions & Progress to check its status.

A completed report contains eight dimensions scored from 1 to 5: clarity, structure, relevance, evidence, counterargument handling, conciseness, composure and closing. The overall score is calculated from those dimensions. Select a dimension to read its reason and any reliable supporting quote. A missing quote is shown honestly.

Review the strongest and weakest moments, read the transcript, and choose one of the three practice actions to work on. Repeat practice carries the previous actions for the same topic and mode when available. AI coaching can be wrong; scores are practice guidance, not an admission or hiring decision. Text-based feedback does not measure pronunciation, emotion or vocal confidence.

## History and account

Past Sessions & Progress lists your rounds and their status. Open a report for a completed round or check an unfinished round. Comparable progress appears only when the service supplies a compatible comparison; an unavailable comparison is not a score of zero.

Account provides signed-in password changes, sign-out and a link to data/privacy information. There is no automated forgotten-password recovery, self-service session/account deletion or audio playback in this version. For a data request, use the operator contact on the privacy page. Do not include your password in a support message.

## If something goes wrong

| Message or problem | What to do |
|---|---|
| Forgotten password | Automated recovery is unavailable. Keep an existing signed-in session open; Account lets you change your password. |
| Microphone blocked | Allow microphone access in browser site settings, then test again. |
| No sound detected | Unmute the device, check the selected input and speak during the test. |
| No microphone available | Connect a device and check whether another app is using it. |
| Voice service waking up | Wait about a minute; your practice timer has not started. If it fails to connect, follow the offered retry action. |
| Voice temporarily unavailable | The service is not ready; contact the operator or return later. |
| Voice connection ends early | Hosted upload interruptions are under investigation. Check the existing round's status before starting another. Incomplete voice evidence is not scored; partial provider segments do not guarantee a report. Audio is not recorded for recovery. |
| Daily limit reached | Return when the service permits another round; do not repeatedly submit. |
| Round still processing | Return through history or use the available status check. |
| Feedback failed | Read any available transcript and follow the offered recovery action. A failed result is not assigned zero points. |
| Session unavailable | Sign into the owning account; sessions belonging to other accounts cannot be opened. |

## Your data

Live microphone audio passes through Samvaad's gateway to Gnani. Final transcript segments go to the configured reasoning service for replies during the round, then the finalized transcript is used for scoring. Session records and feedback are held in Supabase. Audio is buffered temporarily in memory and is not persisted or replayed. External-provider retention still requires operator verification; this is not a promise of zero provider retention. Avoid secrets, identity documents or confidential information. Read the in-app Privacy page before live use.
