import { normalizePhone } from './mobile-teams.service'

describe('normalizePhone', () => {
  it('quita +57, espacios y guiones', () => {
    expect(normalizePhone('+57 319 488-1685')).toBe('3194881685')
    expect(normalizePhone('573194881685')).toBe('3194881685')
  })
  it('deja igual un celular de 10 dígitos', () => {
    expect(normalizePhone('3194881685')).toBe('3194881685')
  })
  it('vacío o muy corto es null', () => {
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone('123')).toBeNull()
  })
})
