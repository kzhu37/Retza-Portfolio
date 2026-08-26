import { execFile } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { join } from 'node:path'
import {
  isUsableRect,
  physicalPoint,
  physicalRect,
  type PhysicalScreenPoint,
  type PhysicalScreenRect,
  type TargetObservation,
} from './geometry'

export type UiaAction = 'click' | 'look' | 'type'
export type UiaQueryScope = 'foreground' | 'taskbar' | 'visible-windows'

export interface WindowsUiaQuery {
  readonly action: UiaAction
  readonly scope?: UiaQueryScope
  readonly names?: readonly string[]
  readonly automationIds?: readonly string[]
  readonly roles?: readonly string[]
  readonly classNames?: readonly string[]
  readonly windowNames?: readonly string[]
  readonly windowClasses?: readonly string[]
  /** Constrains a stale-state re-query to the originally observed HWND. */
  readonly windowHandles?: readonly string[]
  readonly processNames?: readonly string[]
  readonly excludeProcessId?: number
  readonly maxWindows?: number
  readonly maxNodes?: number
  readonly maxCandidates?: number
}

export interface UiaWindowIdentity {
  readonly handle: string
  readonly runtimeId: string | null
  readonly processId: number
  readonly processName: string
  readonly name: string
  readonly className: string
  readonly bounds: PhysicalScreenRect
  readonly minimized: boolean
  readonly offscreen: boolean
  readonly foreground: boolean
}

export interface UiaElementIdentity {
  readonly runtimeId: string | null
  readonly name: string
  readonly automationId: string
  readonly className: string
  readonly frameworkId: string
  readonly role: string
  readonly bounds: PhysicalScreenRect
  readonly clickablePoint?: PhysicalScreenPoint
  readonly enabled: boolean
  readonly offscreen: boolean
  readonly patterns: readonly string[]
}

export interface UiaCandidate {
  readonly capturedAt: number
  readonly window: UiaWindowIdentity
  readonly element: UiaElementIdentity
  readonly hitTest: 'self' | 'descendant' | 'blocked' | 'unknown'
}

export interface UiaSnapshot {
  readonly capturedAt: number
  readonly foregroundWindowHandle: string
  readonly windowsInspected: number
  readonly nodesVisited: number
  readonly matchingWindows: number
  readonly truncated: boolean
  readonly candidates: readonly UiaCandidate[]
}

export type UiaTransportFailureCode =
  | 'unsupported_platform'
  | 'invalid_query'
  | 'powershell_unavailable'
  | 'timeout'
  | 'access_denied'
  | 'process_failed'
  | 'malformed_protocol'

export type UiaQueryResult =
  | { ok: true; snapshot: UiaSnapshot }
  | { ok: false; code: UiaTransportFailureCode; detail?: string }

export interface RunWindowsUiaOptions {
  readonly timeoutMs?: number
  readonly powershellPath?: string
  readonly platform?: NodeJS.Platform
}

interface WireFailure {
  ok: false
  code: string
  message?: string
}

interface WireSuccess {
  ok: true
  capturedAt: number
  foregroundWindowHandle: string
  windowsInspected: number
  nodesVisited: number
  matchingWindows: number
  truncated: boolean
  candidates: unknown[]
}

type WirePayload = WireFailure | WireSuccess

const MAX_QUERY_STRINGS = 12
const MAX_QUERY_STRING_LENGTH = 160
// A cold Windows PowerShell 5.1 process can spend several seconds loading the
// UIAutomation assemblies. The query itself remains bounded by nodes/windows.
const DEFAULT_TIMEOUT_MS = 8_000

/*
 * This worker is intentionally fixed source. The untrusted query arrives as
 * base64 JSON in an environment variable, so no target text is interpolated
 * into a command line or PowerShell source string.
 */
const POWERSHELL_UIA_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)

function Emit-Result($value) {
  $json = $value | ConvertTo-Json -Compress -Depth 9
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  [Console]::Out.WriteLine('RETZA_UIA:' + [Convert]::ToBase64String($bytes))
}

