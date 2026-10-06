import { Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, notInArray, sql } from 'drizzle-orm'
import { DatabaseService } from '../../db/database.service'
import { editions, fines, payments, registrations, teams } from '../../db/schema'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { UpdatePaymentDto } from './dto/update-payment.dto'

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
    expected: number       // teamsApproved * registrationFee
    paid: number           // sum of verified registration payments
    pending: number        // expected - paid
    teamsPaid: number      // count teams whose total >= fee
    teamsPending: number   // count teams whose total < fee
  }
  fines: {
    issued: number         // sum of all fines amount
    paid: number           // sum of fines with status='paid'
    pending: number        // sum of fines with status='pending'
    waived: number
  }
  totals: {
    income: number         // registrations.paid + fines.paid
    pending: number        // registrations.pending + fines.pending
  }
}

@Injectable()
export class PaymentsService {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.db
  }

  async create(dto: CreatePaymentDto) {
    const [row] = await this.db.insert(payments).values({
      editionId: dto.editionId,
      teamId: dto.teamId,
      registrationId: dto.registrationId,
      fineId: dto.fineId,
      type: dto.type ?? 'registration',
      amount: dto.amount,
      currency: dto.currency,
      receiptUrl: dto.receiptUrl,
      notes: dto.notes,
    }).returning()
    return row
  }

  async findByEdition(editionId: string) {
    const rows = await this.db
      .select({
        payment: payments,
        team: {
          id: teams.id,
          name: teams.name,
          shortName: teams.shortName,
          logoUrl: teams.logoUrl,
          primaryColor: teams.primaryColor,
        },
      })
      .from(payments)
      .innerJoin(teams, eq(teams.id, payments.teamId))
      .where(eq(payments.editionId, editionId))
      .orderBy(desc(payments.createdAt))
    return rows.map((r) => ({ ...r.payment, team: r.team }))
  }

  async findByTeam(editionId: string, teamId: string) {
    return this.db
      .select()
      .from(payments)
      .where(and(
        eq(payments.editionId, editionId),
        eq(payments.teamId, teamId),
      ))
      .orderBy(desc(payments.createdAt))
  }

  async findOne(id: string) {
    const [row] = await this.db.select().from(payments).where(eq(payments.id, id))
    if (!row) throw new NotFoundException(`Pago ${id} no encontrado`)
    return row
  }

  async update(id: string, dto: UpdatePaymentDto, actorUid?: string) {
    await this.findOne(id)
    const patch: Record<string, unknown> = { ...dto, updatedAt: new Date() }
    if (dto.status === 'verified') {
      patch.verifiedAt = new Date()
      if (actorUid) patch.verifiedByUid = actorUid
    }
    const [updated] = await this.db
      .update(payments)
      .set(patch)
      .where(eq(payments.id, id))
      .returning()
    return updated
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.db.delete(payments).where(eq(payments.id, id))
    return { id }
  }

  async getEditionSummary(editionId: string): Promise<EditionPaymentSummary> {
    const [edition] = await this.db.select().from(editions).where(eq(editions.id, editionId))
    if (!edition) throw new NotFoundException(`Edición ${editionId} no encontrada`)

    // Equipos participantes = inscripciones no rechazadas/retiradas (misma regla que
    // tabla y grupos). El cobro de inscripción aplica a todos los participantes.
    const participatingRegs = await this.db
      .select({ id: registrations.id, teamId: registrations.teamId })
      .from(registrations)
      .where(and(
        eq(registrations.editionId, editionId),
        notInArray(registrations.status, ['rejected', 'withdrawn']),
      ))
    const teamsApproved = participatingRegs.length

    // Verified registration payments per team
    const verifiedRegPayments = await this.db
      .select({
        teamId: payments.teamId,
        amount: sql<number>`COALESCE(SUM(${payments.amount}), 0)`.mapWith(Number),
      })
      .from(payments)
      .where(and(
        eq(payments.editionId, editionId),
        eq(payments.type, 'registration'),
        eq(payments.status, 'verified'),
      ))
      .groupBy(payments.teamId)

    const paidByTeam = new Map<string, number>()
    for (const r of verifiedRegPayments) paidByTeam.set(r.teamId, r.amount)

    let regsPaidSum = 0
    let teamsPaid = 0
    for (const reg of participatingRegs) {
      const paid = paidByTeam.get(reg.teamId) ?? 0
      regsPaidSum += paid
      if (paid >= edition.registrationFee) teamsPaid++
    }
    const teamsPending = teamsApproved - teamsPaid
    const expected = teamsApproved * edition.registrationFee
    const regsPending = Math.max(0, expected - regsPaidSum)

    // Fines totals
    const finesAgg = await this.db
      .select({
        status: fines.status,
        total: sql<number>`COALESCE(SUM(${fines.amount}), 0)`.mapWith(Number),
      })
      .from(fines)
      .where(eq(fines.editionId, editionId))
      .groupBy(fines.status)

    let finesIssued = 0
    let finesPaid = 0
    let finesPending = 0
    let finesWaived = 0
    for (const f of finesAgg) {
      finesIssued += f.total
      if (f.status === 'paid') finesPaid += f.total
      if (f.status === 'pending') finesPending += f.total
      if (f.status === 'waived') finesWaived += f.total
    }

    return {
      edition: {
        id: edition.id,
        name: edition.name,
        season: edition.season,
        currency: edition.currency,
        registrationFee: edition.registrationFee,
        maxTeams: edition.maxTeams,
        teamsApproved,
      },
      registrations: {
        expected,
        paid: regsPaidSum,
        pending: regsPending,
        teamsPaid,
        teamsPending,
      },
      fines: {
        issued: finesIssued,
        paid: finesPaid,
        pending: finesPending,
        waived: finesWaived,
      },
      totals: {
        income: regsPaidSum + finesPaid,
        pending: regsPending + finesPending,
      },
    }
  }
}
