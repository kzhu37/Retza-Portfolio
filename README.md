# Retza

**Reaching Everybody Through Zero Barrier Accessibility**

A Windows-first desktop accessibility assistant that turns computer questions into plain-language walkthroughs and verified on-screen guidance.

`Electron` · `TypeScript` · `React` · `Gemini` · `Windows UI Automation` · `Vitest`

<p align="center">
  <a href="#why-retza-exists">Why</a> ·
  <a href="#how-show-me-works">Show Me</a> ·
  <a href="#architecture-and-trust-boundaries">Architecture</a> ·
  <a href="#testing-changed-the-product">Iteration</a> ·
  <a href="#testing-and-verification">Verification</a> ·
  <a href="#run-locally">Run locally</a>
</p>

<p align="center">
  <img src="docs/assets/retza-product-flow.svg" alt="Retza product flow from asking a computer question to a walkthrough and verified Show Me highlight" width="100%">
</p>

Retza began with a simple question: **what if computer help was designed for people who do not already understand computers?** The first prototype focused on making AI instructions shorter and easier to read. User testing exposed a deeper problem. A person could understand the instruction and still be unable to find the button it described.

That observation changed the project. Retza evolved from a text-based helper into a desktop companion that combines one-step-at-a-time walkthroughs, limited system context, proactive help heuristics, voice input, and a **Show Me** system that independently verifies real Windows interface elements before pointing to them.

> **Core engineering principle:** if Retza cannot confidently prove where a control is, it does not point.

## At a glance

| Area | Current implementation |
| --- | --- |
| **Problem** | Computer help often assumes vocabulary and interface knowledge that less experienced users do not have |
| **Product** | A Windows-first accessibility assistant for questions, walkthroughs, proactive help, and visual guidance |
| **Technical centerpiece** | Fail-closed Show Me targeting through Windows UI Automation rather than AI-generated coordinates |
| **Guidance strategy** | Deterministic Windows navigation for stable tasks, Gemini for broader questions, and prerequisite repair when setup steps are missing |
| **User-centered iteration** | Testing showed that understandable instructions still fail when users cannot locate the control, which drove the visual-guidance direction |
| **Verification** | Windows CI runs type checking, 103 automated Vitest tests across six test files, and a production build |

## What Retza does

- Converts computer questions into focused, one-action-at-a-time walkthroughs.
- Uses [deterministic Windows navigation knowledge](src/main/windows-navigation.ts) for supported tasks including Bluetooth, display settings, Device Manager, app removal, Wi-Fi, Windows Update, sound output, and Windows Search.
- Uses Gemini for broader questions, then treats the response as untrusted input through a [bounded response parser](src/main/assistant-response.ts).
- Uses [prerequisite detection](src/main/prereq-detector.ts) to add missing setup steps when a walkthrough assumes something the user has not done yet.
- Builds a deliberately limited [system context](src/main/system-context.ts) so instructions can better match the user's environment.
- Offers **Show Me** guidance that resolves semantic targets through Windows UI Automation instead of trusting a model to invent screen coordinates.
- Uses conservative [interaction heuristics](src/main/struggle-detector.ts) to offer help without claiming to know the user's emotional state.
- Supports speech input, adjustable text sizes, keyboard interaction, and reduced-motion behavior in the visual guide.

## Why Retza exists

Many interfaces are easy only after someone has learned the vocabulary behind them. Words such as *browser*, *taskbar*, *address bar*, *settings*, or *icon* can silently assume knowledge that not every user has.

Our original goal was "zero barrier accessibility." We repeatedly refined the assistant because simply telling an AI to "be simple" still produced jargon, skipped steps, or instructions that made sense only to experienced users. The harder design question became: **what background knowledge is this instruction assuming?**

Testing with older and younger family members revealed the most important failure mode. People could follow the words but still search the screen for the control. That led to the visual-guidance concept and eventually to the current verified **Show Me** pipeline.

| What testing exposed | Design response |
| --- | --- |
| Correct instructions could still leave users searching the screen | Add visual guidance that points to the relevant control |
| "Simple" instructions could still skip knowledge the user did not have | Add one-step-at-a-time walkthroughs and prerequisite repair |
| Proactive help could become intrusive | Use conservative thresholds, a cooldown, and a visible Watching control |
| Approximate visual guidance could reduce trust if it pointed incorrectly | Replace guessed regions with semantic UI Automation targeting and fail closed when evidence is weak |

