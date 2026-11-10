/**
 * Core domain types for CineView 3D.
 *
 * COORDINATE SYSTEM (metres, right-handed, Three.js convention, Y up):
 *   - x = 0 is the auditorium centre line. +x is to the RIGHT of a seated viewer.
 *   - y = 0 is the flat front floor level (stage/orchestra floor).
 *   - z = 0 is the plane through the centre of the main screen surface.
 *     +z points from the screen towards the back of the room, so a seated
 *     viewer looks along -z (the default Three.js camera direction).
 *   - Row A is closest to the screen. Seat 1 is the left-most seat from the
 *     viewer's perspective (most negative x).
 */

export type ScreenType = 'standard' | 'imax' | 'screenx' | 'custom';

export const SCREEN_TYPES: ScreenType[] = ['standard', 'imax', 'screenx', 'custom'];

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ScreenConfig {
  /** Chord width of the main screen in metres. */
  width: number;
  /** Height of the main screen in metres. */
  height: number;
  /** Height of the bottom screen edge above the front floor (m). */
  bottom: number;
  /** Horizontal distance from the screen centre to the centre of row A (m). */
  distance: number;
  /** Total horizontal arc angle of the screen in degrees (0 = flat). */
  curvature: number;
  /** ScreenX only: length of each side-wall projection surface (m). 0 disables. */
  sidePanelLength: number;
  /** ScreenX only: depth of the curved transition from screen edge to side wall (m). */
  cornerDepth: number;
}

export interface AuditoriumDimensions {
  seatWidth: number;
  seatDepth: number;
  /** Height of the seat cushion top above the row platform (m). */
  seatHeight: number;
  /** Height of the backrest top above the row platform (m). */
  backrestHeight: number;
  /** Gap between adjacent seats (armrest width) (m). */
  seatSpacing: number;
  /** Front-to-back distance between consecutive rows (m). */
  rowSpacing: number;
  /** Width of each aisle (side aisles and centre aisles) (m). */
  aisleWidth: number;
  /** Stadium riser height added per row (m). */
  rowRise: number;
  /** Seated eye height above the cushion top (m). */
  eyeHeight: number;
  /** Eye offset from seat centre towards the backrest (+z) (m). */
  eyeBackOffset: number;
  /** Overrides; null = computed automatically from the contents. */
  auditoriumWidth: number | null;
  auditoriumLength: number | null;
  ceilingHeight: number | null;
}

export interface AuditoriumConfig {
  rows: number;
  seatsPerRow: number;
  /** Number of seat blocks per row separated by centre aisles (1 = side aisles only). */
  sections: number;
  screenType: ScreenType;
  dimensions: AuditoriumDimensions;
  /** Per-type screen settings so switching type and back keeps edits. */
  screens: Record<ScreenType, ScreenConfig>;
}

export interface SeatId {
  /** 0-based row index (0 = row A, nearest the screen). */
  row: number;
  /** 0-based seat index (0 = seat 1, left-most from the viewer). */
  seat: number;
}

export interface SeatInfo extends SeatId {
  /** e.g. "H8" */
  label: string;
  /** e.g. "H" */
  rowLabel: string;
  /** 1-based seat number. */
  number: number;
  /** 0-based section (block) index. */
  section: number;
  /** Centre of the seat footprint on its row platform. */
  position: Vec3;
  /** Approximate seated eye position. */
  eye: Vec3;
}

/** A sample along a screen surface, in plan view, with its vertical extent. */
export interface SurfaceSample {
  x: number;
  z: number;
  bottom: number;
  top: number;
  /**
   * Panoramic content coordinate. The main screen spans P in [0, 1]
   * left->right. ScreenX side surfaces continue below 0 (left) and above 1 (right).
   */
  p: number;
}

export interface ResolvedScreen {
  type: ScreenType;
  width: number;
  height: number;
  bottom: number;
  top: number;
  centerY: number;
  /** Total arc angle in radians (0 = flat). */
  arc: number;
  /** Radius of curvature (Infinity when flat). */
  radius: number;
  /** How far the screen edges come towards the audience (m). */
  sagitta: number;
  /** Centre of the screen surface. */
  center: Vec3;
  /** Horizontal distance from screen centre to row A centre. */
  distance: number;
  /** ScreenX side surfaces (empty for other types). Each strip is ordered from screen edge outward. */
  sideStrips: { side: 'left' | 'right'; samples: SurfaceSample[] }[];
}

export interface AisleSpan {
  xMin: number;
  xMax: number;
  kind: 'side' | 'center';
}

export interface AuditoriumLayout {
  config: AuditoriumConfig;
  screen: ResolvedScreen;
  seats: SeatInfo[];
  /** z of each row's seat centres. */
  rowZ: number[];
  /** Platform (floor) height of each row. */
  rowFloorY: number[];
  rowWidth: number;
  width: number;
  height: number;
  length: number;
  frontWallZ: number;
  backWallZ: number;
  aisles: AisleSpan[];
  warnings: string[];
}

export interface ViewingMetrics {
  label: string;
  /** Eye-to-screen-centre straight-line distance (m). */
  distance: number;
  /** Horizontal angle subtended by the main screen (deg). */
  horizontalAngle: number;
  /** Vertical angle subtended by the main screen (deg). */
  verticalAngle: number;
  /** Lateral angle between line of sight to screen centre and screen axis (deg, + = seat right of centre). */
  offAxisAngle: number;
  /** Elevation from eye to screen centre (deg, + = looking up). */
  elevationAngle: number;
  /** Elevation from eye to top edge of the screen (deg). */
  topElevationAngle: number;
  /** Total horizontal span of all projection surfaces (deg, includes ScreenX sides). */
  panoramicCoverage: number;
  /** Panoramic coverage as % of the ~200 deg human horizontal visual field. */
  visualFieldPercent: number;
  /** ScreenX: horizontal span of left/right side surfaces (deg). */
  sideCoverage: { left: number; right: number };
  /** 0..100: how well aligned with the screen centre line the seat is. */
  centerAlignment: number;
  /** Human-readable position, e.g. "Middle, center-left". */
  relativePosition: string;
}

export interface ScoreBreakdown {
  immersion: number;
  alignment: number;
  vertical: number;
  distance: number;
  panoramic: number;
}

export interface SeatScore {
  label: string;
  /** 0..100 */
  score: number;
  /** 0.5..5 in half steps */
  stars: number;
  breakdown: ScoreBreakdown;
  metrics: ViewingMetrics;
}
