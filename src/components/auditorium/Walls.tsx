'use client';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { AuditoriumLayout } from '@/types';
import { getFloorHeightAt } from '@/lib/geometry';
import { getMaterials } from './materials';

const PANEL = 2.4; // acoustic wall panel size (m)

/**
 * Room shell. Every surface is single-sided and faces inward, so from the
 * outside (overview mode) the near walls and ceiling are culled and you can
 * look into the auditorium like a cut-away model.
 */
export function Walls({ layout }: { layout: AuditoriumLayout }) {
  const mats = getMaterials();
  const { width: W, height: H, frontWallZ, backWallZ } = layout;
  const L = backWallZ - frontWallZ;
  const midZ = frontWallZ + L / 2;

  const wallMats = useMemo(() => {
    const make = (len: number) => {
      const m = mats.wall.clone();
      const t = mats.fabric.clone();
      t.repeat.set(len / PANEL, H / PANEL);
      t.needsUpdate = true;
      m.map = t;
      return m;
    };
    return { side: make(L), back: make(W) };
  }, [mats, L, W, H]);
  useEffect(
    () => () => {
      wallMats.side.map?.dispose();
      wallMats.side.dispose();
      wallMats.back.map?.dispose();
      wallMats.back.dispose();
    },
    [wallMats],
  );

  return (
    <group>
      {/* Left wall (faces +x) */}
      <mesh position={[-W / 2, H / 2, midZ]} rotation={[0, Math.PI / 2, 0]} material={wallMats.side}>
        <planeGeometry args={[L, H]} />
      </mesh>
      {/* Right wall (faces -x) */}
      <mesh position={[W / 2, H / 2, midZ]} rotation={[0, -Math.PI / 2, 0]} material={wallMats.side}>
        <planeGeometry args={[L, H]} />
      </mesh>
      {/* Back wall (faces -z) */}
      <mesh position={[0, H / 2, backWallZ]} rotation={[0, Math.PI, 0]} material={wallMats.back}>
        <planeGeometry args={[W, H]} />
      </mesh>
      {/* Front wall behind the screen (faces +z) */}
      <mesh position={[0, H / 2, frontWallZ]} material={mats.frontWall}>
        <planeGeometry args={[W, H]} />
      </mesh>
      {/* Ceiling (faces down) */}
      <mesh position={[0, H, midZ]} rotation={[Math.PI / 2, 0, 0]} material={mats.ceiling}>
        <planeGeometry args={[W, L]} />
      </mesh>
      <CeilingLights layout={layout} />
      <WallSconces layout={layout} />
      {/* Projection booth window in the back wall */}
      <mesh position={[0, Math.min(H - 0.6, layout.rowFloorY[layout.rowFloorY.length - 1] + 2.9), backWallZ - 0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.9, 0.45]} />
        <meshBasicMaterial color="#9fb7ff" toneMapped={false} />
      </mesh>
    </group>
  );
}

function CeilingLights({ layout }: { layout: AuditoriumLayout }) {
  const mats = getMaterials();
  const ref = useRef<THREE.InstancedMesh>(null);
  const points = useMemo(() => {
    const pts: [number, number][] = [];
    const spacing = 3.2;
    const nx = Math.max(1, Math.floor((layout.width - 1) / spacing));
    const nz = Math.max(1, Math.floor((layout.backWallZ - layout.frontWallZ - 2) / spacing));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        pts.push([(i - (nx - 1) / 2) * spacing, layout.frontWallZ + 2 + (j + 0.5) * spacing]);
      }
    }
    return pts;
  }, [layout]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const rot = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    points.forEach(([x, z], i) => {
      m.makeTranslation(x, layout.height - 0.01, z).multiply(rot);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [points, layout.height]);
  return (
    <instancedMesh key={points.length} ref={ref} args={[undefined, mats.ceilingLight, points.length]} raycast={() => null}>
      <circleGeometry args={[0.09, 12]} />
    </instancedMesh>
  );
}

function WallSconces({ layout }: { layout: AuditoriumLayout }) {
  const mats = getMaterials();
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    const out: { x: number; y: number; z: number; ry: number }[] = [];
    const start = layout.frontWallZ + 3;
    const end = layout.backWallZ - 1;
    const isScreenX = layout.screen.sideStrips.length > 0;
    const stripEnd = isScreenX ? Math.max(...layout.screen.sideStrips[0].samples.map((s) => s.z)) : -Infinity;
    for (let z = start; z < end; z += 3.5) {
      if (z < stripEnd + 0.5) continue; // keep ScreenX projection surfaces clear
      const y = Math.min(layout.height - 0.4, getFloorHeightAt(z, layout.config) + 2.3);
      out.push({ x: -layout.width / 2 + 0.03, y, z, ry: Math.PI / 2 });
      out.push({ x: layout.width / 2 - 0.03, y, z, ry: -Math.PI / 2 });
    }
    return out;
  }, [layout]);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach((it, i) => {
      q.setFromEuler(new THREE.Euler(0, it.ry, 0));
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  if (items.length === 0) return null;
  return (
    <instancedMesh key={items.length} ref={ref} args={[undefined, mats.sconce, items.length]} raycast={() => null}>
      <boxGeometry args={[0.35, 0.12, 0.04]} />
    </instancedMesh>
  );
}
