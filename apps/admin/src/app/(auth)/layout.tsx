export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left: Brand panel ─────────────────────────────────── */}
      <div
        className="hidden lg:flex w-[58%] flex-col justify-between p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0d1620 0%, #1B2535 55%, #162030 100%)' }}
      >
        {/* Decorative rings */}
        <div className="absolute -top-24 -right-24 w-[480px] h-[480px] rounded-full border border-white/[0.04]" />
        <div className="absolute -top-40 -right-40 w-[640px] h-[640px] rounded-full border border-white/[0.03]" />
        <div
          className="absolute bottom-0 -left-48 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(22,163,74,0.07) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 right-0 w-64 h-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(22,163,74,0.04) 0%, transparent 70%)' }}
        />

        {/* Football field — decorative */}
        <div className="absolute inset-0 flex items-center justify-end pr-8 pointer-events-none">
          <svg
            viewBox="0 0 420 280"
            className="w-[480px] opacity-[0.035]"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
          >
            <rect x="8" y="8" width="404" height="264" rx="3" />
            <line x1="210" y1="8" x2="210" y2="272" />
            <circle cx="210" cy="140" r="38" />
            <circle cx="210" cy="140" r="2.5" fill="white" />
            {/* Left penalty box */}
            <rect x="8" y="82" width="62" height="116" />
            <rect x="8" y="106" width="28" height="68" />
            {/* Left penalty spot */}
            <circle cx="52" cy="140" r="2" fill="white" />
            {/* Left penalty arc */}
            <path d="M 70 116 A 38 38 0 0 0 70 164" />
            {/* Right penalty box */}
            <rect x="350" y="82" width="62" height="116" />
            <rect x="384" y="106" width="28" height="68" />
            {/* Right penalty spot */}
            <circle cx="368" cy="140" r="2" fill="white" />
            {/* Right penalty arc */}
            <path d="M 350 116 A 38 38 0 0 1 350 164" />
            {/* Goals */}
            <rect x="1" y="114" width="8" height="52" />
            <rect x="411" y="114" width="8" height="52" />
            {/* Corner arcs */}
            <path d="M 8 24 A 16 16 0 0 1 24 8" />
            <path d="M 396 8 A 16 16 0 0 1 412 24" />
            <path d="M 8 256 A 16 16 0 0 0 24 272" />
            <path d="M 396 272 A 16 16 0 0 0 412 256" />
          </svg>
        </div>

        {/* Top: Wordmark */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-black text-base leading-none">M</span>
          </div>
          <div>
            <p className="text-white font-bold text-xl tracking-[0.2em] leading-none">MOVERIX</p>
            <p className="text-slate-500 text-[10px] tracking-widest uppercase mt-0.5">Backoffice Admin</p>
          </div>
        </div>

        {/* Center: Tagline + features */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-[2.6rem] font-bold text-white leading-[1.15] tracking-tight">
              Gestiona tu liga.<br />
              <span className="text-green-400">Domina el juego.</span>
            </h2>
            <p className="text-slate-400 text-[15px] mt-4 leading-relaxed max-w-[300px]">
              La plataforma completa para organizar torneos de fútbol amateur: fixture, grupos, tabla y pagos.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {[
              { icon: '⚽', label: 'Torneos y ligas' },
              { icon: '📊', label: 'Tabla de posiciones automática' },
              { icon: '💳', label: 'Control de pagos e inscripciones' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center text-sm shrink-0">
                  {icon}
                </div>
                <span className="text-slate-400 text-[13px]">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <p className="relative z-10 text-slate-700 text-xs">
          © {new Date().getFullYear()} Moverix · Todos los derechos reservados
        </p>
      </div>

      {/* ── Right: Form panel ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 bg-white">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
            <span className="text-white font-black text-sm">M</span>
          </div>
          <p className="text-slate-900 font-bold text-lg tracking-[0.15em]">MOVERIX</p>
        </div>

        <div className="w-full max-w-[360px]">
          {children}
        </div>
      </div>
    </div>
  )
}
