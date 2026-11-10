'use client';
import { memo } from 'react';
import type { SeatInfo } from '@/types';
import { accessibleSeatLabel } from '@/lib/geometry';
import { cx } from '@/components/ui/primitives';

export type SeatVisualState = {
  selected: boolean;
  best: boolean;
  compareIndex: number; // -1 when not compared
  hovered: boolean;
  heat: string | null;
  focusable: boolean;
};

interface Props {
  seat: SeatInfo;
  left: number;
  top: number;
  width: number;
  height: number;
  state: SeatVisualState;
  index: number;
}

/** One seat on the 2D map. Purely presentational; events are delegated to the grid. */
export const SeatMapSeat = memo(function SeatMapSeat({ seat, left, top, width, height, state, index }: Props) {
  const { selected, best, compareIndex, hovered, heat, focusable } = state;
  const extra = [selected && 'selected', best && 'recommended', compareIndex >= 0 && `in comparison ${compareIndex + 1}`]
    .filter(Boolean)
    .join(', ');
  return (
    <div role="gridcell" aria-selected={selected} className="absolute" style={{ left, top, width, height }}>
      <button
        type="button"
        data-seat-index={index}
        tabIndex={focusable ? 0 : -1}
        aria-label={accessibleSeatLabel(seat.row, seat.seat) + (extra ? `, ${extra}` : '')}
        aria-pressed={selected}
        className={cx(
          'relative h-full w-full rounded-t-[40%] rounded-b-md border text-[9px] font-semibold leading-none transition-[transform,background-color,box-shadow] duration-150',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
          selected
            ? 'z-10 scale-110 border-gold-300 bg-gold-400 text-ink-950 shadow-[0_0_14px_rgba(239,191,90,0.75)]'
            : compareIndex >= 0
              ? 'border-sky-300 bg-sky-500/80 text-white'
              : best
                ? 'border-emerald-300/80 bg-emerald-500/70 text-white'
                : heat
                  ? 'border-black/20 text-black/70'
                  : 'border-white/10 bg-velvet-600/80 text-white/70 hover:bg-velvet-500',
          hovered && !selected && 'scale-110 ring-2 ring-white/70',
        )}
        style={heat && !selected && compareIndex < 0 && !best ? { backgroundColor: heat } : undefined}
      >
        {width >= 20 ? seat.number : ''}
        {compareIndex >= 0 && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-200 text-[8px] text-ink-950">
            {compareIndex + 1}
          </span>
        )}
      </button>
    </div>
  );
});
