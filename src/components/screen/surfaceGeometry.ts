import * as THREE from 'three';
import type { ResolvedScreen, SurfaceSample } from '@/types';
import { getScreenPoint, getScreenNormal } from '@/lib/geometry';

/**
 * Build a vertical ribbon surface from plan-view samples. Each sample provides
 * x/z and a bottom/top height; uv = (P, v) where v is measured against the
 * main screen's nominal bottom/height so content lines up across surfaces.
 *
 * `flip` reverses the winding so the front face points the other way (used
 * for the left ScreenX wall, whose path runs in -x).
 */
export function buildRibbon(samples: SurfaceSample[], screen: ResolvedScreen, flip = false): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  samples.forEach((s, i) => {
    pos.push(s.x, s.bottom, s.z, s.x, s.top, s.z);
    uv.push(s.p, (s.bottom - screen.bottom) / screen.height, s.p, (s.top - screen.bottom) / screen.height);
    if (i > 0) {
      const b0 = (i - 1) * 2;
      const t0 = b0 + 1;
      const b1 = i * 2;
      const t1 = b1 + 1;
      if (!flip) idx.push(b0, b1, t0, t0, b1, t1);
      else idx.push(b0, t0, b1, t0, t1, b1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/** Samples along the main screen arc for P in [p0, p1] (P outside [0,1] extends the arc). */
export function arcSamples(screen: ResolvedScreen, p0: number, p1: number, bottom: number, top: number, offset = 0) {
  const segs = screen.arc > 1e-4 ? Math.max(2, Math.ceil(Math.abs(p1 - p0) * 48)) : 1;
  const out: SurfaceSample[] = [];
  for (let i = 0; i <= segs; i++) {
    const p = p0 + ((p1 - p0) * i) / segs;
    const pt = getScreenPoint(screen, p);
    const n = getScreenNormal(screen, p);
    out.push({ x: pt.x - n.x * offset, z: pt.z - n.z * offset, bottom, top, p });
  }
  return out;
}

/** Black masking border around the main screen (top, bottom and optionally sides). */
export function buildMasking(screen: ResolvedScreen, border: number, sides: boolean): THREE.BufferGeometry[] {
  const off = 0.015;
  const ext = sides ? border / screen.width : 0;
  const geos = [
    buildRibbon(arcSamples(screen, -ext, 1 + ext, screen.top, screen.top + border, off), screen),
    buildRibbon(arcSamples(screen, -ext, 1 + ext, Math.max(0, screen.bottom - border), screen.bottom, off), screen),
  ];
  if (sides) {
    geos.push(buildRibbon(arcSamples(screen, -ext, 0, screen.bottom, screen.top, off), screen));
    geos.push(buildRibbon(arcSamples(screen, 1, 1 + ext, screen.bottom, screen.top, off), screen));
  }
  return geos;
}
