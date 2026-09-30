# PACKSHIFT — Day 19

> **Packaging is not a file. It is a compiled surface.**

PACKSHIFT is an interactive packaging concept that treats market, language, data and claim requirements as **spatial forces acting on a physical package**.

Instead of showing packaging variants as separate static files, PACKSHIFT lets the user place requirements directly onto a live 3D package, overload a surface, decompose the object, inspect its physical structure, and recompile the same master into a resolved form.

## Core interaction

```
CONSTRAINT
   ↓
PRESSURE
   ↓
COLLISION
   ↓
PHYSICAL DECOMPOSITION
   ↓
DIELINE
   ↓
REFLOW
   ↓
REFOLD
   ↓
VALID FORM
```

The current signature moment is **IMPOSSIBLE FRONT**:

1. place **FR / EN** on the front;
2. place **DATA CARRIER** on the same surface;
3. add **24H HYDRATION**;
4. push the front panel over capacity;
5. open the physical package;
6. expose its dieline and internal product structure;
7. redistribute information across the available surfaces;
8. refold the same master into a calmer resolved form.

---

## Current baseline — V5 Spatial Negotiation Studio

V5 moves PACKSHIFT beyond a button-driven 3D demo into a user-controlled spatial workspace.

### User control

- free orbit around the package;
- 3D drag-and-drop of requirements;
- raycast placement onto real Blender-authored surfaces;
- manual trade-off resolution;
- continuous decomposition scrubber;
- market switching between EU and Canada;
- deterministic signature demo;
- procedural Three.js fallback for regression/debug work.

### Inspection modes

- **PACK** — assembled product;
- **EXPLODED** — shell + product architecture;
- **DIELINE** — fully exposed packaging surface;
- **X-RAY** — translucent outer shell with internal structure visible;
- **PRESSURE** — surface load and over-capacity state.

### Spatial pressure model

The current prototype assigns deterministic demo capacity to:

- FRONT
- LEFT COPY
- RIGHT DATA
- BACK

Requirements carry their own demo weight. When accumulated demand exceeds the capacity of a surface, PACKSHIFT exposes the conflict instead of silently fitting everything.

The pressure model exists to communicate the interaction thesis. It is **not a regulatory compliance model**.

---

## Blender is load-bearing

Blender is not used only for renders.

The current V5 master provides the canonical physical structure consumed by the web runtime.

### Folding shell

- `FRONT`
- `RIGHT_DATA`
- `BACK`
- `LEFT_COPY`
- `TOP`
- `BOTTOM`
- `GLUE_FLAP`
- four dust flaps
- runtime-addressable fold hinges

### Internal product architecture

- `INSERT_TRAY`
- `INNER_JAR`
- `CREAM_CORE`
- `JAR_CAP`
- `SEAL_DISC`
- `LEAFLET`

### Runtime anchors

The GLB also contains anchors for:

- claims;
- language copy;
- data carriers;
- reflow routes;
- package surfaces;
- exploded product components.

Current master:

- **44 GLB nodes** (0.6.0 adds a modelled tuck flap)
- **8 materials**
- Blender asset version **0.6.0** (closed pose verified: flaps and internals contained in the shell)

---

## Architecture

```
PACKAGING GEOMETRY SPEC
        ↓
REMOTE BLENDER WORKER
        ↓
PACKSHIFT_MASTER.blend
        ↓
SCENE + CONTRACT VALIDATION
        ↓
packshift-master.glb
        ↓
REACT THREE FIBER
        ↓
LIVE SPATIAL INTERACTION
        ↓
TRACE / VISUAL + EXPERIENCE QA
```

### Blender

Owns:

- physical geometry;
- fold hierarchy;
- panel pivots;
- internal components;
- materials;
- runtime anchors;
- exportable spatial truth.

### React Three Fiber / Three.js

Owns:

- user interaction;
- orbit and camera behavior;
- drag/drop;
- surface pressure logic;
- decomposition control;
- X-Ray / Pressure states;
- market state;
- live reflow;
- browser runtime.

### GSAP

Used for controlled state transitions and compile/refold choreography.

---

## Remote-first Blender pipeline

