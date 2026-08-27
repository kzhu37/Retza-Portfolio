# Retza

**Reaching Everybody Through Zero Barrier Accessibility**

A Windows-first desktop accessibility assistant that turns computer questions into plain-language walkthroughs, proactive support, and verified on-screen guidance.

`Electron` · `TypeScript` · `React` · `Gemini` · `Windows UI Automation` · `Vitest`

[![Verify](https://github.com/kzhu37/Retza-Portfolio/actions/workflows/verify.yml/badge.svg)](https://github.com/kzhu37/Retza-Portfolio/actions/workflows/verify.yml)

<p align="center">
  <a href="docs/ENGINEERING.md"><strong>Engineering notes</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/PROJECT_HISTORY.md"><strong>Project history</strong></a>
  &nbsp;·&nbsp;
  <a href="browser-demo/"><strong>Browser adaptation source</strong></a>
</p>

<table>
  <tr>
    <td width="52%">
      <img src="docs/assets/retza-walkthrough.webp" alt="Retza desktop application showing a focused walkthrough with numbered steps">
    </td>
    <td width="48%">
      <img src="docs/assets/retza-show-me.gif" alt="Retza Show Me feature locating and highlighting the next interface control">
    </td>
  </tr>
  <tr>
    <td align="center"><sub><strong>Walkthrough:</strong> one action at a time instead of a dense answer.</sub></td>
    <td align="center"><sub><strong>Show Me:</strong> highlight only after the target has been independently verified.</sub></td>
  </tr>
</table>

Retza began with a simple question: **what if computer help was designed for people who do not already understand computers?**

The first approach focused on patient language, large readable controls, and numbered instructions. That exposed two different problems. First, asking an AI to "be simple" was not enough. A response could still contain unfamiliar terms, combine several actions, or silently assume setup knowledge. The team moved toward more explicit prompting and one-action guidance.

Then direct testing exposed the deeper failure. My grandmother could understand an instruction and still scan the screen because she could not find the button or icon it described. That observation changed the product direction. Retza evolved from a text-focused helper toward guided action, eventually leading to **Show Me**, a visual-guidance system that verifies real Windows interface elements before pointing to them.

> **Core engineering principle:** if Retza cannot confidently verify where a control is, it does not point.

## My role and project provenance

Retza began as a four-person project by **Michael Tetelbaum, Vladimir Dukkardt, Algasem Zabarah, and Kevin Zhu**. My documented original contribution centered on **target-user research, use-case selection, direct user testing, feedback interpretation, product positioning, and project communication**.

I researched common difficulties less experienced computer users face, shaped realistic example questions, tested Retza directly with my grandmother, and helped translate observed hesitation into product direction. Vladimir led much of the original interface and visual direction. Other teammates led more of the original AI implementation, so I do not claim primary ownership of that original subsystem.

I later prepared this public showcase and extended the original concept into the current repository. The showcase adds the present Windows/Electron architecture, defensive Show Me targeting, deterministic navigation, bounded AI-response handling, prerequisite repair, testing and verification, engineering documentation, and the sandboxed browser adaptation. This repository's Git history therefore represents the later showcase phase, not the complete chronology of the original team project.

For the evidence trail and phase-by-phase distinction, see **[Project history and provenance](docs/PROJECT_HISTORY.md)**.

<p align="center">
  <a href="#at-a-glance">At a glance</a> ·
  <a href="#testing-changed-the-product">Iteration</a> ·
  <a href="#show-me-verified-visual-guidance">Show Me</a> ·
  <a href="#architecture-and-trust-boundaries">Architecture</a> ·
  <a href="#verification">Verification</a> ·
  <a href="#run-locally">Run locally</a>
</p>

## At a glance

| Area | Retza |
| --- | --- |
| **Problem** | Computer help often assumes vocabulary and interface knowledge that less experienced users do not have |
| **Product** | Windows-first assistant for questions, focused walkthroughs, proactive help, and visual guidance |
| **Key user insight** | Understandable instructions can still fail when the user cannot locate the relevant control |
| **Technical centerpiece** | Fail-closed Show Me targeting through Windows UI Automation rather than model-generated coordinates |
| **Guidance strategy** | Deterministic Windows navigation for stable tasks, Gemini for broader questions, and prerequisite repair when setup steps are missing |
| **Verification** | Windows CI runs type checking, 103 Vitest tests across six files, and a production build; browser checks add 10 focused Node tests and Playwright regression coverage |
| **Original contribution** | Target-user framing, realistic task selection, direct testing, feedback synthesis, positioning, and communication |
| **Showcase phase** | Later public extension with stronger systems engineering, tests, documentation, and a sandboxed browser adaptation |

## Testing changed the product

Retza was designed for older and less experienced computer users, so the team could not evaluate it only from the perspective of people who already knew where every menu and icon lived.

The retained project materials document testing with my grandmother and with a teammate's younger siblings. The younger testers helped expose unusual or nonsensical questions. Testing with my grandmother produced the more important product insight: **a correct sentence is not necessarily an actionable instruction**.

Her feedback also reinforced why observation mattered. A user can politely say that an instruction makes sense while still hesitating, searching, or being unsure what to click.

| Stage | What failed | Product response |
| --- | --- | --- |
| **Simplify the AI** | "Be simple" could still produce jargon, bundled actions, or hidden assumptions | Make prompts more explicit, prefer concrete language, and separate actions |
| **Guide one action at a time** | A user could understand the current step but still be unable to find the control | Add visual guidance and later build Show Me around verified semantic targets |
| **Offer help proactively** | Too many interventions could become distracting or patronizing | Use bounded interaction signals, cooldowns, and a visible user-controlled Watching mode |
| **Point to real controls** | Approximate or stale highlights could reduce trust | Resolve live UI elements, reject ambiguity, revalidate, and fail closed |

<p align="center">
  <img src="docs/assets/iteration-cycle.svg" alt="Retza development progression from simpler language through prompt refinement and user testing to verified visual guidance" width="100%">
</p>

The main lesson was that a software failure does not always look like a crash. Retza could behave exactly as programmed and still fail the user if the person could not confidently complete the next action.

## Show Me: verified visual guidance

Show Me is Retza's technical centerpiece. A model can describe **what** should be located, but trusted operating-system logic decides **where** that item actually is.

<p align="center">
  <img src="docs/assets/show-me-pipeline.svg" alt="Show Me pipeline from semantic target generation through validation, Windows UI Automation, candidate checks, revalidation, and overlay rendering" width="100%">
</p>

A walkthrough step can describe a semantic target such as:

```text
zone: ui_element
app: Settings
name: Bluetooth
role: Button
action: click
window: Settings
```

Coordinates are intentionally absent from the model-facing contract.

The trusted main process then validates the target, queries the live Windows accessibility tree, scores candidate controls, rejects weak or conflicting evidence, converts Windows geometry into Electron coordinates, and revalidates the same target before and during display.

Candidates can be rejected when they are ambiguous, hidden, disabled, occluded, off-screen, too broad, associated with the wrong window, or no longer consistent with the original observation. The matcher uses a conservative engineering confidence threshold and rejects close competing matches rather than guessing. The threshold is a defensive implementation heuristic, not a claim of experimentally calibrated user accuracy.

The geometry layer explicitly handles DPI scaling and multi-monitor layouts, including negative monitor origins, monitors above the primary display, controls spanning displays, and display-layout changes while guidance is active.

For implementation detail and claim-to-code traceability, see **[Engineering notes](docs/ENGINEERING.md)**.

## Architecture and trust boundaries

<p align="center">
  <img src="docs/assets/architecture.svg" alt="Retza architecture showing the React renderer, restricted preload bridge, trusted Electron main process, Gemini, and Windows UI Automation" width="100%">
</p>

| Layer | Responsibility |
| --- | --- |
| **React renderer** | Chat, walkthrough progress, settings, speech input, fox companion, and Show Me presentation |
| **Restricted preload bridge** | Narrow `contextBridge` surface exposing only required IPC operations |
| **Trusted Electron main process** | API credentials, response validation, context collection, Windows navigation, prerequisites, struggle detection, and Show Me resolution |
| **External systems** | Gemini for broader language guidance and Windows UI Automation for live accessibility evidence |

Both model output and renderer input are treated as untrusted at boundaries where they can affect operating-system guidance.

The same defensive approach applies beyond Show Me. Gemini responses are parsed into a bounded application contract before they reach the walkthrough system. API credentials stay outside the renderer, saved keys use Electron `safeStorage` when available, and limited system context is sanitized before it enters a prompt. The context feature does not read document contents or take screenshots.

Proactive support also stays bounded. Retza does not claim to infer emotion. It reacts only to interaction patterns such as approximately 45 seconds of inactivity, repeated nearby clicks, or a long hover, then applies a cooldown and leaves Watching under user control.

## Major engineering decisions

| Challenge | Decision |
| --- | --- |
| Stable Windows tasks do not need generative uncertainty | Keep deterministic, version-aware navigation knowledge for supported topics |
| Model output may be malformed or overconfident | Parse it into a bounded contract and reject invalid targeting data |
| Correct instructions may still be unusable | Use focused walkthroughs, prerequisite repair, and Show Me |
| Wrong visual guidance can damage trust | Use semantic targeting, ambiguity rejection, actionability checks, occlusion checks, and revalidation |
| Windows and Electron use different coordinate spaces | Model physical pixels, screen DIP, and overlay-local coordinates explicitly |
| Proactive help can become intrusive | Use conservative thresholds, cooldowns, and a visible user-controlled Watching mode |
| A browser cannot reproduce desktop privileges | Demonstrate the interaction model honestly inside a sandbox |

## Verification

Retza's verification emphasizes failure states as much as successful behavior.

The Windows CI suite currently passes **103 Vitest tests across six test files** and performs TypeScript checking plus an Electron production build. Coverage includes malformed AI responses, Windows-version differences, ambiguous UI Automation matches, hidden or disabled controls, stale state, DPI and multi-monitor geometry, duplicated taskbar controls, Show Me lifecycle behavior, and settings validation.

The browser adaptation adds **10 focused Node tests** for semantic target resolution and deterministic scenario routing. Playwright regression checks exercise Show Me success and failure states, revalidation, accessibility settings, responsive layout, reduced motion, secret exposure, and console or network failures.

The repository also runs a writing check that blocks forbidden long-dash characters from portfolio-facing Markdown, HTML, text, and SVG files.

Representative implementation and verification paths:

- [`src/main/show-me/target-resolver.ts`](src/main/show-me/target-resolver.ts)
- [`src/main/show-me/windows-uia.ts`](src/main/show-me/windows-uia.ts)
- [`src/main/show-me/geometry.ts`](src/main/show-me/geometry.ts)
- [`src/main/show-me/lifecycle.ts`](src/main/show-me/lifecycle.ts)
- [`tests/assistant-response.test.ts`](tests/assistant-response.test.ts)
- [`tests/windows-navigation.test.ts`](tests/windows-navigation.test.ts)
- [`browser-demo/tests/target-resolver.node-test.js`](browser-demo/tests/target-resolver.node-test.js)

## From original prototype to current showcase

The original team project established the audience, simplified guidance, friendly interface direction, and the visual-guidance idea. The current showcase carries those ideas further with more defensive systems engineering.

| Original direction | Current showcase |
| --- | --- |
| Simplified AI instructions | Structured one-action walkthroughs with prerequisite repair |
| Minimal, readable interface | Guided flow with progress, accessibility settings, and user-controlled proactive support |
| Visual glow motivated by user testing | Windows UI Automation targeting with live bounds and fail-closed resolution |
| Voice support discussed as a future addition | Speech input implemented |
| Detecting possible struggle explored conceptually | Bounded inactivity, repeated-click, and long-hover heuristics |
| General AI guidance | Hybrid deterministic Windows knowledge plus Gemini |
| Approximate visual guidance concept | Ambiguity rejection, stale-target revalidation, DPI conversion, and multi-monitor handling |
| Early usability focus | Explicit trust boundaries, validation, credential isolation, and verification |

The later engineering stays tied to the same usability problem discovered during testing rather than adding unrelated complexity.

## Browser adaptation

The [`browser-demo`](browser-demo/) folder demonstrates Retza's core interaction model inside a sandboxed browser environment. It is **not** presented as equivalent to the Windows application.

Inside the simulated computer, Show Me resolves accessible DOM names, roles, semantic IDs, visibility, disabled state, and live bounds. Missing, ambiguous, hidden, or disabled targets are rejected rather than guessed.

The browser adaptation cannot inspect other applications, access the live Windows UI Automation tree, monitor system-wide interaction, or display guidance over the desktop. Those capabilities belong to the Windows application.

This separation keeps the demonstration honest: it shows the interaction model and trust boundary without pretending that a web page has desktop privileges.

## Accessibility and scope

The current interface includes adjustable text size, keyboard-operable controls, focus management, ARIA labels and live regions, speech input when Chromium supports it, reduced-motion behavior, focused walkthrough steps, and a visible control to pause proactive monitoring.

Retza should currently be treated as a **Windows-first** application. Exact Show Me locating is implemented through Windows UI Automation. macOS and Linux packaging targets exist, but feature parity is incomplete. Speech recognition currently uses English (`en-US`) when available, the proactive detector uses heuristics rather than emotion recognition, and the project has not undergone formal WCAG certification.

These limits stay explicit because trustworthy guidance is more important than making the system sound more capable than it is.

## Run locally

### Requirements

- Node.js 22.12 or newer and npm
- Windows 10 or Windows 11 for full Show Me functionality
- a Gemini API key for generative questions in the desktop application

### Desktop application

```bash
git clone https://github.com/kzhu37/Retza-Portfolio.git
cd Retza-Portfolio
npm install
npm run dev
```

### Configure Gemini

The easiest option is to open Retza Settings and save a Gemini API key locally.

For development, you can also copy `.env.example` to `.env`:

```env
GEMINI_API_KEY=your_key_here
RETZA_GEMINI_MODEL=gemini-2.5-flash-lite
```

Never commit a real API key.

### Browser adaptation

```bash
npm --prefix browser-demo run build
```

The static output is written to `browser-demo/dist`. Serve that directory with a local static server to exercise deterministic walkthrough and Show Me flows.

### Verify

```bash
npm run verify
```

GitHub Actions extends this with browser-specific Node tests and Playwright regression checks.

## Reflection

> **Building for everyone starts by noticing who gets left behind.**

Retza changed how I think about software design. A feature can work exactly as programmed and still fail the person using it. Simplifying an interface therefore means more than reducing words or buttons. It means finding the assumptions hidden inside each instruction, observing where users hesitate, and redesigning around what they actually experience.

The project also changed how I think about AI-assisted software. Flexible language is useful, but a system that guides real actions needs deterministic checks around uncertain output. Retza became strongest when generative assistance was treated as one component inside a larger engineering system rather than as the system itself.

## Collaboration and credits

Original team: **Michael Tetelbaum, Vladimir Dukkardt, Algasem Zabarah, and Kevin Zhu**.

My original contribution focused on target-user research, realistic task selection, direct testing with my grandmother, feedback synthesis, product positioning, and project communication. The original project was collaborative, and I do not claim primary ownership of subsystems led by teammates.

I later prepared and extended this public showcase. For a more detailed separation between original-team work, retained presentation evidence, and later showcase engineering, see **[Project history and provenance](docs/PROJECT_HISTORY.md)**.
