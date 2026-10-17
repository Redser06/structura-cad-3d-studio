import type { ModuleType } from '../scene/schema'

export interface BomModuleInput {
  name?: string
  template: ModuleType
  width: number
  depth: number
  height: number
  rafterCount: number
  postNominal: number
}

export interface BomRow {
  part: string
  spec: string
  qty: string
}

export interface BomResult {
  rows: BomRow[]
  totalFasteners: number
}

export function getModuleBOM(input: BomModuleInput): BomResult {
  const isAttached = input.template === 'attached-pergola' || input.template === 'lean-to-canopy'
  const postCount = isAttached ? 2 : 4
  const beamCount = isAttached ? 2 : 4
  const lagCount = isAttached ? (Math.floor(input.width / 1.33) + 1) * 2 : 0
  const thruBoltCount = postCount * 4
  const hurricaneTieCount = input.rafterCount * (isAttached ? 1 : 2)
  const hangerCount = isAttached ? input.rafterCount : 0
  const totalFasteners = postCount * 5 + thruBoltCount + lagCount + hurricaneTieCount * 2

  const rows: BomRow[] = [
    {
      part: `${input.postNominal}×${input.postNominal} Cedar / PT Posts`,
      spec: `Cut @ ${input.height.toFixed(1)} ft`,
      qty: `${postCount} pcs`,
    },
    {
      part: '2×10 Drop Header Beams',
      spec: `Cut @ ${input.width.toFixed(1)} ft`,
      qty: `${beamCount} pcs`,
    },
    ...(isAttached
      ? [{
          part: '2×10 Pressure-Treated Ledger',
          spec: `Cut @ ${input.width.toFixed(1)} ft`,
          qty: '1 pc',
        }]
      : []),
    {
      part: '2×8 Notched Rafters',
      spec: `Cut @ ${(input.depth + 1.2).toFixed(1)} ft`,
      qty: `${input.rafterCount} pcs`,
    },
    ...(input.template === 'garden-beds'
      ? [{
          part: '2×6 Cedar Planter Sidewalls',
          spec: `Cut @ ${(input.depth * 0.55).toFixed(1)} ft`,
          qty: '12 pcs',
        }]
      : []),
    {
      part: `Simpson ABA${input.postNominal}${input.postNominal}Z Post Bases`,
      spec: '5/8"×5" Wedge Anchor',
      qty: `${postCount} sets`,
    },
    {
      part: '1/2" × 8" Galv Thru-Bolts',
      spec: '9/16" Bore + Washers',
      qty: `${thruBoltCount} pcs`,
    },
    ...(isAttached
      ? [
          {
            part: '1/2" × 5" Ledger Lag Screws',
            spec: '16" OC Staggered',
            qty: `${lagCount} pcs`,
          },
          {
            part: 'Simpson LUS28Z Joist Hangers',
            spec: '18-Ga ZMAX',
            qty: `${hangerCount} pcs`,
          },
        ]
      : []),
    {
      part: 'Simpson H2.5AZ Hurricane Ties',
      spec: '+ 6" Timber Screws',
      qty: `${hurricaneTieCount} sets`,
    },
  ]

  return { rows, totalFasteners }
}

/** Single-module results keep the original part names. World mode prefixes each module. */
export function getAggregatedBOM(modules: BomModuleInput[]): BomResult {
  if (modules.length === 1) return getModuleBOM(modules[0]!)
  const rows: BomRow[] = []
  let totalFasteners = 0
  for (const module of modules) {
    const bom = getModuleBOM(module)
    totalFasteners += bom.totalFasteners
    const prefix = module.name ? `${module.name} — ` : ''
    for (const row of bom.rows) {
      rows.push({ ...row, part: `${prefix}${row.part}` })
    }
  }
  return { rows, totalFasteners }
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function bomToCsv(rows: BomRow[]): string {
  const header = 'Component / Fastener,Specification / Cut,Quantity'
  const body = rows.map((row) => [row.part, row.spec, row.qty].map(csvCell).join(',')).join('\n')
  return `${header}\n${body}`
}
