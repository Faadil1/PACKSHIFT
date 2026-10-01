import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Html, Lightformer, OrbitControls, useGLTF } from '@react-three/drei';
import gsap from 'gsap';
import * as THREE from 'three';
import { NOMINAL_DIMS, REQUIREMENTS, SURFACES, SURFACE_LABEL, clampDims, isNominal } from '../model/pressure.js';
import { buildProceduralMaster } from './proceduralMaster.js';

// Default (French) scene labels; the app passes its own for the active language.
const DEFAULT_LABELS = {
  face: { FRONT: 'Avant', LEFT_COPY: 'Gauche', RIGHT_DATA: 'Droite', BACK: 'Dos' },
  load: (pct) => `${pct}% de charge`,
  over: 'trop plein !',
  fits: 'ça tient',
};
import {
  createBlockTexture, createPanelSet, paintPanelSet, panelMM, paperFibreNormal,
} from './panelArt.js';
import { play } from '../audio/sound.js';

export const MODEL_URL = '/models/packshift-master.glb';
const CLOSED_SCALE = 31.5;
const FLAT_SCALE = 23.5;

const OUTER = [
  'FRONT', 'RIGHT_DATA', 'BACK', 'LEFT_COPY', 'GLUE_FLAP', 'TOP', 'TOP_TUCK', 'BOTTOM',
  'TOP_DUST_LEFT', 'TOP_DUST_RIGHT', 'BOTTOM_DUST_LEFT', 'BOTTOM_DUST_RIGHT',
];

// Decomposition choreography (d in 0..1). Physically honest order: the tuck
// flap lifts out, the lid opens, the product is lifted *out through the
// opening*, then the carton unfolds panel by panel into its dieline.
const HINGE_WINDOWS = {
  HINGE_TOP_TUCK: [0.0, 0.08],
  HINGE_TOP: [0.04, 0.17],
  HINGE_TOP_DUST_LEFT: [0.1, 0.2],
  HINGE_TOP_DUST_RIGHT: [0.12, 0.22],
  HINGE_BOTTOM: [0.6, 0.84],
  HINGE_BOTTOM_DUST_LEFT: [0.56, 0.74],
  HINGE_BOTTOM_DUST_RIGHT: [0.58, 0.76],
  HINGE_RIGHT: [0.5, 0.8],
  HINGE_LEFT: [0.52, 0.82],
  HINGE_BACK: [0.6, 0.9],
  HINGE_GLUE: [0.74, 0.96],
};

const COMPONENTS = {
  JAR_CAP: { anchor: 'ANCHOR_EXPLODE_CAP', window: [0.14, 0.36], spin: 1.6, row: [0, 0.062] },
  SEAL_DISC: { anchor: 'ANCHOR_EXPLODE_SEAL', window: [0.18, 0.4], spin: 0, row: [0, 0.044] },
  INNER_JAR: { anchor: 'ANCHOR_EXPLODE_JAR', window: [0.22, 0.46], spin: 0.5, row: [0, 0.004] },
  LEAFLET: { anchor: 'ANCHOR_EXPLODE_LEAFLET', window: [0.26, 0.48], spin: 0, row: [-0.042, 0.012] },
  INSERT_TRAY: { anchor: 'ANCHOR_EXPLODE_INSERT', window: [0.3, 0.52], spin: 0, row: [0, -0.052] },
};

