import { InternalServerErrorException } from '@nestjs/common'
import { StorageService } from './storage.service'

const mockSave = jest.fn()
const mockDelete = jest.fn()
const mockFile = jest.fn(() => ({ save: mockSave, delete: mockDelete }))
const mockBucket = jest.fn(() => ({ file: mockFile }))

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn().mockImplementation(() => ({ bucket: mockBucket })),
}))

describe('StorageService', () => {
  let service: StorageService

  const mockMulterFile = (originalname = 'logo.png', mimetype = 'image/png'): Express.Multer.File =>
    ({
      originalname,
      mimetype,
      buffer: Buffer.from('fake-image'),
      fieldname: 'file',
      encoding: '7bit',
      size: 10,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    })

  beforeEach(() => {
    jest.clearAllMocks()
    // Force GCS path in tests
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/fake/credentials.json'
    process.env.GCS_BUCKET = 'test-bucket'
    service = new StorageService()
  })

  afterEach(() => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS
  })

  describe('uploadLogo', () => {
    it('uploads file and returns public URL', async () => {
      mockSave.mockResolvedValue(undefined)

      const url = await service.uploadLogo('organizations/org-1', mockMulterFile())

      expect(mockBucket).toHaveBeenCalledWith('test-bucket')
      expect(mockFile).toHaveBeenCalledWith('organizations/org-1/logo.png')
      expect(mockSave).toHaveBeenCalledWith(expect.any(Buffer), {
        contentType: 'image/png',
        resumable: false,
        public: true,
      })
      expect(url).toBe('https://storage.googleapis.com/test-bucket/organizations/org-1/logo.png')
    })

    it('defaults to .jpg when extension is missing', async () => {
      mockSave.mockResolvedValue(undefined)

      const url = await service.uploadLogo('organizations/org-1', mockMulterFile('logo', 'image/jpeg'))

      expect(url).toContain('logo.jpg')
    })

    it('throws InternalServerErrorException when GCS fails', async () => {
      mockSave.mockRejectedValue(new Error('GCS unavailable'))

      await expect(service.uploadLogo('organizations/org-1', mockMulterFile())).rejects.toThrow(
        InternalServerErrorException,
      )
    })
  })

  describe('uploadBanner', () => {
    it('uploads banner and returns public URL', async () => {
      mockSave.mockResolvedValue(undefined)

      const url = await service.uploadBanner('leagues/league-1', mockMulterFile('banner.jpg', 'image/jpeg'))

      expect(mockFile).toHaveBeenCalledWith('leagues/league-1/banner.jpg')
      expect(url).toBe('https://storage.googleapis.com/test-bucket/leagues/league-1/banner.jpg')
    })
  })

  describe('deleteFile', () => {
    it('deletes file by public URL', async () => {
      mockDelete.mockResolvedValue(undefined)

      await service.deleteFile('https://storage.googleapis.com/test-bucket/organizations/org-1/logo.png')

      expect(mockFile).toHaveBeenCalledWith('organizations/org-1/logo.png')
      expect(mockDelete).toHaveBeenCalledWith({ ignoreNotFound: true })
    })

    it('does nothing for URLs from other buckets', async () => {
      await service.deleteFile('https://storage.googleapis.com/other-bucket/file.png')

      expect(mockDelete).not.toHaveBeenCalled()
    })
  })
})
