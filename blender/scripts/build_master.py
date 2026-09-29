"""Build PACKSHIFT_MASTER from the concept geometry spec.

Status: UNVERIFIED_UNTIL_EXECUTED_IN_BLENDER.
This script is a deterministic starting point for the Blender MCP benchmark.
"""

import bpy

MM = 0.001

WIDTH = 56 * MM
DEPTH = 36 * MM
HEIGHT = 130 * MM
THICKNESS = 0.45 * MM

ROOT = "PACKSHIFT_ROOT"


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def ensure_material(name, base_color, roughness=0.9):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.diffuse_color = (*base_color, 1.0)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
        bsdf.inputs["Roughness"].default_value = roughness
    return material


def make_panel(name, size_x, size_y, location, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(
        location=location,
        rotation=rotation,
        scale=(size_x / 2, THICKNESS / 2, size_y / 2),
    )
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def parent_keep_world(child, parent):
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world


def build():
    reset_scene()

    outer = ensure_material("MAT_PAPER_OUTER", (0.88, 0.84, 0.75), 0.93)
    edge = ensure_material("MAT_PAPER_EDGE", (0.54, 0.45, 0.34), 0.98)

    root = bpy.data.objects.new(ROOT, None)
    bpy.context.collection.objects.link(root)

    front = make_panel("FRONT", WIDTH, HEIGHT, (0, 0, 0))
    right = make_panel("RIGHT_DATA", DEPTH, HEIGHT, ((WIDTH + DEPTH) / 2, 0, 0))
    back = make_panel("BACK", WIDTH, HEIGHT, (WIDTH + DEPTH, 0, 0))
    left = make_panel("LEFT_COPY", DEPTH, HEIGHT, (-(WIDTH + DEPTH) / 2, 0, 0))
    top = make_panel("TOP", WIDTH, DEPTH, (0, 0, (HEIGHT + DEPTH) / 2))
    bottom = make_panel("BOTTOM", WIDTH, DEPTH, (0, 0, -(HEIGHT + DEPTH) / 2))

    for panel in (front, right, back, left, top, bottom):
        panel.data.materials.append(outer)
        panel.data.materials.append(edge)
        parent_keep_world(panel, root)

    root["packshift_asset_version"] = "0.1.0"
    root["geometry_truth"] = "CONCEPT_DIMENSIONS_NOT_MANUFACTURING_VALIDATED"

    bpy.context.view_layer.objects.active = front
    front.select_set(True)

    print("PACKSHIFT_MASTER build complete")


if __name__ == "__main__":
    build()
