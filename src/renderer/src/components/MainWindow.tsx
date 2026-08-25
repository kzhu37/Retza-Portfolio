import { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react'
import { useSpeechInput } from '../hooks/useSpeechInput'
import { FONT_SCALE, type TextSize } from '../lib/textSize'
import { type RendererSettings, type SettingsPatch, DEFAULT_SETTINGS, type HistoryEntry, type TargetPayload, type StepPayload } from '../lib/types'
import LoadingScreen from './LoadingScreen'
import SettingsPanel from './SettingsPanel'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: number
  role: 'fox' | 'user'
  text: string
  time: string
  isError?: boolean
  isProactive?: boolean
  target?: TargetPayload
  steps?: StepPayload[]
  clarify?: string
  clarifyOptions?: string[]
}

// ── Text size context ─────────────────────────────────────────────────────────

const TextSizeCtx = createContext<TextSize>('normal')
const useFS = (): typeof FONT_SCALE[TextSize] => FONT_SCALE[useContext(TextSizeCtx)]

// ── Helpers ───────────────────────────────────────────────────────────────────

function timestamp(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function makeId(): number {
  return Date.now() + Math.random()
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function FoxIcon(): JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 3 L7 8 L4 9 Z" fill="#fff" opacity="0.9" />
      <path d="M20 3 L17 8 L20 9 Z" fill="#fff" opacity="0.9" />
      <ellipse cx="12" cy="13" rx="7" ry="6" fill="#fff" opacity="0.9" />
      <circle cx="9.5" cy="12" r="1.1" fill="#1e293b" />
      <circle cx="14.5" cy="12" r="1.1" fill="#1e293b" />
      <ellipse cx="12" cy="14.5" rx="1.2" ry="0.8" fill="#1e293b" />
      <path d="M10 15.5 Q12 17 14 15.5" stroke="#1e293b" strokeWidth="0.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function FoxAvatar(): JSX.Element {
  return (
    <div
      className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center shadow-md"
      style={{ background: 'linear-gradient(135deg, #f97316 0%, #fb923c 60%, #fdba74 100%)' }}
      aria-hidden="true"
    >
      <FoxIcon />
    </div>
  )
}

function WatchingDot({ active }: { active: boolean }): JSX.Element {
  return (
    <span className="relative flex h-3 w-3" aria-hidden="true">
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
          style={{ backgroundColor: '#4ade80' }} />
      )}
      <span className="relative inline-flex rounded-full h-3 w-3"
        style={{ backgroundColor: active ? '#22c55e' : '#6b7280' }} />
    </span>
  )
}

function MicIcon(): JSX.Element {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="9" y1="22" x2="15" y2="22" />
    </svg>
  )
}

function SendIcon(): JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function GearIcon(): JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator(): JSX.Element {
  return (
    <div className="flex items-end gap-3 msg-fox">
      <FoxAvatar />
      <div className="flex items-center gap-1.5 px-5 py-4 rounded-2xl rounded-bl-sm"
        style={{ background: '#1e293b', border: '1.5px solid #334155' }}
        aria-label="Fox is thinking…" role="status">
        {[0, 150, 300].map(delay => (
          <span key={delay} className="block w-2.5 h-2.5 rounded-full"
            style={{ background: '#f97316', animation: `foxBounce 1.1s ${delay}ms infinite`, opacity: 0.85 }} />
        ))}
      </div>
    </div>
  )
}

// ── Message bubbles ───────────────────────────────────────────────────────────

