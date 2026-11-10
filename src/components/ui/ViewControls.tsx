'use client';
import { useState } from 'react';
import { useAuditorium } from '@/store/auditoriumStore';
import { lookAtOffset, useViewer, type CameraMode } from '@/store/viewerStore';
import { CAMERA_DEFAULTS } from '@/lib/config/defaults';
import { getSeatFromLayout, stepSeat, describeSeat } from '@/lib/geometry';
import { Button, GlassPanel, Icon, cx, focusRing } from './primitives';

const MODES: { id: CameraMode; label: string; icon: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'orbit', hint: 'Orbit around the auditorium model' },
  { id: 'seated', label: 'Seated', icon: 'seat', hint: 'Sit in the selected seat and look around' },
  { id: 'explore', label: 'Explore', icon: 'walk', hint: 'Walk around: WASD to move, Q/E down/up, drag to look' },
];

export function ModeSwitch() {
  const mode = useViewer((s) => s.mode);
  const selected = useViewer((s) => s.selected);
  const setMode = useViewer((s) => s.setMode);
  return (
    <GlassPanel className="flex p-1">
      <div role="radiogroup" aria-label="Camera mode" className="flex">
        {MODES.map((m) => {
          const disabled = m.id === 'seated' && !selected;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              disabled={disabled}
              title={disabled ? 'Select a seat first' : m.hint}
              onClick={() => setMode(m.id)}
              className={cx(
                'flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition-colors disabled:opacity-35 sm:px-3',
                focusRing,
                mode === m.id ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white',
              )}
            >
              <Icon name={m.icon} className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          );
        })}
      </div>
    </GlassPanel>
  );
}

export function SeatNavigator() {
  const layout = useAuditorium((s) => s.layout);
  const selected = useViewer((s) => s.selected);
  const selectSeat = useViewer((s) => s.selectSeat);
  const seat = selected ? getSeatFromLayout(layout, selected.row, selected.seat) : null;
  const go = (delta: number) => {
    const next = stepSeat(layout, selected, delta);
    if (next) selectSeat({ row: next.row, seat: next.seat });
  };
  return (
    <GlassPanel className="flex items-center gap-1 p-1">
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous seat"
        className={cx('flex h-8 items-center gap-1 rounded-xl px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white', focusRing)}
      >
        <Icon name="chevronLeft" />
        <span className="hidden md:inline">Prev</span>
      </button>
      <div className="min-w-[88px] px-2 text-center" aria-live="polite">
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">Current</div>
        <div className="text-sm font-semibold leading-tight text-white">{seat ? seat.label : '—'}</div>
        <span className="sr-only">{seat ? describeSeat(seat.row, seat.seat) : 'No seat selected'}</span>
      </div>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next seat"
        className={cx('flex h-8 items-center gap-1 rounded-xl px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white', focusRing)}
      >
        <span className="hidden md:inline">Next</span>
        <Icon name="chevronRight" />
      </button>
    </GlassPanel>
  );
}

export function ViewControls() {
  const mode = useViewer((s) => s.mode);
  const fov = useViewer((s) => s.fov);
  const setFov = useViewer((s) => s.setFov);
  const resetView = useViewer((s) => s.resetView);
  const [open, setOpen] = useState(true);
  const seated = mode === 'seated';
  const look = (y: number, p: number) => lookAtOffset(y, p);
  const presets: { id: keyof typeof CAMERA_DEFAULTS.presets; label: string }[] = [
    { id: 'default', label: 'Default' },
    { id: 'wide', label: 'Wide' },
    { id: 'cinematic', label: 'Cinematic' },
  ];

  return (
    <GlassPanel className="flex max-w-full flex-wrap items-center justify-center gap-1.5 p-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={open ? 'Hide view controls' : 'Show view controls'}
        className={cx('flex h-8 w-8 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white', focusRing)}
      >
        <Icon name={open ? 'chevronDown' : 'eye'} />
      </button>
      {open && (
        <>
          {seated && (
            <div role="group" aria-label="Look direction" className="flex items-center gap-0.5">
              <LookBtn label="Look left" onClick={() => look(70, 0)}>
                ←
              </LookBtn>
              <LookBtn label="Look up" onClick={() => look(0, 25)}>
                ↑
              </LookBtn>
              <LookBtn label="Look at screen centre" onClick={() => look(0, 0)} wide>
                Center
              </LookBtn>
              <LookBtn label="Look down" onClick={() => look(0, -25)}>
                ↓
              </LookBtn>
              <LookBtn label="Look right" onClick={() => look(-70, 0)}>
                →
              </LookBtn>
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={resetView} title="Reset view (R)">
            <Icon name="reset" className="h-3.5 w-3.5" /> Reset
          </Button>
          <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
          <div role="radiogroup" aria-label="Camera lens preset" className="flex items-center gap-0.5">
            {presets.map((p) => {
              const active = Math.abs(fov - CAMERA_DEFAULTS.presets[p.id]) < 0.5;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFov(CAMERA_DEFAULTS.presets[p.id])}
                  className={cx(
                    'h-8 rounded-xl px-2.5 text-xs font-medium',
                    focusRing,
                    active ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 px-1 text-xs text-white/60">
            <span className="whitespace-nowrap">FOV {Math.round(fov)}°</span>
            <input
              type="range"
              min={CAMERA_DEFAULTS.minFov}
              max={CAMERA_DEFAULTS.maxFov}
              value={Math.round(fov)}
              onChange={(e) => setFov(Number(e.target.value))}
              className="cv-range w-20 sm:w-28"
              aria-label="Field of view in degrees"
            />
          </label>
        </>
      )}
    </GlassPanel>
  );
}

function LookBtn({ label, onClick, children, wide }: { label: string; onClick: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cx(
        'flex h-8 items-center justify-center rounded-xl text-xs text-white/75 hover:bg-white/10 hover:text-white',
        focusRing,
        wide ? 'px-2.5' : 'w-8',
      )}
    >
      {children}
    </button>
  );
}
