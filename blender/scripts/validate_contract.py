#!/usr/bin/env python3
"""Static PACKSHIFT V5 Blender contract validation; no Blender required."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]

CHECKS = {
    "blender/specs/PACKAGING-GEOMETRY.yaml": [
        "asset: PACKSHIFT_MASTER_V5",
        "internal_nodes:",
        "surface_capacity:",
        "explode_jar: ANCHOR_EXPLODE_JAR",
        "digital_twin_claim_is_forbidden_until_source_dimension_truth_exists",
    ],
    "blender/specs/GLB-CONTRACT.md": [
        "INNER_ASSEMBLY",
        "TOP_DUST_LEFT",
        "ANCHOR_EXPLODE_INSERT",
        "export_apply=False",
        "A valid GLB is not live runtime proof",
    ],
    "blender/scripts/build_master.py": [
        'ROOT = "PACKSHIFT_ROOT"',
        '"INNER_JAR"',
        '"HINGE_GLUE"',
        '"ANCHOR_EXPLODE_JAR"',
        'root["manufacturing_validation_claimed"] = False',
    ],
    "blender/scripts/validate_scene.py": [
        "PACKSHIFT V5 BLENDER VALIDATION: PASS",
        "fold_hinge",
        "decomposition metadata",
        "manufacturing truth boundary preserved",
    ],
    "blender/scripts/export_glb.py": [
        "packshift-master.glb",
        'export_format="GLB"',
        "export_apply=False",
        "export_extras=True",
    ],
}

def main() -> int:
    errors=[]
    for rel,markers in CHECKS.items():
        path=ROOT/rel
        if not path.is_file():
            errors.append(f"missing file: {rel}")
            continue
        text=path.read_text(encoding="utf-8")
        for marker in markers:
            if marker not in text:
                errors.append(f"{rel} missing marker: {marker}")

    if errors:
        print("PACKSHIFT V5 BLENDER CONTRACT: FAIL")
        for error in errors:
            print(f"- {error}")
        return 1

    print("PACKSHIFT V5 BLENDER CONTRACT: PASS")
    print("- deep physical decomposition contract present")
    print("- fold/dust/glue hierarchy present")
    print("- internal product architecture present")
    print("- runtime surface and explode anchors present")
    print("- truth boundaries preserved")
    return 0

if __name__=="__main__":
    sys.exit(main())
