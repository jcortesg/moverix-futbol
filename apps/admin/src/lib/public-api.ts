import axios from 'axios'

const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
})

export type PublicEditionListItem = {
  id: string
  name: string
  slug: string
  season: string
  status: 'draft' | 'registration' | 'active' | 'finished'
  logoUrl: string | null
  bannerUrl: string | null
  startDate: string | null
  maxTeams: number
  registrationFee: number
  prizePool: number
  currency: string
  league: { name: string; sportFormat: string; gender: string }
  organization: { name: string; city: string | null; logoUrl: string | null }
  teamsCount: number
}

export async function getPublicEditions(): Promise<PublicEditionListItem[]> {
  const { data } = await publicApi.get('/public/editions')
  return data
}

export type PublicEditionData = {
  id: string
  name: string
  slug: string
  season: string
  status: 'draft' | 'registration' | 'active' | 'finished'
  maxTeams: number
  registrationFee: number
  prizePool: number
  currency: string
  logoUrl: string | null
  bannerUrl: string | null
  rulesUrl: string | null
  publicDescription: string | null
  startDate: string | null
  endDate: string | null
  formatConfig: Record<string, unknown>
  league: {
    id: string
    name: string
    sportFormat: 'F5' | 'F8' | 'F11'
    gender: 'M' | 'F' | 'Mixed'
    logoUrl: string | null
  }
  organization: {
    id: string
    name: string
    city: string | null
    logoUrl: string | null
  }
  teams: Array<{
    id: string
    name: string
    shortName: string | null
    logoUrl: string | null
    primaryColor: string | null
    secondaryColor: string | null
    registrationStatus: string
  }>
  teamsCount: number
  teamsHidden?: boolean
  venues: Array<{
    id: string
    name: string
    address: string | null
    city: string | null
    photoUrl: string | null
  }>
}

export async function getPublicEdition(slug: string, token?: string): Promise<PublicEditionData> {
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const { data } = await publicApi.get(`/public/editions/${slug}`, { headers })
  return data
}

/* ── Public team endpoints ───────────────────────────── */

export type PublicTeamData = {
  id: string
  name: string
  slug: string
  shortName: string | null
  logoUrl: string | null
  primaryColor: string | null
  city: string | null
  members: Array<{
    playerName: string
    role: 'director' | 'player'
  }>
  edition: {
    id: string
    name: string
    slug: string
    season: string
    status: string
    logoUrl: string | null
    registrationStatus?: string
    league: { name: string; sportFormat: string }
    organization: { name: string }
  } | null
  roster: Array<{
    playerName: string
    firstName: string | null
    lastName: string | null
    position: string | null
    jerseyNumber: number | null
    addedAt: string
  }>
}

export async function getPublicTeam(
  teamSlug: string,
  editionSlug?: string,
): Promise<PublicTeamData> {
  const params = editionSlug ? { edition: editionSlug } : {}
  const { data } = await publicApi.get(`/public/teams/${teamSlug}`, { params })
  return data
}

export type JoinAndRegisterDto = {
  teamSlug: string
  accessCode: string
  editionSlug?: string
  playerName: string
  firstName?: string
  lastName?: string
  docNumber?: string
  phone?: string
  email?: string
  position?: string
  jerseyNumber?: number
}

export async function joinAndRegister(
  dto: JoinAndRegisterDto,
  token: string,
): Promise<{ teamId: string; teamName: string; joined: boolean }> {
  const { data } = await publicApi.post('/public/teams/join-and-register', dto, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return data
}

/* ── Director roster endpoints (auth required) ──────────── */

async function getAuthHeader(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {}
  const { getAuth } = await import('firebase/auth')
  const user = getAuth().currentUser
  if (!user) return {}
  const token = await user.getIdToken()
  return { Authorization: `Bearer ${token}` }
}

export type RosterPlayer = {
  id: string
  registrationId: string
  playerUid: string
  playerName: string
  firstName: string | null
  lastName: string | null
  docNumber: string | null
  birthDate: string | null
  employer: string | null
  healthProvider: string | null
  phone: string | null
  email: string | null
  position: string | null
  jerseyNumber: number | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  docFileUrl: string | null
  addedAt: string
}

export async function getDirectorRoster(registrationId: string): Promise<RosterPlayer[]> {
  const headers = await getAuthHeader()
  const { data } = await publicApi.get(`/public/teams/roster/${registrationId}`, { headers })
  return data
}

export type AddPlayerDto = {
  registrationId: string
  playerName: string
  firstName?: string
  lastName?: string
  docNumber?: string
  birthDate?: string
  employer?: string
  healthProvider?: string
  phone?: string
  email?: string
  position?: string
  jerseyNumber?: number
  emergencyContactName?: string
  emergencyContactPhone?: string
}

export async function addDirectorPlayer(dto: AddPlayerDto): Promise<RosterPlayer> {
  const headers = await getAuthHeader()
  const { data } = await publicApi.post('/public/teams/roster/add-player', dto, { headers })
  return data
}

/** Sube la cédula (imagen o fotocopia) de un jugador — solo director del equipo. */
export async function uploadDirectorPlayerDocument(playerId: string, file: File): Promise<RosterPlayer> {
  const headers = await getAuthHeader()
  const form = new FormData()
  form.append('file', file)
  const { data } = await publicApi.post(`/public/teams/roster/${playerId}/document`, form, { headers })
  return data
}
