"""Validate the exported PACKSHIFT V5 GLB using Python stdlib."""
from pathlib import Path
import json
import struct
import sys

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
FORBIDDEN_NODES={"Cube","Camera","Light"}
REQUIRED_MATERIALS={
    "MAT_PAPER_OUTER","MAT_PAPER_EDGE","MAT_INSERT_PULP","MAT_JAR",
    "MAT_CREAM","MAT_CAP","MAT_SEAL","MAT_LEAFLET",
}

def read_glb_json(path: Path):
    with path.open("rb") as handle:
        magic,version,total=struct.unpack("<4sII",handle.read(12))
        if magic!=b"glTF" or version!=2:
            raise RuntimeError("not a glTF 2.0 GLB")
        chunk_length,chunk_type=struct.unpack("<II",handle.read(8))
        if chunk_type!=0x4E4F534A:
            raise RuntimeError("first GLB chunk is not JSON")
        payload=handle.read(chunk_length).decode("utf-8").rstrip("\x00 \t\r\n")
        return json.loads(payload),total

def main():
    path=Path("public/models/packshift-master.glb")
    if not path.is_file():
        raise RuntimeError("GLB missing")
    data,total=read_glb_json(path)
    nodes={n.get("name") for n in data.get("nodes",[]) if n.get("name")}
    materials={m.get("name") for m in data.get("materials",[]) if m.get("name")}

    missing=sorted(REQUIRED_NODES-nodes)
    forbidden=sorted(FORBIDDEN_NODES & nodes)
    missing_materials=sorted(REQUIRED_MATERIALS-materials)
    if missing: raise RuntimeError("missing GLB nodes: "+", ".join(missing))
    if forbidden: raise RuntimeError("forbidden default GLB nodes: "+", ".join(forbidden))
    if missing_materials: raise RuntimeError("missing GLB materials: "+", ".join(missing_materials))

    roots=[]
    scenes=data.get("scenes",[])
    if scenes:
        for idx in scenes[0].get("nodes",[]):
            roots.append(data["nodes"][idx].get("name"))
    if roots!=["PACKSHIFT_ROOT"]:
        raise RuntimeError(f"unexpected GLB scene roots: {roots}")

    print("PACKSHIFT V5 GLB CONTRACT: PASS")
    print(f"- bytes: {total}")
    print(f"- nodes: {len(nodes)}")
    print(f"- materials: {len(materials)}")
    print("- folding shell + internal product architecture present")
    print("- runtime anchors present")
    print("- default Blender objects absent")

if __name__=="__main__":
    try: main()
    except Exception as exc:
        print(f"PACKSHIFT V5 GLB CONTRACT: FAIL\n- {exc}")
        sys.exit(1)
