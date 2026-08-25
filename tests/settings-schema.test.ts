import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, sanitizeSettings, toRendererSettings } from '../src/main/settings-schema'

describe('sanitizeSettings', () => {
  it('returns independent defaults for malformed values', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings([])).toEqual(DEFAULT_SETTINGS)
  })

  it('keeps only supported setting values', () => {
    expect(sanitizeSettings({
      apiKey: '  secret  ',
      textSize: 'huge',
      struggleDetection: 'yes',
      __proto__: { polluted: true },
    })).toEqual({
      apiKey: 'secret',
      textSize: 'normal',
      struggleDetection: true,
    })
  })

  it('accepts every supported text size and boolean detector value', () => {
    expect(sanitizeSettings({ textSize: 'xlarge', struggleDetection: false })).toEqual({
      apiKey: '',
      textSize: 'xlarge',
      struggleDetection: false,
    })
  })

  it('never exposes the stored key in renderer settings', () => {
    const view = toRendererSettings({
      apiKey: 'secret-value',
      textSize: 'large',
      struggleDetection: false,
    })
    expect(view).toEqual({ hasApiKey: true, textSize: 'large', struggleDetection: false })
    expect(view).not.toHaveProperty('apiKey')
  })
})
