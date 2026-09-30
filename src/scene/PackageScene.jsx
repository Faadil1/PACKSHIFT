import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, useGLTF } from '@react-three/drei';
import gsap from 'gsap';
import * as THREE from 'three';
import { REQUIREMENTS, SURFACES, SURFACE_LABEL } from '../model/pressure.js';
import { buildProceduralMaster } from './proceduralMaster.js';
import { PANEL_MM, createCardTexture, createPanelTexture, paintCard, paintPanel } from './panelArt.js';

export const MODEL_URL = '/models/packshift-master.glb';
const CLOSED_SCALE = 31.5;
const FLAT_SCALE = 23.5;

const OUTER = [
  'FRONT', 'RIGHT_DATA', 'BACK', 'LEFT_COPY', 'GLUE_FLAP', 'TOP', 'BOTTOM',
  'TOP_DUST_LEFT', 'TOP_DUST_RIGHT', 'BOTTOM_DUST_LEFT', 'BOTTOM_DUST_RIGHT',
];

// Decomposition choreography (d in 0..1). Physically honest order: the lid
// opens first, the product is lifted *out through the opening*, then the
// carton unfolds panel by panel into its dieline.
const HINGE_WINDOWS = {
  HINGE_TOP: [0.02, 0.16],
  HINGE_TOP_DUST_LEFT: [0.08, 0.2],
  HINGE_TOP_DUST_RIGHT: [0.1, 0.22],
  HINGE_BOTTOM: [0.6, 0.84],
  HINGE_BOTTOM_DUST_LEFT: [0.56, 0.74],
  HINGE_BOTTOM_DUST_RIGHT: [0.58, 0.76],
  HINGE_RIGHT: [0.5, 0.8],
  HINGE_LEFT: [0.52, 0.82],
  HINGE_BACK: [0.6, 0.9],
  HINGE_GLUE: [0.74, 0.96],
};

const COMPONENTS = {
  JAR_CAP: { anchor: 'ANCHOR_EXPLODE_CAP', window: [0.14, 0.36], spin: 1.6, row: [-0.1, 0.062] },
  SEAL_DISC: { anchor: 'ANCHOR_EXPLODE_SEAL', window: [0.18, 0.4], spin: 0, row: [-0.1, 0.044] },
  INNER_JAR: { anchor: 'ANCHOR_EXPLODE_JAR', window: [0.22, 0.46], spin: 0.5, row: [-0.1, 0.004] },
  LEAFLET: { anchor: 'ANCHOR_EXPLODE_LEAFLET', window: [0.26, 0.48], spin: 0, row: [-0.142, 0.012] },
  INSERT_TRAY: { anchor: 'ANCHOR_EXPLODE_INSERT', window: [0.3, 0.52], spin: 0, row: [-0.1, -0.052] },
};
const LIFT_Y = 0.105; // metres, clears the 65 mm half-height + opening lid

