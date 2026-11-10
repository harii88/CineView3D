import type { ResolvedScreen, ScreenConfig, ScreenType, SurfaceSample, Vec3 } from '@/types';

/**
 * SCREEN MODEL
 *
 * The main screen is a cylindrical arc (or flat plane when curvature = 0) whose
 * centre point is at (0, centerY, 0). `width` is the CHORD width; the arc bends
 * towards the audience, so the edges sit at z = sagitta > 0 and the centre of
 * curvature lies in the audience at (0, *, radius).
 *
 * ScreenX side surfaces continue the main screen: a quarter-elliptical corner
 * transition from the screen edge to the side wall, then a straight run along
 * the side wall. The panoramic content coordinate P is continuous across all
 * surfaces (arc-length parameterised), so content wraps without seams. This is
 * an approximation of real ScreenX projection mapping; a real implementation
 * would replace the content sampling in the screen material, not the geometry.
 */

const DEG = Math.PI / 180;

export function resolveMainScreen(cfg: ScreenConfig, type: ScreenType): ResolvedScreen {
  const arc = Math.max(0, Math.min(cfg.curvature, 179)) * DEG;
  const radius = arc > 1e-4 ? cfg.width / (2 * Math.sin(arc / 2)) : Infinity;
  const sagitta = Number.isFinite(radius) ? radius * (1 - Math.cos(arc / 2)) : 0;
  const top = cfg.bottom + cfg.height;
  const centerY = cfg.bottom + cfg.height / 2;
  return {
    type,
    width: cfg.width,
    height: cfg.height,
    bottom: cfg.bottom,
    top,
    centerY,
    arc,
    radius,
    sagitta,
    center: { x: 0, y: centerY, z: 0 },
    distance: cfg.distance,
    sideStrips: [],
  };
}

/** Arc length of the main screen (equals width when flat). */
export function getScreenArcLength(screen: ResolvedScreen): number {
  return screen.arc > 1e-4 ? screen.radius * screen.arc : screen.width;
}

/** Point on the main screen for content coordinate p in [0,1] (left -> right). */
export function getScreenPoint(screen: ResolvedScreen, p: number): { x: number; z: number } {
  if (screen.arc <= 1e-4) return { x: (p - 0.5) * screen.width, z: 0 };
  const phi = (p - 0.5) * screen.arc;
  return { x: screen.radius * Math.sin(phi), z: screen.radius * (1 - Math.cos(phi)) };
}

/** Evenly spaced samples (by arc length) across the main screen. */
export function sampleMainScreen(screen: ResolvedScreen, segments = 32): SurfaceSample[] {
  const out: SurfaceSample[] = [];
  for (let i = 0; i <= segments; i++) {
    const p = i / segments;
    const pt = getScreenPoint(screen, p);
    out.push({ x: pt.x, z: pt.z, bottom: screen.bottom, top: screen.top, p });
  }
  return out;
}

/** Outward normal of the main screen surface (pointing towards the audience) at p. */
export function getScreenNormal(screen: ResolvedScreen, p: number): Vec3 {
  if (screen.arc <= 1e-4) return { x: 0, y: 0, z: 1 };
  const phi = (p - 0.5) * screen.arc;
  return { x: -Math.sin(phi), y: 0, z: Math.cos(phi) };
}

export interface ScreenXOptions {
  roomHalfWidth: number;
  backLimitZ: number;
  sidePanelLength: number;
  cornerDepth: number;
  /** Floor height function, used to keep the side surfaces above seated heads. */
  floorAt: (z: number) => number;
  /** Minimum clearance between the floor and the bottom of a side surface (m). */
  headClearance?: number;
}

/**
 * Build the left and right ScreenX surfaces. Returned samples are ordered from
 * the main screen edge outward; P continues beyond [0,1] by arc length.
 */
export function buildScreenXStrips(screen: ResolvedScreen, opts: ScreenXOptions): ResolvedScreen['sideStrips'] {
  if (opts.sidePanelLength <= 0) return [];
  const clearance = opts.headClearance ?? 2.1;
  const L = getScreenArcLength(screen);
  const edgeX = screen.width / 2;
  const a = Math.max(0, opts.roomHalfWidth - edgeX);
  const b = Math.max(0.05, opts.cornerDepth);
  const startZ = screen.sagitta;

  // Plan-view path for the right side (x > 0), from the screen edge outward.
  const path: { x: number; z: number }[] = [];
  const cornerSegs = 12;
  for (let i = 0; i <= cornerSegs; i++) {
    const t = (i / cornerSegs) * (Math.PI / 2);
    path.push({ x: edgeX + a * Math.sin(t), z: startZ + b - b * Math.cos(t) });
  }
  const wallStart = startZ + b;
  const wallEnd = Math.min(wallStart + opts.sidePanelLength, opts.backLimitZ);
  const wallSegs = Math.max(2, Math.ceil((wallEnd - wallStart) / 0.5));
  for (let i = 1; i <= wallSegs; i++) {
    path.push({ x: edgeX + a, z: wallStart + ((wallEnd - wallStart) * i) / wallSegs });
  }

  const right: SurfaceSample[] = [];
  let s = 0;
  for (let i = 0; i < path.length; i++) {
    if (i > 0) s += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    // Ramp the bottom edge up through the corner so it meets the main screen without a step.
    const ramp = Math.min(1, i / cornerSegs);
    const target = Math.max(screen.bottom, opts.floorAt(path[i].z) + clearance);
    const bottom = screen.bottom + (target - screen.bottom) * ramp;
    if (bottom > screen.top - 0.6) break; // the stadium floor has risen too high – stop the surface
    right.push({ x: path[i].x, z: path[i].z, bottom, top: screen.top, p: 1 + s / L });
  }
  if (right.length < 2) return [];
  const left: SurfaceSample[] = right.map((q) => ({ ...q, x: -q.x, p: 1 - q.p }));
  return [
    { side: 'left', samples: left },
    { side: 'right', samples: right },
  ];
}
