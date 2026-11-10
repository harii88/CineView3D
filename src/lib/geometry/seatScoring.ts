import type { AuditoriumLayout, ScoreBreakdown, ScreenType, SeatInfo, SeatScore, ViewingMetrics } from '@/types';
import { getViewingMetrics } from './viewingAngles';

/**
 * SEAT SCORING — transparent and configurable.
 *
 * Each component is a number in 0..1 computed from the viewing geometry:
 *
 *  immersion  = exp(-((H - idealH) / tolH)^2)
 *               H = horizontal angle subtended by the screen. References: SMPTE
 *               recommends ≥30°, THX ~36–40° for standard cinema; large-format
 *               screens are designed to fill far more of your vision.
 *  alignment  = centerAlignment / 100 = max(0, 1 - |offAxis| / 45°)
 *  vertical   = topComfort × downComfort
 *               topComfort  = 1 if top-of-screen elevation ≤ maxTop, else exp(-((top - maxTop)/soft)^2)
 *               downComfort = 1 if centre elevation ≥ minCenter, else exp(-((minCenter - c)/soft)^2)
 *  distance   = 1 if distance/screenWidth within [minRatio, maxRatio],
 *               else exp(-(gap / sigma)^2)
 *  panoramic  = (ScreenX only) 0.6 × left/right side symmetry + 0.4 × min(1, coverage / idealCoverage)
 *
 *  score = 100 × Σ(weight_i × component_i) / Σ(weight_i)
 *  stars = round(score / 10) / 2, at least 0.5
 */

export interface ScoringProfile {
  idealHorizontalAngle: number;
  horizontalTolerance: number;
  distanceRatio: { min: number; max: number; sigma: number };
  maxTopElevation: number;
  minCenterElevation: number;
  verticalSoftness: number;
  idealPanoramicCoverage: number;
  weights: ScoreBreakdown;
}

export const SCORING_PROFILES: Record<ScreenType, ScoringProfile> = {
  standard: {
    idealHorizontalAngle: 40,
    horizontalTolerance: 14,
    distanceRatio: { min: 1.0, max: 1.9, sigma: 0.5 },
    maxTopElevation: 30,
    minCenterElevation: -8,
    verticalSoftness: 10,
    idealPanoramicCoverage: 0,
    weights: { immersion: 0.35, alignment: 0.3, vertical: 0.2, distance: 0.15, panoramic: 0 },
  },
  imax: {
    idealHorizontalAngle: 62,
    horizontalTolerance: 18,
    distanceRatio: { min: 0.55, max: 1.2, sigma: 0.35 },
    maxTopElevation: 38,
    minCenterElevation: -5,
    verticalSoftness: 10,
    idealPanoramicCoverage: 0,
    weights: { immersion: 0.35, alignment: 0.25, vertical: 0.25, distance: 0.15, panoramic: 0 },
  },
  screenx: {
    idealHorizontalAngle: 42,
    horizontalTolerance: 14,
    distanceRatio: { min: 1.0, max: 1.9, sigma: 0.5 },
    maxTopElevation: 30,
    minCenterElevation: -8,
    verticalSoftness: 10,
    idealPanoramicCoverage: 220,
    weights: { immersion: 0.25, alignment: 0.25, vertical: 0.15, distance: 0.1, panoramic: 0.25 },
  },
  custom: {
    idealHorizontalAngle: 40,
    horizontalTolerance: 14,
    distanceRatio: { min: 1.0, max: 1.9, sigma: 0.5 },
    maxTopElevation: 30,
    minCenterElevation: -8,
    verticalSoftness: 10,
    idealPanoramicCoverage: 0,
    weights: { immersion: 0.35, alignment: 0.3, vertical: 0.2, distance: 0.15, panoramic: 0 },
  },
};

const gauss = (x: number, sigma: number) => Math.exp(-((x / sigma) ** 2));

