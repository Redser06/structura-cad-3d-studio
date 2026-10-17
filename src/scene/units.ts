import type { UnitSystem } from './schema'

/** International foot. Display conversion snaps metric values back to 0.001 ft. */
export const METERS_PER_FOOT = 0.3048

const FEET_DISPLAY_STEP = 0.001

export function feetToMeters(feet: number): number {
  return feet * METERS_PER_FOOT
}

/**
 * Meters to feet for the imperial UI.
 * Snap so a foot value stored as meters comes back as that foot value
 * (14 ft is not exactly representable through IEEE meters).
 */
export function metersToFeet(meters: number): number {
  const feet = meters / METERS_PER_FOOT
  return Math.round(feet / FEET_DISPLAY_STEP) * FEET_DISPLAY_STEP
}

/** Length stored on a World, expressed in feet for the current UI. */
export function lengthToFeet(value: number, units: UnitSystem): number {
  return units === 'imperial' ? value : metersToFeet(value)
}

/** A foot measurement from the UI, stored in the world's unit system. */
export function feetToWorldLength(feet: number, units: UnitSystem): number {
  return units === 'imperial' ? feet : feetToMeters(feet)
}
