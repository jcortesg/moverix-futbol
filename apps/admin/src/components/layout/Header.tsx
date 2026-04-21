'use client'

import { Bell, ChevronDown, Search, Trophy } from 'lucide-react'

export function Header() {
  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-6 gap-4 flex-shrink-0">
      <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded">
        GESTIONANDO
      </span>

      <button className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900">
        <Trophy size={14} className="text-yellow-500" />
        Liga CASB 2025
        <ChevronDown size={14} className="text-slate-400" />
      </button>

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
