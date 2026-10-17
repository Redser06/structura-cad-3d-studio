import * as THREE from 'three'
import type { ModuleType } from '../scene/schema'
import type { StructureMaterials } from './materials'
import { createBoltAssembly, createCADBox } from './primitives'

export interface StructureSpec {
  template: ModuleType
  width: number
  depth: number
  height: number
  rafterCount: number
  postNominal: number
  offsetX?: number
  offsetZ?: number
  /** Radians. Applied only while world mode is on. */
  rotY?: number
}

export interface BuildOptions {
  worldMode: boolean
  isPrimaryFocused: boolean
  explodeFactor: number
  buildStep: number
  materials: StructureMaterials
}

export interface JointAnchor {
  id: 'J1' | 'J2' | 'J3' | 'J4'
  label: string
  worldPos: THREE.Vector3
  camOffset: THREE.Vector3
}

const Y_AXIS = new THREE.Vector3(0, 1, 0)

/**
 * Pure structure builder. Dimensions are feet, matching the original engine.
 * Callers convert metric scene data before calling this.
 */
export function buildStructureModuleGroup(
  spec: StructureSpec,
  options: BuildOptions,
): { group: THREE.Group; jointAnchors: Record<string, JointAnchor> | null } {
  const mats = options.materials
  const modGroup = new THREE.Group()
  const rotY = options.worldMode ? (spec.rotY ?? 0) : 0
  const ox = options.worldMode ? (spec.offsetX || 0) : 0
  const oz = options.worldMode ? (spec.offsetZ || 0) : 0
  modGroup.position.set(ox, 0, oz)
  modGroup.rotation.y = rotY

  const edgeMat = options.isPrimaryFocused ? mats.edgeCyan : mats.edgeMuted
  const W = spec.width
  const D = spec.depth
  const H = spec.height
  const postThick = (spec.postNominal - 0.5) / 12
  const beamH = 9.25 / 12
  const beamThick = 1.5 / 12
  const rafterH = 7.25 / 12
  const rafterThick = 1.5 / 12
  const ex = options.isPrimaryFocused ? options.explodeFactor : 0

  const isAttached = spec.template === 'attached-pergola' || spec.template === 'lean-to-canopy'
  const isSloped = spec.template === 'lean-to-canopy'
  const hasGardenBeds = spec.template === 'garden-beds'
  const wallRise = isSloped ? 1.6 : 0

  const halfW = W / 2
  const halfD = D / 2
  const postInsetX = Math.min(1.5, W * 0.1)
  const postXPositions = [-halfW + postInsetX, halfW - postInsetX]
  const frontZ = halfD - 0.8
  const backZ = -halfD

  if (isAttached) {
    const wallH = H + wallRise + 3.0
    const wallGroup = createCADBox(W + 3, wallH, 0.75, mats.wallContext, edgeMat)
    wallGroup.position.set(0, wallH / 2, backZ - 0.375)
    modGroup.add(wallGroup)

    const patioSlab = createCADBox(W + 1.5, 0.14, D + 1.2, mats.wallContext, edgeMat)
    patioSlab.position.set(0, -0.07, 0.2)
    modGroup.add(patioSlab)
  }

  if (hasGardenBeds) {
    ;[-halfW + 2.2, halfW - 2.2].forEach((bx) => {
      const bedOuter = createCADBox(3.6, 1.8, D * 0.55, mats.cedarPlanter, mats.edgeBright)
      bedOuter.position.set(bx, 0.9, 0)
      modGroup.add(bedOuter)
      const shrub = createCADBox(3.1, 0.65, D * 0.48, mats.foliage, edgeMat)
      shrub.position.set(bx, 1.95, 0)
      modGroup.add(shrub)
    })
  }

  if (options.buildStep >= 1) {
    const zRows = isAttached ? [frontZ] : [frontZ, backZ + 0.8]
    zRows.forEach((pz) => {
      postXPositions.forEach((px) => {
        const pier = createCADBox(1.3, 1.2, 1.3, mats.concrete, edgeMat)
        pier.position.set(px, -0.6, pz)
        modGroup.add(pier)

        const baseGroup = new THREE.Group()
        const standoff = createCADBox(postThick + 0.04, 0.08, postThick + 0.04, mats.steelPlate, mats.edgeBright)
        standoff.position.y = 0.04
        baseGroup.add(standoff)

        const flangeL = createCADBox(0.03, 0.48, postThick * 0.85, mats.steelPlate, mats.edgeBright)
        flangeL.position.set(-(postThick / 2 + 0.02) - ex * 0.35, 0.26, 0)
        const flangeR = createCADBox(0.03, 0.48, postThick * 0.85, mats.steelPlate, mats.edgeBright)
        flangeR.position.set(postThick / 2 + 0.02 + ex * 0.35, 0.26, 0)
        baseGroup.add(flangeL, flangeR)

        const anchorBolt = createBoltAssembly(0.65, 0.045, 'y', true, ex * 0.8, mats)
        anchorBolt.position.set(0, 0.08, 0)
        baseGroup.add(anchorBolt)

        ;[-0.12, 0.12].forEach((sz) => {
          const sdsL = createBoltAssembly(0.28, 0.025, 'x', true, -ex * 0.75, mats)
          sdsL.position.set(-postThick / 2, 0.28, sz)
          const sdsR = createBoltAssembly(0.28, 0.025, 'x', true, ex * 0.75, mats)
          sdsR.position.set(postThick / 2, 0.28, sz)
          baseGroup.add(sdsL, sdsR)
        })

        baseGroup.position.set(px, 0, pz)
        modGroup.add(baseGroup)
      })
    })
  }

  if (options.buildStep >= 2) {
    const zRows = isAttached ? [frontZ] : [frontZ, backZ + 0.8]
    zRows.forEach((pz) => {
      postXPositions.forEach((px) => {
        const postLift = ex * 0.45
        const postMesh = createCADBox(postThick, H, postThick, mats.timber, edgeMat)
        postMesh.position.set(px, H / 2 + 0.08 + postLift, pz)
        modGroup.add(postMesh)
      })
    })
  }

  if (options.buildStep >= 3) {
    const frontBeamY = H - beamH / 2 + 0.08 + ex * 0.85
    const beamZSpread = postThick / 2 + beamThick / 2 + ex * 0.65

    const frontOuterBeam = createCADBox(W, beamH, beamThick, mats.timberSecondary, edgeMat)
    frontOuterBeam.position.set(0, frontBeamY, frontZ + beamZSpread)
    const frontInnerBeam = createCADBox(W, beamH, beamThick, mats.timberSecondary, edgeMat)
    frontInnerBeam.position.set(0, frontBeamY, frontZ - beamZSpread)
    modGroup.add(frontOuterBeam, frontInnerBeam)

    postXPositions.forEach((px) => {
      const j2Group = new THREE.Group()
      j2Group.position.set(px, H - beamH / 2 + 0.08 + ex * 0.65, frontZ)

      const tStrapFront = createCADBox(0.75, beamH * 0.9, 0.025, mats.steelPlate, mats.edgeBright)
      tStrapFront.position.set(0, 0, beamZSpread + beamThick / 2 + 0.02 + ex * 0.35)
      const tStrapBack = createCADBox(0.75, beamH * 0.9, 0.025, mats.steelPlate, mats.edgeBright)
      tStrapBack.position.set(0, 0, -(beamZSpread + beamThick / 2 + 0.02 + ex * 0.35))
      j2Group.add(tStrapFront, tStrapBack)

      const boltLen = postThick + beamThick * 2 + 0.14
      const b1 = createBoltAssembly(boltLen, 0.032, 'z', false, ex * 1.15, mats)
      b1.position.set(-0.11, 0.14, 0)
      const b2 = createBoltAssembly(boltLen, 0.032, 'z', false, ex * 1.15, mats)
      b2.position.set(0.11, -0.12, 0)
      j2Group.add(b1, b2)

      modGroup.add(j2Group)
    })

    if (isAttached) {
      const ledgerY = H + wallRise - beamH / 2 + 0.08
      const ledgerZ = backZ + beamThick / 2 + ex * 0.55
      const ledger = createCADBox(W, beamH, beamThick, mats.timberSecondary, edgeMat)
      ledger.position.set(0, ledgerY, ledgerZ)
      modGroup.add(ledger)

      const numLags = Math.floor(W / 1.33)
      for (let i = 0; i <= numLags; i += 1) {
        const lx = -halfW + 0.5 + (i / numLags) * (W - 1.0)
        const ly = ledgerY + (i % 2 === 0 ? 0.16 : -0.16)
        const lag = createBoltAssembly(0.42, 0.03, 'z', true, ex * 0.95, mats)
        lag.position.set(lx, ly, ledgerZ + 0.05)
        modGroup.add(lag)
      }
    } else {
      const backPosZ = backZ + 0.8
      const backOuter = createCADBox(W, beamH, beamThick, mats.timberSecondary, edgeMat)
      backOuter.position.set(0, frontBeamY, backPosZ + beamZSpread)
      const backInner = createCADBox(W, beamH, beamThick, mats.timberSecondary, edgeMat)
      backInner.position.set(0, frontBeamY, backPosZ - beamZSpread)
      modGroup.add(backOuter, backInner)

      postXPositions.forEach((px) => {
        const boltLen = postThick + beamThick * 2 + 0.14
        const b1 = createBoltAssembly(boltLen, 0.032, 'z', false, -ex * 1.15, mats)
        b1.position.set(px - 0.11, frontBeamY + 0.14, backPosZ)
        const b2 = createBoltAssembly(boltLen, 0.032, 'z', false, -ex * 1.15, mats)
        b2.position.set(px + 0.11, frontBeamY - 0.12, backPosZ)
        modGroup.add(b1, b2)
      })
    }
  }

  const rafterBaseY = H + 0.08 + rafterH / 2 + ex * 1.35
  const slopeAngle = isSloped ? Math.atan2(wallRise, D) : 0

  if (options.buildStep >= 4) {
    const marginX = 0.65
    const usableW = W - marginX * 2
    for (let i = 0; i < spec.rafterCount; i += 1) {
      const rx = -halfW + marginX + (i / (spec.rafterCount - 1)) * usableW
      const rafterLen = isAttached ? D + 1.2 : D + 1.6
      const rafterGroup = createCADBox(rafterThick, rafterH, rafterLen, mats.timber, edgeMat)

      const midY = rafterBaseY + (isSloped ? wallRise / 2 : 0)
      const midZ = isAttached ? 0.5 : 0
      rafterGroup.position.set(rx, midY, midZ)
      rafterGroup.rotation.x = slopeAngle
      modGroup.add(rafterGroup)

      if (isAttached) {
        const hangerY = H + wallRise - beamH / 2 + 0.08
        const hanger = createCADBox(rafterThick + 0.08, rafterH * 0.85, 0.22, mats.steelPlate, mats.edgeBright)
        hanger.position.set(rx, hangerY, backZ + beamThick + 0.12 + ex * 0.85)
        modGroup.add(hanger)
      }

      const clip = createCADBox(0.03, 0.45, 0.22, mats.steelPlate, mats.edgeBright)
      clip.position.set(rx + rafterThick / 2 + 0.02 + ex * 0.25, H + 0.08 + ex * 1.0, frontZ)
      modGroup.add(clip)

      const topScrew = createBoltAssembly(0.55, 0.024, 'y', true, ex * 0.9, mats)
      topScrew.position.set(rx, rafterBaseY + rafterH / 2, frontZ)
      modGroup.add(topScrew)
    }
  }

  if (options.buildStep >= 5) {
    const purlinCount = Math.floor(D * 0.85)
    const purlinH = 0.14
    for (let p = 0; p < purlinCount; p += 1) {
      const frac = p / (purlinCount - 1)
      const pz = backZ + 0.6 + frac * (D - 0.4)
      const py = rafterBaseY + rafterH / 2 + purlinH / 2 + (isSloped ? (1 - frac) * wallRise : 0) + ex * 1.75
      const purlin = createCADBox(W + 0.6, purlinH, 0.14, mats.timberSecondary, edgeMat)
      purlin.position.set(0, py, pz)
      modGroup.add(purlin)
    }
  }

  if (!options.isPrimaryFocused) {
    return { group: modGroup, jointAnchors: null }
  }

  modGroup.updateMatrix()
  const worldPoint = (x: number, y: number, z: number) =>
    new THREE.Vector3(x, y, z).applyMatrix4(modGroup.matrix)
  const camOffset = (x: number, y: number, z: number) =>
    new THREE.Vector3(x, y, z).applyAxisAngle(Y_AXIS, rotY)

  const rightPostX = postXPositions[1]!
  return {
    group: modGroup,
    jointAnchors: {
      J1: {
        id: 'J1',
        label: 'J1 · Post Base Anchor',
        worldPos: worldPoint(rightPostX, 0.35, frontZ),
        camOffset: camOffset(2.8, 1.4, 2.8),
      },
      J2: {
        id: 'J2',
        label: 'J2 · Post-to-Beam Bolts',
        worldPos: worldPoint(rightPostX, H - 0.25, frontZ),
        camOffset: camOffset(2.9, 1.2, 3.1),
      },
      J3: {
        id: 'J3',
        label: isAttached ? 'J3 · Ledger Lag & Hanger' : 'J3 · Rear Beam Cap',
        worldPos: worldPoint(
          rightPostX * 0.55,
          H + wallRise - 0.2,
          isAttached ? backZ + 0.25 : backZ + 0.8,
        ),
        camOffset: camOffset(2.5, 0.8, 3.2),
      },
      J4: {
        id: 'J4',
        label: 'J4 · Rafter Birdsmouth',
        worldPos: worldPoint(0, H + 0.35, frontZ),
        camOffset: camOffset(2.6, 1.4, 2.7),
      },
    },
  }
}
