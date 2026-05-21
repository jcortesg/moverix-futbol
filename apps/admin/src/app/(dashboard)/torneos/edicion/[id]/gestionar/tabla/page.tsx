import { TablaManager } from '@/components/torneos/TablaManager'

export default function Page({ params }: { params: { id: string } }) {
  return <TablaManager editionId={params.id} />
}
