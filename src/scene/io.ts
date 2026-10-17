import { ZodError } from 'zod'
import { SceneImportError } from './errors'
import { migrateToLatest } from './migrations'
import {
  SCENE_LIMITS,
  SCHEMA_VERSION,
  formatZodError,
  isModuleType,
  shareSceneSchema,
  worldSchema,
  type ModuleType,
  type PostNominal,
  type ShareScene,
  type World,
} from './schema'
import { validateWorld, type SceneIssue } from './validate'

export interface ImportResult {
  world: World
  warnings: SceneIssue[]
}

function asImportError(error: unknown): SceneImportError {
  if (error instanceof SceneImportError) return error
  if (error instanceof ZodError) {
    const detail = formatZodError(error)
    return new SceneImportError(`Invalid scene file: ${detail}`, [detail])
  }
  if (error instanceof Error) return new SceneImportError(error.message)
  return new SceneImportError('Invalid scene file.')
}

/**
 * Parse JSON text into a World. This never evaluates the file: JSON.parse
 * plus the schema only. Duplicate ids and hard caps reject the file.
 * Site placement and overlap are warnings, so an older export still loads.
 */
export function importWorldJson(text: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text) as unknown
  } catch {
    throw new SceneImportError('Invalid scene file: the file is not JSON.')
  }

  let world: World
  try {
    world = migrateToLatest(data)
  } catch (error) {
    throw asImportError(error)
  }

  const issues = validateWorld(world)
  const errors = issues.filter((issue) => issue.severity === 'error')
  if (errors.length > 0) {
    throw new SceneImportError(
      `Invalid scene file: ${errors.map((issue) => issue.message).join(' ')}`,
      errors.map((issue) => issue.message),
    )
  }
  return { world, warnings: issues.filter((issue) => issue.severity === 'warning') }
}

export function exportWorldJson(world: World): string {
  const parsed = worldSchema.parse(world)
  return JSON.stringify(parsed, null, 2)
}

export interface ShareView {
  activeModuleId: string
  worldMode: boolean
}

export type HashDecodeResult =
  | { status: 'empty' }
  | { status: 'restored'; world: World; view: ShareView; warnings: SceneIssue[] }
  | { status: 'error'; message: string }

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToString(value: string): string {
  const pad = (4 - (value.length % 4)) % 4
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function encodeShareHash(world: World, view: ShareView): string {
  const payload: ShareScene = shareSceneSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    world,
    view,
  })
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  return `#scene=${bytesToBase64Url(bytes)}`
}

const LEGACY_KEYS = ['tpl', 'w', 'd', 'h', 'r', 'post', 'world'] as const

function legacyHashToWorld(hash: string): { world: World; view: ShareView } | null {
  if (!hash.startsWith('#') || hash.startsWith('#scene=')) return null
  const params = new URLSearchParams(hash.slice(1))
  const keys = [...params.keys()]
  if (keys.length !== LEGACY_KEYS.length || !LEGACY_KEYS.every((key) => params.has(key))) return null

  const template = params.get('tpl') ?? ''
  if (!isModuleType(template)) {
    throw new SceneImportError(`Share link archetype "${template}" is not a known module type.`)
  }
  const width = Number(params.get('w'))
  const depth = Number(params.get('d'))
  const height = Number(params.get('h'))
  const rafterCount = Number(params.get('r'))
  const post = Number(params.get('post'))
  const worldFlag = params.get('world')
  if (worldFlag !== '0' && worldFlag !== '1') {
    throw new SceneImportError('Share link world flag must be 0 or 1.')
  }
  if (![4, 6, 8].includes(post)) {
    throw new SceneImportError('Share link post size must be 4, 6, or 8.')
  }

  const world = worldSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    units: 'imperial',
    site: { width: 42, depth: 36 },
    modules: [
      {
        id: 'shared-module',
        type: template,
        name: 'Shared structure',
        params: {
          width,
          depth,
          height,
          rafterCount,
          postNominal: post as PostNominal,
        },
        transform: { x: 0, z: 0, rotY: 0 },
        meta: { zone: '', status: 'In Design', inWorld: worldFlag === '1' },
      },
    ],
  })
  return {
    world,
    view: { activeModuleId: 'shared-module', worldMode: worldFlag === '1' },
  }
}

function restored(world: World, view: ShareView): HashDecodeResult {
  const issues = validateWorld(world)
  const active = world.modules.some((module) => module.id === view.activeModuleId)
    ? view.activeModuleId
    : world.modules[0]?.id
  if (!active) {
    return { status: 'error', message: 'Share link has no modules to restore.' }
  }
  return {
    status: 'restored',
    world,
    view: { activeModuleId: active, worldMode: view.worldMode },
    // A schema-valid share restores even when placement is a warning.
    // Values outside the hard caps never reach this function.
    warnings: issues,
  }
}

export function decodeShareHash(hash: string): HashDecodeResult {
  if (!hash || hash === '#') return { status: 'empty' }
  if (hash.length > SCENE_LIMITS.maxShareHashChars) {
    return { status: 'error', message: 'Share link is larger than 64 KB and was not opened.' }
  }

  try {
    if (hash.startsWith('#scene=')) {
      const encoded = hash.slice('#scene='.length)
      if (!encoded) return { status: 'error', message: 'Share link is missing its scene payload.' }
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(base64UrlToString(encoded)) as unknown
      } catch {
        return { status: 'error', message: 'Share link scene payload is not valid.' }
      }
      const payload = shareSceneSchema.safeParse(parsedJson)
      if (!payload.success) {
        return { status: 'error', message: `Share link could not be restored: ${formatZodError(payload.error)}` }
      }
      return restored(payload.data.world, payload.data.view)
    }

    const legacy = legacyHashToWorld(hash)
    if (!legacy) {
      return { status: 'error', message: 'Share link could not be restored: unrecognized hash.' }
    }
    return restored(legacy.world, legacy.view)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Share link could not be restored.'
    return { status: 'error', message }
  }
}

export function moduleTypeOrDefault(value: string, fallback: ModuleType): ModuleType {
  return isModuleType(value) ? value : fallback
}
