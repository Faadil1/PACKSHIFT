"""Validate PACKSHIFT Blender hierarchy, folds, materials and truth boundary.

Status: UNVERIFIED_UNTIL_EXECUTED_IN_BLENDER.
"""
from __future__ import annotations

import bpy

ROOT = "PACKSHIFT_ROOT"

REQUIRED = {
    "FRONT",
    "HINGE_RIGHT",
    "RIGHT_DATA",
    "HINGE_BACK",
    "BACK",
    "HINGE_LEFT",
    "LEFT_COPY",
    "HINGE_TOP",
    "TOP",
    "HINGE_BOTTOM",
    "BOTTOM",
    "ANCHOR_CLAIM_FRONT",
    "ANCHOR_COPY_LEFT",
    "ANCHOR_DATA_RIGHT",
    "ANCHOR_BACK_REFLOW",
}

EXPECTED_PARENT = {
    "FRONT": ROOT,
    "HINGE_RIGHT": ROOT,
    "RIGHT_DATA": "HINGE_RIGHT",
    "HINGE_BACK": "HINGE_RIGHT",
    "BACK": "HINGE_BACK",
    "HINGE_LEFT": ROOT,
    "LEFT_COPY": "HINGE_LEFT",
    "HINGE_TOP": ROOT,
    "TOP": "HINGE_TOP",
    "HINGE_BOTTOM": ROOT,
    "BOTTOM": "HINGE_BOTTOM",
    "ANCHOR_CLAIM_FRONT": ROOT,
    "ANCHOR_COPY_LEFT": "HINGE_LEFT",
    "ANCHOR_DATA_RIGHT": "HINGE_RIGHT",
    "ANCHOR_BACK_REFLOW": "HINGE_BACK",
}

HINGES = {
    "HINGE_RIGHT": ("Z", 90.0),
    "HINGE_BACK": ("Z", 90.0),
    "HINGE_LEFT": ("Z", -90.0),
    "HINGE_TOP": ("X", -90.0),
    "HINGE_BOTTOM": ("X", 90.0),
}


def fail(message: str) -> None:
    print("PACKSHIFT BLENDER VALIDATION: FAIL")
    print(f"- {message}")
    raise RuntimeError(message)


def main() -> None:
    root = bpy.data.objects.get(ROOT)
    if root is None:
        fail(f"missing root: {ROOT}")

    missing = sorted(name for name in REQUIRED if bpy.data.objects.get(name) is None)
    if missing:
        fail("missing nodes: " + ", ".join(missing))

    if root.get("manufacturing_validation_claimed") is not False:
        fail("manufacturing truth-boundary flag missing")

    for name, expected_parent in EXPECTED_PARENT.items():
        obj = bpy.data.objects[name]
        actual_parent = obj.parent.name if obj.parent else None
        if actual_parent != expected_parent:
            fail(f"{name} parent drift: expected {expected_parent}, got {actual_parent}")

    for name, (axis, flat_deg) in HINGES.items():
        hinge = bpy.data.objects[name]
        if hinge.get("packshift_role") != "fold_hinge":
            fail(f"{name} missing fold_hinge role")
        if hinge.get("fold_axis") != axis:
            fail(f"{name} fold axis drift")
        if float(hinge.get("flat_deg")) != flat_deg:
            fail(f"{name} flat rotation drift")

    for name in ["FRONT", "RIGHT_DATA", "BACK", "LEFT_COPY", "TOP", "BOTTOM"]:
        panel = bpy.data.objects[name]
        if panel.type != "MESH":
            fail(f"{name} is not a mesh")
        if panel.get("concept_dimensions_only") is not True:
            fail(f"{name} concept-dimension truth tag missing")

    for material_name in ["MAT_PAPER_OUTER", "MAT_PAPER_EDGE"]:
        if bpy.data.materials.get(material_name) is None:
            fail(f"missing material: {material_name}")

    print("PACKSHIFT BLENDER VALIDATION: PASS")
    print("- stable hierarchy exists")
    print("- fold pivots and metadata exist")
    print("- runtime anchors exist")
    print("- required materials exist")
    print("- concept/manufacturing truth boundary remains explicit")


if __name__ == "__main__":
    main()
