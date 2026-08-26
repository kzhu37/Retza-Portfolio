import type { LocationEvidence, TargetAction, TargetPayload, TargetVisibility, TargetZone } from '../../shared/contracts'
import {
  validateStaleObservation,
  type StaleObservationResult,
  type TargetObservation,
  type PhysicalScreenRect,
} from './geometry'
import {
  candidateToObservation,
  constrainQueryToObservedWindow,
  normalizeUiText,
  rankUiaCandidates,
  runWindowsUiaQuery,
  type RunWindowsUiaOptions,
  type UiaCandidate,
  type UiaMatchEvidence,
  type UiaMatchResult,
  type UiaQueryResult,
  type WindowsUiaQuery,
} from './windows-uia'

const TARGET_ZONES: readonly TargetZone[] = [
  'taskbar',
  'desktop',
  'start_menu',
  'screen_center',
  'top_right',
  'browser_address_bar',
  'ui_element',
  'none',
]
const TARGET_ACTIONS: readonly TargetAction[] = ['click', 'look', 'type']
const TARGET_VISIBILITIES: readonly TargetVisibility[] = ['visible_now', 'after_navigation', 'unknown']
const MAX_SHORT_TEXT = 160
const MAX_HINT_TEXT = 600

const ROLE_ALIASES = new Map<string, string>([
  ['button', 'Button'],
  ['edit', 'Edit'],
  ['text field', 'Edit'],
  ['textfield', 'Edit'],
  ['textbox', 'Edit'],
  ['input', 'Edit'],
  ['document', 'Document'],
  ['text', 'Text'],
  ['menu item', 'MenuItem'],
  ['menuitem', 'MenuItem'],
  ['tab item', 'TabItem'],
  ['tabitem', 'TabItem'],
  ['tab', 'TabItem'],
  ['list item', 'ListItem'],
  ['listitem', 'ListItem'],
  ['checkbox', 'CheckBox'],
  ['check box', 'CheckBox'],
  ['radio button', 'RadioButton'],
  ['radiobutton', 'RadioButton'],
  ['link', 'Hyperlink'],
  ['hyperlink', 'Hyperlink'],
  ['combo box', 'ComboBox'],
  ['combobox', 'ComboBox'],
  ['tree item', 'TreeItem'],
  ['treeitem', 'TreeItem'],
  ['pane', 'Pane'],
  ['group', 'Group'],
])

export interface TargetValidationSuccess {
  ok: true
  target: TargetPayload
}

export interface TargetValidationFailure {
  ok: false
  reason: string
}

export type TargetValidationResult = TargetValidationSuccess | TargetValidationFailure

export type TargetResolutionFailureCode =
  | 'invalid_target'
  | 'not_locatable'
  | 'not_found'
  | 'not_visible'
  | 'not_actionable'
  | 'ambiguous'
  | 'occluded'
  | 'application_closed'
  | 'window_changed'
  | 'target_changed'
  | 'screen_changed'
  | 'window_unavailable'
  | 'permission_denied'
  | 'uia_unavailable'
  | 'unsupported_platform'
  | 'internal_error'

export interface ExactTargetSuccess {
  readonly ok: true
  readonly source: 'windows-uia'
  readonly precision: 'exact-bounds'
  readonly confidence: number
  readonly evidence: LocationEvidence
  readonly matchEvidence: readonly UiaMatchEvidence[]
  readonly query: WindowsUiaQuery
  readonly candidate: UiaCandidate
  readonly observation: TargetObservation
}

export interface TargetResolutionFailure {
  readonly ok: false
  readonly code: TargetResolutionFailureCode
  readonly message: string
  readonly retryable: boolean
  readonly bestConfidence?: number
}

export type ExactTargetResolution = ExactTargetSuccess | TargetResolutionFailure

export type RevalidatedTargetResolution =
  | (ExactTargetSuccess & {
      readonly validation: Extract<StaleObservationResult, { ok: true }>
    })
  | TargetResolutionFailure

