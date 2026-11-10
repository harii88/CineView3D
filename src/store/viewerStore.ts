import { create } from 'zustand';
import type { SeatId } from '@/types';
import { CAMERA_DEFAULTS } from '@/lib/config/defaults';

export type CameraMode = 'overview' | 'seated' | 'explore';
export type SidePanel = 'seat' | 'compare' | 'best' | 'setup';

export type ScreenContent =
  | { kind: 'procedural' }
  | { kind: 'image'; url: string; name: string }
  | { kind: 'video'; url: string; name: string };

export interface Toast {
  id: number;
  kind: 'info' | 'error' | 'success';
  text: string;
}

export const MAX_COMPARE = 3;

interface ViewerState {
  selected: SeatId | null;
  hovered: SeatId | null;
  mode: CameraMode;
  fov: number;
  /** Incremented to request a camera reset of the current mode. */
  viewNonce: number;
  comparison: SeatId[];
  bestSeats: string[];
  showBest: boolean;
  heatmap: boolean;
  content: ScreenContent;
  videoPaused: boolean;
  videoMuted: boolean;
  houseLights: number;
  reducedMotion: boolean;
  panel: SidePanel;
  sidebarOpen: boolean;
  seatMapOpen: boolean;
  introOpen: boolean;
  toasts: Toast[];

  selectSeat: (seat: SeatId | null) => void;
  setHovered: (seat: SeatId | null) => void;
  setMode: (mode: CameraMode) => void;
  setFov: (fov: number) => void;
  resetView: () => void;
  toggleCompare: (seat: SeatId) => void;
  removeCompare: (seat: SeatId) => void;
  clearCompare: () => void;
  setBestSeats: (labels: string[]) => void;
  setShowBest: (v: boolean) => void;
  setHeatmap: (v: boolean) => void;
  setContent: (c: ScreenContent) => void;
  setVideoPaused: (v: boolean) => void;
  setVideoMuted: (v: boolean) => void;
  setHouseLights: (v: number) => void;
  setReducedMotion: (v: boolean) => void;
  setPanel: (p: SidePanel) => void;
  setSidebarOpen: (v: boolean) => void;
  setSeatMapOpen: (v: boolean) => void;
  setIntroOpen: (v: boolean) => void;
  toast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: number) => void;
  /** Drop selections that no longer exist after the auditorium changed size. */
  pruneSeats: (rows: number, seatsPerRow: number) => void;
}

const same = (a: SeatId | null, b: SeatId | null) => !!a && !!b && a.row === b.row && a.seat === b.seat;
let toastId = 1;

export const useViewer = create<ViewerState>((set, get) => ({
  selected: null,
  hovered: null,
  mode: 'overview',
  fov: CAMERA_DEFAULTS.fov,
  viewNonce: 0,
  comparison: [],
  bestSeats: [],
  showBest: false,
  heatmap: false,
  content: { kind: 'procedural' },
  videoPaused: false,
  videoMuted: true,
  houseLights: 0.25,
  reducedMotion: false,
  panel: 'setup',
  sidebarOpen: false,
  seatMapOpen: true,
  introOpen: false,
  toasts: [],

  selectSeat: (seat) => {
    if (!seat) return set({ selected: null, mode: 'overview' });
    set({ selected: seat, mode: 'seated', panel: get().panel === 'setup' ? 'seat' : get().panel });
  },
  setHovered: (seat) => {
    const cur = get().hovered;
    if (cur === seat || same(cur, seat)) return;
    set({ hovered: seat });
  },
  setMode: (mode) => {
    if (mode === 'seated' && !get().selected) return;
    set({ mode });
  },
  setFov: (fov) => set({ fov: Math.min(CAMERA_DEFAULTS.maxFov, Math.max(CAMERA_DEFAULTS.minFov, fov)) }),
  resetView: () => set({ viewNonce: get().viewNonce + 1 }),
  toggleCompare: (seat) => {
    const list = get().comparison;
    if (list.some((s) => same(s, seat))) return set({ comparison: list.filter((s) => !same(s, seat)) });
    if (list.length >= MAX_COMPARE) {
      get().toast('info', `You can compare up to ${MAX_COMPARE} seats. Remove one first.`);
      return;
    }
    set({ comparison: [...list, seat] });
  },
  removeCompare: (seat) => set({ comparison: get().comparison.filter((s) => !same(s, seat)) }),
  clearCompare: () => set({ comparison: [] }),
  setBestSeats: (labels) => set({ bestSeats: labels, showBest: labels.length > 0 }),
  setShowBest: (v) => set({ showBest: v }),
  setHeatmap: (v) => set({ heatmap: v }),
  setContent: (c) => {
    const prev = get().content;
    if (prev.kind !== 'procedural' && (c.kind === 'procedural' || c.url !== prev.url)) URL.revokeObjectURL(prev.url);
    set({ content: c, videoPaused: false });
  },
  setVideoPaused: (v) => set({ videoPaused: v }),
  setVideoMuted: (v) => set({ videoMuted: v }),
  setHouseLights: (v) => set({ houseLights: Math.min(1, Math.max(0, v)) }),
  setReducedMotion: (v) => set({ reducedMotion: v }),
  setPanel: (p) => set({ panel: p, sidebarOpen: true }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  setSeatMapOpen: (v) => set({ seatMapOpen: v }),
  setIntroOpen: (v) => set({ introOpen: v }),
  toast: (kind, text) => {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-3), { id, kind, text }] });
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 7000 : 3500);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  pruneSeats: (rows, seatsPerRow) => {
    const valid = (s: SeatId | null) => !!s && s.row < rows && s.seat < seatsPerRow;
    const { selected, comparison, hovered, mode } = get();
    set({
      selected: valid(selected) ? selected : null,
      mode: mode === 'seated' && !valid(selected) ? 'overview' : mode,
      hovered: valid(hovered) ? hovered : null,
      comparison: comparison.filter(valid),
    });
  },
}));

/**
 * High-frequency camera state shared outside React (updated every frame by
 * the camera controller, read by the mini-map and view buttons) so that
 * looking around never triggers React re-renders.
 */
export const cameraRig = {
  /** Requested look offset from the screen-centre direction (deg, + yaw = left, + pitch = up). */
  targetYaw: 0,
  targetPitch: 0,
  /** Current camera position and absolute heading (deg) for the mini-map. */
  position: { x: 0, y: 0, z: 0 },
  heading: 0,
  pitch: 0,
  transitioning: false,
};

export function lookAtOffset(yawDeg: number, pitchDeg: number) {
  cameraRig.targetYaw = Math.max(-CAMERA_DEFAULTS.maxYaw, Math.min(CAMERA_DEFAULTS.maxYaw, yawDeg));
  cameraRig.targetPitch = Math.max(-CAMERA_DEFAULTS.maxPitch, Math.min(CAMERA_DEFAULTS.maxPitch, pitchDeg));
}

export function nudgeLook(dYaw: number, dPitch: number) {
  lookAtOffset(cameraRig.targetYaw + dYaw, cameraRig.targetPitch + dPitch);
}
