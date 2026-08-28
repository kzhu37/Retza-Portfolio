# Retza

<p align="center">
  <strong>A Windows-first desktop accessibility assistant that turns computer questions into plain-language walkthroughs, proactive support, and verified on-screen guidance.</strong>
</p>

<p align="center">
  <sub><strong>Retza:</strong> Reaching Everybody Through Zero Barrier Accessibility</sub>
</p>

<p align="center">
  Electron · TypeScript · React · Gemini · Windows UI Automation · Vitest
</p>

<p align="center">
  <a href="https://github.com/kzhu37/Retza-Portfolio/actions/workflows/verify.yml"><img alt="Verify" src="https://github.com/kzhu37/Retza-Portfolio/actions/workflows/verify.yml/badge.svg"></a>
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

Direct testing exposed the problem behind the wording. My grandmother could understand an instruction and still scan the screen because she could not find the button or icon it described. That shifted the product from text-focused help toward guided action and eventually led to **Show Me**, a visual-guidance system that verifies real Windows interface elements before highlighting them.

> **Core engineering principle:** if Retza cannot confidently verify where a control is, it does not point.

Retza began as a four-person project. The current repository is my later showcase and engineering extension of that concept. Original team work and later repository work are separated in [Project history and provenance](docs/PROJECT_HISTORY.md), with the retained evidence summarized in [Original project evidence](docs/ORIGINAL_PROJECT_EVIDENCE.md).

<p align="center">
  <a href="#at-a-glance">Overview</a> ·
  <a href="#show-me-verified-visual-guidance">Show Me</a> ·
  <a href="#testing-changed-the-product">Iteration</a> ·
  <a href="#architecture-and-trust-boundaries">Architecture</a> ·
  <a href="#engineering-tradeoffs">Tradeoffs</a> ·
  <a href="#verification">Verification</a> ·
  <a href="#project-phases">History</a> ·
  <a href="#run-locally">Run locally</a> ·
  <a href="#contribution-and-collaboration">Contribution</a>
</p>

## At a glance

| Area | Retza |
| --- | --- |
| **Problem** | Computer help often assumes vocabulary and interface knowledge that less experienced users do not have |
| **Key user insight** | Understandable instructions can still fail when the user cannot locate the relevant control |
| **Technical centerpiece** | Fail-closed Show Me targeting through Windows UI Automation rather than model-generated coordinates |
| **Guidance strategy** | Deterministic Windows navigation for stable tasks, Gemini for broader questions, and prerequisite repair when setup steps are missing |
| **Trust model** | Model output and renderer input are validated before they can affect operating-system guidance |
| **Verification** | Windows CI runs type checking, 103 Vitest tests across six files, and a production build; browser checks add 10 focused Node tests and Playwright regression coverage |
| **Original contribution** | Target-user research, realistic task selection, direct testing with my grandmother, feedback synthesis, positioning, and communication |
| **Later repository phase** | Windows/Electron architecture, defensive Show Me targeting, deterministic navigation, bounded AI-response handling, prerequisite repair, verification, engineering documentation, and a sandboxed browser adaptation |

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

The trusted Electron main process validates the target, queries the live Windows accessibility tree, scores candidate controls, rejects weak or conflicting evidence, converts Windows geometry into Electron coordinates, and revalidates the same target before and during display.

Candidates can be rejected when they are ambiguous, hidden, disabled, occluded, off-screen, too broad, associated with the wrong window, or no longer consistent with the original observation. The matcher uses a default engineering confidence threshold of **0.78** and a **0.10 ambiguity gap**. These values are defensive heuristics, not experimentally calibrated claims about user-facing accuracy.

The geometry layer handles DPI scaling and multi-monitor layouts, including negative monitor origins, monitors above the primary display, controls spanning displays, and layout changes while guidance is active.

### Why refusal is part of the feature

A visual guide can be worse than no guide if it points confidently to the wrong place. Retza therefore accepts some missed highlights rather than lowering the evidence threshold and guessing. If two candidates are too close, the target is stale, a control is covered, or the available evidence is incomplete, Show Me can refuse to display a highlight and ask the user to try again.

That choice makes **false negatives preferable to false confidence** when Retza affects a real desktop.

See **[Engineering notes](docs/ENGINEERING.md)** for implementation detail and claim-to-code traceability.

## Testing changed the product

Retza was designed for older and less experienced computer users, so the team could not evaluate it only from the perspective of people who already knew where every menu and icon lived.

The retained project materials document testing with my grandmother and with a teammate's younger siblings. The younger testers helped expose unusual or nonsensical questions. Testing with my grandmother produced the more important insight: **a correct sentence is not necessarily an actionable instruction**.

Observation mattered as much as verbal feedback. A user can say that an instruction makes sense while still hesitating or searching. The goal became **designing for confidence, not just functionality**.

