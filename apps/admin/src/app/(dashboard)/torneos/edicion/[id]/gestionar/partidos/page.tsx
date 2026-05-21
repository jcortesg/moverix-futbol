import { PartidosManager } from '@/components/torneos/PartidosManager'

export default function Page({ params }: { params: { id: string } }) {
  return <PartidosManager editionId={params.id} />
}
