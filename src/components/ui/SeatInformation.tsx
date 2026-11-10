'use client';
import { useMemo, useState } from 'react';
import { useAuditorium } from '@/store/auditoriumStore';
import { useViewer } from '@/store/viewerStore';
import { calculateSeatScore, getSeatFromLayout, SCORING_PROFILES } from '@/lib/geometry';
import type { ScoreBreakdown, SeatScore } from '@/types';
import { Button, Icon, SectionTitle, Stars, cx } from './primitives';
import { SCREEN_TYPE_LABELS } from '@/lib/config/defaults';

export const fmtDeg = (v: number) => `${Math.round(v)}°`;
export const fmtM = (v: number) => `${v.toFixed(1)} m`;

export const BREAKDOWN_LABELS: Record<keyof ScoreBreakdown, { label: string; help: string }> = {
  immersion: { label: 'Immersion', help: 'How close the screen’s horizontal angle is to the ideal for this screen type' },
  alignment: { label: 'Alignment', help: 'How close you are to the screen centre line (0% at 45° off-axis)' },
  vertical: { label: 'Neck comfort', help: 'Penalises looking far up at the top edge, or down at the image' },
  distance: { label: 'Distance', help: 'Distance relative to screen width compared with the recommended range' },
  panoramic: { label: 'Panorama', help: 'ScreenX: balanced view of both side walls and total coverage' },
};

export function useSelectedScore(): SeatScore | null {
  const layout = useAuditorium((s) => s.layout);
  const selected = useViewer((s) => s.selected);
  return useMemo(() => {
    const seat = selected ? getSeatFromLayout(layout, selected.row, selected.seat) : null;
    return seat ? calculateSeatScore(seat, layout) : null;
  }, [layout, selected]);
}

