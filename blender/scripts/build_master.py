"""Build PACKSHIFT_MASTER_01 with stable fold pivots.

Status: UNVERIFIED_UNTIL_EXECUTED_IN_BLENDER.

Run in Blender's scripting environment or through an authorized Blender MCP
Python action. Geometry uses meters internally, sourced from the canonical
millimeter concept spec.
"""
from __future__ import annotations

import bpy

MM = 0.001

WIDTH = 56 * MM
DEPTH = 36 * MM
HEIGHT = 130 * MM
THICKNESS = 0.45 * MM

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


def make_empty(
    name: str,
    collection: bpy.types.Collection,
    parent: bpy.types.Object | None = None,
    location=(0.0, 0.0, 0.0),
) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.008
    obj.location = location
    obj.parent = parent
    collection.objects.link(obj)
    return obj


def make_materials():
    outer = bpy.data.materials.get("MAT_PAPER_OUTER") or bpy.data.materials.new("MAT_PAPER_OUTER")
    outer.use_nodes = True
    nodes = outer.node_tree.nodes
    links = outer.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    noise = nodes.new("ShaderNodeTexNoise")
    bump = nodes.new("ShaderNodeBump")

    bsdf.inputs["Base Color"].default_value = (0.863, 0.805, 0.710, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.90
    noise.inputs["Scale"].default_value = 180.0
    noise.inputs["Detail"].default_value = 2.0
    noise.inputs["Roughness"].default_value = 0.7
    bump.inputs["Strength"].default_value = 0.05
    bump.inputs["Distance"].default_value = 0.00008

    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    edge = bpy.data.materials.get("MAT_PAPER_EDGE") or bpy.data.materials.new("MAT_PAPER_EDGE")
    edge.use_nodes = True
    edge_bsdf = edge.node_tree.nodes.get("Principled BSDF")
    edge_bsdf.inputs["Base Color"].default_value = (0.46, 0.36, 0.25, 1.0)
    edge_bsdf.inputs["Roughness"].default_value = 0.97
    return outer, edge


def make_panel(
    name: str,
    collection: bpy.types.Collection,
    parent: bpy.types.Object,
    dimensions,
    location,
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))
    obj = bpy.context.active_object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.location = location
    obj.parent = parent
    obj["packshift_role"] = "panel"
    obj["concept_dimensions_only"] = True
    obj.data.materials.append(material)
    relink(obj, collection)
    return obj


def mark_hinge(hinge: bpy.types.Object, axis: str, flat_deg: float) -> None:
    hinge["packshift_role"] = "fold_hinge"
    hinge["fold_axis"] = axis
    hinge["closed_deg"] = 0.0
    hinge["flat_deg"] = flat_deg


def build() -> bpy.types.Object:
    remove_existing_collection()
    collection = make_collection()
    outer, _edge = make_materials()

    root = make_empty(ROOT, collection)
    root["packshift_asset_version"] = "0.2.0"
    root["geometry_truth"] = "CONCEPT_DIMENSIONS_NOT_MANUFACTURING_VALIDATED"
    root["manufacturing_validation_claimed"] = False
    root["width_mm"] = 56.0
    root["depth_mm"] = 36.0
    root["height_mm"] = 130.0
    root["board_thickness_mm"] = 0.45

    # Fixed front panel.
    make_panel(
        "FRONT",
        collection,
        root,
        (WIDTH, THICKNESS, HEIGHT),
        (0.0, DEPTH / 2.0, 0.0),
        outer,
    )

    # Right side and nested back fold.
    hinge_right = make_empty(
        "HINGE_RIGHT",
        collection,
        root,
        (WIDTH / 2.0, DEPTH / 2.0, 0.0),
    )
    mark_hinge(hinge_right, "Z", 90.0)
    make_panel(
        "RIGHT_DATA",
        collection,
        hinge_right,
        (THICKNESS, DEPTH, HEIGHT),
        (0.0, -DEPTH / 2.0, 0.0),
        outer,
    )

    hinge_back = make_empty(
        "HINGE_BACK",
        collection,
        hinge_right,
        (0.0, -DEPTH, 0.0),
    )
    mark_hinge(hinge_back, "Z", 90.0)
    make_panel(
        "BACK",
        collection,
        hinge_back,
        (WIDTH, THICKNESS, HEIGHT),
        (-WIDTH / 2.0, 0.0, 0.0),
        outer,
    )

    # Left side.
    hinge_left = make_empty(
        "HINGE_LEFT",
        collection,
        root,
        (-WIDTH / 2.0, DEPTH / 2.0, 0.0),
    )
    mark_hinge(hinge_left, "Z", -90.0)
    make_panel(
        "LEFT_COPY",
        collection,
        hinge_left,
        (THICKNESS, DEPTH, HEIGHT),
        (0.0, -DEPTH / 2.0, 0.0),
        outer,
    )

    # Top and bottom faces pivot from the front face.
    hinge_top = make_empty(
        "HINGE_TOP",
        collection,
        root,
        (0.0, DEPTH / 2.0, HEIGHT / 2.0),
    )
    mark_hinge(hinge_top, "X", -90.0)
    make_panel(
        "TOP",
        collection,
        hinge_top,
        (WIDTH, DEPTH, THICKNESS),
        (0.0, -DEPTH / 2.0, 0.0),
        outer,
    )

    hinge_bottom = make_empty(
        "HINGE_BOTTOM",
        collection,
        root,
        (0.0, DEPTH / 2.0, -HEIGHT / 2.0),
    )
    mark_hinge(hinge_bottom, "X", 90.0)
    make_panel(
        "BOTTOM",
        collection,
        hinge_bottom,
        (WIDTH, DEPTH, THICKNESS),
        (0.0, -DEPTH / 2.0, 0.0),
        outer,
    )

    # Transform-only runtime anchors.
    make_empty(
        "ANCHOR_CLAIM_FRONT",
        collection,
        root,
        (0.0, DEPTH / 2.0 + THICKNESS, -HEIGHT * 0.16),
    )
    make_empty(
        "ANCHOR_COPY_LEFT",
        collection,
        hinge_left,
        (0.0, -DEPTH * 0.5, HEIGHT * 0.10),
    )
    make_empty(
        "ANCHOR_DATA_RIGHT",
        collection,
        hinge_right,
        (0.0, -DEPTH * 0.5, HEIGHT * 0.08),
    )
    make_empty(
        "ANCHOR_BACK_REFLOW",
        collection,
        hinge_back,
        (-WIDTH * 0.22, 0.0, HEIGHT * 0.10),
    )

    bpy.context.view_layer.objects.active = root
    root.select_set(True)
    print("PACKSHIFT_MASTER_01 build complete")
    return root


if __name__ == "__main__":
    build()
