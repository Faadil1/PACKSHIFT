import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Edges, Html, useGLTF } from '@react-three/drei';
import gsap from 'gsap';
import * as THREE from 'three';
import { PackageSceneProcedural } from './PackageSceneProcedural.jsx';

const MODEL_URL = '/models/packshift-master.glb';
const CLOSED_SCALE = 31.5;
const FLAT_SCALE = 29.5;

function ConstraintCard({ active, kind, position, color, children, stage, compiled }) {
  const ref = useRef();
  const material = useRef();

  const off = useMemo(() => {
    if (kind === 'language') return [-5.2, 0.55, 1.2];
    if (kind === 'data') return [5.2, 0.6, 1.1];
    return [0, -4.2, 1.65];
  }, [kind]);

  useEffect(() => {
    if (!ref.current || !material.current) return;
    const show = active && !compiled && stage === 'folded';
    const target = show ? position : off;

    gsap.to(ref.current.position, {
      x: target[0], y: target[1], z: target[2],
      duration: show ? 0.85 : 0.55,
      ease: 'power3.out',
    });
    gsap.to(ref.current.scale, {
      x: show ? 1 : 0.72, y: show ? 1 : 0.72, z: show ? 1 : 0.72,
      duration: 0.5,
      ease: 'power2.out',
    });
    gsap.to(material.current, { opacity: show ? 0.97 : 0, duration: 0.3 });
  }, [active, compiled, kind, off, position, stage]);

  return (
    <group ref={ref} position={off}>
      <mesh>
        <boxGeometry args={[kind === 'claim' ? 1.8 : 1.65, kind === 'claim' ? 0.9 : 0.72, 0.06]} />
        <meshPhysicalMaterial
          ref={material}
          color="#f8f2e7"
          roughness={0.9}
          transparent
          opacity={0}
        />
        <Edges color={color} transparent opacity={0.82} />
      </mesh>
      <Html transform distanceFactor={3.5} position={[0, 0, 0.04]} style={{ pointerEvents: 'none' }}>
        <div className={'constraint-card constraint-card-' + kind} style={{ color }}>
          {children}
        </div>
      </Html>
    </group>
  );
}

function makeNodeMap(scene) {
  const map = {};
  scene.traverse((object) => {
    if (object.name) map[object.name] = object;
  });
  return map;
}

