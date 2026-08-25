export type TextSize = 'normal' | 'large' | 'xlarge'

export interface AppSettings {
  apiKey: string
  textSize: TextSize
  struggleDetection: boolean
}

/** Settings safe to expose to the sandboxed renderer. */
export interface RendererSettings {
  hasApiKey: boolean
  textSize: TextSize
  struggleDetection: boolean
}

/** The renderer may submit a new key, but the stored key is never read back. */
export interface SettingsPatch {
  apiKey?: string
  textSize?: TextSize
  struggleDetection?: boolean
}

export type TargetZone =
  | 'taskbar'
  | 'desktop'
  | 'start_menu'
  | 'screen_center'
  | 'top_right'
  | 'browser_address_bar'
  | 'ui_element'
  | 'none'

export type TargetAction = 'click' | 'look' | 'type'
export type TargetVisibility = 'visible_now' | 'after_navigation' | 'unknown'

/**
 * A semantic target requested by the assistant. Coordinates are deliberately
 * absent: only the main process may turn this description into screen bounds.
 */
export interface TargetPayload {
  zone: TargetZone
  app: string | null
  action: TargetAction
  hint: string | null
  name?: string | null
  role?: string | null
  window?: string | null
  visibility?: TargetVisibility
}

export interface StepPayload {
  stepNumber: number
  instruction: string
  target: TargetPayload
  prereq?: boolean
}

export interface HistoryEntry {
  role: 'user' | 'model'
  text: string
}

export type ChatResult =
  | {
      ok: true
      text: string
      steps?: StepPayload[]
      clarify?: string
      clarifyOptions?: string[]
      target?: TargetPayload
      source: 'windows_knowledge' | 'model'
      historyText?: string
    }
  | {
      ok: false
      error: string
      code: 'api_key_missing' | 'network' | 'timeout' | 'invalid_response' | 'unavailable'
    }

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type LocationEvidence =
  | 'windows_uia_automation_id'
  | 'windows_uia_exact_name'
  | 'windows_uia_scoped_name'
  | 'macos_accessibility'

export interface ShowMeRenderData {
  bounds: Rect
  hint: string
  action: TargetAction
  evidence: LocationEvidence
  textSize?: TextSize
  stepNumber?: number
  totalSteps?: number
}

export type ShowMeFailureCode =
  | 'busy'
  | 'invalid_target'
  | 'not_locatable'
  | 'not_found'
  | 'not_visible'
  | 'not_actionable'
  | 'ambiguous'
  | 'occluded'
  | 'screen_changed'
  | 'unsupported_platform'
  | 'window_unavailable'
  | 'permission_denied'
  | 'uia_unavailable'
  | 'cancelled'
  | 'internal_error'

export type ShowMeResult =
  | {
      ok: true
      confidence: 'high'
      evidence: LocationEvidence
    }
  | {
      ok: false
      code: ShowMeFailureCode
      message: string
      retryable: boolean
    }

export type Detector = 'idle' | 'rageClick' | 'longHover'
