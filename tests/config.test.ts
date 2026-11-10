import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '@/lib/config/defaults';
import { sanitizeConfig, validateNumber, COUNT_LIMITS, validateCounts } from '@/lib/config/validation';
import { buildShareQuery, buildShareUrl, parseShareParams } from '@/lib/url/shareUrl';
import { BUILT_IN_PRESETS, LocalStoragePresetRepository } from '@/lib/presets/presets';
import { computeLayout } from '@/lib/geometry';

describe('validation', () => {
  it('rejects zero rows/seats and non-numbers with helpful messages', () => {
    expect(validateNumber(0, COUNT_LIMITS.rows, true)).toMatchObject({ ok: false, value: 1 });
    expect(validateNumber('abc', COUNT_LIMITS.rows, true).error).toMatch(/number/);
    expect(validateNumber(2.5, COUNT_LIMITS.seatsPerRow, true).error).toMatch(/whole/);
    expect(validateNumber(10, COUNT_LIMITS.rows, true)).toEqual({ ok: true, value: 10 });
    expect(validateCounts(60, 60, 1)).toMatch(/2500/);
    expect(validateCounts(10, 3, 4)).toMatch(/blocks/);
  });

  it('sanitises a corrupted config without crashing', () => {
    const { config, errors } = sanitizeConfig({ rows: 0, seatsPerRow: 'x', screenType: 'laser', dimensions: { seatWidth: -1 } });
    expect(config.rows).toBe(1);
    expect(config.screenType).toBe('standard');
    expect(config.dimensions.seatWidth).toBeGreaterThan(0);
    expect(errors.length).toBeGreaterThanOrEqual(4);
    expect(() => computeLayout(config)).not.toThrow();
    expect(sanitizeConfig(null).errors).toHaveLength(0);
  });
});

describe('share URLs', () => {
  it('round-trips rows, seats, screen and selected seat', () => {
    const c = createDefaultConfig();
    c.rows = 12;
    c.seatsPerRow = 14;
    c.screenType = 'imax';
    c.screens.imax.width = 20;
    const q = buildShareQuery(c, { row: 7, seat: 7 }, 75);
    expect(q).toContain('rows=12');
    expect(q).toContain('screen=imax');
    expect(q).toContain('seat=H8');
    const parsed = parseShareParams('?' + q);
    expect(parsed.errors).toEqual([]);
    expect(parsed.config.rows).toBe(12);
    expect(parsed.config.seatsPerRow).toBe(14);
    expect(parsed.config.screenType).toBe('imax');
    expect(parsed.config.screens.imax.width).toBe(20);
    expect(parsed.seat).toEqual({ row: 7, seat: 7 });
    expect(parsed.fov).toBe(75);
    expect(buildShareUrl('http://localhost:3000/', c, null, undefined, '')).toMatch(/^http:\/\/localhost:3000\/viewer\/\?rows=12/);
    expect(buildShareUrl('https://u.github.io', c, null, undefined, '/CineView3D')).toMatch(
      /^https:\/\/u\.github\.io\/CineView3D\/viewer\/\?rows=12/,
    );
  });

  it('parses the documented example URL', () => {
    const p = parseShareParams('?rows=10&seats=10&screen=imax&seat=H8');
    expect(p.hasParams).toBe(true);
    expect(p.config.screenType).toBe('imax');
    expect(p.seat).toEqual({ row: 7, seat: 7 });
  });

  it('reports invalid parameters instead of crashing', () => {
    const p = parseShareParams('?rows=0&seats=abc&screen=hologram&seat=Z99&fov=500');
    expect(p.config.rows).toBe(10);
    expect(p.config.seatsPerRow).toBe(10);
    expect(p.config.screenType).toBe('standard');
    expect(p.seat).toBeNull();
    expect(p.fov).toBeNull();
    expect(p.errors).toHaveLength(5);
    expect(parseShareParams('').hasParams).toBe(false);
    expect(parseShareParams('?rows=60&seats=60').errors[0]).toMatch(/2500/);
  });
});

describe('presets', () => {
  function memoryStorage() {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
  }

  it('lists built-in presets that all produce valid layouts', async () => {
    const repo = new LocalStoragePresetRepository(memoryStorage());
    const list = await repo.list();
    expect(list.map((p) => p.name)).toEqual(['Local Cinema', 'IMAX Auditorium', 'ScreenX Auditorium', 'Home Theater']);
    for (const p of BUILT_IN_PRESETS) {
      expect(sanitizeConfig(p.config).errors).toEqual([]);
      expect(computeLayout(p.config).seats.length).toBe(p.config.rows * p.config.seatsPerRow);
    }
  });

  it('saves, overwrites by name, and deletes user presets', async () => {
    const store = memoryStorage();
    const repo = new LocalStoragePresetRepository(store);
    const c = createDefaultConfig();
    const p = await repo.save('My Room', c);
    expect((await repo.list()).filter((x) => !x.builtIn)).toHaveLength(1);
    c.rows = 4;
    const p2 = await repo.save('my room', c);
    expect(p2.id).toBe(p.id);
    const user = (await repo.list()).filter((x) => !x.builtIn);
    expect(user).toHaveLength(1);
    expect(user[0].config.rows).toBe(4);
    await repo.remove(p.id);
    expect((await repo.list()).filter((x) => !x.builtIn)).toHaveLength(0);
    await expect(repo.save('  ', c)).rejects.toThrow(/name/);
    await expect(repo.remove('builtin-imax')).rejects.toThrow();
  });

  it('survives corrupted storage', async () => {
    const store = memoryStorage();
    store.setItem('cineview3d.presets.v1', '{not json');
    const repo = new LocalStoragePresetRepository(store);
    expect(await repo.list()).toHaveLength(BUILT_IN_PRESETS.length);
    expect(await new LocalStoragePresetRepository(null).list()).toHaveLength(BUILT_IN_PRESETS.length);
  });
});
