export default function LoadingScreen(): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute', inset: 0, zIndex: 100,
        background: '#0f172a',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 28,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ animation: 'loadPulse 1.8s ease-in-out infinite', transformOrigin: 'center' }}>
        <div style={{
          width: 88, height: 88, borderRadius: 24,
          background: 'linear-gradient(135deg, #f97316, #fb923c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(249,115,22,0.35)',
        }}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 3 L7 8 L4 9 Z" fill="#fff" opacity="0.9" />
            <path d="M20 3 L17 8 L20 9 Z" fill="#fff" opacity="0.9" />
            <ellipse cx="12" cy="13" rx="7" ry="6" fill="#fff" opacity="0.9" />
            <circle cx="9.5" cy="12" r="1.1" fill="#1e293b" />
            <circle cx="14.5" cy="12" r="1.1" fill="#1e293b" />
            <ellipse cx="12" cy="14.5" rx="1.2" ry="0.8" fill="#1e293b" />
            <path d="M10 15.5 Q12 17 14 15.5" stroke="#1e293b" strokeWidth="0.8" fill="none" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
          Retza
        </p>
        <p style={{ fontSize: 15, color: '#64748b' }}>
          Starting up
          <span style={{ display: 'inline-flex', gap: 3, marginLeft: 4, verticalAlign: 'middle' }}>
            {[0, 200, 400].map(delay => (
              <span
                key={delay}
                style={{
                  width: 4, height: 4, borderRadius: '50%', background: '#f97316',
                  display: 'inline-block',
                  animation: `loadDot 1.2s ${delay}ms ease-in-out infinite`,
                  opacity: 0.3,
                }}
              />
            ))}
          </span>
        </p>
      </div>

      <style>{`
        @keyframes loadPulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.07); }
        }
        @keyframes loadDot {
          0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
          40%           { opacity: 1;    transform: translateY(-4px); }
        }
      `}</style>
    </div>
  )
}
