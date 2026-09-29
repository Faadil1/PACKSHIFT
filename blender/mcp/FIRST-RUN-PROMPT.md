# PACKSHIFT — Blender MCP First Benchmark Prompt

Use this prompt only after:

- Blender is open
- Blender MCP addon is enabled
- Start MCP Server is active
- Cursor reports the Blender MCP server as connected
- the repository branch is `feat/blender-master-pipeline`

---

Inspect the PACKSHIFT repository contract before modifying Blender.

Read:

1. `blender/specs/PACKAGING-GEOMETRY.yaml`
2. `blender/specs/GLB-CONTRACT.md`
3. `blender/scripts/build_master.py`
4. `blender/scripts/validate_scene.py`
5. `blender/scripts/export_glb.py`
6. `state/CURRENT.yaml`
7. `state/HANDOVER.yaml`

We are running the first benchmark for the registered system capability
`spatial_asset_and_digital_twin_engineering`.

Do not claim manufacturing validity. The dimensions are concept dimensions.

First perform a READ-ONLY scene inspection and report:

- Blender version
- current scene name
- object names
- whether `PACKSHIFT_ROOT` already exists
- whether any unsaved scene data could be overwritten

If the scene is safe to use, build `PACKSHIFT_MASTER` according to the repository contract.

Required nodes:

- `PACKSHIFT_ROOT`
- `FRONT`
- `RIGHT_DATA`
- `BACK`
- `LEFT_COPY`
- `TOP`
- `BOTTOM`

Required materials:

- `MAT_PAPER_OUTER`
- `MAT_PAPER_EDGE`

Requirements:

- use the concept dimensions from `PACKAGING-GEOMETRY.yaml`
- preserve real panel dimensions
- place fold pivots on the intended fold edges
- keep panel names stable
- use a restrained premium paper material
- do not add decorative geometry that weakens the node contract
- prepare UV surfaces for future print artwork
- keep the object hierarchy inspectable
- save as `blender/PACKSHIFT_MASTER.blend` only after scene validation passes

Then run the equivalent of `validate_scene.py`.

If validation passes:
- save `PACKSHIFT_MASTER.blend`
- export `public/models/packshift-master.glb`
- report the exported node hierarchy
- report any pivot/material/UV limitations
- do not modify the Three.js runtime yet

If any step fails:
- preserve the last known-good scene
- report the exact failure
- do not claim export or benchmark success
- do not promote Blender MCP

Stop after GLB export and inspection.
