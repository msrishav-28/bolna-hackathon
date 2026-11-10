export interface PresetTopic {
  id: string;
  order: string;
  title: string;
  category: "Education" | "Career" | "Policy" | "Technology";
  context: string;
  openingPrompt: string;
  studentClaim: string;
  interruptionCue: string;
  recoveryExchange: string;
  supporterProbe: string;
}

export interface DifficultyLevel {
  id: "Gentle" | "Standard" | "Intense";
  label: "Gentle" | "Standard" | "Intense";
  cadence: string;
  interruptionThreshold: string;
  challengerPosture: string;
  description: string;
}

export interface ScoredDimension {
  id: string;
  name: string;
  plainLabel: string;
  measures: string;
  score: 1 | 2 | 3 | 4 | 5;
  reason: string;
  groundedQuote: string | null;
  turnId: string | null;
}

export interface TranscriptTurn {
  id: string;
  timestamp: string;
  speaker: "Panel" | "Student";
  roleTag?: "Moderator" | "Challenger" | "Supporter";
  isInterruption?: boolean;
  text: string;
  dimensionRefs?: string[];
}

export const PRESET_TOPICS: PresetTopic[] = [
  {
    id: "ai-assignments",
    order: "TOPIC I",
    title: "Should colleges allow AI tools for assignments?",
    category: "Education",
    context:
      "Evaluating assessment integrity versus industry readiness in undergraduate engineering curricula.",
    openingPrompt:
      "Welcome to the room. Today we are examining whether colleges should allow AI tools for graded assignments. State your opening position in under forty seconds.",
    studentClaim:
      "I think colleges should definitely allow AI tools because every company in the software industry already uses coding assistants, and banning them just makes coursework feel outdated and disconnected from how people actually work today—",
    interruptionCue:
      "Let me stop you there. That is a claim about workplace adoption, not learning outcomes. If a first-year student delegates problem decomposition to a model, what concrete evidence shows they still build debugging fundamentals?",
    recoveryExchange:
      "Fair pushback. They do not build fundamentals if AI writes the whole solution. That is why I would restrict AI in year-one foundational labs, and only permit it in capstone architecture courses where students are graded on verification and oral defense.",
    supporterProbe:
      "That distinction between year-one fundamentals and capstone verification is clear. Push it further: how should a faculty panel grade that oral defense without blowing up evaluation time?",
  },
  {
    id: "remote-early-career",
    order: "TOPIC II",
    title: "Is remote work better for early career growth?",
    category: "Career",
    context:
      "Weighing deep focus and geographic flexibility against osmotic mentorship for new graduates.",
    openingPrompt:
      "Our question is whether remote work accelerates or slows down early career growth for fresh graduates. Take a clear stance to open.",
    studentClaim:
      "Remote work is much better because freshers save two hours of commuting every day and can spend that time reading documentation, contributing to codebases, and working from anywhere without office distractions—",
    interruptionCue:
      "Let me stop you there. Saved commute time is convenience, not career velocity. How does a junior engineer replace the tacit feedback of overhearing senior engineers debug an incident in real time?",
    recoveryExchange:
      "You cannot replace passive overhearing automatically. Remote only works for early career if teams enforce structured pairing—like mandatory thirty-minute daily shadow sessions and explicit PR walkthroughs.",
    supporterProbe:
      "Good recovery. You moved from a blanket claim to a conditional requirement. What happens when a startup is under deadline pressure and drops those shadow sessions first?",
  },
  {
    id: "social-media-age",
    order: "TOPIC III",
    title: "Should social media have age verification?",
    category: "Policy",
    context:
      "Balancing adolescent cognitive protection against identity privacy and surveillance risk.",
    openingPrompt:
      "We are discussing mandatory age verification on social media platforms. Where do you draw the policy line?",
    studentClaim:
      "Mandatory age verification is essential because algorithmically driven feeds are designed to maximize screen time, and minors are clearly the most vulnerable group on these platforms right now—",
    interruptionCue:
      "Let me stop you there. What is your core point on enforcement? If verifying every minor requires every adult to upload a government ID, does your proposal destroy anonymous speech?",
    recoveryExchange:
      "Uploading raw government IDs to private social networks would be a privacy disaster. My position depends on zero-knowledge cryptographic age tokens issued by a browser or OS wallet so the platform only receives a yes-or-no proof.",
    supporterProbe:
      "That addresses the platform data-honeypot risk. Now close the loop: how do you prevent a parent from simply handing an authenticated device to a twelve-year-old?",
  },
  {
    id: "internships-vs-classroom",
    order: "TOPIC IV",
    title: "Are internships better than classroom learning?",
    category: "Education",
    context:
      "Comparing production constraints and messy real-world systems against theoretical first principles.",
    openingPrompt:
      "Are internships fundamentally better than classroom learning for engineering readiness? Open the discussion.",
    studentClaim:
      "Internships are far superior because in a real company you deal with production deadlines, legacy code, and team code reviews, whereas college lectures often cover slides that have not changed in ten years—",
    interruptionCue:
      "Let me stop you there. You are comparing a strong internship against a weak lecture. When an intern only writes CRUD boilerplate for six months, where do they learn distributed systems invariants or algorithmic complexity?",
    recoveryExchange:
      "You are right—an unmentored CRUD internship teaches very little theory. The real advantage is sequencing: rigorous classroom theory for invariant foundations, followed immediately by an internship that forces those invariants into messy constraints.",
    supporterProbe:
      "That sequencing argument holds together. Give one concrete example of a classroom concept that only clicked for you under a real constraint.",
  },
  {
    id: "india-ai-skills",
    order: "TOPIC V",
    title: "Should India prioritize AI skills in every degree?",
    category: "Technology",
    context:
      "National curriculum reform across non-CS disciplines versus foundational literacy and lab infrastructure.",
    openingPrompt:
      "Should India mandate AI skills across every undergraduate degree—including arts, commerce, and civil engineering? State your view.",
    studentClaim:
      "Yes, India has the largest youth cohort in the world and integrating AI literacy into every degree will make graduates across commerce, law, and core engineering far more employable globally—",
    interruptionCue:
      "Let me stop you there. That is a slogan, not a curriculum plan. When regional colleges still face faculty shortages in core subjects, what gets cut from a civil engineering or literature syllabus to make room for AI?",
    recoveryExchange:
      "Nothing from core domain rigor should be cut. Instead of adding a generic Python AI course to literature or civil engineering, we should replace outdated rote-computation labs with domain-specific AI auditing—like structural load verification or source-citation checking.",
    supporterProbe:
      "Domain-specific auditing is much sharper than universal coding modules. How would you summarize your closing recommendation to a university board in one sentence?",
  },
];

