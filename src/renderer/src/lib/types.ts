import type { RendererSettings } from '../../../shared/contracts'

export type {
  AppSettings,
  ChatResult,
  HistoryEntry,
  Rect,
  RendererSettings,
  SettingsPatch,
  ShowMeRenderData,
  ShowMeResult,
  StepPayload,
  TargetAction,
  TargetPayload,
  TargetVisibility,
  TargetZone,
  TextSize,
} from '../../../shared/contracts'

export const DEFAULT_SETTINGS: RendererSettings = {
  hasApiKey: false,
  textSize: 'normal',
  struggleDetection: true,
}