| Stage | What failed | Product response |
| --- | --- | --- |
| **Simplify the AI** | "Be simple" could still produce jargon, bundled actions, or hidden assumptions | Make prompts more explicit, prefer concrete language, and separate actions |
| **Guide one action at a time** | A user could understand the step but still be unable to find the control | Add visual guidance and later build Show Me around verified semantic targets |
| **Offer help proactively** | Too many interventions could become distracting or patronizing | Use bounded interaction signals, cooldowns, and a visible user-controlled Watching mode |
| **Point to real controls** | Approximate or stale highlights could reduce trust | Resolve live UI elements, reject ambiguity, revalidate, and fail closed |

<p align="center">
  <img src="docs/assets/iteration-cycle.svg" alt="Retza development progression from simpler language through prompt refinement and user testing to verified visual guidance" width="100%">
</p>

The original testing was exploratory and qualitative. This repository does not claim task-completion percentages, calibrated targeting accuracy, or formal accessibility-study results that were not measured.

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

Both model output and renderer input are treated as untrusted where they can affect operating-system guidance. Gemini responses are parsed into a bounded application contract before reaching the walkthrough system. API credentials stay outside the renderer, saved keys use Electron `safeStorage` when available, and limited system context is sanitized before entering a prompt.

Proactive support is similarly bounded. Retza does not claim to infer emotion. It reacts only to interaction patterns such as approximately 45 seconds of inactivity, repeated nearby clicks, or a long hover, then applies a cooldown and leaves Watching under user control.

## Engineering tradeoffs

The most important decisions were not feature choices alone. Each one traded convenience or coverage for a property Retza needed more.

| Problem | Decision | Cost or tradeoff |
| --- | --- | --- |
| Stable Windows procedures do not need generative uncertainty | Keep deterministic, version-aware navigation knowledge for supported topics | Curated paths require maintenance when Windows changes |
| A model should not choose physical screen positions | Resolve semantic targets against live Windows UI Automation evidence | Some targets are refused even when a looser matcher might guess |
| The OS bridge needs to stay bounded and inspectable | Launch a fixed PowerShell UI Automation worker with structured query data | Cold-start latency can be higher than a warm native helper process |
| Correct text can still assume missing setup | Detect known prerequisite gaps and prepend deterministic repair steps | Coverage is intentionally limited to prerequisites the application can identify reliably |
| Proactive help can become intrusive | Use conservative thresholds, cooldowns, and a visible Watching control | Retza deliberately misses some possible moments of struggle |
| A browser cannot reproduce desktop privileges | Demonstrate the interaction model honestly inside a sandbox | The browser adaptation cannot inspect other applications or prove Windows UIA behavior |

The PowerShell transport is a deliberate example of the engineering approach. Untrusted target text is passed as structured data rather than interpolated into executable PowerShell source, and each query runs in a bounded worker process. A production evolution could keep a narrowly scoped native helper warm to reduce startup cost, but the current design favors inspectability and failure isolation over minimum latency.

## Verification

Retza's verification emphasizes failure states as much as successful behavior.

The Windows CI suite runs **103 Vitest tests across six test files** plus TypeScript checking and an Electron production build. Coverage includes malformed AI responses, Windows-version differences, ambiguous UI Automation matches, hidden or disabled controls, stale state, DPI and multi-monitor geometry, duplicated taskbar controls, Show Me lifecycle behavior, and settings validation.

The browser adaptation adds **10 focused Node tests** for semantic target resolution and deterministic scenario routing. Playwright regression checks exercise Show Me success and failure states, revalidation, accessibility settings, responsive layout, reduced motion, secret exposure, and console or network failures.

The repository also runs a writing check that blocks forbidden long-dash characters from public-facing Markdown, HTML, text, and SVG files.

Representative paths:

- [`src/main/show-me/target-resolver.ts`](src/main/show-me/target-resolver.ts)
- [`src/main/show-me/windows-uia.ts`](src/main/show-me/windows-uia.ts)
- [`src/main/show-me/geometry.ts`](src/main/show-me/geometry.ts)
- [`src/main/show-me/lifecycle.ts`](src/main/show-me/lifecycle.ts)
- [`tests/assistant-response.test.ts`](tests/assistant-response.test.ts)
- [`tests/windows-navigation.test.ts`](tests/windows-navigation.test.ts)
- [`browser-demo/tests/target-resolver.node-test.js`](browser-demo/tests/target-resolver.node-test.js)

For a full implementation-to-test map, see **[Engineering notes](docs/ENGINEERING.md)**.

## Project phases

Retza has two distinct development phases. The original team project established the audience, simplified guidance, direct testing, friendly interface direction, and the visual-guidance idea. The later repository phase carries those ideas further through more defensive systems engineering.

