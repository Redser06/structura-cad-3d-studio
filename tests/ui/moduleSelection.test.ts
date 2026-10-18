import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECT_SEEDS, createDefaultWorld, defaultDisplayProjects } from '../../src/scene/defaults'
import { displayProjectsToWorld, worldToDisplayProjects, type DisplayProject } from '../../src/scene/display'
import { encodeShareHash } from '../../src/scene/io'
import { feetToMeters } from '../../src/scene/units'
import type { World } from '../../src/scene/schema'
import {
  commitScene,
  LEGACY_PROJECTS_KEY,
  resolveInitialScene,
  WORLD_STORAGE_KEY,
  type StorageLike,
} from '../../src/storage/storage'
import { renderProjectCardsHtml } from '../../src/ui/renderLists'
import {
  activatesSelectionToggle,
  emptyGardenSelectionMessage,
  gardenWorldLaunchDecision,
  toggleProjectInWorld,
} from '../../src/ui/moduleSelection'

function memory(initial: Record<string, string> = {}): StorageLike & { dump: () => Record<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key) => (data.has(key) ? data.get(key)! : null),
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
    dump: () => Object.fromEntries(data),
  }
}

function cloneProjects(projects: DisplayProject[]): DisplayProject[] {
  return projects.map((project) => ({
    ...project,
    ...(project.refs ? { refs: [...project.refs] } : {}),
  }))
}

function withoutInWorld(world: World): unknown[] {
  return world.modules.map((module) => {
    const meta = { ...module.meta }
    delete meta.inWorld
    return { ...module, meta }
  })
}

describe('module selection before the 3D build', () => {
  it('toggles a module on, off, and on again', () => {
    const projects = cloneProjects(defaultDisplayProjects())
    const id = 'proj-kitchen-veranda'
    const untouched = cloneProjects(projects.filter((project) => project.id !== id))
    expect(projects.find((project) => project.id === id)?.inWorld).toBe(false)

    expect(toggleProjectInWorld(projects, id)).toBe(true)
    expect(toggleProjectInWorld(projects, id)).toBe(false)
    expect(toggleProjectInWorld(projects, id)).toBe(true)

    expect(projects.find((project) => project.id === id)?.inWorld).toBe(true)
    expect(projects.filter((project) => project.id !== id)).toEqual(untouched)
    expect(toggleProjectInWorld(projects, 'missing')).toBeUndefined()
    expect(activatesSelectionToggle('Enter')).toBe(true)
    expect(activatesSelectionToggle(' ')).toBe(true)
    expect(activatesSelectionToggle('Spacebar')).toBe(true)
    expect(activatesSelectionToggle('Escape')).toBe(false)
  })

  it('blocks the 3D build when no module is selected', () => {
    const projects = cloneProjects(defaultDisplayProjects()).map((project) => ({ ...project, inWorld: false }))
    expect(gardenWorldLaunchDecision(projects)).toEqual({
      allowed: false,
      message: emptyGardenSelectionMessage(),
    })
    expect(emptyGardenSelectionMessage()).toBe('Select a module to open the 3D garden')

    toggleProjectInWorld(projects, projects[0]!.id)
    expect(gardenWorldLaunchDecision(projects)).toEqual({ allowed: true })
  })

  it('persists a toggled selection through the scene schema without dropping module data', () => {
    const seeded = createDefaultWorld()
    const projects = cloneProjects(worldToDisplayProjects(seeded))
    const beds = projects.find((project) => project.id === 'proj-raised-beds')
    if (!beds) throw new Error('missing beds module')
    beds.refs = ['proj-patio-pergola']
    const before = displayProjectsToWorld(projects, seeded.units, seeded.site)
    expect(before.modules.find((module) => module.id === 'proj-patio-pergola')?.meta?.inWorld).toBe(true)

    expect(toggleProjectInWorld(projects, 'proj-patio-pergola')).toBe(false)
    const world = displayProjectsToWorld(projects, seeded.units, seeded.site)
    const storage = memory()
    commitScene(storage, world, true)

    const loaded = resolveInitialScene({ hash: '', storage })
    expect(loaded.persist).toBe(true)
    expect(worldToDisplayProjects(loaded.world)).toEqual(projects)
    expect(withoutInWorld(loaded.world)).toEqual(withoutInWorld(before))
    expect(loaded.world.modules.find((module) => module.id === 'proj-patio-pergola')?.meta?.inWorld).toBe(false)
    expect(loaded.world.modules.find((module) => module.id === 'proj-raised-beds')?.refs).toEqual(['proj-patio-pergola'])
    expect(loaded.world.modules.find((module) => module.id === 'proj-garden-lounge')?.meta?.inWorld).toBe(true)
    expect(loaded.world.site).toEqual(seeded.site)
    expect(loaded.world.units).toBe(seeded.units)
  })

  it('does not persist a selection change opened from a read-only share link', () => {
    const original = JSON.stringify(DEFAULT_PROJECT_SEEDS)
    const storage = memory({ [LEGACY_PROJECTS_KEY]: original })
    const shared = displayProjectsToWorld(
      [{ ...DEFAULT_PROJECT_SEEDS[0]!, inWorld: true }],
      'metric',
      { width: feetToMeters(42), depth: feetToMeters(36) },
    )
    const resolved = resolveInitialScene({
      hash: encodeShareHash(shared, { activeModuleId: 'proj-patio-pergola', worldMode: true }),
      storage,
    })
    expect(resolved.persist).toBe(false)
    const before = storage.dump()
    const projects = worldToDisplayProjects(resolved.world)
    expect(toggleProjectInWorld(projects, 'proj-patio-pergola')).toBe(false)

    commitScene(
      storage,
      displayProjectsToWorld(projects, resolved.world.units, resolved.world.site),
      resolved.persist,
    )
    expect(storage.dump()).toEqual(before)
    expect(storage.getItem(WORLD_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_PROJECTS_KEY)).toBe(original)
    expect(projects[0]?.inWorld).toBe(false)
  })

  it('renders the existing selected style and aria-pressed on the toggle', () => {
    const [selected, unselected] = defaultDisplayProjects()
    if (!selected || !unselected) throw new Error('missing seed modules')
    const html = renderProjectCardsHtml([
      { ...selected, inWorld: true },
      { ...unselected, id: 'proj-off', name: 'Unselected Lounge', inWorld: false },
    ])
    expect(html).toContain('class="project-card selected-for-world" data-proj-id="proj-patio-pergola"')
    expect(html).toContain('class="project-card" data-proj-id="proj-off"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('type="button"')
    expect(html).not.toContain('class="project-card selected-for-world" data-proj-id="proj-off"')
  })
})
