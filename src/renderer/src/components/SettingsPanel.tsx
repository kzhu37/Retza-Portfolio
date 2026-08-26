import { useState, useEffect, useRef } from 'react'
import type { RendererSettings, SettingsPatch } from '../lib/types'
import { FONT_SCALE, type TextSize } from '../lib/textSize'

interface Props {
  open: boolean
  settings: RendererSettings
  onClose: () => void
  onChange: (patch: SettingsPatch) => Promise<boolean>
  onRefreshContext: () => Promise<void>
}

function CloseIcon(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" fill="none" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function EyeIcon({ show }: { show: boolean }): JSX.Element {
  return show ? (
    <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" fill="none" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" fill="none" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }): JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        width: 52, height: 30, flexShrink: 0,
        background: checked ? '#22c55e' : '#334155',
        borderRadius: 15, border: 'none', cursor: 'pointer',
        position: 'relative', transition: 'background 200ms',
      }}
    >
      <span style={{
        position: 'absolute', top: 4,
        left: checked ? 26 : 4,
        width: 22, height: 22, borderRadius: '50%',
        background: '#fff', transition: 'left 200ms ease',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

const TEXT_SIZE_LABELS: { key: TextSize; label: string; desc: string }[] = [
  { key: 'normal',  label: 'Normal',      desc: `${FONT_SCALE.normal.msg}px` },
  { key: 'large',   label: 'Large',       desc: `${FONT_SCALE.large.msg}px` },
  { key: 'xlarge',  label: 'Extra Large', desc: `${FONT_SCALE.xlarge.msg}px` },
]

export default function SettingsPanel({ open, settings, onClose, onChange, onRefreshContext }: Props): JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keySaved, setKeySaved] = useState(false)
  const [ctxScanning, setCtxScanning] = useState(false)
  const [ctxDone, setCtxDone] = useState(false)
  const [ctxError, setCtxError] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  async function handleRefreshContext(): Promise<void> {
    setCtxScanning(true)
    setCtxDone(false)
    setCtxError(false)
    try {
      await onRefreshContext()
      setCtxDone(true)
      setTimeout(() => setCtxDone(false), 2200)
    } catch {
      setCtxError(true)
    } finally {
      setCtxScanning(false)
    }
  }

  useEffect(() => {
    const drawer = drawerRef.current
    if (!drawer) return
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
      drawer.removeAttribute('inert')
      requestAnimationFrame(() => drawer.querySelector<HTMLElement>('button, input')?.focus())
    } else {
      drawer.setAttribute('inert', '')
      previousFocusRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !drawerRef.current) return
      const focusable = [...drawerRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )].filter(element => !element.hasAttribute('inert') && element.getClientRects().length > 0)
      if (!focusable.length) {
        event.preventDefault()
        drawerRef.current.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !drawerRef.current.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  async function saveApiKey(): Promise<void> {
    const nextKey = apiKey.trim()
    if (!nextKey) return
    const saved = await onChange({ apiKey: nextKey })
    if (saved) {
      setApiKey('')
      setShowKey(false)
      setKeySaved(true)
      setTimeout(() => setKeySaved(false), 2200)
    }
  }

  async function removeApiKey(): Promise<void> {
    if (!await onChange({ apiKey: '' })) return
    setApiKey('')
    setShowKey(false)
    setKeySaved(false)
  }

  const fs = FONT_SCALE[settings.textSize]

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 250ms',
        }}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
        aria-hidden={!open}
        tabIndex={-1}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 50,
          width: 340,
          background: 'linear-gradient(180deg, #1a2035 0%, #0f172a 100%)',
          borderLeft: '1.5px solid #334155',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 280ms cubic-bezier(0.4,0,0.2,1)',
          display: 'flex', flexDirection: 'column',
          fontFamily: "'Inter', system-ui, sans-serif",
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 16px',
          borderBottom: '1.5px solid #1e293b',
        }}>
          <h2 style={{ fontSize: fs.heading, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 10, border: 'none',
              background: '#1e293b', color: '#94a3b8', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 150ms, color 150ms',
            }}
            aria-label="Close settings"
            onMouseEnter={e => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.color = '#f1f5f9' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.color = '#94a3b8' }}
          >
            <CloseIcon />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* -- API Key -- */}
          <section>
            <p style={{ fontSize: fs.hint, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Gemini API Key
            </p>
            <p style={{ fontSize: fs.ts, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
              {settings.hasApiKey
                ? 'A key is saved locally. Enter a new key only if you want to replace it.'
                : "Keys are stored locally and sent only to Google's API when you ask Fox a question."}
            </p>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void saveApiKey() }}
                placeholder={settings.hasApiKey ? 'Enter a new key to replace it' : 'AIza...'}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: '#0f172a', border: '1.5px solid #334155',
                  color: '#f1f5f9', borderRadius: 12,
                  fontSize: fs.input, padding: '13px 48px 13px 16px',
                  outline: 'none', fontFamily: 'monospace',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#f97316' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#334155' }}
                aria-label="Gemini API key"
              />
              <button
                onClick={() => setShowKey(s => !s)}
                disabled={!apiKey}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#64748b', cursor: apiKey ? 'pointer' : 'default', padding: 4,
                }}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                <EyeIcon show={showKey} />
              </button>
            </div>
            <button
              onClick={() => void saveApiKey()}
              disabled={!apiKey.trim()}
              style={{
                marginTop: 10, width: '100%', height: 48, borderRadius: 12,
                border: 'none', cursor: apiKey.trim() ? 'pointer' : 'default', fontWeight: 600,
                fontSize: fs.msg,
                background: keySaved
                  ? 'linear-gradient(135deg,#16a34a,#22c55e)'
                  : apiKey.trim()
                    ? 'linear-gradient(135deg,#f97316,#fb923c)'
                    : 'linear-gradient(135deg,#334155,#475569)',
                color: '#fff', transition: 'background 300ms',
              }}
            >
              {keySaved ? '✓ Saved!' : 'Save Key'}
            </button>
            {settings.hasApiKey && (
              <button
                onClick={() => void removeApiKey()}
                style={{
                  marginTop: 8, width: '100%', border: 'none', background: 'transparent',
                  color: '#fca5a5', cursor: 'pointer', fontSize: fs.ts, textDecoration: 'underline',
                }}
              >
                Remove saved key
              </button>
            )}
          </section>

          {/* -- Text Size -- */}
          <section>
            <p style={{ fontSize: fs.hint, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
              Text Size
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TEXT_SIZE_LABELS.map(({ key, label, desc }) => {
                const active = settings.textSize === key
                return (
                  <button
                    key={key}
                    onClick={() => void onChange({ textSize: key })}
                    style={{
                      width: '100%', height: 56, borderRadius: 12,
                      border: `1.5px solid ${active ? '#f97316' : '#334155'}`,
                      background: active ? 'rgba(249,115,22,0.1)' : '#0f172a',
                      color: active ? '#fb923c' : '#94a3b8',
                      cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between',
                      padding: '0 18px', transition: 'all 150ms',
                    }}
                    aria-pressed={active}
                  >
                    <span style={{ fontWeight: active ? 700 : 400, fontSize: FONT_SCALE[key].msg }}>
                      {label}
                    </span>
                    <span style={{ fontSize: 12, color: '#475569' }}>{desc}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* -- Struggle Detection -- */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: fs.hint, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Struggle Detection
              </p>
              <Toggle
                checked={settings.struggleDetection}
                onChange={v => { void onChange({ struggleDetection: v }) }}
                label="Toggle struggle detection"
              />
            </div>
            <p style={{ fontSize: fs.ts, color: '#64748b', lineHeight: 1.6 }}>
              Fox observes mouse movement, click timing, and whether a key was pressed to notice when you may be stuck. This stays on your computer; Retza does not record which keys you type, store this activity, or send it to Gemini.
            </p>
          </section>

          {/* -- Computer Context -- */}
          <section>
            <p style={{ fontSize: fs.hint, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Computer Context
            </p>
            <p style={{ fontSize: fs.ts, color: '#64748b', lineHeight: 1.6, marginBottom: 12 }}>
              Retza reads your Windows version, browser and process names, visible browser-window titles, and the names of taskbar and Desktop shortcuts. It does not read file contents or take screenshots. For questions that need Gemini, selected app/site names are sent with your question so the answer can match your computer.
            </p>
            <button
              onClick={handleRefreshContext}
              disabled={ctxScanning}
              style={{
                width: '100%', height: 48, borderRadius: 12,
                border: 'none', cursor: ctxScanning ? 'default' : 'pointer', fontWeight: 600,
                fontSize: fs.msg,
                background: ctxDone
                  ? 'linear-gradient(135deg,#16a34a,#22c55e)'
                  : ctxScanning
                  ? 'linear-gradient(135deg,#1e3a5f,#1e3a5f)'
                  : 'linear-gradient(135deg,#334155,#475569)',
                color: ctxScanning ? '#64748b' : '#fff',
                transition: 'background 300ms',
                opacity: ctxScanning ? 0.7 : 1,
              }}
            >
              {ctxDone ? '✓ Scan complete!' : ctxScanning ? 'Scanning…' : 'Scan Now'}
            </button>
            {ctxError && (
              <p role="alert" style={{ fontSize: fs.ts, color: '#fca5a5', lineHeight: 1.5, marginTop: 10 }}>
                Fox couldn't refresh the computer context. Your previous scan is still available.
              </p>
            )}
          </section>

        </div>
      </div>
    </>
  )
}