PACKSHIFT does **not** require a local Blender session for the canonical asset pipeline.

The repository includes a remote Blender headless workflow that can:

1. launch Blender;
2. build the master scene;
3. validate hierarchy and truth boundaries;
4. export the GLB;
5. validate the exported contract;
6. preserve the resulting artifact for the web runtime.

Blender MCP is also registered in the wider system as a candidate interactive execution provider, but it is **not required for the current remote pipeline** and is not considered promoted simply because it can connect.

---

## Repository structure

```
PACKSHIFT/
├── blender/
│   ├── scripts/
│   │   ├── build_master.py
│   │   ├── validate_scene.py
│   │   ├── export_glb.py
│   │   └── validate_glb.py
│   ├── specs/
│   │   ├── PACKAGING-GEOMETRY.yaml
│   │   └── GLB-CONTRACT.md
│   └── evidence/
├── public/
│   └── models/
│       └── packshift-master.glb
├── scripts/
│   ├── validate_glb_contract.py
│   └── glb_geometry.py
├── src/
│   ├── App.jsx
│   ├── model/
│   │   └── pressure.js        # demo capacity model + compile solver
│   └── scene/
│       ├── PackageScene.jsx   # R3F runtime over the Blender hierarchy
│       ├── panelArt.js        # printed artwork as CanvasTextures
│       └── proceduralMaster.js
├── tests/
│   └── pressure.test.mjs
├── state/
│   ├── CURRENT.yaml
│   └── HANDOVER.yaml
└── .github/
    └── workflows/
```

---

## Run locally

Requirements:

- Node.js 22+

Install dependencies:

```bash
npm install
```

Start the development runtime:

```bash
npm run dev
```

Production build:

```bash
npm run build
```

The committed Blender GLB is served from:

```
/public/models/packshift-master.glb
```

A procedural twin of the Blender master (same node names, hinges and fold
metadata, built in Three.js) can be used for comparison/debugging with:

```
?procedural=1
```

The same twin is used automatically if the GLB fails to load, so the studio
never renders blank.

Full local verification (unit tests, GLB contract + closed-pose geometry,
Blender static contract, production build):

```bash
npm run check
```

Rebuild the GLB from source without a Blender install (uses the `bpy` wheel):

```bash
pip install bpy==4.2.0
python3 blender/scripts/ci_build_export.py
python3 scripts/validate_glb_contract.py
```

---

## Verification

The current baseline is protected by several independent proof classes.

### Blender Master Contract

Checks:

- Blender Python syntax;
- asset hierarchy contract;
- fold metadata;
- internal product architecture;
- runtime anchors;
- truth-boundary markers;
- web build compatibility.

### Blender Headless Proof

Checks the real remote Blender path:

- scene generation;
- scene validation;
- GLB export;
- GLB contract validation;
- artifact generation.

### Closed-pose geometry (since 0.5.1)

`scripts/glb_geometry.py` composes every node transform into world space and
fails if any flap or internal component protrudes from the 56 × 130 × 36 mm
shell in the authored closed pose. It runs inside the GLB contract check.

### Unit tests

`npm test` (16 tests) covers the pressure model and solver (Impossible Front,
market-specific layouts, the unsolvable full Canadian brief and its carton
suggestion), dieline geometry (creases vs cuts), URL state round-trips, and
node-for-node parity between the procedural twin and the Blender GLB.

### Blender Runtime Integration

Checks:

- committed GLB structure;
- required Blender nodes/materials;
- Vite build;
- GLB inclusion in the built runtime.

### Main Runtime Verify

Checks the canonical web build from `main`.

Asset proof and runtime proof remain separate by design.

---

## Truth boundary

PACKSHIFT is a **concept prototype**.

It does not claim:

- regulatory compliance;
- legal validation;
- manufacturing-ready CAD;
- production dieline certification;
- real packaging engineering tolerances;
- market approval.

Current dimensions, safe areas, pressure capacities and requirement weights are deterministic concept logic used to test the interaction model.

A valid Blender scene is not live runtime proof.

A valid GLB is not manufacturing validation.

A visually plausible package is not automatically a digital twin.

---

## Status

