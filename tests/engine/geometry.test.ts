import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { buildStructureModuleGroup, type StructureSpec } from '../../src/engine/buildStructure'
import { disposeObject3D } from '../../src/engine/dispose'
import { createStructureMaterials, sharedMaterialSet } from '../../src/engine/materials'
import { DEFAULT_PROJECT_SEEDS } from '../../src/scene/defaults'

function summarize(group: THREE.Object3D) {
  let meshes = 0
  let lines = 0
  group.traverse((object) => {
    const tagged = object as THREE.Object3D & { isMesh?: boolean; isLine?: boolean }
    if (tagged.isMesh) meshes += 1
    if (tagged.isLine) lines += 1
  })
  group.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(group)
  const round = (value: number) => Math.round(value * 1000) / 1000
  return {
    meshes,
    lines,
    min: box.min.toArray().map(round),
    max: box.max.toArray().map(round),
  }
}

function specFromSeed(index: number, extra: Partial<StructureSpec> = {}): StructureSpec {
  const seed = DEFAULT_PROJECT_SEEDS[index]!
  return {
    template: seed.template,
    width: seed.width,
    depth: seed.depth,
    height: seed.height,
    rafterCount: seed.rafterCount,
    postNominal: seed.postNominal,
    offsetX: 0,
    offsetZ: 0,
    rotY: 0,
    ...extra,
  }
}

describe('engine geometry', () => {
  const materials = createStructureMaterials()

  it('snapshots each template', () => {
    const snapshots = DEFAULT_PROJECT_SEEDS.map((seed, index) => {
      const built = buildStructureModuleGroup(specFromSeed(index), {
        worldMode: false,
        isPrimaryFocused: true,
        explodeFactor: 0,
        buildStep: 6,
        materials,
      })
      return { template: seed.template, ...summarize(built.group) }
    })
    expect(new Set(snapshots.map((shot) => shot.meshes)).size).toBeGreaterThan(1)
    expect(snapshots).toMatchInlineSnapshot(`
      [
        {
          "lines": 56,
          "max": [
            8.5,
            12.5,
            7.1,
          ],
          "meshes": 166,
          "min": [
            -8.5,
            -1.2,
            -6.75,
          ],
          "template": "attached-pergola",
        },
        {
          "lines": 52,
          "max": [
            6.3,
            9.993,
            5.8,
          ],
          "meshes": 176,
          "min": [
            -6.3,
            -1.2,
            -5.8,
          ],
          "template": "freestanding-pergola",
        },
        {
          "lines": 47,
          "max": [
            6.5,
            13.1,
            5.322,
          ],
          "meshes": 142,
          "min": [
            -6.5,
            -1.2,
            -5,
          ],
          "template": "lean-to-canopy",
        },
        {
          "lines": 53,
          "max": [
            5.3,
            9.493,
            5.3,
          ],
          "meshes": 174,
          "min": [
            -5.3,
            -1.2,
            -5.3,
          ],
          "template": "garden-beds",
        },
      ]
    `)
  })

  it('applies rotY only in world mode', () => {
    const spec = specFromSeed(1, { offsetX: 4, offsetZ: -2, rotY: Math.PI / 2 })
    const world = buildStructureModuleGroup(spec, {
      worldMode: true,
      isPrimaryFocused: true,
      explodeFactor: 0,
      buildStep: 6,
      materials,
    })
    const single = buildStructureModuleGroup(spec, {
      worldMode: false,
      isPrimaryFocused: true,
      explodeFactor: 0,
      buildStep: 6,
      materials,
    })
    expect(world.group.rotation.y).toBeCloseTo(Math.PI / 2)
    expect(world.group.position.x).toBe(4)
    expect(world.group.position.z).toBe(-2)
    expect(single.group.rotation.y).toBe(0)
    expect(single.group.position.toArray()).toEqual([0, 0, 0])

    world.group.updateMatrix()
    const anchor = world.jointAnchors?.J1
    expect(anchor).toBeTruthy()
    const local = anchor!.worldPos.clone()
    expect(local.distanceTo(new THREE.Vector3(4, 0.35, -2))).toBeGreaterThan(0.5)
    expect(single.jointAnchors?.J2?.camOffset.toArray()).toEqual([2.9, 1.2, 3.1])
  })

  it('disposes rebuilt geometries and keeps shared materials', () => {
    const built = buildStructureModuleGroup(specFromSeed(0), {
      worldMode: false,
      isPrimaryFocused: true,
      explodeFactor: 0.4,
      buildStep: 6,
      materials,
    })
    const geometries: THREE.BufferGeometry[] = []
    built.group.traverse((object) => {
      const host = object as THREE.Object3D & { geometry?: THREE.BufferGeometry }
      if (host.geometry) geometries.push(host.geometry)
    })
    const unique = [...new Set(geometries)]
    let disposed = 0
    for (const geometry of unique) {
      geometry.addEventListener('dispose', () => {
        disposed += 1
      })
    }
    const materialDispose = vi.spyOn(materials.timber, 'dispose')
    disposeObject3D(built.group, sharedMaterialSet(materials))
    expect(disposed).toBe(unique.length)
    expect(disposed).toBeGreaterThan(10)
    expect(materialDispose).not.toHaveBeenCalled()
    materialDispose.mockRestore()
  })
})
