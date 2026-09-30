import React, { Component, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { PackageScene } from '../scene/PackageScene.jsx';

// The 3D carton for the game. Loaded lazily so the intro paints instantly
// and three.js only downloads once someone presses "Jouer".
class Boundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function GameScene(props) {
  return (
    <Canvas
      shadows
      flat
      dpr={[1, 1.75]}
      camera={{ position: [4.6, 2.6, 7.3], fov: 34, near: 0.1, far: 80 }}
      // preserveDrawingBuffer lets the share card grab a snapshot of the box.
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      aria-label="La boîte en 3D. Tu peux aussi y déposer une étiquette."
    >
      <Suspense fallback={null}>
        <Boundary fallback={<PackageScene procedural {...props} />}>
          <PackageScene {...props} />
        </Boundary>
      </Suspense>
    </Canvas>
  );
}
