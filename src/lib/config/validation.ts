import type { AuditoriumConfig, AuditoriumDimensions, ScreenConfig, ScreenType } from '@/types';
import { SCREEN_TYPES } from '@/types';
import { createDefaultConfig } from './defaults';

export interface Range {
  min: number;
  max: number;
  label: string;
  unit?: string;
  step?: number;
}

export const MAX_TOTAL_SEATS = 2500;

export const COUNT_LIMITS = {
  rows: { min: 1, max: 60, label: 'Rows', step: 1 } as Range,
  seatsPerRow: { min: 1, max: 60, label: 'Seats per row', step: 1 } as Range,
  sections: { min: 1, max: 5, label: 'Seat blocks', step: 1 } as Range,
};

export type DimensionKey = Exclude<keyof AuditoriumDimensions, 'auditoriumWidth' | 'auditoriumLength' | 'ceilingHeight'>;
export type RoomKey = 'auditoriumWidth' | 'auditoriumLength' | 'ceilingHeight';

export const DIMENSION_LIMITS: Record<DimensionKey, Range> = {
  seatWidth: { min: 0.4, max: 1.2, label: 'Seat width', unit: 'm', step: 0.01 },
  seatDepth: { min: 0.4, max: 1.2, label: 'Seat depth', unit: 'm', step: 0.01 },
  seatHeight: { min: 0.3, max: 0.7, label: 'Seat height', unit: 'm', step: 0.01 },
  backrestHeight: { min: 0.7, max: 1.4, label: 'Backrest height', unit: 'm', step: 0.01 },
  seatSpacing: { min: 0, max: 0.5, label: 'Seat spacing', unit: 'm', step: 0.01 },
  rowSpacing: { min: 0.8, max: 2.5, label: 'Row spacing', unit: 'm', step: 0.05 },
  aisleWidth: { min: 0.6, max: 4, label: 'Aisle width', unit: 'm', step: 0.05 },
  rowRise: { min: 0, max: 0.8, label: 'Row rise (stadium)', unit: 'm', step: 0.01 },
  eyeHeight: { min: 0.5, max: 1.0, label: 'Eye height above cushion', unit: 'm', step: 0.01 },
  eyeBackOffset: { min: -0.2, max: 0.3, label: 'Eye offset to backrest', unit: 'm', step: 0.01 },
};

export const ROOM_LIMITS: Record<RoomKey, Range> = {
  auditoriumWidth: { min: 3, max: 80, label: 'Auditorium width', unit: 'm', step: 0.5 },
  auditoriumLength: { min: 4, max: 120, label: 'Auditorium length', unit: 'm', step: 0.5 },
  ceilingHeight: { min: 2.5, max: 40, label: 'Ceiling height', unit: 'm', step: 0.5 },
};

export const SCREEN_LIMITS: Record<keyof ScreenConfig, Range> = {
  width: { min: 1, max: 40, label: 'Screen width', unit: 'm', step: 0.1 },
  height: { min: 0.5, max: 30, label: 'Screen height', unit: 'm', step: 0.1 },
  bottom: { min: 0, max: 5, label: 'Screen bottom height', unit: 'm', step: 0.05 },
  distance: { min: 1, max: 30, label: 'Screen distance (to row A)', unit: 'm', step: 0.1 },
  curvature: { min: 0, max: 90, label: 'Screen curvature (arc)', unit: '°', step: 1 },
  sidePanelLength: { min: 0, max: 40, label: 'Side panel length', unit: 'm', step: 0.5 },
  cornerDepth: { min: 0.2, max: 5, label: 'Corner transition depth', unit: 'm', step: 0.1 },
};

export interface FieldResult<T> {
  ok: boolean;
  value: T;
  error?: string;
}

function fmt(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

/** Validate a numeric value against a range. Non-finite values are rejected rather than clamped. */
export function validateNumber(raw: unknown, range: Range, integer = false): FieldResult<number> {
  const n =
    typeof raw === 'string' ? (raw.trim() === '' ? NaN : Number(raw)) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n)) {
    return { ok: false, value: range.min, error: `${range.label} must be a number.` };
  }
  if (integer && !Number.isInteger(n)) {
    return { ok: false, value: Math.round(n), error: `${range.label} must be a whole number.` };
  }
  if (n < range.min || n > range.max) {
    const unit = range.unit ? (range.unit === '°' ? '°' : ` ${range.unit}`) : '';
    return {
      ok: false,
      value: Math.min(range.max, Math.max(range.min, n)),
      error: `${range.label} must be between ${fmt(range.min)} and ${fmt(range.max)}${unit}.`,
    };
  }
  return { ok: true, value: n };
}

