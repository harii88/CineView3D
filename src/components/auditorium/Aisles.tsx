'use client';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { AuditoriumLayout } from '@/types';
import { getRowPlatform } from '@/lib/geometry';
import { getMaterials } from './materials';

/**
 * Aisle step lights: a small warm LED strip on the nosing of every riser in
 * every aisle, plus low floor markers along the flat front section.
 */
export function Aisles({ layout }: { layout: AuditoriumLayout }) {
  const mats = getMaterials();
  const ref = useRef<THREE.InstancedMesh>(null);

  const lights = useMemo(() => {
    const out: { x: number; y: number; z: number; w: number }[] = [];
    for (const aisle of layout.aisles) {
      const aw = aisle.xMax - aisle.xMin;
      if (aw < 0.3) continue;
      // Light the walking line of the aisle, not the whole side gap.
      const cx = aisle.kind === 'side' ? (aisle.xMin < 0 ? aisle.xMax - 0.6 : aisle.xMin + 0.6) : (aisle.xMin + aisle.xMax) / 2;
      const w = Math.min(0.5, aw * 0.6);
      for (let r = 1; r < layout.config.rows; r++) {
        if (layout.rowFloorY[r] <= 0.001) continue;
        const p = getRowPlatform(r, layout.config);
        out.push({ x: cx, y: layout.rowFloorY[r] - 0.04, z: p.zStart - 0.005, w });
      }
      // Floor markers in the flat front area.
      const row0 = getRowPlatform(0, layout.config);
      for (let z = row0.zEnd; z > layout.frontWallZ + 2; z -= 1.5) {
        out.push({ x: cx, y: 0.005, z, w: 0.08 });
      }
    }
    return out;
  }, [layout]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    lights.forEach((l, i) => {
      m.makeScale(l.w, 1, 1).setPosition(l.x, l.y, l.z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [lights]);

  if (lights.length === 0) return null;
  return (
    <instancedMesh key={lights.length} ref={ref} args={[undefined, mats.stepLight, lights.length]} raycast={() => null}>
      <boxGeometry args={[1, 0.025, 0.03]} />
    </instancedMesh>
  );
}
