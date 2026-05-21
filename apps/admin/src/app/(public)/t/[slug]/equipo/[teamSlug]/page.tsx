'use client'

import { useSearchParams } from 'next/navigation'
import { PlayerJoinForm } from '@/components/public/PlayerJoinForm'

export default function TeamJoinPage({
  params,
}: {
  params: { slug: string; teamSlug: string }
}) {
  const searchParams = useSearchParams()
  const accessCode = searchParams.get('code') ?? undefined

  return (
    <PlayerJoinForm
      teamSlug={params.teamSlug}
      editionSlug={params.slug}
      accessCode={accessCode}
    />
  )
}
