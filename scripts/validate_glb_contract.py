#!/usr/bin/env python3
"""Validate PACKSHIFT GLB structure without Blender.

This verifies the exported glTF node contract on the committed binary.
It does not prove browser rendering or live interaction.
"""
from __future__ import annotations

import json
import struct
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
GLB = ROOT / "public" / "models" / "packshift-master.glb"

REQUIRED_NODES = {
    "PACKSHIFT_ROOT",
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

def fail(message: str) -> int:
    print("PACKSHIFT GLB CONTRACT: FAIL")
    print(f"- {message}")
    return 1

def main() -> int:
    if not GLB.is_file():
        return fail(f"missing GLB: {GLB}")

    data = GLB.read_bytes()
    if len(data) < 20:
        return fail("GLB too small")

    magic, version, total_length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        return fail("invalid GLB magic")
    if version != 2:
        return fail(f"unexpected GLB version: {version}")
    if total_length != len(data):
        return fail("declared GLB length does not match file size")

    offset = 12
    json_chunk = None
    while offset + 8 <= len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset: offset + chunk_length]
        offset += chunk_length
        if chunk_type == 0x4E4F534A:
            json_chunk = chunk.rstrip(b" \t\r\n\x00")
            break

    if json_chunk is None:
        return fail("GLB JSON chunk missing")

    gltf = json.loads(json_chunk.decode("utf-8"))
    node_names = {node.get("name") for node in gltf.get("nodes", []) if node.get("name")}
    missing = sorted(REQUIRED_NODES - node_names)
    if missing:
        return fail("missing required nodes: " + ", ".join(missing))

    extras = gltf.get("asset", {}).get("extras", {})
    print("PACKSHIFT GLB CONTRACT: PASS")
    print(f"- file: {GLB.name}")
    print(f"- bytes: {len(data)}")
    print(f"- nodes: {len(node_names)}")
    print("- required hinges/anchors present")
    print("- browser/runtime behavior not asserted by this check")
    if extras:
        print("- asset extras present")
    return 0

if __name__ == "__main__":
    sys.exit(main())
