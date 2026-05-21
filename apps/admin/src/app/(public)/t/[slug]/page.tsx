import { TournamentLanding } from '@/components/public/TournamentLanding'

export default function TournamentPage({ params }: { params: { slug: string } }) {
  return <TournamentLanding slug={params.slug} />
}
