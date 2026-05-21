import { PagosManager } from '@/components/torneos/PagosManager'

export default function Page({ params }: { params: { id: string } }) {
  return <PagosManager editionId={params.id} />
}