<p align="center">
  <img src="docs/assets/iteration-cycle.svg" alt="Retza iteration cycle showing how user testing led from simpler text to verified visual guidance" width="100%">
</p>

The original presentation described this process as **iterative empathy**: watch what users actually do, find the assumptions hidden inside the interface, and change the system around the failure rather than blaming the user.

## From question to guided action

A Retza interaction can combine several systems rather than treating every request as a generic chat prompt:

1. **Interpret the task.** Retza checks whether the request matches a deterministic Windows navigation topic. Broader questions can be sent to Gemini.
2. **Build a walkthrough.** Responses are parsed into structured steps with semantic targets such as application, accessible control name, role, window, and intended action.
3. **Repair missing prerequisites.** If the walkthrough assumes an unsatisfied setup step, deterministic logic can prepend it.
4. **Guide one step at a time.** The interface shows progress and exposes Show Me only when there is a meaningful target.
5. **Verify before highlighting.** The trusted main process independently searches the live Windows accessibility tree and refuses ambiguous matches.

This hybrid design gives stable tasks a deterministic path while keeping generative assistance available for questions that do not fit a fixed knowledge base.

## How Show Me works

Show Me is Retza's technical centerpiece. The model never receives permission to place a highlight at an arbitrary coordinate. It can describe **what** should be located, then trusted operating-system logic determines **where** that item actually is.

<p align="center">
  <img src="docs/assets/show-me-pipeline.svg" alt="Show Me pipeline from semantic target generation through Windows UI Automation, confidence checks, coordinate conversion, revalidation, and overlay rendering" width="100%">
</p>

The main implementation is split across the [target resolver](src/main/show-me/target-resolver.ts), [Windows UI Automation transport and matcher](src/main/show-me/windows-uia.ts), [coordinate-safe geometry layer](src/main/show-me/geometry.ts), and [Show Me lifecycle](src/main/show-me/lifecycle.ts).

### 1. Semantic targets, not coordinates

A walkthrough step can describe fields such as:

```text
zone: ui_element
app: Settings
name: Bluetooth
role: Button
action: click
window: Settings
```

Coordinates are intentionally absent from the model-facing contract. The trusted main process owns the conversion from semantic intent to screen geometry.

### 2. Live Windows UI Automation evidence

Retza queries the Windows accessibility tree for evidence including accessible names, Automation IDs, control roles, class names, process names, window identities, clickable points, visibility, and supported interaction patterns.

Curated selectors help with stable Windows controls such as Start or browser address bars, but they are still semantic selectors. Retza does not hard-code a pixel position and assume the control is there.

### 3. Confidence scoring and ambiguity rejection

Candidate UI elements are scored using weighted evidence. The current matcher requires a default confidence of **0.78**. If two candidates are too close in score, or a search is incomplete without especially strong evidence, Retza returns an ambiguity failure instead of choosing one.

The resolver also rejects targets that are hidden, disabled for the requested action, off-screen, covered by another window, too broad to be useful, or otherwise insufficiently specific.

### 4. DPI and multi-monitor geometry

Windows UI Automation reports global physical pixels, Electron uses device-independent screen coordinates, and the overlay renderer uses coordinates local to its own window. Retza models these coordinate spaces explicitly instead of passing anonymous `x` and `y` values between systems.

The geometry layer is tested for:

- 100%, 125%, 150%, and 200% display scaling
- secondary monitors with positive or negative origins
- monitors positioned above the primary display
- controls spanning displays
- partially visible controls
- display-layout changes while guidance is active

### 5. Revalidation before and during display

Finding a target once is not enough. Windows interfaces are dynamic. A control can move, disappear, become occluded, or belong to a window that is no longer active.

Retza re-queries the originally observed window immediately before showing the overlay. While the guide is visible, it continues validating the target at regular intervals. If the evidence is no longer trustworthy, the guide is dismissed.

The result is deliberately conservative: **visual guidance is useful only when the system can defend where it is pointing.**

## Architecture and trust boundaries

<p align="center">
  <img src="docs/assets/architecture.svg" alt="Retza architecture showing React renderer, restricted preload bridge, Electron main process, Gemini, system context, and Windows UI Automation" width="100%">
</p>

Retza separates presentation from the systems that hold credentials, inspect Windows state, and resolve screen geometry.

