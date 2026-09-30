#!/usr/bin/env python3
"""Validate PACKSHIFT V5 GLB structure without Blender.

This proves the committed artifact contract only.
It does not prove live browser behavior.
"""
from __future__ import annotations
import json
import struct
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from glb_geometry import check_closed_pose  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
GLB = ROOT / "public" / "models" / "packshift-master.glb"

REQUIRED_NODES = {
    "PACKSHIFT_ROOT","FRONT","HINGE_RIGHT","RIGHT_DATA","HINGE_BACK","BACK",
    "HINGE_LEFT","LEFT_COPY","HINGE_GLUE","GLUE_FLAP","HINGE_TOP","TOP",
    "HINGE_BOTTOM","BOTTOM","HINGE_TOP_DUST_LEFT","TOP_DUST_LEFT",
    "HINGE_TOP_DUST_RIGHT","TOP_DUST_RIGHT","HINGE_BOTTOM_DUST_LEFT",
    "BOTTOM_DUST_LEFT","HINGE_BOTTOM_DUST_RIGHT","BOTTOM_DUST_RIGHT",
    "INNER_ASSEMBLY","INSERT_TRAY","INNER_JAR","CREAM_CORE","JAR_CAP","SEAL_DISC","LEAFLET",
    "ANCHOR_CLAIM_FRONT","ANCHOR_COPY_LEFT","ANCHOR_DATA_RIGHT","ANCHOR_BACK_REFLOW",
    "ANCHOR_SURFACE_FRONT","ANCHOR_SURFACE_LEFT","ANCHOR_SURFACE_RIGHT","ANCHOR_SURFACE_BACK",
    "ANCHOR_EXPLODE_JAR","ANCHOR_EXPLODE_CAP","ANCHOR_EXPLODE_SEAL",
    "ANCHOR_EXPLODE_INSERT","ANCHOR_EXPLODE_LEAFLET",
}

REQUIRED_MATERIALS = {
    "MAT_PAPER_OUTER","MAT_PAPER_EDGE","MAT_INSERT_PULP","MAT_JAR",
    "MAT_CREAM","MAT_CAP","MAT_SEAL","MAT_LEAFLET",
}

def fail(message: str) -> int:
    print("PACKSHIFT V5 GLB CONTRACT: FAIL")
    print("- " + message)
    return 1

def main() -> int:
    if not GLB.is_file():
        return fail(f"missing GLB: {GLB}")

    raw=GLB.read_bytes()
    if len(raw)<20:
        return fail("GLB too small")

    magic,version,total=struct.unpack_from("<4sII",raw,0)
    if magic!=b"glTF" or version!=2:
        return fail("invalid GLB header")
    if total!=len(raw):
        return fail("declared GLB length mismatch")

    offset=12
    json_chunk=None
    while offset+8<=len(raw):
        length,chunk_type=struct.unpack_from("<II",raw,offset)
        offset+=8
        chunk=raw[offset:offset+length]
        offset+=length
        if chunk_type==0x4E4F534A:
            json_chunk=chunk.rstrip(b" \t\r\n\x00")
            break
    if json_chunk is None:
        return fail("JSON chunk missing")

    gltf=json.loads(json_chunk.decode("utf-8"))
    nodes={n.get("name") for n in gltf.get("nodes",[]) if n.get("name")}
    materials={m.get("name") for m in gltf.get("materials",[]) if m.get("name")}

    missing_nodes=sorted(REQUIRED_NODES-nodes)
    missing_materials=sorted(REQUIRED_MATERIALS-materials)
    if missing_nodes:
        return fail("missing nodes: "+", ".join(missing_nodes))
    if missing_materials:
        return fail("missing materials: "+", ".join(missing_materials))

    geometry=check_closed_pose(GLB)
    if geometry:
        return fail("closed-pose geometry: " + "; ".join(geometry))

    print("PACKSHIFT V5 GLB CONTRACT: PASS")
    print(f"- bytes: {len(raw)}")
    print(f"- nodes: {len(nodes)}")
    print(f"- materials: {len(materials)}")
    print("- folding shell and internal product architecture present")
    print("- surface and explode anchors present")
    print("- closed pose: flaps and internals contained in the 56 x 130 x 36 mm shell")
    print("- browser behavior not asserted by this check")
    return 0

if __name__=="__main__":
    sys.exit(main())
