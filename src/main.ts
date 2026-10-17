import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { bomToCsv, getAggregatedBOM, type BomModuleInput } from './bom/bom'
import { buildStructureModuleGroup, type JointAnchor } from './engine/buildStructure'
import { disposeObject3D } from './engine/dispose'
import { applyRenderMode, createStructureMaterials, sharedMaterialSet, type RenderMode } from './engine/materials'
import { createCADBox } from './engine/primitives'
import { INTAKE_PARSE_BASELINE, parseSpecification } from './parser/parseSpecification'
import { displayProjectsToWorld, worldToDisplayProjects, type DisplayProject } from './scene/display'
import { encodeShareHash, importWorldJson } from './scene/io'
import { isModuleType, type ModuleType, type PostNominal, type UnitSystem, type World } from './scene/schema'
import { lengthToFeet } from './scene/units'
import { LEGACY_PROJECTS_KEY, resolveInitialScene, saveWorld } from './storage/storage'
import { JOINT_SPECS } from './ui/jointSpecs'
import {
  renderBomTableHtml,
  renderParsedTagsHtml,
  renderProjectCardsHtml,
  renderStudioModuleListHtml,
  selectAllToast,
} from './ui/renderLists'
import { estimateSketchFromPixels } from './ui/sketchHeuristic'

type ViewName = 'login' | 'dashboard' | 'intake' | 'studio' | 'export'
type JointId = keyof typeof JOINT_SPECS

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing #${id}`)
  return node as T
}

function isViewName(value: string | undefined): value is ViewName {
  return value === 'login' || value === 'dashboard' || value === 'intake' || value === 'studio' || value === 'export'
}

function isJointId(value: string | undefined): value is JointId {
  return value === 'J1' || value === 'J2' || value === 'J3' || value === 'J4'
}

function isPostNominal(value: number): value is PostNominal {
  return value === 4 || value === 6 || value === 8
}

const resolved = resolveInitialScene({
  hash: window.location.hash,
  storage: localStorage,
})

const session: { units: UnitSystem; site: { width: number; depth: number }; persist: boolean } = {
  units: resolved.world.units,
  site: { width: resolved.world.site.width, depth: resolved.world.site.depth },
  persist: resolved.persist,
}

const projects: DisplayProject[] = worldToDisplayProjects(resolved.world)
const first = projects[0]

const state = {
  currentView: 'studio' as ViewName,
  activeProjectId: resolved.view.activeModuleId || first?.id || '',
  worldMode: resolved.view.worldMode,
  template: (first?.template ?? 'attached-pergola') as ModuleType,
  width: first?.width ?? 14,
  depth: first?.depth ?? 12,
  height: first?.height ?? 9.5,
  rafterCount: first?.rafterCount ?? 9,
  postNominal: (first?.postNominal ?? 6) as PostNominal,
  offsetX: first?.offsetX ?? 0,
  offsetZ: first?.offsetZ ?? 0,
  rotY: first?.rotY ?? 0,
  explode: 0,
  renderMode: 'blueprint' as RenderMode,
  buildStep: 6,
  activeJoint: 'J2' as JointId,
}

function currentWorld(): World {
  return displayProjectsToWorld(projects, session.units, session.site)
}

function persistWorld(): void {
  if (!session.persist) return
  try {
    saveWorld(localStorage, currentWorld())
    localStorage.removeItem(LEGACY_PROJECTS_KEY)
  } catch {
    // Private mode or a full quota should not take down the studio.
  }
}

function syncActiveProjectFromState(): void {
  const project = projects.find((item) => item.id === state.activeProjectId)
  if (!project) return
  project.template = state.template
  project.width = state.width
  project.depth = state.depth
  project.height = state.height
  project.rafterCount = state.rafterCount
  project.postNominal = state.postNominal
  project.offsetX = state.offsetX
  project.offsetZ = state.offsetZ
  project.rotY = state.rotY
  persistWorld()
}

function showToast(msg: string): void {
  const toast = el<HTMLElement>('toast-banner')
  toast.textContent = msg
  toast.classList.add('show')
  window.setTimeout(() => toast.classList.remove('show'), 2800)
}

function updateWorldModeButtons(): void {
  const worldCount = projects.filter((project) => project.inWorld).length
  const singleBtn = el<HTMLButtonElement>('btn-single-mode')
  const worldBtn = el<HTMLButtonElement>('btn-world-mode')
  worldBtn.textContent = `Modular Garden World (${worldCount})`
  singleBtn.classList.toggle('active', !state.worldMode)
  worldBtn.classList.toggle('active', state.worldMode)
}

function renderStudioModuleList(): void {
  const listEl = el<HTMLElement>('studio-module-list')
  listEl.innerHTML = renderStudioModuleListHtml(projects, state.activeProjectId)
  listEl.querySelectorAll<HTMLElement>('.world-module-item').forEach((item) => {
    item.addEventListener('click', () => {
      loadProjectIntoState(item.dataset.id ?? '')
      if (state.worldMode) {
        const project = projects.find((entry) => entry.id === item.dataset.id)
        if (project) {
          flyCameraTo(
            new THREE.Vector3((project.offsetX || 0) + 16, 12, (project.offsetZ || 0) + 18),
            new THREE.Vector3(project.offsetX || 0, 4.5, project.offsetZ || 0),
            600,
          )
        }
      }
    })
  })
}

