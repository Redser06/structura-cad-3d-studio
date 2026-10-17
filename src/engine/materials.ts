import * as THREE from 'three'

export interface StructureMaterials {
  timber: THREE.MeshStandardMaterial
  timberSecondary: THREE.MeshStandardMaterial
  cedarPlanter: THREE.MeshStandardMaterial
  foliage: THREE.MeshStandardMaterial
  wallContext: THREE.MeshStandardMaterial
  concrete: THREE.MeshStandardMaterial
  steelPlate: THREE.MeshStandardMaterial
  boltGold: THREE.MeshStandardMaterial
  lagRed: THREE.MeshStandardMaterial
  edgeCyan: THREE.LineBasicMaterial
  edgeMuted: THREE.LineBasicMaterial
  edgeBright: THREE.LineBasicMaterial
  drillGuideLine: THREE.LineDashedMaterial
}

export function createStructureMaterials(): StructureMaterials {
  return {
    timber: new THREE.MeshStandardMaterial({
      color: 0x1e324d,
      roughness: 0.62,
      metalness: 0.12,
      transparent: true,
      opacity: 0.92,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
    timberSecondary: new THREE.MeshStandardMaterial({
      color: 0x17263c,
      roughness: 0.65,
      metalness: 0.12,
      transparent: true,
      opacity: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
    cedarPlanter: new THREE.MeshStandardMaterial({
      color: 0x4a3525,
      roughness: 0.7,
      metalness: 0.08,
      transparent: true,
      opacity: 0.88,
    }),
    foliage: new THREE.MeshStandardMaterial({
      color: 0x2d4c3e,
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: 0.85,
    }),
    wallContext: new THREE.MeshStandardMaterial({
      color: 0x0f1829,
      roughness: 0.88,
      metalness: 0.05,
      transparent: true,
      opacity: 0.55,
    }),
    concrete: new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
      metalness: 0.05,
      transparent: true,
      opacity: 0.85,
    }),
    steelPlate: new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.35,
      metalness: 0.78,
    }),
    boltGold: new THREE.MeshStandardMaterial({
      color: 0xd4a373,
      emissive: 0x4a3520,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.82,
    }),
    lagRed: new THREE.MeshStandardMaterial({
      color: 0xe07a5f,
      emissive: 0x5c2618,
      emissiveIntensity: 0.35,
      roughness: 0.32,
      metalness: 0.78,
    }),
    edgeCyan: new THREE.LineBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.58,
    }),
    edgeMuted: new THREE.LineBasicMaterial({
      color: 0x64748b,
      transparent: true,
      opacity: 0.38,
    }),
    edgeBright: new THREE.LineBasicMaterial({
      color: 0xd4a373,
      transparent: true,
      opacity: 0.82,
    }),
    drillGuideLine: new THREE.LineDashedMaterial({
      color: 0xe6ccb2,
      dashSize: 0.18,
      gapSize: 0.1,
      transparent: true,
      opacity: 0.75,
    }),
  }
}

export function sharedMaterialSet(materials: StructureMaterials): Set<THREE.Material> {
  return new Set(Object.values(materials))
}

export type RenderMode = 'blueprint' | 'wireframe' | 'xray'

export function applyRenderMode(materials: StructureMaterials, renderMode: RenderMode): void {
  if (renderMode === 'blueprint') {
    materials.timber.visible = true
    materials.timber.opacity = 0.9
    materials.timberSecondary.visible = true
    materials.timberSecondary.opacity = 0.88
    materials.edgeCyan.opacity = 0.58
  } else if (renderMode === 'wireframe') {
    materials.timber.visible = false
    materials.timberSecondary.visible = false
    materials.edgeCyan.opacity = 0.92
  } else if (renderMode === 'xray') {
    materials.timber.visible = true
    materials.timber.opacity = 0.16
    materials.timberSecondary.visible = true
    materials.timberSecondary.opacity = 0.16
    materials.edgeCyan.opacity = 0.38
  }
}
