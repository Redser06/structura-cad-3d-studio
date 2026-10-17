import { createDefaultWorld } from '../scene/defaults'
import { SceneImportError } from '../scene/errors'
import { decodeShareHash, importWorldJson, type ImportResult, type ShareView } from '../scene/io'
import { migrateToLatest, migrateV2Projects, partitionLegacyProjects } from '../scene/migrations'
import { worldSchema, type SceneModule, type UnitSystem, type World } from '../scene/schema'
import { feetToWorldLength, lengthToFeet } from '../scene/units'
import { summarizeSceneIssues, validateWorld, type SceneIssue } from '../scene/validate'

export const WORLD_STORAGE_KEY = 'structuracad_world_v1'
export const WORLD_BACKUP_KEY = 'structuracad_world_v1_backup'
export const LEGACY_PROJECTS_KEY = 'structuracad_projects_v2'
export const LEGACY_BACKUP_KEY = 'structuracad_projects_v2_backup'
export const LEGACY_QUARANTINE_KEY = 'structuracad_projects_v2_quarantine'

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
  /** False when stored data could not be read, or a share link is open read-only. */
  persist: boolean
}

export interface SharedSaveResult {
  world: World
  activeModuleId: string
  added: number
  message: string
}

function defaultView(world: World): ShareView {
  return {
    activeModuleId: world.modules[0]?.id ?? 'proj-patio-pergola',
    worldMode: false,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function emptyKeptWorld(): World {
  return {
    schemaVersion: 1,
    units: 'imperial',
    site: { width: 42, depth: 36 },
    modules: [],
  }
}

/** Copy a key once. A later save must not overwrite the original backup. */
function copyIfAbsent(storage: StorageLike, fromKey: string, toKey: string): void {
  if (storage.getItem(toKey) !== null) return
  const value = storage.getItem(fromKey)
  if (value !== null) storage.setItem(toKey, value)
}

export function backupStoredScene(storage: StorageLike): void {
  copyIfAbsent(storage, WORLD_STORAGE_KEY, WORLD_BACKUP_KEY)
  copyIfAbsent(storage, LEGACY_PROJECTS_KEY, LEGACY_BACKUP_KEY)
}

/**
 * Write v1, read it back, and only then remove the legacy key.
 * A failed read restores the previous v1 value and leaves v2 in place.
 */
export function saveWorld(storage: StorageLike, world: World): void {
  const payload = JSON.stringify(world)
  const previousWorld = storage.getItem(WORLD_STORAGE_KEY)
  backupStoredScene(storage)
  storage.setItem(WORLD_STORAGE_KEY, payload)
  try {
    const readBack = storage.getItem(WORLD_STORAGE_KEY)
    if (readBack !== payload) throw new SceneImportError('Saved scene could not be verified.')
    migrateToLatest(JSON.parse(readBack) as unknown)
  } catch (error) {
    if (previousWorld === null) storage.removeItem(WORLD_STORAGE_KEY)
    else storage.setItem(WORLD_STORAGE_KEY, previousWorld)
    if (error instanceof SceneImportError) throw error
    throw new SceneImportError('Saved scene could not be verified.')
  }
  storage.removeItem(LEGACY_PROJECTS_KEY)
}

/** The app's autosave path. A read-only share link passes persist=false and writes nothing. */
export function commitScene(storage: StorageLike, world: World, persist: boolean): void {
  if (!persist) return
  saveWorld(storage, world)
}

function legacyRows(input: unknown): unknown[] | null {
  if (Array.isArray(input)) return input
  if (isRecord(input) && Array.isArray(input.projects)) return input.projects
  return null
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
    let parsed: unknown
    try {
      parsed = JSON.parse(rawLegacy) as unknown
    } catch {
      return {
        world: emptyKeptWorld(),
        persist: false,
        message: 'Saved projects could not be migrated.',
      }
    }
    const rows = legacyRows(parsed)
    if (!rows) {
      return {
        world: emptyKeptWorld(),
        persist: false,
        message: 'Saved projects could not be migrated.',
      }
    }
    let partitioned: ReturnType<typeof partitionLegacyProjects>
    try {
      partitioned = partitionLegacyProjects(rows)
    } catch {
      return {
        world: emptyKeptWorld(),
        persist: false,
        message: 'Saved projects could not be migrated.',
      }
    }
    if (partitioned.rejected.length > 0) {
      storage.setItem(LEGACY_QUARANTINE_KEY, JSON.stringify(partitioned.rejected))
    }
    if (partitioned.projects.length === 0) {
      return {
        world: emptyKeptWorld(),
        persist: false,
        message: 'Saved projects could not be migrated. Unreadable rows were quarantined.',
      }
    }
    const world = migrateV2Projects(partitioned.projects)
    const dropped = partitioned.rejected.length
    return {
      world,
      migratedFrom: 'v2',
      persist: true,
      ...(dropped > 0
        ? { message: `Kept ${world.modules.length} projects. Quarantined ${dropped} unreadable row${dropped === 1 ? '' : 's'}.` }
        : {}),
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
      persist: false,
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

function convertLength(value: number, from: UnitSystem, to: UnitSystem): number {
  if (from === to) return value
  return feetToWorldLength(lengthToFeet(value, from), to)
}

function retargetModule(module: SceneModule, from: UnitSystem, to: UnitSystem, id: string): SceneModule {
  return {
    ...module,
    id,
    params: {
      ...module.params,
      width: convertLength(module.params.width, from, to),
      depth: convertLength(module.params.depth, from, to),
      height: convertLength(module.params.height, from, to),
    },
    transform: {
      x: convertLength(module.transform.x, from, to),
      z: convertLength(module.transform.z, from, to),
      rotY: module.transform.rotY,
    },
    ...(module.refs ? { refs: [...module.refs] } : {}),
    ...(module.meta ? { meta: { ...module.meta } } : {}),
  }
}

function uniqueId(id: string, taken: Set<string>): string {
  if (!taken.has(id)) return id
  let n = 2
  let next = `${id}-shared-${n}`
  while (taken.has(next)) {
    n += 1
    next = `${id}-shared-${n}`
  }
  return next
}

/**
 * Add the open share onto the stored world. Stored modules are kept.
 * An incoming id that collides is renamed. Nothing is written when the
 * stored scene cannot be read.
 */
export function saveSharedToProjects(storage: StorageLike, shared: World, activeModuleId?: string): SharedSaveResult {
  const hasWorld = storage.getItem(WORLD_STORAGE_KEY) !== null
  const hasLegacy = storage.getItem(LEGACY_PROJECTS_KEY) !== null
  let renamedActive = activeModuleId && shared.modules.some((module) => module.id === activeModuleId)
    ? activeModuleId
    : shared.modules[0]?.id ?? ''

  if (!hasWorld && !hasLegacy) {
    saveWorld(storage, shared)
    const count = shared.modules.length
    return {
      world: shared,
      activeModuleId: renamedActive,
      added: count,
      message: `Saved ${count} shared module${count === 1 ? '' : 's'} to your projects.`,
    }
  }

  const stored = loadSceneFromStorage(storage)
  if (!stored.persist) {
    throw new SceneImportError(stored.message ?? 'Saved projects could not be read, so the share was not saved.')
  }
  const base = stored.world

  const taken = new Set(base.modules.map((module) => module.id))
  const added: SceneModule[] = []
  for (const module of shared.modules) {
    const id = uniqueId(module.id, taken)
    if (module.id === renamedActive) renamedActive = id
    taken.add(id)
    added.push(retargetModule(module, shared.units, base.units, id))
  }
  const merged = worldSchema.parse({
    ...base,
    modules: [...base.modules, ...added],
  })
  saveWorld(storage, merged)
  const summary = summarizeSceneIssues(validateWorld(merged))
  const count = added.length
  const lead = `Added ${count} shared module${count === 1 ? '' : 's'} to your projects.`
  return {
    world: merged,
    activeModuleId: renamedActive,
    added: count,
    message: summary ? `${lead} ${summary}` : lead,
  }
}

/**
 * Back up stored keys, then replace them only after the file migrates.
 * A failed migration leaves both keys where they were.
 */
export function importWorldReplacingStored(storage: StorageLike, text: string): ImportResult {
  backupStoredScene(storage)
  const imported = importWorldJson(text)
  saveWorld(storage, imported.world)
  return imported
}