function renderDashboardProjects(): void {
  const container = el<HTMLElement>('project-cards-container')
  const worldCount = projects.filter((project) => project.inWorld).length
  el('world-selected-count').textContent = `${worldCount} Module${worldCount === 1 ? '' : 's'} Linked`
  el('btn-world-mode').textContent = `Modular Garden World (${worldCount})`
  container.innerHTML = renderProjectCardsHtml(projects)

  container.querySelectorAll<HTMLInputElement>('.toggle-world-check').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const project = projects.find((item) => item.id === checkbox.dataset.id)
      if (!project) return
      project.inWorld = checkbox.checked
      persistWorld()
      renderDashboardProjects()
    })
  })

  container.querySelectorAll<HTMLButtonElement>('.open-proj-studio-btn').forEach((button) => {
    button.addEventListener('click', () => {
      state.worldMode = false
      updateWorldModeButtons()
      loadProjectIntoState(button.dataset.id ?? '')
      switchView('studio')
    })
  })
}

function switchView(viewName: ViewName): void {
  state.currentView = viewName
  el('app-nav').classList.toggle('hidden', viewName === 'login')
  document.querySelectorAll('.view-screen').forEach((screen) => screen.classList.remove('active'))
  const target = document.getElementById(`view-${viewName}`)
  if (target) target.classList.add('active')
  document.querySelectorAll<HTMLElement>('.journey-step-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewName)
  })

  if (viewName === 'dashboard') renderDashboardProjects()
  else if (viewName === 'studio') {
    renderStudioModuleList()
    onWindowResize()
    rebuildStructure()
  } else if (viewName === 'export') updateShareUrlDisplay()
}

const container = el<HTMLElement>('viewport-container')
const hotspotLayer = el<HTMLElement>('hotspot-layer')
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 300)
camera.position.set(19, 13, 21)

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
container.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.target.set(0, 4.5, 0)
controls.maxPolarAngle = Math.PI / 2 + 0.08
controls.minDistance = 1.6
controls.maxDistance = 85

interface CameraAnim {
  startPos: THREE.Vector3
  endPos: THREE.Vector3
  startLook: THREE.Vector3
  endLook: THREE.Vector3
  startTime: number
  duration: number
}

let camAnim: CameraAnim | null = null

function flyCameraTo(targetPos: THREE.Vector3, lookAtPos: THREE.Vector3, durationMs = 650): void {
  camAnim = {
    startPos: camera.position.clone(),
    endPos: targetPos.clone(),
    startLook: controls.target.clone(),
    endLook: lookAtPos.clone(),
    startTime: performance.now(),
    duration: durationMs,
  }
}

scene.add(new THREE.AmbientLight(0xdbeafe, 0.82))
const dirLight = new THREE.DirectionalLight(0xf8fafc, 1.25)
dirLight.position.set(22, 32, 26)
dirLight.castShadow = true
scene.add(dirLight)
const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.5)
rimLight.position.set(-22, 14, -18)
scene.add(rimLight)

const gridHelper = new THREE.GridHelper(64, 64, 0x475569, 0x1e293b)
gridHelper.position.y = -0.02
const gridMaterial = gridHelper.material
if (!Array.isArray(gridMaterial)) {
  gridMaterial.opacity = 0.42
  gridMaterial.transparent = true
}
scene.add(gridHelper)

const mats = createStructureMaterials()
const sharedMaterials = sharedMaterialSet(mats)
const structureRoot = new THREE.Group()
scene.add(structureRoot)

let jointAnchors: Record<string, JointAnchor> = {}
const pinElements: Record<string, HTMLButtonElement> = {}

function clearStructureRoot(): void {
  const children = [...structureRoot.children]
  for (const child of children) {
    structureRoot.remove(child)
    disposeObject3D(child, sharedMaterials)
  }
}

