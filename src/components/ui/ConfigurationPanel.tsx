'use client';
import { useState } from 'react';
import type { ScreenType } from '@/types';
import { SCREEN_TYPES } from '@/types';
import { useAuditorium } from '@/store/auditoriumStore';
import { useViewer } from '@/store/viewerStore';
import { ASPECT_RATIOS, SCREEN_TYPE_DESCRIPTIONS, SCREEN_TYPE_LABELS } from '@/lib/config/defaults';
import { COUNT_LIMITS, SCREEN_LIMITS } from '@/lib/config/validation';
import { Button, Icon, NumberField, SectionTitle, Slider, cx, focusRing } from './primitives';
import { AdvancedSettings } from './AdvancedSettings';
import { ContentUpload } from './ContentUpload';
import { PresetsPanel } from './PresetsPanel';

export function ScreenTypeSelector({ compact }: { compact?: boolean }) {
  const type = useAuditorium((s) => s.config.screenType);
  const setScreenType = useAuditorium((s) => s.setScreenType);
  return (
    <div role="radiogroup" aria-label="Screen type" className={cx('grid gap-2', compact ? 'grid-cols-4' : 'grid-cols-2')}>
      {SCREEN_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={type === t}
          onClick={() => setScreenType(t)}
          className={cx(
            'rounded-xl border p-2.5 text-left transition-colors',
            focusRing,
            type === t ? 'border-gold-400/70 bg-gold-400/10' : 'border-white/10 bg-black/20 hover:border-white/25',
          )}
        >
          <span className="flex items-center gap-2">
            <span
              className={cx('h-3 w-3 shrink-0 rounded-full border', type === t ? 'border-gold-300 bg-gold-400' : 'border-white/30')}
              aria-hidden="true"
            />
            <span className="text-sm font-semibold text-white">{SCREEN_TYPE_LABELS[t]}</span>
          </span>
          {!compact && <span className="mt-1 block pl-5 text-[11px] leading-snug text-white/50">{SCREEN_TYPE_DESCRIPTIONS[t]}</span>}
        </button>
      ))}
    </div>
  );
}

