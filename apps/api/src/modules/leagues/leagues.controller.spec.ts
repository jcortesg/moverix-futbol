import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { LeaguesController } from './leagues.controller'
import { LeaguesService } from './leagues.service'
import { OwnershipService } from '../../common/services/ownership.service'

const LEAGUE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const ORG_ID = 'ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee'
const OWNER_UID = 'firebase-uid-123'
const mockRequest = { user: { uid: OWNER_UID } }

const mockLeague = {
  id: LEAGUE_ID,
  organizationId: ORG_ID,
  name: 'Liga CASB',
  slug: 'liga-casb',
  sportFormat: 'F8' as const,
  gender: 'M' as const,
  description: null,
  logoUrl: null,
  bannerUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('LeaguesController', () => {
  let controller: LeaguesController
  let service: jest.Mocked<LeaguesService>

  beforeEach(async () => {
    const mockService: Partial<jest.Mocked<LeaguesService>> = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      uploadLogo: jest.fn(),
      uploadBanner: jest.fn(),
    }

    const mockOwnership = {
      verifyOrganization: jest.fn(),
      verifyLeague: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaguesController],
      providers: [
        { provide: LeaguesService, useValue: mockService },
        { provide: OwnershipService, useValue: mockOwnership },
      ],
    }).compile()

    controller = module.get<LeaguesController>(LeaguesController)
    service = module.get(LeaguesService)
  })

  it('create — delegates to service', async () => {
    service.create.mockResolvedValue(mockLeague)
    const dto = { organizationId: ORG_ID, name: 'Liga CASB', slug: 'liga-casb', sportFormat: 'F8' as const, gender: 'M' as const }

    const result = await controller.create(dto, mockRequest as any)

    expect(service.create).toHaveBeenCalledWith(dto)
    expect(result).toEqual(mockLeague)
  })

  it('create — propagates ConflictException on duplicate slug', async () => {
    service.create.mockRejectedValue(new ConflictException())

    await expect(controller.create({ organizationId: ORG_ID, name: 'X', slug: 'dup', sportFormat: 'F8', gender: 'M' }, mockRequest as any)).rejects.toThrow(
      ConflictException,
    )
  })

  it('findAll — filters by organizationId', async () => {
    service.findAll.mockResolvedValue([mockLeague])

    const result = await controller.findAll(ORG_ID, mockRequest as any)

    expect(service.findAll).toHaveBeenCalledWith(ORG_ID)
    expect(result).toEqual([mockLeague])
  })

  it('findOne — returns a league', async () => {
    service.findOne.mockResolvedValue(mockLeague)

    const result = await controller.findOne(LEAGUE_ID, mockRequest as any)

    expect(service.findOne).toHaveBeenCalledWith(LEAGUE_ID)
    expect(result).toEqual(mockLeague)
  })

  it('findOne — propagates NotFoundException', async () => {
    service.findOne.mockRejectedValue(new NotFoundException())

    await expect(controller.findOne('bad-id', mockRequest as any)).rejects.toThrow(NotFoundException)
  })

  it('update — returns updated league', async () => {
    const updated = { ...mockLeague, name: 'Liga Modificada' }
    service.update.mockResolvedValue(updated)

    const result = await controller.update(LEAGUE_ID, { name: 'Liga Modificada' }, mockRequest as any)

    expect(service.update).toHaveBeenCalledWith(LEAGUE_ID, { name: 'Liga Modificada' })
    expect(result).toEqual(updated)
  })

  it('remove — delegates delete to service', async () => {
    service.remove.mockResolvedValue({ id: LEAGUE_ID })

    await controller.remove(LEAGUE_ID, mockRequest as any)

    expect(service.remove).toHaveBeenCalledWith(LEAGUE_ID)
  })

  it('uploadLogo — delegates upload to service', async () => {
    const withLogo = { ...mockLeague, logoUrl: 'https://storage.googleapis.com/bucket/logo.png' }
    service.uploadLogo.mockResolvedValue(withLogo)
    const mockFile = { originalname: 'logo.png' } as Express.Multer.File

    const result = await controller.uploadLogo(LEAGUE_ID, mockFile, mockRequest as any)

    expect(service.uploadLogo).toHaveBeenCalledWith(LEAGUE_ID, mockFile)
    expect(result.logoUrl).toBeDefined()
  })
})
