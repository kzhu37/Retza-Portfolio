const target = (name, role, action, semanticId, hint, window = 'Settings') => ({
  zone: 'ui_element',
  app: 'Demo Computer',
  action,
  hint,
  name,
  role,
  window,
  visibility: 'visible_now',
  semanticId,
})

export const SCENARIOS = Object.freeze({
  bluetooth: {
    id: 'bluetooth',
    label: 'Turn on Bluetooth',
    patterns: [/\bbluetooth\b/i],
    intro: 'Here is the shortest Bluetooth path in the demo computer.',
    steps: [
      {
        instruction: 'Open Bluetooth & devices from the Settings sidebar.',
        page: 'home',
        target: target('Bluetooth & devices', 'button', 'click', 'nav-bluetooth', 'the Bluetooth & devices item in the Settings sidebar'),
      },
      {
        instruction: 'Use the Bluetooth switch near the top of the page.',
        page: 'bluetooth',
        target: target('Bluetooth', 'button', 'click', 'bluetooth-toggle', 'the switch labelled Bluetooth near the top of the page'),
      },
    ],
  },
  wifi: {
    id: 'wifi',
    label: 'Connect to Wi-Fi',
    patterns: [/\bwi[ -]?fi\b/i, /\bwireless\b/i],
    intro: 'Let’s open the demo Wi-Fi controls and choose a network.',
    steps: [
      {
        instruction: 'Open Network & internet from the Settings sidebar.',
        page: 'home',
        target: target('Network & internet', 'button', 'click', 'nav-wifi', 'the Network & internet item in the Settings sidebar'),
      },
      {
        instruction: 'Make sure the Wi-Fi switch is on.',
        page: 'wifi',
        target: target('Wi-Fi', 'button', 'click', 'wifi-toggle', 'the Wi-Fi switch at the top of the page'),
      },
      {
        instruction: 'Select the network named Retza Guest.',
        page: 'wifi',
        target: target('Retza Guest', 'button', 'click', 'wifi-retza-guest', 'the Retza Guest network in the available networks list'),
      },
    ],
  },
  display: {
    id: 'display',
    label: 'Change my display settings',
    patterns: [/\bdisplay\b/i, /\bbrightness\b/i, /\bscale\b/i, /\bresolution\b/i],
    intro: 'This opens the Display page and identifies the relevant control.',
    steps: [
      {
        instruction: 'Open System from the Settings sidebar.',
        page: 'home',
        target: target('System', 'button', 'click', 'nav-system', 'the System item in the Settings sidebar'),
      },
      {
        instruction: 'Open Display.',
        page: 'system',
        target: target('Display', 'button', 'click', 'system-display', 'the Display row under System'),
      },
      {
        instruction: 'Adjust the Brightness slider to a comfortable level.',
        page: 'display',
        target: target('Brightness', 'slider', 'click', 'brightness-slider', 'the Brightness slider'),
      },
    ],
  },
  sound_output: {
    id: 'sound_output',
    label: 'Change sound output',
    patterns: [/\bsound\b/i, /\baudio\b/i, /\bspeaker\b/i, /\bheadphones?\b/i],
    intro: 'Here is the sound-output path in the demo computer.',
    steps: [
      {
        instruction: 'Open System from the Settings sidebar.',
        page: 'home',
        target: target('System', 'button', 'click', 'nav-system', 'the System item in the Settings sidebar'),
      },
      {
        instruction: 'Open Sound.',
        page: 'system',
        target: target('Sound', 'button', 'click', 'system-sound', 'the Sound row under System'),
      },
      {
        instruction: 'Choose the output device you want to use.',
        page: 'sound',
        target: target('Output device', 'combobox', 'click', 'sound-output', 'the Output device menu'),
      },
    ],
  },
  windows_update: {
    id: 'windows_update',
    label: 'Check for Windows updates',
    patterns: [/\bwindows update\b/i, /\bcheck for updates?\b/i, /\bupdate windows\b/i],
    intro: 'Here is the deterministic Windows Update path represented in the sandbox.',
    steps: [
      {
        instruction: 'Open Windows Update from the Settings sidebar.',
        page: 'home',
        target: target('Windows Update', 'button', 'click', 'nav-update', 'the Windows Update item in the Settings sidebar'),
      },
      {
        instruction: 'Select Check for updates.',
        page: 'update',
        target: target('Check for updates', 'button', 'click', 'check-updates', 'the Check for updates button'),
      },
    ],
  },
  uninstall_apps: {
    id: 'uninstall_apps',
    label: 'Remove an app',
    patterns: [/\buninstall\b/i, /\bremove .{0,20}\bapp\b/i, /\binstalled apps?\b/i],
    intro: 'Here is a safe app-removal walkthrough inside the demo computer.',
    steps: [
      {
        instruction: 'Open Apps from the Settings sidebar.',
        page: 'home',
        target: target('Apps', 'button', 'click', 'nav-apps', 'the Apps item in the Settings sidebar'),
      },
      {
        instruction: 'Open Installed apps.',
        page: 'apps',
        target: target('Installed apps', 'button', 'click', 'apps-installed', 'the Installed apps row'),
      },
      {
        instruction: 'Type the app name into Search apps.',
        page: 'installed-apps',
        target: target('Search apps', 'textbox', 'type', 'search-apps', 'the Search apps box'),
      },
      {
        instruction: 'Use Remove beside Photo Viewer. In the real Windows app, Retza would avoid guessing when the exact app row cannot be verified.',
        page: 'installed-apps',
        target: target('Remove Photo Viewer', 'button', 'click', 'remove-photo-viewer', 'the Remove button beside Photo Viewer'),
      },
    ],
  },
  windows_search: {
    id: 'windows_search',
    label: 'Use Windows Search',
    patterns: [/\bwindows search\b/i, /\btaskbar search\b/i, /\bsearch bar\b/i],
    intro: 'This scenario demonstrates semantic targeting in the demo taskbar.',
    steps: [
      {
        instruction: 'Select Search in the demo taskbar.',
        page: 'home',
        target: target('Search', 'button', 'click', 'taskbar-search', 'the Search control in the demo taskbar', 'Taskbar'),
      },
      {
        instruction: 'Type what you want to find into the search box.',
        page: 'search',
        target: target('Search apps, settings, and files', 'textbox', 'type', 'search-box', 'the search box', 'Search'),
      },
    ],
  },
  device_manager: {
    id: 'device_manager',
    label: 'Open Device Manager',
    patterns: [/\bdevice manager\b/i],
    intro: 'This demo represents the deterministic Device Manager navigation path without pretending to inspect your real computer.',
    steps: [
      {
        instruction: 'Select Search in the demo taskbar.',
        page: 'home',
        target: target('Search', 'button', 'click', 'taskbar-search', 'the Search control in the demo taskbar', 'Taskbar'),
      },
      {
        instruction: 'Type Device Manager into the search box.',
        page: 'search',
        target: target('Search apps, settings, and files', 'textbox', 'type', 'search-box', 'the search box', 'Search'),
      },
      {
        instruction: 'Open Device Manager from the result list.',
        page: 'search-device-manager',
        target: target('Device Manager', 'button', 'click', 'device-manager-result', 'the Device Manager search result', 'Search'),
      },
    ],
  },
})

export const EXAMPLE_IDS = ['bluetooth', 'wifi', 'display', 'windows_update']

export function matchScenario(input) {
  const query = String(input ?? '').normalize('NFKC').trim()
  if (!query || query.length > 2000) return null
  const matches = Object.values(SCENARIOS).filter(scenario => scenario.patterns.some(pattern => pattern.test(query)))
  return matches.length === 1 ? matches[0] : null
}

export function numberedSteps(scenario) {
  return scenario.steps.map((step, index) => ({ ...step, stepNumber: index + 1 }))
}
