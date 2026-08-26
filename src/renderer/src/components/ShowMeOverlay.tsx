import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ShowMeRenderData } from '../lib/types'

const FADE_IN_MS = 220
const FADE_OUT_MS = 180
const SPOTLIGHT_PADDING = 10

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export default function ShowMeOverlay(): JSX.Element {
  const [data, setData] = useState<ShowMeRenderData | null>(null)
  const [visible, setVisible] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const dismissingRef = useRef(false)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [measuredBubbleHeight, setMeasuredBubbleHeight] = useState(0)

  function dismiss(): void {
    if (dismissingRef.current) return
    dismissingRef.current = true
    setFadingOut(true)
    requestAnimationFrame(() => {
      setVisible(false)
      dismissTimerRef.current = setTimeout(() => {
        setData(null)
        setFadingOut(false)
        dismissingRef.current = false
        dismissTimerRef.current = null
        window.api.dismissShowMe()
      }, FADE_OUT_MS)
    })
  }

  useEffect(() => window.api.onShowMeRender((next) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    dismissTimerRef.current = null
    dismissingRef.current = false
    setFadingOut(false)
    setVisible(false)
    setMeasuredBubbleHeight(0)
    setData(next)
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }), [])

  useEffect(() => window.api.onShowMeTriggerDismiss(dismiss), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
  }, [])

  useLayoutEffect(() => {
    if (!data || !bubbleRef.current) return
    const height = Math.ceil(bubbleRef.current.getBoundingClientRect().height)
    if (height > 0 && height !== measuredBubbleHeight) setMeasuredBubbleHeight(height)
  }, [data, measuredBubbleHeight])

  if (!data) return <div style={{ width: '100vw', height: '100vh', background: 'transparent' }} />

  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const { bounds, hint, action, stepNumber, totalSteps } = data
  const spotlight = {
    x: clamp(bounds.x - SPOTLIGHT_PADDING, 0, viewportWidth),
    y: clamp(bounds.y - SPOTLIGHT_PADDING, 0, viewportHeight),
    width: clamp(bounds.width + SPOTLIGHT_PADDING * 2, 1, viewportWidth),
    height: clamp(bounds.height + SPOTLIGHT_PADDING * 2, 1, viewportHeight),
  }
  spotlight.width = Math.min(spotlight.width, viewportWidth - spotlight.x)
  spotlight.height = Math.min(spotlight.height, viewportHeight - spotlight.y)

  const targetCenterX = bounds.x + bounds.width / 2
  const targetCenterY = bounds.y + bounds.height / 2
  const bubbleWidth = Math.min(360, viewportWidth - 32)
  const estimatedBubbleHeight = stepNumber == null ? 130 : 150
  const bubbleHeight = Math.min(
    measuredBubbleHeight || estimatedBubbleHeight,
    Math.max(1, viewportHeight - 32),
  )
  const gap = 22
  const spaceAbove = spotlight.y - 22
  const spaceBelow = viewportHeight - (spotlight.y + spotlight.height) - 22
  const spaceLeft = spotlight.x - gap
  const spaceRight = viewportWidth - (spotlight.x + spotlight.width) - gap
  type BubbleSide = 'above' | 'below' | 'left' | 'right'
  const bubbleSide: BubbleSide | null = spaceAbove >= bubbleHeight
    ? 'above'
    : spaceBelow >= bubbleHeight
      ? 'below'
      : spaceRight >= bubbleWidth
        ? 'right'
        : spaceLeft >= bubbleWidth
          ? 'left'
          : null
  const bubbleLeft = bubbleSide === 'left'
    ? spotlight.x - gap - bubbleWidth
    : bubbleSide === 'right'
      ? spotlight.x + spotlight.width + gap
      : clamp(targetCenterX - bubbleWidth / 2, 16, viewportWidth - bubbleWidth - 16)
  const bubbleTop = bubbleSide === 'above'
    ? spotlight.y - gap - bubbleHeight
    : bubbleSide === 'below'
      ? spotlight.y + spotlight.height + gap
      : clamp(targetCenterY - bubbleHeight / 2, 16, viewportHeight - bubbleHeight - 16)
  const arrowX = clamp(targetCenterX - bubbleLeft, 28, bubbleWidth - 28)
  const arrowY = clamp(targetCenterY - bubbleTop, 28, bubbleHeight - 28)
  const fontScale = data.textSize === 'xlarge' ? 1.3 : data.textSize === 'large' ? 1.15 : 1

  const actionLabel = action === 'type'
    ? 'Type in the highlighted box'
    : action === 'look'
      ? 'Look at the highlighted item'
      : 'Click the highlighted item'

  return (
    <div
      role="status"
      aria-label={`${actionLabel}: ${hint}`}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        userSelect: 'none',
        fontFamily: "'Inter', system-ui, sans-serif",
        opacity: visible ? 1 : 0,
        transition: `opacity ${fadingOut ? FADE_OUT_MS : FADE_IN_MS}ms ease-${fadingOut ? 'out' : 'in'}`,
      }}
    >
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        <defs>
          <mask id="show-me-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={spotlight.x}
              y={spotlight.y}
              width={spotlight.width}
              height={spotlight.height}
              rx={Math.min(14, spotlight.height / 3)}
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(2,6,23,0.7)" mask="url(#show-me-mask)" />
      </svg>

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: bounds.x,
          top: bounds.y,
          width: bounds.width,
          height: bounds.height,
          minWidth: 2,
          minHeight: 2,
          borderRadius: Math.min(10, bounds.height / 3),
          boxShadow: '0 0 0 3px #fff, 0 0 0 7px #f97316, 0 0 34px 10px rgba(249,115,22,0.65)',
          animation: 'targetPulse 1.5s ease-in-out infinite',
        }}
      />

      {bubbleSide && <div
        ref={bubbleRef}
        style={{
          position: 'absolute',
          left: bubbleLeft,
          top: bubbleTop,
          width: bubbleWidth,
          minHeight: estimatedBubbleHeight,
          maxHeight: viewportHeight - 32,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          background: '#fff',
          border: '2px solid rgba(249,115,22,0.35)',
          borderRadius: 18,
          padding: '16px 22px',
          boxShadow: '0 16px 44px rgba(0,0,0,0.45)',
        }}
      >
        {stepNumber != null && totalSteps != null && (
          <p style={{ fontSize: 11 * fontScale, fontWeight: 800, color: '#ea580c', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Step {stepNumber} of {totalSteps}
          </p>
        )}
        <p style={{ fontSize: 17 * fontScale, fontWeight: 750, color: '#172033', lineHeight: 1.35, margin: '0 0 7px' }}>
          {hint}
        </p>
        <p style={{ fontSize: 13 * fontScale, color: '#475569', lineHeight: 1.4, margin: 0 }}>
          {actionLabel}. The guide will not block your click.
        </p>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: 0,
            height: 0,
            ...(bubbleSide === 'above'
              ? { left: arrowX - 12, bottom: -12, borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderTop: '12px solid white' }
              : bubbleSide === 'below'
                ? { left: arrowX - 12, top: -12, borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderBottom: '12px solid white' }
                : bubbleSide === 'left'
                  ? { top: arrowY - 12, right: -12, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderLeft: '12px solid white' }
                  : { top: arrowY - 12, left: -12, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderRight: '12px solid white' }),
          }}
        />
      </div>}

      <div style={{
        position: 'absolute',
        top: 18,
        right: 18,
        border: '1px solid rgba(255,255,255,0.24)',
        borderRadius: 10,
        padding: '8px 13px',
        background: 'rgba(15,23,42,0.76)',
        color: '#f8fafc',
        fontSize: 13 * fontScale,
      }}>
        Press Esc to close
      </div>

      <style>{`
        @keyframes targetPulse {
          0%, 100% { opacity: 1; filter: brightness(1); }
          50% { opacity: 0.82; filter: brightness(1.18); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition-duration: 0ms !important; }
        }
      `}</style>
    </div>
  )
}