export function SeatInformation() {
  const layout = useAuditorium((s) => s.layout);
  const score = useSelectedScore();
  const comparison = useViewer((s) => s.comparison);
  const selected = useViewer((s) => s.selected);
  const toggleCompare = useViewer((s) => s.toggleCompare);
  const setPanel = useViewer((s) => s.setPanel);
  const [showFormula, setShowFormula] = useState(false);

  if (!score || !selected) {
    return (
      <div className="flex flex-col items-center px-4 py-10 text-center">
        <div className="mb-3 rounded-2xl bg-white/5 p-3">
          <Icon name="seat" className="h-7 w-7 text-gold-400" />
        </div>
        <p className="font-semibold text-white">No seat selected</p>
        <p className="mt-1 text-sm text-white/55">Click a seat on the seat map or in the 3D view to sit down and see the view.</p>
      </div>
    );
  }

  const m = score.metrics;
  const profile = SCORING_PROFILES[layout.config.screenType];
  const inCompare = comparison.some((c) => c.row === selected.row && c.seat === selected.seat);
  const isScreenX = layout.screen.sideStrips.length > 0;
  const rows: [string, string, string?][] = [
    ['Distance from screen', fmtM(m.distance), 'Eye to screen centre'],
    ['Horizontal angle', fmtDeg(m.horizontalAngle), 'Screen width as seen from your eyes'],
    ['Vertical angle', fmtDeg(m.verticalAngle), 'Screen height as seen from your eyes'],
    ['Off-axis angle', `${fmtDeg(Math.abs(m.offAxisAngle))} ${m.offAxisAngle < -0.5 ? 'left' : m.offAxisAngle > 0.5 ? 'right' : ''}`],
    ['Look up to centre', fmtDeg(m.elevationAngle), `Top edge at ${fmtDeg(m.topElevationAngle)}`],
    [
      isScreenX ? 'Panoramic coverage' : 'Screen coverage',
      `${fmtDeg(m.panoramicCoverage)}`,
      `${Math.round(m.visualFieldPercent)}% of your ~200° horizontal vision`,
    ],
    ['Center alignment', `${Math.round(m.centerAlignment)}%`],
  ];
  if (isScreenX) rows.push(['Side walls (L / R)', `${fmtDeg(m.sideCoverage.left)} / ${fmtDeg(m.sideCoverage.right)}`]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <SectionTitle>Selected seat</SectionTitle>
          <div className="-mt-1 text-4xl font-semibold tracking-tight text-white">{m.label}</div>
          <div className="mt-1 text-sm text-white/55">
            Row {m.label.replace(/\d+$/, '')} — Seat {m.label.match(/\d+$/)?.[0]} · {m.relativePosition}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums text-gold-300">{Math.round(score.score)}</div>
          <Stars value={score.stars} />
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/40">Viewing rating</div>
        </div>
      </div>

      <dl className="divide-y divide-white/5 rounded-xl border border-white/5 bg-black/20">
        {rows.map(([k, v, hint]) => (
          <div key={k} className="flex items-center justify-between gap-3 px-3 py-2">
            <dt className="text-xs text-white/60">
              {k}
              {hint && <span className="block text-[10px] text-white/35">{hint}</span>}
            </dt>
            <dd className="text-sm font-medium tabular-nums text-white">{v}</dd>
          </div>
        ))}
      </dl>

      <div>
        <SectionTitle
          action={
            <button
              type="button"
              className="text-[11px] text-white/50 underline-offset-2 hover:text-white hover:underline"
              onClick={() => setShowFormula(!showFormula)}
              aria-expanded={showFormula}
            >
              {showFormula ? 'Hide formula' : 'How is this scored?'}
            </button>
          }
        >
          Score breakdown · {SCREEN_TYPE_LABELS[layout.config.screenType]}
        </SectionTitle>
        <ScoreBars breakdown={score.breakdown} weights={profile.weights} />
        {showFormula && (
          <div className="mt-3 space-y-1.5 rounded-xl bg-black/30 p-3 text-[11px] leading-relaxed text-white/60">
            <p>
              <b className="text-white/80">Score</b> = 100 × Σ(weight × component) / Σ weights. Components are 0–1 and come
              from the 3D geometry of this seat:
            </p>
            <p>
              Immersion = exp(−((H − {profile.idealHorizontalAngle}°) / {profile.horizontalTolerance}°)²), with H = horizontal
              screen angle ({fmtDeg(m.horizontalAngle)}).
            </p>
            <p>Alignment = max(0, 1 − |off-axis| / 45°).</p>
            <p>
              Neck comfort = 1 while the top edge is ≤ {profile.maxTopElevation}° above eye level and the centre is ≥{' '}
              {profile.minCenterElevation}°; Gaussian fall-off ({profile.verticalSoftness}°) beyond.
            </p>
            <p>
              Distance = 1 when distance / screen width is within {profile.distanceRatio.min}–{profile.distanceRatio.max}{' '}
              (now {(m.distance / layout.screen.width).toFixed(2)}).
            </p>
            {profile.weights.panoramic > 0 && <p>Panorama = 0.6 × left/right symmetry + 0.4 × min(1, coverage / {profile.idealPanoramicCoverage}°).</p>}
            <p className="text-white/40">Profiles are defined in lib/geometry/seatScoring.ts and can be tuned there.</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button className="flex-1" variant={inCompare ? 'glass' : 'primary'} onClick={() => toggleCompare(selected)}>
          <Icon name="compare" className="h-3.5 w-3.5" />
          {inCompare ? 'Remove from comparison' : 'Add to comparison'}
        </Button>
        {comparison.length > 0 && (
          <Button variant="ghost" onClick={() => setPanel('compare')}>
            View ({comparison.length})
          </Button>
        )}
      </div>
    </div>
  );
}

export function ScoreBars({ breakdown, weights }: { breakdown: ScoreBreakdown; weights: ScoreBreakdown }) {
  const keys = (Object.keys(BREAKDOWN_LABELS) as (keyof ScoreBreakdown)[]).filter((k) => weights[k] > 0);
  return (
    <ul className="space-y-2">
      {keys.map((k) => {
        const v = breakdown[k];
        return (
          <li key={k} title={BREAKDOWN_LABELS[k].help}>
            <div className="mb-1 flex justify-between text-[11px] text-white/60">
              <span>
                {BREAKDOWN_LABELS[k].label} <span className="text-white/30">× {weights[k]}</span>
              </span>
              <span className="tabular-nums text-white/80">{Math.round(v * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={BREAKDOWN_LABELS[k].label}>
              <div
                className={cx('h-full rounded-full', v > 0.75 ? 'bg-emerald-400' : v > 0.45 ? 'bg-gold-400' : 'bg-rose-400')}
                style={{ width: `${Math.max(2, v * 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
