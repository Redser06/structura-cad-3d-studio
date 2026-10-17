import type { ModuleType, PostNominal } from '../scene/schema'

export interface ParsedSpec {
  template: ModuleType
  width: number
  depth: number
  height: number
  rafterCount: number
  postNominal: PostNominal
}

/** Intake always starts from these numbers; the studio keeps the live baseline. */
export const INTAKE_PARSE_BASELINE: ParsedSpec = {
  template: 'attached-pergola',
  width: 14,
  depth: 12,
  height: 9.5,
  rafterCount: 9,
  postNominal: 6,
}

/**
 * Shared structural-text parser. Unmentioned fields stay on `current`,
 * which is how the studio tweak box behaved. Intake passes INTAKE_PARSE_BASELINE
 * so an empty prompt still resolves to 14×12×9.5.
 *
 * The dimension separator is the original character class `[x×by]`, which
 * matches one of x, ×, b, or y — not the word "by".
 */
export function parseSpecification(rawInput: string, current: ParsedSpec): ParsedSpec {
  const raw = rawInput.toLowerCase()
  let template = current.template
  if (raw.includes('raised bed') || raw.includes('planter')) template = 'garden-beds'
  else if (raw.includes('freestanding') || raw.includes('4-post')) template = 'freestanding-pergola'
  else if (raw.includes('veranda') || raw.includes('lean-to') || raw.includes('sloped')) template = 'lean-to-canopy'
  else if (raw.includes('attached') || raw.includes('ledger')) template = 'attached-pergola'

  let width = current.width
  let depth = current.depth
  let height = current.height
  let rafterCount = current.rafterCount
  let postNominal: PostNominal = current.postNominal

  const dimMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:ft|')?\s*[x×by]\s*(\d+(?:\.\d+)?)/)
  if (dimMatch) {
    width = Math.min(24, Math.max(8, parseFloat(dimMatch[1]!)))
    depth = Math.min(18, Math.max(8, parseFloat(dimMatch[2]!)))
  }
  const heightMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:ft|')?\s*(?:height|high|tall|clearance)/)
  if (heightMatch) height = Math.min(12, Math.max(7.5, parseFloat(heightMatch[1]!)))
  const rafterMatch = raw.match(/(\d+)\s*rafter/)
  if (rafterMatch) rafterCount = Math.min(15, Math.max(5, parseInt(rafterMatch[1]!, 10)))
  if (raw.includes('4x4')) postNominal = 4
  if (raw.includes('6x6')) postNominal = 6
  if (raw.includes('8x8')) postNominal = 8

  return { template, width, depth, height, rafterCount, postNominal }
}
