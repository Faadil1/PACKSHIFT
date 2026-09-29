# PACKSHIFT GLB Contract

## Purpose

This contract prevents Blender and the Three.js runtime from drifting apart.

## Format

- Runtime asset: `GLB`
- Units in Blender: meters internally, sourced from millimeter spec values
- Up axis: Blender Z-up
- Export target: glTF 2.0 / GLB
- Transform application: explicit before export where safe
- Runtime: Three.js / React Three Fiber

## Required hierarchy

```
PACKSHIFT_ROOT
├── FRONT
├── RIGHT_DATA
├── BACK
├── LEFT_COPY
├── TOP
└── BOTTOM
```

Every foldable panel must expose a stable pivot aligned to its intended fold edge.

## Stable names

The six panel node names are runtime contracts.

Renaming requires a coordinated change in:
- Blender validation
- export validation
- Three.js loader
- runtime animation bindings
- state/handover

## Material contract

At minimum:

- `MAT_PAPER_OUTER`
- `MAT_PAPER_EDGE`

Additional print/varnish materials may be introduced, but the runtime must not depend on arbitrary Blender viewport-only state.

## Fold contract

The runtime must be able to address each foldable panel independently.

Initial target semantics:

- RIGHT_DATA folds from FRONT right edge
- BACK folds from RIGHT_DATA outer edge
- LEFT_COPY folds from FRONT left edge
- TOP folds from FRONT top edge
- BOTTOM folds from FRONT bottom edge

## Export receipt

Before promotion, record:

- source .blend version
- geometry spec version
- exported GLB file hash
- node-name validation result
- pivot validation result
- material validation result
- Three.js import result
- runtime fold/unfold result
- desktop/mobile result

## Truth boundary

A valid GLB is an asset proof. It is not evidence that the live compiler, constraint logic, collision logic, or interaction loop works.
