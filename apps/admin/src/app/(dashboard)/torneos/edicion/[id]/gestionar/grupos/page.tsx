import { GruposManager } from '@/components/torneos/GruposManager'

export default function Page({ params }: { params: { id: string } }) {
  return <GruposManager editionId={params.id} />
}
