import type { ChatResult, StepPayload, TargetPayload } from '../shared/contracts'

/** Windows versions whose Settings layouts are covered by this knowledge base. */
export type SupportedWindowsVersion = 'Windows 10' | 'Windows 11'

export const WINDOWS_NAVIGATION_TOPICS = [
  'bluetooth',
  'display',
  'device_manager',
  'uninstall_apps',
  'wifi',
  'windows_update',
  'sound_output',
  'windows_search',
] as const

export type WindowsNavigationTopic = (typeof WINDOWS_NAVIGATION_TOPICS)[number]

export type WindowsNavigationResult = Extract<ChatResult, { ok: true }> & {
  source: 'windows_knowledge'
  topic: WindowsNavigationTopic
  windowsVersion: SupportedWindowsVersion
}

interface TopicRule {
  topic: WindowsNavigationTopic
  patterns: readonly RegExp[]
  directPhrases: readonly RegExp[]
}

/**
 * Matching rules intentionally cover only well-known Windows destinations. They
 * are exported to make the scope of deterministic answers easy to audit.
 * None of the expressions are stateful (there are no global/sticky flags).
 */
export const WINDOWS_NAVIGATION_RULES: readonly TopicRule[] = [
  {
    topic: 'bluetooth',
    patterns: [/\bbluetooth\b/i],
    directPhrases: [/^(?:windows )?bluetooth(?: settings?)?$/i],
  },
  {
    topic: 'display',
    patterns: [
      /\bdisplay settings?\b/i,
      /\b(?:display|screen) resolution\b/i,
      /\b(?:screen|display) (?:scal(?:e|ing)|orientation|brightness)\b/i,
      /\b(?:night light|multiple displays?)\b/i,
    ],
    directPhrases: [
      /^(?:windows )?display settings?$/i,
      /^(?:screen|display) (?:resolution|scaling|orientation|brightness)$/i,
    ],
  },
  {
    topic: 'device_manager',
    patterns: [/\bdevice manager\b/i],
    directPhrases: [/^(?:windows )?device manager$/i],
  },
  {
    topic: 'uninstall_apps',
    patterns: [
      /\buninstall(?:ing|ed|s)?\b.{0,45}\b(?:program|app|application|software)\b/i,
      /\b(?:remove|delete)\b.{0,35}\b(?:program|app|application|software)\b/i,
      /\b(?:apps? and features|programs? and features|installed apps?)\b/i,
    ],
    directPhrases: [
      /^(?:uninstall|remove) (?:a |an )?(?:program|app|application|software)$/i,
      /^(?:apps? and features|programs? and features|installed apps?)$/i,
    ],
  },
  {
    topic: 'wifi',
    patterns: [
      /\bwi[ -]?fi\b/i,
      /\bwireless (?:network|internet|settings?)\b/i,
    ],
    directPhrases: [
      /^(?:windows )?wi[ -]?fi(?: button| icon| settings?)?$/i,
      /^wireless (?:network|internet|settings?)$/i,
    ],
  },
  {
    topic: 'windows_update',
    patterns: [
      /\bwindows updates?\b/i,
      /\bcheck for updates?\b/i,
      /\bupdate (?:my )?windows\b/i,
    ],
    directPhrases: [
      /^(?:windows updates?|check for updates?)$/i,
    ],
  },
  {
    topic: 'sound_output',
    patterns: [
      /\b(?:sound|audio) outputs?\b/i,
      /\boutput (?:sound |audio )?(?:device|speaker|headphones?)\b/i,
      /\bchoose (?:my |a |the )?(?:speaker|headphones?|audio device)\b/i,
      /\b(?:sound|audio) settings?\b/i,
    ],
    directPhrases: [
      /^(?:windows )?(?:sound|audio)(?: output| settings?)$/i,
      /^output (?:device|speaker|headphones?)$/i,
    ],
  },
  {
    topic: 'windows_search',
    patterns: [
      /\bwindows search\b/i,
      /\btaskbar search\b/i,
      /\bsearch (?:bar|box|button|icon)\b/i,
      /\bmagnifying glass\b.{0,30}\b(?:taskbar|bottom|start)\b/i,
    ],
    directPhrases: [
      /^(?:windows |taskbar )?search(?: bar| box| button| icon)?$/i,
    ],
  },
] as const

