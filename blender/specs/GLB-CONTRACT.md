# PACKSHIFT Blender → GLB → Three.js Contract

## Purpose

This contract prevents the Blender master and the interactive Three.js runtime from drifting apart.

## Required exported hierarchy

```
PACKSHIFT_ROOT
├── FRONT
├── RIGHT_DATA
├── BACK
├── LEFT_COPY
├── TOP
└── BOTTOM
```

The names above are API-level identifiers. Do not rename them without updating the runtime adapter and this contract.

## Units and transforms

- Blender scene unit: millimeters during authoring.
- Export must produce a stable scale understood by the Three.js loader.
- Apply object scale before export unless the rig explicitly requires unapplied scale.
- Rotation/origin must preserve fold pivots.
- `PACKSHIFT_ROOT` is the runtime transform root.
- Front-facing closed package orientation is the canonical zero/hero orientation.

## Pivot contract

Each folding surface must retain a pivot on the real fold edge.

- `RIGHT_DATA` folds around its FRONT boundary.
- `BACK` folds from the outer RIGHT_DATA boundary.
- `LEFT_COPY` folds around its FRONT boundary.
- `TOP` and `BOTTOM` fold from the FRONT top/bottom edges.

The runtime may animate these pivots, but it must not rebuild package geometry from unrelated procedural boxes once the Blender master is adopted.

## Material contract

Minimum:
- paper/cardboard outer material
- inner board/tranche material if geometry exposes thickness

Textures must be local project assets with stable paths or embedded in the GLB.

## Export

Preferred runtime artifact:

`public/models/packshift-master.glb`

Export criteria:
- named nodes preserved
- materials preserved
- normals valid
- no accidental cameras/lights
- no hidden temporary objects
- no unsupported modifier dependency
- fold pivots verified after import

## Runtime integration

React Three Fiber loads the asset through `useGLTF`.

Application logic remains outside Blender:
- FR/EN state
- DATA CARRIER state
- 24H HYDRATION claim
- collision computation
- EU / CANADA state
- operator controls
- deterministic demo timeline

Blender owns the canonical asset geometry, not product/application state.

## Truth boundary

A successful Blender export is only **asset proof**.

Promotion additionally requires:
1. GLB loads in the live R3F runtime.
2. fold/unfold behavior survives export.
3. collision/reflow experience remains understandable.
4. mobile/desktop runtime is checked.
5. at least one failure/recovery case is recorded.