try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Add-Type -AssemblyName WindowsBase
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class RetzaShowMeNative {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
}
'@

  if ([string]::IsNullOrWhiteSpace($env:RETZA_UIA_QUERY)) {
    throw 'Missing UI Automation query.'
  }
  $queryJson = [System.Text.Encoding]::UTF8.GetString(
    [Convert]::FromBase64String($env:RETZA_UIA_QUERY))
  $query = $queryJson | ConvertFrom-Json

  function Values($value) {
    if ($null -eq $value) { return @() }
    return @($value) | ForEach-Object { [string]$_ }
  }
  function Normalize([string]$value) {
    if ([string]::IsNullOrWhiteSpace($value)) { return '' }
    return (($value.ToLowerInvariant() -replace '&','') -replace '[^\p{L}\p{Nd}]+',' ').Trim() -replace '\s+',' '
  }
  function Runtime-Id($element) {
    try { return (($element.GetRuntimeId() | ForEach-Object { [string]$_ }) -join '.') }
    catch { return $null }
  }
  function Role-Name($element) {
    try { return ([string]$element.Current.ControlType.ProgrammaticName) -replace '^ControlType\.','' }
    catch { return '' }
  }
  function Matches-Exact([string]$actual, $expectedValues) {
    $actualNormalized = Normalize $actual
    foreach ($expected in (Values $expectedValues)) {
      if ($actualNormalized -eq (Normalize $expected)) { return $true }
    }
    return $false
  }
  function Matches-Text([string]$actual, $expectedValues) {
    $actualNormalized = Normalize $actual
    if (!$actualNormalized) { return $false }
    foreach ($expected in (Values $expectedValues)) {
      $needle = Normalize $expected
      if ($needle -and ($actualNormalized -eq $needle -or
          $actualNormalized.StartsWith($needle + ' ') -or
          $actualNormalized.Contains(' ' + $needle + ' ') -or
          $actualNormalized.EndsWith(' ' + $needle))) { return $true }
    }
    return $false
  }
  function Pattern-Available($element, $property) {
    try {
      $value = $element.GetCurrentPropertyValue($property, $true)
      return ($value -is [bool]) -and [bool]$value
    } catch { return $false }
  }
  function Element-Patterns($element) {
    $patterns = New-Object System.Collections.Generic.List[string]
    if (Pattern-Available $element ([System.Windows.Automation.AutomationElement]::IsInvokePatternAvailableProperty)) { $patterns.Add('Invoke') }
    if (Pattern-Available $element ([System.Windows.Automation.AutomationElement]::IsSelectionItemPatternAvailableProperty)) { $patterns.Add('SelectionItem') }
    if (Pattern-Available $element ([System.Windows.Automation.AutomationElement]::IsTogglePatternAvailableProperty)) { $patterns.Add('Toggle') }
    if (Pattern-Available $element ([System.Windows.Automation.AutomationElement]::IsValuePatternAvailableProperty)) { $patterns.Add('Value') }
    if (Pattern-Available $element ([System.Windows.Automation.AutomationElement]::IsTextPatternAvailableProperty)) { $patterns.Add('Text') }
    if (Pattern-Available $element ([System.Windows.Automation.AutomationElement]::IsExpandCollapsePatternAvailableProperty)) { $patterns.Add('ExpandCollapse') }
    return @($patterns)
  }
  function Same-Element($first, $second) {
    if ($null -eq $first -or $null -eq $second) { return $false }
    $a = Runtime-Id $first
    $b = Runtime-Id $second
    return $a -and $b -and $a -eq $b
  }
  function Hit-Test($element, [double]$x, [double]$y) {
    try {
      $point = New-Object System.Windows.Point($x, $y)
      $hit = [System.Windows.Automation.AutomationElement]::FromPoint($point)
      if ($null -eq $hit) { return 'unknown' }
      # Retza's transparent, click-through guide is intentionally above the
      # target during live validation. It is not an occluder and must not make
      # the underlying element look blocked.
      if ($excludeProcessId -gt 0 -and [int]$hit.Current.ProcessId -eq $excludeProcessId) {
        return 'self'
      }
      if (Same-Element $element $hit) { return 'self' }
      $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
      $cursor = $hit
      for ($depth = 0; $depth -lt 30 -and $null -ne $cursor; $depth++) {
        $cursor = $walker.GetParent($cursor)
        if (Same-Element $element $cursor) { return 'descendant' }
      }
      return 'blocked'
    } catch { return 'unknown' }
  }
  function Window-Minimized($window) {
    try {
      $pattern = $window.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern)
      return $pattern.Current.WindowVisualState -eq [System.Windows.Automation.WindowVisualState]::Minimized
    } catch { return $false }
  }
  function Process-Name([int]$processId) {
    try { return [System.Diagnostics.Process]::GetProcessById($processId).ProcessName }
    catch { return '' }
  }

  $names = Values $query.names
  $automationIds = Values $query.automationIds
  $classNames = Values $query.classNames
  $windowNames = Values $query.windowNames
  $windowClasses = Values $query.windowClasses
  $windowHandles = Values $query.windowHandles
  $processNames = Values $query.processNames
  $scope = [string]$query.scope
  $excludeProcessId = [int]$query.excludeProcessId
  $maxWindows = [Math]::Max(1, [Math]::Min(16, [int]$query.maxWindows))
  $maxNodes = [Math]::Max(50, [Math]::Min(5000, [int]$query.maxNodes))
  $maxCandidates = [Math]::Max(1, [Math]::Min(128, [int]$query.maxCandidates))

  $foregroundHandle = [string][RetzaShowMeNative]::GetForegroundWindow().ToInt64()
  $root = [System.Windows.Automation.AutomationElement]::RootElement
  $windows = $root.FindAll(
    [System.Windows.Automation.TreeScope]::Children,
    [System.Windows.Automation.Condition]::TrueCondition)
  $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
  $candidates = New-Object System.Collections.ArrayList
  $windowsInspected = 0
  $matchingWindows = 0
  $nodesVisited = 0
  $truncated = $false

  foreach ($window in $windows) {
    if ($windowsInspected -ge $maxWindows -or $nodesVisited -ge $maxNodes -or $candidates.Count -ge $maxCandidates) {
      $truncated = $true
      break
    }
    try {
      $wc = $window.Current
      $handle = [string]$wc.NativeWindowHandle
      $processId = [int]$wc.ProcessId
      $processName = Process-Name $processId
      $windowClass = [string]$wc.ClassName
      $windowName = [string]$wc.Name
      $isTaskbar = $windowClass -eq 'Shell_TrayWnd' -or $windowClass -eq 'Shell_SecondaryTrayWnd'

      if ($excludeProcessId -gt 0 -and $processId -eq $excludeProcessId) { continue }
      if ($scope -eq 'foreground' -and $handle -ne $foregroundHandle) { continue }
      if ($scope -eq 'taskbar' -and !$isTaskbar) { continue }
      if ($windowHandles.Count -gt 0 -and !(Matches-Exact $handle $windowHandles)) { continue }
      if ($windowNames.Count -gt 0 -and !(Matches-Text $windowName $windowNames)) { continue }
      if ($windowClasses.Count -gt 0 -and !(Matches-Exact $windowClass $windowClasses)) { continue }
      if ($processNames.Count -gt 0 -and !(Matches-Text $processName $processNames)) { continue }

      $windowsInspected++
      $matchingWindows++
      $windowRect = $wc.BoundingRectangle
      $windowInfo = [ordered]@{
        handle = $handle
        runtimeId = Runtime-Id $window
        processId = $processId
        processName = $processName
        name = $windowName
        className = $windowClass
        bounds = [ordered]@{ x=[double]$windowRect.X; y=[double]$windowRect.Y; width=[double]$windowRect.Width; height=[double]$windowRect.Height }
        minimized = Window-Minimized $window
        offscreen = [bool]$wc.IsOffscreen
        foreground = $handle -eq $foregroundHandle
      }

      $queue = New-Object System.Collections.Queue
      try {
        $child = $walker.GetFirstChild($window)
        while ($null -ne $child) {
          $queue.Enqueue($child)
          $child = $walker.GetNextSibling($child)
        }
      } catch {}

      while ($queue.Count -gt 0) {
        if ($nodesVisited -ge $maxNodes -or $candidates.Count -ge $maxCandidates) {
          $truncated = $true
          break
        }
        $element = $queue.Dequeue()
        $nodesVisited++
        try {
          $ec = $element.Current
          $name = [string]$ec.Name
          $automationId = [string]$ec.AutomationId
          $className = [string]$ec.ClassName
          $role = Role-Name $element
          $coarseMatch = (Matches-Text $name $names) -or
            (Matches-Exact $automationId $automationIds) -or
            (Matches-Exact $className $classNames)

          if ($coarseMatch) {
            $rect = $ec.BoundingRectangle
            $clickable = $null
            try {
              $clickPoint = New-Object System.Windows.Point
              if ($element.TryGetClickablePoint([ref]$clickPoint)) {
                $clickable = [ordered]@{ x=[double]$clickPoint.X; y=[double]$clickPoint.Y }
              }
            } catch {}
            $probeX = if ($null -ne $clickable) { [double]$clickable.x } else { [double]($rect.X + $rect.Width / 2) }
            $probeY = if ($null -ne $clickable) { [double]$clickable.y } else { [double]($rect.Y + $rect.Height / 2) }
            $candidate = [ordered]@{
              capturedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
              window = $windowInfo
              element = [ordered]@{
                runtimeId = Runtime-Id $element
                name = $name
                automationId = $automationId
                className = $className
                frameworkId = [string]$ec.FrameworkId
                role = $role
                bounds = [ordered]@{ x=[double]$rect.X; y=[double]$rect.Y; width=[double]$rect.Width; height=[double]$rect.Height }
                clickablePoint = $clickable
                enabled = [bool]$ec.IsEnabled
                offscreen = [bool]$ec.IsOffscreen
                patterns = @(Element-Patterns $element)
              }
              hitTest = Hit-Test $element $probeX $probeY
            }
            [void]$candidates.Add($candidate)
          }

          try {
            $child = $walker.GetFirstChild($element)
            while ($null -ne $child) {
              $queue.Enqueue($child)
              $child = $walker.GetNextSibling($child)
            }
          } catch {}
        } catch {}
      }
    } catch {}
  }

  Emit-Result ([ordered]@{
    ok = $true
    capturedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    foregroundWindowHandle = $foregroundHandle
    windowsInspected = $windowsInspected
    matchingWindows = $matchingWindows
    nodesVisited = $nodesVisited
    truncated = $truncated
    candidates = @($candidates)
  })
} catch {
  $message = [string]$_.Exception.Message
  $code = if ($_.Exception -is [System.UnauthorizedAccessException] -or $message -match 'access.*denied') {
    'access_denied'
  } else {
    'uia_error'
  }
  Emit-Result ([ordered]@{ ok=$false; code=$code; message=$message })
}
`.trim()

const ENCODED_POWERSHELL_SCRIPT = Buffer.from(POWERSHELL_UIA_SCRIPT, 'utf16le').toString('base64')
const SYSTEM_POWERSHELL_PATH = join(
  process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows',
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
)

function childEnvironment(encodedQuery: string): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { RETZA_UIA_QUERY: encodedQuery }
  for (const key of ['SystemRoot', 'WINDIR', 'COMSPEC', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'PSModulePath']) {
    if (process.env[key]) environment[key] = process.env[key]
  }
  return environment
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isInteger(value)) return fallback
  return Math.max(min, Math.min(max, value as number))
}

function cleanStrings(values: readonly string[] | undefined): string[] | null {
  if (!values) return []
  if (!Array.isArray(values) || values.length > MAX_QUERY_STRINGS) return null
  const result: string[] = []
  for (const value of values) {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!trimmed || trimmed.length > MAX_QUERY_STRING_LENGTH) return null
    if (!result.includes(trimmed)) result.push(trimmed)
  }
  return result
}

function serializableQuery(query: WindowsUiaQuery): Record<string, unknown> | null {
  const names = cleanStrings(query.names)
  const automationIds = cleanStrings(query.automationIds)
  const roles = cleanStrings(query.roles)
  const classNames = cleanStrings(query.classNames)
  const windowNames = cleanStrings(query.windowNames)
  const windowClasses = cleanStrings(query.windowClasses)
  const windowHandles = cleanStrings(query.windowHandles)
  const processNames = cleanStrings(query.processNames)
  if ([names, automationIds, roles, classNames, windowNames, windowClasses, windowHandles, processNames]
    .some(value => value === null)) return null
  if (windowHandles?.some(handle => !/^\d+$/.test(handle))) return null
  if (!['click', 'look', 'type'].includes(query.action)) return null
  if (query.scope && !['foreground', 'taskbar', 'visible-windows'].includes(query.scope)) return null
  if (!(names?.length || automationIds?.length || classNames?.length)) return null

  return {
    action: query.action,
    scope: query.scope ?? 'visible-windows',
    names,
    automationIds,
    roles,
    classNames,
    windowNames,
    windowClasses,
    windowHandles,
    processNames,
    excludeProcessId: Number.isInteger(query.excludeProcessId) ? query.excludeProcessId : 0,
    maxWindows: clampInteger(query.maxWindows, 8, 1, 16),
    maxNodes: clampInteger(query.maxNodes, 1_800, 50, 5_000),
    maxCandidates: clampInteger(query.maxCandidates, 64, 1, 128),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function finiteInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function parsePhysicalRect(value: unknown): PhysicalScreenRect | null {
  if (!isRecord(value)) return null
  const x = finiteNumber(value.x)
  const y = finiteNumber(value.y)
  const width = finiteNumber(value.width)
  const height = finiteNumber(value.height)
  if (x === null || y === null || width === null || height === null) return null
  return physicalRect(x, y, width, height)
}

function parsePhysicalPoint(value: unknown): PhysicalScreenPoint | undefined {
  if (value === null || value === undefined) return undefined
  if (!isRecord(value)) return undefined
  const x = finiteNumber(value.x)
  const y = finiteNumber(value.y)
  return x === null || y === null ? undefined : physicalPoint(x, y)
}

function parseCandidate(value: unknown, snapshotCapturedAt: number): UiaCandidate | null {
  if (!isRecord(value) || !isRecord(value.window) || !isRecord(value.element)) return null
  const window = value.window
  const element = value.element
  const windowBounds = parsePhysicalRect(window.bounds)
  const elementBounds = parsePhysicalRect(element.bounds)
  const handle = stringValue(window.handle)
  const processId = finiteInteger(window.processId)
  const capturedAt = finiteNumber(value.capturedAt) ?? snapshotCapturedAt
  const hitTest = stringValue(value.hitTest)
  if (!windowBounds || !elementBounds || handle === null || processId === null
      || !['self', 'descendant', 'blocked', 'unknown'].includes(hitTest ?? '')) return null

  const patterns = Array.isArray(element.patterns)
    ? element.patterns.filter((item): item is string => typeof item === 'string').slice(0, 16)
    : []
  const parsedWindow: UiaWindowIdentity = {
    handle,
    runtimeId: stringValue(window.runtimeId),
    processId,
    processName: stringValue(window.processName) ?? '',
    name: stringValue(window.name) ?? '',
    className: stringValue(window.className) ?? '',
    bounds: windowBounds,
    minimized: booleanValue(window.minimized) ?? false,
    offscreen: booleanValue(window.offscreen) ?? false,
    foreground: booleanValue(window.foreground) ?? false,
  }
  const parsedElement: UiaElementIdentity = {
    runtimeId: stringValue(element.runtimeId),
    name: stringValue(element.name) ?? '',
    automationId: stringValue(element.automationId) ?? '',
    className: stringValue(element.className) ?? '',
    frameworkId: stringValue(element.frameworkId) ?? '',
    role: stringValue(element.role) ?? '',
    bounds: elementBounds,
    clickablePoint: parsePhysicalPoint(element.clickablePoint),
    enabled: booleanValue(element.enabled) ?? false,
    offscreen: booleanValue(element.offscreen) ?? false,
    patterns,
  }
  return { capturedAt, window: parsedWindow, element: parsedElement, hitTest: hitTest as UiaCandidate['hitTest'] }
}

export type ProtocolParseResult =
  | { ok: true; payload: WirePayload }
  | { ok: false; detail: string }

/** Parses only an explicitly framed payload; warnings and CLIXML are ignored. */
export function parseUiaProtocol(stdout: string): ProtocolParseResult {
  const frames = [...stdout.matchAll(/(?:^|\r?\n)RETZA_UIA:([A-Za-z0-9+/=]+)(?=\r?$|\r?\n)/gm)]
  const frame = frames.at(-1)?.[1]
  if (!frame) return { ok: false, detail: 'UI Automation response frame was missing.' }
  try {
    const decoded = Buffer.from(frame, 'base64').toString('utf8')
    const payload: unknown = JSON.parse(decoded)
    if (!isRecord(payload) || typeof payload.ok !== 'boolean') {
      return { ok: false, detail: 'UI Automation response had an invalid envelope.' }
    }
    return { ok: true, payload: payload as unknown as WirePayload }
  } catch {
    return { ok: false, detail: 'UI Automation response contained malformed JSON.' }
  }
}

function snapshotFromWire(payload: WireSuccess): UiaSnapshot | null {
  const capturedAt = finiteNumber(payload.capturedAt)
  const foregroundWindowHandle = stringValue(payload.foregroundWindowHandle)
  const windowsInspected = finiteInteger(payload.windowsInspected)
  const matchingWindows = finiteInteger(payload.matchingWindows)
  const nodesVisited = finiteInteger(payload.nodesVisited)
  const truncated = booleanValue(payload.truncated)
  if (capturedAt === null || foregroundWindowHandle === null || windowsInspected === null
      || matchingWindows === null || nodesVisited === null || truncated === null
      || !Array.isArray(payload.candidates)) return null

  const candidates = payload.candidates
    .map(item => parseCandidate(item, capturedAt))
    .filter((item): item is UiaCandidate => item !== null)
  return {
    capturedAt,
    foregroundWindowHandle,
    windowsInspected,
    matchingWindows,
    nodesVisited,
    truncated,
    candidates,
  }
}

export async function runWindowsUiaQuery(
  query: WindowsUiaQuery,
  options: RunWindowsUiaOptions = {},
): Promise<UiaQueryResult> {
  if ((options.platform ?? process.platform) !== 'win32') {
    return { ok: false, code: 'unsupported_platform' }
  }
  const payload = serializableQuery(query)
  if (!payload) return { ok: false, code: 'invalid_query' }
  const encodedQuery = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  const timeoutMs = clampInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, 500, 15_000)

  return new Promise(resolve => {
    execFile(
      options.powershellPath ?? SYSTEM_POWERSHELL_PATH,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        ENCODED_POWERSHELL_SCRIPT,
      ],
      {
        timeout: timeoutMs,
        windowsHide: true,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
        env: childEnvironment(encodedQuery),
      },
      (error, stdout) => {
        const protocol = parseUiaProtocol(stdout ?? '')
        if (protocol.ok) {
          if (!protocol.payload.ok) {
            const code = protocol.payload.code === 'access_denied' ? 'access_denied' : 'process_failed'
            resolve({ ok: false, code, detail: protocol.payload.message?.slice(0, 240) })
            return
          }
          const snapshot = snapshotFromWire(protocol.payload)
          if (!snapshot) {
            resolve({ ok: false, code: 'malformed_protocol', detail: 'Invalid UI Automation snapshot.' })
            return
          }
          resolve({ ok: true, snapshot })
          return
        }

        if (error) {
          const errorWithCode = error as NodeJS.ErrnoException & { killed?: boolean; signal?: string }
          if (errorWithCode.killed || errorWithCode.signal === 'SIGTERM') {
            resolve({ ok: false, code: 'timeout' })
          } else if (errorWithCode.code === 'ENOENT') {
            resolve({ ok: false, code: 'powershell_unavailable' })
          } else {
            resolve({ ok: false, code: 'process_failed' })
          }
          return
        }
        resolve({ ok: false, code: 'malformed_protocol', detail: protocol.detail })
      },
    )
  })
}

export type UiaEvidenceKind =
  | 'automation-id-exact'
  | 'name-exact'
  | 'name-prefix'
  | 'name-token'
  | 'class-exact'
  | 'role'
  | 'window-name'
  | 'window-class'
  | 'window-handle'
  | 'process'
  | 'taskbar-scope'
  | 'foreground'
  | 'visible'
  | 'actionable'
  | 'hit-test'

export interface UiaMatchEvidence {
  readonly kind: UiaEvidenceKind
  readonly weight: number
}

export interface ScoredUiaCandidate {
  readonly candidate: UiaCandidate
  readonly confidence: number
  readonly semanticConfidence: number
  readonly evidence: readonly UiaMatchEvidence[]
  readonly eligible: boolean
  readonly rejection?: 'scope' | 'not_visible' | 'not_actionable' | 'occluded' | 'not_specific'
}

export type UiaMatchResult =
  | {
      ok: true
      confidence: number
      candidate: UiaCandidate
      evidence: readonly UiaMatchEvidence[]
    }
  | {
      ok: false
      code: 'not_found' | 'not_visible' | 'not_actionable' | 'occluded' | 'ambiguous' | 'incomplete'
      bestConfidence?: number
    }

export interface UiaMatchOptions {
  readonly minimumConfidence?: number
  readonly ambiguityGap?: number
}

export function normalizeUiText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function exactStringMatch(actual: string, expected: readonly string[] | undefined): boolean {
  const normalized = normalizeUiText(actual)
  return Boolean(normalized) && Boolean(expected?.some(item => normalizeUiText(item) === normalized))
}

function containsStringMatch(actual: string, expected: readonly string[] | undefined): boolean {
  const normalized = normalizeUiText(actual)
  if (!normalized) return false
  return Boolean(expected?.some(item => {
    const needle = normalizeUiText(item)
    return Boolean(needle) && (normalized === needle
      || normalized.startsWith(`${needle} `)
      || normalized.endsWith(` ${needle}`)
      || normalized.includes(` ${needle} `))
  }))
}

function bestNameEvidence(actual: string, expected: readonly string[] | undefined): UiaMatchEvidence | null {
  const normalizedActual = normalizeUiText(actual)
  if (!normalizedActual || !expected?.length) return null
  let best: UiaMatchEvidence | null = null
  for (const item of expected) {
    const normalizedExpected = normalizeUiText(item)
    if (!normalizedExpected) continue
    if (normalizedActual === normalizedExpected) return { kind: 'name-exact', weight: 0.5 }
    if (normalizedActual.startsWith(`${normalizedExpected} `)) {
      if (!best || best.weight < 0.43) best = { kind: 'name-prefix', weight: 0.43 }
      continue
    }
    if (normalizedActual.endsWith(` ${normalizedExpected}`)
        || normalizedActual.includes(` ${normalizedExpected} `)) {
      if (!best || best.weight < 0.36) best = { kind: 'name-token', weight: 0.36 }
      continue
    }
    const actualTokens = new Set(normalizedActual.split(' '))
    const expectedTokens = new Set(normalizedExpected.split(' '))
    const overlap = [...expectedTokens].filter(token => actualTokens.has(token)).length
    const similarity = overlap / Math.max(expectedTokens.size, actualTokens.size)
    if (overlap > 0 && similarity >= 0.5) {
      const weight = Math.min(0.3, 0.18 + similarity * 0.12)
      if (!best || best.weight < weight) best = { kind: 'name-token', weight }
    }
  }
  return best
}

function normalizedRole(role: string): string {
  return normalizeUiText(role.replace(/^ControlType\./i, ''))
}

function matchesRole(actual: string, expected: readonly string[] | undefined): boolean {
  const role = normalizedRole(actual)
  return Boolean(role) && Boolean(expected?.some(item => normalizedRole(item) === role))
}

function matchesProcess(actual: string, expected: readonly string[] | undefined): boolean {
  const process = normalizeUiText(actual.replace(/\.exe$/i, ''))
  return Boolean(process) && Boolean(expected?.some(item => {
    const candidate = normalizeUiText(item.replace(/\.exe$/i, ''))
    return process === candidate || process.includes(candidate) || candidate.includes(process)
  }))
}

function candidateKey(candidate: UiaCandidate): string {
  if (candidate.element.runtimeId) return `${candidate.window.handle}|${candidate.element.runtimeId}`
  const bounds = candidate.element.bounds
  return [
    candidate.window.handle,
    normalizeUiText(candidate.element.automationId),
    normalizeUiText(candidate.element.name),
    normalizedRole(candidate.element.role),
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
  ].join('|')
}

export function isCandidateActionable(candidate: UiaCandidate, action: UiaAction): boolean {
  if (action === 'look') return true
  if (!candidate.element.enabled) return false
  const patterns = new Set(candidate.element.patterns.map(normalizeUiText))
  const role = normalizedRole(candidate.element.role)
  if (action === 'type') {
    return ['edit', 'document', 'combo box'].includes(role)
      || patterns.has('value')
      || patterns.has('text')
  }
  return Boolean(candidate.element.clickablePoint)
    || ['button', 'menu item', 'tab item', 'list item', 'check box', 'radio button', 'hyperlink', 'tree item'].includes(role)
    || ['invoke', 'selection item', 'toggle', 'expand collapse'].some(pattern => patterns.has(pattern))
}

function scoreUiaCandidate(query: WindowsUiaQuery, candidate: UiaCandidate): ScoredUiaCandidate {
  const evidence: UiaMatchEvidence[] = []
  const add = (kind: UiaEvidenceKind, weight: number): void => { evidence.push({ kind, weight }) }

  let semanticConfidence = 0
  if (exactStringMatch(candidate.element.automationId, query.automationIds)) {
    add('automation-id-exact', 0.55)
    semanticConfidence = Math.max(semanticConfidence, 0.55)
  }
  const nameEvidence = bestNameEvidence(candidate.element.name, query.names)
  if (nameEvidence) {
    evidence.push(nameEvidence)
    semanticConfidence = Math.max(semanticConfidence, nameEvidence.weight)
  }
  if (exactStringMatch(candidate.element.className, query.classNames)) {
    add('class-exact', 0.38)
    semanticConfidence = Math.max(semanticConfidence, 0.38)
  }

  const windowNameMatches = !query.windowNames?.length
    || containsStringMatch(candidate.window.name, query.windowNames)
  const windowClassMatches = !query.windowClasses?.length
    || exactStringMatch(candidate.window.className, query.windowClasses)
  const windowHandleMatches = !query.windowHandles?.length
    || query.windowHandles.includes(candidate.window.handle)
  const processMatches = !query.processNames?.length
    || matchesProcess(candidate.window.processName, query.processNames)
  const taskbarMatches = query.scope !== 'taskbar'
    || ['Shell_TrayWnd', 'Shell_SecondaryTrayWnd'].includes(candidate.window.className)
  const foregroundMatches = query.scope !== 'foreground' || candidate.window.foreground
  if (!windowNameMatches || !windowClassMatches || !windowHandleMatches || !processMatches
      || !taskbarMatches || !foregroundMatches) {
    return { candidate, confidence: semanticConfidence, semanticConfidence, evidence, eligible: false, rejection: 'scope' }
  }

  if (query.windowNames?.length) add('window-name', 0.14)
  if (query.windowClasses?.length) add('window-class', 0.15)
  if (query.windowHandles?.length) add('window-handle', 0.2)
  if (query.processNames?.length) add('process', 0.15)
  if (query.scope === 'taskbar') add('taskbar-scope', 0.15)
  if (candidate.window.foreground) add('foreground', 0.04)
  if (query.roles?.length && matchesRole(candidate.element.role, query.roles)) add('role', 0.12)

  const visible = !candidate.window.minimized
    && !candidate.window.offscreen
    && !candidate.element.offscreen
    && isUsableRect(candidate.window.bounds)
    && isUsableRect(candidate.element.bounds)
  if (!visible) {
    const confidence = Math.min(1, evidence.reduce((sum, item) => sum + item.weight, 0))
    return { candidate, confidence, semanticConfidence, evidence, eligible: false, rejection: 'not_visible' }
  }
  add('visible', 0.06)

  if (candidate.hitTest === 'blocked' || candidate.hitTest === 'unknown') {
    const confidence = Math.min(1, evidence.reduce((sum, item) => sum + item.weight, 0))
    return { candidate, confidence, semanticConfidence, evidence, eligible: false, rejection: 'occluded' }
  }
  if (candidate.hitTest === 'self' || candidate.hitTest === 'descendant') add('hit-test', 0.04)

  if (!isCandidateActionable(candidate, query.action)) {
    const confidence = Math.min(1, evidence.reduce((sum, item) => sum + item.weight, 0))
    return { candidate, confidence, semanticConfidence, evidence, eligible: false, rejection: 'not_actionable' }
  }
  add('actionable', 0.06)

  const elementArea = candidate.element.bounds.width * candidate.element.bounds.height
  const windowArea = candidate.window.bounds.width * candidate.window.bounds.height
  const broadClickPane = query.action === 'click'
    && ['pane', 'window', 'group'].includes(normalizedRole(candidate.element.role))
    && windowArea > 0
    && elementArea / windowArea > 0.4
    && semanticConfidence < 0.5
  if (broadClickPane) {
    const confidence = Math.min(1, evidence.reduce((sum, item) => sum + item.weight, 0))
    return { candidate, confidence, semanticConfidence, evidence, eligible: false, rejection: 'not_specific' }
  }

  const confidence = Math.min(1, evidence.reduce((sum, item) => sum + item.weight, 0))
  return { candidate, confidence, semanticConfidence, evidence, eligible: semanticConfidence > 0 }
}

export function rankUiaCandidates(
  query: WindowsUiaQuery,
  snapshot: Pick<UiaSnapshot, 'candidates' | 'truncated'>,
  options: UiaMatchOptions = {},
): UiaMatchResult {
  const minimumConfidence = options.minimumConfidence ?? 0.78
  const ambiguityGap = options.ambiguityGap ?? 0.1
  const unique = new Map<string, UiaCandidate>()
  for (const candidate of snapshot.candidates) unique.set(candidateKey(candidate), candidate)
  const scores = [...unique.values()]
    .map(candidate => scoreUiaCandidate(query, candidate))
    .sort((a, b) => b.confidence - a.confidence)
  const eligible = scores.filter(score => score.eligible)
  const best = eligible[0]

  if (!best || best.confidence < minimumConfidence) {
    const strongestRejected = scores.find(score => score.semanticConfidence >= 0.36 && score.rejection !== 'scope')
    const failureCode = strongestRejected?.rejection === 'not_visible'
      ? 'not_visible'
      : strongestRejected?.rejection === 'occluded'
        ? 'occluded'
        : strongestRejected?.rejection === 'not_actionable'
          ? 'not_actionable'
          : 'not_found'
    return { ok: false, code: failureCode, bestConfidence: best?.confidence ?? strongestRejected?.confidence }
  }

  const second = eligible[1]
  if (second && best.confidence - second.confidence < ambiguityGap) {
    return { ok: false, code: 'ambiguous', bestConfidence: best.confidence }
  }
  if (snapshot.truncated && best.confidence < 0.9) {
    return { ok: false, code: 'incomplete', bestConfidence: best.confidence }
  }
  return {
    ok: true,
    confidence: Math.round(best.confidence * 1000) / 1000,
    candidate: best.candidate,
    evidence: best.evidence,
  }
}

export function candidateToObservation(candidate: UiaCandidate, displayRevision = 0): TargetObservation {
  return {
    observedAt: candidate.capturedAt,
    displayRevision,
    foregroundWindowHandle: candidate.window.foreground ? candidate.window.handle : undefined,
    window: {
      handle: candidate.window.handle,
      runtimeId: candidate.window.runtimeId,
      processId: candidate.window.processId,
      minimized: candidate.window.minimized,
      offscreen: candidate.window.offscreen,
    },
    element: {
      runtimeId: candidate.element.runtimeId,
      automationId: candidate.element.automationId,
      name: candidate.element.name,
      role: candidate.element.role,
      className: candidate.element.className,
      bounds: candidate.element.bounds,
      offscreen: candidate.element.offscreen,
    },
    hitTest: candidate.hitTest,
  }
}

/** Builds the second, same-window query used immediately before rendering. */
export function constrainQueryToObservedWindow(
  query: WindowsUiaQuery,
  candidate: UiaCandidate,
): WindowsUiaQuery {
  return {
    ...query,
    scope: 'visible-windows',
    // Browser tab/document titles are volatile. HWND + PID validation is the
    // stable boundary for this short revalidation interval.
    windowNames: [],
    windowHandles: [candidate.window.handle],
    maxWindows: 1,
  }
}
