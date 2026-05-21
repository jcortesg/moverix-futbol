import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { OrganizationsController } from './organizations.controller'
import { OrganizationsService } from './organizations.service'
import { OwnershipService } from '../../common/services/ownership.service'

const ORG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const OWNER_UID = 'firebase-uid-123'
const mockRequest = { user: { uid: OWNER_UID } }

const mockOrg = {
  id: ORG_ID,
  name: 'Club Atlético',
  slug: 'club-atletico',
  city: 'Bogotá',
  country: 'CO',
  ownerUid: OWNER_UID,
  logoUrl: null,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('OrganizationsController', () => {
  let controller: OrganizationsController
  let service: jest.Mocked<OrganizationsService>

  beforeEach(async () => {
    const mockService: Partial<jest.Mocked<OrganizationsService>> = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      uploadLogo: jest.fn(),
    }

    const mockOwnership = {
      verifyOrganization: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        { provide: OrganizationsService, useValue: mockService },
        { provide: OwnershipService, useValue: mockOwnership },
      ],
    }).compile()

    controller = module.get<OrganizationsController>(OrganizationsController)
    service = module.get(OrganizationsService)
  })

  it('create — delegates to service with ownerUid from request', async () => {
    service.create.mockResolvedValue(mockOrg)
    const dto = { name: 'Club Atlético', slug: 'club-atletico' }

    const result = await controller.create(dto as any, mockRequest as any)

    expect(service.create).toHaveBeenCalledWith(dto, OWNER_UID)
    expect(result).toEqual(mockOrg)
  })

  it('create — propagates ConflictException on duplicate slug', async () => {
    service.create.mockRejectedValue(new ConflictException())

    await expect(controller.create({ name: 'X', slug: 'club-atletico' } as any, mockRequest as any)).rejects.toThrow(
      ConflictException,
    )
  })

  it('findAll — returns organizations for authenticated user', async () => {
    service.findAll.mockResolvedValue([mockOrg])

    const result = await controller.findAll(mockRequest as any)

    expect(service.findAll).toHaveBeenCalledWith(OWNER_UID)
    expect(result).toEqual([mockOrg])
  })

  it('findOne — returns single organization', async () => {
    service.findOne.mockResolvedValue(mockOrg)

    const result = await controller.findOne(ORG_ID, mockRequest as any)

    expect(service.findOne).toHaveBeenCalledWith(ORG_ID)
    expect(result).toEqual(mockOrg)
  })

  it('findOne — propagates NotFoundException', async () => {
    service.findOne.mockRejectedValue(new NotFoundException())

    await expect(controller.findOne('bad-id', mockRequest as any)).rejects.toThrow(NotFoundException)
  })

  it('update — returns updated organization', async () => {
    const updated = { ...mockOrg, name: 'Nuevo Nombre' }
    service.update.mockResolvedValue(updated)

    const result = await controller.update(ORG_ID, { name: 'Nuevo Nombre' }, mockRequest as any)

    expect(service.update).toHaveBeenCalledWith(ORG_ID, { name: 'Nuevo Nombre' })
    expect(result).toEqual(updated)
  })

  it('remove — delegates delete to service', async () => {
    service.remove.mockResolvedValue({ id: ORG_ID })

    await controller.remove(ORG_ID, mockRequest as any)

    expect(service.remove).toHaveBeenCalledWith(ORG_ID)
  })

  it('uploadLogo — delegates upload to service', async () => {
    const withLogo = { ...mockOrg, logoUrl: 'https://storage.googleapis.com/bucket/logo.png' }
    service.uploadLogo.mockResolvedValue(withLogo)
    const mockFile = { originalname: 'logo.png' } as Express.Multer.File

    const result = await controller.uploadLogo(ORG_ID, mockFile, mockRequest as any)

    expect(service.uploadLogo).toHaveBeenCalledWith(ORG_ID, mockFile)
    expect(result.logoUrl).toBeDefined()
  })
})
