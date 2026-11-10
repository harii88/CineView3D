'use client';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { AuditoriumLayout } from '@/types';
import { getSectionBoundaries, getSeatPitch, describeSeat } from '@/lib/geometry';
import { useViewer } from '@/store/viewerStore';
import { getSeatScores, scoreColor } from '@/hooks/useSeatScores';
import { createSeatGeometries, disposeSeatGeometries } from './Seat';
import { getMaterials } from './materials';

const COLORS = {
  base: new THREE.Color('#8e1b2e'),
  selected: new THREE.Color('#f5c451'),
  best: new THREE.Color('#1fae84'),
  compare: new THREE.Color('#4c9dff'),
  hover: new THREE.Color('#d34b62'),
};

/**
 * All seats rendered as 4 instanced meshes (cushion, back, arm, base). Instance
 * i of the cushion/back/base meshes is layout.seats[i], so a raycast hit maps
 * straight back to a seat.
 */
export function SeatGrid({ layout }: { layout: AuditoriumLayout }) {
  const dims = layout.config.dimensions;
  const n = layout.seats.length;
  const detail = n > 900 ? 'low' : 'high';
  const geos = useMemo(() => createSeatGeometries(dims, detail), [dims, detail]);
  useEffect(() => () => disposeSeatGeometries(geos), [geos]);
  const mats = getMaterials();

  const cushionRef = useRef<THREE.InstancedMesh>(null);
  const backRef = useRef<THREE.InstancedMesh>(null);
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const armRef = useRef<THREE.InstancedMesh>(null);

  // Arms sit in the gaps between seats; each block gets one extra arm at its right end.
  const arms = useMemo(() => {
    const out: THREE.Vector3[] = [];
    const pitch = getSeatPitch(layout.config);
    const bounds = getSectionBoundaries(layout.config.seatsPerRow, layout.config.sections);
    const lastInSection = new Set(bounds.slice(1).map((b) => b - 1));
    for (const seat of layout.seats) {
      const p = seat.position;
      out.push(new THREE.Vector3(p.x - pitch / 2, p.y, p.z));
      if (lastInSection.has(seat.seat)) out.push(new THREE.Vector3(p.x + pitch / 2, p.y, p.z));
    }
    return out;
  }, [layout]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    for (const ref of [cushionRef, backRef, baseRef]) {
      const mesh = ref.current;
      if (!mesh) continue;
      layout.seats.forEach((s, i) => {
        m.makeTranslation(s.position.x, s.position.y, s.position.z);
        mesh.setMatrixAt(i, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.computeBoundingBox();
    }
    const armMesh = armRef.current;
    if (armMesh) {
      arms.forEach((a, i) => {
        m.makeTranslation(a.x, a.y, a.z);
        armMesh.setMatrixAt(i, m);
      });
      armMesh.instanceMatrix.needsUpdate = true;
      armMesh.computeBoundingSphere();
    }
  }, [layout, arms, geos]);

  const selected = useViewer((s) => s.selected);
  const hovered = useViewer((s) => s.hovered);
  const comparison = useViewer((s) => s.comparison);
  const bestSeats = useViewer((s) => s.bestSeats);
  const showBest = useViewer((s) => s.showBest);
  const heatmap = useViewer((s) => s.heatmap);

  useLayoutEffect(() => {
    const spr = layout.config.seatsPerRow;
    const idx = (s: { row: number; seat: number }) => s.row * spr + s.seat;
    const best = new Set(showBest ? bestSeats : []);
    const compare = new Set(comparison.map(idx));
    const scores = heatmap ? getSeatScores(layout) : null;
    const c = new THREE.Color();
    for (const ref of [cushionRef, backRef]) {
      const mesh = ref.current;
      if (!mesh) continue;
      layout.seats.forEach((s, i) => {
        if (selected && idx(selected) === i) c.copy(COLORS.selected);
        else if (compare.has(i)) c.copy(COLORS.compare);
        else if (best.has(s.label)) c.copy(COLORS.best);
        else if (scores) c.set(scoreColor(scores[i].score));
        else c.copy(COLORS.base);
        if (hovered && idx(hovered) === i) c.lerp(COLORS.hover, 0.45).multiplyScalar(1.25);
        mesh.setColorAt(i, c);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [layout, selected, hovered, comparison, bestSeats, showBest, heatmap, geos]);

  const setHovered = useViewer((s) => s.setHovered);
  const selectSeat = useViewer((s) => s.selectSeat);

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.instanceId === undefined) return;
    const s = layout.seats[e.instanceId];
    if (s) setHovered({ row: s.row, seat: s.seat });
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    setHovered(null);
    document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6 || e.instanceId === undefined) return; // it was a drag, not a click
    const s = layout.seats[e.instanceId];
    if (s) selectSeat({ row: s.row, seat: s.seat });
  };

  const key = `${n}-${detail}-${arms.length}`;
  const hoveredSeat = hovered ? layout.seats[hovered.row * layout.config.seatsPerRow + hovered.seat] : null;

  return (
    <group>
      <instancedMesh
        key={`c${key}`}
        ref={cushionRef}
        args={[geos.cushion, mats.seatFabric, n]}
        onPointerMove={onMove}
        onPointerOut={onOut}
        onClick={onClick}
      />
      <instancedMesh
        key={`b${key}`}
        ref={backRef}
        args={[geos.back, mats.seatFabric, n]}
        onPointerMove={onMove}
        onPointerOut={onOut}
        onClick={onClick}
      />
      <instancedMesh key={`s${key}`} ref={baseRef} args={[geos.base, mats.seatFrame, n]} raycast={() => null} />
      <instancedMesh key={`a${key}`} ref={armRef} args={[geos.arm, mats.seatFrame, arms.length]} raycast={() => null} />
      {hoveredSeat && (
        <Html
          position={[hoveredSeat.position.x, hoveredSeat.position.y + dims.backrestHeight + 0.35, hoveredSeat.position.z]}
          center
          zIndexRange={[20, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="whitespace-nowrap rounded-lg border border-white/15 bg-black/75 px-2.5 py-1 text-xs font-medium text-white shadow-lg backdrop-blur">
            {describeSeat(hoveredSeat.row, hoveredSeat.seat)}
          </div>
        </Html>
      )}
    </group>
  );
}
