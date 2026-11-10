import type { AuditoriumConfig, ScreenConfig } from '@/types';
import { createDefaultConfig, DEFAULT_DIMENSIONS, DEFAULT_SCREENS, CAMERA_DEFAULTS } from '@/lib/config/defaults';
import { COUNT_LIMITS, DIMENSION_LIMITS, SCREEN_LIMITS, isScreenType, validateCounts, validateNumber } from '@/lib/config/validation';
import { parseSeatLabel, getSeatLabel } from '@/lib/geometry/labels';

/**
 * URL format:  /viewer?rows=10&seats=10&screen=imax&seat=H8
 * Optional:    blocks, sw, sh, sb, sd, curve, side (active screen), seatw, rowsp, rise, aisle, fov
 * Only values that differ from the defaults are written.
 */

const SCREEN_PARAMS: Record<string, keyof ScreenConfig> = {
  sw: 'width',
  sh: 'height',
  sb: 'bottom',
  sd: 'distance',
  curve: 'curvature',
  side: 'sidePanelLength',
};

const DIM_PARAMS = {
  seatw: 'seatWidth',
  rowsp: 'rowSpacing',
  rise: 'rowRise',
  aisle: 'aisleWidth',
} as const;

export interface ParsedShare {
  hasParams: boolean;
  config: AuditoriumConfig;
  seat: { row: number; seat: number } | null;
  fov: number | null;
  errors: string[];
}

export function parseShareParams(search: string, base: AuditoriumConfig = createDefaultConfig()): ParsedShare {
  const q = new URLSearchParams(search);
  const errors: string[] = [];
  const config: AuditoriumConfig = structuredClone(base);
  const known = ['rows', 'seats', 'blocks', 'screen', 'seat', 'fov', ...Object.keys(SCREEN_PARAMS), ...Object.keys(DIM_PARAMS)];
  const hasParams = known.some((k) => q.has(k));
  if (!hasParams) return { hasParams, config, seat: null, fov: null, errors };

  const int = (key: string, limit: typeof COUNT_LIMITS.rows, apply: (n: number) => void) => {
    if (!q.has(key)) return;
    const r = validateNumber(q.get(key), limit, true);
    if (r.ok) apply(r.value);
    else errors.push(`Ignored "${key}=${q.get(key)}": ${r.error}`);
  };
  int('rows', COUNT_LIMITS.rows, (n) => (config.rows = n));
  int('seats', COUNT_LIMITS.seatsPerRow, (n) => (config.seatsPerRow = n));
  int('blocks', COUNT_LIMITS.sections, (n) => (config.sections = n));

  const countErr = validateCounts(config.rows, config.seatsPerRow, config.sections);
  if (countErr) {
    errors.push(`${countErr} Using defaults instead.`);
    config.rows = base.rows;
    config.seatsPerRow = base.seatsPerRow;
    config.sections = Math.min(base.sections, base.seatsPerRow);
  }

  if (q.has('screen')) {
    const s = q.get('screen')!.toLowerCase();
    if (isScreenType(s)) config.screenType = s;
    else errors.push(`Ignored unknown screen type "${q.get('screen')}".`);
  }

  for (const [param, key] of Object.entries(SCREEN_PARAMS)) {
    if (!q.has(param)) continue;
    const r = validateNumber(q.get(param), SCREEN_LIMITS[key]);
    if (r.ok) config.screens[config.screenType] = { ...config.screens[config.screenType], [key]: r.value };
    else errors.push(`Ignored "${param}=${q.get(param)}": ${r.error}`);
  }
  for (const [param, key] of Object.entries(DIM_PARAMS)) {
    if (!q.has(param)) continue;
    const r = validateNumber(q.get(param), DIMENSION_LIMITS[key]);
    if (r.ok) config.dimensions = { ...config.dimensions, [key]: r.value };
    else errors.push(`Ignored "${param}=${q.get(param)}": ${r.error}`);
  }

  let seat: ParsedShare['seat'] = null;
  if (q.has('seat')) {
    const raw = q.get('seat')!;
    seat = parseSeatLabel(raw, config.rows, config.seatsPerRow);
    if (!seat) errors.push(`Seat "${raw}" does not exist in a ${config.rows} × ${config.seatsPerRow} auditorium.`);
  }

  let fov: number | null = null;
  if (q.has('fov')) {
    const r = validateNumber(q.get('fov'), { min: CAMERA_DEFAULTS.minFov, max: CAMERA_DEFAULTS.maxFov, label: 'FOV' });
    if (r.ok) fov = r.value;
    else errors.push(`Ignored "fov=${q.get('fov')}": ${r.error}`);
  }

  return { hasParams, config, seat, fov, errors };
}

const round = (n: number) => String(Math.round(n * 100) / 100);

export function buildShareQuery(
  config: AuditoriumConfig,
  seat: { row: number; seat: number } | null,
  fov?: number,
): string {
  const q = new URLSearchParams();
  q.set('rows', String(config.rows));
  q.set('seats', String(config.seatsPerRow));
  q.set('screen', config.screenType);
  if (seat) q.set('seat', getSeatLabel(seat.row, seat.seat));
  if (config.sections !== 1) q.set('blocks', String(config.sections));
  const scr = config.screens[config.screenType];
  const def = DEFAULT_SCREENS[config.screenType];
  for (const [param, key] of Object.entries(SCREEN_PARAMS)) {
    if (Math.abs(scr[key] - def[key]) > 1e-6) q.set(param, round(scr[key]));
  }
  for (const [param, key] of Object.entries(DIM_PARAMS)) {
    if (Math.abs(config.dimensions[key] - DEFAULT_DIMENSIONS[key]) > 1e-6) q.set(param, round(config.dimensions[key]));
  }
  if (fov !== undefined && Math.abs(fov - CAMERA_DEFAULTS.fov) > 0.5) q.set('fov', String(Math.round(fov)));
  return q.toString();
}

export function buildShareUrl(origin: string, config: AuditoriumConfig, seat: { row: number; seat: number } | null, fov?: number) {
  return `${origin.replace(/\/$/, '')}/viewer?${buildShareQuery(config, seat, fov)}`;
}
