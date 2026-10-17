import { feetToWorldLength, lengthToFeet } from './units'
import { worldSchema, type ModuleType, type PostNominal, type UnitSystem, type World } from './schema'

export interface DisplayProject {
  id: string
  name: string
  zone: string
  status: string
  template: ModuleType
  width: number
  depth: number
  height: number
  rafterCount: number
  postNominal: PostNominal
  offsetX: number
  offsetZ: number
  rotY: number
  inWorld: boolean
  refs?: string[]
}

export function worldToDisplayProjects(world: World): DisplayProject[] {
  return world.modules.map((module) => ({
    id: module.id,
    name: module.name,
    zone: module.meta?.zone ?? '',
    status: module.meta?.status ?? '',
    template: module.type,
    width: lengthToFeet(module.params.width, world.units),
    depth: lengthToFeet(module.params.depth, world.units),
    height: lengthToFeet(module.params.height, world.units),
    rafterCount: module.params.rafterCount,
    postNominal: module.params.postNominal,
    offsetX: lengthToFeet(module.transform.x, world.units),
    offsetZ: lengthToFeet(module.transform.z, world.units),
    rotY: module.transform.rotY,
    inWorld: module.meta?.inWorld ?? false,
    ...(module.refs ? { refs: [...module.refs] } : {}),
  }))
}

export function displayProjectsToWorld(
  projects: DisplayProject[],
  units: UnitSystem,
  site: { width: number; depth: number },
): World {
  return worldSchema.parse({
    schemaVersion: 1,
    units,
    site,
    modules: projects.map((project) => ({
      id: project.id,
      type: project.template,
      name: project.name,
      params: {
        width: feetToWorldLength(project.width, units),
        depth: feetToWorldLength(project.depth, units),
        height: feetToWorldLength(project.height, units),
        rafterCount: project.rafterCount,
        postNominal: project.postNominal,
      },
      transform: {
        x: feetToWorldLength(project.offsetX, units),
        z: feetToWorldLength(project.offsetZ, units),
        rotY: project.rotY,
      },
      ...(project.refs ? { refs: project.refs } : {}),
      meta: {
        zone: project.zone,
        status: project.status,
        inWorld: project.inWorld,
      },
    })),
  })
}