const ART_FACE = {
  FRONT: { position: [0, 0, -0.00035], rotation: [0, Math.PI, 0] },
  BACK: { position: [0, 0, 0.00035], rotation: [0, 0, 0] },
  LEFT_COPY: { position: [-0.00035, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  RIGHT_DATA: { position: [0.00035, 0, 0], rotation: [0, Math.PI / 2, 0] },
  TOP: { position: [0, 0.00035, 0], rotation: [-Math.PI / 2, 0, Math.PI] },
};

// Camera framing: half-extents (world units, nominal carton) of what each view
// must show. Distance is fitted to the live aspect ratio and carton size.
const CAMERA_VIEWS = {
  PACK: { dir: [0.52, 0.3, 0.8], target: [0, 0, 0], half: [1.55, 2.25] },
  EXPLODED: { dir: [0.42, 0.3, 0.86], target: [-0.35, 0.6, 0], half: [3.3, 3.3] },
  DIELINE: { dir: [0.02, 0.06, 1], target: [0.3, 0, 0], half: [4.1, 2.6] },
  XRAY: { dir: [0.55, 0.28, 0.78], target: [0, 0, 0], half: [1.6, 2.25] },
  PRESSURE: { dir: [0.45, 0.22, 0.86], target: [0, -0.1, 0], half: [2.3, 2.3] },
  // Public game: the whole closed carton plus its open lid, with air around it.
  GAME: { dir: [0.55, 0.44, 0.72], target: [0, 0.62, 0], half: [2.1, 3.2] },
  // Win screen: the closed carton on a museum pedestal.
  MUSEUM: { dir: [0.5, 0.22, 0.84], target: [0, -1.25, 0], half: [2.6, 4.2] },
  // Level "la marque veut plus petit": a hydraulic press. `fixed` = the
  // framing ignores the carton size, so shrinking the box is visible.
  PRESS: { dir: [0.5, 0.2, 0.84], target: [0, 1.5, 0], half: [3.4, 4.9], fixed: true },
};


function smoothstep(edge0, edge1, value) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function mapNodes(scene) {
  const out = {};
  scene.traverse((object) => {
    if (object.name) out[object.name] = object;
  });
  return out;
}

function materialList(node) {
  if (!node?.material) return [];
  return Array.isArray(node.material) ? node.material : [node.material];
}

function surfaceFromHit(object) {
  let cursor = object;
  while (cursor) {
    if (SURFACES.includes(cursor.name)) return cursor.name;
    cursor = cursor.parent;
  }
  return null;
}

// Premium material pass over the Blender (or procedural) materials: the
// geometry and material identities come from the master; the runtime adds
// optical depth the glTF PBR export can't carry (transmission, clearcoat,
// paper fibre).
function upgradeMaterial(material) {
  const name = material.name || '';
  const base = { color: material.color.clone(), name };
  if (name === 'MAT_JAR') {
    return new THREE.MeshPhysicalMaterial({
      ...base, roughness: 0.08, metalness: 0, transmission: 0.82, thickness: 0.004, ior: 1.5,
      clearcoat: 1, clearcoatRoughness: 0.05, attenuationColor: new THREE.Color('#eef3ec'), attenuationDistance: 0.05,
    });
  }
  if (name === 'MAT_CAP') {
    return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12 });
  }
  if (name === 'MAT_SEAL') {
    return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.2, metalness: 1 });
  }
  if (name === 'MAT_CREAM') {
    return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.42, sheen: 0.6, sheenColor: new THREE.Color('#fffaf0') });
  }
  if (name === 'MAT_PAPER_OUTER' || name === 'MAT_PAPER_EDGE' || name === 'MAT_LEAFLET' || name === 'MAT_INSERT_PULP') {
    const m = new THREE.MeshStandardMaterial({ ...base, roughness: name === 'MAT_INSERT_PULP' ? 0.97 : 0.86, metalness: 0 });
    m.normalMap = paperFibreNormal();
    m.normalScale = new THREE.Vector2(name === 'MAT_INSERT_PULP' ? 0.9 : 0.35, name === 'MAT_INSERT_PULP' ? 0.9 : 0.35);
    return m;
  }
  return material.clone();
}

function cloneRuntimeScene(source) {
  const cloned = source.clone(true);
  cloned.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.material = Array.isArray(object.material)
      ? object.material.map(upgradeMaterial)
      : upgradeMaterial(object.material);
  });
  return cloned;
}

/* ------------------------------------------------------------------ */
/* Printed artwork on the real panels                                  */
/* ------------------------------------------------------------------ */

function PanelArtwork({ node, surface, artState, dims, registerMaterial }) {
  const set = useMemo(() => createPanelSet(surface, dims), [surface, dims]);
  const material = useRef();
  const [w, h] = panelMM(surface, dims);

  useEffect(() => { paintPanelSet(set, artState); }, [set, artState]);
  useEffect(() => () => set.dispose(), [set]);
  useEffect(() => {
    if (material.current) registerMaterial(surface, material.current);
  }, [registerMaterial, surface, set]);

  if (!node) return null;
  const face = ART_FACE[surface];
  const foil = Boolean(set.orm);

  return createPortal(
    <mesh position={face.position} rotation={face.rotation} receiveShadow>
      <planeGeometry args={[w / 1000 - 0.0006, h / 1000 - 0.0006]} />
      <meshStandardMaterial
        ref={material}
        map={set.map}
        roughnessMap={set.orm || null}
        metalnessMap={set.orm || null}
        roughness={foil ? 1 : 0.86}
        metalness={foil ? 1 : 0}
        bumpMap={set.bump || null}
        bumpScale={set.bump ? 1.4 : 1}
        normalMap={set.bump ? null : paperFibreNormal()}
        normalScale={new THREE.Vector2(0.3, 0.3)}
        transparent
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>,
    node,
  );
}

/* ------------------------------------------------------------------ */
/* Labels, flights, collision                                          */
/* ------------------------------------------------------------------ */

function SurfacePressureTag({ node, root, surface, pressure, visible, labels = DEFAULT_LABELS }) {
  const group = useRef();
  const label = useRef();
  const facing = useRef(true);
  const { camera } = useThree();
  const nodePos = useMemo(() => new THREE.Vector3(), []);
  const rootPos = useMemo(() => new THREE.Vector3(), []);
  const outward = useMemo(() => new THREE.Vector3(), []);
  const toCamera = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!group.current || !node || !root || !visible) return;
    node.getWorldPosition(nodePos);
    root.getWorldPosition(rootPos);
    outward.copy(nodePos).sub(rootPos);
    outward.y = 0;
    if (outward.lengthSq() < 0.0001) outward.set(0, 0, 1);
    outward.normalize();
    group.current.position.copy(nodePos).addScaledVector(outward, 0.9);
    group.current.position.y += 2.05;
    // Only label faces turned toward the viewer: hidden faces would stack
    // their tags on top of the visible ones. The console strip lists all four.
    toCamera.copy(camera.position).sub(nodePos).normalize();
    const nowFacing = outward.dot(toCamera) > 0.12;
    if (nowFacing !== facing.current && label.current) {
      facing.current = nowFacing;
      label.current.style.opacity = nowFacing ? '1' : '0';
    }
  });

  if (!visible) return null;
  const pct = Math.round((pressure || 0) * 100);
  return (
    <group ref={group}>
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={label} className={'surface-pressure-tag ' + (pct > 100 ? 'over' : '')}>
          <b>{labels.face[surface]}</b>
          <span>{labels.load(pct)}</span>
        </div>
      </Html>
    </group>
  );
}

