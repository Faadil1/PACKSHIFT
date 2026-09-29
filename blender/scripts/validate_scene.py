"""Validate the PACKSHIFT Blender scene contract.

Status: UNVERIFIED_UNTIL_EXECUTED_IN_BLENDER.
"""

import bpy

REQUIRED_OBJECTS = [
    "PACKSHIFT_ROOT",
    "FRONT",
    "RIGHT_DATA",
    "BACK",
    "LEFT_COPY",
    "TOP",
    "BOTTOM",
]

REQUIRED_MATERIALS = [
    "MAT_PAPER_OUTER",
    "MAT_PAPER_EDGE",
]


def main():
    errors = []

    for name in REQUIRED_OBJECTS:
        if bpy.data.objects.get(name) is None:
            errors.append(f"missing object: {name}")

    for name in REQUIRED_MATERIALS:
        if bpy.data.materials.get(name) is None:
            errors.append(f"missing material: {name}")

    root = bpy.data.objects.get("PACKSHIFT_ROOT")
    if root:
        for child_name in REQUIRED_OBJECTS[1:]:
            child = bpy.data.objects.get(child_name)
            if child and child.parent != root:
                errors.append(f"{child_name} is not parented to PACKSHIFT_ROOT")

    if errors:
        print("PACKSHIFT BLENDER VALIDATION: FAIL")
        for error in errors:
            print(f"- {error}")
        raise RuntimeError("PACKSHIFT Blender scene contract failed")

    print("PACKSHIFT BLENDER VALIDATION: PASS")
    print("- required hierarchy exists")
    print("- required materials exist")
    print("- truth boundary remains concept-only")


if __name__ == "__main__":
    main()
