# StructuraCAD — Exterior & Garden 3D Structural Platform

End-to-end 3D blueprint, joinery dissection, and modular garden property builder for residential exterior alterations.

The 3D models and fastener schedules are **illustrative, not engineered**. They are a way to walk a scheme, not a structural design. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Local development

```bash
npm install
npm run dev
```

`npm test` runs the unit suite. `npm run build` writes `dist`.

The app is Vite + TypeScript. `three` is pinned to 0.160.0, including OrbitControls from that package. Module layout and the scene format are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Hosting

Firebase Hosting serves `dist` for the dedicated project `structura-cad`. The shared `rapid-prototyping-4134c` project is not the target, and there is no deploy workflow. Manual setup is in [docs/FIREBASE.md](docs/FIREBASE.md).

Earlier previews were published on that shared project (`https://rapid-prototyping-4134c.web.app` and a preview channel). Those URLs are historical and are not updated by this repo.

## User journey

1. **Workspace sign-in.** Name the workspace and the garden plot. The plot field is a label. The 3D site is the 42 ft × 36 ft rectangle stored on the scene.
2. **Project tracker.** The seeded garden has four structures. Check **Include in 3D Garden World** and launch the combined view.
3. **Explain and sketch.** The text parser reads dimensions from the description. The sketch control is a **heuristic placeholder** (a bright-pixel bounding box). It is not a vision model. The on-screen wording still says "vision"; changing that copy is a Gemini follow-up.
4. **3D studio.** Single structure or the modular garden. Joint pins J1–J4, explode, and the cut list. In the garden view the cut list includes every module on the plot.
5. **Export.** The share link restores a schema v1 scene from `location.hash`. JSON download and drop-to-import use the same schema. CSV and PNG match the previous actions.

## Scene data

New scenes are metric. The screen stays in feet until the display switch is designed. Existing `structuracad_projects_v2` rows in `localStorage` migrate losslessly into a World. Details are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