function ShowMeButton({
  target,
  stepNumber,
  totalSteps,
  label = 'Show me where',
}: {
  target: TargetPayload
  stepNumber?: number
  totalSteps?: number
  label?: string
}): JSX.Element {
  const fs = useFS()
  const [locating, setLocating] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function handleShowMe(event: React.MouseEvent<HTMLButtonElement>): Promise<void> {
    event.stopPropagation()
    if (locating) return
    setLocating(true)
    setFailure(null)
    try {
      const result = await window.api.showMe(target, stepNumber, totalSteps)
      if (!result.ok) setFailure(result.message)
    } catch {
      setFailure("I couldn't start the screen guide. Please try again.")
    } finally {
      setLocating(false)
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5 }}>
      <button
        onClick={handleShowMe}
        disabled={locating}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: locating ? 'rgba(100,116,139,0.14)' : 'rgba(249,115,22,0.1)',
          border: `1px solid ${locating ? 'rgba(100,116,139,0.35)' : 'rgba(249,115,22,0.35)'}`,
          color: locating ? '#94a3b8' : '#fb923c', borderRadius: 999,
          padding: '4px 13px', fontSize: fs.ts, fontWeight: 650,
          cursor: locating ? 'wait' : 'pointer', lineHeight: 1.5,
        }}
        aria-label="Locate this item on the current screen"
        aria-busy={locating}
      >
        <span aria-hidden="true">{locating ? '⌛' : '⌖'}</span>
        {locating ? 'Locating…' : label}
      </button>
      {failure && (
        <span role="alert" style={{ color: '#fbbf24', fontSize: fs.ts, lineHeight: 1.4, maxWidth: 360 }}>
          {failure}
        </span>
      )}
    </span>
  )
}

function FoxMessage({ msg }: { msg: Message }): JSX.Element {
  const fs = useFS()
  const bg = msg.isError
    ? 'linear-gradient(135deg, #3b1a1a, #2d1515)'
    : msg.isProactive
    ? 'linear-gradient(135deg, #292010, #221c0e)'
    : 'linear-gradient(135deg, #1e293b, #1a2744)'
  const border = msg.isError ? '#7f1d1d' : msg.isProactive ? '#92400e' : '#334155'
  const textColor = msg.isError ? '#fca5a5' : msg.isProactive ? '#fde68a' : '#e2e8f0'

  return (
    <div className="flex items-end gap-3 max-w-[82%] msg-fox">
      <FoxAvatar />
      <div>
        {msg.isProactive && (
          <p style={{ fontSize: fs.ts, color: '#f59e0b', marginBottom: 4, paddingLeft: 4, fontWeight: 600 }}>
            Fox noticed something
          </p>
        )}
        <div className="rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm"
          style={{ background: bg, border: `1.5px solid ${border}` }}>
          <p style={{ fontSize: fs.msg, lineHeight: 1.65, color: textColor, margin: 0 }}>
            {msg.text}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, paddingLeft: 4 }}>
          <p style={{ fontSize: fs.ts, color: '#475569', margin: 0 }}>
            Fox · {msg.time}
          </p>
          {msg.target?.zone !== 'none' && msg.target && <ShowMeButton target={msg.target} />}
        </div>
      </div>
    </div>
  )
}

type WalkthroughPhase = 'preview' | 'active' | 'summarizing' | 'complete' | 'abandoned'

