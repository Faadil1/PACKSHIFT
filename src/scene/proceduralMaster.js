// Procedural twin of blender/scripts/build_master.py (asset 0.6.0).
//
// Same node names, hierarchy, closed pose and fold metadata as the Blender
// master, built directly in Three.js and parameterised by carton size. Used
// for ?procedural=1, as the automatic fallback if the GLB cannot load, and for
// any non-nominal carton size chosen in the studio (the Blender master is
// authored at 56 x 36 x 130 mm only).
//
// Coordinates are authored in Blender space (X width, Y depth with +Y = front,
// Z up) and converted exactly as the glTF exporter does: (x, y, z) -> (x, z, -y).

import * as THREE from 'three';
import { NOMINAL_DIMS, clampDims } from '../model/pressure.js';

const MM = 0.001;
const T = 0.45 * MM;
const GLUE = 12 * MM;
const DUST = 16 * MM;
const TUCK = 15 * MM;

const g = ([x, y, z]) => new THREE.Vector3(x, z, -y);
const dims3 = ([x, y, z]) => [x, z, y];

// Colours are Blender's linear base colours, same as the GLB's baseColorFactor.
function material(name, r, gg, b, roughness = 0.6, metalness = 0) {
  const m = new THREE.MeshStandardMaterial({ roughness, metalness });
  m.color.setRGB(r, gg, b);
  m.name = name;
  return m;
}

