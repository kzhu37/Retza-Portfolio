# Retza

**Reaching Everybody Through Zero Barrier Accessibility**

A Windows-first desktop accessibility assistant that turns computer questions into plain-language walkthroughs, proactive support, and verified on-screen guidance.

`Electron` · `TypeScript` · `React` · `Gemini` · `Windows UI Automation` · `Vitest`

<p align="center">
  <strong><a href="https://retza-live-demo.vercel.app/">Try the live browser demo</a></strong>
</p>

> **Project scope:** Retza began as a four-person accessibility project. My original role centered on target-user research, use-case selection, direct user testing, feedback interpretation, product direction, and project communication. The Windows application itself is team-built.

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
    <td align="center"><sub><strong>Show Me:</strong> point only after the target has been independently verified.</sub></td>
  </tr>
</table>

Retza began with a simple question: **what if computer help was designed for people who do not already understand computers?**

Early versions focused on a large input box, patient language, short numbered steps, and prompts that avoided jargon. Testing exposed a deeper problem. A person could understand an instruction and still be unable to find the button or icon it described.

That observation changed the project. Retza evolved from a text-focused AI helper into a desktop companion with one-step walkthroughs, limited system context, prerequisite repair, proactive-help heuristics, voice input, and **Show Me**, a visual-guidance system that independently verifies real Windows interface elements before pointing to them.

> **Core engineering principle:** if Retza cannot confidently verify where a control is, it does not point.

<p align="center">
  <a href="#at-a-glance">At a glance</a> ·
  <a href="#my-contribution">My contribution</a> ·
  <a href="#iterative-empathy">Iteration</a> ·
  <a href="#how-show-me-works">Show Me</a> ·
  <a href="#architecture-and-trust-boundaries">Architecture</a> ·
  <a href="#testing-and-reliability">Testing</a> ·
  <a href="#live-browser-demo">Browser demo</a> ·
  <a href="#run-locally">Run locally</a>
</p>

## At a glance

| Area | Retza |
| --- | --- |
| **Problem** | Computer help often assumes vocabulary and interface knowledge that less experienced users do not have |
| **Product** | Windows-first assistant for questions, focused walkthroughs, proactive help, and visual guidance |
| **Technical centerpiece** | Fail-closed Show Me targeting through Windows UI Automation rather than model-generated coordinates |
| **Product insight** | Testing showed that understandable instructions can still fail when a user cannot locate the relevant control |
| **Guidance strategy** | Deterministic Windows navigation for stable tasks, Gemini for broader questions, and prerequisite repair when setup steps are missing |
| **My original role** | Target-user research, task selection, direct testing, feedback interpretation, product direction, accessibility framing, and communication |
| **Team** | Michael Tetelbaum, Vladimir Dukkardt, Algasem Zabarah, and Kevin Zhu |
| **Verification** | Windows CI runs type checking, 103 Vitest tests across six files, and a production build; browser checks add 10 focused Node tests and Playwright regression coverage |

## My contribution

Retza is strongest when the collaboration boundary is explicit. I did not build every part of the system individually.

My original work centered on **understanding the user and turning observed difficulty into product decisions**. I researched common computer tasks that older or less experienced users struggle with, helped shape the example questions and testing scenarios, tested the product directly with my grandmother and other potential users, interpreted what people did rather than relying only on whether they said an instruction was clear, and helped communicate the accessibility problem and the direction of the product.

The most important observation from that work was simple:

> **A user can understand the instruction and still not know where to act.**

That gap helped move Retza toward visual guidance. The product stopped treating wording as the whole accessibility problem and started treating control discoverability, missing prerequisite knowledge, user confidence, and intervention timing as engineering constraints.

| Area | Contribution boundary |
| --- | --- |
| **Target-user research and task selection** | I focused on the audience, common pain points, example questions, and testing scenarios |
| **Direct testing and feedback interpretation** | I tested with my grandmother and other potential users and helped translate hesitation and search behavior into product changes |
| **Product direction and accessibility framing** | I helped refine what "zero barrier" should mean in practice, including one-action steps and visual guidance |
| **AI behavior and response generation** | Michael Tetelbaum and Algasem Zabarah focused more heavily on this area; prompt refinement and broader iteration were collaborative |
| **Interface and product look** | Vladimir Dukkardt led much of the interface design and visual direction |
| **Current Windows system** | Team-built, with the public showcase version documenting and extending the original project rather than presenting it as solo work |

## Iterative empathy

