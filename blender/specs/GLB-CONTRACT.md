# PACKSHIFT GLB Contract

## Purpose

This contract prevents Blender and the Three.js runtime from drifting apart.

Blender owns **asset authoring**. React Three Fiber owns **live interaction**.

## Format

- Runtime asset: `GLB`
- Source dimensions: millimeters
- Blender geometry: meters
- Up axis in Blender: +Z
- Front normal: +Y
- Runtime: Three.js / React Three Fiber
- Export target: glTF 2.0 / GLB

## Required hierarchy

```text
PACKSHIFT_ROOT
├── FRONT
├── HINGE_RIGHT
│   ├── RIGHT_DATA
│   └── HINGE_BACK
│       └── BACK
├── HINGE_LEFT
│   └── LEFT_COPY
├── HINGE_TOP
│   └── TOP
├── HINGE_BOTTOM
│   └── BOTTOM
├── ANCHOR_CLAIM_FRONT
├── ANCHOR_COPY_LEFT
├── ANCHOR_DATA_RIGHT
└── ANCHOR_BACK_REFLOW
```

The hinge empties are **load-bearing runtime nodes**. Do not collapse, apply away, or rename them without a coordinated runtime change.

## Fold contract

| Node | Axis | Closed | Flat |
| --- | --- | ---: | ---: |
| `HINGE_RIGHT` | Z | 0° | +90° |
| `HINGE_BACK` | Z | 0° | +90° |
| `HINGE_LEFT` | Z | 0° | −90° |
| `HINGE_TOP` | X | 0° | −90° |
| `HINGE_BOTTOM` | X | 0° | +90° |

The exported asset is **closed by default**. The browser opens the dieline by animating the hinge transforms.

## Runtime anchors

- `ANCHOR_CLAIM_FRONT` — 24H HYDRATION entry/collision target
- `ANCHOR_COPY_LEFT` — FR/EN pressure target
- `ANCHOR_DATA_RIGHT` — QR/data-carrier target
- `ANCHOR_BACK_REFLOW` — back-panel content migration target

Anchors are transform nodes, not visible geometry.

## Materials

Minimum stable materials:

- `MAT_PAPER_OUTER`
- `MAT_PAPER_EDGE`

The browser may add temporary collision/reflow materials, but the physical paper master originates in Blender.

## Export requirements

Target:

`public/models/packshift-master.glb`

Requirements:

- binary GLB
- stable node names
- hinge empties/transforms preserved
- custom properties exported as extras where supported
- no Blender camera/light dependency
- no hidden debug geometry
- `export_apply=False` so hinge transforms survive
- deterministic project-relative output path

## Runtime handoff

The V3 procedural geometry should eventually be replaced by:

```js
const { nodes, materials } = useGLTF('/models/packshift-master.glb')
```

The runtime must bind to stable hinge names rather than reconstructing the package topology independently.

## Proof classes

A Blender scene proves **asset authoring**.

A valid GLB proves **artifact generation**.

A successful `useGLTF()` load proves **runtime import**.

PACKSHIFT is not spatially proven until the live runtime preserves:

`constraint → collision → unfold → reflow → refold → valid form`

## Truth boundary

A valid GLB is not live runtime proof. This is a concept packaging master, not manufacturing CAD or regulatory validation.
