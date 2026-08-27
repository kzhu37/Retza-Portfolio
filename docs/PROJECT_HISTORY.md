# Retza project history and provenance

This document separates the **original four-person project** from the **later public showcase repository**. It exists so the portfolio can make strong technical claims without blurring who did what or implying that every current capability existed in the first version.

## 1. Original problem framing

Retza was built around a simple accessibility problem: computer help often assumes that the user already understands the vocabulary and visual conventions of a computer interface.

The original target audience included older users and other people who may not share that assumed familiarity. The team deliberately moved away from dense instructions and static FAQ-style help toward a more adaptive assistant.

Early design priorities included:

- a minimal interface with large, readable elements;
- one clear input rather than a crowded control surface;
- numbered instructions;
- patient language;
- examples and definitions for unfamiliar terms; and
- AI-generated help that could adapt to a question rather than returning one fixed article.

## 2. First iteration: "be simple" was not specific enough

An early assumption was that telling the AI to keep its answer simple would solve most of the communication problem.

It did not.

A response could still:

- use a familiar-sounding term that a novice did not know;
- combine several actions into one instruction;
- assume that the user had already completed a prerequisite; or
- describe the right task at the wrong level of detail.

The prompting approach therefore became more explicit about defining necessary terms, using concrete examples, avoiding unnecessary jargon, and breaking procedures into focused actions.

That was the first important lesson: **shorter text is not automatically clearer text.**

## 3. Direct user testing changed the product

The retained presentation materials document testing with **Kevin Zhu's grandmother** and with **Vladimir Dukkardt's younger siblings**.

The younger testers helped stress-test the assistant with unexpected, random, or nonsensical questions.

Testing with Kevin's grandmother exposed a more consequential failure. She could understand an instruction but still be unable to locate the button or icon that the instruction referenced.

This mattered because verbal feedback alone could have missed the problem. A user can say that an instruction makes sense while still hesitating or searching the screen. Observed behavior therefore became as important as whether the wording sounded clear.

The team responded by developing the visual-guidance direction that later became associated with the glowing or highlighting indicator.

That produced the second important lesson: **understanding an instruction is not the same thing as being able to act on it.**

## 4. Help versus interference

The project also explored a harder human-computer interaction question: how can software offer help before the user explicitly asks without becoming intrusive?

The retained presentation material discusses hesitation, repeated mistakes, fear after a wrong click, and the possibility of detecting when help might be useful. The original project treated this as a design problem rather than claiming that software could read a user's emotions.

Voice support was discussed as a future direction for users who may find reading or typing difficult.

The current showcase later turns these ideas into bounded interaction heuristics, a cooldown, a visible Watching control, and optional speech input.

## 5. Original project contribution boundaries

Original team:

- **Kevin Zhu**
- **Michael Tetelbaum**
- **Vladimir Dukkardt**
- **Algasem Zabarah**

The surviving project material supports the following attribution:

| Area | Supported attribution |
| --- | --- |
| **Target-user research and realistic scenarios** | Kevin researched difficulties less experienced and older users commonly face and helped shape realistic example questions |
| **Direct testing and feedback interpretation** | Kevin tested with his grandmother and helped translate observed hesitation into product direction |
| **Product positioning and project communication** | Kevin helped frame Retza as practical computer support rather than a generic chatbot and contributed to the final presentation story |
| **Interface and visual direction** | Vladimir led much of the original interface and visual direction |
| **AI logic and response generation** | Retained presentation material identifies Michael and another teammate through a narrated "Michael and I" statement, but the surviving source does not establish the narrator's identity clearly enough to assign the second name with confidence |
| **Overall product direction** | Collaborative across the team |

Because the original project was collaborative, this portfolio does not use the current repository's Git history as evidence of the original team division.

## 6. Later public showcase

Kevin later prepared the public `Retza-Portfolio` repository to present and extend the original project.

The current showcase preserves the same central usability problem, then carries it further through additional engineering:

- a Windows-first Electron application;
- structured, one-action walkthroughs;
- deterministic Windows navigation for stable tasks;
- bounded parsing of model output;
- prerequisite repair;
- deliberately limited system context;
- optional speech input;
- bounded proactive-help heuristics;
- Windows UI Automation based Show Me targeting;
- candidate scoring and ambiguity rejection;
- actionability and occlusion checks;
- DPI and multi-monitor coordinate handling;
- stale-target revalidation;
- a restricted preload bridge and credential isolation;
- focused automated tests and GitHub Actions verification; and
- a sandboxed browser adaptation that demonstrates the interaction model without pretending to have desktop privileges.

These current systems should be read as the **showcase phase**, not as a claim that every capability existed in the first classroom prototype.

## 7. What stayed constant

Across both phases, the strongest idea remained the same:

**Computer help should be judged by whether the user can confidently complete the next action, not only by whether the software generated a technically correct sentence.**

That principle connects the original user testing to the current fail-closed engineering approach.

## 8. Related documentation

- [Main portfolio README](../README.md)
- [Engineering notes](ENGINEERING.md)
- [Show Me target resolver](../src/main/show-me/target-resolver.ts)
- [Windows UI Automation transport and matcher](../src/main/show-me/windows-uia.ts)
- [Verification workflow](../.github/workflows/verify.yml)
