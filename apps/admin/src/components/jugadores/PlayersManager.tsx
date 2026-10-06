'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle, Ban, Loader2, Search, ShieldOff, Trophy, UserX, X, Plus, RotateCcw,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'
import {
  searchPlayers, getBans, createBan, liftBan,
  type PlayerSearchRow, type PlayerBan,
} from '@/lib/players-admin'
import { Field, inputCls } from '@/components/ui/form'

type Tab = 'buscar' | 'vetados'

export function PlayersManager() {
  const { activeOrg, ready } = useActiveOrganization()
  const [tab, setTab] = useState<Tab>('buscar')

  const [q, setQ] = useState('')
  const [results, setResults] = useState<PlayerSearchRow[] | null>(null)
  const [searching, setSearching] = useState(false)

  const [bans, setBans] = useState<PlayerBan[]>([])
  const [loadingBans, setLoadingBans] = useState(true)
  const [showLifted, setShowLifted] = useState(false)
  const [filtroVetados, setFiltroVetados] = useState('')
  const [creating, setCreating] = useState<null | { docNumber: string; fullName: string }>(null)
  const [error, setError] = useState<string | null>(null)

  const reloadBans = useCallback(async () => {
    if (!activeOrg) return
    setLoadingBans(true)
    try {
      setBans(await getBans(activeOrg.id, showLifted))
    } catch {
      setError('No se pudieron cargar los vetados.')
    } finally {
      setLoadingBans(false)
    }
  }, [activeOrg, showLifted])

  useEffect(() => { if (ready) reloadBans() }, [ready, reloadBans])

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    if (!activeOrg || q.trim().length < 3) return
    setSearching(true)
    setError(null)
    try {
      setResults(await searchPlayers(activeOrg.id, q.trim()))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'No se pudo buscar.')
    } finally {
      setSearching(false)
    }
  }

  if (!ready || !activeOrg) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando…</span>
      </div>
    )
  }

  const vigentes = bans.filter((b) => !b.liftedAt)

  // Filtro por nombre o documento. La cédula se compara solo con dígitos para
  // que dé igual escribirla con puntos.
  const filtroDigitos = filtroVetados.replace(/\D/g, '')
  const bansFiltrados = bans.filter((b) => {
    const q = filtroVetados.trim().toLowerCase()
    if (!q) return true
    if (b.fullName.toLowerCase().includes(q)) return true
    return filtroDigitos.length > 0 && b.docNumber.includes(filtroDigitos)
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Jugadores</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Busca por cédula en todos los torneos de {activeOrg.name} y gestiona los vetados.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1">
        {([
          { key: 'buscar' as Tab, label: 'Buscar jugador', icon: Search },
          { key: 'vetados' as Tab, label: `Vetados${vigentes.length ? ` (${vigentes.length})` : ''}`, icon: Ban },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors',
              tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {tab === 'buscar' && (
        <>
          <form onSubmit={handleSearch} className="mb-5 flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                placeholder="Cédula o nombre (mínimo 3 caracteres)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={searching || q.trim().length < 3}
              className="flex items-center gap-1.5 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              Buscar
            </button>
          </form>

          {results !== null && results.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-16">
              <UserX size={26} className="text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">Sin resultados</p>
              <p className="max-w-sm text-center text-xs text-slate-400">
                Nadie con esa cédula o nombre está inscrito en los torneos de esta organización.
              </p>
            </div>
          )}

          {results !== null && results.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-slate-400">
                {results.length} resultado{results.length === 1 ? '' : 's'} · una fila por equipo
              </p>
              {results.map((r) => (
                <div
                  key={r.registrationPlayerId}
                  className={clsx(
                    'flex items-center gap-3 rounded-xl border bg-white px-4 py-3',
                    r.ban ? 'border-red-200 bg-red-50/40' : 'border-slate-200',
                    !r.active && 'opacity-60',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {[r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.playerName}
                      </p>
                      {r.ban && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                          <Ban size={9} /> VETADO
                        </span>
                      )}
                      {!r.active && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          dado de baja
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {r.docNumber ? `CC ${r.docNumber}` : 'sin cédula'}
                      {r.jerseyNumber != null && ` · dorsal ${r.jerseyNumber}`}
                      {r.email && ` · ${r.email}`}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                      <Trophy size={10} /> {r.teamName} · {r.editionName}
                    </p>
                    {r.ban && (
                      <p className="mt-1 text-[11px] text-red-600">Motivo del veto: {r.ban.reason}</p>
                    )}
                  </div>

                  {!r.ban && r.docNumber && (
                    <button
                      onClick={() =>
                        setCreating({
                          docNumber: r.docNumber!,
                          fullName: [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.playerName,
                        })
                      }
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Ban size={12} /> Vetar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'vetados' && (
        <>
          <div className="mb-3 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
              placeholder="Filtrar por nombre o documento"
              value={filtroVetados}
              onChange={(e) => setFiltroVetados(e.target.value)}
            />
            {filtroVetados && (
              <button
                onClick={() => setFiltroVetados('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Limpiar filtro"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="mb-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={showLifted}
                onChange={(e) => setShowLifted(e.target.checked)}
                className="rounded border-slate-300"
              />
              Incluir vetos levantados
            </label>
            <button
              onClick={() => setCreating({ docNumber: '', fullName: '' })}
              className="flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-green-700"
            >
              <Plus size={13} /> Registrar vetado
            </button>
          </div>

          {loadingBans ? (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Cargando…</span>
            </div>
          ) : bansFiltrados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-16">
              <ShieldOff size={26} className="text-slate-300" />
              <p className="text-sm font-semibold text-slate-500">
                {filtroVetados ? 'Sin coincidencias' : 'No hay jugadores vetados'}
              </p>
              <p className="max-w-sm text-center text-xs text-slate-400">
                {filtroVetados
                  ? 'Ningún vetado coincide con ese nombre o documento.'
                  : 'El veto aplica a toda la organización, en todos sus campeonatos.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtroVetados && (
                <p className="text-xs text-slate-400">
                  {bansFiltrados.length} de {bans.length}
                </p>
              )}
              {bansFiltrados.map((b) => (
                <div
                  key={b.id}
                  className={clsx(
                    'rounded-xl border bg-white px-4 py-3',
                    b.liftedAt ? 'border-slate-200 opacity-60' : 'border-red-200',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{b.fullName}</p>
                        {b.liftedAt ? (
                          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                            LEVANTADO
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-red-200 bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                            <Ban size={9} /> VIGENTE
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">CC {b.docNumber}</p>
                      <p className="mt-1 text-xs text-slate-600">{b.reason}</p>
                      {b.until && (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          Vigente hasta {new Date(b.until).toLocaleDateString('es-CO')}
                        </p>
                      )}
                      {b.liftedReason && (
                        <p className="mt-0.5 text-[11px] text-slate-400">Levantado: {b.liftedReason}</p>
                      )}

                      {/* Lo importante: si está vetado pero sigue en una nómina */}
                      {!b.liftedAt && (b.inRosters?.length ?? 0) > 0 && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                          <p className="text-[11px] font-bold text-amber-800">
                            Está inscrito en {b.inRosters!.length} plantilla{b.inRosters!.length === 1 ? '' : 's'}
                          </p>
                          {b.inRosters!.map((r, i) => (
                            <p key={i} className="text-[11px] text-amber-700">
                              {r.teamName} · {r.editionName}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>

                    {!b.liftedAt && (
                      <button
                        onClick={async () => {
                          const motivo = prompt('¿Por qué se levanta el veto? (opcional)')
                          if (motivo === null) return
                          await liftBan(b.id, activeOrg.id, motivo || undefined)
                          await reloadBans()
                        }}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                      >
                        <RotateCcw size={12} /> Levantar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {creating && (
        <BanDialog
          initial={creating}
          organizationId={activeOrg.id}
          onClose={() => setCreating(null)}
          onDone={async () => {
            setCreating(null)
            setTab('vetados')
            await reloadBans()
            if (results) await handleSearch()
          }}
        />
      )}
    </div>
  )
}

function BanDialog({
  initial, organizationId, onClose, onDone,
}: {
  initial: { docNumber: string; fullName: string }
  organizationId: string
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const [docNumber, setDocNumber] = useState(initial.docNumber)
  const [fullName, setFullName] = useState(initial.fullName)
  const [reason, setReason] = useState('')
  const [until, setUntil] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!docNumber.trim() || !fullName.trim() || !reason.trim()) {
      setError('Cédula, nombre y motivo son obligatorios.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createBan({ organizationId, docNumber, fullName, reason, until: until || null })
      await onDone()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'No se pudo registrar el veto.')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={saving ? undefined : onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <form onSubmit={submit} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-bold text-slate-900">Registrar jugador vetado</h2>
            <button type="button" onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-700">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-4 px-5 py-5">
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
              El veto aplica a <strong>todos los campeonatos</strong> de la organización y no caduca
              al abrir una edición nueva.
            </p>

            <Field label="Cédula">
              <input
                className={inputCls}
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder="1012345678"
                autoFocus={!initial.docNumber}
              />
            </Field>

            <Field label="Nombre completo">
              <input
                className={inputCls}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nombre y apellidos"
              />
            </Field>

            <Field label="Motivo del veto">
              <textarea
                className={clsx(inputCls, 'min-h-[80px] resize-y')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Agresión al árbitro en la fecha 5, suspensión del comité disciplinario…"
              />
            </Field>

            <Field label="Vigente hasta (opcional)">
              <input type="date" className={inputCls} value={until} onChange={(e) => setUntil(e.target.value)} />
              <p className="mt-1 text-[11px] text-slate-400">Déjalo vacío si el veto es indefinido.</p>
            </Field>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                <AlertCircle size={12} /> {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <button
              type="button" onClick={onClose} disabled={saving}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
              Registrar veto
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