function rebuildStructure(): void {
  syncActiveProjectFromState()
  clearStructureRoot()
  jointAnchors = {}

  if (state.worldMode) {
    const siteWidth = lengthToFeet(session.site.width, session.units)
    const siteDepth = lengthToFeet(session.site.depth, session.units)
    const plotBoundary = createCADBox(siteWidth, 0.04, siteDepth, mats.wallContext, mats.edgeMuted)
    plotBoundary.position.set(0, -0.04, 0)
    structureRoot.add(plotBoundary)

    const activeModules = projects.filter((project) => project.inWorld || project.id === state.activeProjectId)
    activeModules.forEach((project) => {
      const built = buildStructureModuleGroup(
        {
          template: project.template,
          width: project.width,
          depth: project.depth,
          height: project.height,
          rafterCount: project.rafterCount,
          postNominal: project.postNominal,
          offsetX: project.offsetX,
          offsetZ: project.offsetZ,
          rotY: project.rotY,
        },
        {
          worldMode: true,
          isPrimaryFocused: project.id === state.activeProjectId,
          explodeFactor: state.explode,
          buildStep: state.buildStep,
          materials: mats,
        },
      )
      structureRoot.add(built.group)
      if (built.jointAnchors) jointAnchors = built.jointAnchors
    })
  } else {
    const built = buildStructureModuleGroup(
      {
        template: state.template,
        width: state.width,
        depth: state.depth,
        height: state.height,
        rafterCount: state.rafterCount,
        postNominal: state.postNominal,
        offsetX: state.offsetX,
        offsetZ: state.offsetZ,
        rotY: state.rotY,
      },
      {
        worldMode: false,
        isPrimaryFocused: true,
        explodeFactor: state.explode,
        buildStep: state.buildStep,
        materials: mats,
      },
    )
    structureRoot.add(built.group)
    if (built.jointAnchors) jointAnchors = built.jointAnchors
  }

  applyRenderMode(mats, state.renderMode)
  syncHotspotDOM()
  updateBOMAndMetrics()
}

function loadProjectIntoState(projectId: string): void {
  const project = projects.find((item) => item.id === projectId)
  if (!project) return
  state.activeProjectId = project.id
  state.template = project.template
  state.width = project.width
  state.depth = project.depth
  state.height = project.height
  state.rafterCount = project.rafterCount
  state.postNominal = project.postNominal
  state.offsetX = project.offsetX || 0
  state.offsetZ = project.offsetZ || 0
  state.rotY = project.rotY || 0

  el<HTMLInputElement>('slider-width').value = String(state.width)
  el<HTMLInputElement>('slider-depth').value = String(state.depth)
  el<HTMLInputElement>('slider-height').value = String(state.height)
  el<HTMLInputElement>('slider-rafters').value = String(state.rafterCount)
  el<HTMLInputElement>('slider-postsize').value = String(state.postNominal)
  el<HTMLInputElement>('slider-pos-x').value = String(state.offsetX)
  el<HTMLInputElement>('slider-pos-z').value = String(state.offsetZ)
  el<HTMLInputElement>('nl-input').value =
    `${state.width}x${state.depth} ${state.template.replace('-', ' ')}, ${state.height}ft height, ${state.postNominal}x${state.postNominal} posts, ${state.rafterCount} rafters`

  document.querySelectorAll<HTMLElement>('.tpl-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.template === state.template)
  })

  renderStudioModuleList()
  rebuildStructure()
}

function modulesForBom(): BomModuleInput[] {
  if (!state.worldMode) {
    return [{
      template: state.template,
      width: state.width,
      depth: state.depth,
      height: state.height,
      rafterCount: state.rafterCount,
      postNominal: state.postNominal,
    }]
  }
  return projects
    .filter((project) => project.inWorld || project.id === state.activeProjectId)
    .map((project) => ({
      name: project.name,
      template: project.template,
      width: project.width,
      depth: project.depth,
      height: project.height,
      rafterCount: project.rafterCount,
      postNominal: project.postNominal,
    }))
}

function updateBOMAndMetrics(): void {
  const ocInches = ((state.width - 1.3) * 12 / (state.rafterCount - 1)).toFixed(1)
  el('val-width').textContent = `${state.width.toFixed(1)} ft`
  el('val-depth').textContent = `${state.depth.toFixed(1)} ft`
  el('val-height').textContent = `${state.height.toFixed(1)} ft`
  el('val-rafters').textContent = `${state.rafterCount} rafters (${ocInches}" OC)`
  el('val-postsize').textContent = `${state.postNominal}×${state.postNominal} Nominal (${state.postNominal - 0.5}")`
  el('val-pos-x').textContent = `${state.offsetX > 0 ? '+' : ''}${state.offsetX.toFixed(1)} ft`
  el('val-pos-z').textContent = `${state.offsetZ > 0 ? '+' : ''}${state.offsetZ.toFixed(1)} ft`
  el('hud-dims-summary').textContent = `${state.width.toFixed(1)}' W × ${state.depth.toFixed(1)}' D × ${state.height.toFixed(1)}' H`

  const { rows, totalFasteners } = getAggregatedBOM(modulesForBom())
  el('bom-total-bolts').textContent = `${totalFasteners} fasteners`
  el('bom-tbody').innerHTML = renderBomTableHtml(rows)
}

function syncHotspotDOM(): void {
  hotspotLayer.innerHTML = ''
  Object.values(jointAnchors).forEach((anchor) => {
    const pin = document.createElement('button')
    pin.className = 'hotspot-pin' + (state.activeJoint === anchor.id ? ' active' : '')
    pin.innerHTML = `<span class="pin-dot"></span><span>${anchor.label}</span>`
    pin.addEventListener('click', () => {
      if (isJointId(anchor.id)) focusJoint(anchor.id, true)
    })
    hotspotLayer.appendChild(pin)
    pinElements[anchor.id] = pin
  })
}