| Layer | Responsibility |
| --- | --- |
| **React renderer** | Chat, walkthrough progress, settings, speech input, fox companion, and Show Me overlay presentation |
| **Restricted preload bridge** | A narrow [`contextBridge`](src/preload/index.ts) that exposes only the IPC operations required by the interface |
| **Trusted Electron main process** | API credentials, response validation, context collection, Windows navigation, prerequisites, struggle detection, and Show Me resolution |
| **External systems** | Gemini for broader language guidance and Windows UI Automation for live accessibility evidence |

This separation matters because both AI output and renderer input are treated as untrusted at the boundaries where they can affect operating-system guidance.

### Context-aware guidance

Retza can build a limited read-only view of the computer so instructions better match the user's environment. Depending on platform support, that can include Windows version, browser availability, selected running process names, visible browser-window titles, taskbar and Desktop shortcut names, and common email-client availability.

The context scanner does not use this feature to read document contents or take screenshots. Values are sanitized before they are added to an AI prompt and are explicitly treated as untrusted data.

### Defensive AI integration

Gemini responses are not inserted directly into the interface as trusted commands. Retza parses them into a bounded contract, validates step data, limits response sizes, and disables unsafe targeting information rather than guessing what malformed output meant.

### Credential isolation

The Gemini API key stays in the trusted Electron process. The renderer only receives whether a key is configured. When Electron secure storage is available, saved keys are encrypted with `safeStorage`. Legacy plaintext settings are migrated on a best-effort basis.

A `.env` key is also removed from the inherited process environment after startup so child processes do not automatically receive it.

## Proactive help without pretending to read emotions

One challenge from the original project was **interpreting confusion without explicit input**. The current version addresses that conservatively through interaction heuristics rather than claiming to infer a user's emotional state.

<p align="center">
  <img src="docs/assets/struggle-detection.svg" alt="Retza struggle-detection heuristics for inactivity, repeated clicks, and long-hover behavior" width="100%">
</p>

The current detector can react to patterns such as:

- approximately **45 seconds** of inactivity
- **3 clicks within 2 seconds** inside roughly a **60 px** radius
- hovering around the same **30 px** region for approximately **8 seconds**
- a **120 second** cooldown after an intervention

Keyboard activity is used as an activity signal, but the detector does not need to record which key was pressed. Users can also pause the Watching feature from the main interface.

The goal is not to diagnose frustration. It is to create a low-cost opportunity to offer help when interaction patterns suggest that help might be useful.

## Major engineering challenges and decisions

| Challenge | Engineering response |
| --- | --- |
| Help can become intrusive | User-controlled Watching mode, conservative thresholds, and a cooldown between proactive prompts |
| Correct instructions can still be unusable | One-step-at-a-time walkthroughs, limited system context, prerequisite repair, and Show Me guidance |
| Wrong visual guidance can reduce trust | Semantic targeting, confidence scoring, ambiguity rejection, actionability checks, occlusion checks, and revalidation |
| Screen state changes after a target is found | Re-query the same window before rendering and continue validating while the overlay is visible |
| Multiple monitors and DPI scaling use different coordinate spaces | Explicit physical-pixel, screen-DIP, and overlay-local geometry types with tested conversions |
| AI responses are untrusted structured input | Size limits, enum validation, bounded fields, inert fallback targets, and safe parsing before UI use |
| Stable Windows tasks do not require generative uncertainty | Deterministic version-aware navigation knowledge for supported topics |

## Testing changed the product

Retza was designed around an audience before it was designed around a feature list. Early versions concentrated on a large input field, readable text, patient language, and short numbered steps. Testing showed that improving wording solved only part of the problem because users still had to translate a sentence into a location on an unfamiliar screen.

That observation changed the design direction:

**simpler text -> step-by-step walkthroughs -> visual guidance -> evidence-backed UI targeting**

It also changed how we thought about debugging. Some of the hardest failures were not cases where the software crashed. They were cases where the software behaved as intended but the user still could not confidently complete the task.

## Testing and verification

The repository includes automated Vitest coverage for both expected behavior and failure states. The current Windows CI run passes **103 tests across six test files** before completing the production build.

Coverage includes:

- malformed, oversized, and legacy AI responses
- unsafe or unsupported semantic targets
- Windows 10 and Windows 11 navigation differences
- ambiguous target matches
- hidden, disabled, off-screen, and occluded controls
- stale UI state and changed windows
- display scaling and multi-monitor placement
- targets partially outside a display
- duplicated taskbar controls across monitors
- Show Me lifecycle behavior
- settings validation