export const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  {
    id: "Gentle",
    label: "Gentle",
    cadence: "Allows 35–45s of uninterrupted setup before probing.",
    interruptionThreshold: "Steps in only on clear circular repetition.",
    challengerPosture:
      "Warm Socratic prompts; invites you to supply a missing example.",
    description:
      "Designed for your first rehearsal on a new topic. Builds speaking rhythm while still requiring a clear claim.",
  },
  {
    id: "Standard",
    label: "Standard",
    cadence: "Challenges unsupported claims within 20–30s.",
    interruptionThreshold:
      "Interrupts rambling or vague generalizations directly.",
    challengerPosture:
      "Realistic placement-room pressure; tests whether you defend or fold.",
    description:
      "The default placement simulation. Balances supporter expansion prompts with direct challenger interruptions.",
  },
  {
    id: "Intense",
    label: "Intense",
    cadence: "Immediate cross-examination on any unbacked assumption.",
    interruptionThreshold:
      "Strict conciseness floor; stops throat-clearing within 15s.",
    challengerPosture:
      "High-tempo panel intervention; demands crisp structure and composure.",
    description:
      "Built for final-round preparation. Note: difficulty sharpens panel behavior, never the 1–5 scoring rubric.",
  },
];

export const SCORED_DIMENSIONS: ScoredDimension[] = [
  {
    id: "clarity",
    name: "Clarity",
    plainLabel: "Did people understand you quickly?",
    measures: "Clear language and direct point without hedging.",
    score: 4,
    reason:
      "Your distinction between foundational first-year labs and capstone courses was immediately understandable once you dropped the opening generalization.",
    groundedQuote:
      "I would restrict AI in year-one foundational labs, and only permit it in capstone architecture courses where students are graded on verification and oral defense.",
    turnId: "turn-4",
  },
  {
    id: "structure",
    name: "Structure",
    plainLabel: "Did your point have shape?",
    measures: "Claim, reason, concrete example, and conclusion.",
    score: 3,
    reason:
      "Your second turn followed a clean condition-and-mechanism shape, but your opening turn stacked two separate reasons without stating a boundary condition.",
    groundedQuote:
      "every company in the software industry already uses coding assistants, and banning them just makes coursework feel outdated",
    turnId: "turn-2",
  },
  {
    id: "relevance",
    name: "Relevance",
    plainLabel: "Did you stay on topic?",
    measures: "Disciplined focus on the selected group discussion question.",
    score: 5,
    reason:
      "Every turn addressed undergraduate assessment policy directly without drifting into generic AI hype.",
    groundedQuote:
      "students are graded on verification and oral defense rather than raw line count.",
    turnId: "turn-4",
  },
  {
    id: "evidence",
    name: "Evidence",
    plainLabel: "Did you support your point?",
    measures:
      "Examples, facts, mechanisms, or concrete cases rather than assertions.",
    score: 3,
    reason:
      'You initially asserted "everyone in industry uses them" without a learning mechanism, though you later supplied a concrete 10-minute viva rubric example.',
    groundedQuote:
      "A ten-minute live code mutation check where the student must modify one constraint without AI access.",
    turnId: "turn-6",
  },
  {
    id: "counterargument",
    name: "Counterargument handling",
    plainLabel: "Did you respond when challenged?",
    measures:
      "Direct engagement with pushback instead of repeating your opening claim.",
    score: 4,
    reason:
      "When challenged on first-year debugging fundamentals, you conceded the valid risk immediately and narrowed your proposal instead of getting defensive.",
    groundedQuote:
      "Fair pushback. They do not build fundamentals if AI writes the whole solution.",
    turnId: "turn-4",
  },
  {
    id: "conciseness",
    name: "Conciseness",
    plainLabel: "Did you avoid rambling?",
    measures:
      "Efficient use of speaking time; stopping once the point is made.",
    score: 3,
    reason:
      "Your opening turn ran into a compound clause that triggered a panel interruption at 00:42. Subsequent turns were tighter and under 30 seconds.",
    groundedQuote:
      "and banning them just makes coursework feel outdated and disconnected from how people actually work today—",
    turnId: "turn-2",
  },
  {
    id: "composure",
    name: "Composure",
    plainLabel: "Did you stay steady?",
    measures:
      "Coherent written response and structural recovery after a challenge; zero vocal/emotion inference.",
    score: 4,
    reason:
      "After the panel interrupted your opening claim, your next turn opened with a direct acknowledgment and a structured two-tier rule.",
    groundedQuote:
      "Fair pushback. They do not build fundamentals if AI writes the whole solution.",
    turnId: "turn-4",
  },
  {
    id: "closing",
    name: "Closing",
    plainLabel: "Did you end strongly?",
    measures: "Clear final position or synthesis that anchors the room.",
    score: 4,
    reason:
      "Closed with a crisp one-sentence policy rule that synthesized both the challenger constraint and the supporter scalability question.",
    groundedQuote:
      "Permit AI where we test system design, prohibit it where we build syntax fluency, and always grade the human explanation.",
    turnId: "turn-6",
  },
];

