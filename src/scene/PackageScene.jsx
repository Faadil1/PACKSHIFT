import React, { useEffect, useMemo, useRef } from 'react';
import { ContactShadows, Edges, Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import * as THREE from 'three';

const WIDTH = 2.4;
const HEIGHT = 3.5;
const DEPTH = 1.2;

function makePaperTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#eee5d5';
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2400; i += 1) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const alpha = Math.random() * 0.045;
    ctx.fillStyle = 'rgba(75, 58, 38, ' + alpha + ')';
    ctx.fillRect(x, y, Math.random() * 1.4 + 0.2, Math.random() * 1.4 + 0.2);
  }

  for (let i = 0; i < 180; i += 1) {
    const y = Math.random() * 256;
    ctx.strokeStyle = 'rgba(255,255,255,' + (Math.random() * 0.035) + ')';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + Math.random() * 2 - 1);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.5, 2.1);
  texture.anisotropy = 4;
  return texture;
}

function Panel({ size, children, texture, label }) {
  const [w, h] = size;

  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, 0.05]} />
        <meshPhysicalMaterial
          map={texture}
          color="#f1e8d8"
          roughness={0.92}
          metalness={0}
          sheen={0.12}
          sheenColor="#fff8ec"
          clearcoat={0.02}
        />
        <Edges color="#352f28" transparent opacity={0.24} />
      </mesh>

      <Html
        transform
        distanceFactor={3.25}
        position={[0, 0, 0.031]}
        style={{ pointerEvents: 'none' }}
      >
        <div className={'panel-art' + (w < 2 ? ' panel-art-narrow' : '') + (h < 2 ? ' panel-art-flap' : '')}>
          <span className="panel-tag">{label}</span>
          {children}
        </div>
      </Html>
    </group>
  );
}

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
      x: target[0],
      y: target[1],
      z: target[2],
      duration: show ? 0.9 : 0.6,
      ease: 'power3.out',
    });

    gsap.to(ref.current.scale, {
      x: show ? 1 : 0.72,
      y: show ? 1 : 0.72,
      z: show ? 1 : 0.72,
      duration: 0.55,
      ease: 'power2.out',
    });

    gsap.to(material.current, {
      opacity: show ? 0.97 : 0,
      duration: 0.35,
    });
  }, [active, stage, compiled, position, off]);

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

function CollisionFrame({ active }) {
  const ref = useRef();

  useFrame((state) => {
    if (!ref.current || !active) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 7) * 0.025;
    ref.current.scale.setScalar(pulse);
  });

  return (
    <group ref={ref} visible={active} position={[0, -0.66, 0.12]}>
      <mesh>
        <boxGeometry args={[1.86, 1.04, 0.025]} />
        <meshBasicMaterial color="#ba3f34" transparent opacity={0.055} depthWrite={false} />
      </mesh>

      {[
        [0, 0.53, 1.88, 0.025],
        [0, -0.53, 1.88, 0.025],
        [-0.95, 0, 0.025, 1.08],
        [0.95, 0, 0.025, 1.08],
      ].map((item, index) => (
        <mesh key={index} position={[item[0], item[1], 0.03]}>
          <boxGeometry args={[item[2], item[3], 0.02]} />
          <meshBasicMaterial color="#ba3f34" transparent opacity={0.82} />
        </mesh>
      ))}

      <Html transform distanceFactor={3.4} position={[0, 0.7, 0.07]} style={{ pointerEvents: 'none' }}>
        <div className="collision-label">
          <b>COLLISION</b>
          <small>ONE SURFACE / TWO DEMANDS</small>
        </div>
      </Html>
    </group>
  );
}

function FoldGuides({ visible }) {
  return (
    <group visible={visible} position={[0, 0, 0.07]}>
      {[
        [-WIDTH / 2, 0, 0.018, HEIGHT],
        [WIDTH / 2, 0, 0.018, HEIGHT],
        [WIDTH / 2 + DEPTH, 0, 0.018, HEIGHT],
        [0, HEIGHT / 2, WIDTH, 0.018],
        [0, -HEIGHT / 2, WIDTH, 0.018],
      ].map((line, index) => (
        <mesh key={index} position={[line[0], line[1], 0]}>
          <boxGeometry args={[line[2], line[3], 0.008]} />
          <meshBasicMaterial color="#8e8272" transparent opacity={0.38} />
        </mesh>
      ))}
    </group>
  );
}

