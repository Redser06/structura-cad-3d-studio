import { displayProjectsToWorld, worldToDisplayProjects, type DisplayProject } from './display'
import type { World } from './schema'
import { feetToMeters } from './units'

export const DEFAULT_SITE_FEET = { width: 42, depth: 36 } as const

/** Seed projects in display feet. These match the original single-file app. */
export const DEFAULT_PROJECT_SEEDS: DisplayProject[] = [
  {
    id: 'proj-patio-pergola',
    name: 'Main Patio Attached Pergola',
    zone: 'House Rear Patio Deck',
    status: 'Ready to Build',
    template: 'attached-pergola',
    width: 14,
    depth: 12,
    height: 9.5,
    rafterCount: 9,
    postNominal: 6,
    offsetX: -7,
    offsetZ: -5,
    rotY: 0,
    inWorld: true,
  },
  {
    id: 'proj-garden-lounge',
    name: 'South Lawn Freestanding Pergola',
    zone: 'South Garden Lawn',
    status: 'In Design',
    template: 'freestanding-pergola',
    width: 12,
    depth: 10,
    height: 9,
    rafterCount: 8,
    postNominal: 6,
    offsetX: 9,
    offsetZ: 6,
    rotY: 0,
    inWorld: true,
  },
  {
    id: 'proj-kitchen-veranda',
    name: 'Outdoor Kitchen Lean-To Veranda',
    zone: 'East Side Return Wall',
    status: 'Ready to Build',
    template: 'lean-to-canopy',
    width: 10,
    depth: 8.5,
    height: 8.5,
    rafterCount: 7,
    postNominal: 4,
    offsetX: 9,
    offsetZ: -6,
    rotY: 0,
    inWorld: false,
  },
  {
    id: 'proj-raised-beds',
    name: 'Cedar Pergola Arbour & Raised Beds',
    zone: 'West Kitchen Garden',
    status: 'Concept Sketch',
    template: 'garden-beds',
    width: 10,
    depth: 9,
    height: 8.5,
    rafterCount: 7,
    postNominal: 4,
    offsetX: -9,
    offsetZ: 8,
    rotY: 0,
    inWorld: true,
  },
]

export function createDefaultWorld(): World {
  return displayProjectsToWorld(DEFAULT_PROJECT_SEEDS, 'metric', {
    width: feetToMeters(DEFAULT_SITE_FEET.width),
    depth: feetToMeters(DEFAULT_SITE_FEET.depth),
  })
}

export function defaultDisplayProjects(): DisplayProject[] {
  return worldToDisplayProjects(createDefaultWorld())
}