const NAVIGATION_INTENT =
  /\b(?:where|find|locate|show me|help me|how (?:do|can|to)|open|go to|get to|navigate|settings?|change|adjust|manage|turn|switch|enable|disable|connect|disconnect|choose|select|check|install|update|uninstall|remove|delete)\b/i

const EXPLANATION_OR_DIAGNOSIS = [
  /^(?:what|why|when|who|should)\b/i,
  /\bhow (?:does|did|is|are|was|were)\b/i,
  /\b(?:explain|tell me about|not working|stopped working|troubleshoot|error|failed|keeps? (?:failing|dropping|disconnecting)|what happens)\b/i,
  /\b(?:windows search) index(?:es|ed|ing)?\b/i,
] as const

const NON_WINDOWS_PLATFORM =
  /\b(?:mac|macos|os x|iphone|ipad|ios|android|linux|ubuntu|chromebook|chrome os|windows (?:server|phone|mobile))\b/i

const NON_UNINSTALL_REMOVAL =
  /\b(?:shortcut|icon|taskbar|start menu|file|folder|account|device|driver)\b/i

const NON_WINDOWS_SEARCH_CONTEXT =
  /\b(?:browser|chrome|edge|firefox|website|web ?page|document|word|excel|pdf)\b/i

/**
 * Normalizes untrusted chat input without invoking user-defined coercion hooks.
 * Overly long values are rejected rather than fed into every matching rule.
 */
export function normalizeNavigationQuery(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 2_000) return null

  const normalized = input
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, ' ')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}&'+.\-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

/** Accepts common labels but never guesses when the Windows version is absent. */
export function normalizeWindowsVersion(input: unknown): SupportedWindowsVersion | null {
  if (typeof input !== 'string' || input.length > 200) return null
  const value = input.normalize('NFKC').toLocaleLowerCase('en-US').trim()

  if (NON_WINDOWS_PLATFORM.test(value)) return null
  const isWindows11 = /\b(?:microsoft )?(?:windows|win)\s*11\b/.test(value)
  const isWindows10 = /\b(?:microsoft )?(?:windows|win)\s*10\b/.test(value)
  if (isWindows11 === isWindows10) return null
  if (isWindows11) return 'Windows 11'
  if (isWindows10) return 'Windows 10'
  return null
}

function isDirectPhrase(query: string): boolean {
  return WINDOWS_NAVIGATION_RULES.some(rule =>
    rule.directPhrases.some(pattern => pattern.test(query)),
  )
}

function isSupportedNavigationIntent(query: string): boolean {
  if (isDirectPhrase(query)) return true
  if (!NAVIGATION_INTENT.test(query)) return false
  return !EXPLANATION_OR_DIAGNOSIS.some(pattern => pattern.test(query))
}

function matchesTopic(rule: TopicRule, query: string): boolean {
  if (!rule.patterns.some(pattern => pattern.test(query))) return false

  // "Remove the Bluetooth device" is not an app-uninstall request.
  if (rule.topic === 'uninstall_apps' &&
      !/\buninstall(?:ing|ed|s)?\b/i.test(query) &&
      NON_UNINSTALL_REMOVAL.test(query)) {
    return false
  }

  // A web page's search box must remain a model-grounded, app-specific request.
  if (rule.topic === 'windows_search' &&
      !/\b(?:windows|taskbar) search\b/i.test(query) &&
      NON_WINDOWS_SEARCH_CONTEXT.test(query)) {
    return false
  }

  return true
}

