# PACKSHIFT Blender Master Pipeline

This directory is the project-side implementation of the central Faadil Agent System capability:

`spatial_asset_and_digital_twin_engineering`

Central policy:
`Faadil1/faadil-agent-system/SPATIAL-ASSET-ENGINEERING-POLICY.yaml`

## Goal

Replace procedural-only carton geometry with a canonical Blender master that can serve:

- the interactive Three.js / React Three Fiber runtime;
- real hinge-driven fold/unfold behavior;
- stable runtime anchors for language, data and claim constraints;
- premium stills and cinematic shots;
- future packaging-family experiments.

## Truth boundary

Current Blender scripts and dimensions are **concept engineering inputs**, not manufacturing validation.

A successful Blender render is not live runtime proof.

A successful GLB export is not Three.js integration proof.

A plausible carton is not a manufacturing-certified dieline or a regulatory-valid package.

## Canonical project route

```text
PACKAGING-GEOMETRY.yaml
        ↓
build_master.py
        ↓
validate_scene.py
        ↓
PACKSHIFT_MASTER.blend
        ↓
export_glb.py
        ↓
public/models/packshift-master.glb
        ↓
Three.js / React Three Fiber
        ↓
constraint → collision → unfold → reflow → refold → valid form
```

## Blender MCP role

Blender MCP is a candidate execution provider for manipulating this master.

Provider state remains:

`CANDIDATE_NOT_PROMOTED`

until the central benchmark passes:

`Faadil1/faadil-agent-system/validation/BLENDER-MCP-ADOPTION-BENCHMARK-001.yaml`

Connection alone is not promotion.

## Required runtime hierarchy

- `PACKSHIFT_ROOT`
- `FRONT`
- `HINGE_RIGHT`
- `RIGHT_DATA`
- `HINGE_BACK`
- `BACK`
- `HINGE_LEFT`
- `LEFT_COPY`
- `HINGE_TOP`
- `TOP`
- `HINGE_BOTTOM`
- `BOTTOM`
- `ANCHOR_CLAIM_FRONT`
- `ANCHOR_COPY_LEFT`
- `ANCHOR_DATA_RIGHT`
- `ANCHOR_BACK_REFLOW`

These names are runtime contracts.

## First benchmark sequence

1. Open Blender.
2. Connect the selected Blender MCP provider.
3. Run or reproduce `build_master.py`.
4. Run `validate_scene.py`.
5. Save as `blender/PACKSHIFT_MASTER.blend`.
6. Export using `export_glb.py`.
7. Verify `public/models/packshift-master.glb`.
8. Replace procedural panel construction in the V3 runtime with the GLB.
9. Bind animation to the named hinge nodes.
10. Test FR/EN, data carrier, claim collision, unfold, reflow, refold, desktop/mobile.
11. Exercise at least one failed export/import and recovery path.

No provider promotion occurs until that complete round-trip is proven.
