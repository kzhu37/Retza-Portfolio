import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import type { TargetPayload } from '../../shared/contracts'
import { physicalPoint, physicalRect } from './geometry'
import {
  constrainQueryToObservedWindow,
  parseUiaProtocol,
  rankUiaCandidates,
  runWindowsUiaQuery,
  type UiaCandidate,
  type UiaSnapshot,
  type WindowsUiaQuery,
} from './windows-uia'
import {
  queryForTarget,
  resolveExactTarget,
  revalidateExactTarget,
  validateTargetPayload,
} from './target-resolver'

function candidate(overrides: {
  runtimeId?: string
  name?: string
  automationId?: string
  className?: string
  role?: string
  enabled?: boolean
  elementOffscreen?: boolean
  clickable?: boolean
  patterns?: string[]
  hitTest?: UiaCandidate['hitTest']
  bounds?: ReturnType<typeof physicalRect>
  windowHandle?: string
  windowName?: string
  windowClass?: string
  processName?: string
  foreground?: boolean
  minimized?: boolean
  windowOffscreen?: boolean
} = {}): UiaCandidate {
  const bounds = overrides.bounds ?? physicalRect(120, 180, 180, 42)
  return {
    capturedAt: 1_000,
    window: {
      handle: overrides.windowHandle ?? '101',
      runtimeId: 'window-runtime',
      processId: 20,
      processName: overrides.processName ?? 'SystemSettings',
      name: overrides.windowName ?? 'Bluetooth & devices - Settings',
      className: overrides.windowClass ?? 'ApplicationFrameWindow',
      bounds: physicalRect(0, 0, 1200, 900),
      minimized: overrides.minimized ?? false,
      offscreen: overrides.windowOffscreen ?? false,
      foreground: overrides.foreground ?? true,
    },
    element: {
      runtimeId: overrides.runtimeId ?? 'element-runtime',
      name: overrides.name ?? 'Bluetooth',
      automationId: overrides.automationId ?? '',
      className: overrides.className ?? 'Button',
      frameworkId: 'XAML',
      role: overrides.role ?? 'Button',
      bounds,
      clickablePoint: (overrides.clickable ?? true)
        ? physicalPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
        : undefined,
      enabled: overrides.enabled ?? true,
      offscreen: overrides.elementOffscreen ?? false,
      patterns: overrides.patterns ?? ['Invoke'],
    },
    hitTest: overrides.hitTest ?? 'self',
  }
}

function snapshot(candidates: UiaCandidate[], truncated = false): UiaSnapshot {
  return {
    capturedAt: 1_000,
    foregroundWindowHandle: '101',
    windowsInspected: 1,
    matchingWindows: 1,
    nodesVisited: 50,
    truncated,
    candidates,
  }
}

