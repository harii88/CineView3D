'use client';
import { useMemo } from 'react';
import type { AuditoriumLayout, SeatScore } from '@/types';
import { scoreAllSeats } from '@/lib/geometry';
import { useAuditorium } from '@/store/auditoriumStore';

const cache = new WeakMap<AuditoriumLayout, SeatScore[]>();

/** Scores for every seat (index = row * seatsPerRow + seat). Cached per layout object. */
export function getSeatScores(layout: AuditoriumLayout): SeatScore[] {
  let s = cache.get(layout);
  if (!s) {
    s = scoreAllSeats(layout);
    cache.set(layout, s);
  }
  return s;
}

export function useSeatScores(): SeatScore[] {
  const layout = useAuditorium((s) => s.layout);
  return useMemo(() => getSeatScores(layout), [layout]);
}

/** Map a 0..100 score onto a perceptual red→amber→green ramp. */
export function scoreColor(score: number): string {
  const t = Math.max(0, Math.min(1, (score - 30) / 65));
  const hue = 0 + t * 140;
  const light = 42 + t * 8;
  return `hsl(${hue.toFixed(0)}, 70%, ${light.toFixed(0)}%)`;
}