function updateHotspotPositions(): void {
  if (state.currentView !== 'studio') return
  const widthHalf = window.innerWidth / 2
  const heightHalf = window.innerHeight / 2
  Object.values(jointAnchors).forEach((anchor) => {
    const pin = pinElements[anchor.id]
    if (!pin) return
    const pos = anchor.worldPos.clone()
    pos.project(camera)
    if (pos.z > 1) {
      pin.style.display = 'none'
      return
    }
    const x = pos.x * widthHalf + widthHalf
    const y = -(pos.y * heightHalf) + heightHalf
    pin.style.display = 'flex'
    pin.style.left = `${x}px`
    pin.style.top = `${y}px`
  })
}

function focusJoint(jointId: JointId, animateCamera = true): void {
  state.activeJoint = jointId
  document.querySelectorAll<HTMLElement>('.joint-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.joint === jointId)
  })
  Object.entries(pinElements).forEach(([id, pin]) => {
    pin.classList.toggle('active', id === jointId)
  })

  const spec = JOINT_SPECS[jointId]
  el('insp-code').textContent = spec.code
  el('insp-title').textContent = spec.title
  el('insp-per-joint').textContent = spec.perJoint
  el('insp-schematic').innerHTML = `${spec.svg}<span class="schematic-caption">Cross-Section Schematic</span>`
  el('insp-hw-list').innerHTML = spec.hardware.map((item) => `
        <div class="hw-item">
          <span>${item.name}</span>
          <span class="hw-spec">${item.spec}</span>
        </div>
      `).join('')
  el('insp-steps').innerHTML = spec.steps.map((step, index) => `
        <div class="drill-step">
          <span class="drill-num">0${index + 1}</span>
          <span>${step}</span>
        </div>
      `).join('')

  const anchor = jointAnchors[jointId]
  if (animateCamera && anchor) {
    flyCameraTo(anchor.worldPos.clone().add(anchor.camOffset), anchor.worldPos.clone(), 650)
    if (state.explode < 0.25) {
      state.explode = 0.35
      el<HTMLInputElement>('slider-explode').value = '35'
      el('val-explode').textContent = '35% (Separated)'
      rebuildStructure()
    }
    const cameraLabel = el('hud-camera-state').firstElementChild
    if (cameraLabel) cameraLabel.textContent = `View: Zoomed on ${jointId} — ${spec.title}`
  }
}

function resetCameraFullView(): void {
  const cameraLabel = el('hud-camera-state').firstElementChild
  if (state.worldMode) {
    flyCameraTo(new THREE.Vector3(28, 20, 32), new THREE.Vector3(0, 3.5, 0), 650)
    if (cameraLabel) cameraLabel.textContent = 'View: Modular 3D Garden World Orbit'
  } else {
    flyCameraTo(new THREE.Vector3(19, 13, 21), new THREE.Vector3(0, 4.5, 0), 650)
    if (cameraLabel) cameraLabel.textContent = 'View: Full Structure Orbit'
  }
}

function onWindowResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function updateShareUrlDisplay(): void {
  const base = window.location.origin + window.location.pathname
  const hash = encodeShareHash(currentWorld(), {
    activeModuleId: state.activeProjectId,
    worldMode: state.worldMode,
  })
  el('share-url-display').textContent = base + hash
}

function replaceProjects(next: DisplayProject[], activeId: string, worldMode: boolean): void {
  projects.splice(0, projects.length, ...next)
  state.worldMode = worldMode
  updateWorldModeButtons()
  const id = projects.some((project) => project.id === activeId) ? activeId : projects[0]?.id
  if (id) loadProjectIntoState(id)
  else rebuildStructure()
  if (state.currentView === 'dashboard') renderDashboardProjects()
  if (state.currentView === 'export') updateShareUrlDisplay()
}

function adoptWorld(world: World, activeId: string, worldMode: boolean): void {
  session.units = world.units
  session.site = { width: world.site.width, depth: world.site.depth }
  session.persist = true
  replaceProjects(worldToDisplayProjects(world), activeId, worldMode)
}

document.querySelectorAll<HTMLButtonElement>('.journey-step-btn').forEach((button) => {
  button.addEventListener('click', () => {
    if (isViewName(button.dataset.view)) switchView(button.dataset.view)
  })
})
el('nav-home-trigger').addEventListener('click', () => switchView('dashboard'))
el('user-profile-pill').addEventListener('click', () => switchView('login'))
el('quick-studio-link').addEventListener('click', (event) => {
  event.preventDefault()
  switchView('studio')
})

el<HTMLFormElement>('login-form').addEventListener('submit', (event) => {
  event.preventDefault()
  const name = el<HTMLInputElement>('login-name').value.trim()
  const plot = el<HTMLInputElement>('login-plot').value.trim()
  el('user-display-name').textContent = name
  el('dash-plot-label').textContent = `PROPERTY PLOT // ${plot.toUpperCase()}`
  showToast(`Signed in to ${name}`)
  switchView('dashboard')
})

