import type { AuditoriumConfig, SeatInfo, Vec3 } from '@/types';
import { getRowLabel, getSeatLabel } from './labels';

/**
 * SEAT POSITION MODEL
 *
 * Rows are straight and parallel to the screen. Row r's seat centres sit at
 *   z_r = screen.distance + r * rowSpacing
 * on a stadium platform of height
 *   y_r = r * rowRise.
 *
 * Within a row, seats are split into `sections` blocks separated by centre
 * aisles. Seat centres are spaced at pitch = seatWidth + seatSpacing and the
 * whole row (including centre aisles) is centred on x = 0.
 */

function assertIndex(name: string, i: number, n: number) {
  if (!Number.isInteger(i) || i < 0 || i >= n) {
    throw new RangeError(`${name} index ${i} is out of range (0..${n - 1})`);
  }
}

export function getSeatPitch(config: AuditoriumConfig): number {
  return config.dimensions.seatWidth + config.dimensions.seatSpacing;
}

/** Start index of each section, plus a final entry equal to seatsPerRow. */
export function getSectionBoundaries(seatsPerRow: number, sections: number): number[] {
  const s = Math.max(1, Math.min(sections, seatsPerRow));
  const bounds: number[] = [];
  for (let k = 0; k <= s; k++) bounds.push(Math.round((k * seatsPerRow) / s));
  return bounds;
}

export function getSectionOfSeat(seatIndex: number, boundaries: number[]): number {
  for (let k = 0; k < boundaries.length - 1; k++) {
    if (seatIndex < boundaries[k + 1]) return k;
  }
  return boundaries.length - 2;
}

/** Total width of a row from the outer edge of seat 1 to the outer edge of the last seat. */
export function getRowWidth(config: AuditoriumConfig): number {
  const { seatWidth, seatSpacing, aisleWidth } = config.dimensions;
  const n = config.seatsPerRow;
  const sections = Math.max(1, Math.min(config.sections, n));
  return n * seatWidth + (n - 1) * seatSpacing + (sections - 1) * aisleWidth;
}

export function getActiveScreen(config: AuditoriumConfig) {
  return config.screens[config.screenType];
}

export function getRowZ(rowIndex: number, config: AuditoriumConfig): number {
  return getActiveScreen(config).distance + rowIndex * config.dimensions.rowSpacing;
}

export function getRowFloorY(rowIndex: number, config: AuditoriumConfig): number {
  return rowIndex * config.dimensions.rowRise;
}

/** z-extent of a row's stadium platform. Seats sit at the back of their platform with legroom in front. */
export function getRowPlatform(rowIndex: number, config: AuditoriumConfig): { zStart: number; zEnd: number } {
  const { rowSpacing, seatDepth } = config.dimensions;
  const zEnd = getRowZ(rowIndex, config) + seatDepth / 2 + 0.08;
  return { zStart: zEnd - rowSpacing, zEnd };
}

/** Floor height at a given z (stadium profile). */
export function getFloorHeightAt(z: number, config: AuditoriumConfig): number {
  const first = getRowPlatform(0, config);
  if (z < first.zStart) return 0;
  const r = Math.floor((z - first.zStart) / config.dimensions.rowSpacing);
  return getRowFloorY(Math.min(Math.max(r, 0), config.rows - 1), config);
}

/** x of a seat centre. */
export function getSeatX(seatIndex: number, config: AuditoriumConfig): number {
  const { seatWidth, aisleWidth } = config.dimensions;
  const bounds = getSectionBoundaries(config.seatsPerRow, config.sections);
  const section = getSectionOfSeat(seatIndex, bounds);
  return -getRowWidth(config) / 2 + seatWidth / 2 + seatIndex * getSeatPitch(config) + section * aisleWidth;
}

/** Centre of the seat footprint on its platform. Deterministic for every (row, seat). */
export function getSeatPosition(rowIndex: number, seatIndex: number, config: AuditoriumConfig): Vec3 {
  assertIndex('Row', rowIndex, config.rows);
  assertIndex('Seat', seatIndex, config.seatsPerRow);
  return {
    x: getSeatX(seatIndex, config),
    y: getRowFloorY(rowIndex, config),
    z: getRowZ(rowIndex, config),
  };
}

/**
 * Approximate seated eye position: above the cushion by eyeHeight and slightly
 * back towards the backrest, NOT at the cushion centre.
 */
export function getEyePosition(rowIndex: number, seatIndex: number, config: AuditoriumConfig): Vec3 {
  const p = getSeatPosition(rowIndex, seatIndex, config);
  const { seatHeight, eyeHeight, eyeBackOffset } = config.dimensions;
  return { x: p.x, y: p.y + seatHeight + eyeHeight, z: p.z + eyeBackOffset };
}

/** Camera position for a seat (alias kept for API clarity). */
export function getCameraPositionForSeat(seat: { row: number; seat: number }, config: AuditoriumConfig): Vec3 {
  return getEyePosition(seat.row, seat.seat, config);
}

export function buildSeatInfo(rowIndex: number, seatIndex: number, config: AuditoriumConfig): SeatInfo {
  const bounds = getSectionBoundaries(config.seatsPerRow, config.sections);
  return {
    row: rowIndex,
    seat: seatIndex,
    label: getSeatLabel(rowIndex, seatIndex),
    rowLabel: getRowLabel(rowIndex),
    number: seatIndex + 1,
    section: getSectionOfSeat(seatIndex, bounds),
    position: getSeatPosition(rowIndex, seatIndex, config),
    eye: getEyePosition(rowIndex, seatIndex, config),
  };
}
