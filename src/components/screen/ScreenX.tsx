'use client';
import { useEffect, useMemo } from 'react';
import type * as THREE from 'three';
import type { AuditoriumLayout } from '@/types';
import { MainScreenSurface, Masking } from './StandardScreen';
import { buildRibbon } from './surfaceGeometry';

/**
 * ScreenX: the main screen plus continuous projection surfaces that curve
 * from the screen edges into the side walls and run back along them, so the
 * picture wraps around the audience (~270° from central seats).
 *
 * The geometry comes from lib/geometry/screenGeometry.ts (buildScreenXStrips);
 * content continuity comes from the shared panoramic P coordinate.
 */
export function ScreenX({ layout, material }: { layout: AuditoriumLayout; material: THREE.Material }) {
  const { screen } = layout;
  const strips = useMemo(
    () => screen.sideStrips.map((s) => ({ side: s.side, geo: buildRibbon(s.samples, screen, s.side === 'left') })),
    [screen],
  );
  useEffect(() => () => strips.forEach((s) => s.geo.dispose()), [strips]);
  return (
    <group>
      <MainScreenSurface layout={layout} material={material} />
      <Masking layout={layout} border={0.25} sides={false} />
      {strips.map((s) => (
        <mesh key={s.side} geometry={s.geo} material={material} raycast={() => null} />
      ))}
    </group>
  );
}
