import { isRosterOpen } from './mobile-teams.service'

describe('isRosterOpen', () => {
  it('sin candados la nómina está abierta', () => {
    expect(isRosterOpen(null, false)).toBe(true)
  })
  it('hereda el cierre general de la edición', () => {
    expect(isRosterOpen(null, true)).toBe(false)
  })
  it('el candado del equipo manda: puede abrir con todo cerrado', () => {
    expect(isRosterOpen(false, true)).toBe(true)
  })
  it('el candado del equipo manda: puede cerrar con todo abierto', () => {
    expect(isRosterOpen(true, false)).toBe(false)
  })
})
