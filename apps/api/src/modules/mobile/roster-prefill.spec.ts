import { MobileTeamsService } from './mobile-teams.service'

// buildRosterRow es puro: se prueba sin BD.
const svc = Object.create(MobileTeamsService.prototype) as any

const hist = {
  playerUid: 'u1', firstName: 'Edwar', lastName: 'Cadena', docNumber: '111', birthDate: '1985-02-01',
  employer: 'Promatch', phone: '3000000000', email: 'edwar@x.co', healthProvider: 'Sanitas',
  docFileUrl: 'private/a/doc.pdf', photoFileUrl: 'private/a/photo.jpg',
  emergencyContactName: 'Ana', emergencyContactPhone: '3110000000', position: 'midfielder', jerseyNumber: 10, sameTeam: true,
}
const profile = { fullName: 'Edwar Cadena', position: null, docNumber: null, phone: null }
const guard = () => ({ docs: new Set<string>(), emails: new Set<string>() })

describe('buildRosterRow (precarga de nómina)', () => {
  it('trae del historial los datos que el perfil no tiene', () => {
    const row = svc.buildRosterRow('reg', 'u1', 'Edwar Cadena', profile, hist, guard())
    expect(row).toMatchObject({
      docNumber: '111', birthDate: '1985-02-01', healthProvider: 'Sanitas', email: 'edwar@x.co',
      employer: 'Promatch', emergencyContactName: 'Ana', phone: '3000000000', jerseyNumber: 10,
    })
  })

  it('el perfil manda sobre el historial en cédula, teléfono y posición', () => {
    const row = svc.buildRosterRow('reg', 'u1', 'Edwar', { ...profile, docNumber: '999', phone: '3209999999', position: 'forward' }, hist, guard())
    expect(row).toMatchObject({ docNumber: '999', phone: '3209999999', position: 'forward' })
  })

  it('el dorsal solo se hereda del mismo equipo', () => {
    const row = svc.buildRosterRow('reg', 'u1', 'Edwar', profile, { ...hist, sameTeam: false }, guard())
    expect(row.jerseyNumber).toBeNull()
  })

  it('no repite cédula ni correo ya usados en la nómina', () => {
    const g = { docs: new Set(['111']), emails: new Set(['edwar@x.co']) }
    const row = svc.buildRosterRow('reg', 'u1', 'Edwar', profile, hist, g)
    expect(row.docNumber).toBeNull()
    expect(row.email).toBeNull()
  })

  it('sin historial queda como antes (nombre partido del perfil)', () => {
    const row = svc.buildRosterRow('reg', 'u2', 'Juan Pérez', { ...profile, fullName: 'Juan Pérez' }, undefined, guard())
    expect(row).toMatchObject({ firstName: 'Juan', lastName: 'Pérez', docNumber: null, birthDate: null })
  })
})