Our original presentation described the process as **iterative empathy**: watch what people actually do, find the assumptions hidden inside the interface, and redesign around the failure.

Testing included older users and younger family members. My grandmother represented the audience Retza was primarily designed for. Younger users also helped stress-test the assistant with less predictable questions and interaction patterns.

The most useful feedback was behavioral. A user could repeat an instruction correctly and still search the screen for the control. That meant the language was understandable, but the task was not yet actionable.

| What testing exposed | What it meant | Product response |
| --- | --- | --- |
| Users could understand a sentence but still search for the button | Language clarity did not guarantee actionability | Add Show Me visual guidance |
| "Simple" instructions could still skip knowledge the user did not have | Shorter was not always clearer | Use one-action steps and prerequisite repair |
| Terms such as "settings menu" or "drag and drop" could assume prior knowledge | Familiar computer vocabulary is not universal | Refine prompts and deterministic guidance around concrete actions |
| Proactive help could become intrusive | Support also needs user control | Use conservative thresholds, a cooldown, and a visible Watching control |
| Approximate visual guidance could reduce trust | Wrong guidance can be worse than no guidance | Resolve semantic UI targets and fail closed when confidence is weak |

<p align="center">
  <img src="docs/assets/iteration-cycle.svg" alt="Retza iteration cycle from simpler text through user testing to verified visual guidance" width="100%">
</p>

The lesson was that a software failure does not always look like a crash. Retza could behave exactly as programmed and still fail the user if the person could not confidently complete the next action.

## What Retza does

- Converts computer questions into focused, one-action-at-a-time walkthroughs.
- Uses [deterministic Windows navigation knowledge](src/main/windows-navigation.ts) for supported tasks such as Bluetooth, Wi-Fi, display settings, sound output, Windows Update, app removal, Windows Search, and Device Manager.
- Uses Gemini for broader questions, then treats the response as untrusted input through a [bounded response parser](src/main/assistant-response.ts).
- Uses [prerequisite detection](src/main/prereq-detector.ts) to add missing setup steps when a walkthrough assumes something the user has not done yet.
- Builds a deliberately limited [system context](src/main/system-context.ts) so instructions can better match the user's environment.
- Uses **Show Me** to resolve semantic targets through Windows UI Automation rather than trusting a model to invent screen coordinates.
- Uses conservative [interaction heuristics](src/main/struggle-detector.ts) to offer help without claiming to know a user's emotional state.
- Supports speech input, adjustable text sizes, keyboard interaction, focus management, and reduced-motion behavior.

## How Show Me works

Show Me is Retza's technical centerpiece. The model can describe **what** should be located, but trusted operating-system logic decides **where** that item actually is.

<p align="center">
  <img src="docs/assets/show-me-pipeline.svg" alt="Show Me pipeline from semantic target generation through Windows UI Automation, candidate scoring, coordinate conversion, revalidation, and overlay rendering" width="100%">
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

The trusted main process then:

1. validates the target fields and supported action;
2. queries the live Windows accessibility tree;
3. scores matching candidates using accessible names, Automation IDs, control roles, process and window identity, visibility, and supported interaction patterns;
4. rejects ambiguous, hidden, disabled, occluded, off-screen, or insufficiently specific candidates;
5. converts Windows physical-pixel geometry into Electron display coordinates;
6. revalidates the same target before and during display; and
7. dismisses the guide if the evidence is no longer trustworthy.

The current matcher uses a default confidence threshold of **0.78** and rejects close competing matches rather than guessing.

The geometry layer explicitly handles DPI scaling and multi-monitor layouts, including negative monitor origins, monitors positioned above the primary display, controls spanning displays, and display-layout changes while guidance is active.

For a deeper implementation walkthrough, see **[Engineering notes](docs/ENGINEERING.md)**.

## Architecture and trust boundaries

<p align="center">
  <img src="docs/assets/architecture.svg" alt="Retza architecture showing the React renderer, restricted preload bridge, trusted Electron main process, Gemini, and Windows UI Automation" width="100%">
</p>

Retza separates presentation from the systems that hold credentials, inspect Windows state, and resolve screen geometry.

| Layer | Responsibility |
| --- | --- |
| **React renderer** | Chat, walkthrough progress, settings, speech input, fox companion, and Show Me presentation |
| **Restricted preload bridge** | Narrow `contextBridge` surface exposing only required IPC operations |
| **Trusted Electron main process** | API credentials, response validation, context collection, Windows navigation, prerequisites, struggle detection, and Show Me resolution |
| **External systems** | Gemini for broader language guidance and Windows UI Automation for live accessibility signals |