<p align="center">
  <img src="docs/assets/project-phases.svg" alt="Retza project phases from the original collaborative accessibility project to the later Windows engineering extension" width="100%">
</p>

| Original direction | Current repository |
| --- | --- |
| Simplified AI instructions | Structured one-action walkthroughs with prerequisite repair |
| Minimal, readable interface | Guided flow with progress, accessibility settings, and user-controlled proactive support |
| Visual glow motivated by user testing | Windows UI Automation targeting with live bounds and fail-closed resolution |
| Voice support discussed as a future addition | Speech input implemented |
| Detecting possible struggle explored conceptually | Bounded inactivity, repeated-click, and long-hover heuristics |
| General AI guidance | Hybrid deterministic Windows knowledge plus Gemini |
| Approximate visual-guidance concept | Ambiguity rejection, stale-target revalidation, DPI conversion, and multi-monitor handling |

For the supporting chronology, evidence boundaries, and original-team attribution, see **[Original project evidence](docs/ORIGINAL_PROJECT_EVIDENCE.md)** and **[Project history and provenance](docs/PROJECT_HISTORY.md)**.

## Browser adaptation and scope

The [`browser-demo`](browser-demo/) folder demonstrates Retza's interaction model inside a sandboxed browser environment. It is **not** equivalent to the Windows application.

Inside the simulated computer, Show Me resolves accessible DOM names, roles, semantic IDs, visibility, disabled state, and live bounds. Missing, ambiguous, hidden, or disabled targets are rejected rather than guessed. The root [`api/`](api/) folder provides the optional server-side provider boundary used by a hosted browser build, keeping provider credentials out of client-side code.

The browser cannot inspect other applications, access Windows UI Automation, monitor system-wide interaction, or display guidance over the real desktop. Those capabilities remain specific to the Windows/Electron implementation.

The desktop interface includes adjustable text size, keyboard-operable controls, focus management, ARIA labels and live regions, speech input when Chromium supports it, reduced-motion behavior, focused walkthrough steps, and a visible control to pause proactive monitoring.

Retza is currently **Windows-first**. Exact Show Me locating uses Windows UI Automation. macOS and Linux packaging targets exist, but feature parity is incomplete. Speech recognition currently uses English (`en-US`) when available, the proactive detector uses heuristics rather than emotion recognition, and the project has not undergone formal WCAG certification.

See **[Browser adaptation documentation](browser-demo/README.md)** for supported scenarios, local use, and verification.

## Run locally

### Desktop application

Requirements: Node.js 22.12 or newer, npm, Windows 10 or 11 for full Show Me functionality, and a Gemini API key for generative questions.

```bash
git clone https://github.com/kzhu37/Retza-Portfolio.git
cd Retza-Portfolio
npm install
npm run dev
```

Save a Gemini API key through Retza Settings, or copy `.env.example` to `.env` during development:

```env
GEMINI_API_KEY=your_key_here
RETZA_GEMINI_MODEL=gemini-2.5-flash-lite
```

Never commit a real API key.

### Browser adaptation

```bash
npm --prefix browser-demo run build
```

Serve `browser-demo/dist` with a local static server to exercise deterministic walkthrough and Show Me flows.

### Verify

```bash
npm run verify
npm --prefix browser-demo run verify
```

GitHub Actions also runs the browser Playwright regression suite.

## Reflection

> **Building for everyone starts by noticing who gets left behind.**

Retza changed how I think about software design. A feature can work exactly as programmed and still fail the person using it. Simplifying an interface means finding assumptions hidden inside instructions, observing where users hesitate, and redesigning around what they actually experience.

It also changed how I think about AI-assisted software. Flexible language is useful, but a system that guides real actions needs deterministic checks around uncertain output. Retza became strongest when generative assistance was treated as one component inside a larger engineering system rather than as the system itself.

## Contribution and collaboration

The original four-person team was **Michael Tetelbaum, Vladimir Dukkardt, Algasem Zabarah, and Kevin Zhu**.

My documented original contribution focused on **target-user research, realistic task selection, direct testing with my grandmother, feedback interpretation, product positioning, and project communication**. Vladimir led much of the original interface and visual direction. Retained material indicates that other teammates led much of the original AI implementation, so I do not claim primary ownership of that subsystem.

The current repository is my later showcase and engineering extension of the original concept. It adds the present Windows/Electron architecture, defensive Show Me targeting, deterministic navigation, bounded AI-response handling, prerequisite repair, testing and verification, engineering documentation, and the sandboxed browser adaptation. Its Git history documents this later phase, not the full chronology of the original team project.

For the evidence trail and fuller phase-by-phase distinction, see **[Project history and provenance](docs/PROJECT_HISTORY.md)**.
