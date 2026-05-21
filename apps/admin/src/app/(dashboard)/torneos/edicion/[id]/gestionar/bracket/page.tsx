import { BracketManager } from '@/components/torneos/BracketManager'

export default function Page({ params }: { params: { id: string } }) {
  return <BracketManager editionId={params.id} />
}
