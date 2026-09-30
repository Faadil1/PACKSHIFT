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
│   ├── TOP
│   └── HINGE_TOP_TUCK
│       └── TOP_TUCK
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

Closed pose (`closed_deg = 0`) is the authored mesh pose and must be a closed
carton: dust flaps fold inward under TOP/BOTTOM, the glue flap sits inside
against LEFT_COPY, and (since 0.6.0) the TOP_TUCK flap is tucked down inside BACK. Sign convention for `flat_deg` is Blender's right-hand rule
about the named local axis.

## Closed-pose geometry contract (since 0.5.1)

`scripts/glb_geometry.py` composes node transforms into world space and fails
if, in the closed pose:
- the shell envelope deviates from 56 x 130 x 36 mm;
- any flap or internal component (jar, cap, seal, cream, insert, leaflet)
  protrudes outside the shell.

0.5.0 failed this check (dust flaps +17.8 mm, glue flap 11.8 mm, cap 1.3 mm,
leaflet 6.1 mm outside the carton); 0.5.1 fixes the Blender source.

## Decomposition contract

Internal physical components remain separate runtime nodes.

The browser may move them toward the exported explode anchors but must not flatten them into the carton hierarchy.

## Export

Target:

`public/models/packshift-master.glb`

Requirements:
- binary GLB
- `export_apply=True` — bevel modifiers are baked so the browser shows the same softened board edges and jar/cap radii Blender renders (transforms and hierarchy are unaffected)
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