describe('UI Automation candidate matching', () => {
  it('accepts a uniquely scoped exact semantic name and role', () => {
    const query: WindowsUiaQuery = {
      action: 'click',
      names: ['Bluetooth'],
      roles: ['Button'],
      windowNames: ['Settings'],
    }
    const result = rankUiaCandidates(query, snapshot([candidate()]))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.confidence).toBeGreaterThanOrEqual(0.78)
    expect(result.evidence.map(item => item.kind)).toEqual(expect.arrayContaining([
      'name-exact',
      'role',
      'window-name',
      'visible',
      'actionable',
    ]))
  })

  it('matches dynamic Windows Search text through curated prefix aliases', () => {
    const target: TargetPayload = {
      zone: 'start_menu',
      app: null,
      action: 'click',
      hint: 'the Search box',
      name: 'Search',
      role: 'Pane',
      window: null,
      visibility: 'visible_now',
    }
    const query = queryForTarget(target, 999)
    expect(query).not.toBeNull()
    if (!query) return
    const search = candidate({
      name: 'Search - Brooklyn Bridge, New York City, USA',
      automationId: '4101',
      className: 'Button',
      role: 'Pane',
      patterns: [],
      windowName: 'Taskbar',
      windowClass: 'Shell_TrayWnd',
      processName: 'explorer',
      foreground: false,
      bounds: physicalRect(48, 1040, 288, 40),
    })
    const result = rankUiaCandidates(query, snapshot([search]))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.evidence.map(item => item.kind)).toContain('name-prefix')
      expect(result.candidate.element.name).toContain('Search -')
    }
  })

  it('uses the Start name/class aliases when StartButton AutomationId is absent', () => {
    const target: TargetPayload = {
      zone: 'start_menu', app: null, action: 'click', hint: 'the Windows logo',
      name: null, role: null, window: null,
    }
    const query = queryForTarget(target)
    expect(query).not.toBeNull()
    if (!query) return
    const start = candidate({
      name: 'Start', automationId: '', className: 'Start', role: 'Pane', patterns: [],
      windowClass: 'Shell_TrayWnd', windowName: 'Taskbar', processName: 'explorer',
      foreground: false, bounds: physicalRect(0, 1040, 48, 40),
    })
    const result = rankUiaCandidates(query, snapshot([start]))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.candidate.element.automationId).toBe('')
  })

  it('rejects two similarly strong candidates as ambiguous', () => {
    const query: WindowsUiaQuery = {
      action: 'click', names: ['Bluetooth'], roles: ['Button'], windowNames: ['Settings'],
    }
    const first = candidate({ runtimeId: 'first', bounds: physicalRect(120, 180, 180, 42) })
    const second = candidate({ runtimeId: 'second', bounds: physicalRect(120, 280, 180, 42) })
    expect(rankUiaCandidates(query, snapshot([first, second]))).toMatchObject({
      ok: false,
      code: 'ambiguous',
    })
  })

  it('can constrain the validation query to the originally observed HWND', () => {
    const initialQuery: WindowsUiaQuery = {
      action: 'click', names: ['Bluetooth'], roles: ['Button'], windowNames: ['Settings'],
    }
    const original = candidate({ runtimeId: 'first', windowHandle: '101' })
    const replacementWindow = candidate({ runtimeId: 'second', windowHandle: '202' })
    const constrained = constrainQueryToObservedWindow(initialQuery, original)
    expect(constrained.windowHandles).toEqual(['101'])
    const result = rankUiaCandidates(constrained, snapshot([original, replacementWindow]))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.candidate.window.handle).toBe('101')
  })

  it('distinguishes hidden, disabled, and occluded semantic matches', () => {
    const query: WindowsUiaQuery = {
      action: 'click', names: ['Bluetooth'], roles: ['Button'], windowNames: ['Settings'],
    }
    expect(rankUiaCandidates(query, snapshot([candidate({ elementOffscreen: true })])))
      .toMatchObject({ ok: false, code: 'not_visible' })
    expect(rankUiaCandidates(query, snapshot([candidate({ enabled: false })])))
      .toMatchObject({ ok: false, code: 'not_actionable' })
    expect(rankUiaCandidates(query, snapshot([candidate({ hitTest: 'blocked' })])))
      .toMatchObject({ ok: false, code: 'occluded' })
    expect(rankUiaCandidates(query, snapshot([candidate({ hitTest: 'unknown' })])))
      .toMatchObject({ ok: false, code: 'occluded' })
  })

  it('does not accept a role/window match without semantic element evidence', () => {
    const query: WindowsUiaQuery = {
      action: 'click', names: ['Wi-Fi'], roles: ['Button'], windowNames: ['Settings'],
    }
    const result = rankUiaCandidates(query, snapshot([candidate({ name: 'Bluetooth' })]))
    expect(result).toMatchObject({ ok: false, code: 'not_found' })
  })
})

function frame(payload: unknown): string {
  return `RETZA_UIA:${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')}`
}

