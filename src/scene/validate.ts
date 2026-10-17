import type { SceneModule, World } from './schema'

export type SceneIssueCode = 'out-of-bounds' | 'overlap' | 'duplicate-id'

const SUMMARY_SAMPLES = 3

export interface SceneIssue {
  severity: 'error' | 'warning'
  code: SceneIssueCode
  message: string
  moduleIds: string[]
}

const EPSILON = 1e-6

interface Vec2 {
  x: number
  z: number
}

/** Footprint corners in the same units as the world, using three.js Y rotation. */
export function moduleFootprintCorners(module: SceneModule): Vec2[] {
  const halfW = module.params.width / 2
  const halfD = module.params.depth / 2
  const cos = Math.cos(module.transform.rotY)
  const sin = Math.sin(module.transform.rotY)
  const locals: Array<[number, number]> = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, halfD],
    [-halfW, halfD],
  ]
  return locals.map(([lx, lz]) => ({
    x: module.transform.x + lx * cos + lz * sin,
    z: module.transform.z - lx * sin + lz * cos,
  }))
}

function insideSite(corners: Vec2[], site: World['site']): boolean {
  const halfW = site.width / 2
  const halfD = site.depth / 2
  return corners.every(
    (corner) =>
      corner.x >= -halfW - EPSILON &&
      corner.x <= halfW + EPSILON &&
      corner.z >= -halfD - EPSILON &&
      corner.z <= halfD + EPSILON,
  )
}

function edgeAxes(corners: Vec2[]): Vec2[] {
  const axes: Vec2[] = []
  for (let i = 0; i < 2; i += 1) {
    const a = corners[i]!
    const b = corners[i + 1]!
    const dx = b.x - a.x
    const dz = b.z - a.z
    const length = Math.hypot(dx, dz) || 1
    axes.push({ x: -dz / length, z: dx / length })
  }
  return axes
}

function project(corners: Vec2[], axis: Vec2): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const corner of corners) {
    const dot = corner.x * axis.x + corner.z * axis.z
    min = Math.min(min, dot)
    max = Math.max(max, dot)
  }
  return [min, max]
}

export function footprintsOverlap(a: Vec2[], b: Vec2[]): boolean {
  const axes = [...edgeAxes(a), ...edgeAxes(b)]
  for (const axis of axes) {
    const [a0, a1] = project(a, axis)
    const [b0, b1] = project(b, axis)
    if (a1 <= b0 + EPSILON || b1 <= a0 + EPSILON) return false
  }
  return true
}

/**
 * Duplicate ids are errors. Overlap and site placement are warnings, so an
 * older export whose sliders put a module outside the plot still loads.
 * The site rectangle is centered on the origin. The footprint is the
 * parametric width × depth, not rafter overhang.
 */
export function validateWorld(world: World): SceneIssue[] {
  const issues: SceneIssue[] = []
  const seen = new Map<string, string>()
  const corners = new Map<string, Vec2[]>()

  for (const module of world.modules) {
    if (seen.has(module.id)) {
      issues.push({
        severity: 'error',
        code: 'duplicate-id',
        message: `Module id "${module.id}" is used more than once.`,
        moduleIds: [module.id],
      })
    }
    seen.set(module.id, module.name)
    const footprint = moduleFootprintCorners(module)
    corners.set(module.id, footprint)
    if (!insideSite(footprint, world.site)) {
      issues.push({
        severity: 'warning',
        code: 'out-of-bounds',
        message: `"${module.name}" sits outside the site (${world.site.width} × ${world.site.depth} ${world.units}).`,
        moduleIds: [module.id],
      })
    }
  }

  const modules = world.modules
  for (let i = 0; i < modules.length; i += 1) {
    for (let j = i + 1; j < modules.length; j += 1) {
      const left = modules[i]!
      const right = modules[j]!
      const leftCorners = corners.get(left.id)
      const rightCorners = corners.get(right.id)
      if (!leftCorners || !rightCorners) continue
      if (footprintsOverlap(leftCorners, rightCorners)) {
        issues.push({
          severity: 'warning',
          code: 'overlap',
          message: `"${left.name}" overlaps "${right.name}".`,
          moduleIds: [left.id, right.id],
        })
      }
    }
  }

  return issues
}

/** Dedupe identical messages and cap how many of each kind a toast will show. */
export function summarizeSceneIssues(issues: SceneIssue[]): string {
  const groups = new Map<SceneIssueCode, string[]>()
  for (const issue of issues) {
    const messages = groups.get(issue.code) ?? []
    if (!messages.includes(issue.message)) messages.push(issue.message)
    groups.set(issue.code, messages)
  }
  const parts: string[] = []
  for (const [code, messages] of groups) {
    if (messages.length === 1) {
      parts.push(messages[0]!)
      continue
    }
    const shown = messages.slice(0, SUMMARY_SAMPLES)
    const extra = messages.length - shown.length
    const noun = code === 'overlap' ? 'overlaps' : code === 'out-of-bounds' ? 'out-of-bounds' : 'duplicate ids'
    parts.push(`${messages.length} ${noun}: ${shown.join(' ')}${extra > 0 ? ` (+${extra} more)` : ''}`)
  }
  return parts.join(' ')
}
