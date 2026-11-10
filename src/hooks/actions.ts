'use client';
import { findBestSeats, findSeatByLabel, defaultBestSeatCount } from '@/lib/geometry';
import { useAuditorium } from '@/store/auditoriumStore';
import { useViewer } from '@/store/viewerStore';

/** Compute and highlight the best seats for the current auditorium. */
export function runFindBestSeats(count?: number) {
  const layout = useAuditorium.getState().layout;
  const best = findBestSeats(layout, count ?? defaultBestSeatCount(layout.seats.length));
  const v = useViewer.getState();
  v.setBestSeats(best.map((b) => b.label));
  return best;
}

/** Jump to a seat from free text ("H8", "row h seat 8"). Returns an error message or null. */
export function goToSeatText(text: string): string | null {
  const layout = useAuditorium.getState().layout;
  const t = text.trim();
  if (!t) return 'Type a seat, e.g. H8.';
  const seat = findSeatByLabel(layout, t);
  if (!seat) {
    return `No seat "${t}" here — rows A–${layout.seats[layout.seats.length - 1].rowLabel}, seats 1–${layout.config.seatsPerRow}.`;
  }
  useViewer.getState().selectSeat({ row: seat.row, seat: seat.seat });
  return null;
}