function FoxStepMessage({ msg, onSendMessage: _onSendMessage }: { msg: Message; onSendMessage: (text: string) => void }): JSX.Element {
  const fs = useFS()
  const [steps] = useState<StepPayload[]>(msg.steps!)
  const [phase, setPhase] = useState<WalkthroughPhase>('preview')
  const [activeStep, setActiveStep] = useState(0)
  const [summary, setSummary] = useState<string | null>(null)

  const totalSteps = steps.length

  async function startWalkthrough(): Promise<void> {
    setActiveStep(0)
    setPhase('active')
  }

  async function handleNext(): Promise<void> {
    if (activeStep < steps.length - 1) {
      setActiveStep(s => s + 1)
    } else {
      setPhase('summarizing')
      window.api.foxCelebrate()
      try {
        const result = await window.api.walkthroughSummary(msg.text || 'the task')
        setSummary(result.text)
      } catch {
        setSummary('Great job! You completed every step. You can always ask me to guide you through it again.')
      } finally {
        setPhase('complete')
      }
    }
  }

  function abandon(): void {
    setPhase('abandoned')
  }

  const ts = { fontSize: fs.ts, color: '#475569', marginTop: 4, paddingLeft: 4 }

  // ── Abandoned ──────────────────────────────────────────────────────────────
  if (phase === 'abandoned') {
    return (
      <div className="flex items-end gap-3 max-w-[82%] msg-fox">
        <FoxAvatar />
        <div>
          <div className="rounded-2xl rounded-bl-sm px-5 py-4" style={{ background: 'linear-gradient(135deg, #1e293b, #1a2744)', border: '1.5px solid #334155' }}>
            <p style={{ fontSize: fs.msg, color: '#e2e8f0', margin: 0, lineHeight: 1.65 }}>
              No problem! Let me know if you'd like to try again.
            </p>
          </div>
          <p style={ts}>Fox · {msg.time}</p>
        </div>
      </div>
    )
  }

  // ── Complete / Summarising ─────────────────────────────────────────────────
  if (phase === 'summarizing' || phase === 'complete') {
    return (
      <div className="flex items-end gap-3 max-w-[82%] msg-fox">
        <FoxAvatar />
        <div>
          <div className="rounded-2xl rounded-bl-sm px-5 py-4" style={{ background: 'linear-gradient(135deg, #14532d, #166534)', border: '1.5px solid #22c55e' }}>
            {phase === 'summarizing' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {[0, 150, 300].map(d => (
                  <span key={d} className="block w-2 h-2 rounded-full"
                    style={{ background: '#86efac', animation: `foxBounce 1.1s ${d}ms infinite` }} />
                ))}
                <p style={{ fontSize: fs.msg, color: '#86efac', margin: 0 }}>Almost done…</p>
              </div>
            ) : (
              <p style={{ fontSize: fs.msg, color: '#86efac', margin: 0, lineHeight: 1.65 }}>{summary}</p>
            )}
          </div>
          <p style={ts}>Fox · {msg.time}</p>
        </div>
      </div>
    )
  }

  // ── Preview ────────────────────────────────────────────────────────────────
  if (phase === 'preview') {
    return (
      <div className="flex items-end gap-3 max-w-[88%] msg-fox">
        <FoxAvatar />
        <div>
          <div className="rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm" style={{ background: 'linear-gradient(135deg, #1e293b, #1a2744)', border: '1.5px solid #334155' }}>
            {msg.text && (
              <p style={{ fontSize: fs.msg, lineHeight: 1.65, color: '#e2e8f0', margin: '0 0 12px' }}>
                {msg.text}
              </p>
            )}
            <p style={{ fontSize: fs.badge, color: '#64748b', margin: '0 0 10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Here's the plan — {totalSteps} step{totalSteps !== 1 ? 's' : ''}:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {steps.map((s, i) => (
                <div key={s.stepNumber} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                    background: s.prereq ? 'rgba(249,115,22,0.15)' : '#1e293b',
                    border: `1.5px solid ${s.prereq ? 'rgba(249,115,22,0.4)' : '#475569'}`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: s.prereq ? '#fb923c' : '#94a3b8',
                    marginTop: 1,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: fs.ts, color: s.prereq ? '#fdba74' : '#cbd5e1', lineHeight: 1.5 }}>
                    {s.instruction.length > 90 ? s.instruction.slice(0, 87) + '…' : s.instruction}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={startWalkthrough}
            style={{
              marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg, #f97316, #fb923c)',
              border: 'none', borderRadius: 999, color: '#fff',
              padding: '9px 22px', fontSize: fs.ts, fontWeight: 700, cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.87' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
          >
            Start Walkthrough →
          </button>
          <p style={ts}>Fox · {msg.time}</p>
        </div>
      </div>
    )
  }

  // ── Active ─────────────────────────────────────────────────────────────────
  const step = steps[activeStep]
  return (
    <div className="flex items-end gap-3 max-w-[88%] msg-fox">
      <FoxAvatar />
      <div style={{ flex: 1 }}>

        {/* Progress dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, paddingLeft: 2 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i === activeStep ? 18 : 8,
              height: 8, borderRadius: 4,
              background: i < activeStep ? '#22c55e' : i === activeStep ? '#f97316' : '#334155',
              transition: 'width 250ms, background 250ms',
            }} />
          ))}
          <span style={{ fontSize: fs.badge, color: '#64748b', marginLeft: 6, fontWeight: 600 }}>
            {activeStep + 1} / {totalSteps}
          </span>
        </div>

        {/* Current step card */}
        <div style={{
          borderRadius: 18, padding: '14px 16px',
          background: 'linear-gradient(135deg, #1e3a5f, #1e2d4a)',
          border: '1.5px solid #3b82f6',
        }}>
          {step.prereq && (
            <p style={{ fontSize: fs.badge, color: '#fb923c', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Setup step
            </p>
          )}
          <p style={{ fontSize: fs.msg, color: '#e2e8f0', margin: 0, lineHeight: 1.6 }}>
            {step.instruction}
          </p>
          {step.target.zone !== 'none' && (
            <div style={{ marginTop: 10 }}>
              <ShowMeButton
                target={step.target}
                stepNumber={activeStep + 1}
                totalSteps={totalSteps}
                label="Show me"
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
          <button
            onClick={handleNext}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'linear-gradient(135deg, #f97316, #fb923c)',
              border: 'none', borderRadius: 999, color: '#fff',
              padding: '7px 20px', fontSize: fs.ts, fontWeight: 700, cursor: 'pointer',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.87' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
          >
            {activeStep < steps.length - 1 ? 'Done, next step →' : "I'm done! 🎉"}
          </button>
          <button
            onClick={abandon}
            style={{ background: 'none', border: 'none', color: '#475569', fontSize: fs.ts, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Abandon
          </button>
        </div>

        <p style={{ fontSize: fs.ts, color: '#475569', marginTop: 6, paddingLeft: 2 }}>
          Fox · {msg.time}
        </p>
      </div>
    </div>
  )
}

function FoxClarifyMessage({ msg, onSendMessage }: { msg: Message; onSendMessage: (text: string) => void }): JSX.Element {
  const fs = useFS()

  return (
    <div className="flex items-end gap-3 max-w-[82%] msg-fox">
      <FoxAvatar />
      <div>
        <div className="rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm" style={{
          background: 'linear-gradient(135deg, #1e293b, #1a2744)',
          border: '1.5px solid #334155',
        }}>
          <p style={{ fontSize: fs.msg, lineHeight: 1.65, color: '#e2e8f0', margin: 0 }}>
            {msg.clarify}
          </p>
          {msg.clarifyOptions && msg.clarifyOptions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {msg.clarifyOptions.map(opt => (
                <button
                  key={opt}
                  onClick={() => onSendMessage(opt)}
                  style={{
                    background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.35)',
                    color: '#fb923c', borderRadius: 999, padding: '5px 16px',
                    fontSize: fs.ts, fontWeight: 600, cursor: 'pointer',
                    transition: 'background 150ms',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(249,115,22,0.2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(249,115,22,0.1)' }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
        <p style={{ fontSize: fs.ts, color: '#475569', marginTop: 4, paddingLeft: 4 }}>
          Fox · {msg.time}
        </p>
      </div>
    </div>
  )
}

function UserMessage({ msg }: { msg: Message }): JSX.Element {
  const fs = useFS()
  return (
    <div className="flex flex-col items-end msg-user">
      <div className="max-w-[78%] rounded-2xl rounded-br-sm px-5 py-4 shadow-sm"
        style={{
          background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
          border: '1.5px solid rgba(96,165,250,0.25)'
        }}>
        <p style={{ fontSize: fs.msg, lineHeight: 1.65, color: '#eff6ff', margin: 0 }}>{msg.text}</p>
      </div>
      <p style={{ fontSize: fs.ts, color: '#475569', marginTop: 4, paddingRight: 4 }}>
        You · {msg.time}
      </p>
    </div>
  )
}

// ── Mic button ────────────────────────────────────────────────────────────────

type SpeechState = 'idle' | 'listening' | 'unsupported'

function MicButton({ state, onToggle, disabled }: {
  state: SpeechState; onToggle: () => void; disabled: boolean
}): JSX.Element {
  const fs = useFS()
  const isListening = state === 'listening'
  const isUnsupported = state === 'unsupported'

  return (
    <button
      onClick={onToggle}
      disabled={isUnsupported || disabled}
      className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 active:scale-95"
      style={{
        width: 56, height: 56,
        background: isListening ? '#7f1d1d' : '#0f172a',
        border: `1.5px solid ${isListening ? '#ef4444' : isUnsupported ? '#1e293b' : '#334155'}`,
        color: isListening ? '#fca5a5' : isUnsupported ? '#374151' : '#94a3b8',
        cursor: isUnsupported || disabled ? 'default' : 'pointer',
        animation: isListening ? 'micPulse 1.4s ease-in-out infinite' : 'none',
        opacity: isUnsupported ? 0.4 : 1,
      }}
      aria-label={isListening ? 'Stop listening' : isUnsupported ? 'Voice input not available' : 'Start voice input'}
      aria-pressed={isListening}
    >
      <MicIcon />
      {isListening && (
        <span style={{ fontSize: fs.badge, fontWeight: 700, letterSpacing: '0.05em', marginTop: 1, color: '#fca5a5' }}>
          LIVE
        </span>
      )}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const WELCOME: Message = {
  id: 1, role: 'fox',
  text: "Hello! I'm Fox, your friendly computer helper. I'm here whenever you need a hand — just type your question below!",
  time: timestamp()
}

export default function MainWindow(): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const historyRef = useRef<HistoryEntry[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [settings, setSettings] = useState<RendererSettings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [appLoading, setAppLoading] = useState(true)
  const [loadFading, setLoadFading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const appContentRef = useRef<HTMLDivElement>(null)
  const sendMessageRef = useRef<(text: string) => void>(() => {})

  const { state: speechState, toggle: toggleSpeech } = useSpeechInput(
    useCallback((transcript: string) => sendMessageRef.current(transcript), [])
  )

  // ── Load settings on mount ────────────────────────────────────────────────

  useEffect(() => {
    let disposed = false
    let fadeTimer: ReturnType<typeof setTimeout> | null = null
    const load = async (): Promise<void> => {
      try {
        const [, loaded] = await Promise.all([
          new Promise<void>(resolve => setTimeout(resolve, 650)),
          window.api.getSettings(),
        ])
        if (!disposed) setSettings(loaded)
      } catch {
        if (!disposed) {
          setMessages(previous => [...previous, {
            id: makeId(), role: 'fox', time: timestamp(), isError: true,
            text: "I couldn't load your saved settings, so I'm using the safe defaults for now.",
          }])
        }
      } finally {
        if (!disposed) {
          setLoadFading(true)
          fadeTimer = setTimeout(() => setAppLoading(false), 350)
        }
      }
    }
    void load()
    return () => {
      disposed = true
      if (fadeTimer) clearTimeout(fadeTimer)
    }
  }, [])

  // ── Struggle detection ────────────────────────────────────────────────────

  useEffect(() => {
    return window.api.onStruggleDetected(() => {
      setMessages(prev => [...prev, {
        id: makeId(), role: 'fox',
        text: "Looks like you might be stuck — need some help? Just type or ask me anything!",
        time: timestamp(), isProactive: true
      }])
    })
  }, [])

  useEffect(() => {
    return window.api.onShowMeInvalidated((message) => {
      setMessages(prev => [...prev, {
        id: makeId(),
        role: 'fox',
        text: message,
        time: timestamp(),
        isError: true,
      }])
    })
  }, [])

  useEffect(() => {
    const content = appContentRef.current
    if (!content) return
    if (showSettings) content.setAttribute('inert', '')
    else content.removeAttribute('inert')
  }, [showSettings])

  // ── Scroll to bottom ──────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim()
    if (!text || isLoading) return

    setMessages(prev => [...prev, { id: makeId(), role: 'user', text, time: timestamp() }])
    if (!textOverride) setInput('')
    setIsLoading(true)

    const historySnapshot = historyRef.current.slice(-16)
    try {
      const result = await window.api.geminiChat(text, historySnapshot)

    if (result.ok) {
      const nextHistory: HistoryEntry[] = [
        ...historySnapshot,
        { role: 'user', text },
        { role: 'model', text: result.historyText ?? result.text }
      ]
      historyRef.current = nextHistory.slice(-20)
      setMessages(prev => [...prev, {
        id: makeId(), role: 'fox', text: result.text, time: timestamp(),
        target: result.target,
        steps: result.steps,
        clarify: result.clarify,
        clarifyOptions: result.clarifyOptions,
      }])
    } else {
      const errorText = result.code === 'api_key_missing'
        ? "I can't connect yet — please add your Gemini API key in Settings (the gear button)."
        : result.code === 'timeout'
          ? 'That request took too long. Please check your connection and try once more.'
          : result.code === 'network'
            ? "I couldn't reach the assistant service. Check your internet connection, then try again."
            : result.code === 'invalid_response'
              ? "I couldn't safely interpret that answer, so I haven't guessed. Please reword the question."
              : 'The assistant service is unavailable right now. Please try again in a moment.'
      setMessages(prev => [...prev, {
        id: makeId(), role: 'fox', time: timestamp(), isError: true,
        text: errorText,
      }])
    }

    } catch {
      setMessages(prev => [...prev, {
        id: makeId(), role: 'fox', time: timestamp(), isError: true,
        text: "Something interrupted that request. You're not stuck — please try it again.",
      }])
    } finally {
      setIsLoading(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [input, isLoading])

  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  // ── Settings change handler ───────────────────────────────────────────────

  async function handleSettingsChange(patch: SettingsPatch): Promise<boolean> {
    try {
      const updated = await window.api.saveSettings(patch)
      setSettings(updated)
      return true
    } catch {
      setMessages(previous => [...previous, {
        id: makeId(), role: 'fox', time: timestamp(), isError: true,
        text: "I couldn't save that setting. Your previous setting is still in place.",
      }])
      return false
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const canSend = input.trim().length > 0 && !isLoading
  const fs = FONT_SCALE[settings.textSize]

  return (
    <TextSizeCtx.Provider value={settings.textSize}>
      <div
        className="flex flex-col h-screen"
        style={{ background: '#0f172a', color: '#f1f5f9', fontFamily: "'Inter', system-ui, sans-serif", position: 'relative', overflow: 'hidden' }}
      >
        <div
          ref={appContentRef}
          className="flex flex-col h-full"
          aria-hidden={showSettings}
        >

        {/* ── Loading overlay ── */}
        {appLoading && (
          <div style={{ opacity: loadFading ? 0 : 1, transition: 'opacity 350ms ease-out', position: 'absolute', inset: 0, zIndex: 100 }}>
            <LoadingScreen />
          </div>
        )}

        {/* ── Top bar ── */}
        <header
          className="flex-shrink-0 flex items-center justify-between px-6"
          style={{ height: 68, background: 'linear-gradient(90deg, #1e293b 0%, #1a2744 100%)', borderBottom: '1.5px solid #334155' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}>
              <FoxIcon />
            </div>
            <div>
              <h1 style={{ fontSize: fs.heading, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                Retza
              </h1>
              <p style={{ fontSize: fs.sub, color: '#94a3b8', lineHeight: 1 }}>Your friendly computer helper</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Watching toggle */}
            <button
              onClick={() => { void handleSettingsChange({ struggleDetection: !settings.struggleDetection }) }}
              className="flex items-center gap-2.5 rounded-full px-4 cursor-pointer transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              style={{
                height: 40,
                background: settings.struggleDetection ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.18)',
                border: `1.5px solid ${settings.struggleDetection ? 'rgba(34,197,94,0.35)' : 'rgba(100,116,139,0.35)'}`,
                color: settings.struggleDetection ? '#86efac' : '#94a3b8',
                fontSize: fs.ts, fontWeight: 600,
              }}
              aria-pressed={settings.struggleDetection}
              aria-label={settings.struggleDetection ? 'Watching for help opportunities — click to pause' : 'Paused — click to resume watching'}
            >
              <WatchingDot active={settings.struggleDetection} />
              <span>{settings.struggleDetection ? 'Watching' : 'Paused'}</span>
            </button>

            {/* Settings gear */}
            <button
              onClick={() => setShowSettings(s => !s)}
              className="flex items-center justify-center rounded-xl cursor-pointer transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              style={{
                width: 40, height: 40,
                background: showSettings ? 'rgba(249,115,22,0.15)' : '#0f172a',
                border: `1.5px solid ${showSettings ? '#f97316' : '#334155'}`,
                color: showSettings ? '#f97316' : '#64748b',
              }}
              aria-label="Open settings"
              aria-expanded={showSettings}
            >
              <GearIcon />
            </button>
          </div>
        </header>

        {/* ── Chat area ── */}
        <main
          className="flex-1 overflow-y-auto px-5 py-6 space-y-5"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#334155 transparent' }}
          aria-live="polite"
          aria-label="Conversation with Fox"
        >
          {messages.map(msg =>
            msg.role === 'user'
              ? <UserMessage key={msg.id} msg={msg} />
              : msg.steps?.length
              ? <FoxStepMessage key={msg.id} msg={msg} onSendMessage={(t) => sendMessageRef.current(t)} />
              : msg.clarify
              ? <FoxClarifyMessage key={msg.id} msg={msg} onSendMessage={(t) => sendMessageRef.current(t)} />
              : <FoxMessage key={msg.id} msg={msg} />
          )}
          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} />
        </main>

        {/* ── Input bar ── */}
        <footer
          className="flex-shrink-0 px-5 py-4"
          style={{ background: '#1e293b', borderTop: '1.5px solid #334155' }}
        >
          <div className="flex items-end gap-3">
            <MicButton state={speechState} onToggle={toggleSpeech} disabled={isLoading} />

            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder={isLoading ? 'Fox is thinking…' : 'Type your question here…'}
              rows={1}
              className="flex-1 rounded-2xl resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 transition-all duration-150 placeholder-slate-500"
              style={{
                background: '#0f172a', border: '1.5px solid #334155',
                color: '#f1f5f9', fontSize: fs.input, lineHeight: 1.5,
                padding: '14px 20px', maxHeight: 140,
                overflowY: 'auto', scrollbarWidth: 'none',
                opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'default' : 'text',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#f97316' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#334155' }}
              aria-label="Type your message"
            />

            <button
              onClick={() => sendMessage()}
              disabled={!canSend}
              className="flex-shrink-0 flex items-center justify-center rounded-2xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 active:scale-95"
              style={{
                width: 56, height: 56,
                background: canSend ? 'linear-gradient(135deg, #f97316, #fb923c)' : '#1e3a5f',
                border: 'none', color: canSend ? '#fff' : '#475569',
                cursor: canSend ? 'pointer' : 'default',
              }}
              aria-label="Send message"
            >
              <SendIcon />
            </button>
          </div>

          <p style={{ fontSize: fs.hint, color: '#475569', marginTop: 8, textAlign: 'center' }}>
            {speechState === 'unsupported'
              ? "Voice input isn't available on your system, but you can still type!"
              : speechState === 'listening'
              ? 'Listening… speak now, then stop talking to send'
              : <>
                  Press{' '}
                  <kbd style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', fontSize: fs.kbd }}>Enter</kbd>
                  {' '}to send &nbsp;·&nbsp;{' '}
                  <kbd style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 4, padding: '1px 5px', fontFamily: 'monospace', fontSize: fs.kbd }}>Shift+Enter</kbd>
                  {' '}for new line
                </>
            }
          </p>
        </footer>
        </div>

        {/* ── Settings drawer ── */}
        <SettingsPanel
          open={showSettings}
          settings={settings}
          onClose={() => setShowSettings(false)}
          onChange={handleSettingsChange}
          onRefreshContext={() => window.api.refreshSystemContext()}
        />

        <style>{`
          @keyframes foxBounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.85; }
            40%           { transform: translateY(-6px); opacity: 1; }
          }
          @keyframes micPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
            50%       { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
          }
        `}</style>
      </div>
    </TextSizeCtx.Provider>
  )
}
