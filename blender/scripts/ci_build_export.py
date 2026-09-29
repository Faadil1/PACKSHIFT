"""Build, validate, save and export PACKSHIFT_MASTER in real Blender.

Designed for headless CI and remote Blender workers.

Truth boundary:
- validates the project scene contract only;
- does not claim manufacturing validity;
- does not prove Three.js runtime integration.
"""

from pathlib import Path
import runpy
import bpy


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
BLEND_DIR = REPO_ROOT / "blender"
MODEL_DIR = REPO_ROOT / "public" / "models"


def run_script(name: str):
    runpy.run_path(str(SCRIPT_DIR / name), run_name="__main__")


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    run_script("build_master.py")
    run_script("validate_scene.py")

    blend_path = BLEND_DIR / "PACKSHIFT_MASTER.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    run_script("export_glb.py")

    glb_path = MODEL_DIR / "packshift-master.glb"

    if not blend_path.is_file():
        raise RuntimeError("PACKSHIFT_MASTER.blend was not created")
    if not glb_path.is_file():
        raise RuntimeError("packshift-master.glb was not created")

    print("PACKSHIFT HEADLESS BLENDER PROOF: PASS")
    print(f"- blend: {blend_path}")
    print(f"- glb: {glb_path}")
    print("- runtime integration: NOT_YET_PROVEN")


if __name__ == "__main__":
    main()
