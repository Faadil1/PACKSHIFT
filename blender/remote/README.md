# PACKSHIFT — Remote Blender Execution

PACKSHIFT uses a **remote-first, local-fallback** Blender architecture.

There are two remote execution paths:

## Path A — Headless CI worker

Best for deterministic geometry/build/export.

`GitHub Actions → Blender headless → build_master.py → validate_scene.py → .blend + GLB artifacts`

This path does **not** require Blender MCP.

Use it for:
- reproducible geometry generation;
- contract validation;
- GLB export;
- regression checks;
- asset receipts.

## Path B — Interactive remote Blender worker

Best for:
- art direction;
- material tuning;
- Geometry Nodes exploration;
- UV work;
- camera/lighting;
- complex rig authoring;
- iterative Blender MCP control.

Recommended network shape:

`MCP client → SSH/private tunnel → remote workstation localhost:9876 → Blender addon`

Never expose Blender's raw socket directly to the public internet.

## First benchmark strategy

1. Prove the deterministic Blender pipeline with Path A.
2. Keep V3 procedural Three.js as fallback.
3. Add interactive Blender MCP only when it produces value beyond the headless pipeline.
4. Promote Blender MCP only after the registered central benchmark passes.

This separates:
- Blender capability proof;
- Blender MCP provider proof;
- live Three.js runtime proof.
