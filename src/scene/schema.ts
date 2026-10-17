import { z } from 'zod'
import { METERS_PER_FOOT } from './units'

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

/** Hard sanity caps. Soft site placement is a separate warning. */
export const SCENE_LIMITS = {
  maxModules: 50,
  maxRafterCount: 30,
  maxDimensionFeet: 100,
  maxOffsetFeet: 500,
  maxShareHashChars: 64 * 1024,
} as const

const LIMIT_EPSILON = 1e-6

export function maxLengthInUnits(feet: number, units: UnitSystem): number {
  return units === 'metric' ? feet * METERS_PER_FOOT : feet
}

function withinLimit(value: number, max: number): boolean {
  return Math.abs(value) <= max + LIMIT_EPSILON
}

const postNominalSchema = z.union([z.literal(4), z.literal(6), z.literal(8)])

const dimensionParamsSchema = z
  .object({
    width: z.number().finite().positive(),
    depth: z.number().finite().positive(),
    height: z.number().finite().positive(),
    rafterCount: z.number().int().positive().max(SCENE_LIMITS.maxRafterCount),
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
    modules: z.array(moduleSchema).max(SCENE_LIMITS.maxModules),
  })
  .strict()
  .superRefine((world, ctx) => {
    const maxDim = maxLengthInUnits(SCENE_LIMITS.maxDimensionFeet, world.units)
    const maxOffset = maxLengthInUnits(SCENE_LIMITS.maxOffsetFeet, world.units)
    const dims: Array<['width' | 'depth', number]> = [
      ['width', world.site.width],
      ['depth', world.site.depth],
    ]
    for (const [key, value] of dims) {
      if (!withinLimit(value, maxDim)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['site', key],
          message: `${key} exceeds ${SCENE_LIMITS.maxDimensionFeet} ft`,
        })
      }
    }
    world.modules.forEach((module, index) => {
      for (const key of ['width', 'depth', 'height'] as const) {
        if (!withinLimit(module.params[key], maxDim)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['modules', index, 'params', key],
            message: `${key} exceeds ${SCENE_LIMITS.maxDimensionFeet} ft`,
          })
        }
      }
      for (const key of ['x', 'z'] as const) {
        if (!withinLimit(module.transform[key], maxOffset)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['modules', index, 'transform', key],
            message: `${key} exceeds ${SCENE_LIMITS.maxOffsetFeet} ft from the origin`,
          })
        }
      }
    })
  })

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
