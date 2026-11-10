import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@/lib/config/defaults';
import type { AuditoriumConfig, ScreenType } from '@/types';
import {
  calculateDistanceToScreen,
  calculateHorizontalViewingAngle,
  calculateOffAxisAngle,
  calculateScreenCoverage,
  calculateSeatScore,
  calculateVerticalViewingAngle,
  compareSeats,
  computeLayout,
  findBestSeats,
  findSeatByLabel,
  getViewingMetrics,
  scoreToStars,
  combineScore,
  SCORING_PROFILES,
} from '@/lib/geometry';

const RAD = Math.PI / 180;

function layoutFor(rows: number, seats: number, patch: (c: AuditoriumConfig) => void = () => {}) {
  const c = createDefaultConfig();
  c.rows = rows;
  c.seatsPerRow = seats;
  patch(c);
  return computeLayout(c);
}

describe('viewing angles', () => {
  it('matches the analytic subtended angle for a centred seat and a flat screen', () => {
    // Single seat so it lies exactly on the centre line.
    const layout = layoutFor(1, 1);
    const seat = layout.seats[0];
    const dz = seat.eye.z;
    const expectedH = (2 * Math.atan(layout.screen.width / 2 / dz)) / RAD;
    expect(calculateHorizontalViewingAngle(seat, layout)).toBeCloseTo(expectedH, 6);

    const top = Math.atan2(layout.screen.top - seat.eye.y, dz);
    const bottom = Math.atan2(layout.screen.bottom - seat.eye.y, dz);
    expect(calculateVerticalViewingAngle(seat, layout)).toBeCloseTo((top - bottom) / RAD, 6);
    expect(calculateOffAxisAngle(seat, layout)).toBeCloseTo(0, 9);
  });

  it('computes 3D distance from the eye to the screen centre', () => {
    const layout = layoutFor(10, 10);
    const seat = findSeatByLabel(layout, 'H8')!;
    const c = layout.screen.center;
    const expected = Math.sqrt((seat.eye.x - c.x) ** 2 + (seat.eye.y - c.y) ** 2 + (seat.eye.z - c.z) ** 2);
    expect(calculateDistanceToScreen(seat, layout)).toBeCloseTo(expected, 9);
  });

  it('screen angle shrinks with distance and off-axis angle grows to the sides', () => {
    const layout = layoutFor(10, 10);
    const a5 = findSeatByLabel(layout, 'A5')!;
    const j5 = findSeatByLabel(layout, 'J5')!;
    expect(calculateHorizontalViewingAngle(a5, layout)).toBeGreaterThan(calculateHorizontalViewingAngle(j5, layout));
    const e1 = findSeatByLabel(layout, 'E1')!;
    const e10 = findSeatByLabel(layout, 'E10')!;
    expect(calculateOffAxisAngle(e1, layout)).toBeLessThan(0);
    expect(calculateOffAxisAngle(e10, layout)).toBeGreaterThan(0);
    expect(calculateOffAxisAngle(e1, layout)).toBeCloseTo(-calculateOffAxisAngle(e10, layout), 9);
  });

  it('describes relative position and alignment', () => {
    const layout = layoutFor(10, 10);
    const m = getViewingMetrics(findSeatByLabel(layout, 'H8')!, layout);
    expect(m.relativePosition).toBe('Back · Center-right');
    const left = getViewingMetrics(findSeatByLabel(layout, 'A1')!, layout);
    expect(left.relativePosition).toBe('Front · Far left');
    expect(left.centerAlignment).toBeLessThan(m.centerAlignment);
  });

  it('ScreenX coverage extends far beyond the main screen', () => {
    const std = layoutFor(10, 10);
    const sx = layoutFor(10, 10, (c) => (c.screenType = 'screenx'));
    const sStd = findSeatByLabel(std, 'E5')!;
    const sSx = findSeatByLabel(sx, 'E5')!;
    const cStd = calculateScreenCoverage(sStd, std);
    const cSx = calculateScreenCoverage(sSx, sx);
    expect(cStd.left).toBe(0);
    expect(cStd.right).toBe(0);
    expect(cSx.horizontal).toBeGreaterThan(cStd.horizontal + 90);
    expect(cSx.horizontal).toBeGreaterThan(180);
    expect(cSx.horizontal).toBeLessThanOrEqual(360);
  });

  it('IMAX fills more of the view than a standard screen from the same seat', () => {
    const std = layoutFor(10, 10);
    const imax = layoutFor(10, 10, (c) => (c.screenType = 'imax'));
    const a = getViewingMetrics(findSeatByLabel(std, 'F5')!, std);
    const b = getViewingMetrics(findSeatByLabel(imax, 'F5')!, imax);
    expect(b.horizontalAngle).toBeGreaterThan(a.horizontalAngle);
    expect(b.verticalAngle).toBeGreaterThan(a.verticalAngle);
  });
});

