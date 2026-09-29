# PACKSHIFT V5 GLB Contract

## Purpose

The V5 asset is a **physical packaging system**, not a decorative box.

Blender owns canonical spatial structure:
- folding carton shell
- glue and dust flaps
- internal product assembly
- runtime anchors
- fold metadata
- material identity

React Three Fiber owns:
- user manipulation
- surface pressure logic
- constraint placement
- camera/orbit behavior
- decomposition scrubber
- live compile/reflow

## Required hierarchy

```
PACKSHIFT_ROOT
├── FRONT
├── HINGE_RIGHT
│   ├── RIGHT_DATA
│   ├── HINGE_BACK
│   │   ├── BACK
│   │   └── HINGE_GLUE
│   │       └── GLUE_FLAP
│   ├── HINGE_TOP_DUST_RIGHT
│   │   └── TOP_DUST_RIGHT
│   └── HINGE_BOTTOM_DUST_RIGHT
│       └── BOTTOM_DUST_RIGHT
├── HINGE_LEFT
│   ├── LEFT_COPY
│   ├── HINGE_TOP_DUST_LEFT
│   │   └── TOP_DUST_LEFT
│   └── HINGE_BOTTOM_DUST_LEFT
│       └── BOTTOM_DUST_LEFT
├── HINGE_TOP
│   └── TOP
├── HINGE_BOTTOM
│   └── BOTTOM
├── INNER_ASSEMBLY
│   ├── INSERT_TRAY
│   ├── INNER_JAR
│   │   └── CREAM_CORE
│   ├── JAR_CAP
│   ├── SEAL_DISC
│   └── LEAFLET
└── runtime anchors
```

## Runtime anchors

Required:
- `ANCHOR_CLAIM_FRONT`
- `ANCHOR_COPY_LEFT`
- `ANCHOR_DATA_RIGHT`
- `ANCHOR_BACK_REFLOW`
- `ANCHOR_SURFACE_FRONT`
- `ANCHOR_SURFACE_LEFT`
- `ANCHOR_SURFACE_RIGHT`
- `ANCHOR_SURFACE_BACK`
- `ANCHOR_EXPLODE_JAR`
- `ANCHOR_EXPLODE_CAP`
- `ANCHOR_EXPLODE_SEAL`
- `ANCHOR_EXPLODE_INSERT`
- `ANCHOR_EXPLODE_LEAFLET`

## Materials

Required:
- `MAT_PAPER_OUTER`
- `MAT_PAPER_EDGE`
- `MAT_INSERT_PULP`
- `MAT_JAR`
- `MAT_CREAM`
- `MAT_CAP`
- `MAT_SEAL`
- `MAT_LEAFLET`

## Fold metadata

Every `HINGE_*` runtime hinge must preserve:
- `packshift_role=fold_hinge`
- `fold_axis`
- `closed_deg`
- `flat_deg`

The browser reads these values from glTF extras.

## Decomposition contract

Internal physical components remain separate runtime nodes.

The browser may move them toward the exported explode anchors but must not flatten them into the carton hierarchy.

## Export

Target:

`public/models/packshift-master.glb`

Requirements:
- binary GLB
- `export_apply=False`
- `export_extras=True`
- no default Camera/Light/Cube
- stable node names
- hierarchy preserved
- deterministic project-relative path

## Proof boundary

A valid Blender scene proves asset authoring.

A valid GLB proves asset generation.

A successful Vite build proves build integration.

Only the live browser can prove:
- drag/drop surface placement
- pressure response
- user-controlled decomposition
- exported hinge behavior
- X-ray view
- reflow
- refold
- mobile interaction

A valid GLB is not live runtime proof and is not manufacturing CAD.
