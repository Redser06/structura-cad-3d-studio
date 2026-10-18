import type { DisplayProject } from '../scene/display'

/** Enter and Space both activate a toggle button. Spacebar is the legacy key value. */
export function activatesSelectionToggle(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === 'Spacebar'
}

/**
 * Flip one module's Include-in-world flag.
 * Every other field on every module stays as it was.
 * Returns the new flag, or undefined when the id is not in the list.
 */
export function toggleProjectInWorld(projects: DisplayProject[], id: string): boolean | undefined {
  const project = projects.find((item) => item.id === id)
  if (!project) return undefined
  project.inWorld = !project.inWorld
  return project.inWorld
}

export function selectedModuleCount(projects: readonly { inWorld: boolean }[]): number {
  return projects.reduce((count, project) => count + (project.inWorld ? 1 : 0), 0)
}

export function emptyGardenSelectionMessage(): string {
  return 'Select a module to open the 3D garden'
}

export function gardenWorldLaunchDecision(projects: readonly { inWorld: boolean }[]): {
  allowed: boolean
  message?: string
} {
  if (selectedModuleCount(projects) > 0) return { allowed: true }
  return { allowed: false, message: emptyGardenSelectionMessage() }
}
