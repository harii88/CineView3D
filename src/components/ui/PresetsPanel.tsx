'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAuditorium } from '@/store/auditoriumStore';
import { useViewer } from '@/store/viewerStore';
import { getBrowserStorage, LocalStoragePresetRepository, type Preset } from '@/lib/presets/presets';
import { SCREEN_TYPE_LABELS } from '@/lib/config/defaults';
import { Button, Icon, cx, focusRing } from './primitives';

export function usePresetRepository() {
  return useMemo(() => new LocalStoragePresetRepository(getBrowserStorage()), []);
}

export function PresetsPanel() {
  const repo = usePresetRepository();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setConfig = useAuditorium((s) => s.setConfig);
  const toast = useViewer((s) => s.toast);

  const refresh = () => repo.list().then(setPresets).catch(() => setPresets([]));
  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (p: Preset) => {
    const errs = setConfig(p.config);
    useViewer.getState().selectSeat(null);
    useViewer.getState().setBestSeats([]);
    toast(errs.length ? 'error' : 'success', errs.length ? `Loaded “${p.name}” with corrections: ${errs[0]}` : `Loaded “${p.name}”.`);
  };

  const save = async () => {
    setError(null);
    try {
      const p = await repo.save(name, useAuditorium.getState().config);
      setName('');
      toast('success', `Saved preset “${p.name}”.`);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (p: Preset) => {
    try {
      await repo.remove(p.id);
      toast('info', `Deleted “${p.name}”.`);
      refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {presets.map((p) => (
          <li key={p.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => apply(p)}
              className={cx('flex-1 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-left hover:bg-white/5', focusRing)}
            >
              <span className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{p.name}</span>
                <span className="text-[10px] uppercase tracking-wider text-white/40">
                  {p.builtIn ? 'Built-in' : SCREEN_TYPE_LABELS[p.config.screenType]}
                </span>
              </span>
              <span className="block text-[11px] text-white/45">
                {p.description ?? `${p.config.rows} × ${p.config.seatsPerRow} · ${SCREEN_TYPE_LABELS[p.config.screenType]}`}
              </span>
            </button>
            {!p.builtIn && (
              <button
                type="button"
                aria-label={`Delete preset ${p.name}`}
                onClick={() => remove(p)}
                className={cx('rounded-lg p-2 text-white/40 hover:bg-rose-500/15 hover:text-rose-300', focusRing)}
              >
                <Icon name="trash" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label htmlFor="preset-name" className="sr-only">
          Preset name
        </label>
        <input
          id="preset-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this auditorium…"
          maxLength={60}
          className="h-9 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-gold-400/70"
        />
        <Button type="submit" variant="primary">
          <Icon name="save" className="h-3.5 w-3.5" /> Save
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-rose-300">
          {error}
        </p>
      )}
      <p className="text-[11px] text-white/35">Presets are stored in this browser (localStorage).</p>
    </div>
  );
}
