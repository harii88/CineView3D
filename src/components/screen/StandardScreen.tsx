'use client';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { AuditoriumLayout } from '@/types';
import { getMaterials } from '@/components/auditorium/materials';
import { arcSamples, buildMasking, buildRibbon } from './surfaceGeometry';

/** Main screen surface (flat or curved) shared by every screen type. */
export function MainScreenSurface({ layout, material }: { layout: AuditoriumLayout; material: THREE.Material }) {
  const { screen } = layout;
  const geo = useMemo(() => buildRibbon(arcSamples(screen, 0, 1, screen.bottom, screen.top), screen), [screen]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={material} raycast={() => null} />;
}

export function Masking({ layout, border, sides }: { layout: AuditoriumLayout; border: number; sides: boolean }) {
  const mats = getMaterials();
  const geos = useMemo(() => buildMasking(layout.screen, border, sides), [layout.screen, border, sides]);
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos]);
  return (
    <group>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.masking} raycast={() => null} />
      ))}
    </group>
  );
}

/** Pleated velvet curtain hanging beside the screen. */
function Curtain({ width, height, position }: { width: number; height: number; position: [number, number, number] }) {
  const mats = getMaterials();
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(width, height, Math.max(8, Math.round(width * 24)), 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 26) * 0.05);
    g.computeVertexNormals();
    return g;
  }, [width, height]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={mats.curtain} position={position} raycast={() => null} />;
}

/** Standard multiplex screen: black masking border and side curtains. */
export function StandardScreen({ layout, material }: { layout: AuditoriumLayout; material: THREE.Material }) {
  const { screen, width: roomW, height: roomH } = layout;
  const curtainW = Math.min(1.6, (roomW - screen.width) / 2 - 0.35);
  const curtainH = Math.min(roomH - 0.1, screen.top + 0.6);
  return (
    <group>
      <MainScreenSurface layout={layout} material={material} />
      <Masking layout={layout} border={0.3} sides />
      {curtainW > 0.25 && (
        <>
          <Curtain
            width={curtainW}
            height={curtainH}
            position={[-(screen.width / 2 + 0.35 + curtainW / 2), curtainH / 2, screen.sagitta + 0.15]}
          />
          <Curtain
            width={curtainW}
            height={curtainH}
            position={[screen.width / 2 + 0.35 + curtainW / 2, curtainH / 2, screen.sagitta + 0.15]}
          />
        </>
      )}
    </group>
  );
}
