'use client'

import { clsx } from 'clsx'

export const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20 placeholder:text-slate-400'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
    </div>
  )
}

export function SectionCard({
  icon: Icon,
  color,
  title,
  description,
  children,
}: {
  icon: React.ElementType
  color: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
          <Icon size={16} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          {description && <p className="text-xs text-slate-400">{description}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div
      className={clsx(
        'flex items-center justify-between gap-4 p-4 rounded-xl border cursor-pointer transition-colors',
        checked ? 'border-green-200 bg-green-50' : 'border-slate-200 hover:border-slate-300 bg-white',
      )}
      onClick={() => onChange(!checked)}
    >
      <div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
      <div className={clsx('relative w-11 h-6 rounded-full transition-colors flex-shrink-0', checked ? 'bg-green-500' : 'bg-slate-200')}>
        <span className={clsx('absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform', checked && 'translate-x-5')} />
      </div>
    </div>
  )
}
