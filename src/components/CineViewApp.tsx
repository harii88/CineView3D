'use client';
import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAuditorium } from '@/store/auditoriumStore';
import { useViewer } from '@/store/viewerStore';
import { buildShareQuery, parseShareParams, viewerPath } from '@/lib/url/shareUrl';
import { findBestSeats, getSeatFromLayout } from '@/lib/geometry';
import { SeatMap } from '@/components/seat-map/SeatMap';
import { MiniMap } from '@/components/ui/MiniMap';
import { ModeSwitch, SeatNavigator, ViewControls } from '@/components/ui/ViewControls';
import { Header, IntroOverlay, Sidebar, Toasts } from '@/components/ui/Shell';
import { useSelectedScore, fmtDeg, fmtM } from '@/components/ui/SeatInformation';
import { Stars, cx } from '@/components/ui/primitives';

const Scene = dynamic(() => import('@/components/scene/Scene'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-white/50">
      <span className="cv-pulse">Building auditorium…</span>
    </div>
  ),
});

/** Load state from the URL once, keep the URL in sync afterwards. */
function useUrlState() {
  const ready = useRef(false);
  useEffect(() => {
    const parsed = parseShareParams(window.location.search);
    const viewer = useViewer.getState();
    if (parsed.hasParams) {
      useAuditorium.getState().setConfig(parsed.config);
      if (parsed.fov !== null) viewer.setFov(parsed.fov);
      if (parsed.seat) viewer.selectSeat(parsed.seat);
      parsed.errors.forEach((e) => viewer.toast('error', e));
    } else {
      let seen = false;
      try {
        seen = localStorage.getItem('cineview3d.introSeen') === '1';
      } catch {
        /* ignore */
      }
      if (!seen) viewer.setIntroOpen(true);
    }
    if (window.matchMedia?.('(min-width: 1024px)').matches) viewer.setSidebarOpen(true);
    ready.current = true;
  }, []);

  const config = useAuditorium((s) => s.config);
  const selected = useViewer((s) => s.selected);
  const fov = useViewer((s) => s.fov);
  useEffect(() => {
    if (!ready.current) return;
    const t = setTimeout(() => {
      const url = `${viewerPath()}?${buildShareQuery(config, selected, fov)}`;
      window.history.replaceState(window.history.state, '', url);
    }, 400);
    return () => clearTimeout(t);
  }, [config, selected, fov]);
}

function useReducedMotionPreference() {
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    useViewer.getState().setReducedMotion(mq.matches);
    const on = (e: MediaQueryListEvent) => useViewer.getState().setReducedMotion(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
}

/** Keep viewer selections consistent with the auditorium when it is regenerated. */
function useLayoutConsistency() {
  const layout = useAuditorium((s) => s.layout);
  useEffect(() => {
    // Read the live layout: on first load the URL effect may already have replaced
    // the configuration this render was based on.
    const current = useAuditorium.getState().layout;
    const v = useViewer.getState();
    v.pruneSeats(current.config.rows, current.config.seatsPerRow);
    if (v.bestSeats.length > 0) {
      const count = Math.min(v.bestSeats.length, current.seats.length);
      useViewer.setState({ bestSeats: findBestSeats(current, count).map((b) => b.label) });
    }
  }, [layout]);
}

function SeatedBadge() {
  const score = useSelectedScore();
  const mode = useViewer((s) => s.mode);
  const setPanel = useViewer((s) => s.setPanel);
  if (!score) return null;
  const m = score.metrics;
  return (
    <button
      type="button"
      onClick={() => setPanel('seat')}
      className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-ink-900/70 px-3 py-2 text-left shadow-glass backdrop-blur-xl hover:bg-ink-800/80 sm:flex"
      title="Open seat details"
    >
      <div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">{mode === 'seated' ? 'Sitting in' : 'Selected'}</div>
        <div className="text-lg font-semibold leading-tight text-white">{m.label}</div>
      </div>
      <div className="text-[11px] leading-snug text-white/65">
        <div>
          {fmtM(m.distance)} · {fmtDeg(m.horizontalAngle)} × {fmtDeg(m.verticalAngle)}
        </div>
        <div className="flex items-center gap-1.5">
          <Stars value={score.stars} /> <span className="tabular-nums text-gold-300">{Math.round(score.score)}</span>
        </div>
      </div>
    </button>
  );
}

function ViewerHint() {
  const mode = useViewer((s) => s.mode);
  const selected = useViewer((s) => s.selected);
  const layout = useAuditorium((s) => s.layout);
  const text =
    mode === 'overview'
      ? selected
        ? `Drag to orbit · Click a seat to sit · ${getSeatFromLayout(layout, selected.row, selected.seat)?.label} is selected`
        : 'Drag to orbit · Click any seat to sit down'
      : mode === 'seated'
        ? 'Drag or use arrow keys to look around · Scroll to change FOV · Esc to stand up'
        : 'WASD to walk · Q/E down/up · Space to hurry · Drag to look · Esc to exit';
  return <p className="hidden rounded-full bg-black/50 px-3 py-1 text-[11px] text-white/60 backdrop-blur md:block">{text}</p>;
}

export default function CineViewApp() {
  useUrlState();
  useReducedMotionPreference();
  useLayoutConsistency();
  const seatMapOpen = useViewer((s) => s.seatMapOpen);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink-950 text-white">
      <a href="#seat-map" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-1 focus:text-ink-950">
        Skip to seat map
      </a>
      <Header />
      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <section data-viewer aria-label="3D viewer" className="relative min-h-[260px] flex-1 overflow-hidden bg-black">
            <Scene />
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 sm:p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="pointer-events-auto">
                  <ModeSwitch />
                </div>
                <div className="pointer-events-auto">
                  <SeatNavigator />
                </div>
                <div className="pointer-events-auto">
                  <SeatedBadge />
                </div>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="hidden w-[168px] lg:block" />
                <div className="pointer-events-auto flex min-w-0 flex-col items-center gap-2">
                  <ViewerHint />
                  <ViewControls />
                </div>
                <div className="pointer-events-none rounded-2xl border border-white/10 bg-ink-900/60 p-1.5 shadow-glass backdrop-blur-xl max-sm:hidden">
                  <MiniMap size={150} />
                </div>
              </div>
            </div>
          </section>
          <section
            id="seat-map"
            aria-label="Seat map"
            className={cx(
              'shrink-0 border-t border-white/10 bg-ink-900/90',
              seatMapOpen ? 'h-[38%] min-h-[180px] max-h-[440px]' : 'h-auto',
            )}
          >
            <SeatMap />
          </section>
        </main>
        <Sidebar />
      </div>
      <IntroOverlay />
      <Toasts />
    </div>
  );
}
