import type {
  ChatResult,
  HistoryEntry,
  RendererSettings,
  SettingsPatch,
  ShowMeRenderData,
  ShowMeResult,
  TargetPayload,
} from '../shared/contracts'

declare global {
  interface Window {
    api: {
      setIgnoreMouseEvents: (ignore: boolean) => void
      focusMainWindow: () => void
      geminiChat: (message: string, history: HistoryEntry[]) => Promise<ChatResult>
      getSettings: () => Promise<RendererSettings>
      saveSettings: (patch: SettingsPatch) => Promise<RendererSettings>
      onStruggleDetected: (callback: (detector: string) => void) => () => void
      onFoxResponse: (callback: () => void) => () => void
      refreshSystemContext: () => Promise<void>
      showMe: (target: TargetPayload, stepNumber?: number, totalSteps?: number) => Promise<ShowMeResult>
      onShowMeRender: (callback: (data: ShowMeRenderData) => void) => () => void
      walkthroughSummary: (taskDescription: string) => Promise<{ ok: boolean; text: string }>
      onShowMeTriggerDismiss: (callback: () => void) => () => void
      onShowMeInvalidated: (callback: (message: string) => void) => () => void
      dismissShowMe: () => void
      onFoxWalkBegin: (callback: (data: { startX: number; startY: number; targetX: number; targetY: number; durationMs: number }) => void) => () => void
      onFoxWalkHome: (callback: (data: { fromX: number; fromY: number; toX: number; toY: number; durationMs: number }) => void) => () => void
      foxCelebrate: () => void
      onFoxCelebrate: (callback: () => void) => () => void
    }
  }
}
