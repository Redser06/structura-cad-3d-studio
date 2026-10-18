import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { DEFAULT_PROJECT_SEEDS, createDefaultWorld, defaultDisplayProjects } from '../../src/scene/defaults'
import { displayProjectsToWorld, worldToDisplayProjects } from '../../src/scene/display'
import { SceneImportError } from '../../src/scene/errors'
import { decodeShareHash, encodeShareHash, exportWorldJson, importWorldJson } from '../../src/scene/io'
import { migrateToLatest, migrateV2Projects } from '../../src/scene/migrations'
import { worldSchema, type LegacyProjectV2 } from '../../src/scene/schema'
import { SCENE_LIMITS, maxLengthInUnits } from '../../src/scene/schema'
import { feetToMeters, feetToWorldLength, lengthToFeet, metersToFeet } from '../../src/scene/units'
import { moduleFootprintCorners, summarizeSceneIssues, validateWorld } from '../../src/scene/validate'
import {
  commitScene,
  importWorldReplacingStored,
  LEGACY_BACKUP_KEY,
  LEGACY_PROJECTS_KEY,
  LEGACY_QUARANTINE_KEY,
  resolveInitialScene,
  saveSharedToProjects,
  saveWorld,
  WORLD_STORAGE_KEY,
  type StorageLike,
} from '../../src/storage/storage'

function memory(initial: Record<string, string> = {}): StorageLike & { dump: () => Record<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => (data.has(key) ? data.get(key)! : null),
    setItem: (key, value) => { data.set(key, value) },
    removeItem: (key) => { data.delete(key) },
    dump: () => Object.fromEntries(data),
  }
}

const legacyProjects: LegacyProjectV2[] = DEFAULT_PROJECT_SEEDS.map((project) => ({
  id: project.id,
  name: project.name,
  zone: project.zone,
  status: project.status,
  template: project.template,
  width: project.width,
  depth: project.depth,
  height: project.height,
  rafterCount: project.rafterCount,
  postNominal: project.postNominal,
  offsetX: project.offsetX,
  offsetZ: project.offsetZ,
  inWorld: project.inWorld,
}))

describe('scene schema', () => {
  it('defaults units to metric and rotY to 0', () => {
    const parsed = worldSchema.parse({
      schemaVersion: 1,
      site: { width: 12, depth: 10 },
      modules: [
        {
          id: 'a',
          type: 'freestanding-pergola',
          name: 'A',
          params: { width: 4, depth: 3, height: 2.5, rafterCount: 6, postNominal: 6 },
          transform: { x: 0, z: 0 },
        },
      ],
    })
    expect(parsed.units).toBe('metric')
    expect(parsed.modules[0]?.transform.rotY).toBe(0)
  })

  it('rejects unknown keys, bad types, and executable strings', () => {
    const evil = '{"schemaVersion":1,"units":"metric","site":{"width":10,"depth":8},"modules":[],"run":"constructor.constructor(\'return process\')()"}'
    expect(() => importWorldJson(evil)).toThrow(SceneImportError)
    expect(() => importWorldJson('not json')).toThrow(/not JSON/)
    expect(() => importWorldJson('{"schemaVersion":1,"units":"metric","site":{"width":10,"depth":8},"modules":[{"id":"a","type":"nope","name":"A","params":{},"transform":{"x":0,"z":0}}]}')).toThrow(/Invalid scene file/)
    const proto = JSON.parse('{"__proto__":{"polluted":true}}') as { polluted?: boolean }
    expect(proto.polluted).toBeUndefined()
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })

  it('round-trips a world through JSON without executing it', () => {
    const world = createDefaultWorld()
    const text = exportWorldJson(world)
    expect(text).not.toContain('function')
    const imported = importWorldJson(text)
    expect(imported.warnings).toEqual([])
    expect(imported.world).toEqual(world)
  })
})

