'use client';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { AuditoriumLayout } from '@/types';
import { getRowPlatform } from '@/lib/geometry';
import { getMaterials } from './materials';

const TILE = 1.6; // carpet texture tile size (m)

/** Box whose UVs are scaled to world metres so tiled textures keep a constant size. */
function worldUvBox(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // Face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const faceDims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * faceDims[f][0]) / TILE, (uv.getY(i) * faceDims[f][1]) / TILE);
    }
  }
  return g;
}

/**
 * Floor: flat front floor, a low stage below the screen, and one stadium
 * platform per row (rows rise by `rowRise`). The last platform extends to the
 * back wall as the cross aisle.
 */
export function Floor({ layout }: { layout: AuditoriumLayout }) {
  const mats = getMaterials();
  const { width, frontWallZ, backWallZ, screen, config } = layout;

  const parts = useMemo(() => {
    const list: { geo: THREE.BufferGeometry; pos: [number, number, number]; kind: 'floor' | 'stage' | 'riser' }[] = [];
    // Base floor (y = 0) for the whole room.
    const len = backWallZ - frontWallZ;
    list.push({ geo: worldUvBox(width, 0.02, len), pos: [0, -0.01, frontWallZ + len / 2], kind: 'floor' });

    // Stage below the screen.
    const row0 = getRowPlatform(0, config);
    const stageDepth = Math.min(1.4, row0.zStart - 1.0 - frontWallZ - screen.sagitta);
    const stageH = Math.min(0.45, screen.bottom * 0.5);
    if (stageDepth > 0.4 && stageH > 0.08) {
      list.push({
        geo: worldUvBox(Math.min(width, screen.width + 1.2), stageH, stageDepth),
        pos: [0, stageH / 2, frontWallZ + stageDepth / 2], kind: 'stage',

      });
    }

    // Stadium risers.
    for (let r = 1; r < config.rows; r++) {
      const h = layout.rowFloorY[r];
      if (h <= 0.001) continue;
      const p = getRowPlatform(r, config);
      const zEnd = r === config.rows - 1 ? backWallZ : p.zEnd;
      const depth = zEnd - p.zStart;
      list.push({ geo: worldUvBox(width, h, depth), pos: [0, h / 2, p.zStart + depth / 2], kind: 'riser' });
    }
    return list;
  }, [layout, width, frontWallZ, backWallZ, screen, config]);

  useEffect(() => () => parts.forEach((p) => p.geo.dispose()), [parts]);

  // Top face carpet, other faces dark riser.
  const riserMats = useMemo(
    () => [mats.riser, mats.riser, mats.floor, mats.riser, mats.riser, mats.riser],
    [mats],
  );

  return (
    <group>
      {parts.map((p, i) => (
        <mesh
          key={i}
          geometry={p.geo}
          position={p.pos}
          material={p.kind === 'riser' ? riserMats : p.kind === 'stage' ? mats.stage : mats.floor}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}
