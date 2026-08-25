import type { AppSettings, RendererSettings, TextSize } from '../shared/contracts'

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  textSize: 'normal',
  struggleDetection: true,
}

const TEXT_SIZES = new Set<TextSize>(['normal', 'large', 'xlarge'])
const MAX_API_KEY_LENGTH = 4096

export function sanitizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_SETTINGS }
  }

  const candidate = value as Record<string, unknown>
  const apiKey = typeof candidate.apiKey === 'string'
    ? candidate.apiKey.trim().slice(0, MAX_API_KEY_LENGTH)
    : DEFAULT_SETTINGS.apiKey
  const textSize = typeof candidate.textSize === 'string' && TEXT_SIZES.has(candidate.textSize as TextSize)
    ? candidate.textSize as TextSize
    : DEFAULT_SETTINGS.textSize
  const struggleDetection = typeof candidate.struggleDetection === 'boolean'
    ? candidate.struggleDetection
    : DEFAULT_SETTINGS.struggleDetection

  return { apiKey, textSize, struggleDetection }
}

export function toRendererSettings(
  settings: AppSettings,
  hasActiveApiKey = Boolean(settings.apiKey),
): RendererSettings {
  return {
    hasApiKey: hasActiveApiKey,
    textSize: settings.textSize,
    struggleDetection: settings.struggleDetection,
  }
}
