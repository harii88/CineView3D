'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useAuditorium } from '@/store/auditoriumStore';
import { useViewer } from '@/store/viewerStore';
import { scoreColor, useSeatScores } from '@/hooks/useSeatScores';
import { describeSeat, sampleMainScreen } from '@/lib/geometry';
import { runFindBestSeats, goToSeatText } from '@/hooks/actions';
import { Button, Icon, cx, focusRing } from '@/components/ui/primitives';
import { SeatMapSeat } from './SeatMapSeat';

const GUTTER = 34; // px for row labels
const SCREEN_Y = 18;

/**
 * 2D seat map drawn from the SAME physical layout as the 3D scene:
 * horizontal positions are true to scale (seat widths, spacing, aisles,
 * screen width); vertical spacing is uniform per row (rows are evenly spaced
 * physically, so this is a linear z mapping with a compressed screen gap).
 */
export function SeatMap() {
  const layout = useAuditorium((s) => s.layout);
  const scores = useSeatScores();
  const selected = useViewer((s) => s.selected);
  const hovered = useViewer((s) => s.hovered);
  const comparison = useViewer((s) => s.comparison);
  const bestSeats = useViewer((s) => s.bestSeats);
  const showBest = useViewer((s) => s.showBest);
  const heatmap = useViewer((s) => s.heatmap);
  const seatMapOpen = useViewer((s) => s.seatMapOpen);
  const { selectSeat, setHovered, setHeatmap, setShowBest } = useViewer.getState();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(800);
  const [zoom, setZoom] = useState(1);
  const [focusIdx, setFocusIdx] = useState(0);
  const [tip, setTip] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setContainerW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { config } = layout;
  const d = config.dimensions;
  const pitch = d.seatWidth + d.seatSpacing;

  const geo = useMemo(() => {
    const seatsAcross = layout.width / pitch;
    const pxPerPitch = Math.min(36, Math.max(18, (containerW - GUTTER * 2 - 8) / seatsAcross)) * zoom;
    const scale = pxPerPitch / pitch;
    const rowGap = Math.max(22, Math.min(40, pxPerPitch * 1.08));
    const rowAY = SCREEN_Y + 46;
    const z0 = layout.rowZ[0];
    const zToY = (z: number) =>
      z <= z0 ? SCREEN_Y + (Math.max(z, 0) / z0) * (rowAY - SCREEN_Y) : rowAY + ((z - z0) / d.rowSpacing) * rowGap;
    const xToPx = (x: number) => GUTTER + (x + layout.width / 2) * scale;
    const seatW = Math.max(12, d.seatWidth * scale);
    const seatH = Math.min(seatW, rowGap * 0.78);
    const width = layout.width * scale + GUTTER * 2;
    const height = zToY(layout.rowZ[layout.rowZ.length - 1]) + seatH + 18;
    return { scale, rowGap, zToY, xToPx, seatW, seatH, width, height };
  }, [layout, containerW, zoom, pitch, d.seatWidth, d.rowSpacing]);

  const spr = config.seatsPerRow;
  const idxOf = (s: { row: number; seat: number }) => s.row * spr + s.seat;
  const selectedIdx = selected ? idxOf(selected) : -1;
  const hoveredIdx = hovered ? idxOf(hovered) : -1;
  const bestSet = useMemo(() => new Set(showBest ? bestSeats : []), [showBest, bestSeats]);
  const compareIdx = useMemo(() => comparison.map(idxOf), [comparison, spr]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedIdx >= 0) setFocusIdx(selectedIdx);
  }, [selectedIdx]);
  useEffect(() => {
    if (focusIdx >= layout.seats.length) setFocusIdx(0);
  }, [layout.seats.length, focusIdx]);

  // Keep the selected seat visible.
  useEffect(() => {
    if (selectedIdx < 0) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-seat-index="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [selectedIdx]);

  const screenPath = useMemo(() => {
    const pts = sampleMainScreen(layout.screen, 24).map((s) => `${geo.xToPx(s.x)},${geo.zToY(s.z)}`);
    const strips = layout.screen.sideStrips.map((st) =>
      st.samples.map((s) => `${geo.xToPx(s.x)},${geo.zToY(s.z)}`).join(' '),
    );
    return { main: pts.join(' '), strips };
  }, [layout, geo]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const r = Math.floor(focusIdx / spr);
    const s = focusIdx % spr;
    let next = focusIdx;
    switch (e.key) {
      case 'ArrowLeft':
        next = r * spr + Math.max(0, s - 1);
        break;
      case 'ArrowRight':
        next = r * spr + Math.min(spr - 1, s + 1);
        break;
      case 'ArrowUp':
        next = Math.max(0, r - 1) * spr + s;
        break;
      case 'ArrowDown':
        next = Math.min(config.rows - 1, r + 1) * spr + s;
        break;
      case 'Home':
        next = r * spr;
        break;
      case 'End':
        next = r * spr + spr - 1;
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const seat = layout.seats[focusIdx];
        if (seat) selectSeat({ row: seat.row, seat: seat.seat });
        return;
      }
      default:
        return;
    }
    e.preventDefault();
    setFocusIdx(next);
    setTip(next);
    const seat = layout.seats[next];
    if (seat) setHovered({ row: seat.row, seat: seat.seat });
    requestAnimationFrame(() =>
      scrollRef.current?.querySelector<HTMLElement>(`[data-seat-index="${next}"]`)?.focus(),
    );
  };

  const seatFromEvent = (target: EventTarget) => {
    const el = (target as HTMLElement).closest?.('[data-seat-index]') as HTMLElement | null;
    return el ? Number(el.dataset.seatIndex) : -1;
  };

  const tipSeat = tip !== null ? layout.seats[tip] : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SeatMapToolbar
        zoom={zoom}
        setZoom={setZoom}
        heatmap={heatmap}
        setHeatmap={setHeatmap}
        showBest={showBest}
        hasBest={bestSeats.length > 0}
        setShowBest={setShowBest}
      />
      <div ref={scrollRef} className={cx('relative min-h-0 flex-1 overflow-auto overscroll-contain px-2 pb-3', !seatMapOpen && 'hidden')}>
        <div className="relative mx-auto" style={{ width: geo.width, height: geo.height }}>
          {/* Room outline, screen and ScreenX side surfaces */}
          <svg className="pointer-events-none absolute inset-0" width={geo.width} height={geo.height} aria-hidden="true">
            <defs>
              <linearGradient id="scr" x1="0" x2="1">
                <stop offset="0" stopColor="#f5d28a" stopOpacity="0.3" />
                <stop offset="0.5" stopColor="#fff6dc" />
                <stop offset="1" stopColor="#f5d28a" stopOpacity="0.3" />
              </linearGradient>
              <radialGradient id="glow" cx="0.5" cy="0" r="0.8">
                <stop offset="0" stopColor="#f5d28a" stopOpacity="0.16" />
                <stop offset="1" stopColor="#f5d28a" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect
              x={GUTTER}
              y={4}
              width={geo.width - GUTTER * 2}
              height={geo.height - 8}
              rx={10}
              fill="url(#glow)"
              stroke="rgba(255,255,255,0.08)"
            />
            {screenPath.strips.map((p, i) => (
              <polyline key={i} points={p} fill="none" stroke="#f5d28a" strokeOpacity="0.55" strokeWidth={4} strokeLinecap="round" />
            ))}
            <polyline points={screenPath.main} fill="none" stroke="url(#scr)" strokeWidth={5} strokeLinecap="round" />
            <text x={geo.width / 2} y={SCREEN_Y + 20} textAnchor="middle" className="fill-white/40 text-[10px] tracking-[0.3em]">
              SCREEN · {layout.screen.width.toFixed(1)} m
            </text>
            <text
              x={geo.width / 2}
              y={(SCREEN_Y + geo.zToY(layout.rowZ[0])) / 2 + 12}
              textAnchor="middle"
              className="fill-white/25 text-[9px]"
            >
              ↕ {layout.screen.distance.toFixed(1)} m to row A
            </text>
          </svg>

          {/* Row labels */}
          {layout.rowZ.map((z, r) => {
            const top = geo.zToY(z) - geo.seatH / 2;
            const label = layout.seats[r * spr].rowLabel;
            return (
              <div key={r} aria-hidden="true">
                <span
                  className="absolute w-6 text-center text-[10px] font-semibold text-white/40"
                  style={{ left: 4, top, lineHeight: `${geo.seatH}px` }}
                >
                  {label}
                </span>
                <span
                  className="absolute w-6 text-center text-[10px] font-semibold text-white/40"
                  style={{ left: geo.width - 28, top, lineHeight: `${geo.seatH}px` }}
                >
                  {label}
                </span>
              </div>
            );
          })}

          <div
            role="grid"
            aria-label={`Seat map, ${config.rows} rows of ${spr} seats. Use arrow keys to move and Enter to sit.`}
            aria-rowcount={config.rows}
            aria-colcount={spr}
            data-own-keys
            onKeyDown={onKey}
            onClick={(e) => {
              const i = seatFromEvent(e.target);
              const seat = layout.seats[i];
              if (seat) {
                setFocusIdx(i);
                selectSeat({ row: seat.row, seat: seat.seat });
              }
            }}
            onPointerOver={(e) => {
              const i = seatFromEvent(e.target);
              if (i >= 0) {
                setTip(i);
                const seat = layout.seats[i];
                setHovered({ row: seat.row, seat: seat.seat });
              }
            }}
            onPointerLeave={() => {
              setTip(null);
              setHovered(null);
            }}
            onFocus={(e) => {
              const i = seatFromEvent(e.target);
              if (i >= 0) setTip(i);
            }}
            onBlur={() => setTip(null)}
          >
            {Array.from({ length: config.rows }, (_, r) => (
              <div role="row" key={r} aria-label={`Row ${layout.seats[r * spr].rowLabel}`}>
                {layout.seats.slice(r * spr, r * spr + spr).map((seat) => {
                  const i = r * spr + seat.seat;
                  return (
                    <SeatMapSeat
                      key={seat.label}
                      seat={seat}
                      index={i}
                      left={geo.xToPx(seat.position.x) - geo.seatW / 2}
                      top={geo.zToY(seat.position.z) - geo.seatH / 2}
                      width={geo.seatW}
                      height={geo.seatH}
                      state={{
                        selected: i === selectedIdx,
                        best: bestSet.has(seat.label),
                        compareIndex: compareIdx.indexOf(i),
                        hovered: i === hoveredIdx,
                        heat: heatmap ? scoreColor(scores[i]?.score ?? 0) : null,
                        focusable: i === focusIdx,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {tipSeat && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/15 bg-black/85 px-2.5 py-1.5 text-xs text-white shadow-xl"
              style={{
                left: geo.xToPx(tipSeat.position.x),
                top: Math.max(0, geo.zToY(tipSeat.position.z) - geo.seatH / 2 - 34),
              }}
            >
              <span className="font-semibold">{describeSeat(tipSeat.row, tipSeat.seat)}</span>
              {scores[tip!] && <span className="ml-2 text-white/60">score {Math.round(scores[tip!].score)}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SeatMapToolbar({
  zoom,
  setZoom,
  heatmap,
  setHeatmap,
  showBest,
  hasBest,
  setShowBest,
}: {
  zoom: number;
  setZoom: (z: number) => void;
  heatmap: boolean;
  setHeatmap: (v: boolean) => void;
  showBest: boolean;
  hasBest: boolean;
  setShowBest: (v: boolean) => void;
}) {
  const seatMapOpen = useViewer((s) => s.seatMapOpen);
  const setSeatMapOpen = useViewer((s) => s.setSeatMapOpen);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-3 py-2">
      <button
        type="button"
        onClick={() => setSeatMapOpen(!seatMapOpen)}
        aria-expanded={seatMapOpen}
        className={cx('flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm font-semibold text-white', focusRing)}
      >
        <Icon name={seatMapOpen ? 'chevronDown' : 'chevronUp'} />
        Seat map
      </button>
      {seatMapOpen && (
        <>
          <SeatSearch />
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant={showBest ? 'primary' : 'glass'}
              onClick={() => {
                if (hasBest && showBest) setShowBest(false);
                else runFindBestSeats();
              }}
              aria-pressed={showBest}
            >
              <Icon name="sparkles" className="h-3.5 w-3.5" />
              {showBest ? 'Hide best seats' : 'Find best seats'}
            </Button>
            <Button size="sm" variant={heatmap ? 'primary' : 'glass'} onClick={() => setHeatmap(!heatmap)} aria-pressed={heatmap}>
              Score heatmap
            </Button>
            <div className="flex items-center rounded-full border border-white/10 bg-white/[0.04]">
              <button
                type="button"
                aria-label="Zoom out seat map"
                onClick={() => setZoom(Math.max(0.6, zoom - 0.2))}
                className={cx('h-8 w-8 rounded-full text-white/70 hover:text-white', focusRing)}
              >
                −
              </button>
              <span className="w-10 text-center text-xs tabular-nums text-white/60">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                aria-label="Zoom in seat map"
                onClick={() => setZoom(Math.min(2.4, zoom + 0.2))}
                className={cx('h-8 w-8 rounded-full text-white/70 hover:text-white', focusRing)}
              >
                +
              </button>
            </div>
            <Legend heatmap={heatmap} />
          </div>
        </>
      )}
    </div>
  );
}

function Legend({ heatmap }: { heatmap: boolean }) {
  const item = (cls: string, label: string, style?: CSSProperties) => (
    <span className="flex items-center gap-1">
      <span className={cx('h-2.5 w-2.5 rounded-sm', cls)} style={style} />
      {label}
    </span>
  );
  return (
    <div className="hidden items-center gap-2.5 pl-1 text-[11px] text-white/50 xl:flex">
      {item('bg-gold-400', 'Selected')}
      {item('bg-emerald-500', 'Best')}
      {item('bg-sky-500', 'Comparing')}
      {heatmap
        ? item('', 'Low → high score', { background: `linear-gradient(90deg, ${scoreColor(30)}, ${scoreColor(95)})`, width: 24 })
        : item('bg-velvet-600', 'Seat')}
    </div>
  );
}

export function SeatSearch({ className }: { className?: string }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const err = goToSeatText(text);
    setError(err);
    if (!err) setText('');
  };
  return (
    <form
      className={cx('relative', className)}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor="seat-search" className="sr-only">
        Go to seat
      </label>
      <div
        className={cx(
          'flex h-8 items-center gap-1.5 rounded-full border bg-black/30 pl-3 pr-1',
          error ? 'border-rose-400/70' : 'border-white/10 focus-within:border-gold-400/70',
        )}
      >
        <Icon name="search" className="h-3.5 w-3.5 text-white/40" />
        <input
          id="seat-search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder="Go to seat… e.g. H8"
          aria-invalid={!!error}
          aria-describedby={error ? 'seat-search-err' : undefined}
          className="w-36 bg-transparent text-xs text-white placeholder:text-white/35 outline-none"
        />
        <button type="submit" className={cx('h-6 rounded-full bg-white/10 px-2.5 text-[11px] font-medium hover:bg-white/20', focusRing)}>
          Go
        </button>
      </div>
      {error && (
        <p id="seat-search-err" role="alert" className="absolute left-0 top-9 z-30 w-72 rounded-lg bg-rose-950/95 px-2.5 py-1.5 text-xs text-rose-200 shadow-xl">
          {error}
        </p>
      )}
    </form>
  );
}
