/*
 * prereq-detector.ts
 *
 * Inspects a walkthrough step list and prepends any missing prerequisite steps.
 *
 * Rules applied (in order):
 *   1. needs_browser  — any step references a website or browser zone → open browser first
 *   2. needs_website  — task targets a specific domain → navigate to it first
 *
 * All checks are read-only. Never modifies system state.
 */

import type { SystemState } from './system-state'
import { isBrowserRunning } from './system-state'
import type { StepPayload } from '../shared/contracts'

// ── Local type mirrors (structurally match main/index.ts) ─────────────────────

export type WalkthroughStep = StepPayload

// ── Detection helpers ─────────────────────────────────────────────────────────

const WEBSITE_SIGNALS: RegExp[] = [
  /\bwebsite\b/i, /\bweb browser\b/i,
  /\bopen a tab\b/i, /\btype.*address\b/i,
  /\bgmail\b/i, /\byoutube\b/i, /\bgoogle(?: search|\.com)\b/i, /\bfacebook\b/i,
  /\bamazon\b/i, /\bnetflix\b/i, /\boutlook\.com\b/i, /\btwitter\b/i,
  /\bhttps?:\/\//i, /\b\w+\.com\b/i,
]

const KNOWN_SITES: Array<{ pattern: RegExp; domain: string; displayName: string }> = [
  { pattern: /\bgmail\b/i,            domain: 'gmail.com',    displayName: 'Gmail' },
  { pattern: /\byoutube\b/i,          domain: 'youtube.com',  displayName: 'YouTube' },
  { pattern: /\bgoogle(?: search|\.com)\b/i, domain: 'google.com', displayName: 'Google' },
  { pattern: /\bfacebook\b/i,         domain: 'facebook.com', displayName: 'Facebook' },
  { pattern: /\bamazon\b/i,           domain: 'amazon.com',   displayName: 'Amazon' },
  { pattern: /\bnetflix\b/i,          domain: 'netflix.com',  displayName: 'Netflix' },
  { pattern: /\boutlook\.com\b/i,     domain: 'outlook.com',  displayName: 'Outlook' },
  { pattern: /\btwitter\b/i,          domain: 'x.com',        displayName: 'Twitter/X' },
  { pattern: /\bwikipedia\b/i,        domain: 'wikipedia.org', displayName: 'Wikipedia' },
  { pattern: /\bbbc\b.*news/i,        domain: 'bbc.com/news', displayName: 'BBC News' },
]

function stepListNeedsBrowser(steps: WalkthroughStep[]): boolean {
  return steps.some(s =>
    s.target.zone === 'browser_address_bar' ||
    WEBSITE_SIGNALS.some(r => r.test(s.instruction))
  )
}

function findTargetSite(steps: WalkthroughStep[]): { domain: string; displayName: string } | null {
  for (const step of steps) {
    for (const site of KNOWN_SITES) {
      if (site.pattern.test(step.instruction)) return site
    }
  }
  return null
}

function alreadyIncludesSiteNavigation(steps: WalkthroughStep[], domain: string): boolean {
  const host = domain.split('/')[0].replace(/^www\./, '')
  return steps.some(step =>
    step.target.zone === 'browser_address_bar'
      && step.instruction.toLowerCase().includes(host.toLowerCase()),
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

export function checkPrerequisites(
  steps: WalkthroughStep[],
  state: SystemState,
  defaultBrowser: string,
): WalkthroughStep[] {
  const prereqs: WalkthroughStep[] = []
  const browserNeeded = stepListNeedsBrowser(steps)
  const targetSite = findTargetSite(steps)
  const browserRunning = isBrowserRunning(state)
  const visibleBrowser = state.visibleWindows[0]?.app
  const browserName = visibleBrowser
    ?? (defaultBrowser && defaultBrowser !== 'Unknown' ? defaultBrowser : 'your web browser')

  if (browserNeeded) {
    if (!browserRunning) {
      prereqs.push({
        stepNumber: 0,
        instruction: `First, open ${browserName}. Click the Start button, type ${browserName === 'your web browser' ? 'browser' : `"${browserName}"`}, then press Enter.`,
        target: {
          zone: 'start_menu',
          app: null,
          action: 'click',
          hint: 'the Start button with the Windows logo on the taskbar',
        },
        prereq: true,
      })
    }

    if (targetSite && !alreadyIncludesSiteNavigation(steps, targetSite.domain)) {
      const verb = browserRunning ? `If ${targetSite.displayName} is not already visible, click` : 'Once your browser opens, click'
      prereqs.push({
        stepNumber: 0,
        instruction: `${verb} the address bar near the top of the browser window. Type "${targetSite.domain}" and then press Enter.`,
        target: {
          zone: 'browser_address_bar',
          app: browserName === 'your web browser' ? null : browserName,
          action: 'type',
          hint: 'the address field near the top of the browser window, where website addresses are typed',
          name: 'Address and search bar',
          role: 'Edit',
          window: browserName === 'your web browser' ? null : browserName,
          visibility: browserRunning ? 'visible_now' : 'after_navigation',
        },
        prereq: true,
      })
    }
  }

  if (prereqs.length === 0) {
    console.log('[prereq-detector] No prerequisites needed')
    return steps
  }

  console.log(`[prereq-detector] Prepending ${prereqs.length} prerequisite step(s)`)
  return [...prereqs, ...steps].map((s, i) => ({ ...s, stepNumber: i + 1 }))
}
