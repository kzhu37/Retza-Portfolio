import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import type { AppSettings } from '../shared/contracts'
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings-schema'

interface StoredSettings {
  apiKey?: string
  encryptedApiKey?: string
  textSize?: unknown
  struggleDetection?: unknown
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'retza-settings.json')
}

export function loadSettings(): AppSettings {
  try {
    const p = settingsPath()
    if (!existsSync(p)) return { ...DEFAULT_SETTINGS }
    const stored = JSON.parse(readFileSync(p, 'utf8')) as StoredSettings
    let apiKey = typeof stored.apiKey === 'string' ? stored.apiKey : ''
    if (stored.encryptedApiKey && safeStorage.isEncryptionAvailable()) {
      try {
        apiKey = safeStorage.decryptString(Buffer.from(stored.encryptedApiKey, 'base64'))
      } catch {
        apiKey = ''
      }
    }
    const settings = sanitizeSettings({ ...stored, apiKey })
    if (typeof stored.apiKey === 'string' && stored.apiKey.length > 0
        && safeStorage.isEncryptionAvailable()) {
      // Best-effort migration: do not leave a legacy plaintext key on disk
      // until the user happens to change another setting.
      try { saveSettings(settings) } catch { /* loading must still succeed */ }
    }
    return settings
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: AppSettings): void {
  const p = settingsPath()
  mkdirSync(dirname(p), { recursive: true })
  const next = sanitizeSettings(s)
  const stored: StoredSettings = {
    textSize: next.textSize,
    struggleDetection: next.struggleDetection,
  }

  if (next.apiKey && safeStorage.isEncryptionAvailable()) {
    stored.encryptedApiKey = safeStorage.encryptString(next.apiKey).toString('base64')
  } else if (next.apiKey) {
    stored.apiKey = next.apiKey
  }

  const tempPath = `${p}.${process.pid}.tmp`
  try {
    writeFileSync(tempPath, JSON.stringify(stored, null, 2), { encoding: 'utf8', mode: 0o600 })
    renameSync(tempPath, p)
  } catch (error) {
    try { if (existsSync(tempPath)) unlinkSync(tempPath) } catch { /* best effort */ }
    throw error
  }
}

export type { AppSettings } from '../shared/contracts'