Both AI output and renderer input are treated as untrusted at boundaries where they can affect operating-system guidance.

### Defensive AI integration

Gemini responses are parsed into a bounded application contract rather than inserted directly into the interface as trusted commands. Retza validates step structure, enum values, target fields, and response size before data reaches the walkthrough system.

The Gemini API key stays outside the renderer. Saved keys use Electron `safeStorage` when available, and the renderer only receives whether a key is configured.

### Limited system context

Retza can build a read-only view of selected system facts so instructions better match the user's environment. Depending on platform support, this can include Windows version, browser availability, selected running process names, visible browser-window titles, taskbar and Desktop shortcut names, and common email-client availability.

The context scanner does not read document contents or take screenshots for this feature. Collected strings are sanitized and treated as untrusted data before they are included in a prompt.

## Proactive help without pretending to read emotions

The original project explored whether Retza could notice when someone might be stuck without requiring them to ask for help first.

The implementation deliberately avoids claiming to infer frustration or emotion. It reacts only to bounded interaction patterns, including approximately 45 seconds of inactivity, repeated nearby clicks, or a long hover around the same area. A cooldown limits repeated interventions, and the user can pause Watching from the main interface.

The design principle is conservative: **offer a low-cost opportunity for help, but keep control with the user.**

## Testing and reliability

Retza's verification focuses on failure states as much as successful behavior.

The Windows CI suite currently passes **103 Vitest tests across six test files** and performs TypeScript checking plus an Electron production build. Coverage includes:

- malformed and oversized AI responses;
- Windows 10 and Windows 11 navigation differences;
- ambiguous UI Automation matches;
- hidden, disabled, off-screen, and occluded controls;
- stale target and changed-window handling;
- DPI scaling and multi-monitor geometry;
- duplicated taskbar controls;
- Show Me lifecycle behavior; and
- settings validation.

The browser adaptation adds **10 focused Node tests** for semantic target resolution and deterministic scenario routing. Playwright regression checks cover the public demo's main flows, Show Me success and failure states, revalidation, accessibility settings, responsive layout, reduced motion, secret exposure, same-origin requests, and console/network failures.

The most relevant implementation and test files are:

- [`src/main/show-me/target-resolver.ts`](src/main/show-me/target-resolver.ts)
- [`src/main/show-me/windows-uia.ts`](src/main/show-me/windows-uia.ts)
- [`src/main/show-me/geometry.ts`](src/main/show-me/geometry.ts)
- [`src/main/show-me/lifecycle.ts`](src/main/show-me/lifecycle.ts)
- [`tests/assistant-response.test.ts`](tests/assistant-response.test.ts)
- [`tests/windows-navigation.test.ts`](tests/windows-navigation.test.ts)
- [`browser-demo/tests/target-resolver.node-test.js`](browser-demo/tests/target-resolver.node-test.js)

## Live browser demo