describe('migrations', () => {
  it('migrates v2 project rows losslessly and keeps them imperial', () => {
    const world = migrateV2Projects(legacyProjects)
    expect(world.units).toBe('imperial')
    expect(world.schemaVersion).toBe(1)
    expect(world.site).toEqual({ width: 42, depth: 36 })
    expect(worldToDisplayProjects(world)).toEqual(DEFAULT_PROJECT_SEEDS)
    const again = migrateToLatest(legacyProjects)
    expect(again).toEqual(world)
  })

  it('includes a module when meta.inWorld was never stored', () => {
    const world = createDefaultWorld()
    const source = world.modules[2]!
    const omitted = { ...source, meta: { zone: source.meta?.zone, status: source.meta?.status } }
    const withoutMeta = { ...source }
    delete withoutMeta.meta
    expect(worldToDisplayProjects({ ...world, modules: [omitted] })[0]?.inWorld).toBe(true)
    expect(worldToDisplayProjects({ ...world, modules: [withoutMeta] })[0]?.inWorld).toBe(true)
    expect(worldToDisplayProjects({
      ...world,
      modules: [{ ...source, meta: { ...source.meta, inWorld: false } }],
    })[0]?.inWorld).toBe(false)
  })

  it('migrates the previous export envelope', () => {
    const world = migrateToLatest({ exportedAt: '2026-01-01', workspace: 'Conor', projects: legacyProjects })
    expect(world.modules).toHaveLength(4)
    expect(world.modules[0]?.meta).toEqual({
      zone: 'House Rear Patio Deck',
      status: 'Ready to Build',
      inWorld: true,
    })
  })

  it('rejects future and unmigratable versions', () => {
    expect(() => migrateToLatest({ schemaVersion: 2, units: 'metric', site: { width: 1, depth: 1 }, modules: [] })).toThrow(/Unsupported schemaVersion 2/)
    expect(() => migrateToLatest({ schemaVersion: 0 })).toThrow(/No migration from schemaVersion 0/)
    expect(() => migrateToLatest({ nope: true })).toThrow(/expected a schemaVersion 1 world/)
  })
})

describe('units', () => {
  it('stores new scenes in metric and shows the original foot values', () => {
    const world = createDefaultWorld()
    expect(world.units).toBe('metric')
    expect(world.site.width).toBeCloseTo(feetToMeters(42), 10)
    expect(defaultDisplayProjects()).toEqual(DEFAULT_PROJECT_SEEDS)
  })

  it('round-trips every slider step the imperial UI can produce', () => {
    for (let feet = 8; feet <= 24; feet += 0.5) {
      expect(lengthToFeet(feetToWorldLength(feet, 'metric'), 'metric')).toBe(feet)
    }
    for (let feet = -18; feet <= 18; feet += 1) {
      expect(lengthToFeet(feetToWorldLength(feet, 'metric'), 'metric')).toBe(feet)
    }
    expect(lengthToFeet(14.0004, 'imperial')).toBe(14.0004)
  })

  it('re-saves metric lengths on the same 0.001 ft grid', () => {
    const offGrid = feetToWorldLength(14.0004, 'metric')
    expect(metersToFeet(offGrid)).toBe(14)
    expect(feetToMeters(metersToFeet(offGrid))).toBe(offGrid)

    for (let thousandths = -500_000; thousandths <= 500_000; thousandths += 50) {
      const feet = thousandths / 1000
      const stored = feetToMeters(feet)
      const once = feetToMeters(metersToFeet(stored))
      const twice = feetToMeters(metersToFeet(once))
      expect(twice).toBe(once)
      expect(once).toBe(stored)
    }

    const world = createDefaultWorld()
    const again = displayProjectsToWorld(worldToDisplayProjects(world), world.units, world.site)
    expect(again).toEqual(world)
  })
})

