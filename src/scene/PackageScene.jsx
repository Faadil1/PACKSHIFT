import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Edges, Html, OrbitControls, useGLTF } from '@react-three/drei';
import gsap from 'gsap';
import * as THREE from 'three';
import { PackageSceneProcedural } from './PackageSceneProcedural.jsx';

const MODEL_URL = '/models/packshift-master.glb';
const CLOSED_SCALE = 31.5;
const SURFACES = ['FRONT', 'LEFT_COPY', 'RIGHT_DATA', 'BACK'];

const CONSTRAINTS = {
  language: { label: 'FR / EN', sub: 'LANGUAGE', color: '#1d1b17' },
  data: { label: 'DATA CARRIER', sub: 'QR / RECYCLING', color: '#2f5fd0' },
  claim: { label: '24H HYDRATION', sub: 'CLAIM', color: '#ba3f34' },
};

const TRAY = {
  language: new THREE.Vector3(-3.2, -1.8, 2.2),
  data: new THREE.Vector3(0, -2.15, 2.25),
  claim: new THREE.Vector3(3.2, -1.8, 2.2),
};

function smoothstep(edge0, edge1, value) {
  const x = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
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
    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) => material.clone());
    } else if (object.material) {
      object.material = object.material.clone();
    }
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

function FrontArtwork({ node, market, placements, compiled }) {
  if (!node) return null;
  const language = placements.language === 'FRONT';
  const claim = placements.claim === 'FRONT';

  return createPortal(
    <group position={[0, 0, -0.0006]} rotation={[0, Math.PI, 0]} scale={1 / CLOSED_SCALE}>
      <Html transform distanceFactor={3.05} style={{ pointerEvents: 'none' }}>
        <div className={'panel-art blender-front-art ' + (compiled ? 'compiled' : '')}>
          <span className="panel-tag">FRONT / MASTER</span>
          <div className="front-brand">NORD</div>
          <div className="front-title">HYDRA<br />VEIL</div>
          <div className="front-variant">BARRIER CREAM</div>
          <div className="art-rule"></div>
          <div className="front-copy">
            {language ? (
              <>Ceramide complex<br />Complexe aux céramides<br />Sensitive skin / Peaux sensibles</>
            ) : (
              <>Ceramide complex<br />Barrier support<br />Sensitive skin</>
            )}
          </div>
          <div className={'front-claim ' + (claim ? 'show' : '')}>
            24H<br /><b>HYDRATION</b>
          </div>
          <div className="front-footer">
            <span>50 mL ℮</span>
            <span>{market === 'EU' ? 'EU' : 'CA'}</span>
          </div>
        </div>
      </Html>
    </group>,
    node,
  );
}

function SurfacePressureTag({ node, root, surface, pressure, visible }) {
  const group = useRef();
  const nodePos = useMemo(() => new THREE.Vector3(), []);
  const rootPos = useMemo(() => new THREE.Vector3(), []);
  const outward = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!group.current || !node || !root || !visible) return;
    node.getWorldPosition(nodePos);
    root.getWorldPosition(rootPos);
    outward.copy(nodePos).sub(rootPos);
    if (outward.lengthSq() < 0.0001) outward.set(0, 0, 1);
    outward.normalize();
    group.current.position.copy(nodePos).addScaledVector(outward, 0.48);
  });

  if (!visible) return null;
  const pct = Math.round((pressure || 0) * 100);

  return (
    <group ref={group}>
      <Html center sprite distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div className={'surface-pressure-tag ' + (pct > 100 ? 'over' : '')}>
          <b>{surface.replace('_', ' ')}</b>
          <span>{pct}% LOAD</span>
        </div>
      </Html>
    </group>
  );
}

