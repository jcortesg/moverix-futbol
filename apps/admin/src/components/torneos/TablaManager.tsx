'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, BarChart2, ChevronLeft, Loader2, Shield, Trophy, Swords, Table2,
} from 'lucide-react'
import { clsx } from 'clsx'
import {
  getStandingsByEdition,
  getQualifiersByEdition,
  type StandingGroup,
  type StandingRow,
  type QualifiersResult,
  type Qualifier,
} from '@/lib/standings'
import { getEdition, type EditionFromApi } from '@/lib/leagues'

export function TablaManager({
  editionId,
  backHref,
  backLabel = 'Gestionar',
}: {
  editionId: string
  backHref?: string
  backLabel?: string
}) {
  const [edition, setEdition] = useState<EditionFromApi | null>(null)
  const [standings, setStandings] = useState<StandingGroup[]>([])
  const [qualifiers, setQualifiers] = useState<QualifiersResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'groups' | 'reclassification'>('groups')

  useEffect(() => {
    Promise.all([
      getEdition(editionId).then(setEdition),
      getStandingsByEdition(editionId).then(setStandings),
      getQualifiersByEdition(editionId).then(setQualifiers).catch(() => null),
    ])
      .catch(() => setError('No se pudo cargar la tabla.'))
      .finally(() => setLoading(false))
  }, [editionId])

  // Map teamId → qualifier info (for inline indicator in standings rows)
  const qualifierByTeam = new Map<string, Qualifier>()
  if (qualifiers) for (const q of qualifiers.qualifiers) qualifierByTeam.set(q.teamId, q)

  const realGroups = standings.filter((g) => g.groupId !== null)
  const hasGroups = realGroups.length > 0
  // Auto-switch to reclassification tab when there are no groups
  useEffect(() => {
    if (!loading && !hasGroups) setTab('reclassification')
  }, [loading, hasGroups])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-32 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">Cargando tabla...</span>
      </div>
    )
  }

  if (error || !edition) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        <AlertCircle size={16} /> {error ?? 'No disponible.'}
      </div>
    )
  }

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={backHref ?? `/torneos/edicion/${editionId}/gestionar`}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          <ChevronLeft size={15} />
          <span>{backLabel}</span>
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-semibold text-slate-900">Tabla de posiciones</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
          <BarChart2 size={18} className="text-purple-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Tabla de posiciones</h1>
          <p className="text-xs text-slate-500">
            Calculada en tiempo real desde los partidos finalizados.
          </p>
        </div>
      </div>

      {standings.length === 0 || standings.every((g) => g.rows.length === 0) ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <BarChart2 size={28} className="text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">Aún no hay datos</p>
          <p className="text-xs text-slate-400 max-w-sm text-center">
            La tabla se llena automáticamente cuando finalices partidos.
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="border-b border-slate-200 mb-5 -mx-2 overflow-x-auto">
            <div className="flex items-center gap-1 px-2">
              {hasGroups && (
                <button
                  type="button"
                  onClick={() => setTab('groups')}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                    tab === 'groups'
                      ? 'border-purple-600 text-purple-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
                  )}
                >
                  <Table2 size={15} />
                  Grupos
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 ml-1">
                    {realGroups.length}
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setTab('reclassification')}
                className={clsx(
                  'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                  tab === 'reclassification'
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
                )}
              >
                <Swords size={15} />
                Reclasificación
              </button>
            </div>
          </div>

          {/* Tab content */}
          {tab === 'groups' && hasGroups && (
            <div className="space-y-5">
              {realGroups.map((g) => (
                <GroupTable
                  key={g.groupId ?? 'no-group'}
                  group={g}
                  qualifierByTeam={qualifierByTeam}
                />
              ))}
            </div>
          )}

          {tab === 'reclassification' && (
            <ReclassificationTab
              standings={standings}
              qualifiers={qualifiers}
            />
          )}
        </>
      )}
    </div>
  )
}

// ─── Group table ──────────────────────────────────────────────────────────────