describe('validation', () => {
  it('accepts the seeded garden and flags overlap and bounds', () => {
    expect(validateWorld(createDefaultWorld())).toEqual([])

    const site = { width: 42, depth: 36 }
    const module = {
      id: 'a',
      type: 'freestanding-pergola' as const,
      name: 'A',
      params: { width: 10, depth: 10, height: 9, rafterCount: 6, postNominal: 6 as const },
      transform: { x: 0, z: 0, rotY: 0 },
    }
    const overlap = worldSchema.parse({
      schemaVersion: 1,
      units: 'imperial',
      site,
      modules: [
        module,
        { ...module, id: 'b', name: 'B' },
      ],
    })
    const overlapIssues = validateWorld(overlap)
    expect(overlapIssues.map((issue) => issue.code)).toEqual(['overlap'])
    expect(overlapIssues[0]?.severity).toBe('warning')

    const outside = worldSchema.parse({
      schemaVersion: 1,
      units: 'imperial',
      site,
      modules: [{ ...module, transform: { x: 20, z: 0, rotY: 0 }, name: 'Edge' }],
    })
    expect(validateWorld(outside).some((issue) => issue.code === 'out-of-bounds' && issue.severity === 'warning')).toBe(true)
    const importedOutside = importWorldJson(JSON.stringify(outside))
    expect(importedOutside.warnings.some((issue) => issue.code === 'out-of-bounds')).toBe(true)
    expect(importedOutside.world.modules[0]?.name).toBe('Edge')

    const sliderOutside = worldSchema.parse({
      schemaVersion: 1,
      units: 'imperial',
      site,
      modules: [{ ...module, params: { ...module.params, width: 24 }, transform: { x: 18, z: 0, rotY: 0 }, name: 'Slider' }],
    })
    expect(importWorldJson(JSON.stringify(sliderOutside)).warnings.some((issue) => issue.code === 'out-of-bounds')).toBe(true)

    const touching = worldSchema.parse({
      schemaVersion: 1,
      units: 'imperial',
      site,
      modules: [
        { ...module, transform: { x: -5, z: 0, rotY: 0 } },
        { ...module, id: 'b', name: 'B', transform: { x: 5, z: 0, rotY: 0 } },
      ],
    })
    expect(validateWorld(touching)).toEqual([])
  })

  it('uses the same Y rotation as three.js', () => {
    const world = worldSchema.parse({
      schemaVersion: 1,
      units: 'metric',
      site: { width: 30, depth: 30 },
      modules: [{
        id: 'spin',
        type: 'garden-beds',
        name: 'Spin',
        params: { width: 4, depth: 2, height: 2, rafterCount: 5, postNominal: 4 },
        transform: { x: 1, z: -2, rotY: Math.PI / 2 },
      }],
    })
    const module = world.modules[0]!
    const group = new THREE.Group()
    group.position.set(module.transform.x, 0, module.transform.z)
    group.rotation.y = module.transform.rotY
    group.updateMatrix()
    const halfW = module.params.width / 2
    const halfD = module.params.depth / 2
    const expected = [halfW, halfD]
    const local = new THREE.Vector3(expected[0], 0, expected[1]).applyMatrix4(group.matrix)
    const corner = moduleFootprintCorners(module)[2]!
    expect(corner.x).toBeCloseTo(local.x, 8)
    expect(corner.z).toBeCloseTo(local.z, 8)
  })

  it('rejects documents outside the hard caps', () => {
    const module = {
      id: 'a',
      type: 'freestanding-pergola' as const,
      name: 'A',
      params: { width: 10, depth: 10, height: 9, rafterCount: 6, postNominal: 6 as const },
      transform: { x: 0, z: 0, rotY: 0 },
    }
    expect(worldSchema.safeParse({
      schemaVersion: 1,
      units: 'imperial',
      site: { width: 42, depth: 36 },
      modules: [{ ...module, params: { ...module.params, rafterCount: SCENE_LIMITS.maxRafterCount + 1 } }],
    }).success).toBe(false)
    expect(worldSchema.safeParse({
      schemaVersion: 1,
      units: 'imperial',
      site: { width: SCENE_LIMITS.maxDimensionFeet, depth: 36 },
      modules: [{ ...module, params: { ...module.params, width: SCENE_LIMITS.maxDimensionFeet } }],
    }).success).toBe(true)
    expect(worldSchema.safeParse({
      schemaVersion: 1,
      units: 'metric',
      site: { width: maxLengthInUnits(SCENE_LIMITS.maxDimensionFeet, 'metric'), depth: 10 },
      modules: [{ ...module, params: { ...module.params, width: maxLengthInUnits(101, 'metric') } }],
    }).success).toBe(false)
    expect(worldSchema.safeParse({
      schemaVersion: 1,
      units: 'imperial',
      site: { width: 42, depth: 36 },
      modules: [{ ...module, transform: { x: SCENE_LIMITS.maxOffsetFeet, z: -SCENE_LIMITS.maxOffsetFeet, rotY: 0 } }],
    }).success).toBe(true)
    expect(worldSchema.safeParse({
      schemaVersion: 1,
      units: 'metric',
      site: { width: 20, depth: 20 },
      modules: [{ ...module, transform: { x: maxLengthInUnits(SCENE_LIMITS.maxOffsetFeet, 'metric') + 1, z: 0, rotY: 0 } }],
    }).success).toBe(false)
    expect(worldSchema.safeParse({
      schemaVersion: 1,
      units: 'imperial',
      site: { width: 42, depth: 36 },
      modules: Array.from({ length: SCENE_LIMITS.maxModules + 1 }, (_, index) => ({
        ...module,
        id: `m-${index}`,
        transform: { x: 0, z: 0, rotY: 0 },
      })),
    }).success).toBe(false)
  })

  it('caps a toast when many placement warnings repeat', () => {
    const module = {
      id: 'a',
      type: 'freestanding-pergola' as const,
      name: 'A',
      params: { width: 10, depth: 10, height: 9, rafterCount: 6, postNominal: 6 as const },
      transform: { x: 0, z: 0, rotY: 0 },
    }
    const crowded = worldSchema.parse({
      schemaVersion: 1,
      units: 'imperial',
      site: { width: 42, depth: 36 },
      modules: Array.from({ length: 8 }, (_, index) => ({
        ...module,
        id: `m-${index}`,
        name: `Module ${index}`,
      })),
    })
    const summary = summarizeSceneIssues(validateWorld(crowded))
    expect(summary).toContain('overlaps')
    expect(summary).toContain('(+')
    expect(summary.length).toBeLessThan(500)
    expect(summarizeSceneIssues([
      { severity: 'warning', code: 'overlap', message: '"A" overlaps "B".', moduleIds: ['a', 'b'] },
      { severity: 'warning', code: 'overlap', message: '"A" overlaps "B".', moduleIds: ['a', 'b'] },
    ])).toBe('"A" overlaps "B".')
  })

  it('rejects duplicate ids', () => {
    const world = worldSchema.parse({
      schemaVersion: 1,
      units: 'imperial',
      site: { width: 40, depth: 40 },
      modules: [
        {
          id: 'same',
          type: 'attached-pergola',
          name: 'One',
          params: { width: 4, depth: 4, height: 3, rafterCount: 5, postNominal: 4 },
          transform: { x: -6, z: 0, rotY: 0 },
        },
        {
          id: 'same',
          type: 'attached-pergola',
          name: 'Two',
          params: { width: 4, depth: 4, height: 3, rafterCount: 5, postNominal: 4 },
          transform: { x: 6, z: 0, rotY: 0 },
        },
      ],
    })
    expect(validateWorld(world).some((issue) => issue.code === 'duplicate-id')).toBe(true)
    expect(() => importWorldJson(JSON.stringify(world))).toThrow(/used more than once/)
  })
})

