import type { AuditoriumConfig } from '@/types';
import { createDefaultConfig } from '@/lib/config/defaults';
import { sanitizeConfig } from '@/lib/config/validation';

export interface Preset {
  id: string;
  name: string;
  description?: string;
  builtIn: boolean;
  createdAt: number;
  config: AuditoriumConfig;
}

/**
 * Storage abstraction. The app only talks to this interface, so a REST or
 * database-backed repository can replace LocalStoragePresetRepository later.
 */
export interface PresetRepository {
  list(): Promise<Preset[]>;
  save(name: string, config: AuditoriumConfig, description?: string): Promise<Preset>;
  remove(id: string): Promise<void>;
}

function build(mutator: (c: AuditoriumConfig) => void): AuditoriumConfig {
  const c = createDefaultConfig();
  mutator(c);
  return c;
}

export const BUILT_IN_PRESETS: Preset[] = [
  {
    id: 'builtin-local',
    name: 'Local Cinema',
    description: '12 × 16 multiplex house, flat 1.85:1 screen',
    builtIn: true,
    createdAt: 0,
    config: build((c) => {
      c.rows = 12;
      c.seatsPerRow = 16;
      c.screenType = 'standard';
      c.screens.standard = { ...c.screens.standard, width: 11, height: 5.95, distance: 5.5 };
    }),
  },
  {
    id: 'builtin-imax',
    name: 'IMAX Auditorium',
    description: '16 × 26 steep stadium, 22 m curved 1.43:1 screen',
    builtIn: true,
    createdAt: 0,
    config: build((c) => {
      c.rows = 16;
      c.seatsPerRow = 26;
      c.sections = 3;
      c.screenType = 'imax';
      c.dimensions.rowRise = 0.5;
      c.dimensions.rowSpacing = 1.15;
      c.screens.imax = { ...c.screens.imax, width: 22, height: 15.4, bottom: 0.4, distance: 8, curvature: 16 };
    }),
  },
  {
    id: 'builtin-screenx',
    name: 'ScreenX Auditorium',
    description: '10 × 14 with side-wall panoramic projection',
    builtIn: true,
    createdAt: 0,
    config: build((c) => {
      c.rows = 10;
      c.seatsPerRow = 14;
      c.screenType = 'screenx';
      c.screens.screenx = { ...c.screens.screenx, width: 11, height: 5.95, distance: 5 };
    }),
  },
  {
    id: 'builtin-home',
    name: 'Home Theater',
    description: '3 × 5 recliners, 3 m 16:9 screen',
    builtIn: true,
    createdAt: 0,
    config: build((c) => {
      c.rows = 3;
      c.seatsPerRow = 5;
      c.screenType = 'custom';
      c.dimensions = {
        ...c.dimensions,
        seatWidth: 0.8,
        seatDepth: 0.9,
        seatSpacing: 0.12,
        rowSpacing: 1.9,
        rowRise: 0.25,
        aisleWidth: 0.8,
        backrestHeight: 1.05,
      };
      c.screens.custom = { width: 3, height: 1.69, bottom: 0.6, distance: 3.2, curvature: 0, sidePanelLength: 0, cornerDepth: 1 };
    }),
  },
];

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class LocalStoragePresetRepository implements PresetRepository {
  constructor(
    private storage: StorageLike | null,
    private key = 'cineview3d.presets.v1',
  ) {}

  private readUser(): Preset[] {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((p): p is Preset => !!p && typeof p === 'object' && typeof (p as Preset).id === 'string' && typeof (p as Preset).name === 'string')
        .map((p) => ({ ...p, builtIn: false, config: sanitizeConfig(p.config).config }));
    } catch {
      return [];
    }
  }

  private writeUser(list: Preset[]) {
    if (!this.storage) throw new Error('Preset storage is not available in this browser.');
    this.storage.setItem(this.key, JSON.stringify(list));
  }

  async list(): Promise<Preset[]> {
    return [...BUILT_IN_PRESETS, ...this.readUser()];
  }

  async save(name: string, config: AuditoriumConfig, description?: string): Promise<Preset> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Please give the preset a name.');
    if (trimmed.length > 60) throw new Error('Preset names are limited to 60 characters.');
    const list = this.readUser();
    const existing = list.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    const preset: Preset = {
      id: existing?.id ?? `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      description,
      builtIn: false,
      createdAt: Date.now(),
      config: structuredClone(config),
    };
    const next = existing ? list.map((p) => (p.id === existing.id ? preset : p)) : [...list, preset];
    this.writeUser(next);
    return preset;
  }

  async remove(id: string): Promise<void> {
    if (BUILT_IN_PRESETS.some((p) => p.id === id)) throw new Error('Built-in presets cannot be deleted.');
    this.writeUser(this.readUser().filter((p) => p.id !== id));
  }
}

export function getBrowserStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined') return null;
    const s = window.localStorage;
    const probe = '__cineview_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
