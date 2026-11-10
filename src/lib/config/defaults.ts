import type { AuditoriumConfig, AuditoriumDimensions, ScreenConfig, ScreenType } from '@/types';

/** Physical defaults (metres). All geometry derives from these – nothing is hard-coded elsewhere. */
export const DEFAULT_DIMENSIONS: AuditoriumDimensions = {
  seatWidth: 0.55,
  seatDepth: 0.55,
  seatHeight: 0.45,
  backrestHeight: 1.0,
  seatSpacing: 0.06,
  rowSpacing: 1.1,
  aisleWidth: 1.2,
  rowRise: 0.32,
  eyeHeight: 0.75,
  eyeBackOffset: 0.1,
  auditoriumWidth: null,
  auditoriumLength: null,
  ceilingHeight: null,
};

/** Default screen parameters for each screen type. Values are typical, not canonical. */
export const DEFAULT_SCREENS: Record<ScreenType, ScreenConfig> = {
  // Flat 1.85:1 screen typical of a mid-size multiplex house.
  standard: { width: 10, height: 5.4, bottom: 1.0, distance: 5, curvature: 0, sidePanelLength: 0, cornerDepth: 1 },
  // Large, tall 1.43:1 screen, slightly curved, mounted low. Fully configurable.
  imax: { width: 16, height: 11.2, bottom: 0.5, distance: 6.5, curvature: 14, sidePanelLength: 0, cornerDepth: 1 },
  // Standard centre screen plus side-wall projection surfaces.
  screenx: { width: 10, height: 5.4, bottom: 1.2, distance: 5, curvature: 0, sidePanelLength: 9, cornerDepth: 1.2 },
  // 2.39:1 scope screen with mild curvature as a starting point.
  custom: { width: 12, height: 5.0, bottom: 1.2, distance: 5.5, curvature: 8, sidePanelLength: 0, cornerDepth: 1 },
};

export const SCREEN_TYPE_LABELS: Record<ScreenType, string> = {
  standard: 'Standard',
  imax: 'IMAX',
  screenx: 'ScreenX',
  custom: 'Custom',
};

export const SCREEN_TYPE_DESCRIPTIONS: Record<ScreenType, string> = {
  standard: 'Flat 1.85:1 multiplex screen',
  imax: 'Tall 1.43:1 large-format screen',
  screenx: '270° panoramic side-wall projection',
  custom: 'Your own size, ratio and curvature',
};

export const ASPECT_RATIOS: { label: string; value: number }[] = [
  { label: '1.43:1 (IMAX film)', value: 1.43 },
  { label: '1.78:1 (16:9)', value: 16 / 9 },
  { label: '1.85:1 (Flat)', value: 1.85 },
  { label: '1.90:1 (IMAX digital)', value: 1.9 },
  { label: '2.39:1 (Scope)', value: 2.39 },
];

export function createDefaultConfig(): AuditoriumConfig {
  return {
    rows: 10,
    seatsPerRow: 10,
    sections: 1,
    screenType: 'standard',
    dimensions: { ...DEFAULT_DIMENSIONS },
    screens: {
      standard: { ...DEFAULT_SCREENS.standard },
      imax: { ...DEFAULT_SCREENS.imax },
      screenx: { ...DEFAULT_SCREENS.screenx },
      custom: { ...DEFAULT_SCREENS.custom },
    },
  };
}

/** Camera / viewer defaults. */
export const CAMERA_DEFAULTS = {
  fov: 60,
  minFov: 20,
  maxFov: 110,
  presets: { default: 60, wide: 90, cinematic: 45 } as const,
  /** How far you can turn your head from the screen centre while seated (deg). */
  maxYaw: 135,
  maxPitch: 75,
};
