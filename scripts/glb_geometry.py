#!/usr/bin/env python3
"""Closed-pose geometry checks for the PACKSHIFT master GLB (stdlib only).

Structural contracts (node names, materials) cannot tell whether the carton
actually closes. This module composes every node's TRS into world space and
asserts, in the authored (closed) pose:

- every internal component (jar, cap, seal, insert, leaflet, cream) sits
  inside the carton shell;
- glue and dust flaps are tucked inside the shell envelope, not protruding;
- nothing in the shell pokes outside the nominal 56 x 130 x 36 mm envelope.

Concept geometry only. Passing this is not manufacturing validation.
"""
from __future__ import annotations

import json
import struct
from pathlib import Path

TOL = 0.0012  # 1.2 mm: board thickness + bevel slack, in metres

SHELL = {"FRONT", "BACK", "LEFT_COPY", "RIGHT_DATA", "TOP", "BOTTOM"}
FLAPS = {"GLUE_FLAP", "TOP_TUCK", "TOP_DUST_LEFT", "TOP_DUST_RIGHT", "BOTTOM_DUST_LEFT", "BOTTOM_DUST_RIGHT"}
INTERNALS = {"INSERT_TRAY", "INNER_JAR", "CREAM_CORE", "JAR_CAP", "SEAL_DISC", "LEAFLET"}


def read_gltf(path: Path) -> dict:
    raw = path.read_bytes()
    offset = 12
    while offset + 8 <= len(raw):
        length, chunk_type = struct.unpack_from("<II", raw, offset)
        offset += 8
        if chunk_type == 0x4E4F534A:
            return json.loads(raw[offset:offset + length].rstrip(b" \t\r\n\x00").decode("utf-8"))
        offset += length
    raise RuntimeError("JSON chunk missing")


def mat_mul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def trs(node: dict):
    tx, ty, tz = node.get("translation", [0, 0, 0])
    qx, qy, qz, qw = node.get("rotation", [0, 0, 0, 1])
    sx, sy, sz = node.get("scale", [1, 1, 1])
    r = [
        [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw)],
        [2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw)],
        [2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)],
    ]
    return [
        [r[0][0] * sx, r[0][1] * sy, r[0][2] * sz, tx],
        [r[1][0] * sx, r[1][1] * sy, r[1][2] * sz, ty],
        [r[2][0] * sx, r[2][1] * sy, r[2][2] * sz, tz],
        [0, 0, 0, 1],
    ]


def world_bounds(gltf: dict) -> dict[str, tuple[list[float], list[float]]]:
    nodes = gltf["nodes"]
    out: dict[str, tuple[list[float], list[float]]] = {}

    def visit(index: int, parent):
        node = nodes[index]
        world = mat_mul(parent, trs(node))
        if "mesh" in node:
            lo = [float("inf")] * 3
            hi = [float("-inf")] * 3
            for prim in gltf["meshes"][node["mesh"]]["primitives"]:
                acc = gltf["accessors"][prim["attributes"]["POSITION"]]
                mn, mx = acc["min"], acc["max"]
                for cx in (mn[0], mx[0]):
                    for cy in (mn[1], mx[1]):
                        for cz in (mn[2], mx[2]):
                            p = [sum(world[i][k] * v for k, v in enumerate((cx, cy, cz, 1))) for i in range(3)]
                            lo = [min(a, b) for a, b in zip(lo, p)]
                            hi = [max(a, b) for a, b in zip(hi, p)]
            out[node.get("name", f"#{index}")] = (lo, hi)
        for child in node.get("children", []):
            visit(child, world)

    identity = [[1 if i == j else 0 for j in range(4)] for i in range(4)]
    for root in gltf["scenes"][gltf.get("scene", 0)]["nodes"]:
        visit(root, identity)
    return out


def check_closed_pose(path: Path) -> list[str]:
    gltf = read_gltf(path)
    bounds = world_bounds(gltf)
    shell = [bounds[n] for n in SHELL if n in bounds]
    if len(shell) != len(SHELL):
        return ["shell panels missing from GLB"]

    lo = [min(b[0][i] for b in shell) for i in range(3)]
    hi = [max(b[1][i] for b in shell) for i in range(3)]
    errors: list[str] = []

    size_mm = [round((hi[i] - lo[i]) * 1000, 1) for i in range(3)]
    expected = sorted([56.0, 130.0, 36.0])
    if any(abs(a - b) > 2.0 for a, b in zip(sorted(size_mm), expected)):
        errors.append(f"shell envelope {size_mm} mm != nominal 56 x 130 x 36 mm")

    def outside(name: str, inset: float) -> list[str]:
        blo, bhi = bounds[name]
        axes = "XYZ"
        msgs = []
        for i in range(3):
            if blo[i] < lo[i] + inset - TOL:
                msgs.append(f"{name} pokes out of shell on -{axes[i]} by {(lo[i] + inset - blo[i]) * 1000:.1f} mm")
            if bhi[i] > hi[i] - inset + TOL:
                msgs.append(f"{name} pokes out of shell on +{axes[i]} by {(bhi[i] - hi[i] + inset) * 1000:.1f} mm")
        return msgs

    for name in sorted(FLAPS | INTERNALS):
        if name not in bounds:
            errors.append(f"{name} missing from GLB")
            continue
        errors.extend(outside(name, 0.0))
    return errors


if __name__ == "__main__":
    import sys

    target = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "public/models/packshift-master.glb")
    problems = check_closed_pose(target)
    if problems:
        print("PACKSHIFT CLOSED-POSE GEOMETRY: FAIL")
        for p in problems:
            print("- " + p)
        sys.exit(1)
    print("PACKSHIFT CLOSED-POSE GEOMETRY: PASS")
    print("- internals and flaps contained inside the 56 x 130 x 36 mm shell")
