'use client'

import { useEffect, useRef, useState } from 'react'
import { UserCog, X, Search, Loader2, Plus, Mail, Clock } from 'lucide-react'
import {
  getMatchDelegates, searchUsers, assignDelegate, removeDelegate,
  inviteDelegate, getMyDelegates, getDelegateStaff,
  DELEGATE_ROLES, roleLabel,
  type MatchDelegate, type UserSearchResult, type SavedDelegate, type StaffMember,
} from '@/lib/match-delegates'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Asigna/quita delegados de juego a un partido. */
export function DelegatePicker({ matchId }: { matchId: string }) {
  const [delegates, setDelegates] = useState<MatchDelegate[]>([])
  const [saved, setSaved] = useState<SavedDelegate[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  // Puesto en la terna con el que se asignará la próxima persona.
  const [role, setRole] = useState<string>('delegate')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function load() {
    try {
      const [d, s, st] = await Promise.all([
        getMatchDelegates(matchId),
        getMyDelegates().catch(() => []),
        getDelegateStaff(matchId).catch(() => []),
      ])
      setDelegates(d)
      setSaved(s)
      setStaff(st)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [matchId])

  // Busca por nombre/usuario; si escribieron un correo no se busca, se invita.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2 || EMAIL_RE.test(q.trim())) { setResults([]); return }
    setSearching(true)
    timer.current = setTimeout(async () => {
      try { setResults(await searchUsers(q)) } finally { setSearching(false) }
    }, 350)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [q])

  const isEmail = EMAIL_RE.test(q.trim())
  // Ya asignados a este partido: no se ofrecen de nuevo.
  const assignedKeys = new Set(
    delegates.map((d) => d.uid ?? `email:${(d.pendingEmail ?? '').toLowerCase()}`),
  )
  const suggestions = saved.filter(
    (s) => !assignedKeys.has(s.uid ?? `email:${(s.email ?? '').toLowerCase()}`),
  )

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setAdding(false); setQ(''); setName(''); setResults([])
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'No se pudo asignar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog size={15} className="text-slate-500" />
          <span className="text-sm font-bold text-slate-800">Terna y delegado</span>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs font-semibold text-green-700 hover:text-green-800">
            <Plus size={13} /> Asignar
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-1 text-xs text-slate-400">
          <Loader2 size={12} className="animate-spin" /> Cargando…
        </div>
      ) : delegates.length === 0 && !adding ? (
        <p className="text-xs text-slate-400">
          Sin delegado asignado. Podrá registrar el partido desde futbol.moverix.co/dirigir
        </p>
      ) : (
        <div className="space-y-1.5">
          {delegates.map((d) => (
            <div key={d.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${d.uid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {(d.fullName ?? d.invitedName ?? d.pendingEmail ?? '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-800">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-slate-500">
                    {roleLabel(d.role)}
                  </span>
                  <span className="truncate">
                    {d.fullName ?? d.invitedName ?? d.pendingEmail ?? '(sin nombre)'}
                  </span>
                </p>
                {d.uid ? (
                  d.username && <p className="text-[11px] text-slate-400">@{d.username}</p>
                ) : (
                  <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                    <Clock size={10} /> Pendiente · se activa cuando se registre
                  </p>
                )}
              </div>
              <button onClick={() => run(() => removeDelegate(d.id))} className="text-slate-300 hover:text-red-500" title="Quitar">
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-2">
          {/* Puesto en la terna. Los ya ocupados quedan deshabilitados. */}
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Puesto</p>
          <div className="mb-2 flex flex-wrap gap-1">
            {DELEGATE_ROLES.map((r) => {
              const taken = r.value !== 'delegate' && delegates.some((d) => d.role === r.value)
              return (
                <button
                  key={r.value}
                  type="button"
                  disabled={taken}
                  onClick={() => setRole(r.value)}
                  title={taken ? 'Ya asignado en este partido' : r.label}
                  className={
                    'rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ' +
                    (taken
                      ? 'cursor-not-allowed border-slate-100 text-slate-300'
                      : role === r.value
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300')
                  }
                >
                  {r.label}
                </button>
              )
            })}
          </div>
          {/* Directorio de la organización: creados en Árbitros. */}
          {staff.length > 0 && !q && (
            <div className="mb-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tus delegados
              </p>
              <div className="flex flex-wrap gap-1.5">
                {staff
                  .filter((m) => !m.email || !assignedKeys.has(`email:${m.email.toLowerCase()}`))
                  .map((m) => (
                    <button
                      key={m.id}
                      disabled={busy || !m.email}
                      title={m.email ? `Asignar a ${m.fullName}` : 'Sin correo: edítalo en Árbitros para poder asignarlo'}
                      onClick={() => run(() => inviteDelegate(matchId, m.email!, m.fullName, role))}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-green-400 hover:bg-green-50 disabled:opacity-40"
                    >
                      <span className="h-4 w-4 rounded-full bg-green-100 text-[9px] font-bold leading-4 text-green-700">
                        {m.fullName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="max-w-[130px] truncate">{m.fullName}</span>
                    </button>
                  ))}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                ¿Falta alguien? Créalo en <a href="/arbitros" className="font-semibold text-green-700 hover:underline">Árbitros</a>.
              </p>
            </div>
          )}

          {/* Usados antes en otros partidos. */}
          {suggestions.length > 0 && !q && staff.length === 0 && (
            <div className="mb-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Usados antes</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.slice(0, 8).map((s) => (
                  <button
                    key={s.uid ?? s.email}
                    disabled={busy}
                    onClick={() =>
                      run(() => (s.uid ? assignDelegate(matchId, s.uid, role) : inviteDelegate(matchId, s.email!, s.name, role)))
                    }
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-green-400 hover:bg-green-50 disabled:opacity-50"
                  >
                    <span className={`h-4 w-4 rounded-full text-[9px] font-bold leading-4 ${s.pending ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                      {s.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="max-w-[130px] truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5">
            {isEmail ? <Mail size={14} className="text-slate-400" /> : <Search size={14} className="text-slate-400" />}
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, @usuario o correo…"
              className="flex-1 text-sm outline-none"
            />
            {searching && <Loader2 size={13} className="animate-spin text-slate-400" />}
            <button onClick={() => { setAdding(false); setQ(''); setName(''); setResults([]) }} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>

          {/* Con un correo se puede invitar aunque no tenga cuenta todavía. */}
          {isEmail && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del delegado (opcional)"
                className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-green-400"
              />
              <button
                disabled={busy}
                onClick={() => run(() => inviteDelegate(matchId, q.trim(), name.trim() || undefined, role))}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-green-600 py-2 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                Invitar a {q.trim()}
              </button>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Si aún no tiene cuenta, queda pendiente y se activa sola cuando se registre con ese correo.
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-1 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              {results.map((u) => (
                <button
                  key={u.uid}
                  disabled={busy}
                  onClick={() => run(() => assignDelegate(matchId, u.uid, role))}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                    {(u.fullName ?? u.username).slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{u.fullName}</p>
                    <p className="text-[11px] text-slate-400">@{u.username}</p>
                  </div>
                  <Plus size={14} className="text-green-600" />
                </button>
              ))}
            </div>
          )}

          {q.trim().length >= 2 && !isEmail && !searching && results.length === 0 && (
            <p className="mt-1 px-1 text-xs text-slate-400">
              Sin resultados para “{q}”. Escribe su correo para invitarlo aunque no tenga cuenta.
            </p>
          )}

          {error && <p className="mt-1 px-1 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