function FrontArtwork({ node, language, claim, market }) {
  if (!node) return null;

  return createPortal(
    <group position={[0, 0, -0.00055]} rotation={[0, Math.PI, 0]} scale={1 / CLOSED_SCALE}>
      <Html transform distanceFactor={3.1} style={{ pointerEvents: 'none' }}>
        <div className="panel-art blender-front-art">
          <span className="panel-tag">FRONT / BLENDER MASTER</span>
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

function CollisionOverlay({ node, active }) {
  const pulse = useRef();

  useFrame((state) => {
    if (!pulse.current || !active) return;
    pulse.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 7) * 0.025);
  });

  if (!node) return null;

  return createPortal(
    <group ref={pulse} visible={active} position={[0, -0.021, -0.00075]} rotation={[0, Math.PI, 0]}>
      <mesh>
        <boxGeometry args={[0.045, 0.034, 0.00025]} />
        <meshBasicMaterial color="#ba3f34" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
      {[
        [0, 0.017, 0.046, 0.00055],
        [0, -0.017, 0.046, 0.00055],
        [-0.023, 0, 0.00055, 0.035],
        [0.023, 0, 0.00055, 0.035],
      ].map((line, index) => (
        <mesh key={index} position={[line[0], line[1], -0.0002]}>
          <boxGeometry args={[line[2], line[3], 0.0002]} />
          <meshBasicMaterial color="#ba3f34" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>,
    node,
  );
}

function FlatGuides({ visible }) {
  if (!visible) return null;

  return (
    <group position={[0, 0.15, -0.035]}>
      <mesh position={[0.9, 0.25, 0]}>
        <boxGeometry args={[2.3, 0.018, 0.012]} />
        <meshBasicMaterial color="#2f5fd0" transparent opacity={0.45} />
      </mesh>
      <mesh position={[0.55, -0.55, 0]}>
        <boxGeometry args={[1.45, 0.018, 0.012]} />
        <meshBasicMaterial color="#ba3f34" transparent opacity={0.5} />
      </mesh>
      <Html transform distanceFactor={3.8} position={[2.15, 0.43, 0]} style={{ pointerEvents: 'none' }}>
        <div className="route-label route-blue">COPY → BACK</div>
      </Html>
      <Html transform distanceFactor={3.8} position={[1.1, -0.36, 0]} style={{ pointerEvents: 'none' }}>
        <div className="route-label route-red">CLAIM → FRONT</div>
      </Html>
    </group>
  );
}

function BlenderPackageScene({ stage, market, language, data, claim, collision, compiled }) {
  const { scene } = useGLTF(MODEL_URL);
  const { camera } = useThree();
  const rig = useRef();

  const asset = useMemo(() => {
    const cloned = scene.clone(true);
    return { scene: cloned, nodes: makeNodeMap(cloned) };
  }, [scene]);

  const nodes = asset.nodes;
  const flat = stage === 'opening' || stage === 'flat';
  const fullyFlat = stage === 'flat';

  useEffect(() => {
    const side = flat ? Math.PI / 2 : 0;
    const left = flat ? -Math.PI / 2 : 0;
    const top = flat ? -Math.PI / 2 : 0;
    const bottom = flat ? Math.PI / 2 : 0;

    const rightHinge = nodes.HINGE_RIGHT;
    const backHinge = nodes.HINGE_BACK;
    const leftHinge = nodes.HINGE_LEFT;
    const topHinge = nodes.HINGE_TOP;
    const bottomHinge = nodes.HINGE_BOTTOM;

    if (!rig.current || !rightHinge || !backHinge || !leftHinge || !topHinge || !bottomHinge) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } });

    if (flat) {
      tl.to([topHinge.rotation, bottomHinge.rotation], { x: 0, duration: 0.16 }, 0);
      tl.to(rightHinge.rotation, { y: side, duration: 1.08 }, 0.08);
      tl.to(leftHinge.rotation, { y: left, duration: 1.08 }, 0.08);
      tl.to(backHinge.rotation, { y: side, duration: 1.0 }, 0.2);
      tl.to(topHinge.rotation, { x: top, duration: 0.82 }, 0.2);
      tl.to(bottomHinge.rotation, { x: bottom, duration: 0.82 }, 0.2);
    } else {
      tl.to(backHinge.rotation, { y: 0, duration: 0.84 }, 0);
      tl.to(rightHinge.rotation, { y: 0, duration: 1.0 }, 0.08);
      tl.to(leftHinge.rotation, { y: 0, duration: 1.0 }, 0.08);
      tl.to(topHinge.rotation, { x: 0, duration: 0.82 }, 0.18);
      tl.to(bottomHinge.rotation, { x: 0, duration: 0.82 }, 0.18);
    }

    tl.to(rig.current.rotation, {
      x: flat ? 0 : 0.035,
      y: flat ? Math.PI : Math.PI - 0.28,
      z: 0,
      duration: 1.05,
    }, 0);

    tl.to(rig.current.scale, {
      x: flat ? FLAT_SCALE : CLOSED_SCALE,
      y: flat ? FLAT_SCALE : CLOSED_SCALE,
      z: flat ? FLAT_SCALE : CLOSED_SCALE,
      duration: 1.05,
    }, 0);

    return () => tl.kill();
  }, [flat, nodes]);

  useEffect(() => {
    const target = flat
      ? { p: [0.2, 0.35, 9.5], t: [0.35, 0, 0] }
      : collision
        ? { p: [3.35, 1.85, 6.45], t: [0, -0.3, 0] }
        : stage === 'valid'
          ? { p: [4.1, 2.4, 7.15], t: [0, 0, 0] }
          : { p: [4.7, 2.7, 7.55], t: [0, 0, 0] };

    const look = { x: target.t[0], y: target.t[1], z: target.t[2] };

    gsap.to(camera.position, {
      x: target.p[0],
      y: target.p[1],
      z: target.p[2],
      duration: 1.0,
      ease: 'power3.inOut',
      onUpdate: () => camera.lookAt(look.x, look.y, look.z),
    });
  }, [camera, collision, flat, stage]);

  useFrame((state) => {
    if (!rig.current || flat || stage === 'closing') return;
    rig.current.position.y = Math.sin(state.clock.elapsedTime * 0.68) * 0.03;
  });

  return (
    <>
      <color attach="background" args={['#eee9df']} />
      <fog attach="fog" args={['#eee9df', 11, 20]} />

      <ambientLight intensity={1.5} />
      <directionalLight
        castShadow
        position={[4.8, 7.5, 5.5]}
        intensity={3.0}
        color="#fff6e6"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-5.5, 2.8, 4]} intensity={1.0} color="#cad9ff" />
      <pointLight position={[0, 1.4, 5.5]} intensity={0.55} color="#fff8ed" />

      <group ref={rig} scale={CLOSED_SCALE} rotation={[0.035, Math.PI - 0.28, 0]}>
        <primitive object={asset.scene} dispose={null} />
        <FrontArtwork node={nodes.FRONT} language={language} claim={claim} market={market} />
        <CollisionOverlay node={nodes.FRONT} active={collision} />
      </group>

      <FlatGuides visible={fullyFlat} />

      <ConstraintCard
        kind="language"
        active={language}
        stage={stage}
        compiled={compiled}
        color="#22201b"
        position={[-2.45, 0.8, 0.9]}
      >
        <span className="cc-index">01</span>
        <b>FR / EN</b>
        <small>LANGUAGE TAKES WIDTH</small>
      </ConstraintCard>

      <ConstraintCard
        kind="data"
        active={data}
        stage={stage}
        compiled={compiled}
        color="#2f5fd0"
        position={[2.5, 0.75, 0.85]}
      >
        <span className="cc-index">02</span>
        <b>DATA CARRIER</b>
        <small>NEEDS A REAL FACE</small>
      </ConstraintCard>

      <ConstraintCard
        kind="claim"
        active={claim}
        stage={stage}
        compiled={compiled}
        color="#ba3f34"
        position={[0, -0.8, 1.15]}
      >
        <span className="cc-index">03</span>
        <b>24H HYDRATION</b>
        <small>CLAIM WANTS THE FRONT</small>
      </ConstraintCard>

      <ContactShadows
        position={[0, -2.2, -0.25]}
        opacity={0.2}
        scale={10}
        blur={2.6}
        far={6}
      />
    </>
  );
}

export function PackageScene(props) {
  const forceProcedural = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('procedural') === '1';

  if (forceProcedural) {
    return <PackageSceneProcedural {...props} />;
  }

  return <BlenderPackageScene {...props} />;
}

useGLTF.preload(MODEL_URL);
