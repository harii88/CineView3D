import type { SeatId } from '@/types';

/**
 * Row label for a 0-based row index using spreadsheet-style lettering:
 * 0 -> A, 25 -> Z, 26 -> AA, 27 -> AB, ... 701 -> ZZ, 702 -> AAA.
 */
export function getRowLabel(rowIndex: number): string {
  if (!Number.isInteger(rowIndex) || rowIndex < 0) throw new RangeError(`Invalid row index ${rowIndex}`);
  let n = rowIndex + 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

/** Inverse of getRowLabel. Returns -1 for invalid input. */
export function parseRowLabel(label: string): number {
  const s = label.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(s)) return -1;
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** "H8" for rowIndex 7, seatIndex 7. Seat numbers are 1-based, left to right from the viewer. */
export function getSeatLabel(rowIndex: number, seatIndex: number): string {
  if (!Number.isInteger(seatIndex) || seatIndex < 0) throw new RangeError(`Invalid seat index ${seatIndex}`);
  return `${getRowLabel(rowIndex)}${seatIndex + 1}`;
}

export function describeSeat(rowIndex: number, seatIndex: number): string {
  return `Row ${getRowLabel(rowIndex)} — Seat ${seatIndex + 1}`;
}

export function accessibleSeatLabel(rowIndex: number, seatIndex: number): string {
  return `Seat ${getSeatLabel(rowIndex, seatIndex)}, Row ${getRowLabel(rowIndex)}, Seat ${seatIndex + 1}`;
}

/**
 * Parse free-form seat references:
 *   "H8", "h8", "H 8", "H-8", "Row H Seat 8", "row h, seat 8", "AA12".
 * Returns null if the text is not a seat reference. Bounds are checked when
 * `rows`/`seatsPerRow` are given.
 */
export function parseSeatLabel(input: string, rows?: number, seatsPerRow?: number): SeatId | null {
  if (typeof input !== 'string') return null;
  const m = input
    .trim()
    .match(/^(?:row\s*)?([a-z]{1,3})\s*[,\-–—:/]?\s*(?:seat\s*|no\.?\s*|#\s*)?(\d{1,3})$/i);
  if (!m) return null;
  const row = parseRowLabel(m[1]);
  const seat = parseInt(m[2], 10) - 1;
  if (row < 0 || seat < 0) return null;
  if (rows !== undefined && row >= rows) return null;
  if (seatsPerRow !== undefined && seat >= seatsPerRow) return null;
  return { row, seat };
}
