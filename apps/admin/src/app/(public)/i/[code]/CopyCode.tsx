'use client'

import { useState } from 'react'

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard no disponible: ignorar (el código sigue visible)
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl py-4 mb-3 flex flex-col items-center gap-3">
      <span className="text-4xl font-black tracking-[0.3em] text-[#7BFF00]">{code}</span>
      <button
        onClick={copy}
        className="text-xs font-bold px-4 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all"
      >
        {copied ? '✓ Copiado' : 'Copiar código'}
      </button>
    </div>
  )
}