describe('UI Automation framed protocol', () => {
  it('parses the final framed response while ignoring warnings', () => {
    const payload = {
      ok: true,
      capturedAt: 1,
      foregroundWindowHandle: '10',
      windowsInspected: 1,
      matchingWindows: 1,
      nodesVisited: 2,
      truncated: false,
      candidates: [],
    }
    const result = parseUiaProtocol(`PowerShell warning\r\n${frame(payload)}\r\n`)
    expect(result).toEqual({ ok: true, payload })
  })

  it('rejects a missing frame, malformed JSON, and invalid envelope', () => {
    expect(parseUiaProtocol('ordinary stdout')).toMatchObject({ ok: false })
    expect(parseUiaProtocol(`RETZA_UIA:${Buffer.from('{', 'utf8').toString('base64')}`))
      .toMatchObject({ ok: false, detail: expect.stringContaining('malformed JSON') })
    expect(parseUiaProtocol(frame({ candidates: [] })))
      .toMatchObject({ ok: false, detail: expect.stringContaining('invalid envelope') })
  })

  it('can smoke-test the real Windows UIA transport when explicitly enabled', async () => {
    if (process.env.RETZA_LIVE_UIA !== '1' || process.platform !== 'win32') return
    const liveQuery: WindowsUiaQuery = {
      action: 'click',
      scope: 'taskbar',
      names: ['Start'],
      automationIds: ['StartButton'],
      classNames: ['Start'],
      roles: ['Button', 'Pane'],
      windowClasses: ['Shell_TrayWnd', 'Shell_SecondaryTrayWnd'],
      processNames: ['explorer'],
      maxNodes: 800,
    }
    const result = await runWindowsUiaQuery(liveQuery, { timeoutMs: 12_000 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.snapshot.matchingWindows).toBeGreaterThan(0)
      expect(result.snapshot.candidates.some(item => item.element.name === 'Start')).toBe(true)
      const match = rankUiaCandidates(liveQuery, result.snapshot)
      // Multiple monitors can legitimately expose one equally strong Start
      // element each. Refusing that as ambiguous is safer than choosing one.
      if (!match.ok) expect(match.code).toBe('ambiguous')
    }
  }, 15_000)
})

