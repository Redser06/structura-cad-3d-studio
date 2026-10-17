import { SceneImportError } from './errors'
import {
  SCHEMA_VERSION,
  formatZodError,
  legacyProjectSchema,
  worldSchema,
  type LegacyProjectV2,
  type World,
} from './schema'
import { ZodError } from 'zod'

export interface MigrationStep {
  from: number
  migrate: (input: unknown) => unknown
}

/**
 * Version 1 is the first published world shape, so the chain is empty.
 * Later phases append a step that rewrites version N into N+1 before parse.
 */
export const WORLD_MIGRATIONS: MigrationStep[] = []

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function zodError(error: unknown, prefix: string): SceneImportError {
  if (error instanceof ZodError) {
    const detail = formatZodError(error)
    return new SceneImportError(`${prefix}: ${detail}`, [detail])
  }
  if (error instanceof Error) return new SceneImportError(`${prefix}: ${error.message}`)
  return new SceneImportError(prefix)
}

export function parseLegacyProjects(input: unknown): LegacyProjectV2[] {
  if (!Array.isArray(input)) {
    throw new SceneImportError('Invalid legacy project list: expected an array.')
  }
  return input.map((item, index) => {
    const parsed = legacyProjectSchema.safeParse(item)
    if (!parsed.success) {
      throw zodError(parsed.error, `Invalid legacy project at index ${index}`)
    }
    return parsed.data
  })
}

/**
 * Legacy `structuracad_projects_v2` rows are imperial feet.
 * Numbers are copied unchanged so the migration is lossless.
 */
export function migrateV2Projects(projects: LegacyProjectV2[]): World {
  const world: World = {
    schemaVersion: SCHEMA_VERSION,
    units: 'imperial',
    site: { width: 42, depth: 36 },
    modules: projects.map((project) => ({
      id: project.id,
      type: project.template,
      name: project.name,
      params: {
        width: project.width,
        depth: project.depth,
        height: project.height,
        rafterCount: project.rafterCount,
        postNominal: project.postNominal,
      },
      transform: {
        x: project.offsetX,
        z: project.offsetZ,
        rotY: project.rotY ?? 0,
      },
      meta: {
        zone: project.zone,
        status: project.status,
        inWorld: project.inWorld,
      },
    })),
  }
  return worldSchema.parse(world)
}

export function applyMigrationChain(fromVersion: number, input: unknown): unknown {
  let current = input
  for (let version = fromVersion; version < SCHEMA_VERSION; version += 1) {
    const step = WORLD_MIGRATIONS.find((entry) => entry.from === version)
    if (!step) {
      throw new SceneImportError(
        `No migration from schemaVersion ${version} to ${version + 1}.`,
      )
    }
    current = step.migrate(current)
  }
  return current
}

export function migrateToLatest(input: unknown): World {
  if (Array.isArray(input)) {
    return migrateV2Projects(parseLegacyProjects(input))
  }

  if (isRecord(input) && input.schemaVersion == null && Array.isArray(input.projects)) {
    return migrateV2Projects(parseLegacyProjects(input.projects))
  }

  if (isRecord(input) && typeof input.schemaVersion === 'number') {
    if (!Number.isInteger(input.schemaVersion)) {
      throw new SceneImportError('Invalid scene file: schemaVersion must be an integer.')
    }
    if (input.schemaVersion > SCHEMA_VERSION) {
      throw new SceneImportError(
        `Unsupported schemaVersion ${input.schemaVersion}. This build reads schemaVersion ${SCHEMA_VERSION}.`,
      )
    }
    const migrated = applyMigrationChain(input.schemaVersion, input)
    const parsed = worldSchema.safeParse(migrated)
    if (!parsed.success) throw zodError(parsed.error, 'Invalid scene file')
    return parsed.data
  }

  throw new SceneImportError(
    'Invalid scene file: expected a schemaVersion 1 world or a legacy project list.',
  )
}
