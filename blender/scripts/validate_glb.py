"""Validate the exported PACKSHIFT GLB using only Python stdlib."""

from pathlib import Path
import json
import struct
import sys

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

FORBIDDEN_NODES = {"Cube", "Camera", "Light"}
REQUIRED_MATERIALS = {"MAT_PAPER_OUTER"}


def read_glb_json(path: Path):
    with path.open("rb") as handle:
        magic, version, total = struct.unpack("<4sII", handle.read(12))
        if magic != b"glTF" or version != 2:
            raise RuntimeError("not a glTF 2.0 GLB")
        chunk_length, chunk_type = struct.unpack("<II", handle.read(8))
        if chunk_type != 0x4E4F534A:
            raise RuntimeError("first GLB chunk is not JSON")
        payload = handle.read(chunk_length).decode("utf-8").rstrip("\x00 \t\r\n")
        return json.loads(payload), total


def main():
    path = Path("public/models/packshift-master.glb")
    if not path.is_file():
        raise RuntimeError("GLB missing")

    data, total = read_glb_json(path)
    nodes = {node.get("name") for node in data.get("nodes", []) if node.get("name")}
    materials = {m.get("name") for m in data.get("materials", []) if m.get("name")}

    missing = sorted(REQUIRED_NODES - nodes)
    forbidden = sorted(FORBIDDEN_NODES & nodes)
    missing_materials = sorted(REQUIRED_MATERIALS - materials)

    if missing:
        raise RuntimeError("missing GLB nodes: " + ", ".join(missing))
    if forbidden:
        raise RuntimeError("forbidden default GLB nodes: " + ", ".join(forbidden))
    if missing_materials:
        raise RuntimeError("missing GLB materials: " + ", ".join(missing_materials))

    roots = []
    scenes = data.get("scenes", [])
    if scenes:
        for idx in scenes[0].get("nodes", []):
            roots.append(data["nodes"][idx].get("name"))

    if roots != ["PACKSHIFT_ROOT"]:
        raise RuntimeError(f"unexpected GLB scene roots: {roots}")

    print("PACKSHIFT GLB CONTRACT: PASS")
    print(f"- bytes: {total}")
    print(f"- nodes: {len(nodes)}")
    print(f"- scene root: {roots[0]}")
    print("- default Blender objects absent")
    print("- required runtime anchors and hinges present")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"PACKSHIFT GLB CONTRACT: FAIL\n- {exc}")
        sys.exit(1)