describe('target validation and exact resolution', () => {
  it('rejects malformed targets without throwing', () => {
    expect(validateTargetPayload(null).ok).toBe(false)
    expect(validateTargetPayload({ zone: 'somewhere', action: 'click', app: null, hint: null }).ok).toBe(false)
    expect(validateTargetPayload({ zone: 'ui_element', action: 'launch', app: null, hint: null }).ok).toBe(false)
    expect(validateTargetPayload({
      zone: 'ui_element', action: 'click', app: null, hint: null, name: 'Save', role: 'dragon',
    }).ok).toBe(false)
  })

  it('does not permanently reject after-navigation targets before checking live UIA', async () => {
    const runner = vi.fn(async () => ({ ok: true as const, snapshot: snapshot([]) }))
    const result = await resolveExactTarget({
      zone: 'ui_element',
      app: null,
      action: 'click',
      hint: 'Bluetooth',
      name: 'Bluetooth',
      role: 'Button',
      window: 'Settings',
      visibility: 'after_navigation',
    }, { platform: 'win32', runner })
    expect(runner).toHaveBeenCalledOnce()
    expect(result).toMatchObject({ ok: false, code: 'not_found' })
  })

  it('returns only a high-confidence exact candidate from the injected live snapshot', async () => {
    const expected = candidate()
    const runner = vi.fn(async () => ({ ok: true as const, snapshot: snapshot([expected]) }))
    const result = await resolveExactTarget({
      zone: 'ui_element',
      app: null,
      action: 'click',
      hint: 'Bluetooth',
      name: 'Bluetooth',
      role: 'Button',
      window: 'Settings',
      visibility: 'visible_now',
    }, { platform: 'win32', runner, displayRevision: 7 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.precision).toBe('exact-bounds')
    expect(result.confidence).toBeGreaterThanOrEqual(0.78)
    expect(result.observation.displayRevision).toBe(7)
    expect(result.observation.window.handle).toBe('101')
  })

  it('uses the originating display to disambiguate duplicated taskbar controls', async () => {
    const leftStart = candidate({
      runtimeId: 'left-start',
      name: 'Start',
      automationId: '',
      className: 'Start',
      role: 'Pane',
      patterns: ['Invoke'],
      windowHandle: '101',
      windowClass: 'Shell_SecondaryTrayWnd',
      windowName: 'Taskbar',
      processName: 'explorer',
      bounds: physicalRect(-1880, 1040, 48, 40),
    })
    const primaryStart = candidate({
      runtimeId: 'primary-start',
      name: 'Start',
      automationId: '',
      className: 'Start',
      role: 'Pane',
      patterns: ['Invoke'],
      windowHandle: '202',
      windowClass: 'Shell_TrayWnd',
      windowName: 'Taskbar',
      processName: 'explorer',
      bounds: physicalRect(840, 1040, 48, 40),
    })
    const result = await resolveExactTarget({
      zone: 'start_menu', app: null, action: 'click', hint: 'Start', name: 'Start',
    }, {
      platform: 'win32',
      preferredDisplayBounds: physicalRect(0, 0, 1920, 1080),
      runner: async () => ({ ok: true, snapshot: snapshot([leftStart, primaryStart]) }),
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.candidate.window.handle).toBe('202')
  })

  it('refuses a coarse zone with no semantic or curated exact selector', async () => {
    const runner = vi.fn()
    const result = await resolveExactTarget({
      zone: 'screen_center', app: null, action: 'look', hint: 'the middle',
    }, { platform: 'win32', runner })
    expect(result).toMatchObject({ ok: false, code: 'not_locatable' })
    expect(runner).not.toHaveBeenCalled()
  })

  it('preserves permission and transport failures as explicit states', async () => {
    const permission = await resolveExactTarget({
      zone: 'ui_element', app: null, action: 'click', hint: 'Save', name: 'Save', role: 'Button',
    }, {
      platform: 'win32',
      runner: async () => ({ ok: false, code: 'access_denied' }),
    })
    expect(permission).toMatchObject({ ok: false, code: 'permission_denied', retryable: false })

    const timeout = await resolveExactTarget({
      zone: 'ui_element', app: null, action: 'click', hint: 'Save', name: 'Save', role: 'Button',
    }, {
      platform: 'win32',
      runner: async () => ({ ok: false, code: 'timeout' }),
    })
    expect(timeout).toMatchObject({ ok: false, code: 'uia_unavailable', retryable: true })
  })

  it('revalidates against the same HWND and returns fresh moved bounds', async () => {
    const original = candidate({ runtimeId: 'stable-element' })
    const initial = await resolveExactTarget({
      zone: 'ui_element', app: null, action: 'click', hint: 'Bluetooth',
      name: 'Bluetooth', role: 'Button', window: 'Settings',
    }, {
      platform: 'win32',
      runner: async () => ({ ok: true, snapshot: snapshot([original]) }),
      displayRevision: 2,
    })
    expect(initial.ok).toBe(true)
    if (!initial.ok) return

    const moved = candidate({
      runtimeId: 'stable-element',
      bounds: physicalRect(420, 300, 180, 42),
    })
    const runner = vi.fn(async (query: WindowsUiaQuery) => {
      expect(query.windowHandles).toEqual(['101'])
      expect(query.windowNames).toEqual([])
      return { ok: true as const, snapshot: snapshot([moved]) }
    })
    const revalidated = await revalidateExactTarget(initial, {
      platform: 'win32', runner, displayRevision: 2,
    })
    expect(revalidated.ok).toBe(true)
    if (!revalidated.ok) return
    expect(revalidated.validation.moved).toBe(true)
    expect(revalidated.candidate.element.bounds.x).toBe(420)
  })

  it('reports closed windows and display changes during revalidation', async () => {
    const original = candidate()
    const initial = await resolveExactTarget({
      zone: 'ui_element', app: null, action: 'click', hint: 'Bluetooth',
      name: 'Bluetooth', role: 'Button', window: 'Settings',
    }, {
      platform: 'win32',
      runner: async () => ({ ok: true, snapshot: snapshot([original]) }),
      displayRevision: 4,
    })
    if (!initial.ok) throw new Error('Initial fixture did not resolve.')

    const noWindow: UiaSnapshot = { ...snapshot([]), matchingWindows: 0 }
    expect(await revalidateExactTarget(initial, {
      platform: 'win32', runner: async () => ({ ok: true, snapshot: noWindow }),
    })).toMatchObject({ ok: false, code: 'application_closed' })

    expect(await revalidateExactTarget(initial, {
      platform: 'win32',
      displayRevision: 5,
      runner: async () => ({ ok: true, snapshot: snapshot([original]) }),
    })).toMatchObject({ ok: false, code: 'screen_changed' })

    const accepted = await revalidateExactTarget(initial, {
      platform: 'win32',
      displayRevision: 5,
      allowDisplayChange: true,
      runner: async () => ({ ok: true, snapshot: snapshot([original]) }),
    })
    expect(accepted.ok).toBe(true)
    if (accepted.ok) expect(accepted.validation.displayChanged).toBe(true)
  })
})
