import { api } from './api'

export type VenueFromApi = {
  id: string
  organizationId: string
  name: string
  address: string | null
  city: string | null
  lat: number | null
  lng: number | null
  pitchCount: number
  photoUrl: string | null
  createdAt: string
  updatedAt: string
}

export type CreateVenueDto = {
  organizationId: string
  name: string
  address?: string
  city?: string
  lat?: number
  lng?: number
  pitchCount?: number
}

export type UpdateVenueDto = Partial<Omit<CreateVenueDto, 'organizationId'>>

export async function getVenues(organizationId: string): Promise<VenueFromApi[]> {
  const { data } = await api.get<VenueFromApi[]>('/venues', { params: { organizationId } })
  return data
}

export async function getVenue(id: string): Promise<VenueFromApi> {
  const { data } = await api.get<VenueFromApi>(`/venues/${id}`)
  return data
}

export async function createVenue(dto: CreateVenueDto): Promise<VenueFromApi> {
  const { data } = await api.post<VenueFromApi>('/venues', dto)
  return data
}

export async function updateVenue(id: string, dto: UpdateVenueDto): Promise<VenueFromApi> {
  const { data } = await api.patch<VenueFromApi>(`/venues/${id}`, dto)
  return data
}

export async function deleteVenue(id: string): Promise<void> {
  await api.delete(`/venues/${id}`)
}

export async function uploadVenuePhoto(id: string, file: File): Promise<VenueFromApi> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<VenueFromApi>(`/venues/${id}/photo`, form)
  return data
}
