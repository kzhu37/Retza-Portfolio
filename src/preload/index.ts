import { contextBridge, ipcRenderer } from 'electron'
import type {
  ChatResult,
  HistoryEntry,
  RendererSettings,
  SettingsPatch,
  ShowMeRenderData,
  ShowMeResult,
  TargetPayload,
} from '../shared/contracts'

function on(channel: string, callback: (...args: unknown[]) => void): () => void {
  const handler = (_: Electron.IpcRendererEvent, ...args: unknown[]): void => callback(...args)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
  setIgnoreMouseEvents: (ignore: boolean): void =>
    ipcRenderer.send('set-ignore-mouse-events', ignore),

  focusMainWindow: (): void =>
    ipcRenderer.send('focus-main-window'),

  geminiChat: (message: string, history: HistoryEntry[]): Promise<ChatResult> =>
    ipcRenderer.invoke('gemini-chat', message, history),

  getSettings: (): Promise<RendererSettings> =>
    ipcRenderer.invoke('get-settings'),

  saveSettings: (patch: SettingsPatch): Promise<RendererSettings> =>
    ipcRenderer.invoke('save-settings', patch),

  onStruggleDetected: (cb: (detector: string) => void): (() => void) =>
    on('struggle-detected', cb as (...args: unknown[]) => void),

  onFoxResponse: (cb: () => void): (() => void) =>
    on('fox-response', cb),

  refreshSystemContext: (): Promise<void> =>
    ipcRenderer.invoke('refresh-system-context'),

  showMe: (target: TargetPayload, stepNumber?: number, totalSteps?: number): Promise<ShowMeResult> =>
    ipcRenderer.invoke('show-me', target, stepNumber, totalSteps),

  walkthroughSummary: (taskDescription: string): Promise<{ ok: boolean; text: string }> =>
    ipcRenderer.invoke('walkthrough-summary', taskDescription),

  onShowMeRender: (cb: (data: ShowMeRenderData) => void): (() => void) =>
    on('showme-render', cb as (...args: unknown[]) => void),

  onShowMeTriggerDismiss: (cb: () => void): (() => void) =>
    on('showme-trigger-dismiss', cb as (...args: unknown[]) => void),

  onShowMeInvalidated: (cb: (message: string) => void): (() => void) =>
    on('showme-invalidated', cb as (...args: unknown[]) => void),

  dismissShowMe: (): void =>
    ipcRenderer.send('showme-dismiss'),

  onFoxWalkBegin: (cb: (data: { startX: number; startY: number; targetX: number; targetY: number; durationMs: number }) => void): (() => void) =>
    on('foxwalk-begin', cb as (...args: unknown[]) => void),

  onFoxWalkHome: (cb: (data: { fromX: number; fromY: number; toX: number; toY: number; durationMs: number }) => void): (() => void) =>
    on('foxwalk-home', cb as (...args: unknown[]) => void),

  foxCelebrate: (): void =>
    ipcRenderer.send('fox-celebrate'),

  onFoxCelebrate: (cb: () => void): (() => void) =>
    on('fox-celebrate', cb),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.api = api
}
