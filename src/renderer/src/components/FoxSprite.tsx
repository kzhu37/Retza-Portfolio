/**
 * FoxSprite — the fox companion character for the overlay window.
 *
 * ─── HOW TO ADD REAL SPRITE ART ───────────────────────────────────────────────
 *
 *  1. Drop your sprite sheet (PNG) into:
 *       src/renderer/src/assets/fox-sprite.png
 *
 *  2. In the SPRITE_CONFIG object below, set:
 *       useSprite: true
 *       sheet:     '/src/assets/fox-sprite.png'   (Vite-served path)
 *       frameW:    <width of one frame in px>
 *       frameH:    <height of one frame in px>
 *
 *  3. For each state in SPRITE_CONFIG.states, set the `frames` array.
 *     Each entry is [column, row] (zero-indexed) in the sprite sheet grid.
 *     Example:  idle: { frames: [[0,0],[1,0],[2,0]], fps: 4 }
 *
 *  4. The <FoxSpriteSheet> sub-component below handles all the CSS animation.
 *     You only need to update this file — OverlayWindow.tsx stays unchanged.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Sprite config (edit this when you have real art) ──────────────────────────

const SPRITE_CONFIG = {
  useSprite: false,           // ← flip to true when sprite sheet is ready
  sheet: '',                  // ← path to sprite sheet PNG
  frameW: 64,                 // ← pixel width of one frame
  frameH: 64,                 // ← pixel height of one frame
  states: {
    idle:    { frames: [[0, 0]] as [number, number][], fps: 4 },
    walking: { frames: [[0, 1]] as [number, number][], fps: 8 },
    talking: { frames: [[0, 2], [1, 2]] as [number, number][], fps: 6 },
    alert:   { frames: [[0, 3]] as [number, number][], fps: 4 },
    happy:   { frames: [[0, 4], [1, 4], [2, 4]] as [number, number][], fps: 8 },
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type FoxState = 'idle' | 'walking' | 'talking' | 'alert' | 'happy'

interface FoxSpriteProps {
  state?: FoxState
  size?: number     // render size in px (the component scales the art up)
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

// ── Placeholder art (pixel-art retro frame) ────────────────────────────────────
// Rendered as a CSS box with a scanline grid overlay — swap out by setting
// SPRITE_CONFIG.useSprite = true and providing the sheet.

const PALETTE = {
  body:       '#f97316',
  bodyLight:  '#fb923c',
  bodyDark:   '#c2410c',
  pixel:      '#1e293b',  // "pixel" border / outline colour
  ear:        '#fcd34d',
  face:       '#fff7ed',
  eye:        '#1e293b',
  nose:       '#dc2626',
  scanline:   'rgba(0,0,0,0.08)',
}

function PlaceholderFox({ size }: { size: number }): JSX.Element {
  const s = size

  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 8 8"
      style={{ imageRendering: 'pixelated', display: 'block' }}
      aria-hidden="true"
    >
      {/* ── Body ── */}
      <rect x="2" y="3" width="4" height="4" fill={PALETTE.body} />
      <rect x="1" y="4" width="1" height="2" fill={PALETTE.bodyLight} />
      <rect x="6" y="4" width="1" height="2" fill={PALETTE.bodyLight} />

      {/* ── Ears ── */}
      <rect x="2" y="1" width="1" height="2" fill={PALETTE.bodyDark} />
      <rect x="5" y="1" width="1" height="2" fill={PALETTE.bodyDark} />
      <rect x="2" y="1" width="1" height="1" fill={PALETTE.ear} />
      <rect x="5" y="1" width="1" height="1" fill={PALETTE.ear} />

      {/* ── Head ── */}
      <rect x="2" y="2" width="4" height="2" fill={PALETTE.face} />

      {/* ── Eyes ── */}
      <rect x="2" y="2" width="1" height="1" fill={PALETTE.eye} />
      <rect x="5" y="2" width="1" height="1" fill={PALETTE.eye} />

      {/* ── Nose ── */}
      <rect x="3" y="3" width="2" height="1" fill={PALETTE.nose} />

      {/* ── Tail ── */}
      <rect x="6" y="5" width="1" height="2" fill={PALETTE.bodyDark} />
      <rect x="7" y="6" width="1" height="1" fill={PALETTE.ear} />

      {/* ── Pixel-art outline ── */}
      <rect x="1" y="3" width="6" height="4" fill="none" stroke={PALETTE.pixel} strokeWidth="0.15" />
      <rect x="2" y="1" width="4" height="5" fill="none" stroke={PALETTE.pixel} strokeWidth="0.08" />

      {/* ── Scanline overlay (retro CRT feel) ── */}
      {Array.from({ length: 4 }).map((_, i) => (
        <rect key={i} x="0" y={i * 2} width="8" height="1" fill={PALETTE.scanline} />
      ))}
    </svg>
  )
}

