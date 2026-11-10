/** Presentation copy; scoring rules and topic definitions stay in the domain. */
export const content = {
  tagline: "Group discussion practice, out loud.",
  steps: [
    {
      title: "Choose your ground.",
      detail:
        "Five topics worth discussing. Pick your pressure: Gentle, Standard or Intense. Make it a three- or five-minute round.",
    },
    {
      title: "Make your case.",
      detail:
        "Join an AI moderator and two AI peers in group discussion, or one AI counterpart in other modes. Explain your view and respond to the next question.",
    },
    {
      title: "Find your next move.",
      detail:
        "Review your words across eight dimensions. Leave with your strongest moment, an area to improve and exactly three practice actions.",
    },
  ],
  questions: [
    {
      question: "How much time do I need?",
      answer:
        "Choose a three- or five-minute discussion. Allow a little extra time to check your microphone and reflect on your feedback. Sign in to keep your rounds together.",
    },
    {
      question: "Who will I be speaking with?",
      answer:
        "Group discussion uses an AI moderator and two AI peers with distinct views and voices. Other modes use one AI counterpart. These are AI participants, not other students.",
    },
    {
      question: "Do I need to be a confident speaker?",
      answer:
        "You do not need a polished answer to begin. The Gentle setting gives you a lower-pressure starting point. Each round is practice, not a hiring or academic assessment.",
    },
    {
      question: "What will the feedback measure?",
      answer:
        "The scorecard uses the completed transcript to assess eight discussion skills. Each score needs a reason; quotes must come from your words. It does not judge your accent, pronunciation or vocal confidence.",
    },
    {
      question: "Will my voice be recorded?",
      answer:
        "Samvaad does not store or replay raw audio. The voice provider processes microphone audio to run the conversation; Samvaad keeps the completed transcript and feedback. Read the privacy page for details.",
    },
  ],
  auth: {
    linkError:
      "This email link has expired or could not be verified. Try signing in, or request a password reset below.",
    networkError:
      "We couldn’t reach the service. Check your connection and try again.",
    responseError: "We couldn’t complete that request. Please try again.",
  },
} as const;