The most relevant test suites are the [geometry tests](src/main/show-me/geometry.test.ts), [UI Automation matcher tests](src/main/show-me/windows-uia.test.ts), [Show Me lifecycle tests](src/main/show-me/lifecycle.test.ts), [assistant-response tests](tests/assistant-response.test.ts), and [Windows navigation tests](tests/windows-navigation.test.ts).

An optional live Windows UI Automation smoke test can also be enabled explicitly for the real transport layer.

GitHub Actions runs:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

## Accessibility-oriented interface decisions

The current interface includes:

- Normal, Large, and Extra Large text modes
- keyboard-operable controls and focus management
- ARIA labels and live regions
- voice input when Chromium speech recognition is available
- reduced-motion behavior for the Show Me overlay
- focused walkthrough steps instead of dense instruction blocks
- a visible control to pause proactive monitoring

These are accessibility-oriented design decisions, not a claim of formal WCAG certification.

## How Retza evolved

The current portfolio version goes beyond the original school presentation.

| Earlier project stage | Current portfolio version |
| --- | --- |
| AI helper focused mainly on simplified text | Structured, context-aware walkthrough system |
| Visual glow as a usability concept | Windows UI Automation target resolver with exact bounds |
| Voice support discussed as future work | Speech input implemented |
| Detecting when a user is stuck discussed as future work | Inactivity, repeated-click, and long-hover heuristics implemented |
| General AI guidance | Hybrid deterministic Windows knowledge plus Gemini |
| Basic visual guidance | Confidence scoring, stale-target revalidation, DPI conversion, and multi-monitor handling |
| Limited emphasis on AI trust boundaries | Explicit response validation, semantic targets, credential isolation, and fail-closed guidance |

Continued development matters because the strongest technical ideas grew directly from the original usability problem rather than being added as unrelated features.

## Team and collaboration

Retza was built as a four-person project by **Michael Tetelbaum, Vladimir Dukkardt, Algasem Zabarah, and Kevin Zhu**.

The project was collaborative across user research, accessibility problem framing, interface design, testing, AI behavior, implementation, iteration, and presentation. The public portfolio repository was later created by migrating and extending the project, so its current Git history is not presented as a module-by-module record of the original team's authorship.

This README therefore focuses on the finished team-built system, the decisions behind it, and the way user testing changed the product.

## Technology stack

| Area | Technologies |
| --- | --- |
| Desktop application | Electron |
| Interface | React, TypeScript |
| Build tooling | Electron Vite, Vite |
| Generative assistance | Google Generative AI SDK |
| Windows UI locating | Windows UI Automation through PowerShell and .NET |
| Interaction monitoring | `uiohook-napi` |
| Styling | Tailwind CSS and custom CSS |
| Testing | Vitest |
| Packaging configuration | Electron Builder |

## Run locally

### Requirements

- Node.js 22.12 or newer and npm
- Windows 10 or Windows 11 for full Show Me functionality
- a Gemini API key for generative questions

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

This runs type checking, the automated test suite, and the production build.

## Platform scope and current limitations

Retza should currently be treated as a **Windows-first** application.

- Exact Show Me locating is implemented for Windows through Windows UI Automation.
- Build configuration contains macOS and Linux packaging targets, but feature parity is not complete.
- Visible-window context is more complete on Windows than on macOS.
- Speech recognition currently uses English (`en-US`) when the Chromium speech API is available.
- The proactive struggle detector uses heuristics. It can suggest that help may be useful, but it does not know a user's emotional state.
- The current fox companion includes placeholder sprite artwork infrastructure that can later be replaced with a final sprite sheet.
- The project includes accessibility-oriented decisions but has not been presented as formally WCAG-certified.

These limitations stay explicit because trustworthy guidance is more important than presenting the system as more capable than it is.

## Reflection

> **The best interface is one that makes people feel capable.**

Retza changed how I thought about software design. A feature can work exactly as programmed and still fail the person using it. Simplifying an interface therefore means more than reducing text or buttons. It requires finding the assumptions hidden inside each instruction, watching where users hesitate, and being willing to change the system around what they actually experience.

The project also changed how I think about AI. Generative models are useful for flexible language, but systems that guide real actions need deterministic checks around uncertain output. Retza became strongest when the AI was treated as one component inside a larger engineering system rather than as the system itself.
