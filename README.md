# StructuraCAD — Exterior Structural & Joinery Studio

Interactive 3D blueprint and joinery studio for residential property exterior alterations (attached patio pergolas, freestanding pergolas, and sloped lean-to verandas). Built around a **"Zoom-to-Understand-to-Build"** workflow: describe your build or dial in measurements, inspect the 3D blueprint, explode structural connections, and zoom directly into joints (`J1`–`J4`) to see every bolt, lag screw, bracket, pilot bit size, and cut length.

## Live Demo

- **Preview Channel URL:** https://rapid-prototyping-4134c--structura-cad-hniefkz2.web.app
- **Main Firebase URL:** https://rapid-prototyping-4134c.web.app

## Features

1. **Natural Language + Parametric Envelope Controls**
   - Describe your structure in plain English (e.g., `16x12 attached pergola, 10ft height, 6x6 posts, 11 rafters`) or use interactive sliders for Span Width, Projection Depth, Clearance Height, Rafter Count, and Post Timber Section (`4×4`, `6×6`, `8×8`).
   - Switch between 3 presets: **Attached Ledger Pergola** (with house exterior wall and slab context), **Freestanding 4-Post Pergola**, and **Sloped Lean-To Veranda**.

2. **Refined Architectural Blueprint Palette & Three Render Modes**
   - **Blueprint Shaded:** Deep blueprint navy canvas (`#070d19` to `#101f36`) with muted slate timber, warm brushed brass hardware (`#d4a373`), and soft chalk-blue CAD edges (`#93c5fd`).
   - **Wireframe:** Pure technical blueprint linework.
   - **X-Ray Fasteners:** Ghosts all timber members to 16% opacity so internal carriage bolts, concrete expansion anchors, and ledger lag screws are clearly visible inside the wood.

3. **Zoom-to-Understand Joint Dissection (`J1`–`J4`)**
   - **J1 · Foundation:** Simpson `ABA66Z` 1" moisture standoff base, `5/8" × 5"` concrete wedge expansion anchor, and four `1/4" × 3"` SDS heavy structural screws.
   - **J2 · Header:** Notched post-to-double-beam (`2×10`) sandwich connection with 12-gauge steel T-straps and four staggered `1/2" × 8"` galvanized thru-bolts.
   - **J3 · House Wall:** Pressure-treated `2×10` ledger with 16" OC staggered `1/2" × 5"` lag screws into the rim joist, continuous Z-flashing drip cap, and Simpson `LUS28Z` joist hangers.
   - **J4 · Roof Seat:** `1.5"` birdsmouth seat cut, Simpson `H2.5AZ` hurricane uplift clip, and `6"` countersunk structural timber screw.
   - Clicking any joint pin smoothly flies the 3D camera to that interface, cracks open the exploded view along dashed bolt insertion axes, and displays a 2D cross-section schematic with pilot bore and torque specs.

4. **5-Stage Build Sequencer & Live Cut/Fastener BOM**
   - Step through **1. Footings → 2. Posts → 3. Ledger & Beams → 4. Rafters → 5. Shade Lath** and view the live-calculated lumber cut list and fastener schedule.

## Running Locally

No build step required — `index.html` is a self-contained ES module application using Three.js (`v0.160.0`). Serve with any static HTTP server:

```bash
python3 -m http.server 8080
```