el('btn-go-intake').addEventListener('click', () => switchView('intake'))
el('btn-select-all-world').addEventListener('click', () => {
  projects.forEach((project) => {
    project.inWorld = true
  })
  persistWorld()
  renderDashboardProjects()
  showToast(selectAllToast(projects.length))
})

function launchCombinedGardenWorld(): void {
  state.worldMode = true
  updateWorldModeButtons()
  switchView('studio')
  flyCameraTo(new THREE.Vector3(28, 20, 32), new THREE.Vector3(0, 3.5, 0), 750)
  showToast('Loaded Modular 3D Garden World — all checked projects rendered on plot')
}

el('btn-open-world-builder').addEventListener('click', launchCombinedGardenWorld)
el('btn-launch-combined-world').addEventListener('click', launchCombinedGardenWorld)

const sketchCanvas = el<HTMLCanvasElement>('sketch-pad')
const sketchContext = sketchCanvas.getContext('2d')
if (!sketchContext) throw new Error('Sketch canvas is unavailable')
const sCtx = sketchContext
let isDrawing = false

function drawBlueprintGridOnSketch(): void {
  sCtx.fillStyle = '#060b14'
  sCtx.fillRect(0, 0, sketchCanvas.width, sketchCanvas.height)
  sCtx.strokeStyle = 'rgba(147, 197, 253, 0.08)'
  sCtx.lineWidth = 1
  for (let x = 0; x < sketchCanvas.width; x += 24) {
    sCtx.beginPath()
    sCtx.moveTo(x, 0)
    sCtx.lineTo(x, sketchCanvas.height)
    sCtx.stroke()
  }
  for (let y = 0; y < sketchCanvas.height; y += 24) {
    sCtx.beginPath()
    sCtx.moveTo(0, y)
    sCtx.lineTo(sketchCanvas.width, y)
    sCtx.stroke()
  }
}

function drawSampleSketch(kind: string): void {
  drawBlueprintGridOnSketch()
  sCtx.strokeStyle = '#93c5fd'
  sCtx.lineWidth = 2.5
  sCtx.lineCap = 'round'

  if (kind === 'attached') {
    sCtx.strokeStyle = '#64748b'
    sCtx.strokeRect(60, 25, 45, 165)
    sCtx.strokeStyle = '#93c5fd'
    sCtx.beginPath()
    sCtx.moveTo(105, 58)
    sCtx.lineTo(410, 58)
    sCtx.moveTo(105, 68)
    sCtx.lineTo(410, 68)
    sCtx.stroke()
    sCtx.strokeRect(375, 68, 18, 122)
    sCtx.strokeStyle = '#d4a373'
    sCtx.beginPath(); sCtx.arc(112, 63, 12, 0, Math.PI * 2); sCtx.stroke()
    sCtx.beginPath(); sCtx.arc(384, 68, 12, 0, Math.PI * 2); sCtx.stroke()
    sCtx.beginPath(); sCtx.arc(384, 186, 12, 0, Math.PI * 2); sCtx.stroke()
    sCtx.fillStyle = '#e6ccb2'
    sCtx.font = '11px IBM Plex Mono'
    sCtx.fillText('WALL LEDGER (J3)', 128, 50)
    sCtx.fillText('14.0 ft SPAN × 9.5 ft HIGH', 185, 36)
    sCtx.fillText('6x6 POST (J2/J1)', 398, 130)
  } else if (kind === 'freestanding') {
    sCtx.strokeStyle = '#93c5fd'
    sCtx.strokeRect(95, 52, 330, 14)
    sCtx.strokeRect(125, 66, 16, 122)
    sCtx.strokeRect(378, 66, 16, 122)
    for (let x = 105; x <= 415; x += 38) sCtx.strokeRect(x, 42, 8, 10)
    sCtx.strokeStyle = '#d4a373'
    sCtx.strokeRect(155, 160, 85, 28)
    sCtx.strokeRect(275, 160, 85, 28)
    sCtx.fillStyle = '#e6ccb2'
    sCtx.font = '11px IBM Plex Mono'
    sCtx.fillText('FREESTANDING 12x10 GARDEN PERGOLA + PLANTERS', 110, 30)
  } else if (kind === 'veranda') {
    sCtx.strokeStyle = '#64748b'
    sCtx.strokeRect(65, 20, 40, 170)
    sCtx.strokeStyle = '#93c5fd'
    sCtx.beginPath()
    sCtx.moveTo(105, 42)
    sCtx.lineTo(410, 92)
    sCtx.lineTo(410, 104)
    sCtx.lineTo(105, 54)
    sCtx.closePath()
    sCtx.stroke()
    sCtx.strokeRect(378, 100, 16, 90)
    sCtx.fillStyle = '#e6ccb2'
    sCtx.font = '11px IBM Plex Mono'
    sCtx.fillText('SLOPED VERANDA CANOPY (16° PITCH)', 155, 40)
  }
}

drawSampleSketch('attached')