// The signature moment: each moved requirement leaves its panel as a printed
// block, arcs over the open dieline and lands on its new panel.
const FLIGHT = 1.05;
const STAGGER = 0.26;

function FlyingBlock({ move, index, nodes, market, rig }) {
  const mesh = useRef();
  const trail = useRef();
  const start = useRef(null);
  const launched = useRef(false);
  const texture = useMemo(() => {
    const widthMM = move.to === 'FRONT' || move.to === 'BACK' ? 40 : 28;
    return createBlockTexture(move.kind, market, widthMM);
  }, [move.kind, move.to, market]);
  useEffect(() => () => texture.dispose(), [texture]);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()), []);
  const TRAIL = 29;
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const [wmm, hmm] = texture.userData.sizeMM;

  useFrame((state) => {
    if (!mesh.current) return;
    if (start.current === null) start.current = state.clock.elapsedTime + index * STAGGER;
    const t = THREE.MathUtils.clamp((state.clock.elapsedTime - start.current) / FLIGHT, 0, 1);
    if (t > 0 && !launched.current) {
      launched.current = true;
      play('whoosh');
    }
    const from = nodes[move.from || 'FRONT'];
    const to = nodes[move.to];
    if (!from || !to) return;
    from.getWorldPosition(a);
    to.getWorldPosition(b);
    curve.v0.copy(a);
    curve.v2.copy(b);
    curve.v1.copy(a).lerp(b, 0.5);
    curve.v1.z += 1.6;
    curve.v1.y += 1.2;
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    mesh.current.position.copy(curve.getPoint(eased));
    mesh.current.quaternion.copy(state.camera.quaternion);
    const scale = (rig.current?.scale.x || FLAT_SCALE) / 1000;
    const pop = 1 + Math.sin(t * Math.PI) * 0.35;
    mesh.current.scale.set(wmm * scale * pop, hmm * scale * pop, 1);
    mesh.current.material.opacity = t >= 1 ? 0 : Math.min(1, t * 6);
    if (trail.current) {
      const count = Math.max(2, Math.round(eased * (TRAIL - 1)) + 1);
      const attr = geometry.attributes.position;
      for (let i = 0; i < count; i += 1) {
        const p = curve.getPoint((i / (TRAIL - 1)));
        attr.setXYZ(i, p.x, p.y, p.z);
      }
      attr.needsUpdate = true;
      geometry.setDrawRange(0, count);
      geometry.computeBoundingSphere();
      trail.current.material.opacity = t >= 1 ? 0 : 0.7;
    }
  });

  return (
    <>
      <line ref={trail} geometry={geometry}>
        <lineBasicMaterial color={REQUIREMENTS[move.kind].color} transparent opacity={0} />
      </line>
      <mesh ref={mesh} renderOrder={10}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={texture} transparent opacity={0} depthTest={false} toneMapped={false} />
      </mesh>
    </>
  );
}

export const flightDuration = (count) => (count ? FLIGHT + STAGGER * (count - 1) + 0.25 : 0);

function CollisionField({ node, active, dims }) {
  const group = useRef();
  const d = clampDims(dims);
  const w = d.width / 1000;
  const h = d.height / 1000;

  useFrame((state) => {
    if (!group.current || !active) return;
    group.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 8) * 0.02);
  });

  if (!node || !active) return null;
  return createPortal(
    <group ref={group} position={[0, 0, -0.0012]}>
      {[
        [0, h / 2 + 0.001, w + 0.004, 0.0009],
        [0, -h / 2 - 0.001, w + 0.004, 0.0009],
        [-w / 2 - 0.0022, 0, 0.0009, h + 0.003],
        [w / 2 + 0.0022, 0, 0.0009, h + 0.003],
      ].map(([x, y, bw, bh], index) => (
        <mesh key={index} position={[x, y, 0]}>
          <boxGeometry args={[bw, bh, 0.0004]} />
          <meshBasicMaterial color="#ff2e9a" transparent opacity={0.95} toneMapped={false} />
        </mesh>
      ))}
    </group>,
    node,
  );
}

/* ------------------------------------------------------------------ */
/* Picker: lets the DOM (brief tickets) raycast into the Blender panels  */
/* ------------------------------------------------------------------ */

function SurfacePicker({ nodes, onReady }) {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  useEffect(() => {
    if (!onReady) return undefined;
    const pick = (clientX, clientY) => {
      const rect = gl.domElement.getBoundingClientRect();
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const candidates = SURFACES.map((surface) => nodes[surface]).filter(Boolean);
      for (const hit of raycaster.intersectObjects(candidates, true)) {
        const surface = surfaceFromHit(hit.object);
        if (surface) return surface;
      }
      return null;
    };
    onReady(pick);
    return () => onReady(null);
  }, [camera, gl, nodes, onReady, raycaster, ndc]);
  return null;
}

