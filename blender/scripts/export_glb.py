"""Export the canonical PACKSHIFT master to GLB.

Status: UNVERIFIED_UNTIL_EXECUTED_IN_BLENDER.
"""
from __future__ import annotations

from pathlib import Path
import os
import bpy

ROOT = "PACKSHIFT_ROOT"


def repo_root() -> Path:
    override = os.environ.get("PACKSHIFT_PROJECT_ROOT")
    if override:
        return Path(override).expanduser().resolve()

    if bpy.data.filepath:
        # Expected save location: <repo>/blender/PACKSHIFT_MASTER.blend
        return Path(bpy.data.filepath).resolve().parent.parent

    return Path.cwd().resolve()


def main() -> None:
    if bpy.data.objects.get(ROOT) is None:
        raise RuntimeError("PACKSHIFT_ROOT missing; run build_master.py first")

    output = repo_root() / "public" / "models" / "packshift-master.glb"
    output.parent.mkdir(parents=True, exist_ok=True)

    collection = bpy.data.collections.get("PACKSHIFT")
    if collection is None:
        raise RuntimeError("PACKSHIFT collection missing")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in collection.objects:
        obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_materials="EXPORT",
        export_extras=True,
        export_cameras=False,
        export_lights=False,
    )

    print(f"PACKSHIFT GLB export complete: {output}")


if __name__ == "__main__":
    main()