sketchCanvas.addEventListener('mousedown', (event) => {
  isDrawing = true
  const rect = sketchCanvas.getBoundingClientRect()
  sCtx.strokeStyle = '#93c5fd'
  sCtx.lineWidth = 2.5
  sCtx.beginPath()
  sCtx.moveTo(
    (event.clientX - rect.left) * (sketchCanvas.width / rect.width),
    (event.clientY - rect.top) * (sketchCanvas.height / rect.height),
  )
})
sketchCanvas.addEventListener('mousemove', (event) => {
  if (!isDrawing) return
  const rect = sketchCanvas.getBoundingClientRect()
  sCtx.lineTo(
    (event.clientX - rect.left) * (sketchCanvas.width / rect.width),
    (event.clientY - rect.top) * (sketchCanvas.height / rect.height),
  )
  sCtx.stroke()
})
window.addEventListener('mouseup', () => {
  isDrawing = false
})

el('btn-clear-sketch').addEventListener('click', () => {
  drawBlueprintGridOnSketch()
  el('sketch-status-msg').textContent = 'Canvas cleared — sketch your posts and roof line.'
})

function intakeTemplate(): ModuleType {
  const value = el<HTMLSelectElement>('intake-template').value
  return isModuleType(value) ? value : 'attached-pergola'
}

function parseIntakeSpecification() {
  const parsed = parseSpecification(el<HTMLTextAreaElement>('intake-prompt').value, {
    ...INTAKE_PARSE_BASELINE,
    template: intakeTemplate(),
  })
  el('intake-parsed-tags').innerHTML = renderParsedTagsHtml(parsed)
  return parsed
}

document.querySelectorAll<HTMLButtonElement>('.sample-pill[data-sketch]').forEach((button) => {
  button.addEventListener('click', () => {
    const kind = button.dataset.sketch ?? ''
    drawSampleSketch(kind)
    if (kind === 'attached') {
      el<HTMLSelectElement>('intake-template').value = 'attached-pergola'
      el<HTMLInputElement>('intake-title').value = 'Rear Patio Attached Cedar Pergola'
      el<HTMLTextAreaElement>('intake-prompt').value = '14x12 attached pergola, 9.5ft height, 6x6 posts, 9 rafters'
    } else if (kind === 'freestanding') {
      el<HTMLSelectElement>('intake-template').value = 'garden-beds'
      el<HTMLInputElement>('intake-title').value = 'South Lawn Pergola & Raised Cedar Planters'
      el<HTMLTextAreaElement>('intake-prompt').value = '12x10 freestanding pergola with raised beds, 9ft height, 6x6 posts, 8 rafters'
    } else if (kind === 'veranda') {
      el<HTMLSelectElement>('intake-template').value = 'lean-to-canopy'
      el<HTMLInputElement>('intake-title').value = 'Side Return Sloped Veranda Canopy'
      el<HTMLTextAreaElement>('intake-prompt').value = '12x9 lean-to sloped veranda canopy, 8.5ft height, 4x4 posts, 8 rafters'
    }
    parseIntakeSpecification()
    el('sketch-status-msg').textContent = `Vision contour analyzer: Matched "${kind.toUpperCase()}" geometry & updated spec.`
  })
})

/**
 * UI wrapper around the heuristic placeholder in sketchHeuristic.ts.
 * Status strings below are the existing visible copy and are intentionally unchanged.
 */
function analyzeCanvasSketch(sourceLabel = 'Hand Sketch'): void {
  const estimate = estimateSketchFromPixels({
    width: sketchCanvas.width,
    height: sketchCanvas.height,
    data: sCtx.getImageData(0, 0, sketchCanvas.width, sketchCanvas.height).data,
    template: intakeTemplate(),
  })
  el<HTMLTextAreaElement>('intake-prompt').value = estimate.prompt
  parseIntakeSpecification()
  el('sketch-status-msg').textContent =
    `Analyzed ${sourceLabel}: Detected ${estimate.estWidth}' span × ${estimate.estHeight}' clearance (${estimate.estRafters} rafters).`
  showToast(`Extracted 3D blueprint parameters from ${sourceLabel}`)
}

el('btn-analyze-sketch').addEventListener('click', () => analyzeCanvasSketch('Sketch Pad'))
el<HTMLInputElement>('sketch-file-input').addEventListener('change', (event) => {
  const file = event.target instanceof HTMLInputElement ? event.target.files?.[0] : undefined
  if (!file) return
  const reader = new FileReader()
  reader.onload = (loadEvent) => {
    const img = new Image()
    img.onload = () => {
      drawBlueprintGridOnSketch()
      sCtx.drawImage(img, 20, 10, sketchCanvas.width - 40, sketchCanvas.height - 20)
      analyzeCanvasSketch(file.name)
    }
    if (typeof loadEvent.target?.result === 'string') img.src = loadEvent.target.result
  }
  reader.readAsDataURL(file)
})

el<HTMLTextAreaElement>('intake-prompt').addEventListener('input', parseIntakeSpecification)
el('intake-template').addEventListener('change', parseIntakeSpecification)

