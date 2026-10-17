import { z } from 'zod'

export const SCHEMA_VERSION = 1 as const

export const MODULE_TYPES = [
  'attached-pergola',
  'freestanding-pergola',
  'lean-to-canopy',
  'garden-beds',
] as const

export type ModuleType = (typeof MODULE_TYPES)[number]

export const POST_NOMINALS = [4, 6, 8] as const
export type PostNominal = (typeof POST_NOMINALS)[number]

export type UnitSystem = 'metric' | 'imperial'

const postNominalSchema = z.union([z.literal(4), z.literal(6), z.literal(8)])

const dimensionParamsSchema = z
  .object({
    width: z.number().finite().positive(),
    depth: z.number().finite().positive(),
    height: z.number().finite().positive(),
    rafterCount: z.number().int().positive(),
    postNominal: postNominalSchema,
  })
  .strict()

const transformSchema = z
  .object({
    x: z.number().finite(),
    z: z.number().finite(),
    rotY: z.number().finite().default(0),
  })
  .strict()

const metaSchema = z
  .object({
    zone: z.string().optional(),
    status: z.string().optional(),
    inWorld: z.boolean().optional(),
  })
  .strict()

function moduleVariant(type: ModuleType) {
  return z
    .object({
      id: z.string().min(1),
      type: z.literal(type),
      name: z.string(),
      params: dimensionParamsSchema,
      transform: transformSchema,
      refs: z.array(z.string()).optional(),
      meta: metaSchema.optional(),
    })
    .strict()
}

export const moduleSchema = z.discriminatedUnion('type', [
  moduleVariant('attached-pergola'),
  moduleVariant('freestanding-pergola'),
  moduleVariant('lean-to-canopy'),
  moduleVariant('garden-beds'),
])

export const worldSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    units: z.enum(['metric', 'imperial']).default('metric'),
    site: z
      .object({
        width: z.number().finite().positive(),
        depth: z.number().finite().positive(),
      })
      .strict(),
    modules: z.array(moduleSchema),
  })
  .strict()

export const shareViewSchema = z
  .object({
    activeModuleId: z.string().min(1),
    worldMode: z.boolean(),
  })
  .strict()

export const shareSceneSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    world: worldSchema,
    view: shareViewSchema,
  })
  .strict()

export type SceneModule = z.output<typeof moduleSchema>
export type World = z.output<typeof worldSchema>
export type ShareScene = z.output<typeof shareSceneSchema>

export const legacyProjectSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    zone: z.string(),
    status: z.string(),
    template: z.enum(MODULE_TYPES),
    width: z.number().finite(),
    depth: z.number().finite(),
    height: z.number().finite(),
    rafterCount: z.number().int(),
    postNominal: postNominalSchema,
    offsetX: z.number().finite(),
    offsetZ: z.number().finite(),
    inWorld: z.boolean(),
    rotY: z.number().finite().optional(),
  })
  .strict()

export type LegacyProjectV2 = z.output<typeof legacyProjectSchema>

export function isModuleType(value: string): value is ModuleType {
  return (MODULE_TYPES as readonly string[]).includes(value)
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}
