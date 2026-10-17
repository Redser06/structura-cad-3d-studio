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

- A module footprint (parametric width × depth, not rafter overhang) must lie inside the site rectangle. That is an **error**.
- Overlapping footprints are a **warning**.
- Duplicate ids are an **error**.

JSON import parses with `JSON.parse` and Zod, then runs validation. It never evaluates file contents. Bounds and duplicate-id errors reject the file. Overlap is returned and the world is kept.

A share link (`#scene=` plus base64url JSON, validated by the same schema) restores the world even if placement fails validation, and the app reports the issues. The older `#tpl=&w=&d=` links are accepted by turning them into a one-module imperial world and running that through the schema.

### Legacy projects

`localStorage` key `structuracad_projects_v2` is read only when `structuracad_world_v1` is absent. Those rows are feet, so the migrated world is `units: 'imperial'` and the numbers are copied unchanged. `zone`, `status`, and `inWorld` land in `meta`. After a successful save the app writes v1 and drops the v2 key.

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
