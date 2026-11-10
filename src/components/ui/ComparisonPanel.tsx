'use client';
import { useMemo } from 'react';
import { useAuditorium } from '@/store/auditoriumStore';
import { MAX_COMPARE, useViewer } from '@/store/viewerStore';
import { compareSeats, getSeatFromLayout } from '@/lib/geometry';
import type { SeatInfo, SeatScore } from '@/types';
import { Button, Icon, SectionTitle, Stars, cx, focusRing } from './primitives';
import { SeatSearch } from '@/components/seat-map/SeatMap';
import { fmtDeg, fmtM } from './SeatInformation';

export function ComparisonPanel() {
  const layout = useAuditorium((s) => s.layout);
  const comparison = useViewer((s) => s.comparison);
  const selected = useViewer((s) => s.selected);
  const { toggleCompare, removeCompare, clearCompare, selectSeat } = useViewer.getState();

  const result = useMemo(() => {
    const seats = comparison.map((c) => getSeatFromLayout(layout, c.row, c.seat)).filter(Boolean) as SeatInfo[];
    return compareSeats(seats, layout);
  }, [comparison, layout]);

  const canAddSelected =
    selected && !comparison.some((c) => c.row === selected.row && c.seat === selected.seat) && comparison.length < MAX_COMPARE;

  const rows: { label: string; get: (s: SeatScore) => string; best?: (s: SeatScore) => number }[] = [
    { label: 'Distance', get: (s) => fmtM(s.metrics.distance) },
    { label: 'Horizontal angle', get: (s) => fmtDeg(s.metrics.horizontalAngle), best: (s) => s.breakdown.immersion },
    { label: 'Vertical angle', get: (s) => fmtDeg(s.metrics.verticalAngle) },
    { label: 'Look-up to centre', get: (s) => fmtDeg(s.metrics.elevationAngle), best: (s) => s.breakdown.vertical },
    { label: 'Screen coverage', get: (s) => fmtDeg(s.metrics.panoramicCoverage) },
    { label: 'Center alignment', get: (s) => `${Math.round(s.metrics.centerAlignment)}%`, best: (s) => s.metrics.centerAlignment },
    { label: 'Overall score', get: (s) => String(Math.round(s.score)), best: (s) => s.score },
  ];

  const winner = (fn?: (s: SeatScore) => number) => {
    if (!fn || result.scores.length < 2) return null;
    const vals = result.scores.map(fn);
    const max = Math.max(...vals);
    return vals.filter((v) => Math.abs(v - max) < 1e-9).length === 1 ? result.scores[vals.indexOf(max)].label : null;
  };

  return (
    <div className="space-y-4">
      <SectionTitle
        action={
          comparison.length > 0 && (
            <button type="button" onClick={clearCompare} className={cx('text-[11px] text-white/50 hover:text-white', focusRing)}>
              Clear all
            </button>
          )
        }
      >
        Compare seats ({comparison.length}/{MAX_COMPARE})
      </SectionTitle>

      <div className="flex flex-wrap items-center gap-2">
        {canAddSelected && (
          <Button size="sm" variant="primary" onClick={() => toggleCompare(selected!)}>
            <Icon name="plus" className="h-3.5 w-3.5" /> Add {getSeatFromLayout(layout, selected!.row, selected!.seat)?.label}
          </Button>
        )}
        <p className="text-xs text-white/45">Select a seat, then add it here. Up to {MAX_COMPARE} seats.</p>
      </div>

      {result.scores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/50">
          No seats in the comparison yet.
          <div className="mt-3 flex justify-center">
            <SeatSearch />
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
          <table className="w-full text-sm">
            <caption className="sr-only">Seat comparison</caption>
            <thead>
              <tr className="border-b border-white/5">
                <th scope="col" className="px-3 py-2 text-left text-[11px] font-medium text-white/40">
                  Metric
                </th>
                {result.scores.map((s, i) => (
                  <th key={s.label} scope="col" className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-400/80 text-[9px] text-ink-950">{i + 1}</span>
                      <button
                        type="button"
                        className={cx('font-semibold text-white underline-offset-2 hover:underline', focusRing)}
                        onClick={() => selectSeat(comparison[i])}
                        title={`Sit in ${s.label}`}
                      >
                        {s.label}
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${s.label} from comparison`}
                        onClick={() => removeCompare(comparison[i])}
                        className={cx('rounded p-0.5 text-white/40 hover:text-white', focusRing)}
                      >
                        <Icon name="x" className="h-3 w-3" />
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const w = winner(r.best);
                return (
                  <tr key={r.label} className="border-b border-white/5 last:border-0">
                    <th scope="row" className="px-3 py-2 text-left text-xs font-normal text-white/60">
                      {r.label}
                    </th>
                    {result.scores.map((s) => (
                      <td
                        key={s.label}
                        className={cx('px-2 py-2 text-right tabular-nums', w === s.label ? 'font-semibold text-emerald-300' : 'text-white/85')}
                      >
                        {r.get(s)}
                        {w === s.label && <span className="sr-only"> (best)</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
              <tr>
                <th scope="row" className="px-3 py-2 text-left text-xs font-normal text-white/60">
                  Rating
                </th>
                {result.scores.map((s) => (
                  <td key={s.label} className="px-2 py-2 text-right">
                    <Stars value={s.stars} className="justify-end" />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {result.winners.score && (
        <p className="text-sm text-white/70">
          <span className="font-semibold text-emerald-300">{result.winners.score}</span> has the best overall view of these
          seats.
        </p>
      )}
    </div>
  );
}