export function buildProceduralMaster(dimsMM = NOMINAL_DIMS) {
  const d = clampDims(dimsMM);
  const WIDTH = d.width * MM;
  const DEPTH = d.depth * MM;
  const HEIGHT = d.height * MM;

  const mats = {
    paper: material('MAT_PAPER_OUTER', 0.9, 0.84, 0.73, 0.88),
    edge: material('MAT_PAPER_EDGE', 0.44, 0.34, 0.23, 0.97),
    pulp: material('MAT_INSERT_PULP', 0.55, 0.5, 0.42, 0.94),
    jar: material('MAT_JAR', 0.82, 0.86, 0.82, 0.24),
    cream: material('MAT_CREAM', 0.96, 0.94, 0.88, 0.55),
    cap: material('MAT_CAP', 0.12, 0.115, 0.105, 0.28),
    seal: material('MAT_SEAL', 0.72, 0.73, 0.7, 0.26, 0.75),
    leaflet: material('MAT_LEAFLET', 0.96, 0.95, 0.91, 0.82),
  };

  const empty = (name, parent, loc = [0, 0, 0], extras = {}) => {
    const o = new THREE.Group();
    o.name = name;
    o.position.copy(g(loc));
    Object.assign(o.userData, extras);
    parent?.add(o);
    return o;
  };
  const box = (name, parent, size, loc, mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dims3(size)), mat);
    mesh.name = name;
    mesh.position.copy(g(loc));
    parent.add(mesh);
    return mesh;
  };
  const cyl = (name, parent, radius, depth, loc, mat) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 48), mat);
    mesh.name = name;
    mesh.position.copy(g(loc));
    parent.add(mesh);
    return mesh;
  };
  const hinge = (name, parent, loc, axis, flat) => empty(name, parent, loc, {
    packshift_role: 'fold_hinge', fold_axis: axis, closed_deg: 0, flat_deg: flat,
  });

  const root = empty('PACKSHIFT_ROOT', null, [0, 0, 0], {
    packshift_asset_version: '0.6.0-procedural',
    width_mm: d.width, depth_mm: d.depth, height_mm: d.height,
  });

  box('FRONT', root, [WIDTH, T, HEIGHT], [0, DEPTH / 2, 0], mats.paper);
  const hr = hinge('HINGE_RIGHT', root, [WIDTH / 2, DEPTH / 2, 0], 'Z', 90);
  box('RIGHT_DATA', hr, [T, DEPTH, HEIGHT], [0, -DEPTH / 2, 0], mats.paper);
  const hb = hinge('HINGE_BACK', hr, [0, -DEPTH, 0], 'Z', 90);
  box('BACK', hb, [WIDTH, T, HEIGHT], [-WIDTH / 2, 0, 0], mats.paper);
  const hl = hinge('HINGE_LEFT', root, [-WIDTH / 2, DEPTH / 2, 0], 'Z', -90);
  box('LEFT_COPY', hl, [T, DEPTH, HEIGHT], [0, -DEPTH / 2, 0], mats.paper);
  const hg = hinge('HINGE_GLUE', hb, [-WIDTH, 0, 0], 'Z', 90);
  box('GLUE_FLAP', hg, [T, GLUE, HEIGHT - 4 * T], [1.5 * T, GLUE / 2 + T, 0], mats.edge);
  const ht = hinge('HINGE_TOP', root, [0, DEPTH / 2, HEIGHT / 2], 'X', -90);
  box('TOP', ht, [WIDTH, DEPTH, T], [0, -DEPTH / 2, 0], mats.paper);
  const htt = hinge('HINGE_TOP_TUCK', ht, [0, -DEPTH, 0], 'X', -90);
  box('TOP_TUCK', htt, [WIDTH - 6 * T, T, TUCK], [0, 1.5 * T, -TUCK / 2 - 2 * T], mats.paper);
  const hbo = hinge('HINGE_BOTTOM', root, [0, DEPTH / 2, -HEIGHT / 2], 'X', 90);
  box('BOTTOM', hbo, [WIDTH, DEPTH, T], [0, -DEPTH / 2, 0], mats.paper);

  const dust = [DUST, DEPTH - 2 * T, T];
  const dz = 1.5 * T;
  box('TOP_DUST_LEFT', hinge('HINGE_TOP_DUST_LEFT', hl, [0, -DEPTH / 2, HEIGHT / 2], 'Y', -90), dust, [DUST / 2 + T, 0, -dz], mats.paper);
  box('TOP_DUST_RIGHT', hinge('HINGE_TOP_DUST_RIGHT', hr, [0, -DEPTH / 2, HEIGHT / 2], 'Y', 90), dust, [-DUST / 2 - T, 0, -dz], mats.paper);
  box('BOTTOM_DUST_LEFT', hinge('HINGE_BOTTOM_DUST_LEFT', hl, [0, -DEPTH / 2, -HEIGHT / 2], 'Y', 90), dust, [DUST / 2 + T, 0, dz], mats.paper);
  box('BOTTOM_DUST_RIGHT', hinge('HINGE_BOTTOM_DUST_RIGHT', hr, [0, -DEPTH / 2, -HEIGHT / 2], 'Y', -90), dust, [-DUST / 2 - T, 0, dz], mats.paper);

  // Internals keep their real size; they sit on the carton floor.
  const floor = -HEIGHT / 2;
  const nominalFloor = -0.065;
  const lift = floor - nominalFloor;
  const inner = empty('INNER_ASSEMBLY', root);
  box('INSERT_TRAY', inner, [Math.min(WIDTH * 0.78, 43.7 * MM), Math.min(DEPTH * 0.72, 25.9 * MM), 16 * MM], [0, 0, -0.0377 + lift], mats.pulp);
  const jar = cyl('INNER_JAR', inner, 15.5 * MM, 44 * MM, [0, 0, -0.0091 + lift], mats.jar);
  cyl('CREAM_CORE', jar, 14.2 * MM, 38 * MM, [0, 0, 0], mats.cream);
  cyl('JAR_CAP', inner, 16 * MM, 12 * MM, [0, 0, 19.6 * MM + lift], mats.cap);
  cyl('SEAL_DISC', inner, 14.8 * MM, 0.55 * MM, [0, 0, 13.3 * MM + lift], mats.seal);
  box('LEAFLET', inner, [0.7 * MM, Math.min(30 * MM, DEPTH - 6 * MM), 58 * MM], [-WIDTH / 2 + 1.4 * MM, 0, 0.0156 + lift], mats.leaflet);

  const anchors = {
    ANCHOR_CLAIM_FRONT: [0, DEPTH / 2 + T, -HEIGHT * 0.16],
    ANCHOR_COPY_LEFT: [-WIDTH / 2, 0, HEIGHT * 0.1],
    ANCHOR_DATA_RIGHT: [WIDTH / 2, 0, HEIGHT * 0.08],
    ANCHOR_BACK_REFLOW: [0, -DEPTH / 2, HEIGHT * 0.1],
    ANCHOR_SURFACE_FRONT: [0, DEPTH / 2 + 2 * T, 0],
    ANCHOR_SURFACE_LEFT: [-WIDTH / 2 - T, 0, 0],
    ANCHOR_SURFACE_RIGHT: [WIDTH / 2 + T, 0, 0],
    ANCHOR_SURFACE_BACK: [0, -DEPTH / 2 - T, 0],
    ANCHOR_EXPLODE_JAR: [WIDTH * 1.35, DEPTH * 1.15, -HEIGHT * 0.05],
    ANCHOR_EXPLODE_CAP: [WIDTH * 1.35, DEPTH * 1.15, HEIGHT * 0.36],
    ANCHOR_EXPLODE_SEAL: [WIDTH * 1.35, DEPTH * 1.15, HEIGHT * 0.22],
    ANCHOR_EXPLODE_INSERT: [WIDTH * 1.35, DEPTH * 1.15, -HEIGHT * 0.36],
    ANCHOR_EXPLODE_LEAFLET: [-WIDTH * 1.3, DEPTH * 1.0, HEIGHT * 0.06],
  };
  Object.entries(anchors).forEach(([name, loc]) => empty(name, root, loc, { packshift_role: 'runtime_anchor' }));

  const scene = new THREE.Group();
  scene.add(root);
  return scene;
}
