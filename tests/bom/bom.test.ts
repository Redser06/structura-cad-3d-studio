import { describe, expect, it } from 'vitest'
import { bomToCsv, getAggregatedBOM, getModuleBOM } from '../../src/bom/bom'
import { DEFAULT_PROJECT_SEEDS } from '../../src/scene/defaults'

describe('BOM', () => {
  it('matches the single-structure schedule for each template', () => {
    const attached = getModuleBOM({
      template: 'attached-pergola',
      width: 14,
      depth: 12,
      height: 9.5,
      rafterCount: 9,
      postNominal: 6,
    })
    expect(attached.totalFasteners).toBe(58)
    expect(attached.rows.map((row) => row.part)).toEqual([
      '6×6 Cedar / PT Posts',
      '2×10 Drop Header Beams',
      '2×10 Pressure-Treated Ledger',
      '2×8 Notched Rafters',
      'Simpson ABA66Z Post Bases',
      '1/2" × 8" Galv Thru-Bolts',
      '1/2" × 5" Ledger Lag Screws',
      'Simpson LUS28Z Joist Hangers',
      'Simpson H2.5AZ Hurricane Ties',
    ])
    expect(attached.rows[3]).toMatchObject({ spec: 'Cut @ 13.2 ft', qty: '9 pcs' })
    expect(attached.rows[6]?.qty).toBe('22 pcs')

    const freestanding = getModuleBOM({
      template: 'freestanding-pergola',
      width: 12,
      depth: 10,
      height: 9,
      rafterCount: 8,
      postNominal: 6,
    })
    expect(freestanding.totalFasteners).toBe(68)
    expect(freestanding.rows.map((row) => row.part)).not.toContain('2×10 Pressure-Treated Ledger')
    expect(freestanding.rows[0]?.qty).toBe('4 pcs')

    const veranda = getModuleBOM({
      template: 'lean-to-canopy',
      width: 10,
      depth: 8.5,
      height: 8.5,
      rafterCount: 7,
      postNominal: 4,
    })
    expect(veranda.totalFasteners).toBe(48)
    expect(veranda.rows.find((row) => row.part.includes('Ledger Lag'))?.qty).toBe('16 pcs')

    const beds = getModuleBOM({
      template: 'garden-beds',
      width: 10,
      depth: 9,
      height: 8.5,
      rafterCount: 7,
      postNominal: 4,
    })
    expect(beds.totalFasteners).toBe(64)
    expect(beds.rows.find((row) => row.part.includes('Planter'))).toMatchObject({
      spec: `Cut @ ${(9 * 0.55).toFixed(1)} ft`,
      qty: '12 pcs',
    })
  })

  it('covers every module placed in the garden world', () => {
    const placed = DEFAULT_PROJECT_SEEDS.filter((project) => project.inWorld)
    const world = getAggregatedBOM(placed.map((project) => ({
      name: project.name,
      template: project.template,
      width: project.width,
      depth: project.depth,
      height: project.height,
      rafterCount: project.rafterCount,
      postNominal: project.postNominal,
    })))
    expect(placed).toHaveLength(3)
    expect(world.totalFasteners).toBe(58 + 68 + 64)
    expect(world.rows.some((row) => row.part.startsWith('Main Patio Attached Pergola — '))).toBe(true)
    expect(world.rows.some((row) => row.part.startsWith('Outdoor Kitchen Lean-To Veranda'))).toBe(false)
    expect(world.rows).toHaveLength(
      getModuleBOM(placed[0]!).rows.length
      + getModuleBOM(placed[1]!).rows.length
      + getModuleBOM(placed[2]!).rows.length,
    )
  })

  it('leaves a one-module schedule unprefixed and quotes csv cells', () => {
    const single = getAggregatedBOM([{
      name: 'Only',
      template: 'freestanding-pergola',
      width: 12,
      depth: 10,
      height: 9,
      rafterCount: 8,
      postNominal: 6,
    }])
    expect(single.rows[0]?.part).toBe('6×6 Cedar / PT Posts')
    const csv = bomToCsv([{ part: '6×6 "Posts"', spec: 'Cut @ 9.0 ft', qty: '4 pcs' }])
    expect(csv).toBe(
      'Component / Fastener,Specification / Cut,Quantity\n"6×6 ""Posts""","Cut @ 9.0 ft","4 pcs"',
    )
  })
})
