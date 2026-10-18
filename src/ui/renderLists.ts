import type { DisplayProject } from '../scene/display'
import { escapeHtml } from './escapeHtml'

export function renderProjectCardsHtml(projects: DisplayProject[]): string {
  return projects.map((project) => `
        <div class="project-card${project.inWorld ? ' selected-for-world' : ''}" data-proj-id="${escapeHtml(project.id)}">
          <div class="proj-card-top">
            <div>
              <div class="proj-card-title">${escapeHtml(project.name)}</div>
              <div class="proj-card-zone">${escapeHtml(project.zone)} · Plot (${project.offsetX > 0 ? '+' : ''}${project.offsetX}' X, ${project.offsetZ > 0 ? '+' : ''}${project.offsetZ}' Z)</div>
            </div>
            <span class="proj-status-badge ${project.status === 'Ready to Build' ? 'ready' : ''}">${escapeHtml(project.status)}</span>
          </div>

          <div class="proj-metrics-row">
            <div class="proj-metric">
              <span class="proj-metric-lbl">Footprint</span>
              <span class="proj-metric-val">${project.width}' × ${project.depth}'</span>
            </div>
            <div class="proj-metric">
              <span class="proj-metric-lbl">Height / Posts</span>
              <span class="proj-metric-val">${project.height}' · ${project.postNominal}×${project.postNominal}</span>
            </div>
            <div class="proj-metric">
              <span class="proj-metric-lbl">Rafters</span>
              <span class="proj-metric-val">${project.rafterCount} × (2×8)</span>
            </div>
          </div>

          <div class="proj-card-footer">
            <div class="world-check-label">
              <input type="checkbox" class="toggle-world-check" tabindex="-1" aria-hidden="true" data-id="${escapeHtml(project.id)}" ${project.inWorld ? 'checked' : ''} />
              <button type="button" class="module-include-toggle" data-id="${escapeHtml(project.id)}" aria-pressed="${project.inWorld ? 'true' : 'false'}" aria-label="${escapeHtml(`Include ${project.name} in 3D Garden World`)}">
                Include in 3D Garden World
              </button>
            </div>
            <button type="button" class="btn-secondary open-proj-studio-btn" data-id="${escapeHtml(project.id)}" style="padding:6px 12px; font-size:11.5px;">
              Open in 3D Studio →
            </button>
          </div>
        </div>
      `).join('')
}

export function renderStudioModuleListHtml(projects: DisplayProject[], activeProjectId: string): string {
  return projects.map((project) => `
        <div class="world-module-item ${project.id === activeProjectId ? 'active' : ''}" data-id="${escapeHtml(project.id)}">
          <span style="font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(project.name)}</span>
          <span style="font-family:var(--font-mono); font-size:10px; color:var(--text-muted);">${project.width}'×${project.depth}'</span>
        </div>
      `).join('')
}

export function renderParsedTagsHtml(parsed: {
  template: string
  width: number
  depth: number
  height: number
  postNominal: number
  rafterCount: number
}): string {
  return `
        <span class="parsed-tag">Archetype: ${escapeHtml(parsed.template)}</span>
        <span class="parsed-tag">Envelope: ${parsed.width.toFixed(1)}' W × ${parsed.depth.toFixed(1)}' D × ${parsed.height.toFixed(1)}' H</span>
        <span class="parsed-tag">Posts: ${parsed.postNominal}×${parsed.postNominal} Nominal</span>
        <span class="parsed-tag">Rafters: ${parsed.rafterCount} × (2×8)</span>
        <span class="parsed-tag">Joints: J1–J4 Hardware Ready</span>
      `
}

export function renderBomTableHtml(rows: Array<{ part: string; spec: string; qty: string }>): string {
  return rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.part)}</td>
          <td style="color:var(--text-muted); font-family:var(--font-mono); font-size:10.5px;">${escapeHtml(row.spec)}</td>
          <td class="bom-qty">${escapeHtml(row.qty)}</td>
        </tr>
      `).join('')
}

export function selectAllToast(moduleCount: number): string {
  return `All ${moduleCount} garden module${moduleCount === 1 ? '' : 's'} linked to Modular 3D World`
}
