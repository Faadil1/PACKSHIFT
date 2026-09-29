# PACKSHIFT Blender Master Pipeline

This directory is the project-side implementation of the central Faadil Agent System capability:

`spatial_asset_and_digital_twin_engineering`

Central policy:
`Faadil1/faadil-agent-system/SPATIAL-ASSET-ENGINEERING-POLICY.yaml`

## Goal

Replace procedural-only carton geometry with a canonical Blender master that can serve:

- the interactive Three.js / React Three Fiber runtime;
- the fold/unfold spatial compiler;
- premium stills and cinematic shots;
- future packaging-family experiments.

## Truth boundary

Current Blender scripts and dimensions are **concept engineering inputs**, not manufacturing validation.

A successful Blender render is not live runtime proof.
A successful GLB export is not Three.js integration proof.
A plausible carton is not a manufacturing-certified dieline.

## Canonical project route

`PACKAGING-GEOMETRY.yaml → build_master.py → validate_scene.py → PACKSHIFT_MASTER.blend → export_glb.py → packshift-master.glb → Three.js/R3F runtime`

## Blender MCP role

Blender MCP is a candidate execution provider for manipulating this master.

Provider state remains:

`CANDIDATE_NOT_PROMOTED`

until the central benchmark passes:

`Faadil1/faadil-agent-system/validation/BLENDER-MCP-ADOPTION-BENCHMARK-001.yaml`

## Required node contract

- `PACKSHIFT_ROOT`
- `FRONT`
- `RIGHT_DATA`
- `BACK`
- `LEFT_COPY`
- `TOP`
- `BOTTOM`

These names are runtime contracts. Do not rename them without updating `blender/specs/GLB-CONTRACT.md` and the Three.js loader.

## First local benchmark

1. Open Blender.
2. Connect the selected Blender MCP provider.
3. Run or reproduce `build_master.py`.
4. Run `validate_scene.py`.
5. Save `PACKSHIFT_MASTER.blend`.
6. Export with `export_glb.py`.
7. Place the GLB under `public/models/packshift-master.glb`.
8. Replace procedural geometry in the V3 runtime with the GLB while preserving the live constraint logic.
9. Test fold/unfold/refold, desktop/mobile, and one export/runtime failure-recovery case.

No provider promotion occurs until that round-trip is proven.
