import { BrowserWindow } from 'electron'
import { uIOhook, UiohookMouseEvent } from 'uiohook-napi'

// -- Configurable thresholds ----------------------------------------------------

export const DETECTOR_CONFIG = {
  idle: {
    thresholdMs: 45_000,   // no input for this long → offer help
    pollMs:       5_000,   // how often the idle check runs
  },
  rageClick: {
    count:    3,           // clicks needed to trigger
    radiusPx: 60,          // within this pixel radius
    windowMs: 2_000,       // within this time window
  },
  longHover: {
    radiusPx:    30,       // movement within this radius counts as "same spot"
    thresholdMs: 8_000,   // hover this long without clicking → offer help
    pollMs:       1_000,  // how often the hover timer is checked
  },
  cooldownMs: 120_000,    // minimum gap between any two triggers
}

// -- Types ----------------------------------------------------------------------

export type Detector = 'idle' | 'rageClick' | 'longHover'

// -- Main export ----------------------------------------------------------------

/**
 * Starts all three struggle detectors. Returns a cleanup function.
 * Must be called after the Electron app is ready.
 */
export function startStruggleDetectors(getAllWindows: () => BrowserWindow[]): () => void {
  let lastTriggerAt = 0

  function trigger(detector: Detector): void {
    const now = Date.now()
    if (now - lastTriggerAt < DETECTOR_CONFIG.cooldownMs) return
    lastTriggerAt = now
    console.log(`[struggle] ${detector} triggered`)
    for (const win of getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('struggle-detected', detector)
    }
  }

  // -- Shared state -------------------------------------------------------------

  let lastActivityAt = Date.now()

  // -- Rage-click state ----------------------------------------------------------
  // Sorted array of recent clicks, oldest first. Pruned on each click.
  const recentClicks: Array<{ x: number; y: number; at: number }> = []

  // -- Long-hover state ----------------------------------------------------------
  // Anchor = position where hovering started. Null = not tracking yet.
  let hoverAnchor: { x: number; y: number } | null = null
  let hoverSince = 0

  // -- Event handlers ------------------------------------------------------------

  function onMouseMove(e: UiohookMouseEvent): void {
    lastActivityAt = Date.now()

    if (!hoverAnchor) {
      hoverAnchor = { x: e.x, y: e.y }
      hoverSince = Date.now()
      return
    }

    const dx = e.x - hoverAnchor.x
    const dy = e.y - hoverAnchor.y
    // Moved outside the dwell radius → reset anchor to current position
    if (dx * dx + dy * dy > DETECTOR_CONFIG.longHover.radiusPx ** 2) {
      hoverAnchor = { x: e.x, y: e.y }
      hoverSince = Date.now()
    }
    // Inside radius → anchor stays; dwell time keeps accumulating
  }

  function onMouseClick(e: UiohookMouseEvent): void {
    lastActivityAt = Date.now()

    // A click interrupts the hover  -  reset so we only trigger on stationary dwell
    hoverAnchor = null
    hoverSince = 0

    // -- Rage-click check ------------------------------------------------------
    const now = Date.now()
    const cutoff = now - DETECTOR_CONFIG.rageClick.windowMs

    // Prune clicks that fell outside the time window
    let i = 0
    while (i < recentClicks.length && recentClicks[i].at < cutoff) i++
    recentClicks.splice(0, i)

    recentClicks.push({ x: e.x, y: e.y, at: now })

    const r2 = DETECTOR_CONFIG.rageClick.radiusPx ** 2
    for (const anchor of recentClicks) {
      const cluster = recentClicks.filter(c => {
        const dx = c.x - anchor.x
        const dy = c.y - anchor.y
        return dx * dx + dy * dy <= r2
      })
      if (cluster.length >= DETECTOR_CONFIG.rageClick.count) {
        trigger('rageClick')
        recentClicks.length = 0 // clear so the same burst doesn't retrigger
        break
      }
    }
  }

  function onKeyDown(): void {
    lastActivityAt = Date.now()
    // Typing means the user is active and also interrupts a stationary hover.
    hoverAnchor = null
    hoverSince = 0
  }

  // -- Wire up uiohook -----------------------------------------------------------

  uIOhook.on('mousemove', onMouseMove)
  uIOhook.on('click', onMouseClick)
  uIOhook.on('keydown', onKeyDown)
  try {
    uIOhook.start()
  } catch (error) {
    uIOhook.off('mousemove', onMouseMove)
    uIOhook.off('click', onMouseClick)
    uIOhook.off('keydown', onKeyDown)
    throw error
  }

  // Install polling only after the native hook starts successfully, so a
  // startup error cannot leak background intervals.
  const idleInterval = setInterval(() => {
    if (Date.now() - lastActivityAt >= DETECTOR_CONFIG.idle.thresholdMs) {
      trigger('idle')
      lastActivityAt = Date.now()
    }
  }, DETECTOR_CONFIG.idle.pollMs)

  const hoverInterval = setInterval(() => {
    if (hoverAnchor && Date.now() - hoverSince >= DETECTOR_CONFIG.longHover.thresholdMs) {
      trigger('longHover')
      hoverAnchor = null
      hoverSince = 0
    }
  }, DETECTOR_CONFIG.longHover.pollMs)

  // -- Cleanup -------------------------------------------------------------------

  let stopped = false
  return (): void => {
    if (stopped) return
    stopped = true
    clearInterval(idleInterval)
    clearInterval(hoverInterval)
    uIOhook.off('mousemove', onMouseMove)
    uIOhook.off('click', onMouseClick)
    uIOhook.off('keydown', onKeyDown)
    uIOhook.stop()
  }
}
