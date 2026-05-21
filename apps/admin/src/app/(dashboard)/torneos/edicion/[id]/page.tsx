import { EditionEditPage } from '@/components/torneos/EditionEditPage'

export default function Page({ params }: { params: { id: string } }) {
  return <EditionEditPage editionId={params.id} />
}
