import { api } from './api'

export type PaymentType = 'registration' | 'fine' | 'other'
export type PaymentStatus = 'pending' | 'verified' | 'rejected'

export type PaymentTeamSummary = {
  id: string
  name: string
  shortName: string | null
  logoUrl: string | null
  primaryColor: string | null
}

export type PaymentFromApi = {
  id: string
  editionId: string
  teamId: string
  registrationId: string | null
  fineId: string | null
  type: PaymentType
  amount: number
  currency: string
  status: PaymentStatus
  receiptUrl: string | null
  notes: string | null
  verifiedAt: string | null
  verifiedByUid: string | null
  createdAt: string
  updatedAt: string
  team?: PaymentTeamSummary
}

export type CreatePaymentDto = {
  editionId: string
  teamId: string
  registrationId?: string
  fineId?: string
  type?: PaymentType
  amount: number
  currency?: string
  receiptUrl?: string
  notes?: string
}

export type UpdatePaymentDto = Partial<Omit<CreatePaymentDto, 'editionId' | 'teamId'>> & {
  status?: PaymentStatus
}

export type EditionPaymentSummary = {
  edition: {
    id: string
    name: string
    season: string
    currency: string
    registrationFee: number
    maxTeams: number
    teamsApproved: number
  }
  registrations: {
    expected: number
    paid: number
    pending: number
    teamsPaid: number
    teamsPending: number
  }
  fines: {
    issued: number
    paid: number
    pending: number
    waived: number
  }
  totals: {
    income: number
    pending: number
  }
}

export async function getPaymentsByEdition(editionId: string): Promise<PaymentFromApi[]> {
  const { data } = await api.get<PaymentFromApi[]>('/payments', { params: { editionId } })
  return data
}

export async function getPaymentsByTeam(editionId: string, teamId: string): Promise<PaymentFromApi[]> {
  const { data } = await api.get<PaymentFromApi[]>('/payments', { params: { editionId, teamId } })
  return data
}

export async function getPaymentSummary(editionId: string): Promise<EditionPaymentSummary> {
  const { data } = await api.get<EditionPaymentSummary>('/payments/summary', { params: { editionId } })
  return data
}

export async function createPayment(dto: CreatePaymentDto): Promise<PaymentFromApi> {
  const { data } = await api.post<PaymentFromApi>('/payments', dto)
  return data
}

export async function updatePayment(id: string, dto: UpdatePaymentDto): Promise<PaymentFromApi> {
  const { data } = await api.patch<PaymentFromApi>(`/payments/${id}`, dto)
  return data
}

export async function deletePayment(id: string): Promise<void> {
  await api.delete(`/payments/${id}`)
}
