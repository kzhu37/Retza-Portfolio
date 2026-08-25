import { useState, useEffect, useRef } from 'react'
import FoxSprite, { type FoxState } from './FoxSprite'

const TALKING_DURATION_MS = 2000

export default function OverlayWindow(): JSX.Element {
  const [foxState, setFoxState] = useState<FoxState>('idle')
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function transitionTo(next: FoxState, durationMs?: number): void {
    if (returnTimer.current) clearTimeout(returnTimer.current)
    setFoxState(next)
    if (durationMs != null) {
      returnTimer.current = setTimeout(() => setFoxState('idle'), durationMs)
    }
  }

  useEffect(() => {
    const unsubStruggle = window.api.onStruggleDetected(() => {
      transitionTo('alert', 1800)  // 0.6s × 3 repeats = 1.8s
    })

    const unsubResponse = window.api.onFoxResponse(() => {
      transitionTo('talking', TALKING_DURATION_MS)
    })

    const unsubCelebrate = window.api.onFoxCelebrate(() => {
      transitionTo('happy', 1500)
    })

    return () => {
      unsubStruggle()
      unsubResponse()
      unsubCelebrate()
      if (returnTimer.current) clearTimeout(returnTimer.current)
    }
  }, [])

  function handleClick(): void {
    transitionTo('happy', 1500)  // 0.5s × 3 = 1.5s
    window.api.focusMainWindow()
  }

  return (
    <div
      className="w-full h-full flex items-end justify-end"
      style={{ background: 'transparent', padding: '12px 12px 16px 0' }}
    >
      <FoxSprite
        state={foxState}
        size={72}
        onClick={handleClick}
        onMouseEnter={() => window.api.setIgnoreMouseEvents(false)}
        onMouseLeave={() => window.api.setIgnoreMouseEvents(true)}
      />
    </div>
  )
}