**Canonical branch:** `main`

**Current baseline:** V5 — Spatial Negotiation Studio

**Current product state:**

- remote Blender pipeline — proven;
- deep Blender GLB asset — proven;
- R3F runtime integration — proven;
- spatial drag/drop — implemented;
- decomposition scrubber — implemented;
- X-Ray / Pressure / Dieline views — implemented;
- Impossible Front signature flow — implemented;
- final visual-depth verdict — still open;
- mobile QA — still open;
- Blender MCP provider promotion — still benchmark-gated.

---

## V6 — Rapport négocié (current UI)

The studio is now an annual-report spread — directions 04 (living annual
report) + 05 (negotiation) from the design exploration, combined.

- **The right-hand column is the front panel.** Its headline sits on the
  Archivo width axis and narrows as the front fills; when the front is over
  capacity the last words are pushed out past the dashed face edge.
- **Requirements are characters** (bold modular shapes, ink outline, eyes that
  follow the pointer). They stand on the column's baseline, wait "en coulisse",
  or live in Fig. 2's face slots. Drag one onto the column, a slot or a face of
  the 3D carton — or tap it, then tap a destination.
- **The last one in gets shoved out.** On overload the most recent arrival is
  ejected into the margin with a handwritten "pas de place !".
- **The editor settles it in red pen.** "L'éditeur tranche" runs the solver:
  the Blender carton (Fig. 1) opens, flattens and refolds while the characters
  walk (FLIP) to their faces and annotate the move ("gauche, ok").
- **Fig. 2 — où vit chaque exigence** doubles as the load strip (per-face
  load, predicted load while dragging).
- Chapters (01 Le brief → 05 La forme valide) follow the state; the guided tour
  is written as editor's notes. French UI throughout; self-hosted Archivo,
  JetBrains Mono, Newsreader and Caveat.

## V5.3 — Proof Room (UI/UX direction)

The interface is now a prepress **proof room**: key-black desk, paper job
tickets, fluorescent process inks. Colour carries meaning — cyan = headroom,
magenta = over-inked, yellow = lifted / live.

- **Job tickets** (left rail) replace the floating 3D cards: perforated stubs
  showing each requirement's load share; drag one onto the pack (a tilting
  ghost follows the pointer) or tap it, then tap a face or ink column.
- **Predictive load**: while dragging, the face under the pointer shows
  `Left copy 15 → 82%  FITS` (or `OVER-INKED`) and the ink column previews
  the result — before anything is placed.
- **Ink strip** (right rail): one density column per face — hatched base
  load, cyan placed load, magenta spill when over capacity.
- **Load-sensitive headline**: the Archivo width axis narrows as the busiest
  face fills; words rise from a mask; on collision the CMY plates drift out of
  register, on a valid form they snap back.
- **PRESS**: a single round control — neutral when idle, yellow when ready,
  pulsing magenta on collision, with a 4-phase progress ring while compiling.
- **Timeline deck**: view chips (1–5) and a ruler scrubber with named stops.
- **Slug line**: one status line (state · market · stock · placed · source).
- Prepress furniture (crop marks, registration targets, colour bar), a
  pointer-parallax halftone field, staggered ticket deal-in, register report.
- Reset asks for a second press; self-hosted variable fonts (Archivo, JetBrains
  Mono); mobile stacks stage → tickets → inks → deck with no horizontal scroll.

Motion follows easing / offset & delay / masking / parallax / morph, and
removes itself under `prefers-reduced-motion`.

## V5.2 — signature, control, material, jury kit

**Signature moment**
- during COMPILE each moved requirement leaves its panel as a printed block,
  arcs over the open dieline with a trail and lands on its new panel — the
  artwork only changes when the block lands;
- scripted camera: low push-in while the lid opens, dolly over the dieline,
  sweeping orbit while the carton refolds;
- synthesised sound (Web Audio, no files): paper creases on every fold,
  whoosh per travelling block, thud on overload, chime on valid form; mute
  toggle, remembered per viewer;
- a diff of what moved (`FR / EN  Front → Left copy`) after each compile.

**User control**
- editable brief: add warnings, an eco claim and an EAN-13 barcode to the
  three core requirements (6 kinds, exhaustive 4⁶ solver);
