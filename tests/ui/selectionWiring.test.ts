/**
 * @vitest-environment jsdom
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import html from '../../index.html?raw'

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three')
  class WebGLRenderer {
    domElement = document.createElement('canvas')
    shadowMap = { enabled: false, type: 0 }
    setSize(): void {}
    setPixelRatio(): void {}
    render(): void {}
    setClearColor(): void {}
    dispose(): void {}
  }
  return { ...actual, WebGLRenderer }
})

function pressed(id: string): string | null {
  return document.querySelector<HTMLButtonElement>(`.module-include-toggle[data-id="${id}"]`)?.getAttribute('aria-pressed') ?? null
}

function click(selector: string, detail = 0): void {
  const node = document.querySelector(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }))
}

beforeAll(async () => {
  HTMLCanvasElement.prototype.getContext = (() => new Proxy(document.createElement('canvas'), {
    get: (target, prop) => {
      if (prop === 'canvas') return target
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })
      if (typeof prop === 'string') return () => undefined
      return undefined
    },
    set: () => true,
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext
  window.requestAnimationFrame = () => 0
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  document.head.replaceChildren(...parsed.head.childNodes)
  document.body.replaceChildren(...parsed.body.childNodes)
  document.body.querySelector('script')?.remove()
  localStorage.clear()
  await import('../../src/main')
})

describe('selection wiring', () => {
  it('toggles on a screen-reader click and ignores a repeated Enter or Space', () => {
    expect(pressed('proj-kitchen-veranda')).toBe('false')
    click('.module-include-toggle[data-id="proj-kitchen-veranda"]', 0)
    expect(pressed('proj-kitchen-veranda')).toBe('true')

    const patio = document.querySelector<HTMLButtonElement>('.module-include-toggle[data-id="proj-patio-pergola"]')
    if (!patio) throw new Error('missing patio toggle')
    expect(patio.getAttribute('aria-pressed')).toBe('true')
    patio.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }))
    patio.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', repeat: true, bubbles: true, cancelable: true }))
    expect(pressed('proj-patio-pergola')).toBe('true')

    const lounge = document.querySelector<HTMLButtonElement>('.module-include-toggle[data-id="proj-garden-lounge"]')
    if (!lounge) throw new Error('missing lounge toggle')
    lounge.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    lounge.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }))
    expect(pressed('proj-garden-lounge')).toBe('false')
  })

  it('refuses the 3D build when nothing is selected, even after aria-disabled is cleared', () => {
    for (let guard = 0; guard < 8; guard += 1) {
      const selected = document.querySelector<HTMLElement>('.project-card.selected-for-world .proj-card-title')
      if (!selected) break
      selected.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    }
    expect(document.querySelector('.project-card.selected-for-world')).toBeNull()

    const launch = document.querySelector<HTMLButtonElement>('#btn-launch-combined-world')
    const assemble = document.querySelector<HTMLButtonElement>('#btn-open-world-builder')
    const world = document.querySelector<HTMLButtonElement>('#btn-world-mode')
    const toggleAll = document.querySelector<HTMLButtonElement>('#btn-toggle-world-all')
    const sliderX = document.querySelector<HTMLInputElement>('#slider-pos-x')
    if (!launch || !assemble || !world || !toggleAll || !sliderX) throw new Error('missing world controls')

    for (const control of [launch, assemble, world, toggleAll, sliderX]) {
      expect(control.getAttribute('aria-disabled')).toBe('true')
      expect(control.getAttribute('aria-describedby')).toBe('world-selection-hint')
    }
    expect(document.querySelector('#world-selection-hint')?.textContent).toBe('Select a module to open the 3D garden')
    const offsetLabel = document.querySelector('#val-pos-x')?.textContent

    launch.removeAttribute('aria-disabled')
    launch.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    world.removeAttribute('aria-disabled')
    world.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    toggleAll.removeAttribute('aria-disabled')
    toggleAll.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    sliderX.removeAttribute('aria-disabled')
    sliderX.value = '12'
    sliderX.dispatchEvent(new Event('input', { bubbles: true }))

    expect(document.getElementById('view-dashboard')?.classList.contains('active')).toBe(true)
    expect(document.getElementById('view-studio')?.classList.contains('active')).toBe(false)
    expect(document.getElementById('btn-world-mode')?.classList.contains('active')).toBe(false)
    expect(document.querySelector('#val-pos-x')?.textContent).toBe(offsetLabel)
    expect(sliderX.value).not.toBe('12')
  })
})