export function scoreComponents(metrics: ViewingMetrics, layout: AuditoriumLayout, profile: ScoringProfile): ScoreBreakdown {
  const immersion = gauss(metrics.horizontalAngle - profile.idealHorizontalAngle, profile.horizontalTolerance);
  const alignment = metrics.centerAlignment / 100;

  const topOver = metrics.topElevationAngle - profile.maxTopElevation;
  const topComfort = topOver <= 0 ? 1 : gauss(topOver, profile.verticalSoftness);
  const downUnder = profile.minCenterElevation - metrics.elevationAngle;
  const downComfort = downUnder <= 0 ? 1 : gauss(downUnder, profile.verticalSoftness);
  const vertical = topComfort * downComfort;

  const ratio = metrics.distance / layout.screen.width;
  const { min, max, sigma } = profile.distanceRatio;
  const gap = ratio < min ? min - ratio : ratio > max ? ratio - max : 0;
  const distance = gauss(gap, sigma);

  let panoramic = 0;
  if (profile.weights.panoramic > 0 && profile.idealPanoramicCoverage > 0) {
    const { left, right } = metrics.sideCoverage;
    const symmetry = left + right > 1e-6 ? 1 - Math.abs(left - right) / (left + right) : 0;
    const coverage = Math.min(1, metrics.panoramicCoverage / profile.idealPanoramicCoverage);
    panoramic = 0.6 * symmetry + 0.4 * coverage;
  }
  return { immersion, alignment, vertical, distance, panoramic };
}

export function combineScore(b: ScoreBreakdown, weights: ScoreBreakdown): number {
  const keys = Object.keys(weights) as (keyof ScoreBreakdown)[];
  let sum = 0;
  let wsum = 0;
  for (const k of keys) {
    sum += weights[k] * b[k];
    wsum += weights[k];
  }
  return wsum > 0 ? (100 * sum) / wsum : 0;
}

export function scoreToStars(score: number): number {
  return Math.max(0.5, Math.min(5, Math.round(score / 10) / 2));
}

export function calculateSeatScore(
  seat: SeatInfo,
  layout: AuditoriumLayout,
  profile: ScoringProfile = SCORING_PROFILES[layout.config.screenType],
): SeatScore {
  const metrics = getViewingMetrics(seat, layout);
  const breakdown = scoreComponents(metrics, layout, profile);
  const score = combineScore(breakdown, profile.weights);
  return { label: seat.label, score, stars: scoreToStars(score), breakdown, metrics };
}

/** Score every seat. */
export function scoreAllSeats(layout: AuditoriumLayout, profile?: ScoringProfile): SeatScore[] {
  return layout.seats.map((s) => calculateSeatScore(s, layout, profile));
}

export function defaultBestSeatCount(totalSeats: number) {
  return Math.max(1, Math.min(12, Math.round(totalSeats * 0.1)));
}

/**
 * Rank seats by computed score. Ties are broken by closeness to the centre
 * line, then by row (front first) so results are deterministic.
 */
export function findBestSeats(layout: AuditoriumLayout, count = defaultBestSeatCount(layout.seats.length), profile?: ScoringProfile): SeatScore[] {
  const scored = layout.seats.map((seat) => ({ seat, s: calculateSeatScore(seat, layout, profile) }));
  scored.sort(
    (a, b) =>
      b.s.score - a.s.score ||
      Math.abs(a.seat.position.x) - Math.abs(b.seat.position.x) ||
      a.seat.row - b.seat.row ||
      a.seat.seat - b.seat.seat,
  );
  return scored.slice(0, Math.max(0, count)).map((x) => x.s);
}

export interface SeatComparison {
  scores: SeatScore[];
  /** Label of the seat that wins each criterion (higher is better). */
  winners: { score?: string; alignment?: string; immersion?: string; vertical?: string };
}

export function compareSeats(seats: SeatInfo[], layout: AuditoriumLayout): SeatComparison {
  const scores = seats.map((s) => calculateSeatScore(s, layout));
  const best = (fn: (s: SeatScore) => number) => {
    if (scores.length < 2) return undefined;
    let top = scores[0];
    for (const s of scores) if (fn(s) > fn(top) + 1e-9) top = s;
    const tie = scores.filter((s) => Math.abs(fn(s) - fn(top)) < 1e-9).length > 1;
    return tie ? undefined : top.label;
  };
  return {
    scores,
    winners: {
      score: best((s) => s.score),
      alignment: best((s) => s.breakdown.alignment),
      immersion: best((s) => s.breakdown.immersion),
      vertical: best((s) => s.breakdown.vertical),
    },
  };
}