- a third market (US) with its own demo rules;
- carton size sliders (width 44–72, depth 34–48, height 110–150 mm): capacity
  scales with panel area; non-nominal sizes rebuild the exact same hierarchy
  as a procedural twin (a parity test proves node-for-node equality with the
  GLB at nominal size);
- when no layout exists the studio says so and computes the smallest carton
  that fits (e.g. the full brief in Canada needs 58 × 37 × 132 mm).

**Material**
- Blender 0.6.0: modelled tuck flap (the part that actually closes a
  reverse-tuck carton), included in the closed-pose containment check;
- runtime material pass: glass jar with transmission and clearcoat, glossy
  cap, metallic foil seal, paper-fibre normal map, foil-stamped logo
  (roughness/metalness map) and embossed product name (bump map);
- procedural studio environment (Lightformers — nothing downloaded).

**Jury / demo kit**
- ~50 s narrated guided tour (T, or the header button; Esc skips);
- shareable link: the URL hash keeps market, brief, placements, size and view;
- concept dieline export (SVG, mm): cut / crease / bleed / safe lines, panels
  labelled with requirements and loads — explicitly not a production dieline.

Fixed on the way: X-ray showed an opaque shell because three.js bakes
`OPAQUE` into the shader program; materials now recompile when transparency
toggles.

## V5.1 — audit fixes and depth pass

What was wrong in V5 and what changed:

**Blender master (0.5.0 → 0.5.1)**
- the "closed" carton was not closed: dust flaps were authored vertical and
  stood 18 mm above the top; the glue flap stuck 12 mm out of the side;
- the jar cap was wider than the carton depth and pierced the front and back
  (the dark rectangle over "HYDRA VEIL"); the leaflet poked 6 mm out of the
  left panel;
- explode anchors sat behind the shell, so the separated product was hidden;
- bevel modifiers were never exported (`export_apply=False`).

**Runtime**
- drag-and-drop never placed anything on the live build: `event.raycaster` is
  undefined on captured R3F v9 pointer events, and OrbitControls stayed
  enabled, so dragging a card spun the camera instead;
- COMPILE animated from a stale React closure, so the refold snapped shut;
- `?procedural=1` passed V5 props to a V3 component and rendered a dead scene;
- printed artwork was a DOM overlay that showed through the box from behind;
- two of three requirement cards sat off-screen / under the console;
- most UI text was 5–7 px.

**New**
- real compile solver (exhaustive, deterministic) with market-specific demo
  rules — EU and Canada now produce different layouts for the same brief;
- printed artwork on every panel as textures: it follows every fold into the
  dieline, shows the overloaded zones hatched, and changes with market;
- physically honest decomposition: lid opens, product lifts out through the
  opening, carton unfolds panel by panel, parts line up beside the dieline;
- tap-to-place (card or console chip, then a face or surface cell) for touch
  and keyboard users; undo; keyboard shortcuts (1–5, C, R, Z, Esc);
- camera framing fitted to the viewport aspect; mobile layout; reduced motion;
- loading state, error boundary with automatic procedural fallback;
- unit tests, closed-pose geometry check, `npm ci` + tests in CI;
  Cloudflare `_headers` (immutable assets, GLB caching), code-split bundle.

## Next

V5.1 is the stable baseline, not the finish line.

The next pass focuses on what still prevents the experience from becoming genuinely memorable:

- make Blender's contribution even more obvious;
- deepen physical decomposition;
- expand user agency beyond the current controls;
- make internal product anatomy more expressive;
- improve transitions between physical and informational states;
- strengthen the Impossible Front signature moment;
- refine camera, material, light and sound direction;
- validate touch/mobile interaction;
- preserve the current remote-first Blender + GLB + R3F architecture.

---

## Thesis

Most packaging software treats the package as artwork attached to a file.

PACKSHIFT explores a different model:

> **requirements occupy space, surfaces have limits, and the package itself becomes the interface for negotiating trade-offs.**

The goal is not automated artwork generation.

The goal is to make packaging constraints **spatial, inspectable, manipulable and consequential**.