export interface TargetResolverOptions {
  readonly platform?: NodeJS.Platform
  readonly excludeProcessId?: number
  readonly displayRevision?: number
  readonly timeoutMs?: number
  /** Preferred monitor for duplicated Windows taskbar controls. */
  readonly preferredDisplayBounds?: PhysicalScreenRect
  readonly runner?: (
    query: WindowsUiaQuery,
    options?: RunWindowsUiaOptions,
  ) => Promise<UiaQueryResult>
}

function candidateCenterIsInside(candidate: UiaCandidate, bounds: PhysicalScreenRect): boolean {
  const element = candidate.element.bounds
  const x = element.x + element.width / 2
  const y = element.y + element.height / 2
  return x >= bounds.x && x < bounds.x + bounds.width
    && y >= bounds.y && y < bounds.y + bounds.height
}

export interface RevalidateTargetOptions extends TargetResolverOptions {
  readonly requireForeground?: boolean
  /** Set only when main will rebuild placement from the fresh physical bounds. */
  readonly allowDisplayChange?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalText(
  value: unknown,
  field: string,
  maximumLength: number,
): { ok: true; value: string | null | undefined } | TargetValidationFailure {
  if (value === undefined) return { ok: true, value: undefined }
  if (value === null) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, reason: `${field} must be text or null.` }
  const text = value.trim()
  if (text.length > maximumLength) return { ok: false, reason: `${field} is too long.` }
  return { ok: true, value: text || null }
}

/** Runtime validation for model output and the IPC trust boundary. */
export function validateTargetPayload(value: unknown): TargetValidationResult {
  if (!isRecord(value)) return { ok: false, reason: 'Target must be an object.' }
  if (typeof value.zone !== 'string' || !TARGET_ZONES.includes(value.zone as TargetZone)) {
    return { ok: false, reason: 'Target zone is not supported.' }
  }
  if (typeof value.action !== 'string' || !TARGET_ACTIONS.includes(value.action as TargetAction)) {
    return { ok: false, reason: 'Target action is not supported.' }
  }
  if (value.visibility !== undefined
      && (typeof value.visibility !== 'string'
        || !TARGET_VISIBILITIES.includes(value.visibility as TargetVisibility))) {
    return { ok: false, reason: 'Target visibility is invalid.' }
  }

  const app = optionalText(value.app, 'Target application', MAX_SHORT_TEXT)
  const hint = optionalText(value.hint, 'Target hint', MAX_HINT_TEXT)
  const name = optionalText(value.name, 'Target name', MAX_SHORT_TEXT)
  const role = optionalText(value.role, 'Target role', MAX_SHORT_TEXT)
  const window = optionalText(value.window, 'Target window', MAX_SHORT_TEXT)
  if (!app.ok) return app
  if (!hint.ok) return hint
  if (!name.ok) return name
  if (!role.ok) return role
  if (!window.ok) return window

  // app and hint are required by the shared contract, though null is valid.
  if (app.value === undefined) return { ok: false, reason: 'Target application is missing.' }
  if (hint.value === undefined) return { ok: false, reason: 'Target hint is missing.' }

  let canonicalRole: string | null | undefined = role.value
  if (role.value) {
    canonicalRole = ROLE_ALIASES.get(normalizeUiText(role.value.replace(/^ControlType\./i, '')))
    if (!canonicalRole) return { ok: false, reason: 'Target role is not supported.' }
  }
  if (value.zone === 'ui_element' && !name.value) {
    return { ok: false, reason: 'A UI element target needs its exact visible or accessible name.' }
  }

  return {
    ok: true,
    target: {
      zone: value.zone as TargetZone,
      app: app.value,
      action: value.action as TargetAction,
      hint: hint.value,
      name: name.value,
      role: canonicalRole,
      window: window.value,
      visibility: value.visibility as TargetVisibility | undefined,
    },
  }
}

function compact(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())).map(value => value.trim()))]
}

