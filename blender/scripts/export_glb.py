"""Export PACKSHIFT_MASTER to GLB.

Status: UNVERIFIED_UNTIL_EXECUTED_IN_BLENDER.
"""

from pathlib import Path
import bpy


def main():
    blend_path = Path(bpy.data.filepath)
    if not blend_path:
        raise RuntimeError("Save the .blend file before export so the output location is deterministic.")

    repo_root = blend_path.parent.parent
    output_dir = repo_root / "public" / "models"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "packshift-master.glb"

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )

    print(f"PACKSHIFT GLB export complete: {output_path}")


if __name__ == "__main__":
    main()
