import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@/lib/config/defaults';
import type { AuditoriumConfig, ScreenType } from '@/types';
import {
  computeLayout,
  findSeatByLabel,
  getCameraPositionForSeat,
  getRowLabel,
  getSeatLabel,
  getSeatPosition,
  getRowWidth,
  parseRowLabel,
  parseSeatLabel,
  stepSeat,
  getFloorHeightAt,
  getScreenPoint,
  resolveMainScreen,
  getScreenPosition,
} from '@/lib/geometry';

function cfg(rows: number, seats: number, patch: (c: AuditoriumConfig) => void = () => {}) {
  const c = createDefaultConfig();
  c.rows = rows;
  c.seatsPerRow = seats;
  patch(c);
  return c;
}

describe('row and seat labels', () => {
  it('labels rows alphabetically and continues with AA after Z', () => {
    expect(getRowLabel(0)).toBe('A');
    expect(getRowLabel(7)).toBe('H');
    expect(getRowLabel(25)).toBe('Z');
    expect(getRowLabel(26)).toBe('AA');
    expect(getRowLabel(27)).toBe('AB');
    expect(getRowLabel(51)).toBe('AZ');
    expect(getRowLabel(52)).toBe('BA');
    expect(getRowLabel(701)).toBe('ZZ');
    expect(getRowLabel(702)).toBe('AAA');
  });

  it('round-trips row labels', () => {
    for (let i = 0; i < 800; i++) expect(parseRowLabel(getRowLabel(i))).toBe(i);
    expect(parseRowLabel('a1')).toBe(-1);
  });

  it('numbers seats from 1 with H8 = row 7, seat 7', () => {
    expect(getSeatLabel(7, 7)).toBe('H8');
    expect(getSeatLabel(0, 0)).toBe('A1');
    expect(getSeatLabel(26, 11)).toBe('AA12');
    expect(() => getSeatLabel(-1, 0)).toThrow(RangeError);
  });

  it('parses seat search text in several formats', () => {
    for (const text of ['H8', 'h8', 'H 8', 'H-8', 'Row H Seat 8', 'row h, seat 8', '  row H seat 8 ']) {
      expect(parseSeatLabel(text)).toEqual({ row: 7, seat: 7 });
    }
    expect(parseSeatLabel('AA12')).toEqual({ row: 26, seat: 11 });
    expect(parseSeatLabel('8H')).toBeNull();
    expect(parseSeatLabel('H0')).toBeNull();
    expect(parseSeatLabel('')).toBeNull();
    expect(parseSeatLabel('Z1', 10, 10)).toBeNull();
    expect(parseSeatLabel('A11', 10, 10)).toBeNull();
    expect(parseSeatLabel('J10', 10, 10)).toEqual({ row: 9, seat: 9 });
  });
});