const ART_FACE = {
  FRONT: { position: [0, 0, -0.00035], rotation: [0, Math.PI, 0] },
  BACK: { position: [0, 0, 0.00035], rotation: [0, 0, 0] },
  LEFT_COPY: { position: [-0.00035, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  RIGHT_DATA: { position: [0.00035, 0, 0], rotation: [0, Math.PI / 2, 0] },
  TOP: { position: [0, 0.00035, 0], rotation: [-Math.PI / 2, 0, Math.PI] },
};

// Camera framing: half-extents (world units) of what each view must show,
// plus direction and target. Distance is fitted to the live aspect ratio.
const CAMERA_VIEWS = {
  PACK: { dir: [0.52, 0.3, 0.8], target: [0, 0, 0], half: [1.6, 2.4] },
  EXPLODED: { dir: [0.42, 0.3, 0.86], target: [-0.3, 0.45, 0], half: [3.2, 3.3] },
  DIELINE: { dir: [0.02, 0.06, 1], target: [0.35, 0, 0], half: [3.9, 2.6] },
  XRAY: { dir: [0.55, 0.28, 0.78], target: [0, 0, 0], half: [1.7, 2.4] },
  PRESSURE: { dir: [0.45, 0.22, 0.86], target: [0, -0.1, 0], half: [2.4, 2.4] },
};

function smoothstep(edge0, edge1, value) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function mapNodes(scene) {
  const out = {};
  scene.traverse((object) => {
    if (object.name) out[object.name] = object;
  });
  return out;
}

function cloneRuntimeScene(source) {
  const cloned = source.clone(true);
  cloned.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.material = Array.isArray(object.material)
      ? object.material.map((m) => m.clone())
      : object.material?.clone();
  });
  return cloned;
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

/* ------------------------------------------------------------------ */
/* Printed artwork on the real panels                                  */
/* ------------------------------------------------------------------ */

function PanelArtwork({ node, surface, artState, registerMaterial }) {
  const texture = useMemo(() => createPanelTexture(surface), [surface]);
  const material = useRef();
  const [w, h] = PANEL_MM[surface];

  useEffect(() => {
    paintPanel(texture, surface, artState);
  }, [texture, surface, artState]);

  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    if (material.current) registerMaterial(surface, material.current);
  }, [registerMaterial, surface]);

  if (!node) return null;
  const face = ART_FACE[surface];

  return createPortal(
    <mesh position={face.position} rotation={face.rotation} receiveShadow userData={{ packshiftArt: surface }}>
      <planeGeometry args={[w / 1000 - 0.0006, h / 1000 - 0.0006]} />
      <meshStandardMaterial
        ref={material}
        map={texture}
        roughness={0.86}
        metalness={0}
        transparent
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>,
    node,
  );
}

/* ------------------------------------------------------------------ */
/* Labels, paths, collision                                            */
/* ------------------------------------------------------------------ */

function SurfacePressureTag({ node, root, surface, pressure, visible }) {
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
          <b>{SURFACE_LABEL[surface]}</b>
          <span>{pct}% load</span>
        </div>
      </Html>
    </group>
  );
}

function ReflowPath({ fromNode, toNode, color, label }) {
  const line = useRef();
  const tag = useRef();
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const curve = useMemo(
    () => new THREE.QuadraticBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()),
    [],
  );
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    if (!line.current || !fromNode || !toNode) return;
    fromNode.getWorldPosition(a);
    toNode.getWorldPosition(b);
    curve.v0.copy(a);
    curve.v2.copy(b);
    curve.v1.copy(a).lerp(b, 0.5);
    curve.v1.y += 1.1;
    geometry.setFromPoints(curve.getPoints(24));
    if (tag.current) tag.current.position.copy(curve.getPoint(0.5));
  });

  return (
    <>
      <line ref={line} geometry={geometry}>
        <lineBasicMaterial color={color} transparent opacity={0.85} />
      </line>
      <group ref={tag}>
        <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="reflow-tag" style={{ color }}>{label}</div>
        </Html>
      </group>
    </>
  );
}

function CollisionField({ node, active }) {
  const group = useRef();

  useFrame((state) => {
    if (!group.current || !active) return;
    group.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 8) * 0.02);
  });

  if (!node || !active) return null;

  return createPortal(
    <group ref={group} position={[0, 0, -0.0012]}>
      {[
        [0, 0.066, 0.06, 0.0009],
        [0, -0.066, 0.06, 0.0009],
        [-0.0302, 0, 0.0009, 0.133],
        [0.0302, 0, 0.0009, 0.133],
      ].map(([x, y, w, h], index) => (
        <mesh key={index} position={[x, y, 0]}>
          <boxGeometry args={[w, h, 0.0004]} />
          <meshBasicMaterial color="#ba3f34" transparent opacity={0.95} toneMapped={false} />
        </mesh>
      ))}
    </group>,
    node,
  );
}

/* ------------------------------------------------------------------ */
/* Draggable requirements — a camera-space tray when unplaced          */
/* ------------------------------------------------------------------ */

const TRAY_ORDER = ['language', 'data', 'claim'];
const TRAY_DISTANCE = 6.5;

