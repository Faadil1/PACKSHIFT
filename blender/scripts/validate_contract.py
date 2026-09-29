#!/usr/bin/env python3
"""Static PACKSHIFT Blender contract validation; does not require Blender."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]

CHECKS = {
    "blender/specs/PACKAGING-GEOMETRY.yaml": [
        "asset: PACKSHIFT_MASTER_01",
        "right_hinge: HINGE_RIGHT",
        "claim_front: ANCHOR_CLAIM_FRONT",
        "digital_twin_claim_is_forbidden_until_source_dimension_truth_exists",
    ],
    "blender/specs/GLB-CONTRACT.md": [
        "PACKSHIFT_ROOT",
        "HINGE_BACK",
        "ANCHOR_DATA_RIGHT",
        "export_apply=False",
        "A valid GLB is not live runtime proof",
    ],
    "blender/scripts/build_master.py": [
        'ROOT = "PACKSHIFT_ROOT"',
        '"HINGE_RIGHT"',
        '"ANCHOR_BACK_REFLOW"',
        'root["manufacturing_validation_claimed"] = False',
    ],
    "blender/scripts/validate_scene.py": [
        "PACKSHIFT BLENDER VALIDATION: PASS",
        "fold_hinge",
        "concept_dimensions_only",
    ],
    "blender/scripts/export_glb.py": [
        "packshift-master.glb",
        'export_format="GLB"',
        "export_apply=False",
        "export_extras=True",
    ],
}


def main() -> int:
    errors = []
    for rel, markers in CHECKS.items():
        path = ROOT / rel
        if not path.is_file():
            errors.append(f"missing file: {rel}")
            continue
        text = path.read_text(encoding="utf-8")
        for marker in markers:
            if marker not in text:
                errors.append(f"{rel} missing marker: {marker}")

    if errors:
        print("PACKSHIFT BLENDER CONTRACT: FAIL")
        for error in errors:
            print(f"- {error}")
        return 1

    print("PACKSHIFT BLENDER CONTRACT: PASS")
    print("- geometry/hinge contract present")
    print("- runtime anchor contract present")
    print("- deterministic Blender build/validate/export scripts present")
    print("- GLB/runtime/manufacturing truth boundaries present")
    return 0


if __name__ == "__main__":
    sys.exit(main())
