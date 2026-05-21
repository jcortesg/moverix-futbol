import { TeamDetailView } from '@/components/torneos/TeamDetailView'

export default function Page({ params }: { params: { id: string; regId: string } }) {
  return <TeamDetailView editionId={params.id} registrationId={params.regId} />
}
