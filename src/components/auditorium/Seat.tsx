import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AuditoriumDimensions } from '@/types';

/**
 * Seat model, in seat-local space:
 *   origin = centre of the seat footprint on the row platform,
 *   the seat faces -z (towards the screen), the backrest is on the +z side.
 *
 * The model is split into parts so each can be rendered as one InstancedMesh:
 *   cushion  – upholstered seat pan
 *   back     – upholstered, slightly reclined backrest
 *   arm      – armrest + side standard (one per gap between seats, plus ends)
 *   base     – pedestal under the seat pan
 *
 * `detail` lowers the rounding segments for very large auditoriums.
 */
export interface SeatGeometries {
  cushion: THREE.BufferGeometry;
  back: THREE.BufferGeometry;
  arm: THREE.BufferGeometry;
  base: THREE.BufferGeometry;
}

export function createSeatGeometries(d: AuditoriumDimensions, detail: 'high' | 'low'): SeatGeometries {
  const seg = detail === 'high' ? 3 : 1;
  const w = d.seatWidth * 0.94;

  const cushionH = 0.13;
  const cushion = new RoundedBoxGeometry(w, cushionH, d.seatDepth * 0.82, seg, 0.04);
  cushion.translate(0, d.seatHeight - cushionH / 2, -d.seatDepth * 0.06);

  const backH = Math.max(0.3, d.backrestHeight - d.seatHeight + 0.04);
  const back = new RoundedBoxGeometry(w, backH, 0.13, seg, 0.05);
  back.translate(0, backH / 2, 0);
  back.rotateX(0.14); // recline: top moves back towards +z
  back.translate(0, d.seatHeight - 0.04, d.seatDepth / 2 - 0.09);

  const armW = Math.max(0.05, Math.min(0.1, d.seatSpacing + 0.04));
  const armTop = Math.min(d.seatHeight + 0.22, d.backrestHeight - 0.1);
  const rest = new RoundedBoxGeometry(armW, 0.05, d.seatDepth * 0.78, seg, 0.02);
  rest.translate(0, armTop, -d.seatDepth * 0.04);
  const standard = new THREE.BoxGeometry(armW * 0.7, armTop, d.seatDepth * 0.55);
  standard.translate(0, armTop / 2, d.seatDepth * 0.08);
  const flat = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);
  const arm = mergeGeometries([flat(rest), flat(standard)])!;
  rest.dispose();
  standard.dispose();

  const baseH = d.seatHeight - cushionH;
  const base = new THREE.BoxGeometry(w * 0.45, baseH, d.seatDepth * 0.3);
  base.translate(0, baseH / 2, d.seatDepth * 0.05);

  return { cushion, back, arm, base };
}

export function disposeSeatGeometries(g: SeatGeometries) {
  g.cushion.dispose();
  g.back.dispose();
  g.arm.dispose();
  g.base.dispose();
}
