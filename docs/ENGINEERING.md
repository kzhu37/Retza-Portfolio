# Retza engineering notes

This document expands the implementation details behind the main Retza README. It focuses on the current Windows application, the trust boundaries around visual guidance, and the sandboxed browser adaptation.

## 1. Show Me trust model

The central Show Me rule is simple: the model may describe a target, but it never chooses screen coordinates.

A walkthrough target can contain semantic fields such as:

```text
zone: ui_element
app: Settings
name: Bluetooth
role: Button
action: click
window: Settings
visibility: visible_now
```

The trusted Electron main process owns the conversion from that semantic intent to verified geometry.

Relevant files:

- [`src/main/show-me/target-resolver.ts`](../src/main/show-me/target-resolver.ts)
- [`src/main/show-me/windows-uia.ts`](../src/main/show-me/windows-uia.ts)
- [`src/main/show-me/geometry.ts`](../src/main/show-me/geometry.ts)
- [`src/main/show-me/lifecycle.ts`](../src/main/show-me/lifecycle.ts)

## 2. Runtime target validation

`validateTargetPayload` treats model output and IPC input as untrusted data.

It checks:

- supported target zones;
- supported actions;
- supported visibility values;
- bounded string lengths;
- normalized control roles; and
- whether a `ui_element` target has a usable accessible name.

Unsupported data fails validation instead of being coerced into an approximate visual target.

## 3. Windows UI Automation query

The Windows transport queries the live accessibility tree through fixed PowerShell source using .NET UI Automation assemblies.

Untrusted target text is not interpolated into PowerShell source. The query is serialized as JSON, encoded, and passed separately.

The transport can inspect signals including:

- accessible name;
- Automation ID;
- control type;
- class name;
- process identity;
- window identity;
- bounding rectangle;
- clickable point;
- enabled and off-screen state; and
- supported UI Automation interaction patterns.

Searches are bounded by limits on inspected windows, visited nodes, candidate count, and execution time.

### Transport tradeoff: inspectability versus latency

The current transport launches a fixed PowerShell worker on demand. That choice keeps the operating-system bridge easy to inspect, isolates each query in a bounded process, and avoids placing untrusted target text inside executable PowerShell source.

The tradeoff is startup latency. A cold Windows PowerShell process can spend several seconds loading the UI Automation assemblies, so the implementation uses an 8 second default timeout while still bounding the amount of UI tree work performed.

A production evolution could keep a narrowly scoped native or helper process warm and communicate through structured IPC. That would reduce repeated startup cost while preserving the same validation, query limits, and fail-closed matching rules. The current design favors inspectability and failure isolation over minimum possible latency.

## 4. Candidate scoring and ambiguity rejection

The resolver ranks candidate controls using multiple independent signals rather than relying on one string match.

The default acceptance threshold is **0.78**. A match can still be rejected if a competing candidate is too close in score or if the search was incomplete without especially strong evidence.

Retza also rejects candidates that are:

- hidden;
- disabled for the requested action;
- mostly or fully off-screen;
- occluded;
- too broad to be useful;
- associated with the wrong application or window; or
- no longer consistent with the original observation.

This is the fail-closed behavior described in the main README.

## 5. Coordinate spaces

Windows UI Automation and Electron do not speak the same coordinate language.

Retza distinguishes:

1. global Windows physical pixels;
2. Electron screen coordinates in device-independent pixels; and
3. coordinates local to the overlay window.

The geometry layer converts between these spaces explicitly and clips placement to current displays.

Tests cover:

- 100%, 125%, 150%, and 200% scaling;
- secondary monitors with positive and negative origins;
- monitors positioned above the primary display;
- controls spanning displays;
- partially visible controls; and
- display-layout changes while guidance is active.

## 6. Revalidation and stale state

A correct target can become wrong moments later because windows move, controls disappear, or focus changes.

Retza therefore stores an observation of the resolved target, then re-queries the same window before drawing the guide. While guidance is visible, the lifecycle continues to revalidate the target.

A changed window, changed target, screen-layout revision, new occluder, or missing control can dismiss the guide.

Target location is not treated as permanent state.

## 7. Deterministic navigation

Stable Windows tasks do not need to be regenerated every time.

[`src/main/windows-navigation.ts`](../src/main/windows-navigation.ts) contains deterministic guidance for supported topics such as:

- Bluetooth;
- Wi-Fi;
- display settings;
- sound output;
- Windows Update;
- app removal;
- Windows Search; and
- Device Manager.

The navigation layer accounts for Windows-version differences where needed.

This gives Retza a dependable path for common tasks while keeping generative assistance available for broader questions.

## 8. Prerequisite repair

A technically correct walkthrough can still fail if it assumes a setup step the user has not completed.

[`src/main/prereq-detector.ts`](../src/main/prereq-detector.ts) can detect known prerequisite gaps and prepend deterministic setup guidance before the original walkthrough continues.

The product reason is the same one discovered during testing: simplifying words is not enough if the instruction silently assumes prior knowledge.

## 9. Defensive AI integration

[`src/main/assistant-response.ts`](../src/main/assistant-response.ts) parses model output into a bounded application contract.

Validation includes:

- accepted response kinds;
- bounded message and step counts;
- bounded instruction length;
- validated target objects; and
- safe fallbacks for malformed or legacy responses.

The model is therefore treated as a generator of candidate structured data, not as a trusted command channel.

## 10. System context and privacy boundary

