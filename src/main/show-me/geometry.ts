/**
 * Coordinate-space-safe geometry for Show Me.
 *
 * Windows UI Automation reports global physical pixels. Electron's screen and
 * BrowserWindow APIs use global DIP coordinates, while the overlay renderer
 * uses coordinates local to its BrowserWindow. Keeping the space on every
 * value makes it much harder to accidentally mix those three systems.
 */

export type CoordinateSpace = 'screen-physical' | 'screen-dip' | 'overlay-dip'

export interface SpatialPoint<S extends CoordinateSpace> {
  readonly space: S
  readonly x: number
  readonly y: number
}

export interface SpatialRect<S extends CoordinateSpace> {
  readonly space: S
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type PhysicalScreenPoint = SpatialPoint<'screen-physical'>
export type DipScreenPoint = SpatialPoint<'screen-dip'>
export type OverlayPoint = SpatialPoint<'overlay-dip'>
export type PhysicalScreenRect = SpatialRect<'screen-physical'>
export type DipScreenRect = SpatialRect<'screen-dip'>
export type OverlayRect = SpatialRect<'overlay-dip'>

export interface DisplayGeometry {
  readonly id: number
  readonly bounds: DipScreenRect
  readonly workArea?: DipScreenRect
  readonly scaleFactor?: number
}

/** Adapter implemented at the Electron boundary with screen.screenToDip*. */
export interface PhysicalToDipConverter {
  rect(rect: PhysicalScreenRect): DipScreenRect
  point(point: PhysicalScreenPoint): DipScreenPoint
}

export const physicalRect = (
  x: number,
  y: number,
  width: number,
  height: number,
): PhysicalScreenRect => ({ space: 'screen-physical', x, y, width, height })

export const physicalPoint = (x: number, y: number): PhysicalScreenPoint => ({
  space: 'screen-physical',
  x,
  y,
})

export const dipRect = (x: number, y: number, width: number, height: number): DipScreenRect => ({
  space: 'screen-dip',
  x,
  y,
  width,
  height,
})

export const dipPoint = (x: number, y: number): DipScreenPoint => ({ space: 'screen-dip', x, y })

export function isFinitePoint(point: Pick<SpatialPoint<CoordinateSpace>, 'x' | 'y'>): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

export function isFiniteRect(
  rect: Pick<SpatialRect<CoordinateSpace>, 'x' | 'y' | 'width' | 'height'>,
): boolean {
  return [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
}

export function isUsableRect(
  rect: Pick<SpatialRect<CoordinateSpace>, 'x' | 'y' | 'width' | 'height'>,
  minimumSize = 1,
): boolean {
  return isFiniteRect(rect) && rect.width >= minimumSize && rect.height >= minimumSize
}

export function rectArea(rect: Pick<SpatialRect<CoordinateSpace>, 'width' | 'height'>): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height)
}

export function rectCenter<S extends CoordinateSpace>(rect: SpatialRect<S>): SpatialPoint<S> {
  return {
    space: rect.space,
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  }
}

export function containsPoint<S extends CoordinateSpace>(
  rect: SpatialRect<S>,
  point: SpatialPoint<S>,
): boolean {
  return point.x >= rect.x
    && point.x < rect.x + rect.width
    && point.y >= rect.y
    && point.y < rect.y + rect.height
}

export function intersectRects<S extends CoordinateSpace>(
  first: SpatialRect<S>,
  second: SpatialRect<S>,
): SpatialRect<S> | null {
  const left = Math.max(first.x, second.x)
  const top = Math.max(first.y, second.y)
  const right = Math.min(first.x + first.width, second.x + second.width)
  const bottom = Math.min(first.y + first.height, second.y + second.height)
  if (right <= left || bottom <= top) return null
  return { space: first.space, x: left, y: top, width: right - left, height: bottom - top }
}

export function intersectionRatio<S extends CoordinateSpace>(
  rect: SpatialRect<S>,
  clippingRect: SpatialRect<S>,
): number {
  const area = rectArea(rect)
  if (area <= 0) return 0
  const intersection = intersectRects(rect, clippingRect)
  return intersection ? rectArea(intersection) / area : 0
}

export function toOverlayRect(rect: DipScreenRect, display: DisplayGeometry): OverlayRect {
  return {
    space: 'overlay-dip',
    x: rect.x - display.bounds.x,
    y: rect.y - display.bounds.y,
    width: rect.width,
    height: rect.height,
  }
}

export function toOverlayPoint(point: DipScreenPoint, display: DisplayGeometry): OverlayPoint {
  return {
    space: 'overlay-dip',
    x: point.x - display.bounds.x,
    y: point.y - display.bounds.y,
  }
}

