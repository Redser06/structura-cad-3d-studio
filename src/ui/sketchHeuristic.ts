import type { ModuleType } from '../scene/schema'

export interface SketchEstimate {
  estWidth: number
  estHeight: number
  estRafters: number
  prompt: string
}

/**
 * HEURISTIC PLACEHOLDER — not a vision model.
 *
 * Scans a canvas for pixels above a fixed brightness threshold, takes the
 * axis-aligned bounding box, and maps that box onto a width, clearance, and
 * rafter count with clamped ratios. It does not detect posts, spans, roof
 * pitch, materials, or hardware.
 *
 * Visible copy still calls this a "vision contour analyzer". Replacing that
 * copy is a Gemini follow-up; this module must not change what the UI says.
 */
export function estimateSketchFromPixels(input: {
  width: number
  height: number
  data: Uint8ClampedArray
  template: ModuleType
}): SketchEstimate {
  let minX = input.width
  let maxX = 0
  let minY = input.height
  let maxY = 0
  for (let y = 0; y < input.height; y += 2) {
    for (let x = 0; x < input.width; x += 2) {
      const idx = (y * input.width + x) * 4
      const red = input.data[idx] ?? 0
      const green = input.data[idx + 1] ?? 0
      const blue = input.data[idx + 2] ?? 0
      if (red > 40 || green > 60 || blue > 90) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  const spanRatio = Math.max(0.4, (maxX - minX) / input.width)
  const heightRatio = Math.max(0.35, (maxY - minY) / input.height)
  const estWidth = Math.min(22, Math.max(10, Math.round(spanRatio * 20 * 2) / 2))
  const estHeight = Math.min(11, Math.max(8, Math.round(heightRatio * 12 * 2) / 2))
  const estRafters = Math.max(6, Math.min(13, Math.round(estWidth * 0.65)))
  const prompt = `${estWidth}x12 ${input.template.replace('-', ' ')}, ${estHeight}ft height, 6x6 posts, ${estRafters} rafters`
  return { estWidth, estHeight, estRafters, prompt }
}
