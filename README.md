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

- **42 GLB nodes**
- **8 materials**
- Blender asset version **0.5.0**

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
├── src/
│   ├── App.jsx
│   └── scene/
│       ├── PackageScene.jsx
│       └── PackageSceneProcedural.jsx
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

A procedural fallback can be used for comparison/debugging with:

```
?procedural=1
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

## Next — V5.1 Depth Pass

V5 is now the stable baseline, not the finish line.

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
