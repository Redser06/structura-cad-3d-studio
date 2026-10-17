import { describe, expect, it } from 'vitest'
import { INTAKE_PARSE_BASELINE, parseSpecification, type ParsedSpec } from '../../src/parser/parseSpecification'

const baseline: ParsedSpec = {
  template: 'freestanding-pergola',
  width: 16,
  depth: 11,
  height: 10,
  rafterCount: 8,
  postNominal: 4,
}

describe('parseSpecification', () => {
  it('keeps the baseline when the text has no structural cues', () => {
    expect(parseSpecification('hello there', baseline)).toEqual(baseline)
    expect(parseSpecification('', INTAKE_PARSE_BASELINE)).toEqual(INTAKE_PARSE_BASELINE)
  })

  it('reads x, ×, and ft separators, and clamps the envelope', () => {
    expect(parseSpecification('18x9', baseline)).toMatchObject({ width: 18, depth: 9 })
    expect(parseSpecification('14.5 × 12.25', baseline)).toMatchObject({ width: 14.5, depth: 12.25 })
    expect(parseSpecification("10ft x 9ft", baseline)).toMatchObject({ width: 10, depth: 9 })
    expect(parseSpecification("11'x8'", baseline)).toMatchObject({ width: 11, depth: 8 })
    expect(parseSpecification('100 x 2', baseline)).toMatchObject({ width: 24, depth: 8 })
    expect(parseSpecification('3 x 100', baseline)).toMatchObject({ width: 8, depth: 18 })
  })

  it('does not treat the word "by" as a dimension separator', () => {
    expect(parseSpecification('14 by 12 pergola', baseline)).toMatchObject({ width: 16, depth: 11 })
    expect(parseSpecification('14b12', baseline)).toMatchObject({ width: 14, depth: 12 })
  })

  it('clamps height and rafter count', () => {
    expect(parseSpecification('3ft tall', baseline).height).toBe(7.5)
    expect(parseSpecification('20ft height', baseline).height).toBe(12)
    expect(parseSpecification('9.5 ft clearance', baseline).height).toBe(9.5)
    expect(parseSpecification('1 rafter', baseline).rafterCount).toBe(5)
    expect(parseSpecification('40 rafters', baseline).rafterCount).toBe(15)
    expect(parseSpecification('10 rafter', baseline).rafterCount).toBe(10)
  })

  it('picks a template from the first matching phrase', () => {
    expect(parseSpecification('raised bed freestanding', baseline).template).toBe('garden-beds')
    expect(parseSpecification('add a planter', baseline).template).toBe('garden-beds')
    expect(parseSpecification('4-post garden', baseline).template).toBe('freestanding-pergola')
    expect(parseSpecification('FREESTANDING', baseline).template).toBe('freestanding-pergola')
    expect(parseSpecification('sloped canopy', baseline).template).toBe('lean-to-canopy')
    expect(parseSpecification('lean-to', baseline).template).toBe('lean-to-canopy')
    expect(parseSpecification('veranda', baseline).template).toBe('lean-to-canopy')
    expect(parseSpecification('ledger at the house', baseline).template).toBe('attached-pergola')
    expect(parseSpecification('attached pergola', baseline).template).toBe('attached-pergola')
  })

  it('lets the last post callout win', () => {
    expect(parseSpecification('use 4x4 posts', baseline).postNominal).toBe(4)
    expect(parseSpecification('use 6x6 posts', baseline).postNominal).toBe(6)
    expect(parseSpecification('4x4 or 8x8', baseline).postNominal).toBe(8)
  })

  it('parses a full studio sentence', () => {
    expect(parseSpecification('16x12 attached pergola, 10ft height, 6x6 posts, 10 rafters', baseline)).toEqual({
      template: 'attached-pergola',
      width: 16,
      depth: 12,
      height: 10,
      rafterCount: 10,
      postNominal: 6,
    })
  })
})
