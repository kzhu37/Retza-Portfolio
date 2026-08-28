# Retza

<p align="center">
  <strong>A Windows-first desktop accessibility assistant that turns computer questions into plain-language walkthroughs and verified on-screen guidance.</strong>
</p>

<p align="center">
  <sub><strong>Retza:</strong> Reaching Everybody Through Zero Barrier Accessibility</sub>
</p>

<p align="center">
  Electron · TypeScript · Windows UI Automation · React · Gemini · Vitest
</p>

<p align="center">
  <a href="https://github.com/kzhu37/Retza-Portfolio/actions/workflows/verify.yml"><img alt="Verify" src="https://github.com/kzhu37/Retza-Portfolio/actions/workflows/verify.yml/badge.svg"></a>
</p>

<table>
  <tr>
    <td width="52%">
      <img src="docs/assets/retza-walkthrough.webp" alt="Retza Windows desktop application showing a focused walkthrough with numbered steps">
    </td>
    <td width="48%">
      <img src="docs/assets/retza-show-me.gif" alt="Retza Windows Show Me feature locating and highlighting the next interface control">
    </td>
  </tr>
  <tr>
    <td align="center"><sub><strong>Windows walkthrough:</strong> one action at a time instead of a dense answer.</sub></td>
    <td align="center"><sub><strong>Windows Show Me:</strong> highlight only after the target has been independently verified.</sub></td>
  </tr>
</table>

Retza began with a simple question: **what if computer help was designed for people who do not already understand computers?**

Direct testing exposed the deeper problem. My grandmother could understand an instruction and still scan the screen because she could not find the button or icon it described. That shifted the project from text-focused help toward guided action and eventually led to **Show Me**, a visual-guidance system that verifies real Windows interface elements before highlighting them.

> **Core engineering principle:** if Retza cannot confidently verify where a control is, it does not point.

Retza began as a four-person project. My documented original contribution centered on target-user research, realistic task selection, direct testing with my grandmother, feedback interpretation, product positioning, and project communication. The current repository is my later Windows engineering extension of that concept. See [Project history and provenance](docs/PROJECT_HISTORY.md) for the full phase and attribution record.

<p align="center">
  <a href="#at-a-glance">Overview</a> ·
  <a href="#show-me-verified-visual-guidance">Show Me</a> ·
  <a href="#testing-changed-the-product">Iteration</a> ·
  <a href="#architecture-and-trust-boundaries">Architecture</a> ·
  <a href="#engineering-decisions">Decisions</a> ·
  <a href="#verification">Verification</a> ·
  <a href="#project-evolution">History</a> ·
  <a href="#run-locally">Run locally</a> ·
  <a href="#contribution-and-collaboration">Contribution</a>
</p>

## At a glance

| Area | Retza |
| --- | --- |
| **Problem** | Computer help often assumes vocabulary and interface knowledge that less experienced users do not have |
| **Key user insight** | Understandable instructions can still fail when the user cannot locate the relevant control |
| **Technical centerpiece** | Fail-closed Show Me targeting through Windows UI Automation rather than model-generated coordinates |
| **Guidance strategy** | Deterministic Windows navigation for stable tasks, Gemini for broader questions, and prerequisite repair |
| **Trust model** | Model output and renderer input are validated before they can affect operating-system guidance |
| **Verification** | 103 desktop Vitest tests, 10 focused browser Node tests, type checking, production builds, and Playwright regression coverage |

**Core implementation:** [`target-resolver.ts`](src/main/show-me/target-resolver.ts) · [`windows-uia.ts`](src/main/show-me/windows-uia.ts) · [`geometry.ts`](src/main/show-me/geometry.ts) · [`assistant-response.ts`](src/main/assistant-response.ts) · [`windows-navigation.ts`](src/main/windows-navigation.ts)

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

Coordinates are intentionally absent from the model-facing contract. The Electron main process validates the target, queries the live Windows accessibility tree, scores candidates, converts Windows geometry into Electron coordinates, and revalidates the target before and during display.

Candidates can be rejected when they are ambiguous, hidden, disabled, occluded, off-screen, too broad, associated with the wrong window, or stale. The matcher uses a default engineering confidence threshold of **0.78** and a **0.10 ambiguity gap**. These are defensive heuristics, not experimentally calibrated claims about user-facing accuracy.

<p align="center">
  <img src="docs/assets/show-me-outcomes.svg" alt="Show Me comparison showing verified guidance versus refusal when evidence is ambiguous, blocked, stale, or incomplete" width="100%">
</p>

### Why refusal is part of the feature

A visual guide can be worse than no guide if it points confidently to the wrong place. Retza therefore accepts some missed highlights rather than lowering the evidence threshold and guessing.

The geometry layer handles DPI scaling and multi-monitor layouts, including negative monitor origins, monitors above the primary display, controls spanning displays, and display changes while guidance is active. This makes **false negatives preferable to false confidence** when Retza affects a real desktop.

For the matcher, transport, geometry, and lifecycle design, see [Engineering notes](docs/ENGINEERING.md).

## Testing changed the product

The retained materials document testing with my grandmother and with a teammate's younger siblings. The younger testers exposed unusual and nonsensical questions. Testing with my grandmother produced the more consequential insight: **a correct sentence is not necessarily an actionable instruction**.

Observation mattered as much as verbal feedback. A user can say an instruction makes sense while still hesitating or searching. The team also did not always agree on what counted as "simple," which made user evidence more useful than internal consensus.

