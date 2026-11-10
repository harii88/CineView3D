'use client';
import { Component, type ReactNode, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { useAuditorium } from '@/store/auditoriumStore';
import { Auditorium } from '@/components/auditorium/Auditorium';
import { CameraController } from '@/components/camera/CameraController';
import { CAMERA_DEFAULTS } from '@/lib/config/defaults';

class SceneErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <SceneMessage title="The 3D view stopped working">
          {this.state.error.message || 'An unexpected rendering error occurred.'}
          <button
            className="mt-4 rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </SceneMessage>
      );
    }
    return this.props.children;
  }
}

function SceneMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="alert" className="flex h-full w-full flex-col items-center justify-center p-8 text-center text-white/80">
      <p className="text-lg font-semibold text-white">{title}</p>
      <div className="mt-2 max-w-md text-sm">{children}</div>
    </div>
  );
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function SceneContents() {
  const layout = useAuditorium((s) => s.layout);
  return (
    <>
      <color attach="background" args={['#040306']} />
      <Auditorium layout={layout} />
      <CameraController layout={layout} />
    </>
  );
}

export default function Scene() {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [dpr, setDpr] = useState(1.5);
  useEffect(() => setWebgl(hasWebGL()), []);
  if (webgl === null) return null;
  if (!webgl) {
    return (
      <SceneMessage title="WebGL is not available">
        CineView 3D needs WebGL to render the auditorium. Enable hardware acceleration in your browser settings or try a
        different browser.
      </SceneMessage>
    );
  }
  return (
    <SceneErrorBoundary>
      <Canvas
        dpr={dpr}
        gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
        camera={{ fov: CAMERA_DEFAULTS.fov, near: 0.05, far: 600, position: [10, 12, 30] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        aria-label="3D cinema auditorium view"
        role="img"
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))} />
        <AdaptiveDpr pixelated={false} />
        <SceneContents />
      </Canvas>
    </SceneErrorBoundary>
  );
}
