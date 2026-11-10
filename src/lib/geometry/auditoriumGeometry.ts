import type { AisleSpan, AuditoriumConfig, AuditoriumLayout, SeatInfo } from '@/types';
import {
  buildSeatInfo,
  getActiveScreen,
  getFloorHeightAt,
  getRowFloorY,
  getRowPlatform,
  getRowWidth,
  getRowZ,
  getSeatX,
  getSectionBoundaries,
} from './seatPosition';
import { buildScreenXStrips, resolveMainScreen } from './screenGeometry';
import { parseSeatLabel } from './labels';

/** Fixed architectural clearances (m). */
export const ROOM_CONSTANTS = {
  /** Gap between the front wall and the screen centre. */
  frontWallOffset: 0.8,
  /** Cross aisle behind the last row. */
  backCrossAisle: 1.4,
  /** Minimum headroom above the highest platform. */
  minHeadroom: 2.6,
  /** Space above the screen top. */
  aboveScreen: 0.8,
  /** Side margin beside a non-ScreenX screen. */
  screenSideMargin: 1.2,
};

/**
 * Compute the full physical layout of an auditorium from its configuration.
 * The 2D seat map and the 3D scene both render from this one object, so they
 * always describe the same physical room.
 */
export function computeLayout(config: AuditoriumConfig): AuditoriumLayout {
  const d = config.dimensions;
  const screenCfg = getActiveScreen(config);
  const screen = resolveMainScreen(screenCfg, config.screenType);
  const warnings: string[] = [];

  const rowZ = Array.from({ length: config.rows }, (_, r) => getRowZ(r, config));
  const rowFloorY = Array.from({ length: config.rows }, (_, r) => getRowFloorY(r, config));
  const rowWidth = getRowWidth(config);

  // ---- Width ----
  const isScreenX = config.screenType === 'screenx';
  const widthForSeats = rowWidth + 2 * d.aisleWidth;
  const widthForScreen = screen.width + (isScreenX ? 0.4 : 2 * ROOM_CONSTANTS.screenSideMargin);
  const requiredWidth = Math.max(widthForSeats, widthForScreen);
  let width = requiredWidth;
  if (d.auditoriumWidth !== null) {
    if (d.auditoriumWidth < requiredWidth - 1e-6) {
      warnings.push(
        `Auditorium width ${d.auditoriumWidth.toFixed(1)} m is too narrow for the seats and screen; using ${requiredWidth.toFixed(1)} m.`,
      );
    } else width = d.auditoriumWidth;
  }

  // ---- Length ----
  const frontWallZ = -ROOM_CONSTANTS.frontWallOffset;
  const lastPlatform = getRowPlatform(config.rows - 1, config);
  const requiredBack = lastPlatform.zEnd + ROOM_CONSTANTS.backCrossAisle;
  const requiredLength = requiredBack - frontWallZ;
  let length = requiredLength;
  if (d.auditoriumLength !== null) {
    if (d.auditoriumLength < requiredLength - 1e-6) {
      warnings.push(
        `Auditorium length ${d.auditoriumLength.toFixed(1)} m is too short for ${config.rows} rows; using ${requiredLength.toFixed(1)} m.`,
      );
    } else length = d.auditoriumLength;
  }
  const backWallZ = frontWallZ + length;

  // ---- Height ----
  const lastFloor = rowFloorY[rowFloorY.length - 1] ?? 0;
  const requiredHeight = Math.max(screen.top + ROOM_CONSTANTS.aboveScreen, lastFloor + ROOM_CONSTANTS.minHeadroom);
  let height = requiredHeight;
  if (d.ceilingHeight !== null) {
    if (d.ceilingHeight < requiredHeight - 1e-6) {
      warnings.push(
        `Ceiling height ${d.ceilingHeight.toFixed(1)} m is too low for the screen and raked seating; using ${requiredHeight.toFixed(1)} m.`,
      );
    } else height = d.ceilingHeight;
  }

  // ---- Sanity warnings ----
  const firstFront = rowZ[0] - d.seatDepth / 2;
  if (firstFront < screen.sagitta + 0.5) {
    warnings.push('Row A is extremely close to the screen surface.');
  }
  if (screen.width > width + 1e-6) {
    warnings.push('The screen is wider than the room.');
  }

  // ---- ScreenX side surfaces ----
  if (isScreenX) {
    screen.sideStrips = buildScreenXStrips(screen, {
      roomHalfWidth: width / 2,
      backLimitZ: backWallZ - 0.5,
      sidePanelLength: screenCfg.sidePanelLength,
      cornerDepth: screenCfg.cornerDepth,
      floorAt: (z) => getFloorHeightAt(z, config),
    });
  }

  // ---- Seats ----
  const seats: SeatInfo[] = [];
  for (let r = 0; r < config.rows; r++) {
    for (let s = 0; s < config.seatsPerRow; s++) seats.push(buildSeatInfo(r, s, config));
  }

  // ---- Aisles ----
  const aisles: AisleSpan[] = [
    { xMin: -width / 2, xMax: -rowWidth / 2, kind: 'side' },
    { xMin: rowWidth / 2, xMax: width / 2, kind: 'side' },
  ];
  const bounds = getSectionBoundaries(config.seatsPerRow, config.sections);
  for (let k = 1; k < bounds.length - 1; k++) {
    const lastSeatX = getSeatX(bounds[k] - 1, config);
    aisles.push({
      xMin: lastSeatX + d.seatWidth / 2 + d.seatSpacing / 2,
      xMax: lastSeatX + d.seatWidth / 2 + d.seatSpacing / 2 + d.aisleWidth,
      kind: 'center',
    });
  }

  return {
    config,
    screen,
    seats,
    rowZ,
    rowFloorY,
    rowWidth,
    width,
    height,
    length,
    frontWallZ,
    backWallZ,
    aisles,
    warnings,
  };
}

export function getSeatFromLayout(layout: AuditoriumLayout, row: number, seat: number): SeatInfo | null {
  if (row < 0 || seat < 0 || row >= layout.config.rows || seat >= layout.config.seatsPerRow) return null;
  return layout.seats[row * layout.config.seatsPerRow + seat] ?? null;
}

export function findSeatByLabel(layout: AuditoriumLayout, label: string): SeatInfo | null {
  const id = parseSeatLabel(label, layout.config.rows, layout.config.seatsPerRow);
  return id ? getSeatFromLayout(layout, id.row, id.seat) : null;
}

/** Screen position helper (centre of main screen). */
export function getScreenPosition(layout: AuditoriumLayout) {
  return { ...layout.screen.center };
}

/** Next / previous seat in reading order (A1..A10, B1..), wrapping around. */
export function stepSeat(layout: AuditoriumLayout, current: { row: number; seat: number } | null, delta: number) {
  const total = layout.seats.length;
  if (total === 0) return null;
  const idx = current ? current.row * layout.config.seatsPerRow + current.seat : delta > 0 ? -1 : 0;
  const next = (((idx + delta) % total) + total) % total;
  return layout.seats[next];
}