/** Returns one topic only; overlapping requests deliberately fall back to the model. */
export function matchWindowsNavigationTopic(input: unknown): WindowsNavigationTopic | null {
  const query = normalizeNavigationQuery(input)
  if (!query || NON_WINDOWS_PLATFORM.test(query) || !isSupportedNavigationIntent(query)) {
    return null
  }

  const matches = WINDOWS_NAVIGATION_RULES
    .filter(rule => matchesTopic(rule, query))
    .map(rule => rule.topic)

  return matches.length === 1 ? matches[0] : null
}

function noTarget(): TargetPayload {
  return {
    zone: 'none',
    app: null,
    action: 'look',
    hint: null,
    name: null,
    role: null,
    window: null,
    visibility: 'unknown',
  }
}

function startTarget(_version: SupportedWindowsVersion): TargetPayload {
  return {
    zone: 'start_menu',
    app: null,
    action: 'click',
    hint: 'the Windows-logo Start button on the taskbar',
    name: 'Start',
    role: 'Button',
    window: 'Shell_TrayWnd',
    visibility: 'visible_now',
  }
}

function taskbarTarget(
  version: SupportedWindowsVersion,
  name: string,
  hint: string,
): TargetPayload {
  return {
    zone: 'taskbar',
    app: null,
    action: 'click',
    hint: `${hint} on Windows ${version === 'Windows 11' ? '11' : '10'}`,
    name,
    role: 'Button',
    window: 'Shell_TrayWnd',
    visibility: 'visible_now',
  }
}

function settingsTarget(
  name: string,
  role: string,
  action: TargetPayload['action'] = 'click',
  hint: string | null = null,
): TargetPayload {
  return {
    zone: 'ui_element',
    app: 'Settings',
    action,
    hint: hint ?? `the ${name} control in the Settings window`,
    name,
    role,
    window: 'Settings',
    visibility: 'after_navigation',
  }
}

function openFromStartStep(
  version: SupportedWindowsVersion,
  searchText: string,
  destination: string,
): StepPayload {
  return {
    stepNumber: 1,
    instruction: `Click Start, type “${searchText}”, then press Enter. Finish all three actions before returning to Retza; ${destination} will stay open.`,
    target: startTarget(version),
  }
}

function numberedSteps(steps: Array<Omit<StepPayload, 'stepNumber'> | StepPayload>): StepPayload[] {
  return steps.map((step, index) => ({ ...step, stepNumber: index + 1 }))
}

function buildBluetooth(
  query: string,
  version: SupportedWindowsVersion,
): { text: string; steps: StepPayload[] } {
  const searchText = version === 'Windows 11'
    ? 'Bluetooth & devices settings'
    : 'Bluetooth and other devices settings'
  const shouldChange = /\b(?:turn|switch|enable|disable)\b/i.test(query)

  return {
    text: `Here is the shortest Bluetooth path for ${version}.`,
    steps: numberedSteps([
      openFromStartStep(version, searchText, 'the Bluetooth Settings page'),
      {
        instruction: shouldChange
          ? 'Click the Bluetooth switch near the top of the page to turn it on or off.'
          : 'The Bluetooth on/off switch is near the top of this page; click it only if you want to change its current state.',
        target: settingsTarget(
          'Bluetooth',
          'Button',
          shouldChange ? 'click' : 'look',
          'the switch labelled Bluetooth near the top of the Settings page',
        ),
      },
    ]),
  }
}

function buildDisplay(version: SupportedWindowsVersion): { text: string; steps: StepPayload[] } {
  return {
    text: `This opens the correct Display page on ${version}.`,
    steps: [openFromStartStep(version, 'Display settings', 'the Display Settings page')],
  }
}

function buildDeviceManager(version: SupportedWindowsVersion): { text: string; steps: StepPayload[] } {
  return {
    text: `This is the reliable way to open Device Manager on ${version}.`,
    steps: [openFromStartStep(version, 'Device Manager', 'Device Manager')],
  }
}