function processAliases(app: string | null): string[] {
  if (!app) return []
  const normalized = normalizeUiText(app)
  const known: Record<string, string[]> = {
    chrome: ['chrome'],
    'google chrome': ['chrome'],
    edge: ['msedge'],
    'microsoft edge': ['msedge'],
    firefox: ['firefox'],
    brave: ['brave'],
    'brave browser': ['brave'],
    opera: ['opera'],
    settings: ['SystemSettings', 'ApplicationFrameHost'],
    'windows settings': ['SystemSettings', 'ApplicationFrameHost'],
    explorer: ['explorer'],
    'file explorer': ['explorer'],
    notepad: ['notepad'],
    'visual studio code': ['Code'],
    vscode: ['Code'],
  }
  return known[normalized] ?? [app]
}

function baseQuery(target: TargetPayload, excludeProcessId: number | undefined): Pick<WindowsUiaQuery, 'action' | 'excludeProcessId'> {
  return { action: target.action, excludeProcessId }
}

/**
 * Curated selectors are aliases, not fabricated coordinates. The generic
 * matcher still requires current, visible UIA evidence before returning them.
 */
export function queryForTarget(
  target: TargetPayload,
  excludeProcessId?: number,
): WindowsUiaQuery | null {
  const common = baseQuery(target, excludeProcessId)
  const targetName = target.name?.trim() || null
  const role = target.role?.trim() || null
  const windowNames = compact([target.window])

  if (target.zone === 'none') return null

  if (target.zone === 'start_menu') {
    const wantsSearch = targetName ? normalizeUiText(targetName).startsWith('search') : false
    return wantsSearch
      ? {
          ...common,
          scope: 'taskbar',
          names: compact([targetName, 'Search']),
          automationIds: ['SearchButton', '4101'],
          classNames: ['TrayDummySearchControl', 'Button'],
          roles: compact([role, 'Button', 'Pane', 'Edit']),
          windowClasses: ['Shell_TrayWnd', 'Shell_SecondaryTrayWnd'],
          processNames: ['explorer'],
        }
      : {
          ...common,
          scope: 'taskbar',
          names: ['Start'],
          automationIds: ['StartButton'],
          classNames: ['Start'],
          roles: compact([role, 'Button', 'Pane']),
          windowClasses: ['Shell_TrayWnd', 'Shell_SecondaryTrayWnd'],
          processNames: ['explorer'],
        }
  }

  if (target.zone === 'browser_address_bar') {
    return {
      ...common,
      scope: 'visible-windows',
      names: compact([
        targetName,
        'Address and search bar',
        'Search or enter web address',
        'Address bar',
      ]),
      automationIds: ['address_and_search_bar', 'urlbar-input', 'omnibox'],
      classNames: ['OmniboxViewViews'],
      roles: compact([role, 'Edit', 'ComboBox']),
      windowNames,
      windowClasses: ['Chrome_WidgetWin_1', 'MozillaWindowClass'],
      processNames: processAliases(target.app),
    }
  }

  if (target.zone === 'taskbar') {
    const names = compact([targetName, target.app])
    if (!names.length) return null
    return {
      ...common,
      scope: 'taskbar',
      names,
      roles: compact([role, 'Button', 'ListItem', 'Pane']),
      windowClasses: ['Shell_TrayWnd', 'Shell_SecondaryTrayWnd'],
      processNames: ['explorer'],
    }
  }

  if (target.zone === 'top_right' && targetName) {
    return {
      ...common,
      scope: 'taskbar',
      names: [targetName],
      roles: compact([role, 'Button', 'Pane']),
      windowClasses: ['Shell_TrayWnd', 'Shell_SecondaryTrayWnd'],
      processNames: ['explorer'],
    }
  }

  if (!targetName) return null
  return {
    ...common,
    scope: 'visible-windows',
    names: [targetName],
    roles: compact([role]),
    windowNames,
    processNames: processAliases(target.app),
  }
}