function createOrUpdateProjectFromIntake(openStudioImmediately: boolean): void {
  const parsed = parseIntakeSpecification()
  const title = el<HTMLInputElement>('intake-title').value.trim() || 'Custom Exterior Structure'
  const offX = parseFloat(el<HTMLInputElement>('intake-offset-x').value) || 0
  const offZ = parseFloat(el<HTMLInputElement>('intake-offset-z').value) || 0
  const newProject: DisplayProject = {
    id: `proj-${Date.now()}`,
    name: title,
    zone: 'Custom Garden Zone',
    status: 'In Design',
    template: parsed.template,
    width: parsed.width,
    depth: parsed.depth,
    height: parsed.height,
    rafterCount: parsed.rafterCount,
    postNominal: parsed.postNominal,
    offsetX: offX,
    offsetZ: offZ,
    rotY: 0,
    inWorld: true,
  }
  projects.unshift(newProject)
  persistWorld()
  loadProjectIntoState(newProject.id)
  if (openStudioImmediately) {
    state.worldMode = false
    updateWorldModeButtons()
    switchView('studio')
    showToast(`Generated 3D Blueprint for "${title}"`)
  } else {
    switchView('dashboard')
    showToast(`Saved "${title}" to Project Tracker`)
  }
}

el('btn-save-to-projects').addEventListener('click', () => createOrUpdateProjectFromIntake(false))
el('btn-generate-from-intake').addEventListener('click', () => createOrUpdateProjectFromIntake(true))

el('btn-single-mode').addEventListener('click', () => {
  state.worldMode = false
  updateWorldModeButtons()
  rebuildStructure()
  resetCameraFullView()
})
el('btn-world-mode').addEventListener('click', () => {
  state.worldMode = true
  updateWorldModeButtons()
  rebuildStructure()
  flyCameraTo(new THREE.Vector3(28, 20, 32), new THREE.Vector3(0, 3.5, 0), 700)
})
el('btn-toggle-world-all').addEventListener('click', () => {
  state.worldMode = !state.worldMode
  updateWorldModeButtons()
  rebuildStructure()
  if (state.worldMode) flyCameraTo(new THREE.Vector3(28, 20, 32), new THREE.Vector3(0, 3.5, 0), 700)
  else resetCameraFullView()
})

el<HTMLFormElement>('nl-form').addEventListener('submit', (event) => {
  event.preventDefault()
  const parsed = parseSpecification(el<HTMLInputElement>('nl-input').value, {
    template: state.template,
    width: state.width,
    depth: state.depth,
    height: state.height,
    rafterCount: state.rafterCount,
    postNominal: state.postNominal,
  })
  state.template = parsed.template
  state.width = parsed.width
  state.depth = parsed.depth
  state.height = parsed.height
  state.rafterCount = parsed.rafterCount
  state.postNominal = parsed.postNominal
  el<HTMLInputElement>('slider-width').value = String(state.width)
  el<HTMLInputElement>('slider-depth').value = String(state.depth)
  el<HTMLInputElement>('slider-height').value = String(state.height)
  el<HTMLInputElement>('slider-rafters').value = String(state.rafterCount)
  el<HTMLInputElement>('slider-postsize').value = String(state.postNominal)
  document.querySelectorAll<HTMLElement>('.tpl-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.template === state.template)
  })
  rebuildStructure()
  showToast(`Applied specification: ${state.width}' × ${state.depth}' × ${state.height}'`)
})

document.querySelectorAll<HTMLElement>('.tpl-card').forEach((card) => {
  card.addEventListener('click', () => {
    const template = card.dataset.template
    if (!template || !isModuleType(template)) return
    state.template = template
    document.querySelectorAll('.tpl-card').forEach((other) => other.classList.remove('active'))
    card.classList.add('active')
    rebuildStructure()
  })
})

function sliderValue(event: Event): string {
  const target = event.target
  return target instanceof HTMLInputElement ? target.value : ''
}

el<HTMLInputElement>('slider-width').addEventListener('input', (event) => {
  state.width = parseFloat(sliderValue(event))
  rebuildStructure()
})
el<HTMLInputElement>('slider-depth').addEventListener('input', (event) => {
  state.depth = parseFloat(sliderValue(event))
  rebuildStructure()
})
el<HTMLInputElement>('slider-height').addEventListener('input', (event) => {
  state.height = parseFloat(sliderValue(event))
  rebuildStructure()
})
el<HTMLInputElement>('slider-rafters').addEventListener('input', (event) => {
  state.rafterCount = parseInt(sliderValue(event), 10)
  rebuildStructure()
})
el<HTMLInputElement>('slider-postsize').addEventListener('input', (event) => {
  const post = parseInt(sliderValue(event), 10)
  if (isPostNominal(post)) state.postNominal = post
  rebuildStructure()
})
el<HTMLInputElement>('slider-pos-x').addEventListener('input', (event) => {
  state.offsetX = parseFloat(sliderValue(event))
  state.worldMode = true
  updateWorldModeButtons()
  rebuildStructure()
})
el<HTMLInputElement>('slider-pos-z').addEventListener('input', (event) => {
  state.offsetZ = parseFloat(sliderValue(event))
  state.worldMode = true
  updateWorldModeButtons()
  rebuildStructure()
})
el<HTMLInputElement>('slider-explode').addEventListener('input', (event) => {
  const pct = parseInt(sliderValue(event), 10)
  state.explode = pct / 100
  el('val-explode').textContent = pct === 0 ? '0% (Assembled)' : `${pct}% (Separated)`
  rebuildStructure()
})

