# Blender pipeline — PACKSHIFT

PACKSHIFT is the first benchmark for the Faadil Agent System capability:

`spatial_asset_and_digital_twin_engineering`

Central contracts live in `Faadil1/faadil-agent-system`:
- `SPATIAL-ASSET-ENGINEERING-POLICY.yaml`
- `spatial_engineering/BLENDER-MCP-CONTRACT.yaml`
- `validation/BLENDER-MCP-ADOPTION-BENCHMARK-001.yaml`

## Target pipeline

`PACKSHIFT need → Blender master → scene validation → GLB export → R3F runtime → visual/runtime QA`

## Provider state

- Blender: registered local 3D authoring provider
- Blender MCP: candidate, not promoted yet
- Three.js / React Three Fiber: current interactive runtime

## Protected setup action

The Blender application/add-on/MCP server must actually be installed and connected locally before any Blender MCP execution can be claimed.

Until that happens, this folder is the **contract/preparation layer**, not evidence that Blender MCP has run.

## First MCP task after connection

Create or inspect `PACKSHIFT_MASTER_01` from `specs/PACKAGING-GEOMETRY.yaml`, enforce the node names and pivots in `specs/GLB-CONTRACT.md`, export a GLB, and validate it in the existing V3 branch without deleting the current procedural fallback.