function traySlot(kind, camera, size, out) {
  const aspect = size.width / Math.max(1, size.height);
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * TRAY_DISTANCE;
  const halfW = halfH * aspect;
  const i = TRAY_ORDER.indexOf(kind);
  let scale = 0.58;
  if (aspect >= 1.05) {
    // desktop: vertical stack, lower-left, clear of the headline
    out.set(-halfW + 0.2 + 0.9 * scale, -halfH * 0.08 - i * 0.5, -TRAY_DISTANCE);
  } else {
    // portrait: row along the bottom edge
    scale = THREE.MathUtils.clamp((halfW * 2 * 0.31) / 1.8, 0.3, 0.58);
    out.set((i - 1) * halfW * 0.66, -halfH + 0.45 * scale + 0.1, -TRAY_DISTANCE);
  }
  camera.localToWorld(out);
  return scale;
}

function DraggableConstraint({
  kind, assignedSurface, nodes, rootNode, onPlace, onHover, onSelect, selected, locked,
}) {
  const { camera, size, controls, gl } = useThree();
  const group = useRef();
  const dragging = useRef(false);
  const downAt = useRef(null);
  const dragPlane = useRef(new THREE.Plane());
  const hoverRef = useRef(null);
  const temp = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const nodePos = useMemo(() => new THREE.Vector3(), []);
  const rootPos = useMemo(() => new THREE.Vector3(), []);
  const outward = useMemo(() => new THREE.Vector3(), []);
  const normal = useMemo(() => new THREE.Vector3(), []);
  const targetScale = useMemo(() => new THREE.Vector3(), []);
  const meta = REQUIREMENTS[kind];
  const cardTexture = useMemo(() => createCardTexture(), []);
  useEffect(() => () => cardTexture.dispose(), [cardTexture]);
  useEffect(() => {
    paintCard(cardTexture, {
      label: meta.label,
      color: meta.color,
      selected,
      badge: assignedSurface ? '✓' : selected ? 'TAP' : 'DRAG',
      sub: assignedSurface ? 'on ' + SURFACE_LABEL[assignedSurface] : selected ? 'now tap a face' : meta.sub,
    });
  }, [cardTexture, meta, selected, assignedSurface]);

  useFrame((_, delta) => {
    if (!group.current || dragging.current) return;
    let s = 1;
    if (assignedSurface && nodes[assignedSurface] && rootNode) {
      nodes[assignedSurface].getWorldPosition(nodePos);
      rootNode.getWorldPosition(rootPos);
      outward.copy(nodePos).sub(rootPos);
      outward.y = 0;
      if (outward.lengthSq() < 0.0001) outward.set(0, 0, 1);
      outward.normalize();
      desired.copy(nodePos).addScaledVector(outward, 1.35);
      desired.y += { language: 0.7, data: 0.05, claim: -0.6 }[kind];
      s = 0.5;
    } else {
      s = traySlot(kind, camera, size, desired);
    }
    if (selected) s *= 1.08;
    const alpha = 1 - Math.exp(-8 * delta);
    group.current.position.lerp(desired, alpha);
    group.current.quaternion.slerp(camera.quaternion, alpha);
    group.current.scale.lerp(targetScale.setScalar(s), alpha);
  });

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const findSurface = (event) => {
    // R3F v9 pointer events expose `ray` but not always `raycaster` while the
    // pointer is captured, so cast our own ray against the Blender panels.
    if (!event.ray) return null;
    raycaster.ray.copy(event.ray);
    const candidates = SURFACES.map((surface) => nodes[surface]).filter(Boolean);
    const hits = raycaster.intersectObjects(candidates, true);
    for (const hit of hits) {
      const surface = surfaceFromHit(hit.object);
      if (surface) return surface;
    }
    return null;
  };

  const release = (event) => {
    dragging.current = false;
    event.target.releasePointerCapture?.(event.pointerId);
    document.body.classList.remove('is-dragging-constraint');
    if (controls) controls.enabled = !locked;
  };

  const handleDown = (event) => {
    if (locked) return;
    event.stopPropagation();
    dragging.current = true;
    downAt.current = [event.clientX, event.clientY];
    event.target.setPointerCapture?.(event.pointerId);
    camera.getWorldDirection(normal);
    dragPlane.current.setFromNormalAndCoplanarPoint(normal, group.current.position);
    document.body.classList.add('is-dragging-constraint');
    if (controls) controls.enabled = false; // never orbit while carrying a requirement
  };

  const handleMove = (event) => {
    if (!dragging.current || locked) return;
    event.stopPropagation();
    if (event.ray.intersectPlane(dragPlane.current, temp)) group.current.position.copy(temp);
    const surface = findSurface(event);
    if (surface !== hoverRef.current) {
      hoverRef.current = surface;
      onHover(surface);
    }
  };

  const handleUp = (event) => {
    if (!dragging.current) return;
    event.stopPropagation();
    const moved = downAt.current
      ? Math.hypot(event.clientX - downAt.current[0], event.clientY - downAt.current[1])
      : 99;
    release(event);
    const surface = hoverRef.current || findSurface(event);
    hoverRef.current = null;
    onHover(null);
    if (moved < 6) onSelect(kind); // a tap selects; then tap a face (mobile / precise placement)
    else if (surface) onPlace(kind, surface);
  };

  return (
    <group ref={group}>
      <mesh
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={(event) => dragging.current && release(event)}
        onPointerOver={() => { if (!locked) gl.domElement.style.cursor = 'grab'; }}
        onPointerOut={() => { gl.domElement.style.cursor = ''; }}
      >
        <boxGeometry args={[1.8, 0.66, 0.05]} />
        <meshStandardMaterial color="#f7f1e6" roughness={0.8} metalness={0} />
      </mesh>
      <mesh position={[0, 0, 0.026]} raycast={() => null}>
        <planeGeometry args={[1.8, 0.66]} />
        <meshBasicMaterial map={cardTexture} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function SpatialStudioScene({
  source,
  market, viewMode, decomposition, placements, pressures, collisionSurfaces, compiled,
  compilePhase, reflowMoves, interactionLocked, onPlaceConstraint, selectedKind, onSelectKind,
}) {
  const scene = source;
  const { camera, size } = useThree();
  const controls = useRef();
  const rig = useRef();
  const [hoveredSurface, setHoveredSurface] = useState(null);
  const reduced = useMemo(prefersReducedMotion, []);

  const runtime = useMemo(() => {
    const cloned = cloneRuntimeScene(scene);
    const nodes = mapNodes(cloned);
    const base = {};
    Object.entries(nodes).forEach(([name, object]) => {
      base[name] = {
        position: object.position.clone(),
        rotation: object.rotation.clone(),
        scale: object.scale.clone(),
      };
      materialList(object).forEach((material) => {
        material.userData.packshiftBaseColor = material.color?.clone?.() || null;
        material.userData.packshiftBaseOpacity = material.opacity ?? 1;
      });
    });
    // Explode targets are static relative to the inner assembly: resolve once.
    const explode = {};
    Object.entries(COMPONENTS).forEach(([name, spec]) => {
      const component = nodes[name];
      const anchor = nodes[spec.anchor];
      if (!component || !anchor) return;
      cloned.updateMatrixWorld(true);
      const world = anchor.getWorldPosition(new THREE.Vector3());
      const local = component.parent.worldToLocal(world);
      const start = base[name].position.clone();
      const lift = new THREE.Vector3(start.x, LIFT_Y, start.z);
      const row = new THREE.Vector3(spec.row[0], spec.row[1], -0.045);
      explode[name] = { start, lift, anchor: local, row, current: new THREE.Vector3() };
    });
    return { scene: cloned, nodes, base, explode };
  }, [scene]);

  const { nodes, base, explode } = runtime;

  const outerNodes = useMemo(() => OUTER.map((n) => nodes[n]).filter(Boolean), [nodes]);
  const hinges = useMemo(
    () => Object.keys(HINGE_WINDOWS).map((n) => nodes[n]).filter(Boolean),
    [nodes],
  );

  const artMaterials = useRef({});
  const registerMaterial = useMemo(
    () => (surface, material) => { artMaterials.current[surface] = material; },
    [],
  );

  const artState = useMemo(() => {
    const kindsOn = Object.fromEntries(SURFACES.map((s) => [s, []]));
    Object.entries(placements).forEach(([kind, surface]) => {
      if (surface) kindsOn[surface].push(kind);
    });
    return { market, kindsOn, overloaded: collisionSurfaces, compiled };
  }, [market, placements, collisionSurfaces, compiled]);

  // Scratch objects reused every frame (no per-frame allocation).
  const scratch = useMemo(() => ({
    color: new THREE.Color(),
    red: new THREE.Color('#ba3f34'),
    amber: new THREE.Color('#d6a858'),
    hover: new THREE.Color('#d5a84d'),
    calm: new THREE.Color('#e4dccb'),
    white: new THREE.Color('#ffffff'),
    scale: new THREE.Vector3(),
    bez: new THREE.Vector3(),
  }), []);

  // Manual scrubbing (CUSTOM) re-frames by stage so the object never leaves
  // the viewport; named views use their own framing.
  const stageView = decomposition < 0.2 ? 'PACK' : decomposition < 0.62 ? 'EXPLODED' : 'DIELINE';
  const cameraView = CAMERA_VIEWS[viewMode] && !(viewMode === 'PRESSURE' && decomposition > 0.2)
    ? viewMode
    : stageView;

  // Camera: fitted to view content and the live aspect ratio.
  useEffect(() => {
    const view = CAMERA_VIEWS[cameraView];
    if (!view || !controls.current) return;
    const aspect = size.width / Math.max(1, size.height);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(view.half[1] / tanHalf, view.half[0] / (tanHalf * aspect)) * 1.08;
    const dir = new THREE.Vector3(...view.dir).normalize();
    const target = new THREE.Vector3(...view.target);
    if (aspect < 1) target.y += 0.45; // portrait: headline overlays the top of the stage
    const position = target.clone().addScaledVector(dir, distance);
    const duration = reduced ? 0 : 0.9;
    const tweens = [
      gsap.to(camera.position, {
        x: position.x, y: position.y, z: position.z, duration, ease: 'power3.inOut',
        onUpdate: () => controls.current?.update(),
      }),
      gsap.to(controls.current.target, {
        x: target.x, y: target.y, z: target.z, duration, ease: 'power3.inOut',
        onUpdate: () => controls.current?.update(),
      }),
    ];
    return () => tweens.forEach((t) => t.kill());
  }, [camera, cameraView, size.width, size.height, reduced]);

  useFrame((state, delta) => {
    if (!rig.current) return;
    const d = decomposition;
    const k = reduced ? 30 : 9;

    hinges.forEach((hinge) => {
      const [a, b] = HINGE_WINDOWS[hinge.name];
      const t = smoothstep(a, b, d);
      const target = THREE.MathUtils.degToRad(Number(hinge.userData.flat_deg || 0)) * t;
      const baseRot = base[hinge.name].rotation;
      const axis = hinge.userData.fold_axis;
      // Blender Z-up -> glTF Y-up: Blender Z = glTF Y, Blender Y = glTF -Z.
      if (axis === 'Z') hinge.rotation.y = THREE.MathUtils.damp(hinge.rotation.y, baseRot.y + target, k, delta);
      else if (axis === 'X') hinge.rotation.x = THREE.MathUtils.damp(hinge.rotation.x, baseRot.x + target, k, delta);
      else if (axis === 'Y') hinge.rotation.z = THREE.MathUtils.damp(hinge.rotation.z, baseRot.z - target, k, delta);
    });

    // Internals: rise out through the open lid, arc to their explode anchor,
    // then line up as a parts column beside the dieline.
    const toRow = smoothstep(0.7, 0.95, d);
    Object.entries(COMPONENTS).forEach(([name, spec]) => {
      const component = nodes[name];
      const path = explode[name];
      if (!component || !path) return;
      const t = smoothstep(spec.window[0], spec.window[1], d);
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
      if (name === 'LEAFLET') component.rotation.y = THREE.MathUtils.damp(component.rotation.y, baseRot.y + (travel - toRow) * 0.9 + toRow * Math.PI / 2, k, delta);
    });

    const shell = smoothstep(0.46, 1, d);
    const targetScale = THREE.MathUtils.lerp(CLOSED_SCALE, FLAT_SCALE, shell);
    const alpha = 1 - Math.exp(-(reduced ? 30 : 6) * delta);
    rig.current.scale.lerp(scratch.scale.setScalar(targetScale), alpha);
    rig.current.rotation.x = THREE.MathUtils.damp(rig.current.rotation.x, 0.035 * (1 - shell), 6, delta);
    rig.current.rotation.y = THREE.MathUtils.damp(rig.current.rotation.y, THREE.MathUtils.lerp(Math.PI - 0.28, Math.PI, shell), 6, delta);
    rig.current.position.y = THREE.MathUtils.damp(rig.current.position.y, -0.35 * smoothstep(0.1, 0.4, d) * (1 - shell), 6, delta);

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
        material.transparent = xray || material.opacity < 0.999;
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

  // Tap-to-place: with a requirement selected, a tap on a face places it.
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
      <color attach="background" args={['#eee9df']} />
      <fog attach="fog" args={['#eee9df', 14, 30]} />

      <hemisphereLight args={['#fffaf0', '#c9bda8', 1.25]} />
      <directionalLight position={[3, 2, 9]} intensity={0.9} color="#fffaf2" />
      <directionalLight
        castShadow
        position={[5, 8, 5.5]}
        intensity={2.4}
        color="#fff4e3"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-5, 2.5, 3.8]} intensity={0.9} color="#cbd7ff" />
      <directionalLight position={[0, 3, -6]} intensity={0.6} color="#fff0de" />
      {collisionSurfaces.length > 0 && <pointLight position={[0, -0.2, 2.8]} intensity={1.1} color="#ba3f34" />}

      <group ref={rig} scale={CLOSED_SCALE} rotation={[0.035, Math.PI - 0.28, 0]}>
        <primitive object={runtime.scene} dispose={null} {...surfaceHandlers} />
        {['FRONT', 'LEFT_COPY', 'RIGHT_DATA', 'BACK', 'TOP'].map((surface) => (
          <PanelArtwork
            key={surface}
            node={nodes[surface]}
            surface={surface}
            artState={artState}
            registerMaterial={registerMaterial}
          />
        ))}
        <CollisionField node={nodes.FRONT} active={collisionSurfaces.includes('FRONT')} />
      </group>

      {SURFACES.map((surface) => (
        <SurfacePressureTag
          key={surface}
          node={nodes[surface]}
          root={nodes.PACKSHIFT_ROOT}
          surface={surface}
          pressure={pressures[surface] || 0}
          visible={pressureVisible}
        />
      ))}

      {compilePhase === 'reflow' && reflowMoves.map((move) => (
        <ReflowPath
          key={move.kind}
          fromNode={nodes[move.from || 'FRONT']}
          toNode={nodes[move.to]}
          color={REQUIREMENTS[move.kind].color}
          label={`${REQUIREMENTS[move.kind].label} → ${SURFACE_LABEL[move.to].toUpperCase()}`}
        />
      ))}

      {Object.keys(REQUIREMENTS).map((kind) => (
        <DraggableConstraint
          key={kind}
          kind={kind}
          assignedSurface={placements[kind]}
          nodes={nodes}
          rootNode={nodes.PACKSHIFT_ROOT}
          onPlace={onPlaceConstraint}
          onHover={setHoveredSurface}
          onSelect={onSelectKind}
          selected={selectedKind === kind}
          locked={interactionLocked}
        />
      ))}

      <OrbitControls
        ref={controls}
        makeDefault
        enabled={!interactionLocked}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={3.6}
        maxDistance={24}
        minPolarAngle={0.3}
        maxPolarAngle={2.45}
      />

      <ContactShadows position={[0, -2.35, 0]} opacity={0.24} scale={14} blur={2.6} far={7} />
    </>
  );
}

function GlbStudio(props) {
  const { scene } = useGLTF(MODEL_URL);
  return <SpatialStudioScene source={scene} {...props} />;
}

function ProceduralStudio(props) {
  const scene = useMemo(buildProceduralMaster, []);
  return <SpatialStudioScene source={scene} {...props} />;
}

export function PackageScene({ procedural = false, ...props }) {
  return procedural ? <ProceduralStudio {...props} /> : <GlbStudio {...props} />;
}

useGLTF.preload(MODEL_URL);
