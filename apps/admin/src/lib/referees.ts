import { api } from './api'

export type RefereeFromApi = {
  id: string
  organizationId: string
  uid: string | null
  fullName: string
  phone: string | null
  photoUrl: string | null
  licenseNumber: string | null
  /** Correo con el que vincula su cuenta para dirigir partidos. */
  email: string | null
  /** referee | delegate | both */
  role: string
  createdAt: string
  updatedAt: string
}

export type CreateRefereeDto = {
  organizationId: string
  fullName: string
  phone?: string
  licenseNumber?: string
  email?: string
  role?: 'referee' | 'delegate' | 'both'
  uid?: string
}

export type UpdateRefereeDto = Partial<Omit<CreateRefereeDto, 'organizationId'>>

export async function getReferees(organizationId: string): Promise<RefereeFromApi[]> {
  const { data } = await api.get<RefereeFromApi[]>('/referees', { params: { organizationId } })
  return data
}

export async function getReferee(id: string): Promise<RefereeFromApi> {
  const { data } = await api.get<RefereeFromApi>(`/referees/${id}`)
  return data
}

export async function createReferee(dto: CreateRefereeDto): Promise<RefereeFromApi> {
  const { data } = await api.post<RefereeFromApi>('/referees', dto)
  return data
}

export async function updateReferee(id: string, dto: UpdateRefereeDto): Promise<RefereeFromApi> {
  const { data } = await api.patch<RefereeFromApi>(`/referees/${id}`, dto)
  return data
}

export async function deleteReferee(id: string): Promise<void> {
  await api.delete(`/referees/${id}`)
}
