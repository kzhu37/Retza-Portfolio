# Windows validation

Retza's strongest platform-specific claim is that Show Me can resolve live Windows interface controls through Windows UI Automation rather than accepting coordinates from a language model.

This document keeps that claim separate from tests that use controlled UI Automation snapshots.

## Default automated coverage

The normal CI suite verifies the desktop resolver, matcher, geometry conversion, stale-state logic, and lifecycle behavior with deterministic test data. This makes edge cases reproducible, including ambiguity, hidden or disabled controls, occlusion, duplicate taskbar targets, DPI scaling, multi-monitor geometry, and target changes.

Those tests validate the engineering logic around Windows UI Automation. They do not claim that every CI run has a normal interactive Windows desktop available for live UI inspection.

## Opt-in live transport smoke test

On a normal Windows desktop session, run:

```bash
npm run test:uia-live
```

The command enables the live test already defined in [`src/main/show-me/windows-uia.test.ts`](../src/main/show-me/windows-uia.test.ts). That smoke test sends a real query through the PowerShell and .NET UI Automation transport for the Windows taskbar Start control.

It checks that:

- the live UI Automation transport starts successfully;
- at least one matching taskbar window is visible;
- the returned candidates include a Start element; and
- the matcher either resolves that element or safely reports ambiguity when multiple equally strong taskbar targets are present.

The smoke test intentionally accepts safe ambiguity on multi-monitor systems rather than forcing one arbitrary target.

## Evidence boundary

The live transport smoke test is opt-in instead of part of default hosted CI because a hosted Windows runner does not reproduce the same interactive Explorer desktop conditions as a normal user session.

No task-completion rate, targeting-accuracy percentage, or formal accessibility result is inferred from this smoke test. It verifies one real operating-system transport path. The broader resolver behavior remains covered by deterministic automated tests.

For the full claim-to-code map, see [Engineering notes](ENGINEERING.md).
