'use client';
import type * as THREE from 'three';
import type { AuditoriumLayout } from '@/types';
import { MainScreenSurface, Masking } from './StandardScreen';

/**
 * IMAX: a large, tall, gently curved screen that reaches close to the floor
 * and ceiling, with a broad black surround instead of curtains. All of its
 * dimensions come from the (configurable) IMAX screen settings.
 */
export function IMAXScreen({ layout, material }: { layout: AuditoriumLayout; material: THREE.Material }) {
  const { screen, height } = layout;
  const border = Math.max(0.2, Math.min(0.8, height - screen.top - 0.05));
  return (
    <group>
      <MainScreenSurface layout={layout} material={material} />
      <Masking layout={layout} border={border} sides />
      {/* Thin silver frame line that catches light from the image */}
      <mesh position={[0, screen.top + 0.03, screen.sagitta * 0.02 + 0.01]} raycast={() => null}>
        <boxGeometry args={[Math.min(screen.width, 2 * screen.radius) * 0.98, 0.02, 0.02]} />
        <meshStandardMaterial color="#6d6f78" metalness={0.8} roughness={0.35} />
      </mesh>
    </group>
  );
}