[`src/main/system-context.ts`](../src/main/system-context.ts) builds a deliberately limited context object so guidance can better match the user's computer.

Depending on platform support, this can include:

- Windows version;
- browser availability;
- selected running process names;
- visible browser-window titles;
- taskbar and Desktop shortcut names; and
- common email-client availability.

The scanner is not designed to read document contents or take screenshots for this feature. Strings are sanitized before they are used as prompt context.

## 11. Credential isolation

The desktop renderer does not receive the Gemini API key.

The Electron main process owns provider calls and exposes only a narrow IPC bridge through [`src/preload/index.ts`](../src/preload/index.ts).

When Electron secure storage is available, saved keys use `safeStorage`. The application also removes a `.env` key from the inherited process environment after startup so child processes do not automatically receive it.

The browser adaptation follows the same principle when a server-side provider is configured. Provider credentials stay outside client-side code.

## 12. Proactive help heuristics

[`src/main/struggle-detector.ts`](../src/main/struggle-detector.ts) does not attempt emotion recognition.

Instead, it can react to bounded interaction patterns such as:

- approximately 45 seconds of inactivity;
- three nearby clicks within two seconds;
- hovering around the same small region for approximately eight seconds; and
- a 120 second cooldown after an intervention.

Keyboard activity is treated as activity without requiring the detector to record which key was pressed.

The user can pause Watching from the interface.

## 13. Browser adaptation

The browser version is a sandboxed adaptation, not a replacement for the Windows application.

Its Show Me resolver uses:

- accessible DOM names;
- roles;
- semantic IDs;
- live visibility;
- disabled state; and
- current element bounds.

It rejects ambiguous, missing, hidden, disabled, or unsupported targets.

The browser cannot inspect other applications, access Windows UI Automation, monitor system-wide interaction, or render a guide over the real desktop. Those limitations are labeled directly in the interface.

## 14. Verification map

The current desktop suite contains 103 Vitest tests across six files.

| Test area | Representative file |
| --- | --- |
| AI response parsing and validation | [`tests/assistant-response.test.ts`](../tests/assistant-response.test.ts) |
| Windows deterministic navigation | [`tests/windows-navigation.test.ts`](../tests/windows-navigation.test.ts) |
| Settings validation | [`tests/settings-schema.test.ts`](../tests/settings-schema.test.ts) |
| DPI and multi-monitor geometry | [`src/main/show-me/geometry.test.ts`](../src/main/show-me/geometry.test.ts) |
| UI Automation matching | [`src/main/show-me/windows-uia.test.ts`](../src/main/show-me/windows-uia.test.ts) |
| Show Me lifecycle | [`src/main/show-me/lifecycle.test.ts`](../src/main/show-me/lifecycle.test.ts) |

The browser adaptation adds focused Node tests for semantic target resolution and deterministic scenario routing plus Playwright regression coverage for the built browser experience.

The CI definition is visible in [`.github/workflows/verify.yml`](../.github/workflows/verify.yml). It runs documentation/content checks, TypeScript checking, desktop tests, desktop production build, browser API syntax checks, browser unit tests, browser build, and local Playwright regressions. These checks intentionally verify repository-controlled behavior rather than relying on an external deployment alias.

## 15. Claim-to-code traceability

Each major engineering claim is linked directly to its implementation and verification path.

| Engineering claim | Implementation | Verification |
| --- | --- | --- |
| Model output never supplies trusted screen coordinates | [`src/shared/contracts.ts`](../src/shared/contracts.ts), [`src/main/show-me/target-resolver.ts`](../src/main/show-me/target-resolver.ts) | [`tests/assistant-response.test.ts`](../tests/assistant-response.test.ts), [`src/main/show-me/windows-uia.test.ts`](../src/main/show-me/windows-uia.test.ts) |
| Live targets come from Windows accessibility evidence | [`src/main/show-me/windows-uia.ts`](../src/main/show-me/windows-uia.ts) | [`src/main/show-me/windows-uia.test.ts`](../src/main/show-me/windows-uia.test.ts) |
| DPI and multi-monitor conversion is explicit | [`src/main/show-me/geometry.ts`](../src/main/show-me/geometry.ts) | [`src/main/show-me/geometry.test.ts`](../src/main/show-me/geometry.test.ts) |
| A target is rechecked before and during guidance | [`src/main/show-me/target-resolver.ts`](../src/main/show-me/target-resolver.ts), [`src/main/show-me/lifecycle.ts`](../src/main/show-me/lifecycle.ts) | [`src/main/show-me/lifecycle.test.ts`](../src/main/show-me/lifecycle.test.ts) |
| Common Windows tasks have a deterministic path | [`src/main/windows-navigation.ts`](../src/main/windows-navigation.ts) | [`tests/windows-navigation.test.ts`](../tests/windows-navigation.test.ts) |
| Browser targeting is intentionally sandboxed | [`browser-demo/lib/target-resolver.js`](../browser-demo/lib/target-resolver.js), [`browser-demo/lib/scenarios.js`](../browser-demo/lib/scenarios.js) | [`browser-demo/tests/target-resolver.node-test.js`](../browser-demo/tests/target-resolver.node-test.js), [`browser-demo/tests/local-browser.mjs`](../browser-demo/tests/local-browser.mjs) |

## 16. Engineering principle

Retza's architecture follows one recurring idea:

**Use flexible systems for language, deterministic systems for trust.**

Generative assistance can help interpret and explain. The parts that affect real on-screen guidance are independently validated, bounded, rechecked, and allowed to refuse.
