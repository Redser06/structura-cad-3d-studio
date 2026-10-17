import type { UnitSystem } from './schema'

/** International foot. Display and storage share this 0.001 ft grid. */
export const METERS_PER_FOOT = 0.3048

/**
 * Snap to the nearest thousandth of a foot.
 * Metric storage uses the same grid, so a load then save does not walk
 * the stored meters by about 0.1 mm.
 */
export function snapFeet(feet: number): number {
  return Math.round(feet * 1000) / 1000
}

export function feetToMeters(feet: number): number {
  const thousandths = Math.round(snapFeet(feet) * 1000)
  return (thousandths * METERS_PER_FOOT) / 1000
}

/**
 * Meters to feet for the imperial UI.
 * Snap so a foot value stored as meters comes back as that foot value
 * (14 ft is not exactly representable through IEEE meters).
 */
export function metersToFeet(meters: number): number {
  return snapFeet(meters / METERS_PER_FOOT)
}

/** Length stored on a World, expressed in feet for the current UI. */
export function lengthToFeet(value: number, units: UnitSystem): number {
  return units === 'imperial' ? value : metersToFeet(value)
}

/** A foot measurement from the UI, stored in the world's unit system. */
export function feetToWorldLength(feet: number, units: UnitSystem): number {
  return units === 'imperial' ? feet : feetToMeters(feet)
}