function GroupTable({
  group,
  qualifierByTeam,
}: {
  group: StandingGroup
  qualifierByTeam: Map<string, Qualifier>
}) {
  const qualifiers = group.qualifiersPerGroup
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50">
        {group.groupCode && (
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-700">
            {group.groupCode}
          </span>
        )}
        <p className="text-sm font-bold text-slate-900 flex-1">{group.groupName}</p>
        {qualifiers != null && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
            Clasifican {qualifiers}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[6%]" />
            <col className="w-[30%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <Th className="text-center">#</Th>
              <Th>Equipo</Th>
              <Th className="text-center" title="Partidos jugados">PJ</Th>
              <Th className="text-center" title="Ganados">PG</Th>
              <Th className="text-center" title="Empatados">PE</Th>
              <Th className="text-center" title="Perdidos">PP</Th>
              <Th className="text-center" title="Goles a favor">GF</Th>
              <Th className="text-center" title="Goles en contra">GC</Th>
              <Th className="text-center" title="Diferencia de gol">DG</Th>
              <Th className="text-center" title="Puntos">Pts</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {group.rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-5 py-8 text-center text-xs text-slate-400 italic">
                  Sin equipos en este grupo
                </td>
              </tr>
            ) : (
              group.rows.map((row) => (
                <StandingRowView
                  key={row.teamId}
                  row={row}
                  qualifiers={qualifiers}
                  qualifierInfo={qualifierByTeam.get(row.teamId)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StandingRowView({
  row, qualifiers, qualifierInfo,
}: {
  row: StandingRow
  qualifiers: number | null
  qualifierInfo?: Qualifier
}) {
  const isLeader = row.position === 1
  const isQualified = qualifiers != null && row.position <= qualifiers
  const isLast = qualifiers != null && row.position > qualifiers

  return (
    <tr className={clsx(
      'transition-colors',
      isQualified ? 'bg-green-50/40 hover:bg-green-50' : 'hover:bg-slate-50/50',
    )}>
      <td className="px-3 py-2.5 text-center">
        <span className={clsx(
          'inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold tabular-nums',
          isLeader ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
            : isQualified ? 'bg-green-100 text-green-700'
            : isLast ? 'text-slate-400'
            : 'text-slate-600',
        )}>
          {isLeader ? <Trophy size={11} fill="currentColor" /> : row.position}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          {row.teamLogoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={row.teamLogoUrl} alt="" className="w-7 h-7 rounded-md object-cover border border-slate-200 flex-shrink-0" />
          ) : (
            <div
              className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center flex-shrink-0"
              style={row.teamPrimaryColor ? { background: `${row.teamPrimaryColor}18` } : undefined}
            >
              <Shield size={11} style={{ color: row.teamPrimaryColor ?? '#94a3b8' }} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 truncate">{row.teamName}</p>
            <div className="flex items-center gap-1.5">
              {row.teamShortName && (
                <p className="text-[10px] text-slate-400">{row.teamShortName}</p>
              )}
              {qualifierInfo && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-1.5 py-0.5">
                  <Swords size={9} />
                  {qualifierInfo.destinationLabel} #{qualifierInfo.seed}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <Td>{row.played}</Td>
      <Td>{row.wins}</Td>
      <Td>{row.draws}</Td>
      <Td>{row.losses}</Td>
      <Td>{row.goalsFor}</Td>
      <Td>{row.goalsAgainst}</Td>
      <Td className={row.goalDiff > 0 ? 'text-green-700 font-bold' : row.goalDiff < 0 ? 'text-red-600' : ''}>
        {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
      </Td>
      <td className="px-3 py-2.5 text-center">
        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-slate-900 text-white text-xs font-bold tabular-nums">
          {row.points}
        </span>
      </td>
    </tr>
  )
}

function Th({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <th
      title={title}
      className={clsx('px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest', className)}
    >
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={clsx('px-3 py-2.5 text-center text-sm text-slate-700 tabular-nums', className)}>
      {children}
    </td>
  )
}

function ordinal(n: number): string {
  if (n === 1) return '1°'
  if (n === 2) return '2°'
  if (n === 3) return '3°'
  return `${n}°`
}

// ─── Reclassification tab ────────────────────────────────────────────────────

type GeneralRow = StandingRow & {
  groupCode: string | null
  groupPosition: number
  qualifier?: Qualifier
}

function ReclassificationTab({
  standings,
  qualifiers,
}: {
  standings: StandingGroup[]
  qualifiers: QualifiersResult | null
}) {
  // Build flat list across all groups, attach qualifier info
  const qualifierByTeam = new Map<string, Qualifier>()
  if (qualifiers) for (const q of qualifiers.qualifiers) qualifierByTeam.set(q.teamId, q)

  const all: GeneralRow[] = []
  for (const g of standings) {
    g.rows.forEach((row, idx) => {
      all.push({
        ...row,
        groupCode: g.groupCode,
        groupPosition: idx + 1,
        qualifier: qualifierByTeam.get(row.teamId),
      })
    })
  }

  // Sort: points desc, goalDiff desc, goalsFor desc, name asc
  all.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    return a.teamName.localeCompare(b.teamName)
  })

  // Stats
  const totalQualified = qualifiers?.qualifiers.length ?? 0
  const totalSlots = qualifiers?.totalSlots ?? 0
  const formatLabel = qualifiers
    ? qualifiers.type === 'groups_knockout' ? 'Grupos → Eliminatoria'
      : qualifiers.type === 'groups_multi_cup' ? 'Grupos → Multi-Copa'
      : qualifiers.type === 'round_robin_playoffs' ? 'Liga → Playoffs'
      : 'Sin fase eliminatoria'
    : '—'

  return (
    <div>
      {/* Header summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-5">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-white">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
            <Swords size={14} className="text-indigo-700" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">Tabla general · Reclasificación</p>
            <p className="text-xs text-slate-500">
              {all.length} equipos · {formatLabel}
              {qualifiers && qualifiers.qualifiers.length > 0 && (
                <> · {totalQualified}/{totalSlots} clasificados</>
              )}
            </p>
          </div>
        </div>

        {/* Per-destination summary chips */}
        {qualifiers && qualifiers.qualifiers.length > 0 && (
          <div className="px-5 py-3 flex items-center gap-2 flex-wrap">
            {Array.from(groupByDestination(qualifiers.qualifiers).entries()).map(([dest, list]) => (
              <span
                key={dest}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700"
              >
                {list[0].destinationLabel}
                <span className="text-[10px] font-bold text-indigo-500 bg-white border border-indigo-200 rounded-full px-1.5 py-0.5">
                  {list.length}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Flat ranking */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[30%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[7%]" />
              <col className="w-[8%]" />
              <col className="w-[8%]" />
              <col className="w-[21%]" />
            </colgroup>
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <Th className="text-center">#</Th>
                <Th>Equipo</Th>
                <Th className="text-center">Grupo</Th>
                <Th className="text-center" title="Partidos jugados">PJ</Th>
                <Th className="text-center" title="Goles a favor">GF</Th>
                <Th className="text-center" title="Goles en contra">GC</Th>
                <Th className="text-center" title="Diferencia">DG</Th>
                <Th className="text-center" title="Puntos">Pts</Th>
                <Th>Destino</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {all.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-xs text-slate-400 italic">
                    Sin equipos
                  </td>
                </tr>
              ) : (
                all.map((row, idx) => (
                  <GeneralRowView key={row.teamId} row={row} position={idx + 1} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function GeneralRowView({ row, position }: { row: GeneralRow; position: number }) {
  const isLeader = position === 1
  const qual = row.qualifier
  return (
    <tr className={clsx(
      'transition-colors',
      qual ? 'bg-indigo-50/30 hover:bg-indigo-50/60' : 'hover:bg-slate-50/50',
    )}>
      <td className="px-3 py-2.5 text-center">
        <span className={clsx(
          'inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold tabular-nums',
          isLeader ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
            : qual ? 'bg-indigo-100 text-indigo-700'
            : 'text-slate-600',
        )}>
          {isLeader ? <Trophy size={11} fill="currentColor" /> : position}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          {row.teamLogoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={row.teamLogoUrl} alt="" className="w-7 h-7 rounded-md object-cover border border-slate-200 flex-shrink-0" />
          ) : (
            <div
              className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center flex-shrink-0"
              style={row.teamPrimaryColor ? { background: `${row.teamPrimaryColor}18` } : undefined}
            >
              <Shield size={11} style={{ color: row.teamPrimaryColor ?? '#94a3b8' }} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{row.teamName}</p>
            {row.teamShortName && (
              <p className="text-[10px] text-slate-400">{row.teamShortName}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-center">
        {row.groupCode ? (
          <span className="inline-flex flex-col items-center text-[11px]">
            <span className="font-bold text-slate-700">{row.groupCode}</span>
            <span className="text-[9px] text-slate-400">{ordinal(row.groupPosition)}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>
      <Td>{row.played}</Td>
      <Td>{row.goalsFor}</Td>
      <Td>{row.goalsAgainst}</Td>
      <Td className={row.goalDiff > 0 ? 'text-green-700 font-bold' : row.goalDiff < 0 ? 'text-red-600' : ''}>
        {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
      </Td>
      <td className="px-3 py-2.5 text-center">
        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-md bg-slate-900 text-white text-xs font-bold tabular-nums">
          {row.points}
        </span>
      </td>
      <td className="px-3 py-2.5">
        {qual ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
            <Swords size={10} />
            {qual.destinationLabel} #{qual.seed}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 italic">Eliminado</span>
        )}
      </td>
    </tr>
  )
}

function groupByDestination(list: Qualifier[]): Map<string, Qualifier[]> {
  const m = new Map<string, Qualifier[]>()
  for (const q of list) {
    if (!m.has(q.destination)) m.set(q.destination, [])
    m.get(q.destination)!.push(q)
  }
  return m
}