document.querySelectorAll<HTMLButtonElement>('.mode-group .mode-btn').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.render
    if (mode !== 'blueprint' && mode !== 'wireframe' && mode !== 'xray') return
    state.renderMode = mode
    document.querySelectorAll('.mode-group .mode-btn').forEach((other) => other.classList.remove('active'))
    button.classList.add('active')
    applyRenderMode(mats, state.renderMode)
  })
})

document.querySelectorAll<HTMLButtonElement>('.joint-btn').forEach((button) => {
  button.addEventListener('click', () => {
    if (isJointId(button.dataset.joint)) focusJoint(button.dataset.joint, true)
  })
})

el('btn-reset-camera').addEventListener('click', resetCameraFullView)
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') resetCameraFullView()
})

document.querySelectorAll<HTMLButtonElement>('#build-stepper .step-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    state.buildStep = parseInt(pill.dataset.step ?? '6', 10)
    document.querySelectorAll('#build-stepper .step-pill').forEach((other) => other.classList.remove('active'))
    pill.classList.add('active')
    rebuildStructure()
  })
})

el('btn-studio-to-export').addEventListener('click', () => switchView('export'))
el('btn-back-to-studio').addEventListener('click', () => switchView('studio'))

el('btn-copy-share-url').addEventListener('click', () => {
  const url = el('share-url-display').textContent ?? ''
  void navigator.clipboard?.writeText(url)
  showToast('Copied interactive 3D share link to clipboard')
})

el('btn-export-csv').addEventListener('click', () => {
  const { rows } = getAggregatedBOM(modulesForBom())
  const blob = new Blob([bomToCsv(rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `structuracad-bom-${state.template}-${state.width}x${state.depth}.csv`
  anchor.click()
  showToast('Downloaded Cut List & Fastener Schedule CSV')
})

el('btn-export-png').addEventListener('click', () => {
  renderer.render(scene, camera)
  const dataUrl = renderer.domElement.toDataURL('image/png')
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = `structuracad-blueprint-${state.width}x${state.depth}.png`
  anchor.click()
  showToast('Captured high-resolution 3D Blueprint PNG')
})

el('btn-export-json').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(currentWorld(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'structuracad-modular-garden-world.json'
  anchor.click()
  showToast('Downloaded Modular 3D Garden World JSON')
})

const exportJsonCard = el('btn-export-json').closest('.export-card')
if (exportJsonCard) {
  exportJsonCard.addEventListener('dragover', (event) => {
    event.preventDefault()
  })
  exportJsonCard.addEventListener('drop', (event) => {
    event.preventDefault()
    if (!(event instanceof DragEvent)) return
    const file = event.dataTransfer?.files?.[0]
    if (!file) return
    void file.text().then((text: string) => {
      try {
        const imported = importWorldJson(text)
        adoptWorld(imported.world, imported.world.modules[0]?.id ?? state.activeProjectId, state.worldMode)
        if (imported.warnings.length > 0) {
          showToast(`Imported with warnings: ${imported.warnings.map((issue) => issue.message).join(' ')}`)
        } else {
          showToast('Imported garden world JSON')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid scene file.'
        showToast(message)
      }
    })
  })
}

window.addEventListener('resize', onWindowResize)

if (resolved.hashStatus === 'restored') {
  history.replaceState(null, '', window.location.pathname + window.location.search)
}

loadProjectIntoState(state.activeProjectId)
focusJoint('J2', false)
switchView('dashboard')
updateWorldModeButtons()

if (resolved.hashStatus === 'error' && resolved.hashMessage) showToast(resolved.hashMessage)
else if (resolved.hashMessage) showToast(resolved.hashMessage)
else if (resolved.warnings.length > 0) {
  showToast(resolved.warnings.map((issue) => issue.message).join(' '))
}

function animate(now: number): void {
  requestAnimationFrame(animate)
  if (camAnim) {
    const t = Math.min(1, (now - camAnim.startTime) / camAnim.duration)
    const ease = 1 - Math.pow(1 - t, 3)
    camera.position.lerpVectors(camAnim.startPos, camAnim.endPos, ease)
    controls.target.lerpVectors(camAnim.startLook, camAnim.endLook, ease)
    if (t >= 1) camAnim = null
  }
  controls.update()
  updateHotspotPositions()
  if (state.currentView === 'studio') renderer.render(scene, camera)
}
requestAnimationFrame(animate)