function squaredDistanceToRect(point: DipScreenPoint, rect: DipScreenRect): number {
  const dx = point.x < rect.x
    ? rect.x - point.x
    : point.x > rect.x + rect.width
      ? point.x - (rect.x + rect.width)
      : 0
  const dy = point.y < rect.y
    ? rect.y - point.y
    : point.y > rect.y + rect.height
      ? point.y - (rect.y + rect.height)
      : 0
  return dx * dx + dy * dy
}

/**
 * Picks the display containing the clickable point, then the display with the
 * greatest target intersection. A nearest-display fallback is intentionally
 * not used for an entirely off-screen target.
 */
export function selectDisplayForRect(
  rect: DipScreenRect,
  displays: readonly DisplayGeometry[],
  clickablePoint?: DipScreenPoint,
): DisplayGeometry | null {
  if (clickablePoint && isFinitePoint(clickablePoint)) {
    const containing = displays.find(display => containsPoint(display.bounds, clickablePoint))
    if (containing) return containing
  }

  let best: DisplayGeometry | null = null
  let bestArea = 0
  for (const display of displays) {
    const intersection = intersectRects(rect, display.bounds)
    const area = intersection ? rectArea(intersection) : 0
    if (area > bestArea) {
      bestArea = area
      best = display
    }
  }
  if (best) return best

  // A point can be a pixel outside a monitor due to fractional-DPI rounding.
  // Permit a one-DIP tolerance, but do not pull arbitrary off-screen targets in.
  if (clickablePoint) {
    let nearest: DisplayGeometry | null = null
    let distance = Number.POSITIVE_INFINITY
    for (const display of displays) {
      const candidateDistance = squaredDistanceToRect(clickablePoint, display.bounds)
      if (candidateDistance < distance) {
        nearest = display
        distance = candidateDistance
      }
    }
    if (distance <= 1) return nearest
  }
  return null
}

export type OverlayPlacementFailureCode =
  | 'invalid_physical_bounds'
  | 'coordinate_conversion_failed'
  | 'invalid_dip_bounds'
  | 'off_screen'
  | 'mostly_off_screen'

export type OverlayPlacementResult =
  | {
      ok: true
      display: DisplayGeometry
      screenBounds: DipScreenRect
      localBounds: OverlayRect
      visibleLocalBounds: OverlayRect
      clickablePoint?: OverlayPoint
      visibleRatio: number
      partiallyVisible: boolean
      intersectsMultipleDisplays: boolean
    }
  | {
      ok: false
      code: OverlayPlacementFailureCode
    }

export interface OverlayPlacementOptions {
  /** Minimum fraction of the element that must be on the chosen display. */
  minimumVisibleRatio?: number
}

export function resolveOverlayPlacement(
  bounds: PhysicalScreenRect,
  clickablePoint: PhysicalScreenPoint | undefined,
  converter: PhysicalToDipConverter,
  displays: readonly DisplayGeometry[],
  options: OverlayPlacementOptions = {},
): OverlayPlacementResult {
  if (!isUsableRect(bounds)) return { ok: false, code: 'invalid_physical_bounds' }
  if (clickablePoint && !isFinitePoint(clickablePoint)) {
    return { ok: false, code: 'invalid_physical_bounds' }
  }

  let screenBounds: DipScreenRect
  let screenPoint: DipScreenPoint | undefined
  try {
    screenBounds = converter.rect(bounds)
    screenPoint = clickablePoint ? converter.point(clickablePoint) : undefined
  } catch {
    return { ok: false, code: 'coordinate_conversion_failed' }
  }
  if (!isUsableRect(screenBounds) || (screenPoint && !isFinitePoint(screenPoint))) {
    return { ok: false, code: 'invalid_dip_bounds' }
  }

  const display = selectDisplayForRect(screenBounds, displays, screenPoint)
  if (!display) return { ok: false, code: 'off_screen' }

  const clipped = intersectRects(screenBounds, display.bounds)
  if (!clipped) return { ok: false, code: 'off_screen' }
  const ratio = rectArea(clipped) / rectArea(screenBounds)
  const minimumVisibleRatio = options.minimumVisibleRatio ?? 0.6
  if (ratio < minimumVisibleRatio) return { ok: false, code: 'mostly_off_screen' }

  const intersectingDisplays = displays.reduce(
    (count, item) => count + (intersectRects(screenBounds, item.bounds) ? 1 : 0),
    0,
  )
  return {
    ok: true,
    display,
    screenBounds,
    localBounds: toOverlayRect(screenBounds, display),
    visibleLocalBounds: toOverlayRect(clipped, display),
    clickablePoint: screenPoint && containsPoint(display.bounds, screenPoint)
      ? toOverlayPoint(screenPoint, display)
      : undefined,
    visibleRatio: ratio,
    partiallyVisible: ratio < 0.999,
    intersectsMultipleDisplays: intersectingDisplays > 1,
  }
}

export type ObservationHitTest = 'self' | 'descendant' | 'blocked' | 'unknown'