// ── Sprite-sheet renderer (used when useSprite = true) ────────────────────────

function FoxSpriteSheet({ state, size }: { state: FoxState; size: number }): JSX.Element {
  const cfg = SPRITE_CONFIG.states[state]
  // For now just show first frame; a real implementation would use
  // setInterval + useState to step through cfg.frames at cfg.fps.
  const [col, row] = cfg.frames[0]
  const x = -(col * SPRITE_CONFIG.frameW)
  const y = -(row * SPRITE_CONFIG.frameH)
  const scale = size / SPRITE_CONFIG.frameW

  return (
    <div
      style={{
        width: size,
        height: size,
        overflow: 'hidden',
        imageRendering: 'pixelated',
      }}
    >
      <div
        style={{
          width: SPRITE_CONFIG.frameW,
          height: SPRITE_CONFIG.frameH,
          backgroundImage: `url(${SPRITE_CONFIG.sheet})`,
          backgroundPosition: `${x}px ${y}px`,
          backgroundRepeat: 'no-repeat',
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      />
    </div>
  )
}

// ── CSS keyframes for each state ───────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes fox-idle {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-4px); }
  }
  @keyframes fox-talking {
    0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
    25%       { transform: translateY(-3px) rotate(-4deg) scale(1.05); }
    75%       { transform: translateY(-2px) rotate(4deg) scale(1.04); }
  }
  @keyframes fox-alert {
    0%        { transform: scale(1); }
    20%        { transform: scale(1.35); }
    40%        { transform: scale(1.28) rotate(-6deg); }
    60%        { transform: scale(1.32) rotate(6deg); }
    80%        { transform: scale(1.1) rotate(0deg); }
    100%       { transform: scale(1); }
  }
  @keyframes fox-happy {
    0%, 100%  { transform: translateY(0) scale(1); }
    30%        { transform: translateY(-10px) scale(1.1); }
    60%        { transform: translateY(-6px) scale(1.05); }
  }
  @keyframes fox-walking {
    0%, 100%  { transform: translateX(0); }
    25%        { transform: translateX(2px) translateY(-1px); }
    75%        { transform: translateX(-2px) translateY(-1px); }
  }
`

const STATE_ANIMATION: Record<FoxState, string> = {
  idle:    'fox-idle    2.4s ease-in-out infinite',
  walking: 'fox-walking 0.5s steps(2) infinite',
  talking: 'fox-talking 0.35s ease-in-out infinite',
  alert:   'fox-alert   0.6s ease-out 3',
  happy:   'fox-happy   0.5s ease-in-out 3',
}

// ── Public component ───────────────────────────────────────────────────────────

export default function FoxSprite({
  state = 'idle',
  size = 72,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: FoxSpriteProps): JSX.Element {
  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* Retro pixel-art frame */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Retza — click to open"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.() }}
        style={{
          width: size,
          height: size,
          position: 'relative',
          cursor: onClick ? 'pointer' : 'default',
          animation: STATE_ANIMATION[state],
          // Pixel-perfect rendering
          imageRendering: 'pixelated',
          // Outer retro border — replace with sprite-specific shadow when you have art
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.45)) drop-shadow(0 2px 0 #c2410c)',
        }}
      >
        {SPRITE_CONFIG.useSprite
          ? <FoxSpriteSheet state={state} size={size} />
          : <PlaceholderFox size={size} />
        }

        {/* ── State badge (dev helper, remove when you have real art) ── */}
        {!SPRITE_CONFIG.useSprite && state !== 'idle' && (
          <span
            style={{
              position: 'absolute',
              bottom: -14,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 9,
              fontFamily: 'monospace',
              color: '#fb923c',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            [{state}]
          </span>
        )}
      </div>
    </>
  )
}
