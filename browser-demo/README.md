# Retza browser adaptation

This folder is a sandboxed browser adaptation of Retza's interaction model. It makes the walkthrough and Show Me behavior directly inspectable without pretending that a normal web page has the privileges of the Windows desktop application.

The Windows/Electron application remains the authoritative implementation for operating-system guidance.

## What the adaptation preserves

The browser version keeps the same core trust principle:

**Describe the target semantically, resolve it against live interface evidence, and refuse to highlight when the evidence is weak.**

Inside the simulated computer, the resolver uses accessible names, roles, semantic IDs, current visibility, disabled state, and live element bounds. Missing, ambiguous, hidden, disabled, or unsupported targets are rejected rather than guessed.

Deterministic walkthrough scenarios cover representative tasks including Bluetooth, Wi-Fi, display settings, sound output, Windows Update, Windows Search, and app removal. The interface also includes large-text options, keyboard operation, visible focus, reduced-motion behavior, optional speech input when supported, and a bounded sandbox-only proactive-help demonstration.

## Scope boundary

A browser tab cannot reproduce Retza's desktop privileges. This adaptation does not:

- inspect other applications;
- query the live Windows UI Automation tree;
- monitor system-wide mouse or keyboard interaction;
- draw guidance over the real desktop; or
- replace the Windows Show Me resolver.

Those limitations are deliberate. The browser build preserves interaction behavior and fail-closed semantic targeting only within page-owned content.

## Server-side provider boundary

The repository root [`../api/`](../api/) folder contains the optional server-side provider boundary used by a hosted browser build.

`api/chat.js` validates and bounds browser requests, keeps provider credentials outside client-side code, constrains model output to the demo contract, and refuses to claim access to the user's real operating system. Deterministic scenarios continue to work when broader provider-backed guidance is unavailable.

## Verification

The browser adaptation has two distinct verification layers:

| Layer | Coverage |
| --- | --- |
| **Node tests** | Deterministic scenario routing plus exact, missing, ambiguous, hidden, disabled, and unsupported semantic targets |
| **Playwright regressions** | Validated walkthrough rendering, successful Show Me positioning, highlight repositioning during nested scrolling, overlapping-request race handling, text-size settings, responsive layout, reduced-motion behavior, provider-unavailable handling, and console or page errors |

Run the focused Node tests and rebuild the adaptation:

```bash
npm run verify
```

The repository's main GitHub Actions workflow also builds the browser adaptation and runs the Playwright regression script.

## Structure

| Path | Purpose |
| --- | --- |
| [`index.html`](index.html) | Simulated computer and Retza browser interface |
| [`app.js`](app.js) | Demo state, walkthrough flow, accessibility settings, and interaction behavior |
| [`lib/scenarios.js`](lib/scenarios.js) | Deterministic browser scenarios |
| [`lib/target-resolver.js`](lib/target-resolver.js) | Semantic DOM target resolution with fail-closed behavior |
| [`tests/target-resolver.node-test.js`](tests/target-resolver.node-test.js) | Resolver success and rejection cases |
| [`tests/scenarios.node-test.js`](tests/scenarios.node-test.js) | Deterministic scenario coverage |
| [`tests/local-browser.mjs`](tests/local-browser.mjs) | Playwright regression coverage for the built adaptation |

## Run locally

Build the static adaptation:

```bash
npm run build
```

The output is written to `dist/`. Serve that directory with any local static server.

## Relationship to the desktop application

The browser and desktop versions share a product idea, not the same privilege boundary.

On Windows, the trusted Electron main process queries real UI Automation evidence, scores candidate controls, handles DPI and multi-monitor geometry, and revalidates targets before and during display. In the browser, the resolver is limited to elements owned by the current page.

For the full Windows trust model, see [`../docs/ENGINEERING.md`](../docs/ENGINEERING.md). For the original project and later repository distinction, see [`../docs/PROJECT_HISTORY.md`](../docs/PROJECT_HISTORY.md).
