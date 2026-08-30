# Retza original project evidence

This document summarizes the retained evidence for the original collaborative Retza project. Its purpose is to preserve useful design history without turning later repository work into retroactive claims about the first version.

## Evidence standard

The original project predates the current public repository. The evidence trail comes from retained presentation material, project notes, prior development records, and the surviving attribution record.

Where those sources support a clear claim, this document states it. Where they do not, the repository stays conservative.

In particular:

- no formal task-completion percentage is claimed;
- no calibrated targeting-accuracy percentage is claimed;
- presentation-only pricing, investment, or market projections are not treated as measured project outcomes;
- old slides or screenshots are not recreated and labeled as untouched originals when the source file cannot be verified;
- the current Git history is not used to assign original team authorship.

## Original problem and audience

The project was framed around **zero barrier accessibility**. The central concern was not simply whether a computer feature existed, but whether a person unfamiliar with common interface vocabulary could confidently reach it.

The original design emphasized:

- older and less experienced computer users;
- large, readable interface elements;
- plain language with minimal jargon;
- numbered instructions;
- definitions or examples when a term could be unfamiliar; and
- adaptive help rather than a static FAQ.

The Retza name was expanded as **Reaching Everybody Through Zero Barrier Accessibility**.

## Evidence from user testing

### Kevin's grandmother

Testing with Kevin's grandmother produced the strongest product insight.

She could understand the wording of an instruction and still hesitate because she could not locate the control it described. That meant a response could be technically correct and linguistically simple while still failing as assistance.

The team's response was to move beyond text alone and develop a glowing or highlighting guidance idea that showed where the next action should happen.

The important evidence is observational. A user may politely say that an instruction makes sense while still scanning the screen or pausing before acting. That is why the project later emphasized **designing for confidence, not just functionality**.

### Younger testers

Vladimir's younger siblings were used as less predictable stress testers. They asked unusual, random, or nonsensical questions that helped expose how the assistant behaved outside ideal examples.

This testing did not establish a quantitative robustness score. Its value was qualitative: the team learned that a useful assistant had to handle unexpected input without assuming every question would fit a clean scripted path.

## Development chronology

Retained records support the following broad sequence:

| Period | Evidence-supported development |
| --- | --- |
| **Late April 2026** | Define the target audience, accessibility problem, and product direction |
| **Late April to early May 2026** | Build and refine the initial assistant around simple, numbered guidance |
| **Early to mid-May 2026** | Conduct family testing, including Kevin's grandmother and Vladimir's younger siblings |
| **Mid-May 2026** | Develop the visual-guidance direction, refine walkthrough behavior, polish the interface, and prepare the final presentation |

The current public repository is a later engineering extension and should not be read as the original team's chronological source history.

## Product ideas established in the original phase

Several ideas in the current repository trace directly to problems discussed in the original project:

| Original evidence | Later repository expression |
| --- | --- |
| Simple wording could still hide assumptions | More explicit prompts plus deterministic prerequisite repair |
| Users could understand text but fail to locate a control | Show Me visual guidance |
| A wrong highlight could reduce confidence | Fail-closed semantic targeting with live evidence |
| Proactive support risked becoming interference | Bounded inactivity, repeated-click, and hover heuristics with cooldowns and a user-controlled Watching mode |
| Voice support could reduce typing or reading friction | Optional speech input when Chromium support is available |
| The interface should reduce cognitive load | Focused walkthrough steps, readable controls, text-size options, reduced-motion behavior, and visible focus states |

The later systems are not claimed to have existed in the original phase. The table shows continuity of product reasoning, not identical implementation.

## Presentation evidence

The original presentation deliberately used a problem-first structure. A skit showed how overwhelming computer help can become when several people give technical instructions at once, then contrasted that confusion with a calmer Retza interaction.

The slides were intentionally visual and low-text. Retained presentation themes included:

- balancing help versus interference;
- recognizing that the hardest bugs can be human rather than technical;
- designing for confidence, not only functionality; and
- interpreting possible confusion without pretending the system can read emotion.

That presentation style matters because it mirrors the product philosophy. The team tried to reduce unnecessary cognitive load in both the software and the explanation of the software.

## Contribution evidence

The retained material supports the following original-phase contribution for Kevin Zhu:

- target-user and problem research;
- realistic computer-help scenarios;
- direct testing with his grandmother;
- interpretation and synthesis of observed feedback;
- product positioning and use-case framing; and
- presentation and project communication.

Vladimir Dukkardt led much of the original interface and visual direction. Retained material also indicates that other teammates led much of the original AI logic. The surviving narration does not support assigning every original subsystem to one person with certainty, so the repository avoids doing so.

## Observation-to-change chain

The clearest original iteration chain was:

**assumption -> observation -> product change**

The team assumed simpler language would be enough. Testing showed that clear words could still fail when the next interface control was hard to find. That observation produced the visual-guidance direction. The later repository then turns the same trust problem into a more rigorous engineering question: when is the evidence strong enough to point?

## Related documentation

- [Main README](../README.md)
- [Project history and provenance](PROJECT_HISTORY.md)
- [Engineering notes](ENGINEERING.md)
- [Browser adaptation](../browser-demo/README.md)
