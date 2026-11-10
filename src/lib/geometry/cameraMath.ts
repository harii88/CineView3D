import type { AuditoriumLayout, Vec3 } from '@/types';
import { getFloorHeightAt } from './seatPosition';

/**
 * CAMERA MODEL
 * Orientation is expressed as yaw/pitch (radians, Euler order 'YXZ'):
 *   yaw   – rotation about +y; 0 looks down -z (at the screen), + turns LEFT.
 *   pitch – rotation about the camera x axis; + looks UP.
 * A camera with yaw ψ and pitch θ looks along
 *   (-sin ψ cos θ, sin θ, -cos ψ cos θ).
 */

export function directionToYawPitch(from: Vec3, to: Vec3): { yaw: number; pitch: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

export function yawPitchToDirection(yaw: number, pitch: number): Vec3 {
  return { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Shortest-path angle interpolation. */
export function lerpAngle(a: number, b: number, t: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function quadraticBezier(p0: Vec3, c: Vec3, p1: Vec3, t: number): Vec3 {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
    z: u * u * p0.z + 2 * u * t * c.z + t * t * p1.z,
  };
}

/**
 * Plan a smooth move through the auditorium: a quadratic Bézier lifted above
 * both endpoints (so the camera glides over seat backs rather than through
 * them) with a distance-dependent duration of 1–2 s.
 */
export function planTransition(from: Vec3, to: Vec3, reducedMotion = false, maxY = Infinity) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const lift = Math.min(3, 0.4 + dist * 0.18);
  const control = {
    x: (from.x + to.x) / 2,
    y: Math.min(maxY, Math.max(from.y, to.y) + lift),
    z: (from.z + to.z) / 2,
  };
  const duration = reducedMotion ? 0 : dist < 0.01 ? 0.35 : Math.min(2, Math.max(1, 0.9 + dist * 0.05));
  return { control, duration };
}

/** Elevated three-quarter "cut-away model" view of the whole auditorium. */
export function getOverviewPose(layout: AuditoriumLayout) {
  const midRow = Math.floor((layout.config.rows - 1) / 2);
  const target: Vec3 = {
    x: 0,
    y: (layout.rowFloorY[midRow] ?? 0) + 0.6,
    z: layout.frontWallZ + layout.length * 0.45,
  };
  const dist = Math.max(layout.width, layout.length, layout.height * 1.5) * 1.15 + 4;
  const az = 0.55;
  const el = 0.72;
  const position: Vec3 = {
    x: target.x + Math.sin(az) * Math.cos(el) * dist,
    y: target.y + Math.sin(el) * dist,
    z: target.z + Math.cos(az) * Math.cos(el) * dist,
  };
  return { position, target, ...directionToYawPitch(position, target) };
}

/** Standing position at the back of the room, used when entering explore mode without a seat. */
export function getExploreStart(layout: AuditoriumLayout): Vec3 {
  const z = layout.backWallZ - 0.8;
  return { x: 0, y: getFloorHeightAt(z, layout.config) + 1.7, z };
}

/** Keep a free-roaming camera inside the room and above the stadium floor. */
export function clampToRoom(p: Vec3, layout: AuditoriumLayout): Vec3 {
  const m = 0.25;
  const x = Math.min(layout.width / 2 - m, Math.max(-layout.width / 2 + m, p.x));
  const z = Math.min(layout.backWallZ - m, Math.max(layout.frontWallZ + m, p.z));
  const floor = getFloorHeightAt(z, layout.config);
  const y = Math.min(layout.height - 0.2, Math.max(floor + 0.4, p.y));
  return { x, y, z };
}
