'use client';
import { useEffect, useRef } from 'react';
import { useAuditorium } from '@/store/auditoriumStore';
import { useViewer, type SidePanel } from '@/store/viewerStore';
import { buildShareUrl } from '@/lib/url/shareUrl';
import { SCREEN_TYPE_LABELS } from '@/lib/config/defaults';
import { SCREEN_TYPES } from '@/types';
import { Button, Icon, cx, focusRing } from './primitives';
import { SeatInformation } from './SeatInformation';
import { ComparisonPanel } from './ComparisonPanel';
import { BestSeatsPanel } from './BestSeatsPanel';
import { ConfigurationPanel, CountControls, ScreenTypeSelector } from './ConfigurationPanel';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function shareCurrentView() {
  const { config } = useAuditorium.getState();
  const { selected, fov, toast } = useViewer.getState();
  const url = buildShareUrl(window.location.origin, config, selected, fov);
  copyText(url).then((ok) =>
    toast(ok ? 'success' : 'info', ok ? 'Share link copied to clipboard.' : `Copy this link: ${url}`),
  );
}

export function Header() {
  const type = useAuditorium((s) => s.config.screenType);
  const setScreenType = useAuditorium((s) => s.setScreenType);
  const setPanel = useViewer((s) => s.setPanel);
  const sidebarOpen = useViewer((s) => s.sidebarOpen);
  const setSidebarOpen = useViewer((s) => s.setSidebarOpen);
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/5 bg-ink-950/90 px-3 backdrop-blur sm:px-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-gold-300 to-velvet-500 shadow-[0_0_20px_rgba(239,191,90,0.35)]">
          <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 h-[18px] w-[18px] text-ink-950" fill="currentColor" aria-hidden="true">
            <path d="M3 5h18v10H3zM6 18h2v2H6zm5 0h2v2h-2zm5 0h2v2h-2z" />
          </svg>
        </div>
        <h1 className="text-[15px] font-semibold tracking-tight">
          CineView <span className="text-gold-400">3D</span>
        </h1>
      </div>
      <div role="radiogroup" aria-label="Screen type" className="mx-auto hidden items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5 md:flex">
        {SCREEN_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setScreenType(t)}
            className={cx(
              'h-8 rounded-full px-3.5 text-xs font-medium transition-colors',
              focusRing,
              type === t ? 'bg-white text-ink-950' : 'text-white/60 hover:text-white',
            )}
          >
            {SCREEN_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-1.5 md:ml-0">
        <Button size="sm" variant="glass" onClick={shareCurrentView} title="Copy a link to this exact view">
          <Icon name="share" className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Share View</span>
        </Button>
        <Button size="sm" variant="glass" onClick={() => setPanel('setup')} className="lg:hidden" aria-label="Open settings">
          <Icon name="sliders" className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="glass" onClick={() => setPanel('setup')} className="hidden lg:inline-flex">
          <Icon name="sliders" className="h-3.5 w-3.5" /> Settings
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Close panels' : 'Open panels'}
          aria-expanded={sidebarOpen}
        >
          <Icon name={sidebarOpen ? 'x' : 'menu'} />
        </Button>
      </div>
    </header>
  );
}

const TABS: { id: SidePanel; label: string; icon: string }[] = [
  { id: 'seat', label: 'Seat', icon: 'seat' },
  { id: 'compare', label: 'Compare', icon: 'compare' },
  { id: 'best', label: 'Best', icon: 'star' },
  { id: 'setup', label: 'Setup', icon: 'sliders' },
];