describe('share hash', () => {
  it('restores a schema world from location.hash', () => {
    const world = createDefaultWorld()
    const hash = encodeShareHash(world, { activeModuleId: 'proj-raised-beds', worldMode: true })
    const decoded = decodeShareHash(hash)
    expect(decoded.status).toBe('restored')
    if (decoded.status !== 'restored') return
    expect(decoded.world).toEqual(world)
    expect(decoded.view).toEqual({ activeModuleId: 'proj-raised-beds', worldMode: true })
  })

  it('restores the previous query hash through the schema', () => {
    const decoded = decodeShareHash('#tpl=freestanding-pergola&w=12&d=10&h=9&r=8&post=6&world=1')
    expect(decoded.status).toBe('restored')
    if (decoded.status !== 'restored') return
    expect(decoded.view.worldMode).toBe(true)
    expect(decoded.world.units).toBe('imperial')
    expect(decoded.world.modules[0]?.params.width).toBe(12)
    expect(decoded.world.modules[0]?.type).toBe('freestanding-pergola')
  })

  it('rejects a hash that is not a scene', () => {
    expect(decodeShareHash('')).toEqual({ status: 'empty' })
    expect(decodeShareHash('#scene=@@@').status).toBe('error')
    expect(decodeShareHash('#tpl=not-real&w=12&d=10&h=9&r=8&post=6&world=1').status).toBe('error')
  })

  it('rejects a hash over 64 KB before decoding it', () => {
    const hash = `#scene=${'A'.repeat(SCENE_LIMITS.maxShareHashChars)}`
    expect(hash.length).toBeGreaterThan(SCENE_LIMITS.maxShareHashChars)
    const decoded = decodeShareHash(hash)
    expect(decoded.status).toBe('error')
    if (decoded.status === 'error') expect(decoded.message).toMatch(/64 KB/)
  })

  it('restores an out-of-bounds link that stays inside the hard caps', () => {
    const world = worldSchema.parse({
      schemaVersion: 1,
      units: 'imperial',
      site: { width: 42, depth: 36 },
      modules: [{
        id: 'shared-module',
        type: 'freestanding-pergola',
        name: 'Shared structure',
        params: { width: 24, depth: 10, height: 9, rafterCount: 8, postNominal: 6 },
        transform: { x: 18, z: 0, rotY: 0 },
      }],
    })
    const decoded = decodeShareHash(encodeShareHash(world, { activeModuleId: 'shared-module', worldMode: false }))
    expect(decoded.status).toBe('restored')
    if (decoded.status !== 'restored') return
    expect(decoded.warnings.some((issue) => issue.code === 'out-of-bounds')).toBe(true)
    expect(decodeShareHash('#tpl=freestanding-pergola&w=12&d=10&h=9&r=100&post=6&world=0').status).toBe('error')
  })
})

