import { describe, expect, it } from 'vitest'
import {
  WINDOWS_NAVIGATION_TOPICS,
  getWindowsNavigation,
  matchWindowsNavigationTopic,
  normalizeNavigationQuery,
  normalizeWindowsVersion,
  resolveWindowsNavigation,
} from '../src/main/windows-navigation'

describe('Windows navigation knowledge', () => {
  it('normalizes chat input safely and consistently', () => {
    expect(normalizeNavigationQuery('  Where\u200B is WI\u2011FI?!  ')).toBe('where is wi-fi')
    expect(normalizeNavigationQuery(null)).toBeNull()
    expect(normalizeNavigationQuery({ toString: () => 'Bluetooth' })).toBeNull()
    expect(normalizeNavigationQuery('x'.repeat(2_001))).toBeNull()
  })

  it('recognizes supported Windows version labels without guessing', () => {
    expect(normalizeWindowsVersion('Microsoft Windows 11 Pro')).toBe('Windows 11')
    expect(normalizeWindowsVersion('win10')).toBe('Windows 10')
    expect(normalizeWindowsVersion('Windows')).toBeNull()
    expect(normalizeWindowsVersion('Windows 10 or Windows 11')).toBeNull()
    expect(normalizeWindowsVersion('macOS')).toBeNull()
  })

  it.each([
    ['Where is Bluetooth?', 'bluetooth'],
    ['Where can I change my display settings?', 'display'],
    ['Please open Device Manager', 'device_manager'],
    ['How do I uninstall a program?', 'uninstall_apps'],
    ['Where is the Wi-Fi button?', 'wifi'],
    ['Where do I find Windows Update?', 'windows_update'],
    ['Where can I change my sound output?', 'sound_output'],
    ['Where is the search bar?', 'windows_search'],
  ] as const)('matches %s', (query, topic) => {
    expect(matchWindowsNavigationTopic(query)).toBe(topic)
  })

  it.each([
    ['Where is Bluetooth?', 'bluetooth'],
    ['Where can I change my display settings?', 'display'],
    ['Please open Device Manager', 'device_manager'],
    ['How do I uninstall a program?', 'uninstall_apps'],
    ['Where is the Wi-Fi button?', 'wifi'],
    ['Where do I find Windows Update?', 'windows_update'],
    ['Where can I change my sound output?', 'sound_output'],
    ['Where is the search bar?', 'windows_search'],
  ] as const)('builds a valid walkthrough for %s', (query, topic) => {
    for (const os of ['Windows 10', 'Windows 11'] as const) {
      const result = resolveWindowsNavigation(query, os)
      expect(result).toMatchObject({ ok: true, source: 'windows_knowledge', topic, windowsVersion: os })
      expect(result?.steps?.length).toBeGreaterThan(0)
      expect(result?.steps?.map(step => step.stepNumber)).toEqual(
        result?.steps?.map((_, index) => index + 1),
      )
      for (const step of result?.steps ?? []) {
        expect(['start_menu', 'taskbar', 'ui_element', 'none']).toContain(step.target.zone)
        expect(step.instruction.trim().length).toBeGreaterThan(0)
        if (step.target.zone !== 'none') {
          expect(step.target.name).toBeTruthy()
          expect(step.target.role).toBeTruthy()
          expect(step.target.hint).toBeTruthy()
        }
      }
    }
  })

  it('keeps the exported topic inventory complete and unique', () => {
    expect(new Set(WINDOWS_NAVIGATION_TOPICS).size).toBe(8)
    expect(WINDOWS_NAVIGATION_TOPICS).toContain('windows_update')
  })

  it.each([
    ['Tell me about Bluetooth', 'Windows 11'],
    ['Why is Bluetooth not working?', 'Windows 11'],
    ['Where is this button?', 'Windows 11'],
    ['Where are Bluetooth and display settings?', 'Windows 11'],
    ['Where is the search bar in Chrome?', 'Windows 11'],
    ['Where is Bluetooth on my Mac?', 'Windows 11'],
    ['Where is Bluetooth?', 'macOS'],
    ['Where is Bluetooth?', 'Windows'],
    ['How do I uninstall a printer driver?', 'Windows 11'],
    ['Windows 10 and Windows 11 display settings', 'Windows 11'],
    ['Where is Bluetooth on Windows 7?', 'Windows 11'],
    ['Where is Bluetooth on Windows Server?', 'Windows 11'],
    [null, 'Windows 11'],
  ] as const)('returns null for unsupported or ambiguous input: %s / %s', (query, os) => {
    expect(resolveWindowsNavigation(query, os)).toBeNull()
  })

  it('returns a successful shared-contract result with contiguous steps', () => {
    const result = resolveWindowsNavigation('Where is Bluetooth?', 'Windows 11')

    expect(result).toMatchObject({
      ok: true,
      source: 'windows_knowledge',
      topic: 'bluetooth',
      windowsVersion: 'Windows 11',
    })
    expect(result?.steps?.map(step => step.stepNumber)).toEqual([1, 2])
    expect(result?.steps?.[0].target).toMatchObject({
      zone: 'start_menu',
      name: 'Start',
      role: 'Button',
      visibility: 'visible_now',
    })
    expect(result?.steps?.[1].target).toMatchObject({
      zone: 'ui_element',
      app: 'Settings',
      name: 'Bluetooth',
      visibility: 'after_navigation',
    })
  })

  it('uses stable Start landmarks and version-specific Settings names', () => {
    const win10Bluetooth = getWindowsNavigation('Bluetooth settings', 'Windows 10')
    const win11Bluetooth = getWindowsNavigation('Bluetooth settings', 'Windows 11')
    const win10Uninstall = getWindowsNavigation('Uninstall a program', 'Windows 10')
    const win11Uninstall = getWindowsNavigation('Uninstall a program', 'Windows 11')

    expect(win10Bluetooth?.steps?.[0].target.hint).toContain('on the taskbar')
    expect(win11Bluetooth?.steps?.[0].target.hint).toContain('on the taskbar')
    expect(win10Bluetooth?.steps?.[0].target.hint).not.toMatch(/far-left|bottom-left|middle|center/i)
    expect(win10Bluetooth?.steps?.[0].instruction).toContain('Bluetooth and other devices settings')
    expect(win11Bluetooth?.steps?.[0].instruction).toContain('Bluetooth & devices settings')
    expect(win10Uninstall?.steps?.[0].instruction).toContain('Add or remove programs')
    expect(win11Uninstall?.steps?.[0].instruction).toContain('Installed apps')
  })

  it('does not split transient Windows 11 menus across Retza steps', () => {
    const result = resolveWindowsNavigation('How do I uninstall an app?', 'Windows 11')
    const menuSteps = result?.steps?.filter(step => /more options|uninstall/i.test(step.instruction)) ?? []

    expect(menuSteps).toHaveLength(1)
    expect(menuSteps[0].instruction).toMatch(/More options.*Uninstall/i)
    expect(menuSteps[0].instruction).toContain('before returning to Retza')
    expect(menuSteps[0].target.zone).toBe('none')
  })

  it('keeps Wi-Fi flyout work atomic and marks the taskbar target semantically', () => {
    const result = resolveWindowsNavigation('Show me where the Wi-Fi button is', 'Windows 11')

    expect(result?.steps).toHaveLength(1)
    expect(result?.steps?.[0].instruction).toContain('before returning to Retza')
    expect(result?.steps?.[0].target).toMatchObject({
      zone: 'taskbar',
      name: 'Network',
      role: 'Button',
      window: 'Shell_TrayWnd',
      visibility: 'visible_now',
    })
  })

  it('marks Windows Search semantically without assuming taskbar alignment', () => {
    const win10 = resolveWindowsNavigation('Where is the search bar?', 'Windows 10')
    const win11 = resolveWindowsNavigation('Where is the search bar?', 'Windows 11')

    expect(win10?.text).toContain('taskbar near the Windows-logo Start button')
    expect(win11?.text).toContain('taskbar near the Windows-logo Start button')
    expect(`${win10?.text} ${win11?.text}`).not.toMatch(/right of Start|centered Start|bottom-left/i)
    expect(win10?.steps?.[0].target.zone).toBe('taskbar')
    expect(win11?.steps?.[0].target.name).toBe('Search')
  })

  it('returns fresh walkthrough data on every lookup', () => {
    const first = resolveWindowsNavigation('Display settings', 'Windows 11')
    const second = resolveWindowsNavigation('Display settings', 'Windows 11')

    expect(first).not.toBe(second)
    expect(first?.steps).not.toBe(second?.steps)
    expect(first).toEqual(second)
  })
})