// Predictive load shown on the face under the dragged ticket, before release.
function PreviewTag({ node, root, surface, from, to, labels = DEFAULT_LABELS }) {
  const group = useRef();
  const nodePos = useMemo(() => new THREE.Vector3(), []);
  const rootPos = useMemo(() => new THREE.Vector3(), []);
  const outward = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!group.current || !node || !root) return;
    node.getWorldPosition(nodePos);
    root.getWorldPosition(rootPos);
    outward.copy(nodePos).sub(rootPos);
    outward.y = 0;
    if (outward.lengthSq() < 0.0001) outward.set(0, 0, 1);
    outward.normalize();
    group.current.position.copy(nodePos).addScaledVector(outward, 0.35);
    group.current.position.y += 0.4;
  });
  if (!node) return null;
  const over = to > 1;
  return (
    <group ref={group}>
      <Html center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
        <div className={'preview-tag' + (over ? ' over' : '')}>
          <b>{labels.face[surface]}</b>
          <span>{Math.round(from * 100)}<i>→</i><strong>{Math.round(to * 100)}%</strong></span>
          <em>{over ? labels.over : labels.fits}</em>
        </div>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Journey marks: the museum shows the same box the player struggled with. */
/* These are experiential marks, not manufacturing damage simulation.       */
/* ------------------------------------------------------------------ */

function HistoryMarks({ node, dims, story }) {
  if (!node || !story) return null;
  const d = clampDims(dims);
  const w = d.width / 1000;
  const h = d.height / 1000;
  const hasMarks = story.cracks > 0 || story.pops > 0 || story.overloads > 0 || story.law;
  if (!hasMarks) return null;

  return createPortal(
    <group position={[0, 0, -0.00135]} rotation={[0, Math.PI, 0]} renderOrder={8}>
      {story.cracks > 0 && (
        <>
          <mesh position={[0, -h * 0.12, 0]} rotation={[0, 0, -0.22]} renderOrder={8}>
            <planeGeometry args={[w * 0.82, Math.max(0.0045, h * 0.052)]} />
            <meshStandardMaterial
              color="#d7c48d"
              roughness={0.96}
              transparent
              opacity={0.9}
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-8}
            />
          </mesh>
          <mesh position={[w * 0.08, -h * 0.08, -0.00005]} rotation={[0, 0, 0.68]} renderOrder={9}>
            <planeGeometry args={[0.0011, h * 0.24]} />
            <meshBasicMaterial color="#5a4a34" transparent opacity={0.55} depthWrite={false} toneMapped={false} />
          </mesh>
        </>
      )}
      {story.overloads > 0 && (
        <mesh position={[w * 0.36, h * 0.37, -0.00008]} renderOrder={9}>
          <circleGeometry args={[Math.max(0.0026, w * 0.055), 32]} />
          <meshBasicMaterial color="#c9303f" transparent opacity={0.92} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {story.law && (
        <mesh position={[-w * 0.25, h * 0.34, -0.0001]} rotation={[0, 0, -0.12]} renderOrder={9}>
          <planeGeometry args={[w * 0.34, Math.max(0.0022, h * 0.018)]} />
          <meshBasicMaterial color="#c9303f" transparent opacity={0.72} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {story.pops > 0 && story.cracks === 0 && (
        <mesh position={[-w * 0.34, -h * 0.35, -0.00008]} rotation={[0, 0, 0.15]} renderOrder={9}>
          <planeGeometry args={[w * 0.18, Math.max(0.003, h * 0.026)]} />
          <meshBasicMaterial color="#efe2b8" transparent opacity={0.82} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>,
    node,
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function SpatialStudioScene({
  source, dims = NOMINAL_DIMS, market, viewMode, decomposition, placements, brief, pressures, collisionSurfaces,
  compiled, compilePhase, reflowMoves, interactionLocked, onPlaceConstraint, selectedKind,
  hoverSurface = null, preview = null, onPickerReady, brand = null, labels = DEFAULT_LABELS,
  pedestal = false, press = false, story = null,
}) {
  const scene = source;
  const { camera, size } = useThree();
  const controls = useRef();
  const rig = useRef();
  const [tapHover, setHoveredSurface] = useState(null);
  const hoveredSurface = hoverSurface || tapHover;
  const reduced = useMemo(prefersReducedMotion, []);
  const d = clampDims(dims);
  const sizeFactor = Math.max(d.height / NOMINAL_DIMS.height, (d.width + d.depth) / (NOMINAL_DIMS.width + NOMINAL_DIMS.depth));

  const runtime = useMemo(() => {
    const cloned = cloneRuntimeScene(scene);
    const nodes = mapNodes(cloned);
    const base = {};
    Object.entries(nodes).forEach(([name, object]) => {
      base[name] = { position: object.position.clone(), rotation: object.rotation.clone(), scale: object.scale.clone() };
      materialList(object).forEach((material) => {
        material.userData.packshiftBaseColor = material.color?.clone?.() || null;
        material.userData.packshiftBaseOpacity = material.opacity ?? 1;
      });
    });
    const W = d.width / 1000;
    const D = d.depth / 1000;
    const liftY = d.height / 2000 + 0.04;
    const rowX = -(W / 2 + D + 0.036);
    const explode = {};
    cloned.updateMatrixWorld(true);
    Object.entries(COMPONENTS).forEach(([name, spec]) => {
      const component = nodes[name];
      const anchor = nodes[spec.anchor];
      if (!component || !anchor) return;
      const world = anchor.getWorldPosition(new THREE.Vector3());
      const local = component.parent.worldToLocal(world);
      const start = base[name].position.clone();
      explode[name] = {
        start,
        lift: new THREE.Vector3(start.x, liftY, start.z),
        anchor: local,
        row: new THREE.Vector3(rowX + spec.row[0], spec.row[1], -0.045),
        current: new THREE.Vector3(),
      };
    });
    const hingeState = {};
    return { scene: cloned, nodes, base, explode, hingeState };
  }, [scene, d.width, d.depth, d.height]);

  const { nodes, base, explode, hingeState } = runtime;
  const outerNodes = useMemo(() => OUTER.map((n) => nodes[n]).filter(Boolean), [nodes]);
  const hinges = useMemo(() => Object.keys(HINGE_WINDOWS).map((n) => nodes[n]).filter(Boolean), [nodes]);

  const artMaterials = useRef({});
  const registerMaterial = useMemo(() => (surface, material) => { artMaterials.current[surface] = material; }, []);

  const artState = useMemo(() => {
    const kindsOn = Object.fromEntries(SURFACES.map((s) => [s, []]));
    Object.entries(placements).forEach(([kind, surface]) => { if (surface) kindsOn[surface].push(kind); });
    return { market, kindsOn, overloaded: collisionSurfaces, compiled, brand };
  }, [market, placements, collisionSurfaces, compiled, brand]);

  const scratch = useMemo(() => ({
    color: new THREE.Color(),
    red: new THREE.Color('#ff2e9a'),
    amber: new THREE.Color('#00c2ff'),
    hover: new THREE.Color('#ffe14a'),
    calm: new THREE.Color('#e4dccb'),
    white: new THREE.Color('#ffffff'),
    scale: new THREE.Vector3(),
    bez: new THREE.Vector3(),
  }), []);

  // Manual scrubbing (CUSTOM) re-frames by stage so the object never leaves
  // the viewport; named views use their own framing.
  const stageView = decomposition < 0.2 ? 'PACK' : decomposition < 0.62 ? 'EXPLODED' : 'DIELINE';
  const cameraView = CAMERA_VIEWS[viewMode] && !(viewMode === 'PRESSURE' && decomposition > 0.2) ? viewMode : stageView;

  const fit = useMemo(() => (viewName) => {
    const view = CAMERA_VIEWS[viewName];
    const aspect = size.width / Math.max(1, size.height);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const sf = view.fixed ? 1 : sizeFactor;
    const distance = Math.max(view.half[1] / tanHalf, view.half[0] / (tanHalf * aspect)) * 1.08 * sf;
    const dir = new THREE.Vector3(...view.dir).normalize();
    const target = new THREE.Vector3(...view.target).multiplyScalar(sf);
    return { distance, dir, target, position: target.clone().addScaledVector(dir, distance) };
  }, [size.width, size.height, camera.fov, sizeFactor]);

  // Camera: fitted framing, plus scripted moves for the COMPILE sequence.
  useEffect(() => {
    if (!controls.current) return undefined;
    const tweens = [];
    const tweenTo = (position, target, duration, ease = 'power3.inOut') => {
      tweens.push(gsap.to(camera.position, { x: position.x, y: position.y, z: position.z, duration, ease, onUpdate: () => controls.current?.update() }));
      tweens.push(gsap.to(controls.current.target, { x: target.x, y: target.y, z: target.z, duration, ease, onUpdate: () => controls.current?.update() }));
    };
    if (reduced) {
      const f = fit(cameraView);
      camera.position.copy(f.position);
      controls.current.target.copy(f.target);
      controls.current.update();
      return undefined;
    }
    if (compilePhase === 'opening') {
      // low, close three-quarter push-in while the lid opens
      const f = fit('EXPLODED');
      const low = f.target.clone().addScaledVector(new THREE.Vector3(0.62, 0.12, 0.78).normalize(), f.distance * 0.92);
      tweenTo(low, f.target, 1.2, 'power2.inOut');
    } else if (compilePhase === 'reflow') {
      // slow dolly-in over the open dieline while blocks travel
      const f = fit('DIELINE');
      tweenTo(f.target.clone().addScaledVector(f.dir, f.distance * 0.9), f.target, 1.6, 'sine.inOut');
    } else if (compilePhase === 'closing') {
      // sweeping orbit while the carton refolds, landing on the hero angle
      const f = fit('PACK');
      const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.current.target));
      const to = new THREE.Spherical().setFromVector3(f.position.clone().sub(f.target));
      let endTheta = to.theta;
      while (endTheta < from.theta + Math.PI * 0.9) endTheta += Math.PI * 2;
      const state = { theta: from.theta, phi: from.phi, radius: from.radius };
      const targetTween = { x: controls.current.target.x, y: controls.current.target.y, z: controls.current.target.z };
      const offset = new THREE.Vector3();
      tweens.push(gsap.to(targetTween, { x: f.target.x, y: f.target.y, z: f.target.z, duration: 1.6, ease: 'power2.inOut' }));
      tweens.push(gsap.to(state, {
        theta: endTheta,
        phi: to.phi,
        radius: to.radius,
        duration: 1.6,
        ease: 'power2.inOut',
        onUpdate: () => {
          if (!controls.current) return;
          controls.current.target.set(targetTween.x, targetTween.y, targetTween.z);
          offset.setFromSphericalCoords(state.radius, state.phi, state.theta);
          camera.position.copy(controls.current.target).add(offset);
          controls.current.update();
        },
      }));
    } else {
      const f = fit(cameraView);
      tweenTo(f.position, f.target, 0.9);
    }
    return () => tweens.forEach((t) => t.kill());
  }, [camera, cameraView, compilePhase, fit, reduced]);

  useFrame((state, delta) => {
    if (!rig.current) return;
    const dcomp = decomposition;
    const k = reduced ? 30 : 9;

    hinges.forEach((hinge) => {
      const [a, b] = HINGE_WINDOWS[hinge.name];
      const t = smoothstep(a, b, dcomp);
      // crease sound when a panel passes the middle of its fold, either way
      const side = t > 0.5;
      if (hingeState[hinge.name] !== undefined && hingeState[hinge.name] !== side) {
        play('crease', { intensity: hinge.name.includes('DUST') || hinge.name.includes('TUCK') ? 0.6 : 1 });
      }
      hingeState[hinge.name] = side;
      const target = THREE.MathUtils.degToRad(Number(hinge.userData.flat_deg || 0)) * t;
      const baseRot = base[hinge.name].rotation;
      const axis = hinge.userData.fold_axis;
      // Blender Z-up -> glTF Y-up: Blender Z = glTF Y, Blender Y = glTF -Z.
      if (axis === 'Z') hinge.rotation.y = THREE.MathUtils.damp(hinge.rotation.y, baseRot.y + target, k, delta);
      else if (axis === 'X') hinge.rotation.x = THREE.MathUtils.damp(hinge.rotation.x, baseRot.x + target, k, delta);
      else if (axis === 'Y') hinge.rotation.z = THREE.MathUtils.damp(hinge.rotation.z, baseRot.z - target, k, delta);
    });

    const toRow = smoothstep(0.7, 0.95, dcomp);
    Object.entries(COMPONENTS).forEach(([name, spec]) => {
      const component = nodes[name];
      const path = explode[name];
      if (!component || !path) return;
      const t = smoothstep(spec.window[0], spec.window[1], dcomp);
      const rise = smoothstep(0, 0.45, t);
      const travel = smoothstep(0.35, 1, t);
      scratch.bez.copy(path.start).lerp(path.lift, rise);
      path.current.copy(scratch.bez).lerp(path.anchor, travel);
      path.current.lerp(path.row, toRow);
      component.position.x = THREE.MathUtils.damp(component.position.x, path.current.x, k, delta);
      component.position.y = THREE.MathUtils.damp(component.position.y, path.current.y, k, delta);
      component.position.z = THREE.MathUtils.damp(component.position.z, path.current.z, k, delta);
      const baseRot = base[name].rotation;
      if (spec.spin) component.rotation.y = THREE.MathUtils.damp(component.rotation.y, baseRot.y + travel * spec.spin, k, delta);
      if (name === 'LEAFLET') component.rotation.y = THREE.MathUtils.damp(component.rotation.y, baseRot.y + travel * 0.9 * (1 - toRow) + toRow * (Math.PI / 2), k, delta);
    });

    const shell = smoothstep(0.46, 1, dcomp);
    const targetScale = THREE.MathUtils.lerp(CLOSED_SCALE, FLAT_SCALE, shell);
    const alpha = 1 - Math.exp(-(reduced ? 30 : 6) * delta);
    rig.current.scale.lerp(scratch.scale.setScalar(targetScale), alpha);
    rig.current.rotation.x = THREE.MathUtils.damp(rig.current.rotation.x, 0.035 * (1 - shell), 6, delta);
    rig.current.rotation.y = THREE.MathUtils.damp(rig.current.rotation.y, THREE.MathUtils.lerp(Math.PI - 0.28, Math.PI, shell), 6, delta);
    rig.current.position.y = THREE.MathUtils.damp(rig.current.position.y, -0.35 * smoothstep(0.1, 0.4, dcomp) * (1 - shell), 6, delta);

    const xray = viewMode === 'XRAY';
    const pressureView = viewMode === 'PRESSURE';
    const tint = (surfaceName, baseColor, out) => {
      const ratio = pressures[surfaceName] || 0;
      const highlighted = hoveredSurface === surfaceName;
      out.copy(baseColor);
      if (pressureView || ratio > 1 || highlighted) {
        const heat = ratio > 1 ? scratch.red : highlighted ? scratch.hover : scratch.amber;
        const amount = highlighted ? 0.45 : pressureView ? THREE.MathUtils.clamp(ratio * 0.55, 0.05, 0.62) : 0.35;
        out.lerp(heat, amount);
      }
      if (compiled) out.lerp(scratch.calm, 0.06);
      return out;
    };

    outerNodes.forEach((node) => {
      materialList(node).forEach((material) => {
        const baseColor = material.userData.packshiftBaseColor;
        if (baseColor && material.color) material.color.lerp(tint(node.name, baseColor, scratch.color), alpha);
        const targetOpacity = xray ? 0.14 : material.userData.packshiftBaseOpacity ?? 1;
        material.opacity = THREE.MathUtils.damp(material.opacity ?? 1, targetOpacity, 7, delta);
        const transparent = xray || material.opacity < 0.999;
        if (material.transparent !== transparent) {
          // three bakes OPAQUE into the shader program: recompile on change
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        material.depthWrite = !xray;
      });
    });

    Object.entries(artMaterials.current).forEach(([surfaceName, material]) => {
      material.color.lerp(tint(surfaceName, scratch.white, scratch.color), alpha);
      material.opacity = THREE.MathUtils.damp(material.opacity, xray ? 0.12 : 1, 7, delta);
      material.depthWrite = !xray;
    });

    if (collisionSurfaces.includes('FRONT') && nodes.FRONT && !reduced) {
      const pulse = 1 - Math.max(0, Math.sin(state.clock.elapsedTime * 7)) * 0.012;
      nodes.FRONT.scale.x = THREE.MathUtils.damp(nodes.FRONT.scale.x, pulse, 10, delta);
    } else if (nodes.FRONT) {
      nodes.FRONT.scale.x = THREE.MathUtils.damp(nodes.FRONT.scale.x, base.FRONT.scale.x, 10, delta);
    }
  });

  const pressureVisible = viewMode === 'PRESSURE' && decomposition < 0.3;

  const surfaceHandlers = {
    onPointerMove: (event) => {
      if (!selectedKind || interactionLocked) return;
      const surface = surfaceFromHit(event.object);
      if (surface !== hoveredSurface) setHoveredSurface(surface);
    },
    onPointerOut: () => selectedKind && setHoveredSurface(null),
    onClick: (event) => {
      if (!selectedKind || interactionLocked || event.delta > 6) return;
      const surface = surfaceFromHit(event.object);
      if (!surface) return;
      event.stopPropagation();
      onPlaceConstraint(selectedKind, surface);
      setHoveredSurface(null);
    },
  };

  return (
    <>
      <fog attach="fog" args={['#0d0d0f', 16 * sizeFactor, 34 * sizeFactor]} />

      {/* Procedural studio environment: soft boxes only, nothing downloaded. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#fff6e8" position={[0, 5, 2]} scale={[8, 3, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[-5, 1.5, 3]} scale={[3, 5, 1]} rotation-y={Math.PI / 2.6} />
        <Lightformer form="rect" intensity={0.9} color="#dfe6ff" position={[5, 1, -2]} scale={[3, 5, 1]} rotation-y={-Math.PI / 2.4} />
        <Lightformer form="ring" intensity={1.6} color="#fff0d8" position={[2, 2.5, 5]} scale={1.6} />
      </Environment>

      <hemisphereLight args={['#fffaf0', '#c9bda8', 0.75]} />
      <directionalLight
        castShadow
        position={[5, 8, 5.5]}
        intensity={2.1}
        color="#fff4e3"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[3, 2, 9]} intensity={0.6} color="#fffaf2" />
      {collisionSurfaces.length > 0 && <pointLight position={[0, -0.2, 2.8]} intensity={1.6} color="#ff2e9a" />}

      <group ref={rig} scale={CLOSED_SCALE} rotation={[0.035, Math.PI - 0.28, 0]}>
        <primitive object={runtime.scene} dispose={null} {...surfaceHandlers} />
        {['FRONT', 'LEFT_COPY', 'RIGHT_DATA', 'BACK', 'TOP'].map((surface) => (
          <PanelArtwork
            key={surface}
            node={nodes[surface]}
            surface={surface}
            artState={artState}
            dims={d}
            registerMaterial={registerMaterial}
          />
        ))}
        <CollisionField node={nodes.FRONT} active={collisionSurfaces.includes('FRONT')} dims={d} />
        {pedestal && <HistoryMarks node={nodes.FRONT} dims={d} story={story} />}
      </group>

      {SURFACES.map((surface) => (
        <SurfacePressureTag
          key={surface}
          node={nodes[surface]}
          root={nodes.PACKSHIFT_ROOT}
          surface={surface}
          pressure={pressures[surface] || 0}
          visible={pressureVisible}
          labels={labels}
        />
      ))}

      {compilePhase === 'reflow' && reflowMoves.map((move, index) => (
        <FlyingBlock key={move.kind} move={move} index={index} nodes={nodes} market={market} rig={rig} />
      ))}

      <SurfacePicker nodes={nodes} onReady={onPickerReady} />
      {preview && (
        <PreviewTag
          node={nodes[preview.surface]}
          root={nodes.PACKSHIFT_ROOT}
          surface={preview.surface}
          from={preview.from}
          to={preview.to}
          labels={labels}
        />
      )}

      <OrbitControls
        ref={controls}
        makeDefault
        enabled={!interactionLocked}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={3.6}
        maxDistance={30}
        minPolarAngle={0.3}
        maxPolarAngle={2.45}
      />

      {pedestal && <Pedestal k={d.height / NOMINAL_DIMS.height} />}
      {press && <Press k={d.height / NOMINAL_DIMS.height} />}
      <ContactShadows position={[0, (pedestal || press ? -2.065 : -2.35) * (d.height / NOMINAL_DIMS.height), 0]} opacity={0.55} scale={pedestal || press ? 5 : 14} blur={2.6} far={7} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Game props: a museum pedestal and a hydraulic press                  */
/* ------------------------------------------------------------------ */

// k = carton height / nominal. The closed carton spans about ±2.05·k in y.
function Pedestal({ k }) {
  const top = -2.07 * k;
  const lift = useRef();
  // rises into place under the closed carton
  useFrame((_, delta) => {
    if (lift.current) lift.current.position.y = THREE.MathUtils.damp(lift.current.position.y, 0, 4, delta);
  });
  return (
    <group ref={lift} position={[0, -5, 0]}>
      <mesh position={[0, top - 0.09, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.5, 0.18, 3.5]} />
        <meshStandardMaterial color="#f6f2ea" roughness={0.35} />
      </mesh>
      <mesh position={[0, top - 1.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.1, 2.84, 3.1]} />
        <meshStandardMaterial color="#ece6da" roughness={0.55} />
      </mesh>
      <mesh position={[0, top - 3.08, 0]} receiveShadow>
        <boxGeometry args={[3.5, 0.14, 3.5]} />
        <meshStandardMaterial color="#d9d1c2" roughness={0.6} />
      </mesh>
    </group>
  );
}

function hazardTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffcc00';
  g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#141313';
  for (let x = -64; x < 576; x += 64) {
    g.beginPath();
    g.moveTo(x, 64);
    g.lineTo(x + 32, 64);
    g.lineTo(x + 96, 0);
    g.lineTo(x + 64, 0);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Press({ k }) {
  const ram = useRef();
  const rod = useRef();
  const stripes = useMemo(hazardTexture, []);
  useEffect(() => () => stripes.dispose(), [stripes]);
  const floor = -2.07 * k;
  const beamY = 6.2;
  useFrame((_, delta) => {
    if (!ram.current) return;
    // the ram rests just on the carton's top and follows it down
    const target = 2.07 * k + 0.05 + 0.4;
    ram.current.position.y = THREE.MathUtils.damp(ram.current.position.y, target, 6, delta);
    const len = Math.max(0.1, beamY - 0.3 - (ram.current.position.y + 0.4));
    rod.current.scale.y = len;
    rod.current.position.y = ram.current.position.y + 0.4 + len / 2;
  });
  const steel = <meshStandardMaterial color="#5b6168" metalness={0.6} roughness={0.35} />;
  return (
    <group>
      <mesh position={[0, floor - 0.25, 0]} receiveShadow>
        <boxGeometry args={[5.6, 0.5, 3.2]} />
        {steel}
      </mesh>
      {[-2.5, 2.5].map((x) => (
        <mesh key={x} position={[x, (floor + beamY) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, beamY - floor, 16]} />
          <meshStandardMaterial color="#8a9098" metalness={0.8} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, beamY, 0]} castShadow>
        <boxGeometry args={[5.8, 0.7, 1.4]} />
        {steel}
      </mesh>
      <mesh ref={rod} position={[0, 4, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 1, 20]} />
        <meshStandardMaterial color="#c9ced4" metalness={0.9} roughness={0.15} />
      </mesh>
      <group ref={ram} position={[0, 2.07 * k + 1.5, 0]}>
        <mesh castShadow>
          <boxGeometry args={[3.2, 0.8, 2.6]} />
          {steel}
        </mesh>
        <mesh position={[0, 0, 1.305]}>
          <planeGeometry args={[3.2, 0.34]} />
          <meshBasicMaterial map={stripes} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function GlbStudio(props) {
  const { scene } = useGLTF(MODEL_URL);
  return <SpatialStudioScene source={scene} {...props} />;
}

function ProceduralStudio({ dims, ...props }) {
  const d = clampDims(dims);
  const scene = useMemo(() => buildProceduralMaster(d), [d.width, d.depth, d.height]); // eslint-disable-line react-hooks/exhaustive-deps
  return <SpatialStudioScene source={scene} dims={d} {...props} />;
}

// The Blender GLB is authored at the nominal size only; any other size (or
// ?procedural=1, or a GLB load failure) uses the node-for-node procedural twin.
export function PackageScene({ procedural = false, dims = NOMINAL_DIMS, ...props }) {
  return procedural || !isNominal(dims)
    ? <ProceduralStudio dims={dims} {...props} />
    : <GlbStudio dims={clampDims(dims)} {...props} />;
}

useGLTF.preload(MODEL_URL);