describe('storage', () => {
  it('migrates localStorage v2 into a world on load', () => {
    const storage = memory({ [LEGACY_PROJECTS_KEY]: JSON.stringify(legacyProjects) })
    const resolved = resolveInitialScene({ hash: '', storage })
    expect(resolved.migratedFrom).toBe('v2')
    expect(resolved.world.units).toBe('imperial')
    expect(worldToDisplayProjects(resolved.world)).toEqual(DEFAULT_PROJECT_SEEDS)
    saveWorld(storage, resolved.world)
    storage.removeItem(LEGACY_PROJECTS_KEY)
    const second = resolveInitialScene({ hash: '', storage })
    expect(second.migratedFrom).toBeUndefined()
    expect(second.world).toEqual(resolved.world)
    expect(storage.dump()[WORLD_STORAGE_KEY]).toBeTruthy()
  })

  it('does not mark a corrupt world as safe to overwrite', () => {
    const storage = memory({ [WORLD_STORAGE_KEY]: '{not json' })
    const resolved = resolveInitialScene({ hash: '', storage })
    expect(resolved.persist).toBe(false)
    expect(resolved.hashMessage).toBeTruthy()
    expect(storage.getItem(WORLD_STORAGE_KEY)).toBe('{not json')
  })

  it('opens a share link read-only so an edit does not replace stored projects', () => {
    const original = JSON.stringify(legacyProjects)
    const storage = memory({ [LEGACY_PROJECTS_KEY]: original })
    const shared = displayProjectsToWorld(
      [DEFAULT_PROJECT_SEEDS[1]!],
      'metric',
      { width: feetToMeters(42), depth: feetToMeters(36) },
    )
    const resolved = resolveInitialScene({
      hash: encodeShareHash(shared, { activeModuleId: 'proj-garden-lounge', worldMode: true }),
      storage,
    })
    expect(resolved.hashStatus).toBe('restored')
    expect(resolved.persist).toBe(false)
    expect(resolved.view).toEqual({ activeModuleId: 'proj-garden-lounge', worldMode: true })
    expect(resolved.world.modules).toHaveLength(1)

    const before = storage.dump()
    commitScene(storage, resolved.world, resolved.persist)
    expect(storage.dump()).toEqual(before)
    expect(storage.getItem(LEGACY_PROJECTS_KEY)).toBe(original)
    expect(storage.getItem(WORLD_STORAGE_KEY)).toBeNull()
  })

  it('adds a shared scene onto stored projects instead of replacing them', () => {
    const original = JSON.stringify(legacyProjects)
    const storage = memory({ [LEGACY_PROJECTS_KEY]: original })
    const shared = displayProjectsToWorld(
      [{ ...DEFAULT_PROJECT_SEEDS[0]!, id: 'proj-patio-pergola', name: 'Shared patio' }],
      'metric',
      { width: feetToMeters(42), depth: feetToMeters(36) },
    )
    const result = saveSharedToProjects(storage, shared, 'proj-patio-pergola')
    expect(result.added).toBe(1)
    expect(result.activeModuleId).not.toBe('proj-patio-pergola')
    expect(result.world.modules.map((module) => module.id)).toEqual([
      ...legacyProjects.map((project) => project.id),
      result.activeModuleId,
    ])
    expect(result.world.modules.at(-1)?.name).toBe('Shared patio')
    expect(result.world.units).toBe('imperial')
    expect(storage.getItem(LEGACY_PROJECTS_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_BACKUP_KEY)).toBe(original)
    const saved = JSON.parse(storage.getItem(WORLD_STORAGE_KEY) ?? 'null') as { modules: unknown[] }
    expect(saved.modules).toHaveLength(legacyProjects.length + 1)
  })

  it('does not persist an import that fails migration', () => {
    const original = JSON.stringify(legacyProjects)
    const storage = memory({ [LEGACY_PROJECTS_KEY]: original })
    expect(() => importWorldReplacingStored(storage, '{"schemaVersion":2}')).toThrow(SceneImportError)
    expect(storage.getItem(LEGACY_PROJECTS_KEY)).toBe(original)
    expect(storage.getItem(WORLD_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_BACKUP_KEY)).toBe(original)
  })

  it('backs up before a successful import replaces the scene', () => {
    const original = JSON.stringify(legacyProjects)
    const storage = memory({ [LEGACY_PROJECTS_KEY]: original })
    const imported = importWorldReplacingStored(storage, exportWorldJson(createDefaultWorld()))
    expect(imported.world.units).toBe('metric')
    expect(storage.getItem(LEGACY_PROJECTS_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_BACKUP_KEY)).toBe(original)
    expect(storage.getItem(WORLD_STORAGE_KEY)).toBeTruthy()
  })

  it('quarantines one bad v2 row and keeps the rest', () => {
    const rows: Array<Record<string, unknown>> = legacyProjects.map((project) => ({ ...project }))
    const bad = { ...rows[1], template: 'not-a-type' }
    rows[1] = bad
    const original = JSON.stringify(rows)
    const storage = memory({ [LEGACY_PROJECTS_KEY]: original })
    const resolved = resolveInitialScene({ hash: '', storage })
    expect(resolved.persist).toBe(true)
    expect(resolved.world.modules.map((module) => module.id)).toEqual([
      legacyProjects[0]!.id,
      legacyProjects[2]!.id,
      legacyProjects[3]!.id,
    ])
    expect(storage.getItem(LEGACY_QUARANTINE_KEY)).toBe(JSON.stringify([bad]))
    expect(storage.getItem(LEGACY_PROJECTS_KEY)).toBe(original)
    saveWorld(storage, resolved.world)
    expect(storage.getItem(LEGACY_PROJECTS_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_BACKUP_KEY)).toBe(original)
    expect(storage.getItem(LEGACY_QUARANTINE_KEY)).toBe(JSON.stringify([bad]))
  })

  it('does not replace an unreadable v2 list with the demo garden', () => {
    const rows = [{ nope: true }, { also: 'bad' }]
    const original = JSON.stringify(rows)
    const storage = memory({ [LEGACY_PROJECTS_KEY]: original })
    const resolved = resolveInitialScene({ hash: '', storage })
    expect(resolved.persist).toBe(false)
    expect(resolved.world.modules).toEqual([])
    expect(resolved.world.modules).not.toEqual(createDefaultWorld().modules)
    commitScene(storage, createDefaultWorld(), resolved.persist)
    expect(storage.getItem(LEGACY_PROJECTS_KEY)).toBe(original)
    expect(storage.getItem(WORLD_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_QUARANTINE_KEY)).toBe(original)
  })

  it('keeps the v2 key when the saved world cannot be read back', () => {
    const original = JSON.stringify(legacyProjects)
    const backing = memory({ [LEGACY_PROJECTS_KEY]: original })
    let written: string | null = null
    const flaky: StorageLike = {
      getItem: (key) => (key === WORLD_STORAGE_KEY ? (written === null ? null : '{broken') : backing.getItem(key)),
      setItem: (key, value) => {
        if (key === WORLD_STORAGE_KEY) written = value
        else backing.setItem(key, value)
      },
      removeItem: (key) => {
        if (key === WORLD_STORAGE_KEY) written = null
        else backing.removeItem(key)
      },
    }
    expect(() => saveWorld(flaky, createDefaultWorld())).toThrow(/could not be verified/)
    expect(written).toBeNull()
    expect(backing.getItem(LEGACY_PROJECTS_KEY)).toBe(original)
    expect(backing.getItem(LEGACY_BACKUP_KEY)).toBe(original)
  })

  it('does not open an oversized share over stored projects', () => {
    const original = JSON.stringify(legacyProjects)
    const storage = memory({ [LEGACY_PROJECTS_KEY]: original })
    const resolved = resolveInitialScene({
      hash: `#scene=${'A'.repeat(SCENE_LIMITS.maxShareHashChars)}`,
      storage,
    })
    expect(resolved.hashStatus).toBe('error')
    expect(resolved.persist).toBe(true)
    expect(resolved.world.modules).toHaveLength(legacyProjects.length)
    expect(storage.getItem(WORLD_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_PROJECTS_KEY)).toBe(original)
  })
})
