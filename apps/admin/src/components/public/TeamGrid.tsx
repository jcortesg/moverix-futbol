'use client'

import { Users } from 'lucide-react'
import type { PublicEditionData } from '@/lib/public-api'

type Team = PublicEditionData['teams'][number]

export function TeamGrid({ teams }: { teams: Team[] }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      <div className="p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-5">Equipos participantes</h2>

        {teams.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Users size={36} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aun no hay equipos inscritos</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
              >
                {team.logoUrl ? (
                  <img
                    src={team.logoUrl}
                    alt={team.name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: team.primaryColor || '#94a3b8' }}
                  >
                    {team.shortName?.slice(0, 2) || team.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <p className="text-xs font-semibold text-slate-700 leading-tight line-clamp-2 min-w-0">
                  {team.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