function transportFailure(result: Extract<UiaQueryResult, { ok: false }>): TargetResolutionFailure {
  switch (result.code) {
    case 'unsupported_platform':
      return {
        ok: false,
        code: 'unsupported_platform',
        message: 'Exact screen locating is not available on this computer.',
        retryable: false,
      }
    case 'access_denied':
      return {
        ok: false,
        code: 'permission_denied',
        message: "Windows would not let Retza inspect that window. It may be running as administrator.",
        retryable: false,
      }
    case 'timeout':
      return {
        ok: false,
        code: 'uia_unavailable',
        message: 'Windows took too long to inspect the current screen. Please try Show Me again.',
        retryable: true,
      }
    case 'powershell_unavailable':
      return {
        ok: false,
        code: 'uia_unavailable',
        message: 'The Windows screen-inspection service is unavailable.',
        retryable: false,
      }
    case 'invalid_query':
      return {
        ok: false,
        code: 'invalid_target',
        message: 'This instruction does not contain a precise item to locate.',
        retryable: false,
      }
    case 'process_failed':
      return {
        ok: false,
        code: 'uia_unavailable',
        message: 'Windows could not inspect the current screen. Please try again.',
        retryable: true,
      }
    case 'malformed_protocol':
    default:
      return {
        ok: false,
        code: 'internal_error',
        message: 'Retza received an unexpected response while locating that item.',
        retryable: true,
      }
  }
}

function publicEvidence(evidence: readonly UiaMatchEvidence[]): LocationEvidence {
  if (evidence.some(item => item.kind === 'automation-id-exact')) return 'windows_uia_automation_id'
  if (evidence.some(item => item.kind === 'name-exact')) return 'windows_uia_exact_name'
  return 'windows_uia_scoped_name'
}

function matchFailureResolution(
  match: Extract<UiaMatchResult, { ok: false }>,
): TargetResolutionFailure {
  const common = { retryable: true, bestConfidence: match.bestConfidence }
  switch (match.code) {
    case 'not_visible':
      return { ok: false, code: 'not_visible', message: 'I found that item, but it is not visible right now.', ...common }
    case 'not_actionable':
      return { ok: false, code: 'not_actionable', message: 'I found a related area, but not a precise control you can use.', ...common }
    case 'occluded':
      return { ok: false, code: 'occluded', message: 'That item is covered by another window right now.', ...common }
    case 'ambiguous':
    case 'incomplete':
      return { ok: false, code: 'ambiguous', message: 'I found more than one possible match, so I will not guess.', ...common }
    case 'not_found':
    default:
      return { ok: false, code: 'not_found', message: 'I cannot confidently find that item on the current screen.', ...common }
  }
}

/** Resolves only exact, high-confidence UIA targets; it never emits a guess. */
export async function resolveExactTarget(
  value: unknown,
  options: TargetResolverOptions = {},
): Promise<ExactTargetResolution> {
  const validation = validateTargetPayload(value)
  if (!validation.ok) {
    return {
      ok: false,
      code: 'invalid_target',
      message: 'This instruction does not contain a valid item to locate.',
      retryable: false,
    }
  }
  const target = validation.target
  // `after_navigation` describes when the model expected the target to appear;
  // it is not current-screen evidence. A user can invoke Show Me after reaching
  // that step, so live UIA visibility below remains authoritative.
  const platform = options.platform ?? process.platform
  if (platform !== 'win32') {
    return {
      ok: false,
      code: 'unsupported_platform',
      message: 'Exact screen locating is currently available only on Windows.',
      retryable: false,
    }
  }

  const query = queryForTarget(target, options.excludeProcessId)
  if (!query) {
    return {
      ok: false,
      code: 'not_locatable',
      message: 'I can describe that area, but I cannot identify an exact control to highlight.',
      retryable: false,
    }
  }

  const runner = options.runner ?? runWindowsUiaQuery
  let queryResult: UiaQueryResult
  try {
    queryResult = await runner(query, { platform, timeoutMs: options.timeoutMs })
  } catch {
    return {
      ok: false,
      code: 'internal_error',
      message: 'Retza could not start the screen locator.',
      retryable: true,
    }
  }
  if (!queryResult.ok) return transportFailure(queryResult)
  if (queryResult.snapshot.matchingWindows === 0
      && (query.windowNames?.length || query.windowClasses?.length || query.processNames?.length)) {
    return {
      ok: false,
      code: 'window_unavailable',
      message: 'I cannot see the expected window on your screen right now.',
      retryable: true,
    }
  }

  const preferredCandidates = query.scope === 'taskbar' && options.preferredDisplayBounds
    ? queryResult.snapshot.candidates.filter(candidate =>
      candidateCenterIsInside(candidate, options.preferredDisplayBounds!),
    )
    : []
  const match = rankUiaCandidates(query, preferredCandidates.length
    ? { ...queryResult.snapshot, candidates: preferredCandidates }
    : queryResult.snapshot)
  if (!match.ok) return matchFailureResolution(match)

  return {
    ok: true,
    source: 'windows-uia',
    precision: 'exact-bounds',
    confidence: match.confidence,
    evidence: publicEvidence(match.evidence),
    matchEvidence: match.evidence,
    query,
    candidate: match.candidate,
    observation: candidateToObservation(match.candidate, options.displayRevision ?? 0),
  }
}