export function CountControls() {
  const config = useAuditorium((s) => s.config);
  const setCounts = useAuditorium((s) => s.setCounts);
  const quick = { rows: [5, 10, 15, 20], seatsPerRow: [6, 10, 15, 20] } as const;
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const apply = (key: 'rows' | 'seatsPerRow' | 'sections', v: number) => {
    const err = setCounts({ [key]: v });
    setErrors((e) => ({ ...e, [key]: err }));
    return err;
  };
  return (
    <div className="space-y-4">
      {(['rows', 'seatsPerRow'] as const).map((k) => (
        <div key={k}>
          <NumberField value={config[k]} range={COUNT_LIMITS[k]} integer onCommit={(v) => apply(k, v)} externalError={errors[k]} />
          <div className="mt-1.5 flex gap-1.5">
            {quick[k].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => apply(k, n)}
                className={cx(
                  'h-7 flex-1 rounded-lg text-xs',
                  focusRing,
                  config[k] === n ? 'bg-white/15 text-white' : 'bg-white/[0.04] text-white/55 hover:text-white',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <NumberField
        value={config.sections}
        range={{ ...COUNT_LIMITS.sections, label: 'Seat blocks (centre aisles + 1)' }}
        integer
        onCommit={(v) => apply('sections', v)}
        externalError={errors.sections}
      />
    </div>
  );
}

function ScreenSizeControls() {
  const config = useAuditorium((s) => s.config);
  const updateScreen = useAuditorium((s) => s.updateScreen);
  const resetScreen = useAuditorium((s) => s.resetScreen);
  const scr = config.screens[config.screenType];
  const aspect = scr.width / scr.height;
  const matched = ASPECT_RATIOS.find((a) => Math.abs(a.value - aspect) < 0.01);
  const type: ScreenType = config.screenType;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <NumberField value={scr.width} range={{ ...SCREEN_LIMITS.width, label: 'Width' }} onCommit={(v) => updateScreen({ width: v })} />
        <NumberField value={scr.height} range={{ ...SCREEN_LIMITS.height, label: 'Height' }} onCommit={(v) => updateScreen({ height: v })} />
      </div>
      <label className="block space-y-1.5 text-xs text-white/60">
        <span>Aspect ratio · {aspect.toFixed(2)}:1</span>
        <select
          value={matched ? String(matched.value) : 'custom'}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) updateScreen({ height: Math.round((scr.width / v) * 100) / 100 });
          }}
          className={cx('h-9 w-full rounded-xl border border-white/10 bg-black/40 px-2 text-sm text-white', focusRing)}
        >
          {!matched && <option value="custom">Custom ({aspect.toFixed(2)}:1)</option>}
          {ASPECT_RATIOS.map((a) => (
            <option key={a.label} value={String(a.value)}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <NumberField value={scr.distance} range={SCREEN_LIMITS.distance} onCommit={(v) => updateScreen({ distance: v })} />
      <div className="grid grid-cols-2 gap-3">
        <NumberField value={scr.bottom} range={{ ...SCREEN_LIMITS.bottom, label: 'Bottom edge' }} onCommit={(v) => updateScreen({ bottom: v })} />
        <NumberField value={scr.curvature} range={{ ...SCREEN_LIMITS.curvature, label: 'Curvature' }} onCommit={(v) => updateScreen({ curvature: v })} />
      </div>
      {type === 'screenx' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            value={scr.sidePanelLength}
            range={{ ...SCREEN_LIMITS.sidePanelLength, label: 'Side wall length' }}
            onCommit={(v) => updateScreen({ sidePanelLength: v })}
          />
          <NumberField
            value={scr.cornerDepth}
            range={{ ...SCREEN_LIMITS.cornerDepth, label: 'Corner depth' }}
            onCommit={(v) => updateScreen({ cornerDepth: v })}
          />
        </div>
      )}
      <Button size="sm" variant="ghost" onClick={resetScreen}>
        <Icon name="reset" className="h-3.5 w-3.5" /> Reset {SCREEN_TYPE_LABELS[type]} screen
      </Button>
    </div>
  );
}

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-white/5 pt-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cx('flex w-full items-center justify-between rounded-lg text-left', focusRing)}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">{title}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} className="h-4 w-4 text-white/40" />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

export function ConfigurationPanel() {
  const layout = useAuditorium((s) => s.layout);
  const houseLights = useViewer((s) => s.houseLights);
  const setHouseLights = useViewer((s) => s.setHouseLights);
  const reducedMotion = useViewer((s) => s.reducedMotion);
  const setReducedMotion = useViewer((s) => s.setReducedMotion);

  return (
    <div className="space-y-5">
      {layout.warnings.length > 0 && (
        <div role="status" className="space-y-1 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
          {layout.warnings.map((w) => (
            <p key={w}>⚠ {w}</p>
          ))}
        </div>
      )}
      <section>
        <SectionTitle>Auditorium</SectionTitle>
        <CountControls />
        <p className="mt-3 text-[11px] text-white/40">
          Room: {layout.width.toFixed(1)} m wide × {layout.length.toFixed(1)} m long × {layout.height.toFixed(1)} m high ·{' '}
          {layout.seats.length} seats
        </p>
      </section>
      <section className="border-t border-white/5 pt-4">
        <SectionTitle>Screen type</SectionTitle>
        <ScreenTypeSelector />
      </section>
      <Collapsible title="Screen size & position" defaultOpen>
        <ScreenSizeControls />
      </Collapsible>
      <Collapsible title="Advanced settings">
        <AdvancedSettings />
      </Collapsible>
      <Collapsible title="Screen content">
        <ContentUpload />
      </Collapsible>
      <Collapsible title="Atmosphere & motion">
        <div className="space-y-4">
          <Slider
            label="House lights"
            value={houseLights}
            min={0}
            max={1}
            step={0.05}
            onChange={setHouseLights}
            format={(v) => (v < 0.05 ? 'Off (show)' : `${Math.round(v * 100)}%`)}
          />
          <label className="flex items-center justify-between text-sm text-white/75">
            Reduce motion (instant camera moves)
            <input type="checkbox" checked={reducedMotion} onChange={(e) => setReducedMotion(e.target.checked)} className="h-4 w-4 accent-amber-400" />
          </label>
        </div>
      </Collapsible>
      <Collapsible title="Presets" defaultOpen>
        <PresetsPanel />
      </Collapsible>
    </div>
  );
}