export function Sidebar() {
  const panel = useViewer((s) => s.panel);
  const setPanel = useViewer((s) => s.setPanel);
  const open = useViewer((s) => s.sidebarOpen);
  const setOpen = useViewer((s) => s.setSidebarOpen);
  const comparison = useViewer((s) => s.comparison);
  return (
    <aside
      aria-label="Seat details and settings"
      className={cx(
        'z-20 flex flex-col border-white/10 bg-ink-900/95 backdrop-blur-xl',
        // lg+: static column
        'lg:static lg:flex lg:w-[380px] lg:max-h-none lg:translate-y-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none',
        // md..lg: right drawer
        'md:fixed md:bottom-0 md:right-0 md:top-14 md:w-[380px] md:max-h-none md:rounded-none md:border-l',
        // < md: bottom sheet that leaves the 3D view visible
        'fixed inset-x-0 bottom-0 max-h-[62dvh] rounded-t-2xl border-t shadow-2xl transition-transform duration-300 md:inset-x-auto md:border-t-0',
        open ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full md:translate-y-0 lg:translate-x-0',
      )}
    >
      <div role="tablist" aria-label="Panels" className="flex shrink-0 items-center gap-1 border-b border-white/5 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={panel === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setPanel(t.id)}
            className={cx(
              'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition-colors',
              focusRing,
              panel === t.id ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white',
            )}
          >
            <Icon name={t.icon} className="h-3.5 w-3.5" />
            {t.label}
            {t.id === 'compare' && comparison.length > 0 && (
              <span className="rounded-full bg-sky-400/80 px-1.5 text-[10px] text-ink-950">{comparison.length}</span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close panel"
          className={cx('ml-1 rounded-lg p-2 text-white/50 hover:text-white lg:hidden', focusRing)}
        >
          <Icon name="x" />
        </button>
      </div>
      <div
        id={`panel-${panel}`}
        role="tabpanel"
        aria-labelledby={`tab-${panel}`}
        className="cv-scroll min-h-0 flex-1 overflow-y-auto p-4"
      >
        {panel === 'seat' && <SeatInformation />}
        {panel === 'compare' && <ComparisonPanel />}
        {panel === 'best' && <BestSeatsPanel />}
        {panel === 'setup' && <ConfigurationPanel />}
      </div>
    </aside>
  );
}

export function Toasts() {
  const toasts = useViewer((s) => s.toasts);
  const dismiss = useViewer((s) => s.dismissToast);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={cx(
            'pointer-events-auto flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-sm shadow-2xl backdrop-blur-xl cv-toast',
            t.kind === 'error' && 'border-rose-400/40 bg-rose-950/90 text-rose-100',
            t.kind === 'success' && 'border-emerald-400/30 bg-emerald-950/90 text-emerald-100',
            t.kind === 'info' && 'border-white/15 bg-ink-800/95 text-white/90',
          )}
        >
          <span className="min-w-0 flex-1 break-words">{t.text}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className={cx('rounded p-0.5 opacity-60 hover:opacity-100', focusRing)}>
            <Icon name="x" className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export function IntroOverlay() {
  const open = useViewer((s) => s.introOpen);
  const setOpen = useViewer((s) => s.setIntroOpen);
  const setPanel = useViewer((s) => s.setPanel);
  const ref = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem('cineview3d.introSeen', '1');
    } catch {
      /* storage unavailable */
    }
  };

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>('input,button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
        className="cv-scroll max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-b from-ink-800/95 to-ink-900/95 p-6 shadow-2xl sm:p-8"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400">CineView 3D</p>
        <h2 id="intro-title" className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Design Your Cinema View
        </h2>
        <p className="mt-2 text-sm text-white/60">
          Build an auditorium, pick a screen, then sit in any seat to see exactly how the screen looks from there.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-medium text-white/75">1 · Auditorium</p>
            <CountControls />
          </div>
          <div>
            <p className="mb-3 text-xs font-medium text-white/75">2 · Screen</p>
            <ScreenTypeSelector />
          </div>
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={close}>
            Build auditorium
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              close();
              setPanel('setup');
            }}
          >
            Load a preset…
          </Button>
          <p className="ml-auto text-xs text-white/40">3 · Click any seat to sit down</p>
        </div>
      </div>
    </div>
  );
}
