import type { AuditoriumLayout, SeatInfo, SurfaceSample, Vec3, ViewingMetrics } from '@/types';
import { sampleMainScreen } from './screenGeometry';

/**
 * VIEWING GEOMETRY
 *
 * All values are computed from the seated eye position and the actual screen
 * surfaces of the layout – nothing is estimated from row/seat numbers.
 *
 * Azimuth convention: 0° = looking straight at the screen wall (-z),
 * positive = to the viewer's right, ±180° = directly behind.
 */

const RAD2DEG = 180 / Math.PI;

/** Constants that define how derived indicators are expressed. */
export const VIEWING_CONSTANTS = {
  /** Off-axis angle at which centre alignment reaches 0%. */
  alignmentZeroAtDeg: 45,
  /** Approximate human horizontal visual field (binocular + peripheral). */
  humanHorizontalFieldDeg: 200,
  /** Samples used across the main screen. */
  screenSamples: 48,
};

export function azimuthDeg(eye: Vec3, x: number, z: number): number {
  return Math.atan2(x - eye.x, eye.z - z) * RAD2DEG;
}

function azimuthRange(eye: Vec3, samples: SurfaceSample[]) {
  let min = Infinity;
  let max = -Infinity;
  for (const s of samples) {
    const a = azimuthDeg(eye, s.x, s.z);
    if (a < min) min = a;
    if (a > max) max = a;
  }
  return { min, max };
}

export function calculateDistanceToScreen(seat: SeatInfo, layout: AuditoriumLayout): number {
  const c = layout.screen.center;
  return Math.hypot(seat.eye.x - c.x, seat.eye.y - c.y, seat.eye.z - c.z);
}

/** Horizontal angle subtended by the main screen at the eye (deg). */
export function calculateHorizontalViewingAngle(seat: SeatInfo, layout: AuditoriumLayout): number {
  const { min, max } = azimuthRange(seat.eye, sampleMainScreen(layout.screen, VIEWING_CONSTANTS.screenSamples));
  return max - min;
}

function planDistanceToCenter(seat: SeatInfo, layout: AuditoriumLayout) {
  return Math.hypot(seat.eye.x - layout.screen.center.x, seat.eye.z - layout.screen.center.z);
}

/** Vertical angle subtended by the main screen (measured at the screen centre line) (deg). */
export function calculateVerticalViewingAngle(seat: SeatInfo, layout: AuditoriumLayout): number {
  const h = planDistanceToCenter(seat, layout);
  const top = Math.atan2(layout.screen.top - seat.eye.y, h);
  const bottom = Math.atan2(layout.screen.bottom - seat.eye.y, h);
  return (top - bottom) * RAD2DEG;
}

export function calculateOffAxisAngle(seat: SeatInfo, layout: AuditoriumLayout): number {
  return Math.atan2(seat.eye.x - layout.screen.center.x, seat.eye.z - layout.screen.center.z) * RAD2DEG;
}

export function calculateElevationAngles(seat: SeatInfo, layout: AuditoriumLayout) {
  const h = planDistanceToCenter(seat, layout);
  return {
    center: Math.atan2(layout.screen.centerY - seat.eye.y, h) * RAD2DEG,
    top: Math.atan2(layout.screen.top - seat.eye.y, h) * RAD2DEG,
    bottom: Math.atan2(layout.screen.bottom - seat.eye.y, h) * RAD2DEG,
  };
}

/**
 * Horizontal screen coverage including ScreenX side surfaces.
 * Returns the total span and the extra span contributed on each side.
 */
export function calculateScreenCoverage(seat: SeatInfo, layout: AuditoriumLayout) {
  const main = azimuthRange(seat.eye, sampleMainScreen(layout.screen, VIEWING_CONSTANTS.screenSamples));
  let min = main.min;
  let max = main.max;
  for (const strip of layout.screen.sideStrips) {
    const r = azimuthRange(seat.eye, strip.samples);
    min = Math.min(min, r.min);
    max = Math.max(max, r.max);
  }
  const total = Math.min(360, max - min);
  return {
    horizontal: total,
    visualFieldPercent: Math.min(100, (total / VIEWING_CONSTANTS.humanHorizontalFieldDeg) * 100),
    left: main.min - min,
    right: max - main.max,
  };
}

export function calculateCenterAlignment(offAxisDeg: number): number {
  const a = 1 - Math.abs(offAxisDeg) / VIEWING_CONSTANTS.alignmentZeroAtDeg;
  return Math.max(0, Math.min(1, a)) * 100;
}

export function describeRelativePosition(seat: SeatInfo, layout: AuditoriumLayout): string {
  const rows = layout.config.rows;
  const depth = rows <= 1 ? 0.5 : seat.row / (rows - 1);
  const depthLabel = rows <= 2 ? (seat.row === 0 ? 'Front' : 'Back') : depth < 0.34 ? 'Front' : depth < 0.67 ? 'Middle' : 'Back';
  const half = Math.max(layout.rowWidth / 2, 1e-6);
  const rel = seat.position.x / half;
  const lateral =
    Math.abs(rel) < 0.15 ? 'Center' : rel < 0 ? (rel > -0.6 ? 'Center-left' : 'Far left') : rel < 0.6 ? 'Center-right' : 'Far right';
  return `${depthLabel} · ${lateral}`;
}

export function getViewingMetrics(seat: SeatInfo, layout: AuditoriumLayout): ViewingMetrics {
  const offAxis = calculateOffAxisAngle(seat, layout);
  const elev = calculateElevationAngles(seat, layout);
  const coverage = calculateScreenCoverage(seat, layout);
  return {
    label: seat.label,
    distance: calculateDistanceToScreen(seat, layout),
    horizontalAngle: calculateHorizontalViewingAngle(seat, layout),
    verticalAngle: calculateVerticalViewingAngle(seat, layout),
    offAxisAngle: offAxis,
    elevationAngle: elev.center,
    topElevationAngle: elev.top,
    panoramicCoverage: coverage.horizontal,
    visualFieldPercent: coverage.visualFieldPercent,
    sideCoverage: { left: coverage.left, right: coverage.right },
    centerAlignment: calculateCenterAlignment(offAxis),
    relativePosition: describeRelativePosition(seat, layout),
  };
}
