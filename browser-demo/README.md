# Retza browser adaptation

This folder is a sandboxed browser adaptation of Retza's interaction model. It exists so the walkthrough and Show Me ideas can be inspected without pretending that a normal web page has the privileges of the Windows desktop application.

The Windows/Electron application remains the authoritative implementation for operating-system guidance.

## What this demo demonstrates

The browser adaptation keeps the same basic trust principle as the desktop version:

**describe the target semantically, resolve it against live interface evidence, and refuse to highlight when the evidence is weak.**

Inside the simulated computer, the resolver can use:

- accessible names;
- ARIA and DOM roles;
- semantic IDs;
- current visibility;
- disabled state; and
- live element bounds.

Targets that are missing, hidden, disabled, ambiguous, or unsupported are rejected rather than guessed.

The demo includes deterministic walkthrough scenarios for representative tasks such as Bluetooth, Wi-Fi, display settings, sound output, Windows Update, Windows Search, and app removal. The browser UI also preserves large-text options, keyboard operation, visible focus, ARIA labels and live regions, reduced-motion behavior, and optional speech input when the browser supports it.

## What this demo does not do

A browser tab cannot reproduce Retza's desktop privileges. This adaptation does not:

- inspect other applications;
- query the live Windows UI Automation tree;
- monitor system-wide mouse or keyboard interaction;
- draw guidance over the real desktop; or
- replace the Windows Show Me resolver.

Those boundaries are deliberate. The browser version demonstrates the interaction model and failure behavior without overstating what a web page can access.

## Structure

| Path | Purpose |
| --- | --- |
| [`index.html`](index.html) | Simulated computer and Retza browser interface |
| [`app.js`](app.js) | Demo state, walkthrough flow, accessibility settings, and interaction behavior |
| [`lib/scenarios.js`](lib/scenarios.js) | Deterministic browser scenarios |
| [`lib/target-resolver.js`](lib/target-resolver.js) | Semantic DOM target resolution with fail-closed behavior |
| [`tests/target-resolver.node-test.js`](tests/target-resolver.node-test.js) | Resolver success and rejection cases |
| [`tests/scenarios.node-test.js`](tests/scenarios.node-test.js) | Deterministic scenario coverage |
| [`tests/local-browser.mjs`](tests/local-browser.mjs) | Playwright regression coverage for the built demo |

## Run locally

Build the static adaptation:

```bash
npm run build
```

The output is written to `dist/`.

Serve the generated directory with any local static server. The repository intentionally does not require a framework-specific development server for this adaptation.

## Verify

Run the focused Node tests and rebuild the demo:

```bash
npm run verify
```

The repository's main GitHub Actions workflow also builds the browser adaptation and runs the Playwright regression suite.

## Relationship to the desktop application

The browser and desktop versions share a product idea, not the same privilege boundary.

On Windows, the trusted Electron main process queries real UI Automation evidence, scores candidate controls, handles DPI and multi-monitor geometry, and revalidates targets before and during display. In the browser, the resolver is limited to elements owned by the current page.

For the full Windows trust model, see [`../docs/ENGINEERING.md`](../docs/ENGINEERING.md). For the original project and later showcase distinction, see [`../docs/PROJECT_HISTORY.md`](../docs/PROJECT_HISTORY.md).
