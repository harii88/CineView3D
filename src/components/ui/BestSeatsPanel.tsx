'use client';
import { useMemo, useState } from 'react';
import { useAuditorium } from '@/store/auditoriumStore';
import { useViewer } from '@/store/viewerStore';
import { defaultBestSeatCount, findBestSeats, findSeatByLabel, SCORING_PROFILES } from '@/lib/geometry';
import { SCREEN_TYPE_LABELS } from '@/lib/config/defaults';
import { runFindBestSeats } from '@/hooks/actions';
import { Button, Icon, SectionTitle, Stars, cx, focusRing } from './primitives';
import { fmtDeg, fmtM } from './SeatInformation';

export function BestSeatsPanel() {
  const layout = useAuditorium((s) => s.layout);
  const bestSeats = useViewer((s) => s.bestSeats);
  const showBest = useViewer((s) => s.showBest);
  const selected = useViewer((s) => s.selected);
  const { selectSeat, setShowBest } = useViewer.getState();
  const [count, setCount] = useState(() => defaultBestSeatCount(layout.seats.length));

  // Recomputed live from the current layout, so the list never goes stale.
  const best = useMemo(() => (bestSeats.length ? findBestSeats(layout, count) : []), [layout, count, bestSeats.length]);
  const profile = SCORING_PROFILES[layout.config.screenType];

  return (
    <div className="space-y-4">
      <SectionTitle>Best seats · {SCREEN_TYPE_LABELS[layout.config.screenType]}</SectionTitle>
      <p className="text-xs leading-relaxed text-white/55">
        Every seat is scored from its real 3D sight-lines: horizontal screen angle (ideal ≈ {profile.idealHorizontalAngle}° for
        this screen), off-axis angle, neck comfort and distance
        {profile.weights.panoramic > 0 ? ', plus balanced view of both ScreenX side walls' : ''}.
      </p>
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={() => runFindBestSeats(count)}>
          <Icon name="sparkles" className="h-3.5 w-3.5" /> Find best seats
        </Button>
        <label className="flex items-center gap-2 text-xs text-white/60">
          Show
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className={cx('h-8 rounded-lg border border-white/10 bg-black/40 px-2 text-white', focusRing)}
          >
            {[3, 5, 10, 12, 20].filter((n) => n <= layout.seats.length).concat(layout.seats.length < 3 ? [layout.seats.length] : []).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {bestSeats.length > 0 && (
          <label className="ml-auto flex items-center gap-1.5 text-xs text-white/60">
            <input type="checkbox" checked={showBest} onChange={(e) => setShowBest(e.target.checked)} className="accent-emerald-400" />
            Highlight
          </label>
        )}
      </div>

      {best.length > 0 && (
        <ol className="space-y-1.5" aria-label="Best seats, highest score first">
          {best.map((b, i) => {
            const seat = findSeatByLabel(layout, b.label)!;
            const isSel = selected && selected.row === seat.row && selected.seat === seat.seat;
            return (
              <li key={b.label}>
                <button
                  type="button"
                  onClick={() => selectSeat({ row: seat.row, seat: seat.seat })}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors',
                    focusRing,
                    isSel ? 'border-gold-400/60 bg-gold-400/10' : 'border-white/5 bg-black/20 hover:bg-white/5',
                  )}
                >
                  <span className="w-5 text-xs tabular-nums text-white/40">{i + 1}</span>
                  <span className="w-12 text-base font-semibold text-white">{b.label}</span>
                  <span className="flex-1 text-[11px] text-white/50">
                    {fmtM(b.metrics.distance)} · {fmtDeg(b.metrics.horizontalAngle)} wide · {Math.round(b.metrics.centerAlignment)}% centred
                  </span>
                  <span className="text-right">
                    <span className="block text-sm font-semibold tabular-nums text-emerald-300">{Math.round(b.score)}</span>
                    <Stars value={b.stars} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