describe('seat coordinates', () => {
  it('places seat 1 on the viewer-left (negative x) and numbers increase to the right', () => {
    const c = cfg(10, 10);
    const xs = Array.from({ length: 10 }, (_, s) => getSeatPosition(0, s, c).x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    expect(xs[0]).toBeLessThan(0);
    expect(xs[9]).toBeGreaterThan(0);
  });

  it('centres each row on x = 0 (symmetric)', () => {
    for (const [rows, seats] of [[1, 1], [2, 2], [10, 10], [20, 30], [3, 5]]) {
      const c = cfg(rows, seats);
      const first = getSeatPosition(0, 0, c).x;
      const last = getSeatPosition(0, seats - 1, c).x;
      expect(first + last).toBeCloseTo(0, 9);
    }
  });

  it('computes H8 deterministically from the physical dimensions', () => {
    const c = cfg(10, 10);
    const d = c.dimensions;
    const pitch = d.seatWidth + d.seatSpacing;
    const p = getSeatPosition(7, 7, c);
    expect(p.x).toBeCloseTo(-getRowWidth(c) / 2 + d.seatWidth / 2 + 7 * pitch, 9);
    expect(p.z).toBeCloseTo(c.screens.standard.distance + 7 * d.rowSpacing, 9);
    expect(p.y).toBeCloseTo(7 * d.rowRise, 9);
  });

  it('places rows further from the screen and higher as the row letter increases', () => {
    const c = cfg(15, 8);
    for (let r = 1; r < 15; r++) {
      expect(getSeatPosition(r, 0, c).z).toBeGreaterThan(getSeatPosition(r - 1, 0, c).z);
      expect(getSeatPosition(r, 0, c).y).toBeGreaterThanOrEqual(getSeatPosition(r - 1, 0, c).y);
    }
  });

  it('adds centre aisles between seat blocks', () => {
    const c = cfg(5, 10, (c) => (c.sections = 2));
    const pitch = c.dimensions.seatWidth + c.dimensions.seatSpacing;
    const gap = getSeatPosition(0, 5, c).x - getSeatPosition(0, 4, c).x;
    expect(gap).toBeCloseTo(pitch + c.dimensions.aisleWidth, 9);
    const layout = computeLayout(c);
    expect(layout.aisles.filter((a) => a.kind === 'center')).toHaveLength(1);
  });

  it('rejects out-of-range seats', () => {
    const c = cfg(3, 5);
    expect(() => getSeatPosition(3, 0, c)).toThrow(RangeError);
    expect(() => getSeatPosition(0, 5, c)).toThrow(RangeError);
    expect(() => getSeatPosition(0, -1, c)).toThrow(RangeError);
  });
});

describe('camera positioning', () => {
  it('puts the camera at seated eye height, not on the cushion', () => {
    const c = cfg(10, 10);
    const seat = getSeatPosition(7, 7, c);
    const eye = getCameraPositionForSeat({ row: 7, seat: 7 }, c);
    expect(eye.x).toBeCloseTo(seat.x, 9);
    expect(eye.y).toBeCloseTo(seat.y + c.dimensions.seatHeight + c.dimensions.eyeHeight, 9);
    expect(eye.z).toBeCloseTo(seat.z + c.dimensions.eyeBackOffset, 9);
    expect(eye.y - seat.y).toBeGreaterThan(1.0);
    expect(eye.y - seat.y).toBeLessThan(1.4);
  });

  it('responds to eye height configuration', () => {
    const c = cfg(4, 4, (c) => (c.dimensions.eyeHeight = 0.9));
    const eye = getCameraPositionForSeat({ row: 0, seat: 0 }, c);
    expect(eye.y).toBeCloseTo(c.dimensions.seatHeight + 0.9, 9);
  });
});

describe('auditorium layout and resizing', () => {
  it('generates rows × seats seats with unique labels', () => {
    for (const [rows, seats] of [[1, 1], [2, 2], [10, 10], [20, 20], [15, 30], [20, 30]]) {
      const layout = computeLayout(cfg(rows, seats));
      expect(layout.seats).toHaveLength(rows * seats);
      expect(new Set(layout.seats.map((s) => s.label)).size).toBe(rows * seats);
    }
  });

  it('grows the room when rows or seats are added', () => {
    const a = computeLayout(cfg(10, 10));
    const b = computeLayout(cfg(15, 10));
    const c = computeLayout(cfg(10, 30));
    expect(b.length).toBeGreaterThan(a.length);
    expect(b.length - a.length).toBeCloseTo(5 * a.config.dimensions.rowSpacing, 6);
    expect(c.width).toBeGreaterThan(a.width);
  });

  it('keeps every seat inside the walls and under the ceiling', () => {
    for (const layout of [computeLayout(cfg(20, 30)), computeLayout(cfg(1, 1)), computeLayout(cfg(40, 10))]) {
      for (const s of layout.seats) {
        expect(Math.abs(s.position.x) + layout.config.dimensions.seatWidth / 2).toBeLessThanOrEqual(layout.width / 2 + 1e-9);
        expect(s.position.z).toBeLessThan(layout.backWallZ);
        expect(s.position.z).toBeGreaterThan(layout.frontWallZ);
        expect(s.eye.y).toBeLessThan(layout.height);
      }
      expect(layout.screen.top).toBeLessThan(layout.height);
    }
  });

  it('handles a very wide auditorium and a very tall screen', () => {
    const wide = computeLayout(cfg(5, 60, (c) => (c.sections = 4)));
    expect(wide.width).toBeGreaterThan(35);
    expect(wide.aisles.filter((a) => a.kind === 'center')).toHaveLength(3);
    const tall = computeLayout(cfg(10, 10, (c) => {
      c.screenType = 'imax';
      c.screens.imax.height = 25;
    }));
    expect(tall.height).toBeGreaterThan(25.5);
  });

  it('honours room overrides only when they fit, and warns otherwise', () => {
    const ok = computeLayout(cfg(5, 5, (c) => (c.dimensions.auditoriumWidth = 30)));
    expect(ok.width).toBe(30);
    expect(ok.warnings).toHaveLength(0);
    const tooSmall = computeLayout(cfg(5, 5, (c) => (c.dimensions.auditoriumWidth = 3)));
    expect(tooSmall.width).toBeGreaterThan(3);
    expect(tooSmall.warnings.some((w) => w.includes('too narrow'))).toBe(true);
  });

  it('finds seats by label and steps through seats', () => {
    const layout = computeLayout(cfg(10, 10));
    expect(findSeatByLabel(layout, 'h8')?.label).toBe('H8');
    expect(findSeatByLabel(layout, 'K1')).toBeNull();
    expect(stepSeat(layout, { row: 0, seat: 9 }, 1)?.label).toBe('B1');
    expect(stepSeat(layout, { row: 0, seat: 0 }, -1)?.label).toBe('J10');
    expect(stepSeat(layout, null, 1)?.label).toBe('A1');
  });

  it('builds a stadium floor profile matching row platforms', () => {
    const c = cfg(10, 10);
    const layout = computeLayout(c);
    expect(getFloorHeightAt(-0.5, c)).toBe(0);
    layout.rowZ.forEach((z, r) => expect(getFloorHeightAt(z, c)).toBeCloseTo(layout.rowFloorY[r], 9));
  });
});

describe('screen geometry and type switching', () => {
  it('places the screen centre at the origin plane', () => {
    const layout = computeLayout(cfg(10, 10));
    const p = getScreenPosition(layout);
    expect(p.x).toBe(0);
    expect(p.z).toBe(0);
    expect(p.y).toBeCloseTo(layout.screen.bottom + layout.screen.height / 2, 9);
  });

  it('curves screen edges towards the audience while keeping the chord width', () => {
    const s = resolveMainScreen({ ...createDefaultConfig().screens.imax, curvature: 30 }, 'imax');
    const left = getScreenPoint(s, 0);
    const right = getScreenPoint(s, 1);
    expect(right.x - left.x).toBeCloseTo(s.width, 6);
    expect(left.z).toBeCloseTo(s.sagitta, 6);
    expect(s.sagitta).toBeGreaterThan(0);
    expect(getScreenPoint(s, 0.5).z).toBeCloseTo(0, 9);
  });

  it('changes the screen geometry when the screen type changes', () => {
    const types: ScreenType[] = ['standard', 'imax', 'screenx', 'custom'];
    const layouts = types.map((t) => computeLayout(cfg(10, 10, (c) => (c.screenType = t))));
    const [standard, imax, screenx] = layouts;
    expect(imax.screen.height).toBeGreaterThan(standard.screen.height);
    expect(imax.screen.width / imax.screen.height).toBeLessThan(standard.screen.width / standard.screen.height);
    expect(standard.screen.sideStrips).toHaveLength(0);
    expect(imax.screen.sideStrips).toHaveLength(0);
    expect(screenx.screen.sideStrips).toHaveLength(2);
  });

  it('wraps ScreenX side surfaces along the side walls with continuous content coordinates', () => {
    const layout = computeLayout(cfg(10, 10, (c) => (c.screenType = 'screenx')));
    const right = layout.screen.sideStrips.find((s) => s.side === 'right')!.samples;
    const left = layout.screen.sideStrips.find((s) => s.side === 'left')!.samples;
    expect(right[0].x).toBeCloseTo(layout.screen.width / 2, 6);
    expect(right[0].p).toBeCloseTo(1, 6);
    expect(left[0].p).toBeCloseTo(0, 6);
    expect(right[right.length - 1].x).toBeCloseTo(layout.width / 2, 6);
    for (let i = 1; i < right.length; i++) {
      expect(right[i].p).toBeGreaterThan(right[i - 1].p);
      expect(right[i].z).toBeGreaterThanOrEqual(right[i - 1].z - 1e-9);
      expect(left[i].x).toBeCloseTo(-right[i].x, 9);
    }
    // Side surfaces stay above seated heads as the stadium floor rises.
    for (const s of right) expect(s.bottom).toBeGreaterThanOrEqual(layout.screen.bottom - 1e-9);
  });
});
