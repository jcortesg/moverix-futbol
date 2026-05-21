import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { OrganizationsService } from './organizations.service'
import { DatabaseService } from '../../db/database.service'
import { StorageService } from '../../common/services/storage.service'

const ORG_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const OWNER_UID = 'firebase-uid-123'

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

/** Creates a Drizzle-like fluent mock that is also thenable and has .returning() */
function makeChain(defaultValue: unknown): any {
  const chain: any = {
    // Thenable: allows `await chain.select().from().where()`
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(defaultValue).then(resolve, reject),
    catch: (reject: (e: unknown) => void) => Promise.resolve(defaultValue).catch(reject),
    returning: jest.fn().mockResolvedValue(defaultValue),
  }
  for (const method of ['select', 'from', 'where', 'insert', 'values', 'update', 'set', 'delete']) {
    chain[method] = jest.fn().mockReturnValue(chain)
  }
  return chain
}

describe('OrganizationsService', () => {
  let service: OrganizationsService
  let chain: ReturnType<typeof makeChain>
  let mockStorage: jest.Mocked<Pick<StorageService, 'uploadLogo' | 'deleteFile'>>

  beforeEach(async () => {
    chain = makeChain([mockOrg])
    mockStorage = {
      uploadLogo: jest.fn().mockResolvedValue('https://storage.googleapis.com/bucket/logo.png'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        { provide: DatabaseService, useValue: { db: chain } },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile()

    service = module.get<OrganizationsService>(OrganizationsService)
  })

  describe('create', () => {
    it('creates an organization with auto-generated slug', async () => {
      const result = await service.create({ name: 'Club Atlético' }, OWNER_UID)
      expect(result).toEqual(mockOrg)
    })
  })

  describe('findAll', () => {
    it('returns organizations for the given owner', async () => {
      const result = await service.findAll(OWNER_UID)
      expect(result).toEqual([mockOrg])
    })
  })

  describe('findOne', () => {
    it('returns an organization by id', async () => {
      const result = await service.findOne(ORG_ID)
      expect(result).toEqual(mockOrg)
    })

    it('throws NotFoundException when organization does not exist', async () => {
      const emptyChain = makeChain([])
      chain.where.mockReturnValueOnce(emptyChain)

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException)
    })
  })

  describe('update', () => {
    it('updates and returns the organization', async () => {
      const updated = { ...mockOrg, name: 'Club Modificado' }
      chain.returning.mockResolvedValueOnce([updated])

      const result = await service.update(ORG_ID, { name: 'Club Modificado' })

      expect(result).toEqual(updated)
    })

    it('throws NotFoundException when organization does not exist', async () => {
      const emptyChain = makeChain([])
      chain.where.mockReturnValueOnce(emptyChain)

      await expect(service.update('bad-id', { name: 'X' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('remove', () => {
    it('deletes the organization and returns its id', async () => {
      const result = await service.remove(ORG_ID)
      expect(result).toEqual({ id: ORG_ID })
    })

    it('throws NotFoundException when organization does not exist', async () => {
      const emptyChain = makeChain([])
      chain.where.mockReturnValueOnce(emptyChain)

      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException)
    })
  })

  describe('uploadLogo', () => {
    const mockFile = { originalname: 'logo.png', mimetype: 'image/png', buffer: Buffer.from('img') } as Express.Multer.File

    it('uploads logo and updates logoUrl', async () => {
      const withLogo = { ...mockOrg, logoUrl: 'https://storage.googleapis.com/bucket/logo.png' }
      chain.returning.mockResolvedValueOnce([withLogo])

      const result = await service.uploadLogo(ORG_ID, mockFile)

      expect(mockStorage.uploadLogo).toHaveBeenCalledWith(`organizations/${ORG_ID}`, mockFile)
      expect(result.logoUrl).toBe('https://storage.googleapis.com/bucket/logo.png')
    })

    it('deletes old logo before uploading new one', async () => {
      const orgWithLogo = { ...mockOrg, logoUrl: 'https://storage.googleapis.com/bucket/old.png' }
      const withNewLogo = { ...mockOrg, logoUrl: 'https://storage.googleapis.com/bucket/logo.png' }

      chain = makeChain([orgWithLogo])
      chain.returning.mockResolvedValueOnce([withNewLogo])

      // Rebuild service with updated chain mock
      const module = await Test.createTestingModule({
        providers: [
          OrganizationsService,
          { provide: DatabaseService, useValue: { db: chain } },
          { provide: StorageService, useValue: mockStorage },
        ],
      }).compile()
      const svc = module.get<OrganizationsService>(OrganizationsService)

      await svc.uploadLogo(ORG_ID, mockFile)

      expect(mockStorage.deleteFile).toHaveBeenCalledWith(orgWithLogo.logoUrl)
    })
  })
})
