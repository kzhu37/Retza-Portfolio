import { describe, expect, it } from 'vitest'
import {
  dipPoint,
  dipRect,
  physicalPoint,
  physicalRect,
  resolveOverlayPlacement,
  validateStaleObservation,
  type DisplayGeometry,
  type PhysicalToDipConverter,
  type TargetObservation,
} from './geometry'

function fixtureConverter(
  scale: number,
  physicalOrigin = { x: 0, y: 0 },
  dipOrigin = { x: 0, y: 0 },
): PhysicalToDipConverter {
  return {
    rect: rect => dipRect(
      dipOrigin.x + (rect.x - physicalOrigin.x) / scale,
      dipOrigin.y + (rect.y - physicalOrigin.y) / scale,
      rect.width / scale,
      rect.height / scale,
    ),
    point: point => dipPoint(
      dipOrigin.x + (point.x - physicalOrigin.x) / scale,
      dipOrigin.y + (point.y - physicalOrigin.y) / scale,
    ),
  }
}

const primary: DisplayGeometry = {
  id: 1,
  bounds: dipRect(0, 0, 1920, 1080),
  workArea: dipRect(0, 0, 1920, 1040),
  scaleFactor: 1,
}

describe('resolveOverlayPlacement', () => {
  it.each([
    { scale: 1, physicalX: 100, physicalY: 80, physicalWidth: 240, physicalHeight: 60 },
    { scale: 1.25, physicalX: 125, physicalY: 100, physicalWidth: 300, physicalHeight: 75 },
    { scale: 1.5, physicalX: 150, physicalY: 120, physicalWidth: 360, physicalHeight: 90 },
    { scale: 2, physicalX: 200, physicalY: 160, physicalWidth: 480, physicalHeight: 120 },
  ])('keeps the same DIP placement at $scale scale', fixture => {
    const result = resolveOverlayPlacement(
      physicalRect(
        fixture.physicalX,
        fixture.physicalY,
        fixture.physicalWidth,
        fixture.physicalHeight,
      ),
      undefined,
      fixtureConverter(fixture.scale),
      [primary],
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.screenBounds).toEqual(dipRect(100, 80, 240, 60))
    expect(result.localBounds).toMatchObject({ x: 100, y: 80, width: 240, height: 60 })
  })

  it('subtracts a positive secondary-monitor origin from overlay-local coordinates', () => {
    const secondary: DisplayGeometry = { id: 2, bounds: dipRect(1920, 0, 1280, 900), scaleFactor: 1.25 }
    const result = resolveOverlayPlacement(
      physicalRect(2045, 125, 250, 100),
      physicalPoint(2170, 175),
      fixtureConverter(1.25, { x: 1920, y: 0 }, { x: 1920, y: 0 }),
      [primary, secondary],
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.screenBounds).toEqual(dipRect(2020, 100, 200, 80))
    expect(result.localBounds).toMatchObject({ x: 100, y: 100, width: 200, height: 80 })
    expect(result.clickablePoint).toMatchObject({ x: 200, y: 140 })
    expect(result.display.id).toBe(2)
  })

  it('preserves a negative left-monitor origin instead of clamping it to zero', () => {
    const left: DisplayGeometry = { id: 3, bounds: dipRect(-1280, 0, 1280, 800), scaleFactor: 1.25 }
    const result = resolveOverlayPlacement(
      physicalRect(-1500, 125, 250, 100),
      undefined,
      fixtureConverter(1.25, { x: -1600, y: 0 }, { x: -1280, y: 0 }),
      [left, primary],
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.screenBounds).toEqual(dipRect(-1200, 100, 200, 80))
    expect(result.localBounds).toMatchObject({ x: 80, y: 100, width: 200, height: 80 })
    expect(result.display.id).toBe(3)
  })

  it('handles a monitor positioned above the primary display', () => {
    const above: DisplayGeometry = { id: 4, bounds: dipRect(200, -900, 1600, 900), scaleFactor: 1 }
    const result = resolveOverlayPlacement(
      physicalRect(300, -850, 180, 70),
      undefined,
      fixtureConverter(1),
      [above, primary],
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.localBounds).toMatchObject({ x: 100, y: 50, width: 180, height: 70 })
  })

  it('clips a partially visible target while retaining its original local bounds', () => {
    const result = resolveOverlayPlacement(
      physicalRect(-20, 100, 100, 40),
      undefined,
      fixtureConverter(1),
      [primary],
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.localBounds).toMatchObject({ x: -20, y: 100, width: 100, height: 40 })
    expect(result.visibleLocalBounds).toMatchObject({ x: 0, y: 100, width: 80, height: 40 })
    expect(result.visibleRatio).toBeCloseTo(0.8)
    expect(result.partiallyVisible).toBe(true)
  })

  it('refuses a mostly off-screen or entirely off-screen target', () => {
    const mostlyOff = resolveOverlayPlacement(
      physicalRect(-80, 100, 100, 40),
      undefined,
      fixtureConverter(1),
      [primary],
    )
    const off = resolveOverlayPlacement(
      physicalRect(-500, 100, 100, 40),
      undefined,
      fixtureConverter(1),
      [primary],
    )
    expect(mostlyOff).toEqual({ ok: false, code: 'mostly_off_screen' })
    expect(off).toEqual({ ok: false, code: 'off_screen' })
  })

  it('uses the clickable point to select a display for a spanning target', () => {
    const right: DisplayGeometry = { id: 2, bounds: dipRect(1920, 0, 1280, 1080), scaleFactor: 1 }
    const result = resolveOverlayPlacement(
      physicalRect(1800, 100, 300, 80),
      physicalPoint(2000, 140),
      fixtureConverter(1),
      [primary, right],
      { minimumVisibleRatio: 0.5 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.display.id).toBe(2)
    expect(result.localBounds.x).toBe(-120)
    expect(result.visibleLocalBounds.x).toBe(0)
    expect(result.intersectsMultipleDisplays).toBe(true)
  })

  it('rejects malformed physical and converted bounds', () => {
    expect(resolveOverlayPlacement(
      physicalRect(Number.NaN, 0, 20, 20),
      undefined,
      fixtureConverter(1),
      [primary],
    )).toEqual({ ok: false, code: 'invalid_physical_bounds' })

    const malformedConverter: PhysicalToDipConverter = {
      rect: () => dipRect(0, 0, Number.POSITIVE_INFINITY, 20),
      point: () => dipPoint(0, 0),
    }
    expect(resolveOverlayPlacement(
      physicalRect(0, 0, 20, 20),
      undefined,
      malformedConverter,
      [primary],
    )).toEqual({ ok: false, code: 'invalid_dip_bounds' })
  })
})

function observation(overrides: {
  observedAt?: number
  displayRevision?: number
  foregroundWindowHandle?: string
  windowHandle?: string
  processId?: number
  minimized?: boolean
  windowOffscreen?: boolean
  runtimeId?: string | null
  automationId?: string
  name?: string
  role?: string
  className?: string
  bounds?: ReturnType<typeof physicalRect>
  elementOffscreen?: boolean
  hitTest?: TargetObservation['hitTest']
} = {}): TargetObservation {
  return {
    observedAt: overrides.observedAt ?? 1_000,
    displayRevision: overrides.displayRevision ?? 4,
    foregroundWindowHandle: overrides.foregroundWindowHandle ?? '100',
    window: {
      handle: overrides.windowHandle ?? '100',
      runtimeId: 'window-runtime',
      processId: overrides.processId ?? 22,
      minimized: overrides.minimized ?? false,
      offscreen: overrides.windowOffscreen ?? false,
    },
    element: {
      runtimeId: overrides.runtimeId === undefined ? 'element-runtime' : overrides.runtimeId,
      automationId: overrides.automationId ?? 'BluetoothButton',
      name: overrides.name ?? 'Bluetooth',
      role: overrides.role ?? 'Button',
      className: overrides.className ?? 'Button',
      bounds: overrides.bounds ?? physicalRect(100, 120, 160, 40),
      offscreen: overrides.elementOffscreen ?? false,
    },
    hitTest: overrides.hitTest ?? 'self',
  }
}

describe('validateStaleObservation', () => {
  it('accepts the same runtime element and returns its fresh moved bounds', () => {
    const before = observation()
    const after = observation({ observedAt: 1_500, bounds: physicalRect(-1200, 150, 160, 40) })
    const result = validateStaleObservation(before, { windowAvailable: true, observation: after })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.identity).toBe('same-runtime-id')
    expect(result.moved).toBe(true)
    expect(result.observation.element.bounds.x).toBe(-1200)
  })

  it('accepts a provider-recreated element only with a stable unique signature', () => {
    const before = observation({ runtimeId: 'old-runtime' })
    const after = observation({ runtimeId: 'new-runtime' })
    const result = validateStaleObservation(before, { windowAvailable: true, observation: after })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.identity).toBe('stable-signature')

    const changed = observation({ runtimeId: 'new-runtime', automationId: 'AnotherButton', name: 'Another' })
    expect(validateStaleObservation(before, { windowAvailable: true, observation: changed }))
      .toEqual({ ok: false, code: 'target_changed' })
  })

  it('distinguishes a closed application from a replaced window', () => {
    const before = observation()
    expect(validateStaleObservation(before, { windowAvailable: false, observation: null }))
      .toEqual({ ok: false, code: 'application_closed' })
    expect(validateStaleObservation(before, {
      windowAvailable: true,
      observation: observation({ windowHandle: '200' }),
    })).toEqual({ ok: false, code: 'window_changed' })
  })

  it('rejects minimized, offscreen, occluded, and changed-foreground targets', () => {
    const before = observation()
    expect(validateStaleObservation(before, {
      windowAvailable: true,
      observation: observation({ minimized: true }),
    })).toEqual({ ok: false, code: 'not_visible' })
    expect(validateStaleObservation(before, {
      windowAvailable: true,
      observation: observation({ elementOffscreen: true }),
    })).toEqual({ ok: false, code: 'not_visible' })
    expect(validateStaleObservation(before, {
      windowAvailable: true,
      observation: observation({ hitTest: 'blocked' }),
    })).toEqual({ ok: false, code: 'occluded' })
    expect(validateStaleObservation(before, {
      windowAvailable: true,
      observation: observation({ hitTest: 'unknown' }),
    })).toEqual({ ok: false, code: 'occluded' })
    expect(validateStaleObservation(before, {
      windowAvailable: true,
      observation: observation({ foregroundWindowHandle: '999' }),
    }, { requireForeground: true })).toEqual({ ok: false, code: 'window_changed' })
  })

  it('requires explicit permission to accept a display metrics revision', () => {
    const before = observation({ displayRevision: 2 })
    const after = observation({ displayRevision: 3 })
    expect(validateStaleObservation(before, { windowAvailable: true, observation: after }))
      .toEqual({ ok: false, code: 'screen_changed' })

    const accepted = validateStaleObservation(
      before,
      { windowAvailable: true, observation: after },
      { allowDisplayChange: true },
    )
    expect(accepted.ok).toBe(true)
    if (accepted.ok) expect(accepted.displayChanged).toBe(true)
  })
})
