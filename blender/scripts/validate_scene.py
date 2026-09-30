"""Validate PACKSHIFT V5 Blender scene contract."""
from __future__ import annotations
import bpy

ROOT = "PACKSHIFT_ROOT"

REQUIRED = {
    "FRONT","HINGE_RIGHT","RIGHT_DATA","HINGE_BACK","BACK","HINGE_LEFT","LEFT_COPY",
    "HINGE_GLUE","GLUE_FLAP","HINGE_TOP","TOP","HINGE_BOTTOM","BOTTOM",
    "HINGE_TOP_DUST_LEFT","TOP_DUST_LEFT","HINGE_TOP_DUST_RIGHT","TOP_DUST_RIGHT",
    "HINGE_BOTTOM_DUST_LEFT","BOTTOM_DUST_LEFT","HINGE_BOTTOM_DUST_RIGHT","BOTTOM_DUST_RIGHT",
    "INNER_ASSEMBLY","INSERT_TRAY","INNER_JAR","CREAM_CORE","JAR_CAP","SEAL_DISC","LEAFLET",
    "ANCHOR_CLAIM_FRONT","ANCHOR_COPY_LEFT","ANCHOR_DATA_RIGHT","ANCHOR_BACK_REFLOW",
    "ANCHOR_SURFACE_FRONT","ANCHOR_SURFACE_LEFT","ANCHOR_SURFACE_RIGHT","ANCHOR_SURFACE_BACK",
    "ANCHOR_EXPLODE_JAR","ANCHOR_EXPLODE_CAP","ANCHOR_EXPLODE_SEAL","ANCHOR_EXPLODE_INSERT","ANCHOR_EXPLODE_LEAFLET",
}

HINGES = {
    "HINGE_RIGHT":("Z",90.0),"HINGE_BACK":("Z",90.0),"HINGE_LEFT":("Z",-90.0),
    "HINGE_GLUE":("Z",90.0),"HINGE_TOP":("X",-90.0),"HINGE_BOTTOM":("X",90.0),
    "HINGE_TOP_DUST_LEFT":("Y",-90.0),"HINGE_TOP_DUST_RIGHT":("Y",90.0),
    "HINGE_BOTTOM_DUST_LEFT":("Y",90.0),"HINGE_BOTTOM_DUST_RIGHT":("Y",-90.0),
}

MATERIALS = {
    "MAT_PAPER_OUTER","MAT_PAPER_EDGE","MAT_INSERT_PULP","MAT_JAR",
    "MAT_CREAM","MAT_CAP","MAT_SEAL","MAT_LEAFLET",
}

def fail(msg):
    print("PACKSHIFT V5 BLENDER VALIDATION: FAIL")
    print("- " + msg)
    raise RuntimeError(msg)

def main():
    root=bpy.data.objects.get(ROOT)
    if root is None:
        fail("PACKSHIFT_ROOT missing")

    missing=sorted(n for n in REQUIRED if bpy.data.objects.get(n) is None)
    if missing:
        fail("missing nodes: " + ", ".join(missing))

    if root.get("manufacturing_validation_claimed") is not False:
        fail("manufacturing truth boundary missing")

    if root.get("packshift_asset_version") != "0.5.1":
        fail("unexpected asset version")

    for name,(axis,flat_deg) in HINGES.items():
        obj=bpy.data.objects[name]
        if obj.get("packshift_role")!="fold_hinge":
            fail(f"{name} missing fold_hinge role")
        if obj.get("fold_axis")!=axis or float(obj.get("flat_deg"))!=flat_deg:
            fail(f"{name} hinge metadata drift")

    for material in MATERIALS:
        if bpy.data.materials.get(material) is None:
            fail("missing material: " + material)

    for name in ["INNER_JAR","JAR_CAP","SEAL_DISC","LEAFLET","INSERT_TRAY"]:
        obj=bpy.data.objects[name]
        if "explode_x" not in obj or "explode_y" not in obj or "explode_z" not in obj:
            fail(f"{name} missing decomposition metadata")

    print("PACKSHIFT V5 BLENDER VALIDATION: PASS")
    print("- folding-carton shell + dust/glue flaps")
    print("- internal product architecture")
    print("- runtime surface/explode anchors")
    print("- decomposition metadata")
    print("- manufacturing truth boundary preserved")

if __name__=="__main__":
    main()