function DynamicPath({ fromNode, toNode, color, label, visible }) {
  const line = useRef();
  const tag = useRef();
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const mid = useMemo(() => new THREE.Vector3(), []);
  const points = useMemo(() => [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], []);

  useFrame(() => {
    if (!visible || !line.current || !fromNode || !toNode) return;
    fromNode.getWorldPosition(a);
    toNode.getWorldPosition(b);
    mid.copy(a).lerp(b, 0.5);
    mid.y += 0.7;
    points[0].copy(a);
    points[1].copy(mid);
    points[2].copy(b);
    line.current.geometry.setFromPoints(points);
    if (tag.current) tag.current.position.copy(mid);
  });

  if (!visible) return null;

  return (
    <>
      <line ref={line}>
        <bufferGeometry />
        <lineBasicMaterial color={color} transparent opacity={0.75} />
      </line>
      <group ref={tag}>
        <Html center sprite distanceFactor={8} style={{ pointerEvents: 'none' }}>
          <div className="reflow-tag" style={{ color }}>{label}</div>
        </Html>
      </group>
    </>
  );
}

function CollisionField({ node, pressure, active }) {
  const group = useRef();

  useFrame((state) => {
    if (!group.current || !active) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 8) * 0.035;
    group.current.scale.setScalar(pulse);
  });

  if (!node || !active) return null;

  return createPortal(
    <group ref={group} position={[0, -0.020, -0.0008]} rotation={[0, Math.PI, 0]}>
      <mesh>
        <boxGeometry args={[0.052, 0.038, 0.0003]} />
        <meshBasicMaterial color="#ba3f34" transparent opacity={0.10} side={THREE.DoubleSide} />
      </mesh>
      {[
        [0, 0.019, 0.053, 0.00065],
        [0, -0.019, 0.053, 0.00065],
        [-0.0265, 0, 0.00065, 0.039],
        [0.0265, 0, 0.00065, 0.039],
      ].map((lineDef, index) => (
        <mesh key={index} position={[lineDef[0], lineDef[1], -0.00015]}>
          <boxGeometry args={[lineDef[2], lineDef[3], 0.0002]} />
          <meshBasicMaterial color="#ba3f34" transparent opacity={0.92} />
        </mesh>
      ))}
      <group scale={1 / CLOSED_SCALE} position={[0, 0.034, -0.002]}>
        <Html center transform distanceFactor={3.3} style={{ pointerEvents: 'none' }}>
          <div className="collision-plate">
            <b>OVER CAPACITY</b>
            <span>{Math.round(pressure * 100)}%</span>
          </div>
        </Html>
      </group>
    </group>,
    node,
  );
}

function DraggableConstraint({
  kind,
  assignedSurface,
  nodes,
  rootNode,
  onPlace,
  onHover,
  locked,
}) {
  const { camera } = useThree();
  const group = useRef();
  const material = useRef();
  const dragging = useRef(false);
  const dragPlane = useRef(new THREE.Plane());
  const hoverRef = useRef(null);
  const temp = useMemo(() => new THREE.Vector3(), []);
  const nodePos = useMemo(() => new THREE.Vector3(), []);
  const rootPos = useMemo(() => new THREE.Vector3(), []);
  const outward = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const normal = useMemo(() => new THREE.Vector3(), []);

  const meta = CONSTRAINTS[kind];

  useFrame((_, delta) => {
    if (!group.current || dragging.current) return;

    if (assignedSurface && nodes[assignedSurface] && rootNode) {
      nodes[assignedSurface].getWorldPosition(nodePos);
      rootNode.getWorldPosition(rootPos);
      outward.copy(nodePos).sub(rootPos);
      if (outward.lengthSq() < 0.0001) outward.set(0, 0, 1);
      outward.normalize();
      desired.copy(nodePos).addScaledVector(outward, 0.58);
      desired.y += kind === 'claim' ? -0.12 : 0.12;
    } else {
      desired.copy(TRAY[kind]);
    }

    const alpha = 1 - Math.exp(-7 * delta);
    group.current.position.lerp(desired, alpha);
    group.current.scale.lerp(
      assignedSurface ? temp.set(0.72, 0.72, 0.72) : temp.set(1, 1, 1),
      alpha,
    );
  });

  const findSurface = (event) => {
    const candidates = SURFACES.map((surface) => nodes[surface]).filter(Boolean);
    const hits = event.raycaster.intersectObjects(candidates, true);
    for (const hit of hits) {
      const surface = surfaceFromHit(hit.object);
      if (surface) return surface;
    }
    return null;
  };

  const handleDown = (event) => {
    if (locked) return;
    event.stopPropagation();
    dragging.current = true;
    event.target.setPointerCapture?.(event.pointerId);
    camera.getWorldDirection(normal);
    dragPlane.current.setFromNormalAndCoplanarPoint(normal, group.current.position);
    if (material.current) material.current.opacity = 1;
    document.body.classList.add('is-dragging-constraint');
  };

  const handleMove = (event) => {
    if (!dragging.current || locked) return;
    event.stopPropagation();
    if (event.ray.intersectPlane(dragPlane.current, temp)) {
      group.current.position.copy(temp);
    }
    const surface = findSurface(event);
    if (surface !== hoverRef.current) {
      hoverRef.current = surface;
      onHover(surface);
    }
  };

  const handleUp = (event) => {
    if (!dragging.current) return;
    event.stopPropagation();
    dragging.current = false;
    event.target.releasePointerCapture?.(event.pointerId);
    document.body.classList.remove('is-dragging-constraint');
    const surface = hoverRef.current || findSurface(event);
    hoverRef.current = null;
    onHover(null);
    if (surface) onPlace(kind, surface);
  };

  return (
    <group ref={group} position={TRAY[kind]}>
      <mesh
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        <boxGeometry args={[kind === 'claim' ? 1.75 : 1.62, 0.68, 0.075]} />
        <meshPhysicalMaterial
          ref={material}
          color="#f7f1e6"
          roughness={0.82}
          metalness={0}
          transparent
          opacity={0.96}
        />
        <Edges color={meta.color} transparent opacity={0.82} />
      </mesh>
      <Html center transform distanceFactor={4.2} position={[0, 0, 0.05]} style={{ pointerEvents: 'none' }}>
        <div className={'drag-card drag-card-' + kind}>
          <span>DRAG</span>
          <div>
            <b>{meta.label}</b>
            <small>{assignedSurface ? 'ON ' + assignedSurface.replace('_', ' ') : meta.sub}</small>
          </div>
        </div>
      </Html>
    </group>
  );
}

