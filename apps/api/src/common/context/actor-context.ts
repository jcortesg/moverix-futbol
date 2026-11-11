import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Quién está haciendo la petición actual. El middleware abre un contexto vacío
 * por request y el guard de Firebase lo llena al validar el token. La BD lo usa
 * para el log de cambios (ver DatabaseService y migración 0041_change_log).
 */
export interface ActorStore {
  uid?: string
  email?: string
}

export const actorContext = new AsyncLocalStorage<ActorStore>()

export function currentActor(): ActorStore | undefined {
  return actorContext.getStore()
}
