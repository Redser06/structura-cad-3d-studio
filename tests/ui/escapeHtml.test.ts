import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECT_SEEDS } from '../../src/scene/defaults'
import type { DisplayProject } from '../../src/scene/display'
import { escapeHtml } from '../../src/ui/escapeHtml'
import { renderProjectCardsHtml, renderStudioModuleListHtml, selectAllToast } from '../../src/ui/renderLists'

describe('html escaping', () => {
  it('escapes project names before they are interpolated', () => {
    expect(escapeHtml(`<img src=x onerror=alert(1)>`)).toBe('&lt;img src=x onerror=alert(1)&gt;')
    const hostile: DisplayProject = {
      ...DEFAULT_PROJECT_SEEDS[0]!,
      id: 'proj" onclick="alert(1)',
      name: '<script>alert(1)</script>',
      zone: `East & "West"`,
      status: `<b>Ready</b>`,
    }
    const cards = renderProjectCardsHtml([hostile])
    const studio = renderStudioModuleListHtml([hostile], hostile.id)
    expect(cards).not.toContain('<script>')
    expect(studio).not.toContain('<script>')
    expect(cards).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(cards).toContain('&quot;')
    expect(cards).toContain('East &amp; &quot;West&quot;')
  })

  it('keeps the seeded card copy and the four-module toast', () => {
    const html = renderProjectCardsHtml(DEFAULT_PROJECT_SEEDS)
    expect(html).toContain('Main Patio Attached Pergola')
    expect(html).toContain("House Rear Patio Deck · Plot (-7' X, -5' Z)")
    expect(html).toContain('Ready to Build')
    expect(html).toContain('Cedar Pergola Arbour &amp; Raised Beds')
    expect(selectAllToast(4)).toBe('All 4 garden modules linked to Modular 3D World')
    expect(selectAllToast(1)).toBe('All 1 garden module linked to Modular 3D World')
  })
})
