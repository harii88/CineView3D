import { create } from 'zustand';
import type { AuditoriumConfig, AuditoriumDimensions, AuditoriumLayout, ScreenConfig, ScreenType } from '@/types';
import { createDefaultConfig, DEFAULT_SCREENS } from '@/lib/config/defaults';
import { COUNT_LIMITS, sanitizeConfig, validateCounts, validateNumber } from '@/lib/config/validation';
import { computeLayout } from '@/lib/geometry';

interface AuditoriumState {
  config: AuditoriumConfig;
  /** Physical layout derived from `config`. Shared by the seat map and the 3D scene. */
  layout: AuditoriumLayout;
  /** Replace the whole configuration (sanitised). Returns validation errors. */
  setConfig: (config: unknown) => string[];
  /** Change rows / seats / blocks. Returns an error message and leaves state unchanged when invalid. */
  setCounts: (patch: { rows?: unknown; seatsPerRow?: unknown; sections?: unknown }) => string | null;
  setScreenType: (type: ScreenType) => void;
  updateScreen: (patch: Partial<ScreenConfig>) => void;
  updateDimensions: (patch: Partial<AuditoriumDimensions>) => void;
  resetScreen: () => void;
  resetAll: () => void;
}

function withLayout(config: AuditoriumConfig) {
  return { config, layout: computeLayout(config) };
}

export const useAuditorium = create<AuditoriumState>((set, get) => ({
  ...withLayout(createDefaultConfig()),

  setConfig: (input) => {
    const { config, errors } = sanitizeConfig(input);
    set(withLayout(config));
    return errors;
  },

  setCounts: (patch) => {
    const cur = get().config;
    const next = { rows: cur.rows, seatsPerRow: cur.seatsPerRow, sections: cur.sections };
    for (const key of ['rows', 'seatsPerRow', 'sections'] as const) {
      if (patch[key] === undefined) continue;
      const r = validateNumber(patch[key], COUNT_LIMITS[key], true);
      if (!r.ok) return r.error!;
      next[key] = r.value;
    }
    // Keep blocks valid automatically when shrinking the row.
    if (patch.sections === undefined && next.sections > next.seatsPerRow) next.sections = next.seatsPerRow;
    const err = validateCounts(next.rows, next.seatsPerRow, next.sections);
    if (err) return err;
    set(withLayout({ ...cur, ...next }));
    return null;
  },

  setScreenType: (type) => set(withLayout({ ...get().config, screenType: type })),

  updateScreen: (patch) => {
    const cur = get().config;
    const screens = { ...cur.screens, [cur.screenType]: { ...cur.screens[cur.screenType], ...patch } };
    set(withLayout({ ...cur, screens }));
  },

  updateDimensions: (patch) => {
    const cur = get().config;
    set(withLayout({ ...cur, dimensions: { ...cur.dimensions, ...patch } }));
  },

  resetScreen: () => {
    const cur = get().config;
    set(withLayout({ ...cur, screens: { ...cur.screens, [cur.screenType]: { ...DEFAULT_SCREENS[cur.screenType] } } }));
  },

  resetAll: () => set(withLayout(createDefaultConfig())),
}));