function buildUninstall(version: SupportedWindowsVersion): { text: string; steps: StepPayload[] } {
  const windows11 = version === 'Windows 11'
  const searchText = windows11 ? 'Installed apps' : 'Add or remove programs'
  const searchBoxName = windows11 ? 'Search apps' : 'Search this list'

  return {
    text: `Here is the ${version} path for removing an installed program. Save any work in that program first.`,
    steps: numberedSteps([
      openFromStartStep(version, searchText, `${searchText} in Settings`),
      {
        instruction: `In the “${searchBoxName}” box, type the name of the program you want to remove.`,
        target: settingsTarget(
          searchBoxName,
          'Edit',
          'type',
          `the box labelled ${searchBoxName} above the list of installed programs`,
        ),
      },
      {
        instruction: windows11
          ? 'Beside the matching program, click More options (three dots), choose Uninstall, and confirm if asked. Complete those menu actions before returning to Retza.'
          : 'Click the matching program, click Uninstall, and confirm if asked. Complete those actions before returning to Retza.',
        // The program name is unknown, so claiming an exact semantic target here
        // would risk highlighting the wrong app or one of many "More options" buttons.
        target: noTarget(),
      },
    ]),
  }
}

function isWifiTaskbarLocationRequest(query: string): boolean {
  return /\b(?:button|icon)\b/i.test(query) && /\b(?:where|find|locate|show me)\b/i.test(query)
}

function buildWifi(
  query: string,
  version: SupportedWindowsVersion,
): { text: string; steps: StepPayload[] } {
  if (isWifiTaskbarLocationRequest(query)) {
    const windows11 = version === 'Windows 11'
    return {
      text: `The Wi-Fi control is in the ${version} taskbar's network area, usually near the clock.`,
      steps: [{
        stepNumber: 1,
        instruction: windows11
          ? 'Click the combined Network, volume, and battery area on the taskbar. Use the Wi-Fi button in Quick Settings before returning to Retza.'
          : 'Click the Network icon in the taskbar notification area. Use the Wi-Fi control in the panel before returning to Retza.',
        target: taskbarTarget(
          version,
          'Network',
          windows11
            ? 'the combined network, speaker, and battery area on the taskbar, usually near the clock'
            : 'the network or Wi-Fi icon in the taskbar notification area, usually beside the clock',
        ),
      }],
    }
  }

  const wantsConnection = /\b(?:connect|join|available networks?)\b/i.test(query)
  const wantsToggle = /\b(?:turn|switch|enable|disable)\b/i.test(query)
  const steps: Array<Omit<StepPayload, 'stepNumber'> | StepPayload> = [
    openFromStartStep(version, 'Wi-Fi settings', 'the Wi-Fi Settings page'),
  ]

  if (wantsConnection) {
    steps.push({
      instruction: 'Click Show available networks, choose your network, and click Connect before returning to Retza. Enter the network password if Windows asks for it.',
      target: settingsTarget(
        'Show available networks',
        'Button',
        'click',
        'the Show available networks button on the Wi-Fi Settings page',
      ),
    })
  } else {
    steps.push({
      instruction: wantsToggle
        ? 'Click the Wi-Fi switch to turn wireless networking on or off.'
        : 'The Wi-Fi switch is at the top of this page; the connection details and known networks are below it.',
      target: settingsTarget(
        'Wi-Fi',
        'Button',
        wantsToggle ? 'click' : 'look',
        'the switch labelled Wi-Fi near the top of the Settings page',
      ),
    })
  }

  return {
    text: `Here is the durable Wi-Fi Settings path for ${version}.`,
    steps: numberedSteps(steps),
  }
}

function buildWindowsUpdate(
  query: string,
  version: SupportedWindowsVersion,
): { text: string; steps: StepPayload[] } {
  const shouldCheck = /\b(?:check|install|update)\b/i.test(query) && !/\bwhere\b/i.test(query)
  return {
    text: `This opens the correct Windows Update page on ${version}.`,
    steps: numberedSteps([
      openFromStartStep(version, 'Check for updates', 'Windows Update in Settings'),
      {
        instruction: shouldCheck
          ? 'Click Check for updates. Keep the computer plugged in if Windows needs to download or install anything.'
          : 'The Check for updates button is near the top of this page; click it when you are ready to look for updates.',
        target: settingsTarget(
          'Check for updates',
          'Button',
          shouldCheck ? 'click' : 'look',
          'the Check for updates button near the top of the Windows Update page',
        ),
      },
    ]),
  }
}

