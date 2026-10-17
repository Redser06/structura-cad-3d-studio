import * as THREE from 'three'

interface GeometryHost {
  geometry?: THREE.BufferGeometry
  material?: THREE.Material | THREE.Material[]
}

/** Drop geometries from a rebuilt structure. Shared materials are kept. */
export function disposeObject3D(root: THREE.Object3D, sharedMaterials: ReadonlySet<THREE.Material>): void {
  const geometries = new Set<THREE.BufferGeometry>()
  root.traverse((object) => {
    const host = object as THREE.Object3D & GeometryHost
    if (host.geometry) geometries.add(host.geometry)
    if (!host.material) return
    const materials = Array.isArray(host.material) ? host.material : [host.material]
    for (const material of materials) {
      if (!sharedMaterials.has(material)) material.dispose()
    }
  })
  for (const geometry of geometries) geometry.dispose()
}
