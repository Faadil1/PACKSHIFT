import React, { useEffect, useMemo, useRef } from 'react';
import { Edges, Html, OrbitControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';

const WIDTH = 2.4;
const HEIGHT = 3.5;
const DEPTH = 1.2;

const FOLDED = {
  front:  { p:[0, 0, DEPTH / 2], r:[0, 0, 0] },
  back:   { p:[0, 0, -DEPTH / 2], r:[0, Math.PI, 0] },
  left:   { p:[-WIDTH / 2, 0, 0], r:[0, -Math.PI / 2, 0] },
  right:  { p:[WIDTH / 2, 0, 0], r:[0, Math.PI / 2, 0] },
  top:    { p:[0, HEIGHT / 2, 0], r:[-Math.PI / 2, 0, 0] },
  bottom: { p:[0, -HEIGHT / 2, 0], r:[Math.PI / 2, 0, 0] },
};

const FLAT = {
  left:   { p:[-(WIDTH / 2 + DEPTH / 2), 0, 0], r:[0,0,0] },
  front:  { p:[0,0,0], r:[0,0,0] },
  right:  { p:[WIDTH / 2 + DEPTH / 2,0,0], r:[0,0,0] },
  back:   { p:[WIDTH + DEPTH,0,0], r:[0,0,0] },
  top:    { p:[0,HEIGHT / 2 + DEPTH / 2,0], r:[0,0,0] },
  bottom: { p:[0,-(HEIGHT / 2 + DEPTH / 2),0], r:[0,0,0] },
};

const PANEL_SIZES = {
  front:[WIDTH,HEIGHT],
  back:[WIDTH,HEIGHT],
  left:[DEPTH,HEIGHT],
  right:[DEPTH,HEIGHT],
  top:[WIDTH,DEPTH],
  bottom:[WIDTH,DEPTH],
};

function PaperPanel({ name, panelRef, label, children }) {
  const [w,h] = PANEL_SIZES[name];

  return (
    <group ref={panelRef}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w,h,0.045]} />
        <meshStandardMaterial color="#eee5d5" roughness={0.94} metalness={0} />
        <Edges color="#3a342d" transparent opacity={0.28} />
      </mesh>

      <Html
        transform
        sprite={false}
        distanceFactor={3.2}
        position={[0,0,0.03]}
        style={{ pointerEvents:'none' }}
      >
        <div className={'panel-art panel-art-' + name}>
          <span className="panel-tag">{label}</span>
          {children}
        </div>
      </Html>
    </group>
  );
}

export function PackageScene({ phase, market, onFlat, onFolded }) {
  const rig = useRef();
  const refs = {
    front: useRef(),
    back: useRef(),
    left: useRef(),
    right: useRef(),
    top: useRef(),
    bottom: useRef(),
  };

  const keys = useMemo(() => Object.keys(refs), []);

  useEffect(() => {
    keys.forEach((key) => {
      const node = refs[key].current;
      if (!node) return;
      node.position.set(...FOLDED[key].p);
      node.rotation.set(...FOLDED[key].r);
    });
  }, []);

  useEffect(() => {
    if (phase !== 'unfolding' && phase !== 'refolding') return;
    if (!rig.current || !refs.front.current) return;

    const destination = phase === 'unfolding' ? FLAT : FOLDED;
    const timeline = gsap.timeline({
      defaults:{ duration:1.25, ease:'power3.inOut' },
      onComplete:() => {
        if (phase === 'unfolding') onFlat?.();
        if (phase === 'refolding') onFolded?.();
      },
    });

    keys.forEach((key,index) => {
      const node = refs[key].current;
      const target = destination[key];

      timeline.to(node.position,{
        x:target.p[0],
        y:target.p[1],
        z:target.p[2],
      },index === 0 ? 0 : '<0.05');

      timeline.to(node.rotation,{
        x:target.r[0],
        y:target.r[1],
        z:target.r[2],
      },'<');
    });

    timeline.to(rig.current.rotation,{
      x:phase === 'unfolding' ? 0 : -0.05,
      y:phase === 'unfolding' ? 0 : -0.24,
      z:0,
      duration:1.35,
    },0);

    timeline.to(rig.current.scale,{
      x:phase === 'unfolding' ? 0.74 : 1,
      y:phase === 'unfolding' ? 0.74 : 1,
      z:phase === 'unfolding' ? 0.74 : 1,
      duration:1.35,
    },0);

    return () => timeline.kill();
  },[phase]);

  useFrame((state) => {
    if (!rig.current || phase !== 'folded') return;
    rig.current.position.y = Math.sin(state.clock.elapsedTime * 0.7) * 0.035;
  });

  return (
    <>
      <ambientLight intensity={1.7} />
      <directionalLight
        castShadow
        position={[4.5,7,5]}
        intensity={3.4}
        color="#fff7e8"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-5,2,4]} intensity={1.2} color="#cddcff" />

      <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,-2.65,0]}>
        <planeGeometry args={[18,14]} />
        <shadowMaterial transparent opacity={0.11} />
      </mesh>

      <group ref={rig} rotation={[-0.05,-0.24,0]}>
        <PaperPanel name="front" panelRef={refs.front} label="FRONT / 01">
          <div className="front-brand">NORD</div>
          <div className="front-title">OAT<br/>MILK</div>
          <div className="front-variant">BARISTA</div>
          <div className="art-rule"></div>
          <div className="front-copy">Smooth &amp; creamy<br/>Plant-based<br/>No added sugar</div>
          <div className="front-footer"><span>1 L ℮</span><span>{market === 'EU' ? 'EU' : 'CA'}</span></div>
        </PaperPanel>

        <PaperPanel name="right" panelRef={refs.right} label="SIDE / DATA">
          <div className="side-title">PRODUCT DATA</div>
          <div className="fake-lines">{Array.from({length:7}).map((_,i)=><i key={i}/>)}</div>
          <div className="qr-grid"></div>
          <div className="side-foot">♻︎ &nbsp; ◌ &nbsp; ⊕</div>
        </PaperPanel>

        <PaperPanel name="left" panelRef={refs.left} label="SIDE / COPY">
          <div className="side-title">LANGUAGE</div>
          <div className="vertical-copy">FR / EN<br/>CONTENT<br/>FIELD</div>
        </PaperPanel>

        <PaperPanel name="back" panelRef={refs.back} label="BACK / 02">
          <div className="back-title">ONE SOURCE.<br/>EVERY MARKET.</div>
          <p className="back-copy">Ingredients, disposal, claims and market copy can migrate here when the front reaches its limit.</p>
          <div className="art-rule"></div>
          <div className="back-foot">MASTER 01 / {market}</div>
        </PaperPanel>

        <PaperPanel name="top" panelRef={refs.top} label="TOP">
          <div className="flap-copy">NORD / MASTER</div>
        </PaperPanel>

        <PaperPanel name="bottom" panelRef={refs.bottom} label="BOTTOM">
          <div className="flap-copy">PACKSHIFT / COMPILED SURFACE</div>
        </PaperPanel>
      </group>

      <OrbitControls
        enabled={phase === 'flat'}
        enablePan={false}
        minDistance={6}
        maxDistance={13}
        minPolarAngle={0.55}
        maxPolarAngle={1.65}
      />
    </>
  );
}