function staleFailureResolution(
  validation: Extract<StaleObservationResult, { ok: false }>,
): TargetResolutionFailure {
  switch (validation.code) {
    case 'application_closed':
      return {
        ok: false,
        code: 'application_closed',
        message: 'The window closed before I could highlight that item.',
        retryable: true,
      }
    case 'window_changed':
      return {
        ok: false,
        code: 'window_changed',
        message: 'The active window changed before I could highlight that item.',
        retryable: true,
      }
    case 'target_changed':
      return {
        ok: false,
        code: 'target_changed',
        message: 'That item changed or disappeared before I could highlight it.',
        retryable: true,
      }
    case 'not_visible':
      return {
        ok: false,
        code: 'not_visible',
        message: 'That item is no longer visible on the screen.',
        retryable: true,
      }
    case 'occluded':
      return {
        ok: false,
        code: 'occluded',
        message: 'Another window covered that item before I could highlight it.',
        retryable: true,
      }
    case 'screen_changed':
    default:
      return {
        ok: false,
        code: 'screen_changed',
        message: 'The display layout changed before I could highlight that item.',
        retryable: true,
      }
  }
}

/**
 * Re-runs the exact selector against the originally observed HWND and validates
 * identity/visibility immediately before an overlay is rendered.
 */
export async function revalidateExactTarget(
  initial: ExactTargetSuccess,
  options: RevalidateTargetOptions = {},
): Promise<RevalidatedTargetResolution> {
  const platform = options.platform ?? process.platform
  if (platform !== 'win32') {
    return {
      ok: false,
      code: 'unsupported_platform',
      message: 'Exact screen locating is currently available only on Windows.',
      retryable: false,
    }
  }

  const query = constrainQueryToObservedWindow(initial.query, initial.candidate)
  const runner = options.runner ?? runWindowsUiaQuery
  let queryResult: UiaQueryResult
  try {
    queryResult = await runner(query, { platform, timeoutMs: options.timeoutMs })
  } catch {
    return {
      ok: false,
      code: 'internal_error',
      message: 'Retza could not re-check the screen before highlighting that item.',
      retryable: true,
    }
  }
  if (!queryResult.ok) return transportFailure(queryResult)
  if (queryResult.snapshot.matchingWindows === 0) {
    return staleFailureResolution({ ok: false, code: 'application_closed' })
  }

  const match = rankUiaCandidates(query, queryResult.snapshot)
  if (!match.ok) {
    if (match.code === 'not_found') {
      return staleFailureResolution({ ok: false, code: 'target_changed' })
    }
    return matchFailureResolution(match)
  }

  const observation = candidateToObservation(
    match.candidate,
    options.displayRevision ?? initial.observation.displayRevision,
  )
  const validation = validateStaleObservation(
    initial.observation,
    { windowAvailable: true, observation },
    {
      requireForeground: options.requireForeground,
      allowDisplayChange: options.allowDisplayChange,
      allowRecreatedElement: true,
    },
  )
  if (!validation.ok) return staleFailureResolution(validation)

  return {
    ok: true,
    source: 'windows-uia',
    precision: 'exact-bounds',
    confidence: match.confidence,
    evidence: publicEvidence(match.evidence),
    matchEvidence: match.evidence,
    // Preserve the semantic query for any later validation; the helper will
    // constrain it to the newest observed HWND again.
    query: initial.query,
    candidate: match.candidate,
    observation,
    validation,
  }
}
