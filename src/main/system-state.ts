/*
 * system-state.ts
 *
 * Read-only snapshot of what processes and browser windows are currently running.
 * Used for prerequisite detection — never modifies or interacts with any process.
 *
 * Windows: tasklist /FO CSV (process list), PowerShell UIAutomation (window titles)
 * Mac:     ps (process list) — window titles not yet implemented
 */

import { exec } from 'child_process'
import { platform } from 'os'

const IS_WIN = platform() === 'win32'
const IS_MAC = platform() === 'darwin'

export interface VisibleWindow {
  app: string
  title: string
}

export interface SystemState {
  runningApps: string[]         // lowercase process names, e.g. ["chrome.exe", "explorer.exe"]
  visibleWindows: VisibleWindow[]
  browserOpenSites: string[]    // e.g. ["Gmail", "YouTube"]
  defaultBrowser: string
}

function runCmd(cmd: string, timeoutMs = 5000): Promise<string> {
  return new Promise(resolve => {
    exec(cmd, { timeout: timeoutMs }, (_err, stdout) => resolve(stdout ? stdout.trim() : ''))
  })
}

function runPS(script: string, timeoutMs = 8000): Promise<string> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return new Promise(resolve => {
    exec(
      `powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      { timeout: timeoutMs, windowsHide: true },
      (_err, stdout) => resolve(stdout ? stdout.trim() : '')
    )
  })
}

async function getRunningAppsWin(): Promise<string[]> {
  const out = await runCmd('tasklist /FO CSV /NH', 4000)
  return out.split(/\r?\n/)
    .map(line => { const m = line.match(/^"([^"]+)"/) ; return m ? m[1].toLowerCase() : '' })
    .filter(Boolean)
}

async function getRunningAppsMac(): Promise<string[]> {
  const out = await runCmd('ps -e -o comm= | sort -u', 4000)
  return out.split('\n').map(s => s.trim().toLowerCase()).filter(Boolean)
}

// Enumerate usable top-level browser windows. A background helper process is
// not enough: prerequisite guidance needs an actual, non-minimized window.
const PS_BROWSER_WINDOWS = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$wins = $root.FindAll([System.Windows.Automation.TreeScope]::Children,
  [System.Windows.Automation.Condition]::TrueCondition)
foreach ($w in $wins) {
  try {
    $n = [string]$w.Current.Name
    $offscreen = [bool]$w.Current.IsOffscreen
    $pidValue = [int]$w.Current.ProcessId
    $processName = [string](Get-Process -Id $pidValue -ErrorAction Stop).ProcessName
    $isBrowser = $processName -match '^(chrome|msedge|firefox|brave|opera)$'
    $minimized = $false
    try {
      $pattern = $w.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern)
      $minimized = $pattern.Current.WindowVisualState -eq [System.Windows.Automation.WindowVisualState]::Minimized
    } catch {}
    if ($n -and $isBrowser -and !$offscreen -and !$minimized) {
      Write-Output "$processName||$n"
    }
  } catch {
  }
}`.trim()

async function getVisibleWindowsWin(): Promise<VisibleWindow[]> {
  const out = await runPS(PS_BROWSER_WINDOWS)
  const windows: VisibleWindow[] = []
  for (const line of out.split(/\r?\n/)) {
    const idx = line.indexOf('||')
    if (idx < 0) continue
    const processName = line.slice(0, idx).trim().toLowerCase()
    const title = line.slice(idx + 2).trim()
    if (!title) continue
    const app = processName === 'msedge'
      ? 'Edge'
      : processName === 'firefox'
        ? 'Firefox'
        : processName === 'brave'
          ? 'Brave'
          : processName === 'opera'
            ? 'Opera'
            : 'Chrome'
    windows.push({ app, title })
  }
  return windows
}

const SITE_PATTERNS: Array<[RegExp, string]> = [
  [/\bgmail\b/i, 'Gmail'],
  [/\byoutube\b/i, 'YouTube'],
  [/\bgoogle\s*(search|maps|docs|drive)?\b/i, 'Google'],
  [/\bfacebook\b/i, 'Facebook'],
  [/\bamazon\b/i, 'Amazon'],
  [/\bnetflix\b/i, 'Netflix'],
  [/\boutlook\.com\b|\bhotmail\b/i, 'Outlook'],
  [/\btwitter\b|\bx\.com\b/i, 'Twitter'],
  [/\bwikipedia\b/i, 'Wikipedia'],
  [/\bbbc\b.*news|\bnews\.bbc\b/i, 'BBC News'],
]

function sitesFromWindows(windows: VisibleWindow[]): string[] {
  const found = new Set<string>()
  for (const w of windows) {
    for (const [pat, site] of SITE_PATTERNS) {
      if (pat.test(w.title)) found.add(site)
    }
  }
  return [...found]
}

export async function getCurrentSystemState(defaultBrowser = 'Chrome'): Promise<SystemState> {
  try {
    const [runningApps, visibleWindows] = await Promise.all([
      IS_WIN ? getRunningAppsWin() : IS_MAC ? getRunningAppsMac() : Promise.resolve([] as string[]),
      IS_WIN ? getVisibleWindowsWin() : Promise.resolve([] as VisibleWindow[]),
    ])
    const browserOpenSites = sitesFromWindows(visibleWindows)
    // Window titles can contain sensitive document or account names. Log only
    // aggregate diagnostics; the in-memory state is still available to Retza.
    console.log(`[system-state] ${runningApps.length} processes, ${visibleWindows.length} browser windows, ${browserOpenSites.length} recognized sites`)
    return { runningApps, visibleWindows, browserOpenSites, defaultBrowser }
  } catch {
    console.error('[system-state] Snapshot failed')
    return { runningApps: [], visibleWindows: [], browserOpenSites: [], defaultBrowser }
  }
}

const VISIBLE_BROWSER_NAMES = new Set(['chrome', 'firefox', 'edge', 'brave', 'opera', 'safari'])

export function isBrowserRunning(state: SystemState): boolean {
  return state.visibleWindows.some(window => VISIBLE_BROWSER_NAMES.has(window.app.toLowerCase()))
}

export function isProcessRunning(appName: string, state: SystemState): boolean {
  const needle = appName.toLowerCase().replace(/[^a-z0-9]/g, '')
  return state.runningApps.some(a => a.replace(/[^a-z0-9]/g, '').includes(needle))
}