export const SYNTHETIC_TRANSCRIPT: TranscriptTurn[] = [
  {
    id: "turn-1",
    timestamp: "00:00",
    speaker: "Panel",
    roleTag: "Moderator",
    text: "Welcome to the room. Today we are examining whether colleges should allow AI tools for graded assignments. State your opening position in under forty seconds.",
  },
  {
    id: "turn-2",
    timestamp: "00:14",
    speaker: "Student",
    text: "I think colleges should definitely allow AI tools because every company in the software industry already uses coding assistants, and banning them just makes coursework feel outdated and disconnected from how people actually work today—",
    dimensionRefs: ["structure", "conciseness"],
  },
  {
    id: "turn-3",
    timestamp: "00:42",
    speaker: "Panel",
    roleTag: "Challenger",
    isInterruption: true,
    text: "Let me stop you there. That is a claim about workplace adoption, not learning outcomes. If a first-year student delegates problem decomposition to a model, what concrete evidence shows they still build debugging fundamentals?",
  },
  {
    id: "turn-4",
    timestamp: "00:56",
    speaker: "Student",
    text: "Fair pushback. They do not build fundamentals if AI writes the whole solution. That is why I would restrict AI in year-one foundational labs, and only permit it in capstone architecture courses where students are graded on verification and oral defense rather than raw line count.",
    dimensionRefs: ["clarity", "relevance", "counterargument", "composure"],
  },
  {
    id: "turn-5",
    timestamp: "01:28",
    speaker: "Panel",
    roleTag: "Supporter",
    text: "That distinction between year-one fundamentals and capstone verification is clear. Push it further: how should a faculty panel grade that oral defense without blowing up evaluation time?",
  },
  {
    id: "turn-6",
    timestamp: "01:44",
    speaker: "Student",
    text: "A ten-minute live code mutation check where the student must modify one constraint without AI access. Permit AI where we test system design, prohibit it where we build syntax fluency, and always grade the human explanation.",
    dimensionRefs: ["evidence", "closing"],
  },
  {
    id: "turn-7",
    timestamp: "02:18",
    speaker: "Panel",
    roleTag: "Moderator",
    text: "Time is up. We have a clear conditional policy on the table. Ending the session now for transcript verification.",
  },
];

