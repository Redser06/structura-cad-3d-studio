# StructuraCAD architecture

StructuraCAD is a single-page studio for exterior and garden structures. Phase 0 split the original `index.html` into a Vite + TypeScript app. Phase 1 adds a versioned scene document. The screen layout is unchanged.

The models, joint callouts, and fastener counts are **illustrative, not engineered**. They are a visual aid for walking through a backyard scheme. They are not a structural design, a code check, or a permit document. A visible disclaimer in the product UI is a Gemini follow-up; the studio still shows the existing "IRC 2024" label and hardware notes.

## Module layout

| Path | Role |
| --- | --- |
| `index.html`, `src/styles.css` | The existing screen markup and CSS. |
| `src/main.ts` | UI glue: navigation, sliders, three.js viewport, share/export buttons. |
| `src/engine/` | Pure builder. `buildStructureModuleGroup` plus `createCADBox` / `createBoltAssembly`. Dimensions passed in are feet, which is what the original meshes used. |
| `src/parser/parseSpecification.ts` | One text parser, used by intake and the studio tweak box. |
| `src/bom/bom.ts` | Cut list. World mode aggregates every module on the plot. |
| `src/scene/` | Zod schema, migrations, unit conversion, bounds, JSON and share-hash IO. |
| `src/storage/storage.ts` | `localStorage` load, including the legacy project list. |
| `src/ui/sketchHeuristic.ts` | Bounding-box guess labeled as a heuristic placeholder. It is not a vision model. |
| `src/ui/jointSpecs.ts` | Static J1–J4 copy and schematics. |

`three` is locked to **0.160.0**, the same release the old CDN import map used. OrbitControls comes from `three/examples/jsm/controls/OrbitControls.js`.

## Scene format v1

```ts
World {
  schemaVersion: 1
  units: 'metric' | 'imperial'   // default metric
  site: { width, depth }         // centered on the origin
  modules: Module[]
}

Module {
  id, type, name
  params: { width, depth, height, rafterCount, postNominal }
  transform: { x, z, rotY }      // rotY is radians, default 0
  refs?: string[]
  meta?: { zone?, status?, inWorld? }
}
```

Registered module types, matching the four templates already in the UI:

- `attached-pergola`
- `freestanding-pergola`
- `lean-to-canopy`
- `garden-beds`

`params` is a discriminated object per type. Today the four types share the same fields so a later phase can extend one without loosening the others.

`meta` carries the legacy project fields (`zone`, `status`, `inWorld`) that are not geometry. `refs` is reserved for ids of other modules.

Lengths inside a World are in that world's `units`. New scenes, including the seeded garden, are **metric** (meters). The screen still shows feet. `src/scene/units.ts` converts at the boundary. Switching the labels and sliders to metric is Gemini's.

`rotY` is applied in world mode only. Single-structure view stays centered and unrotated, as before. There is no rotation control yet.

### Validation

Hard caps reject a document before it is built or decoded:

- at most 50 modules
- `rafterCount` at most 30
- width, depth, height, and the site at most 100 ft (30.48 m when `units` is metric)
- `|x|` and `|z|` at most 500 ft (152.4 m when metric)

Soft checks run after that:

- A footprint outside the site is a **warning**. Older slider positions such as x = 18 with a 24 ft width still load.
- Overlapping footprints are a **warning**.
- Duplicate ids are an **error**.

JSON import parses with `JSON.parse` and Zod, then runs validation. It never evaluates file contents. Duplicate ids and hard caps reject the file. Soft bounds and overlap are returned and the world is kept. The import backs up `structuracad_world_v1` and `structuracad_projects_v2` before it writes, and a failed migration does not write. There is no confirm dialog yet; Gemini can gate `importWorldReplacingStored` later.

A share link opens **read-only**. It does not autosave, and the first edit does not replace stored projects or delete the v2 key. The existing toast says the scene is not saved. `#scene=` payloads larger than 64 KB are rejected before decode. A link that fails the hard caps is not opened. A link that only fails soft placement still opens, read-only, with a short toast (duplicate messages are collapsed and the list is capped). The older `#tpl=&w=&d=` links become a one-module imperial world through the same schema.

`window.structuracad.saveSharedToProjects()` adds the open share onto the stored world (colliding ids are renamed, the stored modules stay). Gemini still needs to add the button.

The share hash currently carries **every** module, including names, zones, and statuses, not only the active structure or the modules on the plot. A later share could send only those.

Metric lengths are stored on the same 0.001 ft grid the screen uses, so saving again does not move them by a fraction of a millimetre.

### Legacy projects

`localStorage` key `structuracad_projects_v2` is read only when `structuracad_world_v1` is absent. Those rows are feet, so the migrated world is `units: 'imperial'` and the numbers are copied unchanged. `zone`, `status`, and `inWorld` land in `meta`. A row that does not fit the schema is copied to `structuracad_projects_v2_quarantine` and left out of the world. If every row fails, the screen does not substitute the demo garden, and nothing is saved over the key.

The first verified save copies v2 to `structuracad_projects_v2_backup` (and v1 to `structuracad_world_v1_backup` when it already exists). v2 is removed only after the new v1 value is read back and parsed. A failed write restores the previous v1 value and leaves v2 in place.

`src/scene/migrations.ts` is the place for later versions. Version 1 is the first published shape, so the chain is empty. A document with `schemaVersion` greater than 1 is rejected. A lower version fails until a step is registered.

## Hosting

Firebase Hosting serves `dist`. The project alias in `.firebaserc` is the dedicated placeholder `structura-cad`, not the shared `rapid-prototyping-4134c` project. Setup steps are in [FIREBASE.md](./FIREBASE.md). There is no deploy workflow.

## Later phases

1. **Auth and persistence.** Sign-in and a per-user store for World documents (Firebase Auth plus a database on the `structura-cad` project, or another dedicated project). The scene file stays the source of truth; the server stores JSON that has already passed this schema. Do not put customer projects back on the shared rapid-prototyping project.
2. **Edit and compose.** Rotation and direct manipulation on the plot, with the bounds and overlap results shown in the UI. Gemini owns the controls; the checks in `validateWorld` are already there.
3. **Image to 3D.** A server-side Gemini call, not a browser key, with a **$10** spend cap. The model returns a World candidate. The server validates it with this schema before the client accepts it. The sketch pad's current analyzer is only the heuristic in `sketchHeuristic.ts` and must not be described as that call.

## Gemini follow-ups (visible copy)

These strings are unchanged on purpose:

- The intake card says the "vision contour analyzer" detects posts, spans, and roof pitch. It does not. It measures a bright bounding box.
- The sketch status line says "Blueprint Vision Analyzer" and "Vision contour analyzer".
- The intake column shows "CONFIDENCE: 98%". That number is static text.
- Nothing on screen says the model is illustrative rather than engineered. The docs note above is the engineering record; the visible disclaimer still needs a design pass.
- The dimension section is labeled "Imperial (ft)". Data defaults to metric. The display switch is not in this change.
- There is no rotation slider and no visible Import button. Dropping a `.json` file on the existing "Full 3D Property World JSON" card imports through the schema.
- There is no "Save to my projects" button. `window.structuracad.saveSharedToProjects()` adds a read-only share without replacing stored projects. A confirm step before import replace is also still Gemini's.
