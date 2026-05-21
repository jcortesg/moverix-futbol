import { Test, TestingModule } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { LeaguesService } from './leagues.service'
import { DatabaseService } from '../../db/database.service'
import { StorageService } from '../../common/services/storage.service'

const LEAGUE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const ORG_ID = 'ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee'

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

/** Creates a Drizzle-like fluent mock that is also thenable and has .returning() */
function makeChain(defaultValue: unknown): any {
  const chain: any = {
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

describe('LeaguesService', () => {
  let service: LeaguesService
  let chain: ReturnType<typeof makeChain>
  let mockStorage: jest.Mocked<Pick<StorageService, 'uploadLogo' | 'uploadBanner' | 'deleteFile'>>

  beforeEach(async () => {
    chain = makeChain([mockLeague])
    mockStorage = {
      uploadLogo: jest.fn().mockResolvedValue('https://storage.googleapis.com/bucket/logo.png'),
      uploadBanner: jest.fn().mockResolvedValue('https://storage.googleapis.com/bucket/banner.png'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaguesService,
        { provide: DatabaseService, useValue: { db: chain } },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile()

    service = module.get<LeaguesService>(LeaguesService)
  })

  const createDto = {
    organizationId: ORG_ID,
    name: 'Liga CASB',
    slug: 'liga-casb',
    sportFormat: 'F8' as const,
    gender: 'M' as const,
  }

  describe('create', () => {
    it('creates a league when slug is unique in the organization', async () => {
      const emptyChain = makeChain([])
      chain.where.mockReturnValueOnce(emptyChain)        // slug check → []
      chain.returning.mockResolvedValueOnce([mockLeague]) // insert.returning → league

      const result = await service.create(createDto)

      expect(result).toEqual(mockLeague)
    })

    it('throws ConflictException when slug already exists in same org', async () => {
      const existsChain = makeChain([{ id: LEAGUE_ID }])
      chain.where.mockReturnValueOnce(existsChain)

      await expect(service.create(createDto)).rejects.toThrow(ConflictException)
    })
  })

  describe('findAll', () => {
    it('returns leagues for the given organization', async () => {
      const result = await service.findAll(ORG_ID)
      expect(result).toEqual([mockLeague])
    })

    it('returns empty array when organization has no leagues', async () => {
      const emptyChain = makeChain([])
      chain.where.mockReturnValueOnce(emptyChain)

      const result = await service.findAll(ORG_ID)
      expect(result).toEqual([])
    })
  })

  describe('findOne', () => {
    it('returns a league by id', async () => {
      const result = await service.findOne(LEAGUE_ID)
      expect(result).toEqual(mockLeague)
    })

    it('throws NotFoundException when league does not exist', async () => {
      const emptyChain = makeChain([])
      chain.where.mockReturnValueOnce(emptyChain)

      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException)
    })
  })

  describe('update', () => {
    it('updates and returns the league', async () => {
      const updated = { ...mockLeague, name: 'Liga Nueva' }
      chain.returning.mockResolvedValueOnce([updated])

      const result = await service.update(LEAGUE_ID, { name: 'Liga Nueva' })

      expect(result).toEqual(updated)
    })

    it('throws NotFoundException when league does not exist', async () => {
      const emptyChain = makeChain([])
      chain.where.mockReturnValueOnce(emptyChain)

      await expect(service.update('bad-id', { name: 'X' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('remove', () => {
    it('deletes the league and returns its id', async () => {
      const result = await service.remove(LEAGUE_ID)
      expect(result).toEqual({ id: LEAGUE_ID })
    })

    it('throws NotFoundException when league does not exist', async () => {
      const emptyChain = makeChain([])
      chain.where.mockReturnValueOnce(emptyChain)

      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException)
    })
  })

  describe('uploadLogo', () => {
    const mockFile = {
      originalname: 'logo.png',
      mimetype: 'image/png',
      buffer: Buffer.from('img'),
    } as Express.Multer.File

    it('uploads logo and updates the league', async () => {
      const withLogo = { ...mockLeague, logoUrl: 'https://storage.googleapis.com/bucket/logo.png' }
      chain.returning.mockResolvedValueOnce([withLogo])

      const result = await service.uploadLogo(LEAGUE_ID, mockFile)

      expect(mockStorage.uploadLogo).toHaveBeenCalledWith(`leagues/${LEAGUE_ID}`, mockFile)
      expect(result.logoUrl).toBe('https://storage.googleapis.com/bucket/logo.png')
    })

    it('deletes old logo before uploading new one', async () => {
      const leagueWithLogo = { ...mockLeague, logoUrl: 'https://storage.googleapis.com/bucket/old.png' }
      const withNewLogo = { ...mockLeague, logoUrl: 'https://storage.googleapis.com/bucket/logo.png' }

      chain = makeChain([leagueWithLogo])
      chain.returning.mockResolvedValueOnce([withNewLogo])

      const module = await Test.createTestingModule({
        providers: [
          LeaguesService,
          { provide: DatabaseService, useValue: { db: chain } },
          { provide: StorageService, useValue: mockStorage },
        ],
      }).compile()
      const svc = module.get<LeaguesService>(LeaguesService)

      await svc.uploadLogo(LEAGUE_ID, mockFile)

      expect(mockStorage.deleteFile).toHaveBeenCalledWith(leagueWithLogo.logoUrl)
    })

    it('throws NotFoundException when league does not exist', async () => {
      const emptyChain = makeChain([])
      chain.where.mockReturnValueOnce(emptyChain)

      await expect(service.uploadLogo('bad-id', mockFile)).rejects.toThrow(NotFoundException)
    })
  })
})
