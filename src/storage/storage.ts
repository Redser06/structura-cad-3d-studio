import { createDefaultWorld } from '../scene/defaults'
import { SceneImportError } from '../scene/errors'
import { decodeShareHash, type ShareView } from '../scene/io'
import { migrateToLatest } from '../scene/migrations'
import type { World } from '../scene/schema'
import type { SceneIssue } from '../scene/validate'

export const WORLD_STORAGE_KEY = 'structuracad_world_v1'
export const LEGACY_PROJECTS_KEY = 'structuracad_projects_v2'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface ResolvedScene {
  world: World
  view: ShareView
  hashStatus: 'empty' | 'restored' | 'error'
  hashMessage?: string
  warnings: SceneIssue[]
  migratedFrom?: 'v2'
  /** False when stored data could not be read, so a later save must not clobber it. */
  persist: boolean
}

function defaultView(world: World): ShareView {
  return {
    activeModuleId: world.modules[0]?.id ?? 'proj-patio-pergola',
    worldMode: false,
  }
}

export function saveWorld(storage: StorageLike, world: World): void {
  storage.setItem(WORLD_STORAGE_KEY, JSON.stringify(world))
}

export function loadSceneFromStorage(storage: StorageLike): {
  world: World
  migratedFrom?: 'v2'
  persist: boolean
  message?: string
} {
  const rawWorld = storage.getItem(WORLD_STORAGE_KEY)
  if (rawWorld !== null) {
    try {
      const world = migrateToLatest(JSON.parse(rawWorld) as unknown)
      return { world, persist: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Saved scene could not be read.'
      return { world: createDefaultWorld(), persist: false, message }
    }
  }

  const rawLegacy = storage.getItem(LEGACY_PROJECTS_KEY)
  if (rawLegacy !== null) {
    try {
      const world = migrateToLatest(JSON.parse(rawLegacy) as unknown)
      return { world, migratedFrom: 'v2', persist: true }
    } catch (error) {
      const message = error instanceof SceneImportError
        ? error.message
        : 'Saved projects could not be migrated.'
      return { world: createDefaultWorld(), persist: false, message }
    }
  }

  return { world: createDefaultWorld(), persist: true }
}

export function resolveInitialScene(input: { hash: string; storage: StorageLike }): ResolvedScene {
  const decoded = decodeShareHash(input.hash)
  if (decoded.status === 'restored') {
    return {
      world: decoded.world,
      view: decoded.view,
      hashStatus: 'restored',
      warnings: decoded.warnings,
      persist: true,
    }
  }

  const stored = loadSceneFromStorage(input.storage)
  return {
    world: stored.world,
    view: defaultView(stored.world),
    hashStatus: decoded.status,
    hashMessage: decoded.status === 'error' ? decoded.message : stored.message,
    warnings: [],
    migratedFrom: stored.migratedFrom,
    persist: stored.persist,
  }
}
