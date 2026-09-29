"""Build PACKSHIFT_MASTER_V5 — spatial negotiation master.

Concept engineering asset only; not manufacturing validated.

The V5 master deliberately exposes more of Blender's value:
- folding-carton shell with glue and dust flaps
- stable hinge hierarchy
- internal product jar, cap, seal, insert and leaflet
- runtime anchors for constraints and decomposition
- richer PBR-ish materials
"""
from __future__ import annotations

import math
import bpy

MM = 0.001

WIDTH = 56 * MM
DEPTH = 36 * MM
HEIGHT = 130 * MM
THICKNESS = 0.45 * MM
GLUE = 12 * MM
DUST = 16 * MM

COLLECTION = "PACKSHIFT"
ROOT = "PACKSHIFT_ROOT"


def remove_existing_collection() -> None:
    collection = bpy.data.collections.get(COLLECTION)
    if collection is None:
        return
    for obj in list(collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(collection)


def make_collection() -> bpy.types.Collection:
    collection = bpy.data.collections.new(COLLECTION)
    bpy.context.scene.collection.children.link(collection)
    return collection


def relink(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for existing in list(obj.users_collection):
        existing.objects.unlink(obj)
    collection.objects.link(obj)


def make_empty(name, collection, parent=None, location=(0, 0, 0), rotation=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.006
    obj.location = location
    obj.rotation_euler = rotation
    obj.parent = parent
    collection.objects.link(obj)
    return obj


def principled_material(name, color, roughness=0.5, metallic=0.0, alpha=1.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Alpha"].default_value = alpha
    if alpha < 1.0:
        mat.surface_render_method = "DITHERED"
    return mat


def paper_material():
    mat = bpy.data.materials.get("MAT_PAPER_OUTER") or bpy.data.materials.new("MAT_PAPER_OUTER")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    noise = nodes.new("ShaderNodeTexNoise")
    bump = nodes.new("ShaderNodeBump")

    bsdf.inputs["Base Color"].default_value = (0.90, 0.84, 0.73, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.88
    noise.inputs["Scale"].default_value = 230.0
    noise.inputs["Detail"].default_value = 3.0
    noise.inputs["Roughness"].default_value = 0.72
    bump.inputs["Strength"].default_value = 0.075
    bump.inputs["Distance"].default_value = 0.00009

    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    return mat


def add_bevel(obj, width=0.00065, segments=3):
    mod = obj.modifiers.new("PACKSHIFT_BEVEL", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"


def make_box(name, collection, parent, dimensions, location, material, bevel=0.0005):
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.location = location
    obj.parent = parent
    obj["packshift_role"] = "physical_component"
    obj["concept_dimensions_only"] = True
    obj.data.materials.append(material)
    if bevel:
        add_bevel(obj, min(bevel, min(dimensions) * 0.35), 3)
    relink(obj, collection)
    return obj


def make_panel(name, collection, parent, dimensions, location, material):
    obj = make_box(name, collection, parent, dimensions, location, material, bevel=0.00022)
    obj["packshift_role"] = "panel"
    return obj


def make_cylinder(name, collection, parent, radius, depth, location, material, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth)
    obj = bpy.context.active_object
    obj.name = name
    obj.location = location
    obj.parent = parent
    obj.data.materials.append(material)
    obj["packshift_role"] = "internal_product"
    obj["concept_dimensions_only"] = True
    add_bevel(obj, 0.0007, 4)
    relink(obj, collection)
    return obj


def mark_hinge(hinge, axis, flat_deg):
    hinge["packshift_role"] = "fold_hinge"
    hinge["fold_axis"] = axis
    hinge["closed_deg"] = 0.0
    hinge["flat_deg"] = float(flat_deg)


def set_explode(obj, x=0.0, y=0.0, z=0.0):
    obj["explode_x"] = float(x)
    obj["explode_y"] = float(y)
    obj["explode_z"] = float(z)


def build():
    remove_existing_collection()
    collection = make_collection()

    paper = paper_material()
    edge = principled_material("MAT_PAPER_EDGE", (0.44, 0.34, 0.23), 0.97)
    pulp = principled_material("MAT_INSERT_PULP", (0.55, 0.50, 0.42), 0.94)
    jar = principled_material("MAT_JAR", (0.82, 0.86, 0.82), 0.24)
    cream = principled_material("MAT_CREAM", (0.96, 0.94, 0.88), 0.55)
    cap = principled_material("MAT_CAP", (0.12, 0.115, 0.105), 0.28)
    foil = principled_material("MAT_SEAL", (0.72, 0.73, 0.70), 0.26, metallic=0.75)
    leaflet_mat = principled_material("MAT_LEAFLET", (0.96, 0.95, 0.91), 0.82)

    root = make_empty(ROOT, collection)
    root["packshift_asset_version"] = "0.5.0"
    root["geometry_truth"] = "CONCEPT_DIMENSIONS_NOT_MANUFACTURING_VALIDATED"
    root["manufacturing_validation_claimed"] = False
    root["width_mm"] = 56.0
    root["depth_mm"] = 36.0
    root["height_mm"] = 130.0
    root["board_thickness_mm"] = 0.45

    # Primary shell.
    front = make_panel("FRONT", collection, root, (WIDTH, THICKNESS, HEIGHT), (0, DEPTH/2, 0), paper)

    hinge_right = make_empty("HINGE_RIGHT", collection, root, (WIDTH/2, DEPTH/2, 0))
    mark_hinge(hinge_right, "Z", 90)
    right = make_panel("RIGHT_DATA", collection, hinge_right, (THICKNESS, DEPTH, HEIGHT), (0, -DEPTH/2, 0), paper)

    hinge_back = make_empty("HINGE_BACK", collection, hinge_right, (0, -DEPTH, 0))
    mark_hinge(hinge_back, "Z", 90)
    back = make_panel("BACK", collection, hinge_back, (WIDTH, THICKNESS, HEIGHT), (-WIDTH/2, 0, 0), paper)

    hinge_left = make_empty("HINGE_LEFT", collection, root, (-WIDTH/2, DEPTH/2, 0))
    mark_hinge(hinge_left, "Z", -90)
    left = make_panel("LEFT_COPY", collection, hinge_left, (THICKNESS, DEPTH, HEIGHT), (0, -DEPTH/2, 0), paper)

    hinge_glue = make_empty("HINGE_GLUE", collection, hinge_back, (-WIDTH, 0, 0))
    mark_hinge(hinge_glue, "Z", 105)
    glue = make_panel("GLUE_FLAP", collection, hinge_glue, (GLUE, THICKNESS, HEIGHT), (-GLUE/2, 0, 0), edge)
    set_explode(glue, -0.012, 0.0, 0.0)

    hinge_top = make_empty("HINGE_TOP", collection, root, (0, DEPTH/2, HEIGHT/2))
    mark_hinge(hinge_top, "X", -90)
    top = make_panel("TOP", collection, hinge_top, (WIDTH, DEPTH, THICKNESS), (0, -DEPTH/2, 0), paper)

    hinge_bottom = make_empty("HINGE_BOTTOM", collection, root, (0, DEPTH/2, -HEIGHT/2))
    mark_hinge(hinge_bottom, "X", 90)
    bottom = make_panel("BOTTOM", collection, hinge_bottom, (WIDTH, DEPTH, THICKNESS), (0, -DEPTH/2, 0), paper)

    # Dust flaps: visible only when the package opens.
    hinge_tdl = make_empty("HINGE_TOP_DUST_LEFT", collection, hinge_left, (0, -DEPTH/2, HEIGHT/2))
    mark_hinge(hinge_tdl, "Y", 78)
    top_dust_left = make_panel("TOP_DUST_LEFT", collection, hinge_tdl, (THICKNESS, DUST, DEPTH), (0, -DUST/2, 0), paper)

    hinge_tdr = make_empty("HINGE_TOP_DUST_RIGHT", collection, hinge_right, (0, -DEPTH/2, HEIGHT/2))
    mark_hinge(hinge_tdr, "Y", -78)
    top_dust_right = make_panel("TOP_DUST_RIGHT", collection, hinge_tdr, (THICKNESS, DUST, DEPTH), (0, -DUST/2, 0), paper)

    hinge_bdl = make_empty("HINGE_BOTTOM_DUST_LEFT", collection, hinge_left, (0, -DEPTH/2, -HEIGHT/2))
    mark_hinge(hinge_bdl, "Y", -78)
    bottom_dust_left = make_panel("BOTTOM_DUST_LEFT", collection, hinge_bdl, (THICKNESS, DUST, DEPTH), (0, -DUST/2, 0), paper)

    hinge_bdr = make_empty("HINGE_BOTTOM_DUST_RIGHT", collection, hinge_right, (0, -DEPTH/2, -HEIGHT/2))
    mark_hinge(hinge_bdr, "Y", 78)
    bottom_dust_right = make_panel("BOTTOM_DUST_RIGHT", collection, hinge_bdr, (THICKNESS, DUST, DEPTH), (0, -DUST/2, 0), paper)

    # Internal product architecture.
    inner = make_empty("INNER_ASSEMBLY", collection, root, (0, 0, 0))
    set_explode(inner, 0.0, -0.035, 0.0)

    insert = make_box(
        "INSERT_TRAY", collection, inner,
        (WIDTH*0.78, DEPTH*0.72, 16*MM),
        (0, 0, -HEIGHT*0.29), pulp, bevel=0.0011
    )
    set_explode(insert, 0.0, -0.045, -0.015)

    jar_body = make_cylinder(
        "INNER_JAR", collection, inner,
        radius=19*MM, depth=44*MM,
        location=(0, 0, -HEIGHT*0.07), material=jar
    )
    set_explode(jar_body, 0.065, -0.035, 0.018)

    cream_core = make_cylinder(
        "CREAM_CORE", collection, jar_body,
        radius=17.2*MM, depth=38*MM,
        location=(0, 0, 0), material=cream
    )
    set_explode(cream_core, 0.0, 0.0, 0.0)

    jar_cap = make_cylinder(
        "JAR_CAP", collection, inner,
        radius=19.5*MM, depth=12*MM,
        location=(0, 0, 21*MM), material=cap
    )
    set_explode(jar_cap, 0.067, -0.034, 0.072)

    seal = make_cylinder(
        "SEAL_DISC", collection, inner,
        radius=17.8*MM, depth=0.55*MM,
        location=(0, 0, 15.2*MM), material=foil
    )
    set_explode(seal, 0.066, -0.034, 0.048)

    leaflet = make_box(
        "LEAFLET", collection, inner,
        (34*MM, 0.7*MM, 58*MM),
        (-WIDTH*0.31, 0, HEIGHT*0.12), leaflet_mat, bevel=0.00012
    )
    set_explode(leaflet, -0.074, -0.012, 0.038)

    # Runtime and camera anchors.
    anchors = {
        "ANCHOR_CLAIM_FRONT": (0, DEPTH/2 + THICKNESS, -HEIGHT*0.16),
        "ANCHOR_COPY_LEFT": (-WIDTH/2, 0, HEIGHT*0.10),
        "ANCHOR_DATA_RIGHT": (WIDTH/2, 0, HEIGHT*0.08),
        "ANCHOR_BACK_REFLOW": (0, -DEPTH/2, HEIGHT*0.10),
        "ANCHOR_SURFACE_FRONT": (0, DEPTH/2 + 2*THICKNESS, 0),
        "ANCHOR_SURFACE_LEFT": (-WIDTH/2 - THICKNESS, 0, 0),
        "ANCHOR_SURFACE_RIGHT": (WIDTH/2 + THICKNESS, 0, 0),
        "ANCHOR_SURFACE_BACK": (0, -DEPTH/2 - THICKNESS, 0),
        "ANCHOR_EXPLODE_JAR": (WIDTH*1.3, -DEPTH*0.8, HEIGHT*0.05),
        "ANCHOR_EXPLODE_LEAFLET": (-WIDTH*1.35, -DEPTH*0.35, HEIGHT*0.18),
    }
    for name, loc in anchors.items():
        anchor = make_empty(name, collection, root, loc)
        anchor["packshift_role"] = "runtime_anchor"

    for obj in [front, right, back, left, top, bottom, top_dust_left, top_dust_right, bottom_dust_left, bottom_dust_right]:
        obj["surface_capacity"] = {
            "FRONT": 0.72, "RIGHT_DATA": 0.64, "BACK": 0.88, "LEFT_COPY": 0.68,
            "TOP": 0.22, "BOTTOM": 0.20,
        }.get(obj.name, 0.15)

    bpy.context.view_layer.objects.active = root
    root.select_set(True)
    print("PACKSHIFT_MASTER_V5 build complete")
    return root


if __name__ == "__main__":
    build()
