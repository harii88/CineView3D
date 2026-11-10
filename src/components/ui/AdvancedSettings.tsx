'use client';
import { useAuditorium } from '@/store/auditoriumStore';
import { useViewer } from '@/store/viewerStore';
import { DIMENSION_LIMITS, ROOM_LIMITS, SCREEN_LIMITS, type DimensionKey, type RoomKey } from '@/lib/config/validation';
import { CAMERA_DEFAULTS } from '@/lib/config/defaults';
import { NumberField, Slider, cx, focusRing } from './primitives';

const SEAT_KEYS: DimensionKey[] = ['seatWidth', 'seatDepth', 'seatHeight', 'backrestHeight', 'seatSpacing'];
const SPACING_KEYS: DimensionKey[] = ['rowSpacing', 'aisleWidth', 'rowRise'];
const EYE_KEYS: DimensionKey[] = ['eyeHeight', 'eyeBackOffset'];
const ROOM_KEYS: RoomKey[] = ['auditoriumWidth', 'auditoriumLength', 'ceilingHeight'];

/** Every physical dimension, applied live to the 3D model and seat map. */
export function AdvancedSettings() {
  const config = useAuditorium((s) => s.config);
  const layout = useAuditorium((s) => s.layout);
  const updateDimensions = useAuditorium((s) => s.updateDimensions);
  const updateScreen = useAuditorium((s) => s.updateScreen);
  const fov = useViewer((s) => s.fov);
  const setFov = useViewer((s) => s.setFov);
  const d = config.dimensions;
  const scr = config.screens[config.screenType];
  const computed: Record<RoomKey, number> = {
    auditoriumWidth: layout.width,
    auditoriumLength: layout.length,
    ceilingHeight: layout.height,
  };

  const group = (title: string, keys: DimensionKey[]) => (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-xs font-medium text-white/75">{title}</legend>
      <div className="grid grid-cols-2 gap-3">
        {keys.map((k) => (
          <NumberField key={k} value={d[k]} range={DIMENSION_LIMITS[k]} onCommit={(v) => updateDimensions({ [k]: v })} />
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="mb-2 text-xs font-medium text-white/75">Room (auto-sized unless overridden)</legend>
        {ROOM_KEYS.map((k) => {
          const auto = d[k] === null;
          return (
            <div key={k} className="space-y-1.5">
              <label className="flex items-center justify-between text-xs text-white/60">
                <span>{ROOM_LIMITS[k].label}</span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={auto}
                    onChange={(e) =>
                      updateDimensions({ [k]: e.target.checked ? null : Math.ceil(computed[k] * 2) / 2 })
                    }
                    className={cx('h-3.5 w-3.5 accent-amber-400', focusRing)}
                  />
                  Auto
                </span>
              </label>
              {auto ? (
                <div className="flex h-9 items-center rounded-xl border border-white/5 bg-black/20 px-3 text-sm tabular-nums text-white/50">
                  {computed[k].toFixed(2)} m (computed)
                </div>
              ) : (
                <NumberField
                  value={d[k] ?? computed[k]}
                  range={{ ...ROOM_LIMITS[k], label: 'Override' }}
                  onCommit={(v) => updateDimensions({ [k]: v })}
                  compact
                />
              )}
            </div>
          );
        })}
      </fieldset>
      {group('Seats', SEAT_KEYS)}
      {group('Spacing & rake', SPACING_KEYS)}
      <fieldset className="space-y-3">
        <legend className="mb-2 text-xs font-medium text-white/75">Screen</legend>
        <div className="grid grid-cols-2 gap-3">
          <NumberField value={scr.width} range={SCREEN_LIMITS.width} onCommit={(v) => updateScreen({ width: v })} />
          <NumberField value={scr.height} range={SCREEN_LIMITS.height} onCommit={(v) => updateScreen({ height: v })} />
          <NumberField value={scr.distance} range={SCREEN_LIMITS.distance} onCommit={(v) => updateScreen({ distance: v })} />
          <NumberField value={scr.curvature} range={SCREEN_LIMITS.curvature} onCommit={(v) => updateScreen({ curvature: v })} />
        </div>
      </fieldset>
      {group('Viewer eye position', EYE_KEYS)}
      <Slider
        label="Field of view"
        value={Math.round(fov)}
        min={CAMERA_DEFAULTS.minFov}
        max={CAMERA_DEFAULTS.maxFov}
        onChange={setFov}
        format={(v) => `${v}°`}
      />
      <p className="text-[11px] leading-relaxed text-white/40">
        Seated eye height = row platform + seat height + eye height ({(d.seatHeight + d.eyeHeight).toFixed(2)} m above the
        platform). The camera never sits on the cushion.
      </p>
    </div>
  );
}
