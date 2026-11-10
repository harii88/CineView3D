import { beforeEach, describe, expect, it } from 'vitest';
import {
  clampToRoom,
  computeLayout,
  directionToYawPitch,
  easeInOutCubic,
  findSeatByLabel,
  getOverviewPose,
  lerpAngle,
  planTransition,
  quadraticBezier,
  yawPitchToDirection,
} from '@/lib/geometry';
import { createDefaultConfig } from '@/lib/config/defaults';
import { useAuditorium } from '@/store/auditoriumStore';
import { useViewer } from '@/store/viewerStore';

describe('camera math', () => {
  it('yaw/pitch round-trip to the direction of the screen centre', () => {
    const layout = computeLayout(createDefaultConfig());
    for (const label of ['A1', 'H8', 'J10', 'E5']) {
      const seat = findSeatByLabel(layout, label)!;
      const { yaw, pitch } = directionToYawPitch(seat.eye, layout.screen.center);
      const d = yawPitchToDirection(yaw, pitch);
      const v = {
        x: layout.screen.center.x - seat.eye.x,
        y: layout.screen.center.y - seat.eye.y,
        z: layout.screen.center.z - seat.eye.z,
      };
      const len = Math.hypot(v.x, v.y, v.z);
      expect(d.x).toBeCloseTo(v.x / len, 9);
      expect(d.y).toBeCloseTo(v.y / len, 9);
      expect(d.z).toBeCloseTo(v.z / len, 9);
    }
  });

  it('a seat right of centre turns the camera left (positive yaw) towards the screen', () => {
    const layout = computeLayout(createDefaultConfig());
    expect(directionToYawPitch(findSeatByLabel(layout, 'E10')!.eye, layout.screen.center).yaw).toBeGreaterThan(0);
    expect(directionToYawPitch(findSeatByLabel(layout, 'E1')!.eye, layout.screen.center).yaw).toBeLessThan(0);
  });

  it('easing and interpolation hit their endpoints', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 9);
    expect(lerpAngle(3, -3, 0)).toBe(3);
    // shortest path across ±π
    expect(Math.abs(lerpAngle(3, -3, 0.5))).toBeGreaterThan(3);
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 10, y: 2, z: 4 };
    expect(quadraticBezier(a, { x: 5, y: 5, z: 2 }, b, 0)).toEqual(a);
    expect(quadraticBezier(a, { x: 5, y: 5, z: 2 }, b, 1)).toEqual(b);
  });

  it('plans a 1–2 s transition lifted over the seats, instant with reduced motion', () => {
    const from = { x: 0, y: 1.2, z: 6 };
    const to = { x: 3, y: 3.5, z: 14 };
    const t = planTransition(from, to);
    expect(t.duration).toBeGreaterThanOrEqual(1);
    expect(t.duration).toBeLessThanOrEqual(2);
    expect(t.control.y).toBeGreaterThan(Math.max(from.y, to.y));
    expect(planTransition(from, to, true).duration).toBe(0);
  });

  it('overview pose looks at the room and explore stays inside it', () => {
    const layout = computeLayout(createDefaultConfig());
    const pose = getOverviewPose(layout);
    expect(pose.position.y).toBeGreaterThan(layout.height);
    const inside = clampToRoom({ x: 100, y: -5, z: -100 }, layout);
    expect(inside.x).toBeLessThan(layout.width / 2);
    expect(inside.z).toBeGreaterThan(layout.frontWallZ);
    expect(inside.y).toBeGreaterThan(0);
  });
});

describe('stores', () => {
  beforeEach(() => {
    useAuditorium.getState().resetAll();
    useViewer.setState({ selected: null, comparison: [], bestSeats: [], mode: 'overview' });
  });

  it('regenerates the layout when rows or seats change', () => {
    const s = useAuditorium.getState();
    expect(s.layout.seats).toHaveLength(100);
    expect(s.setCounts({ rows: 15 })).toBeNull();
    expect(useAuditorium.getState().layout.seats).toHaveLength(150);
    expect(useAuditorium.getState().setCounts({ seatsPerRow: 20 })).toBeNull();
    expect(useAuditorium.getState().layout.seats).toHaveLength(300);
  });

  it('rejects invalid counts without changing state', () => {
    const before = useAuditorium.getState().layout;
    expect(useAuditorium.getState().setCounts({ rows: 0 })).toMatch(/Rows/);
    expect(useAuditorium.getState().setCounts({ seatsPerRow: 'abc' })).toMatch(/number/);
    expect(useAuditorium.getState().setCounts({ rows: 60, seatsPerRow: 60 })).toMatch(/2500/);
    expect(useAuditorium.getState().layout).toBe(before);
  });

  it('switches screen type and keeps per-type edits', () => {
    const a = useAuditorium.getState();
    a.updateScreen({ width: 11 });
    a.setScreenType('imax');
    expect(useAuditorium.getState().layout.screen.type).toBe('imax');
    expect(useAuditorium.getState().layout.screen.height).toBeGreaterThan(10);
    useAuditorium.getState().setScreenType('screenx');
    expect(useAuditorium.getState().layout.screen.sideStrips).toHaveLength(2);
    useAuditorium.getState().setScreenType('standard');
    expect(useAuditorium.getState().layout.screen.width).toBe(11);
    expect(useAuditorium.getState().layout.screen.sideStrips).toHaveLength(0);
  });

  it('selecting a seat enters seated mode; shrinking the room drops invalid seats', () => {
    useViewer.getState().selectSeat({ row: 7, seat: 7 });
    expect(useViewer.getState().mode).toBe('seated');
    useViewer.getState().toggleCompare({ row: 7, seat: 7 });
    useViewer.getState().toggleCompare({ row: 1, seat: 1 });
    useViewer.getState().pruneSeats(5, 5);
    expect(useViewer.getState().selected).toBeNull();
    expect(useViewer.getState().mode).toBe('overview');
    expect(useViewer.getState().comparison).toEqual([{ row: 1, seat: 1 }]);
  });

  it('limits comparison to three seats', () => {
    const v = useViewer.getState();
    v.toggleCompare({ row: 0, seat: 0 });
    v.toggleCompare({ row: 0, seat: 1 });
    v.toggleCompare({ row: 0, seat: 2 });
    v.toggleCompare({ row: 0, seat: 3 });
    expect(useViewer.getState().comparison).toHaveLength(3);
  });
});
