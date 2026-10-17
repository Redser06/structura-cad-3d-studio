import { describe, expect, it } from 'vitest'
import { estimateSketchFromPixels } from '../../src/ui/sketchHeuristic'

function pixels(width: number, height: number, paint: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = paint(x, y)
      const idx = (y * width + x) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = a
    }
  }
  return data
}

describe('estimateSketchFromPixels', () => {
  it('is a bounded heuristic, including an empty canvas', () => {
    const dark = pixels(520, 220, () => [6, 11, 20, 255])
    const estimate = estimateSketchFromPixels({
      width: 520,
      height: 220,
      data: dark,
      template: 'attached-pergola',
    })
    expect(estimate).toEqual({
      estWidth: 10,
      estHeight: 8,
      estRafters: 7,
      prompt: '10x12 attached pergola, 8ft height, 6x6 posts, 7 rafters',
    })
  })

  it('maps a full-bleed bright canvas to the upper clamps', () => {
    const bright = pixels(520, 220, () => [200, 220, 255, 255])
    const estimate = estimateSketchFromPixels({
      width: 520,
      height: 220,
      data: bright,
      template: 'lean-to-canopy',
    })
    expect(estimate.estWidth).toBe(20)
    expect(estimate.estHeight).toBe(11)
    expect(estimate.estRafters).toBe(13)
    expect(estimate.prompt).toContain('lean to-canopy')
  })

  it('uses only the bright bounding box', () => {
    const data = pixels(200, 100, (x, y) => (x >= 20 && x <= 60 && y >= 10 && y <= 40 ? [220, 220, 240, 255] : [0, 0, 0, 255]))
    const estimate = estimateSketchFromPixels({
      width: 200,
      height: 100,
      data,
      template: 'garden-beds',
    })
    expect(estimate.estWidth).toBeGreaterThanOrEqual(10)
    expect(estimate.estWidth).toBeLessThan(20)
    expect(estimate.prompt.startsWith(`${estimate.estWidth}x12`)).toBe(true)
  })
})