export const PRACTICE_ACTIONS = [
  {
    number: "ACTION I",
    dimension: "Conciseness & Opening Shape",
    title: "Lead with your boundary condition in sentence one",
    detail:
      'Instead of opening with a broad industry truism ("everyone uses AI"), start directly with your conditional thesis ("Allow AI only in upper-level design courses, not foundational labs"). Practice delivering your opening claim in 2 sentences under 18 seconds.',
  },
  {
    number: "ACTION II",
    dimension: "Evidence Grounding",
    title: 'Replace "every company" assertions with one mechanism',
    detail:
      'Whenever you hear yourself say "everyone", "obviously", or "nowadays", substitute a concrete mechanism—such as your 10-minute live code-mutation check—before the Challenger forces you to.',
  },
  {
    number: "ACTION III",
    dimension: "Counterargument Recovery",
    title: 'Keep the two-step "Concede the boundary, defend the core" pivot',
    detail:
      'Your recovery at 00:56 ("Fair pushback. They do not build fundamentals if...") was your highest-leverage habit. Repeat this exact 3-minute topic at Intense difficulty to test whether you hold that pivot under a 15-second interruption threshold.',
  },
];

export const VOICE_TONE_SPECIMENS = [
  {
    moment: "Before session",
    line: "Pick a topic. We will make it uncomfortable in a useful way.",
    intent: "Sets calm expectation of productive friction.",
  },
  {
    moment: "During challenge",
    line: "That is a claim. What evidence supports it?",
    intent: "Separates assertion from proof without personal judgment.",
  },
  {
    moment: "If user rambles",
    line: "Let me stop you there. What is your core point?",
    intent:
      "The signature interruption—trains concise recovery under time pressure.",
  },
  {
    moment: "After strong point",
    line: "That was clear. Push it further.",
    intent: "Supporter role reinforces structural clarity and tests depth.",
  },
  {
    moment: "After session",
    line: "You held your position better than you think. Here is where you lost structure.",
    intent: "Honest, grounded debrief anchored to the verbatim transcript.",
  },
  {
    moment: "If score is low",
    line: "This is a starting point, not a verdict. Here are the three things to fix first.",
    intent: 'Never uses harsh labels like "wrong", "bad", or "you failed".',
  },
];