function buildSoundOutput(version: SupportedWindowsVersion): { text: string; steps: StepPayload[] } {
  const windows11 = version === 'Windows 11'
  return {
    text: `Here is where ${version} lets you choose the speakers or headphones to use.`,
    steps: numberedSteps([
      openFromStartStep(version, 'Sound settings', 'the Sound Settings page'),
      {
        instruction: windows11
          ? 'Under Output, choose a device in “Choose where to play sound.”'
          : 'Open “Choose your output device” and select your speakers or headphones before returning to Retza.',
        target: settingsTarget(
          windows11 ? 'Choose where to play sound' : 'Choose your output device',
          windows11 ? 'Group' : 'ComboBox',
          windows11 ? 'look' : 'click',
          windows11
            ? 'the Choose where to play sound section under Output'
            : 'the Choose your output device box near the top of the Sound page',
        ),
      },
    ]),
  }
}

function buildWindowsSearch(version: SupportedWindowsVersion): { text: string; steps: StepPayload[] } {
  return {
    text: 'Windows Search is on the taskbar near the Windows-logo Start button.',
    steps: [{
      stepNumber: 1,
      instruction: 'Click the Search button or search box on the taskbar, then type what you want to find.',
      target: taskbarTarget(
        version,
        'Search',
        'the Search button or box near the Windows-logo Start button on the taskbar',
      ),
    }],
  }
}

function buildWalkthrough(
  topic: WindowsNavigationTopic,
  query: string,
  version: SupportedWindowsVersion,
): { text: string; steps: StepPayload[] } {
  switch (topic) {
    case 'bluetooth': return buildBluetooth(query, version)
    case 'display': return buildDisplay(version)
    case 'device_manager': return buildDeviceManager(version)
    case 'uninstall_apps': return buildUninstall(version)
    case 'wifi': return buildWifi(query, version)
    case 'windows_update': return buildWindowsUpdate(query, version)
    case 'sound_output': return buildSoundOutput(version)
    case 'windows_search': return buildWindowsSearch(version)
  }
}

function queryMentionsConflictingVersion(
  query: string,
  actualVersion: SupportedWindowsVersion,
): boolean {
  const mentionedVersions = [
    ...query.matchAll(/\b(?:windows|win)\s*(\d+(?:\.\d+)?)\b/gi),
  ].map(match => match[1])
  if (mentionedVersions.some(version => version !== '10' && version !== '11')) return true

  const mentions10 = /\bwindows\s*10\b|\bwin\s*10\b/i.test(query)
  const mentions11 = /\bwindows\s*11\b|\bwin\s*11\b/i.test(query)
  if (mentions10 && mentions11) return true
  if (mentions10) return actualVersion !== 'Windows 10'
  if (mentions11) return actualVersion !== 'Windows 11'
  return false
}

/**
 * Resolves a small, high-confidence subset of Windows navigation requests.
 * Returning null is intentional: the caller can clarify or use its grounded
 * model path for anything ambiguous, explanatory, diagnostic, or app-specific.
 */
export function resolveWindowsNavigation(
  input: unknown,
  os: unknown,
): WindowsNavigationResult | null {
  const query = normalizeNavigationQuery(input)
  const windowsVersion = normalizeWindowsVersion(os)
  if (!query || !windowsVersion || queryMentionsConflictingVersion(query, windowsVersion)) {
    return null
  }

  const topic = matchWindowsNavigationTopic(query)
  if (!topic) return null

  const walkthrough = buildWalkthrough(topic, query, windowsVersion)
  return {
    ok: true,
    text: walkthrough.text,
    steps: walkthrough.steps,
    source: 'windows_knowledge',
    topic,
    windowsVersion,
  }
}

/** Backwards-friendly short name for callers that treat this as a lookup. */
export const getWindowsNavigation = resolveWindowsNavigation