export function isScreenType(v: unknown): v is ScreenType {
  return typeof v === 'string' && (SCREEN_TYPES as string[]).includes(v);
}

/** Validate the combination of rows and seats (total seat count, sections). */
export function validateCounts(rows: number, seatsPerRow: number, sections: number): string | null {
  if (rows * seatsPerRow > MAX_TOTAL_SEATS) {
    return `That would be ${rows * seatsPerRow} seats — the simulator supports up to ${MAX_TOTAL_SEATS}.`;
  }
  if (sections > seatsPerRow) return 'There cannot be more seat blocks than seats per row.';
  return null;
}

/**
 * Sanitise a (possibly untrusted / partial) config. Invalid fields fall back to
 * clamped or default values and an error message is reported for each.
 */
export function sanitizeConfig(input: unknown): { config: AuditoriumConfig; errors: string[] } {
  const defaults = createDefaultConfig();
  const errors: string[] = [];
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  const count = (key: keyof typeof COUNT_LIMITS, fallback: number) => {
    const raw = src[key];
    if (raw === undefined) return fallback;
    const r = validateNumber(raw, COUNT_LIMITS[key], true);
    if (!r.ok) errors.push(r.error!);
    return r.value;
  };

  const rows = count('rows', defaults.rows);
  let seatsPerRow = count('seatsPerRow', defaults.seatsPerRow);
  let sections = count('sections', defaults.sections);
  if (rows * seatsPerRow > MAX_TOTAL_SEATS) {
    errors.push(`An auditorium is limited to ${MAX_TOTAL_SEATS} seats (requested ${rows * seatsPerRow}).`);
    seatsPerRow = Math.max(1, Math.floor(MAX_TOTAL_SEATS / rows));
  }
  if (sections > seatsPerRow) {
    errors.push('There cannot be more seat blocks than seats per row.');
    sections = seatsPerRow;
  }

  let screenType = defaults.screenType;
  if (src.screenType !== undefined) {
    if (isScreenType(src.screenType)) screenType = src.screenType;
    else errors.push(`Unknown screen type "${String(src.screenType)}".`);
  }

  const dimensions: AuditoriumDimensions = { ...defaults.dimensions };
  const dimSrc = (src.dimensions && typeof src.dimensions === 'object' ? src.dimensions : {}) as Record<
    string,
    unknown
  >;
  for (const key of Object.keys(DIMENSION_LIMITS) as DimensionKey[]) {
    if (dimSrc[key] === undefined) continue;
    const r = validateNumber(dimSrc[key], DIMENSION_LIMITS[key]);
    if (!r.ok) errors.push(r.error!);
    dimensions[key] = r.value;
  }
  for (const key of Object.keys(ROOM_LIMITS) as RoomKey[]) {
    const raw = dimSrc[key];
    if (raw === undefined || raw === null) continue;
    const r = validateNumber(raw, ROOM_LIMITS[key]);
    if (!r.ok) errors.push(r.error!);
    dimensions[key] = r.value;
  }

  const screens = { ...defaults.screens };
  const screensSrc = (src.screens && typeof src.screens === 'object' ? src.screens : {}) as Record<
    string,
    Record<string, unknown>
  >;
  for (const type of SCREEN_TYPES) {
    const s = screensSrc[type];
    if (!s || typeof s !== 'object') continue;
    const merged: ScreenConfig = { ...defaults.screens[type] };
    for (const key of Object.keys(SCREEN_LIMITS) as (keyof ScreenConfig)[]) {
      if (s[key] === undefined) continue;
      const r = validateNumber(s[key], SCREEN_LIMITS[key]);
      if (!r.ok) errors.push(`${type}: ${r.error}`);
      merged[key] = r.value;
    }
    screens[type] = merged;
  }

  return { config: { rows, seatsPerRow, sections, screenType, dimensions, screens }, errors };
}
