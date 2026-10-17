import * as THREE from 'three'
import type { StructureMaterials } from './materials'

export function createCADBox(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  edgeMat: THREE.Material,
): THREE.Group {
  const group = new THREE.Group()
  const geom = new THREE.BoxGeometry(w, h, d)
  const mesh = new THREE.Mesh(geom, material)
  group.add(mesh)
  const edges = new THREE.EdgesGeometry(geom)
  const line = new THREE.LineSegments(edges, edgeMat)
  group.add(line)
  return group
}

export function createBoltAssembly(
  length: number,
  radius: number,
  axis: 'x' | 'y' | 'z',
  isLag: boolean,
  explodeDist: number,
  materials: StructureMaterials,
): THREE.Group {
  const boltGroup = new THREE.Group()
  const mat = isLag ? materials.lagRed : materials.boltGold

  const shankGeo = new THREE.CylinderGeometry(radius, radius, length, 12)
  const shank = new THREE.Mesh(shankGeo, mat)

  const headGeo = new THREE.CylinderGeometry(radius * 2.1, radius * 2.1, radius * 1.4, 6)
  const head = new THREE.Mesh(headGeo, mat)
  head.position.y = length / 2 + radius * 0.7

  const washerGeo = new THREE.CylinderGeometry(radius * 2.8, radius * 2.8, radius * 0.4, 16)
  const washer = new THREE.Mesh(washerGeo, materials.steelPlate)
  washer.position.y = length / 2

  const inner = new THREE.Group()
  inner.add(shank, head, washer)

  if (!isLag) {
    const nut = head.clone()
    nut.position.y = -length / 2 - radius * 0.7
    const washerBack = washer.clone()
    washerBack.position.y = -length / 2
    inner.add(nut, washerBack)
  }

  if (axis === 'z') inner.rotation.x = Math.PI / 2
  if (axis === 'x') inner.rotation.z = -Math.PI / 2

  if (explodeDist > 0) {
    if (axis === 'z') inner.position.z += explodeDist
    if (axis === 'x') inner.position.x += explodeDist
    if (axis === 'y') inner.position.y += explodeDist

    const pts = [new THREE.Vector3(0, 0, 0), inner.position.clone()]
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts)
    const dashLine = new THREE.Line(lineGeo, materials.drillGuideLine)
    dashLine.computeLineDistances()
    boltGroup.add(dashLine)
  }

  boltGroup.add(inner)
  return boltGroup
}