The **[live browser demo](https://retza-live-demo.vercel.app/)** makes Retza's product idea testable without pretending that a web page has desktop privileges.

It includes deterministic walkthroughs for Bluetooth, Wi-Fi, display settings, sound output, Windows Update, app removal, Windows Search, and Device Manager. Inside the simulated computer, Show Me resolves accessible DOM names, roles, semantic IDs, live visibility, and current element bounds. Missing, ambiguous, hidden, or disabled targets are rejected rather than guessed.

The browser demo is intentionally sandboxed. It cannot inspect other applications, access the real Windows UI Automation tree, monitor system-wide interaction, or display guidance over the desktop. Those capabilities belong to the Windows application.

Broader chat is routed through a server-side function when a configured provider is available. The public demo remains useful when generative AI is unavailable because its core scenarios and Show Me behavior are deterministic.

This separation makes the demo a proof of the product's interaction model and trust boundary rather than a fake browser reimplementation of Windows UI Automation.

## Major engineering decisions

| Challenge | Decision |
| --- | --- |
| Stable Windows tasks do not need generative uncertainty | Keep deterministic, version-aware navigation knowledge for supported topics |
| AI output may be malformed or overconfident | Parse it into a bounded contract and reject invalid targeting data |
| Correct instructions may still be unusable | Add focused walkthroughs, prerequisite repair, and Show Me |
| Wrong visual guidance can damage trust | Use semantic targeting, confidence scoring, ambiguity rejection, actionability checks, occlusion checks, and revalidation |
| Windows and Electron use different coordinate spaces | Model physical pixels, screen DIP, and overlay-local coordinates explicitly |
| Proactive help can become intrusive | Use conservative thresholds, cooldowns, and a visible user-controlled Watching mode |
| A browser demo cannot reproduce desktop privileges | Demonstrate the interaction model honestly inside a sandbox |

## How Retza evolved

| Earlier stage | Current version |
| --- | --- |
| AI helper focused mainly on simplified text | Structured, context-aware walkthrough system |
| Large input and clean response area | Guided one-step flow with progress and prerequisites |
| Visual glow discussed as a usability concept | Windows UI Automation target resolver with exact live bounds |
| Voice support discussed as future work | Speech input implemented |
| Detecting when a user is stuck discussed as future work | Bounded inactivity, repeated-click, and long-hover heuristics |
| General AI guidance | Hybrid deterministic Windows knowledge plus Gemini |
| Approximate visual guidance | Confidence scoring, stale-target revalidation, DPI conversion, and multi-monitor handling |
| Limited emphasis on trust boundaries | Explicit response validation, semantic targets, credential isolation, and fail-closed guidance |

Continued development matters because the strongest technical ideas grew from the original usability problem rather than being added as unrelated features.

## Accessibility-oriented interface decisions

The current interface includes:

- Normal, Large, and Extra Large text modes;
- keyboard-operable controls and focus management;
- ARIA labels and live regions;
- voice input when Chromium speech recognition is available;
- reduced-motion behavior for Show Me;
- focused walkthrough steps instead of dense instruction blocks; and
- a visible control to pause proactive monitoring.

These are accessibility-oriented design decisions. Retza has not undergone formal WCAG certification.

## Team and collaboration

Retza was built by **Michael Tetelbaum, Vladimir Dukkardt, Algasem Zabarah, and Kevin Zhu**.

The work was collaborative across user research, accessibility problem framing, interface design, testing, AI behavior, implementation, iteration, and communication. Different members led different areas, and the contribution section above keeps those boundaries explicit.

The public repository was prepared later as a showcase version of the project. Its Git history therefore does not represent the full chronology of the original team development.

## Technology stack

| Area | Technologies |
| --- | --- |
| Desktop application | Electron |
| Interface | React, TypeScript |
| Build tooling | Electron Vite, Vite |
| Generative assistance | Google Generative AI SDK |
| Windows UI locating | Windows UI Automation through PowerShell and .NET |
| Browser demo | HTML, CSS, JavaScript, Vercel Functions |
| Interaction monitoring | `uiohook-napi` |
| Styling | Tailwind CSS and custom CSS |
| Testing | Vitest, Node test runner, Playwright |
| Packaging configuration | Electron Builder |

## Run locally

### Requirements

- Node.js 22.12 or newer and npm
- Windows 10 or Windows 11 for full Show Me functionality
- a Gemini API key for generative questions in the desktop application

### Install and start

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

### Verify the project

```bash
npm run verify
```

This runs type checking, the automated desktop test suite, and the desktop production build. Browser-specific tests and production regression checks also run in GitHub Actions.

## Platform scope and limitations

Retza should currently be treated as a **Windows-first** application.

- Exact Show Me locating is implemented for Windows through Windows UI Automation.
- The public browser demo can locate only controls inside its simulated computer.
- The browser demo cannot inspect other applications, access the live Windows accessibility tree, monitor system-wide interaction, or render guidance over the desktop.
- Build configuration contains macOS and Linux packaging targets, but feature parity is not complete.
- Visible-window context is more complete on Windows than on macOS.
- Speech recognition currently uses English (`en-US`) when the Chromium speech API is available.
- The proactive detector uses heuristics. It can suggest that help may be useful, but it does not know a user's emotional state.
- The fox companion still includes placeholder sprite infrastructure that can later be replaced with final artwork.
- The project includes accessibility-oriented decisions but has not undergone formal WCAG certification.

These limitations stay explicit because trustworthy guidance is more important than making the system sound more capable than it is.

## Reflection

> **Building for everyone starts by noticing who gets left behind.**

Retza changed how I think about software design. A feature can work exactly as programmed and still fail the person using it. Simplifying an interface therefore means more than reducing text or buttons. It means finding the assumptions hidden inside each instruction, watching where users hesitate, and redesigning around what they actually experience.

The project also changed how I think about AI. Flexible language is useful, but a system that guides real actions needs deterministic checks around uncertain output. Retza became strongest when AI was treated as one component inside a larger engineering system rather than as the system itself.
