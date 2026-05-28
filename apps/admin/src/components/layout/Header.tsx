'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Check, ChevronDown, Loader2, Search, Trophy } from 'lucide-react'
import { clsx } from 'clsx'
import {
  getLeaguesByOrg,
  getEditionsByLeague,
  type EditionFromApi,
  type LeagueFromApi,
} from '@/lib/leagues'
import { useActiveEdition } from '@/contexts/ActiveEditionContext'
import { useActiveOrganization } from '@/contexts/ActiveOrganizationContext'

type EditionWithLeague = EditionFromApi & { leagueName: string }

const MANAGEABLE_STATUSES: EditionFromApi['status'][] = ['active', 'registration']

export function Header() {
  const { activeEdition, setActiveEdition, ready } = useActiveEdition()
  const { activeOrg } = useActiveOrganization()
  const [editions, setEditions] = useState<EditionWithLeague[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const activeEditionRef = useRef(activeEdition)
  activeEditionRef.current = activeEdition

  // Load editions for active org and auto-select first one if none is set
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setEditions([])
      try {
        if (!activeOrg) return
        const leagues = await getLeaguesByOrg(activeOrg.id)
        const all = await Promise.all(
          leagues.map(async (l: LeagueFromApi) => {
            const eds = await getEditionsByLeague(l.id)
            return eds.map((ed) => ({ ...ed, leagueName: l.name }))
          }),
        )
        const flat = all.flat().filter((ed) => MANAGEABLE_STATUSES.includes(ed.status))
        if (!cancelled) {
          setEditions(flat)
          // Auto-select first edition if none is active (e.g. after org switch)
          if (flat.length > 0 && !activeEditionRef.current) {
            const first = flat.find((e) => e.status === 'active') ?? flat[0]
            setActiveEdition({
              id: first.id,
              name: first.name,
              season: first.season,
              leagueId: first.leagueId,
              leagueName: first.leagueName,
              logoUrl: first.logoUrl,
              bannerUrl: first.bannerUrl,
            })
          }
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (ready) load()
    return () => { cancelled = true }
  }, [activeOrg?.id, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const groupedByLeague = useMemo(() => {
    const map = new Map<string, EditionWithLeague[]>()
    for (const ed of editions) {
      const arr = map.get(ed.leagueName) ?? []
      arr.push(ed)
      map.set(ed.leagueName, arr)
    }
    return Array.from(map.entries())
  }, [editions])

  function pick(ed: EditionWithLeague) {
    setActiveEdition({
      id: ed.id,
      name: ed.name,
      season: ed.season,
      leagueId: ed.leagueId,
      leagueName: ed.leagueName,
      logoUrl: ed.logoUrl,
      bannerUrl: ed.bannerUrl,
    })
    setOpen(false)
  }

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-4 flex-shrink-0">
      <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded">
        GESTIONANDO
      </span>

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={loading || editions.length === 0}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900 disabled:text-slate-400 disabled:cursor-not-allowed"
        >
          {activeEdition?.logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={activeEdition.logoUrl} alt="" className="w-5 h-5 rounded object-cover border border-slate-200" />
          ) : (
            <Trophy size={14} className="text-yellow-500" />
          )}
          {loading ? (
            <span className="flex items-center gap-1.5 text-slate-400">
              <Loader2 size={12} className="animate-spin" /> Cargando...
            </span>
          ) : activeEdition ? (
            <span className="truncate max-w-[260px]">{activeEdition.leagueName} {activeEdition.season}</span>
          ) : editions.length === 0 ? (
            <span className="text-slate-400">Sin torneos activos</span>
          ) : (
            <span>Seleccionar torneo</span>
          )}
          <ChevronDown size={14} className="text-slate-400" />
        </button>

        {open && editions.length > 0 && (
          <div className="absolute top-full left-0 mt-1.5 w-72 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden z-30 max-h-[60vh] overflow-y-auto">
            {groupedByLeague.map(([leagueName, eds]) => (
              <div key={leagueName}>
                <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide bg-slate-50 border-b border-slate-100">
                  {leagueName}
                </p>
                {eds.map((ed) => {
                  const isActive = activeEdition?.id === ed.id
                  const isLive = ed.status === 'active'
                  return (
                    <button
                      key={ed.id}
                      type="button"
                      onClick={() => pick(ed)}
                      className={clsx(
                        'w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors',
                        isActive && 'bg-green-50',
                      )}
                    >
                      {ed.logoUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={ed.logoUrl} alt="" className="w-7 h-7 rounded-md object-cover flex-shrink-0 border border-slate-200" />
                      ) : (
                        <div className="w-7 h-7 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
                          <Trophy size={13} className="text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{ed.leagueName} {ed.season}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={clsx(
                            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border',
                            isLive
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200',
                          )}>
                            <span className={clsx('w-1 h-1 rounded-full', isLive ? 'bg-green-500' : 'bg-blue-500')} />
                            {isLive ? 'En curso' : 'Inscripción'}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">{ed.name}</span>
                        </div>
                      </div>
                      {isActive && <Check size={14} className="text-green-600 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 w-56">
        <Search size={14} className="text-slate-400" />
        <input
          type="text"
          placeholder="Buscar..."
          className="bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none w-full"
        />
      </div>

      <button className="relative p-2 hover:bg-slate-100 rounded-lg">
        <Bell size={18} className="text-slate-600" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
      </button>
    </header>
  )
}