| Stage | What failed | Product response |
| --- | --- | --- |
| **Simplify the AI** | "Be simple" could still produce jargon, bundled actions, or hidden assumptions | Make prompts more explicit and separate actions |
| **Guide one action at a time** | The user could understand a step but still not find the control | Add visual guidance and later verified semantic targets |
| **Offer help proactively** | Too many interventions could become distracting or patronizing | Use bounded signals, cooldowns, and a visible Watching control |
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
| **Trusted Electron main process** | Credentials, response validation, system context, Windows navigation, prerequisites, proactive-help logic, and Show Me resolution |
| **External systems** | Gemini for broader language guidance and Windows UI Automation for live accessibility evidence |

Model output and renderer input are treated as untrusted where they can affect operating-system guidance. Gemini responses are parsed into a bounded contract before reaching the walkthrough system. Credentials stay outside the renderer, saved keys use Electron `safeStorage` when available, and system context is deliberately limited and sanitized.

Retza does not claim to infer emotion. Proactive help uses bounded interaction patterns such as inactivity, repeated nearby clicks, or a long hover, then applies a cooldown and leaves Watching under user control.

## Engineering decisions

| Engineering problem | Decision | Tradeoff |
| --- | --- | --- |
| Stable Windows procedures do not need generative uncertainty | Keep deterministic, version-aware navigation for supported topics | Curated paths require maintenance |
| A model should not choose physical screen positions | Resolve semantic targets against live Windows UI Automation evidence | Some targets are intentionally refused |
| The OS bridge needs to stay bounded and inspectable | Launch fixed PowerShell UI Automation source with structured query data | Cold-start latency is higher than a warm helper |
| Correct text can still assume missing setup | Detect known prerequisite gaps and prepend deterministic repair steps | Coverage is limited to known prerequisites |
| Proactive help can become intrusive | Use conservative thresholds, cooldowns, and a visible Watching control | Some possible moments of struggle are missed |

The PowerShell transport follows the same trust model: target text is passed as structured data instead of being interpolated into executable source, and searches are bounded by window, node, candidate, and time limits.

## Verification

Retza's verification emphasizes failure states as much as successful behavior.

The Windows CI suite runs **103 Vitest tests across six files** plus TypeScript checking and an Electron production build. Coverage includes malformed AI responses, Windows-version differences, ambiguous UI Automation matches, hidden or disabled controls, stale state, DPI and multi-monitor geometry, duplicated taskbar controls, Show Me lifecycle behavior, and settings validation.

The browser adaptation adds **10 focused Node tests** plus Playwright regression coverage for Show Me success and failure states, revalidation, accessibility settings, responsive layout, reduced motion, secret exposure, and console or network failures.

The repository also runs a writing audit that rejects long-dash Unicode characters from portfolio prose and interface source.

Representative paths: [`windows-uia.test.ts`](src/main/show-me/windows-uia.test.ts) · [`geometry.test.ts`](src/main/show-me/geometry.test.ts) · [`assistant-response.test.ts`](tests/assistant-response.test.ts) · [`windows-navigation.test.ts`](tests/windows-navigation.test.ts) · [`local-browser.mjs`](browser-demo/tests/local-browser.mjs)

For the full implementation-to-test map, see [Engineering notes](docs/ENGINEERING.md).

## Project evolution

Retza has two distinct development phases. The original collaborative project established the audience, simplified guidance, direct testing, and the visual-guidance idea. The later repository phase extends that reasoning through more defensive Windows systems engineering.

<p align="center">
  <img src="docs/assets/project-phases.svg" alt="Retza project phases from the original collaborative accessibility project to the later Windows engineering extension" width="100%">
</p>

The original phase explored plain-language help, visual guidance, proactive support, and voice input. The later repository adds structured one-action walkthroughs, prerequisite repair, speech input, bounded interaction heuristics, deterministic Windows knowledge, UI Automation targeting, ambiguity rejection, stale-target revalidation, DPI conversion, and multi-monitor handling.

For the supporting chronology and evidence boundaries, see [Project history and provenance](docs/PROJECT_HISTORY.md) and [Original project evidence](docs/ORIGINAL_PROJECT_EVIDENCE.md).

## Browser adaptation and scope

The [`browser-demo`](browser-demo/) folder demonstrates Retza's interaction model inside a sandboxed browser environment. It is not equivalent to the Windows application.

Inside the simulated computer, Show Me resolves accessible DOM names, roles, semantic IDs, visibility, disabled state, and live bounds, then rejects missing, ambiguous, hidden, or disabled targets. The browser cannot inspect other applications, access Windows UI Automation, monitor system-wide interaction, or display guidance over the real desktop.

Retza is currently **Windows-first**. Exact Show Me locating uses Windows UI Automation. macOS and Linux packaging targets exist, but feature parity is incomplete. Speech recognition currently uses English (`en-US`) when available, proactive detection uses heuristics rather than emotion recognition, and the project has not undergone formal WCAG certification.

See [Browser adaptation documentation](browser-demo/README.md) for supported scenarios and local use.

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

The current repository is my later engineering extension of the original concept. It adds the present Windows/Electron architecture, defensive Show Me targeting, deterministic navigation, bounded AI-response handling, prerequisite repair, testing and verification, engineering documentation, and the sandboxed browser adaptation. Its Git history documents this later phase, not the full chronology of the original team project.

For the evidence trail and fuller phase-by-phase distinction, see [Project history and provenance](docs/PROJECT_HISTORY.md).