export interface TargetObservation {
  readonly observedAt: number
  readonly displayRevision: number
  readonly foregroundWindowHandle?: string
  readonly window: {
    readonly handle: string
    readonly runtimeId: string | null
    readonly processId: number
    readonly minimized: boolean
    readonly offscreen: boolean
  }
  readonly element: {
    readonly runtimeId: string | null
    readonly automationId: string
    readonly name: string
    readonly role: string
    readonly className: string
    readonly bounds: PhysicalScreenRect
    readonly offscreen: boolean
  }
  readonly hitTest: ObservationHitTest
}

export interface ObservationProbe {
  readonly windowAvailable: boolean
  readonly observation: TargetObservation | null
}

export type StaleObservationFailureCode =
  | 'application_closed'
  | 'window_changed'
  | 'target_changed'
  | 'not_visible'
  | 'occluded'
  | 'screen_changed'

export type StaleObservationResult =
  | {
      ok: true
      identity: 'same-runtime-id' | 'stable-signature'
      moved: boolean
      displayChanged: boolean
      observation: TargetObservation
    }
  | {
      ok: false
      code: StaleObservationFailureCode
    }

export interface StaleObservationOptions {
  requireForeground?: boolean
  allowDisplayChange?: boolean
  allowRecreatedElement?: boolean
  /** Maximum bound delta accepted when UIA changed the element runtime ID. */
  recreatedElementTolerance?: number
  movementTolerance?: number
}

function normalizeIdentityText(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase()
}

function hasStableElementSignature(previous: TargetObservation, current: TargetObservation): boolean {
  const previousAutomationId = normalizeIdentityText(previous.element.automationId)
  const currentAutomationId = normalizeIdentityText(current.element.automationId)
  const sameRole = normalizeIdentityText(previous.element.role) === normalizeIdentityText(current.element.role)
  const sameClass = normalizeIdentityText(previous.element.className) === normalizeIdentityText(current.element.className)
  if (!sameRole || !sameClass) return false

  if (previousAutomationId && currentAutomationId) {
    return previousAutomationId === currentAutomationId
  }
  const previousName = normalizeIdentityText(previous.element.name)
  const currentName = normalizeIdentityText(current.element.name)
  return Boolean(previousName) && previousName === currentName
}

function rectMoved(first: PhysicalScreenRect, second: PhysicalScreenRect, tolerance: number): boolean {
  return Math.abs(first.x - second.x) > tolerance
    || Math.abs(first.y - second.y) > tolerance
    || Math.abs(first.width - second.width) > tolerance
    || Math.abs(first.height - second.height) > tolerance
}

/**
 * Validates a second UIA observation immediately before rendering. Movement of
 * the same element is safe: callers should render the returned fresh bounds.
 */
export function validateStaleObservation(
  previous: TargetObservation,
  probe: ObservationProbe,
  options: StaleObservationOptions = {},
): StaleObservationResult {
  if (!probe.windowAvailable) return { ok: false, code: 'application_closed' }
  const current = probe.observation
  if (!current) return { ok: false, code: 'target_changed' }

  if (current.window.handle !== previous.window.handle
      || current.window.processId !== previous.window.processId) {
    return { ok: false, code: 'window_changed' }
  }
  if (options.requireForeground
      && current.foregroundWindowHandle !== current.window.handle) {
    return { ok: false, code: 'window_changed' }
  }
  if (current.window.minimized || current.window.offscreen || current.element.offscreen
      || !isUsableRect(current.element.bounds)) {
    return { ok: false, code: 'not_visible' }
  }
  // An unavailable hit-test is not evidence that the target is still on top.
  // Exact guidance fails closed whenever visibility cannot be verified.
  if (current.hitTest === 'blocked' || current.hitTest === 'unknown') {
    return { ok: false, code: 'occluded' }
  }

  const displayChanged = current.displayRevision !== previous.displayRevision
  if (displayChanged && !options.allowDisplayChange) {
    return { ok: false, code: 'screen_changed' }
  }

  const sameRuntimeId = Boolean(previous.element.runtimeId)
    && previous.element.runtimeId === current.element.runtimeId
  let identity: 'same-runtime-id' | 'stable-signature'
  if (sameRuntimeId) {
    identity = 'same-runtime-id'
  } else if ((options.allowRecreatedElement ?? true) && hasStableElementSignature(previous, current)) {
    if (rectMoved(
      previous.element.bounds,
      current.element.bounds,
      options.recreatedElementTolerance ?? 8,
    )) {
      return { ok: false, code: 'target_changed' }
    }
    identity = 'stable-signature'
  } else {
    return { ok: false, code: 'target_changed' }
  }

  return {
    ok: true,
    identity,
    moved: rectMoved(previous.element.bounds, current.element.bounds, options.movementTolerance ?? 1),
    displayChanged,
    observation: current,
  }
}