function SpatialStudioScene({
  market,
  viewMode,
  decomposition,
  placements,
  pressures,
  collisionSurfaces,
  compiled,
  compilePhase,
  interactionLocked,
  onPlaceConstraint,
}) {
  const { scene } = useGLTF(MODEL_URL);
  const { camera } = useThree();
  const controls = useRef();
  const rig = useRef();
  const [hoveredSurface, setHoveredSurface] = useState(null);

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
      if (object.isMesh) {
        materialList(object).forEach((material) => {
          material.userData.packshiftBaseColor = material.color?.clone?.() || null;
          material.userData.packshiftBaseOpacity = material.opacity ?? 1;
        });
      }
    });
    return { scene: cloned, nodes, base };
  }, [scene]);

  const nodes = runtime.nodes;
  const base = runtime.base;

  const outerNodes = useMemo(
    () => [
      'FRONT','RIGHT_DATA','BACK','LEFT_COPY','GLUE_FLAP','TOP','BOTTOM',
      'TOP_DUST_LEFT','TOP_DUST_RIGHT','BOTTOM_DUST_LEFT','BOTTOM_DUST_RIGHT',
    ].map((name) => nodes[name]).filter(Boolean),
    [nodes],
  );

  const hinges = useMemo(
    () => [
      'HINGE_RIGHT','HINGE_BACK','HINGE_LEFT','HINGE_GLUE','HINGE_TOP','HINGE_BOTTOM',
      'HINGE_TOP_DUST_LEFT','HINGE_TOP_DUST_RIGHT','HINGE_BOTTOM_DUST_LEFT','HINGE_BOTTOM_DUST_RIGHT',
    ].map((name) => nodes[name]).filter(Boolean),
    [nodes],
  );

  const componentAnchors = useMemo(() => ({
    INNER_JAR: nodes.ANCHOR_EXPLODE_JAR,
    JAR_CAP: nodes.ANCHOR_EXPLODE_CAP,
    SEAL_DISC: nodes.ANCHOR_EXPLODE_SEAL,
    INSERT_TRAY: nodes.ANCHOR_EXPLODE_INSERT,
    LEAFLET: nodes.ANCHOR_EXPLODE_LEAFLET,
  }), [nodes]);

  useEffect(() => {
    if (!controls.current) return;
    const presets = {
      PACK: { position: [4.6, 2.6, 7.3], target: [0, 0, 0] },
      EXPLODED: { position: [5.5, 3.1, 8.3], target: [0, 0.05, 0] },
      DIELINE: { position: [0.1, 0.7, 10.7], target: [0.25, 0, 0] },
      XRAY: { position: [4.2, 2.1, 7.0], target: [0, 0, 0] },
      PRESSURE: { position: [3.6, 1.8, 6.1], target: [0, -0.15, 0] },
    };
    const preset = presets[viewMode];
    if (!preset) return;

    gsap.to(camera.position, {
      x: preset.position[0],
      y: preset.position[1],
      z: preset.position[2],
      duration: 0.9,
      ease: 'power3.inOut',
      onUpdate: () => controls.current?.update(),
    });
    gsap.to(controls.current.target, {
      x: preset.target[0],
      y: preset.target[1],
      z: preset.target[2],
      duration: 0.9,
      ease: 'power3.inOut',
      onUpdate: () => controls.current?.update(),
    });
  }, [camera, viewMode]);

  useFrame((state, delta) => {
    if (!rig.current) return;

    const internal = smoothstep(0.06, 0.58, decomposition);
    const shell = smoothstep(0.38, 1, decomposition);

    hinges.forEach((hinge) => {
      const metaAxis = hinge.userData.fold_axis;
      const flatDeg = Number(hinge.userData.flat_deg || 0);
      const target = THREE.MathUtils.degToRad(flatDeg) * shell;
      const baseRot = base[hinge.name]?.rotation || new THREE.Euler();

      if (metaAxis === 'Z') {
        hinge.rotation.y = THREE.MathUtils.damp(hinge.rotation.y, baseRot.y + target, 8, delta);
      } else if (metaAxis === 'X') {
        hinge.rotation.x = THREE.MathUtils.damp(hinge.rotation.x, baseRot.x + target, 8, delta);
      } else if (metaAxis === 'Y') {
        hinge.rotation.z = THREE.MathUtils.damp(hinge.rotation.z, baseRot.z - target, 8, delta);
      }
    });

    Object.entries(componentAnchors).forEach(([name, anchor]) => {
      const component = nodes[name];
      const baseline = base[name];
      if (!component || !anchor || !baseline || !component.parent) return;

      const targetWorld = new THREE.Vector3();
      anchor.getWorldPosition(targetWorld);
      const targetLocal = component.parent.worldToLocal(targetWorld.clone());

      const factor = name === 'INSERT_TRAY' ? internal * 0.82 : internal;
      component.position.lerpVectors(baseline.position, targetLocal, factor);

      if (name === 'INNER_JAR') {
        component.rotation.y = THREE.MathUtils.damp(component.rotation.y, baseline.rotation.y + internal * 0.42, 7, delta);
      }
      if (name === 'LEAFLET') {
        component.rotation.z = THREE.MathUtils.damp(component.rotation.z, baseline.rotation.z - internal * 0.22, 7, delta);
      }
    });

    const targetScale = THREE.MathUtils.lerp(CLOSED_SCALE, 28.5, shell);
    const alpha = 1 - Math.exp(-6 * delta);
    rig.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), alpha);
    rig.current.rotation.x = THREE.MathUtils.damp(rig.current.rotation.x, 0.035 * (1 - shell), 6, delta);
    rig.current.rotation.y = THREE.MathUtils.damp(
      rig.current.rotation.y,
      THREE.MathUtils.lerp(Math.PI - 0.28, Math.PI, shell),
      6,
      delta,
    );

    const xray = viewMode === 'XRAY';
    outerNodes.forEach((node) => {
      materialList(node).forEach((material) => {
        const baseColor = material.userData.packshiftBaseColor;
        const baseOpacity = material.userData.packshiftBaseOpacity ?? 1;
        const ratio = pressures[node.name] || 0;
        const highlighted = hoveredSurface === node.name;
        const heat = viewMode === 'PRESSURE' || ratio > 1 || highlighted;

        if (baseColor && material.color) {
          const targetColor = baseColor.clone();
          if (heat) {
            const heatColor = ratio > 1
              ? new THREE.Color('#ba3f34')
              : highlighted
                ? new THREE.Color('#d5a84d')
                : new THREE.Color('#d6a858');
            targetColor.lerp(heatColor, THREE.MathUtils.clamp(Math.max(ratio * 0.42, highlighted ? 0.45 : 0), 0, 0.62));
          }
          if (compiled) targetColor.lerp(new THREE.Color('#e4dccb'), 0.08);
          material.color.lerp(targetColor, alpha);
        }

        const targetOpacity = xray ? 0.16 : baseOpacity;
        material.opacity = THREE.MathUtils.damp(material.opacity ?? 1, targetOpacity, 7, delta);
        material.transparent = xray || targetOpacity < 1;
        material.depthWrite = !xray;
      });
    });

    if (collisionSurfaces.includes('FRONT') && nodes.FRONT) {
      const pulse = 1 - Math.max(0, Math.sin(state.clock.elapsedTime * 7)) * 0.012;
      nodes.FRONT.scale.x = THREE.MathUtils.damp(nodes.FRONT.scale.x, pulse, 10, delta);
    } else if (nodes.FRONT && base.FRONT) {
      nodes.FRONT.scale.x = THREE.MathUtils.damp(nodes.FRONT.scale.x, base.FRONT.scale.x, 10, delta);
    }
  });

  const pressureVisible = viewMode === 'PRESSURE' || collisionSurfaces.length > 0;
  const reflowVisible = compilePhase === 'reflow';

  return (
    <>
      <color attach="background" args={['#eee9df']} />
      <fog attach="fog" args={['#eee9df', 11, 22]} />

      <ambientLight intensity={1.35} />
      <directionalLight
        castShadow
        position={[5, 8, 5.5]}
        intensity={3.1}
        color="#fff6e8"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-5, 2.5, 3.8]} intensity={1.25} color="#cbd7ff" />
      <pointLight position={[0, 1.8, 4.8]} intensity={0.7} color="#fff8ef" />
      {collisionSurfaces.length > 0 && (
        <pointLight position={[0, -0.2, 2.8]} intensity={1.15} color="#ba3f34" />
      )}

      <group ref={rig} scale={CLOSED_SCALE} rotation={[0.035, Math.PI - 0.28, 0]}>
        <primitive object={runtime.scene} dispose={null} />
        <FrontArtwork node={nodes.FRONT} market={market} placements={placements} compiled={compiled} />
        <CollisionField
          node={nodes.FRONT}
          pressure={pressures.FRONT || 0}
          active={collisionSurfaces.includes('FRONT')}
        />
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

      <DynamicPath
        fromNode={nodes.FRONT}
        toNode={nodes.LEFT_COPY}
        color="#24211d"
        label="LANGUAGE → LEFT"
        visible={reflowVisible}
      />
      <DynamicPath
        fromNode={nodes.FRONT}
        toNode={nodes.RIGHT_DATA}
        color="#2f5fd0"
        label="DATA → RIGHT"
        visible={reflowVisible}
      />
      <DynamicPath
        fromNode={nodes.FRONT}
        toNode={nodes.BACK}
        color="#9b7847"
        label={market === 'CANADA' ? 'BILINGUAL COPY → BACK' : 'OVERFLOW → BACK'}
        visible={reflowVisible && market === 'CANADA'}
      />

      {Object.keys(CONSTRAINTS).map((kind) => (
        <DraggableConstraint
          key={kind}
          kind={kind}
          assignedSurface={placements[kind]}
          nodes={nodes}
          rootNode={nodes.PACKSHIFT_ROOT}
          onPlace={onPlaceConstraint}
          onHover={setHoveredSurface}
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
        minDistance={4.1}
        maxDistance={12}
        minPolarAngle={0.32}
        maxPolarAngle={2.45}
        target={[0, 0, 0]}
      />

      <ContactShadows
        position={[0, -2.25, -0.35]}
        opacity={0.22}
        scale={12}
        blur={2.8}
        far={7}
      />
    </>
  );
}

export function PackageScene(props) {
  const forceProcedural = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('procedural') === '1';

  if (forceProcedural) return <PackageSceneProcedural {...props} />;
  return <SpatialStudioScene {...props} />;
}

useGLTF.preload(MODEL_URL);
