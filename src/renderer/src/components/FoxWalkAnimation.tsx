import { useState, useEffect, useRef } from 'react'
import FoxSprite, { type FoxState } from './FoxSprite'

// Mirror of WALK_HOME_MS in main/index.ts  -  keep in sync.
const FOX_SIZE = 72

interface WalkBeginData {
  startX: number
  startY: number
  targetX: number
  targetY: number
  durationMs: number
}

interface WalkHomeData {
  fromX: number
  fromY: number
  toX: number
  toY: number
  durationMs: number
}

export default function FoxWalkAnimation(): JSX.Element {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const [durationMs, setDurationMs] = useState(800)
  const [foxState, setFoxState] = useState<FoxState>('idle')
  const [flipped, setFlipped] = useState(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearIdleTimer(): void {
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null }
  }

  useEffect(() => {
    if (!window.api?.onFoxWalkBegin) return
    return window.api.onFoxWalkBegin((data: WalkBeginData) => {
      clearIdleTimer()
      setDurationMs(data.durationMs)
      setFoxState('walking')
      setFlipped(data.targetX < data.startX)

      // Step 1: snap to start position with no transition
      setTransitioning(false)
      setPos({ x: data.startX, y: data.startY })

      // Step 2: enable the transition one frame later (DOM commits the snap)
      requestAnimationFrame(() => {
        setTransitioning(true)
        // Step 3: move to target one frame after that (transition fires)
        requestAnimationFrame(() => {
          setPos({ x: data.targetX, y: data.targetY })
        })
      })
    })
  }, [])

  useEffect(() => {
    if (!window.api?.onFoxWalkHome) return
    return window.api.onFoxWalkHome((data: WalkHomeData) => {
      clearIdleTimer()
      setDurationMs(data.durationMs)
      setFoxState('walking')
      setFlipped(data.toX < data.fromX)
      // The target may have moved during UIA revalidation. Snap to the latest
      // point first, then animate home from evidence-backed coordinates.
      setTransitioning(false)
      setPos({ x: data.fromX, y: data.fromY })
      requestAnimationFrame(() => {
        setTransitioning(true)
        requestAnimationFrame(() => setPos({ x: data.toX, y: data.toY }))
      })
      // Return to idle once walk completes
      idleTimerRef.current = setTimeout(() => setFoxState('idle'), data.durationMs + 100)
    })
  }, [])

  useEffect(() => () => clearIdleTimer(), [])

  if (!pos) {
    return <div style={{ width: '100vw', height: '100vh', background: 'transparent' }} />
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent', pointerEvents: 'none' }}>
      {/* Outer div: CSS-transitions the position across the screen */}
      <div
        style={{
          position: 'absolute',
          left: pos.x - FOX_SIZE / 2,
          top: pos.y - FOX_SIZE / 2,
          transition: transitioning
            ? `left ${durationMs}ms ease-in-out, top ${durationMs}ms ease-in-out`
            : 'none',
          // Flip horizontally when walking left; inner FoxSprite animation is unaffected
          transform: flipped ? 'scaleX(-1)' : undefined,
          pointerEvents: 'none',
        }}
      >
        <FoxSprite state={foxState} size={FOX_SIZE} />
      </div>
    </div>
  )
}