function ReflowRoutes({ visible }) {
  if (!visible) return null;

  return (
    <group position={[0, 0, 0.11]}>
      <mesh position={[2.55, 0.65, 0]}>
        <boxGeometry args={[2.65, 0.018, 0.012]} />
        <meshBasicMaterial color="#2f5fd0" transparent opacity={0.52} />
      </mesh>
      <mesh position={[1.4, -0.5, 0]}>
        <boxGeometry args={[1.3, 0.018, 0.012]} />
        <meshBasicMaterial color="#ba3f34" transparent opacity={0.5} />
      </mesh>

      <Html transform distanceFactor={3.6} position={[3.4, 0.83, 0]} style={{ pointerEvents: 'none' }}>
        <div className="route-label route-blue">COPY → BACK</div>
      </Html>
      <Html transform distanceFactor={3.6} position={[1.75, -0.3, 0]} style={{ pointerEvents: 'none' }}>
        <div className="route-label route-red">CLAIM → FRONT</div>
      </Html>
    </group>
  );
}

export function PackageScene({
  stage,
  market,
  language,
  data,
  claim,
  collision,
  compiled,
}) {
  const paperTexture = useMemo(() => makePaperTexture(), []);
  const { camera } = useThree();

  const rig = useRef();
  const rightHinge = useRef();
  const backHinge = useRef();
  const leftHinge = useRef();
  const topHinge = useRef();
  const bottomHinge = useRef();

  const flat = stage === 'opening' || stage === 'flat';
  const fullyFlat = stage === 'flat';

  useEffect(() => {
    const target = flat
      ? { right: 0, back: 0, left: 0, top: 0, bottom: 0, rx: 0, ry: 0, scale: 0.76 }
      : {
          right: Math.PI / 2,
          back: Math.PI / 2,
          left: -Math.PI / 2,
          top: -Math.PI / 2,
          bottom: Math.PI / 2,
          rx: -0.055,
          ry: -0.26,
          scale: 1,
        };

    const tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } });
    const duration = 1.18;

    if (flat) {
      tl.to([topHinge.current.rotation, bottomHinge.current.rotation], {
        x: 0,
        duration: 0.78,
      }, 0);
      tl.to(leftHinge.current.rotation, { y: 0, duration }, 0.08);
      tl.to(rightHinge.current.rotation, { y: 0, duration }, 0.08);
      tl.to(backHinge.current.rotation, { y: 0, duration }, 0.18);
    } else {
      tl.to(backHinge.current.rotation, { y: target.back, duration: 0.92 }, 0);
      tl.to(rightHinge.current.rotation, { y: target.right, duration }, 0.1);
      tl.to(leftHinge.current.rotation, { y: target.left, duration }, 0.1);
      tl.to(topHinge.current.rotation, { x: target.top, duration: 0.92 }, 0.18);
      tl.to(bottomHinge.current.rotation, { x: target.bottom, duration: 0.92 }, 0.18);
    }

    tl.to(rig.current.rotation, {
      x: target.rx,
      y: target.ry,
      z: 0,
      duration: 1.18,
    }, 0);

    tl.to(rig.current.scale, {
      x: target.scale,
      y: target.scale,
      z: target.scale,
      duration: 1.18,
    }, 0);

    return () => tl.kill();
  }, [flat]);

  useEffect(() => {
    const target = flat
      ? { p: [0.75, 0.4, 10.9], t: [1.15, 0, 0] }
      : collision
        ? { p: [3.55, 1.85, 6.35], t: [0, -0.45, -0.35] }
        : stage === 'valid'
          ? { p: [4.15, 2.35, 7.05], t: [0, 0, -0.45] }
          : { p: [4.8, 2.8, 7.6], t: [0, 0, -0.5] };

    const look = {
      x: target.t[0],
      y: target.t[1],
      z: target.t[2],
    };

    const current = new THREE.Vector3();
    camera.getWorldDirection(current);

    const proxy = { x: look.x, y: look.y, z: look.z };

    gsap.to(camera.position, {
      x: target.p[0],
      y: target.p[1],
      z: target.p[2],
      duration: 1.05,
      ease: 'power3.inOut',
      onUpdate: () => camera.lookAt(proxy.x, proxy.y, proxy.z),
    });

    gsap.to(proxy, {
      x: target.t[0],
      y: target.t[1],
      z: target.t[2],
      duration: 1.05,
      ease: 'power3.inOut',
      onUpdate: () => camera.lookAt(proxy.x, proxy.y, proxy.z),
    });
  }, [flat, collision, stage, camera]);

  useFrame((state) => {
    if (!rig.current || flat || stage === 'closing') return;
    rig.current.position.y = Math.sin(state.clock.elapsedTime * 0.68) * 0.035;
  });

  return (
    <>
      <color attach="background" args={['#eee9df']} />
      <fog attach="fog" args={['#eee9df', 11, 20]} />

      <ambientLight intensity={1.55} />
      <directionalLight
        castShadow
        position={[4.8, 7.5, 5.5]}
        intensity={3.2}
        color="#fff6e6"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-5.5, 2.8, 4]} intensity={1.1} color="#cad9ff" />
      <pointLight position={[0, 1.4, 5.5]} intensity={0.65} color="#fff8ed" />

      <group ref={rig} rotation={[-0.055, -0.26, 0]}>
        <Panel size={[WIDTH, HEIGHT]} texture={paperTexture} label="FRONT / 01">
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
          <div className={'front-claim ' + (claim ? 'show' : '')}>24H<br /><b>HYDRATION</b></div>
          <div className="front-footer"><span>50 mL ℮</span><span>{market === 'EU' ? 'EU' : 'CA'}</span></div>
        </Panel>

        <CollisionFrame active={collision} />

        <group ref={rightHinge} position={[WIDTH / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <group position={[DEPTH / 2, 0, 0]}>
            <Panel size={[DEPTH, HEIGHT]} texture={paperTexture} label="SIDE / DATA">
              <div className="side-title">FORMULA / PRODUCT DATA</div>
              <div className="fake-lines">{Array.from({ length: 7 }).map((_, i) => <i key={i} />)}</div>
              <div className={'qr-grid ' + (data ? 'show' : '')}></div>
              <div className="side-foot">♻︎ &nbsp; ◌ &nbsp; ⊕</div>
            </Panel>
          </group>

          <group ref={backHinge} position={[DEPTH, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <group position={[WIDTH / 2, 0, 0]}>
              <Panel size={[WIDTH, HEIGHT]} texture={paperTexture} label="BACK / 02">
                <div className="back-title">ONE SOURCE.<br />EVERY MARKET.</div>
                <p className="back-copy">
                  Ingredients, directions, disposal and market copy migrate here when the front reaches its limit.
                </p>
                <div className="art-rule"></div>
                <div className="back-foot">MASTER 01 / {market}</div>
              </Panel>
            </group>
          </group>
        </group>

        <group ref={leftHinge} position={[-WIDTH / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <group position={[-DEPTH / 2, 0, 0]}>
            <Panel size={[DEPTH, HEIGHT]} texture={paperTexture} label="SIDE / COPY">
              <div className="side-title">LANGUAGE</div>
              <div className={'vertical-copy ' + (language ? 'show' : '')}>FR / EN<br />CONTENT<br />FIELD</div>
            </Panel>
          </group>
        </group>

        <group ref={topHinge} position={[0, HEIGHT / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <group position={[0, DEPTH / 2, 0]}>
            <Panel size={[WIDTH, DEPTH]} texture={paperTexture} label="TOP">
              <div className="flap-copy">NORD / MASTER / {market}</div>
            </Panel>
          </group>
        </group>

        <group ref={bottomHinge} position={[0, -HEIGHT / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <group position={[0, -DEPTH / 2, 0]}>
            <Panel size={[WIDTH, DEPTH]} texture={paperTexture} label="BOTTOM">
              <div className="flap-copy">PACKSHIFT / COMPILED SURFACE</div>
            </Panel>
          </group>
        </group>

        <FoldGuides visible={fullyFlat} />
        <ReflowRoutes visible={fullyFlat} />
      </group>

      <ConstraintCard
        kind="language"
        active={language}
        stage={stage}
        compiled={compiled}
        color="#22201b"
        position={[-2.75, 0.7, 0.95]}
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
        position={[2.8, 0.75, 0.85]}
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
        position={[0, -0.72, 1.05]}
      >
        <span className="cc-index">03</span>
        <b>24H HYDRATION</b>
        <small>CLAIM WANTS THE FRONT</small>
      </ConstraintCard>

      <ContactShadows
        position={[0, -2.08, -0.45]}
        opacity={0.22}
        scale={10}
        blur={2.5}
        far={6}
      />
    </>
  );
}