describe('seat scoring', () => {
  it('combines components with the profile weights', () => {
    const w = SCORING_PROFILES.standard.weights;
    expect(combineScore({ immersion: 1, alignment: 1, vertical: 1, distance: 1, panoramic: 0 }, w)).toBeCloseTo(100, 9);
    expect(combineScore({ immersion: 0, alignment: 0, vertical: 0, distance: 0, panoramic: 0 }, w)).toBe(0);
    expect(scoreToStars(100)).toBe(5);
    expect(scoreToStars(80)).toBe(4);
    expect(scoreToStars(0)).toBe(0.5);
  });

  it('scores are within range and deterministic', () => {
    const layout = layoutFor(10, 10);
    for (const s of layout.seats) {
      const a = calculateSeatScore(s, layout);
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(100);
      expect(calculateSeatScore(s, layout).score).toBe(a.score);
    }
  });

  it('prefers centre seats to extreme side seats and penalises the front row', () => {
    const layout = layoutFor(10, 10);
    const centre = calculateSeatScore(findSeatByLabel(layout, 'F5')!, layout).score;
    const side = calculateSeatScore(findSeatByLabel(layout, 'F1')!, layout).score;
    const front = calculateSeatScore(findSeatByLabel(layout, 'A5')!, layout).score;
    expect(centre).toBeGreaterThan(side);
    expect(centre).toBeGreaterThan(front);
  });

  it('best seats are the top-scoring seats, sorted, and not just the middle seat', () => {
    const layout = layoutFor(10, 10);
    const best = findBestSeats(layout);
    expect(best).toHaveLength(10);
    for (let i = 1; i < best.length; i++) expect(best[i - 1].score).toBeGreaterThanOrEqual(best[i].score);
    const all = layout.seats.map((s) => calculateSeatScore(s, layout).score).sort((a, b) => b - a);
    expect(best[0].score).toBeCloseTo(all[0], 9);
    expect(best[best.length - 1].score).toBeCloseTo(all[9], 9);
    // Every best seat should be near the centre line.
    for (const b of best) expect(b.metrics.centerAlignment).toBeGreaterThan(70);
  });

  it('best seats move back for a bigger screen and change with the screen type', () => {
    const avgRow = (patch: (c: AuditoriumConfig) => void) => {
      const l = layoutFor(20, 15, patch);
      const best = findBestSeats(l, 5);
      return best.reduce((acc, b) => acc + l.seats.find((s) => s.label === b.label)!.row, 0) / best.length;
    };
    const small = avgRow((c) => (c.screens.standard.width = 8));
    const big = avgRow((c) => (c.screens.standard.width = 14));
    expect(big).toBeGreaterThan(small);
    const labels = (t: ScreenType) => findBestSeats(layoutFor(15, 15, (c) => (c.screenType = t)), 5).map((b) => b.label);
    expect(labels('imax')).not.toEqual(labels('standard'));
  });

  it('works for edge-case auditoriums', () => {
    expect(findBestSeats(layoutFor(1, 1))).toHaveLength(1);
    expect(findBestSeats(layoutFor(2, 2))).toHaveLength(1);
    expect(findBestSeats(layoutFor(20, 30))).toHaveLength(12);
    expect(findBestSeats(layoutFor(10, 10, (c) => (c.screenType = 'screenx')))[0].breakdown.panoramic).toBeGreaterThan(0.5);
  });

  it('compares seats and picks winners', () => {
    const layout = layoutFor(10, 10);
    const cmp = compareSeats([findSeatByLabel(layout, 'H8')!, findSeatByLabel(layout, 'F6')!, findSeatByLabel(layout, 'A1')!], layout);
    expect(cmp.scores.map((s) => s.label)).toEqual(['H8', 'F6', 'A1']);
    expect(cmp.winners.score).not.toBe('A1');
    expect(cmp.winners.alignment).not.toBe('A1');
    expect(compareSeats([findSeatByLabel(layout, 'H8')!], layout).winners.score).toBeUndefined();
  });
});
