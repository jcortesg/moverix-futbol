import { EquiposManager } from '@/components/torneos/EquiposManager'

export default function Page({ params }: { params: { id: string } }) {
  return <EquiposManager editionId={params.id} />
}
