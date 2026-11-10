'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { AuditoriumLayout, Vec3 } from '@/types';
import { getSeatFromLayout } from '@/lib/geometry';
import {
  clampToRoom,
  directionToYawPitch,
  easeInOutCubic,
  getExploreStart,
  getOverviewPose,
  lerpAngle,
  planTransition,
  quadraticBezier,
} from '@/lib/geometry/cameraMath';
import { cameraRig, lookAtOffset, nudgeLook, useViewer } from '@/store/viewerStore';

const DEG = Math.PI / 180;

interface Transition {
  from: Vec3;
  control: Vec3;
  to: Vec3;
  yaw0: number;
  pitch0: number;
  yaw1: number;
  pitch1: number;
  t: number;
  duration: number;
  onDone?: () => void;
}

function isTypingTarget(el: EventTarget | null) {
  const e = el as HTMLElement | null;
  if (!e) return false;
  return e.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName) || !!e.closest?.('[data-own-keys]');
}

/**
 * Camera system.
 *  overview – orbit around a cut-away model of the room.
 *  seated   – fixed at the selected seat's eye position; look around only.
 *  explore  – free movement (WASD) inside the room, opt-in.
 * Every mode change / seat change is an eased flight, never a jump.
 */
export function CameraController({ layout }: { layout: AuditoriumLayout }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const mode = useViewer((s) => s.mode);
  const selected = useViewer((s) => s.selected);
  const fov = useViewer((s) => s.fov);
  const viewNonce = useViewer((s) => s.viewNonce);
  const reducedMotion = useViewer((s) => s.reducedMotion);

  const orbitRef = useRef<OrbitControlsImpl>(null);
  const [orbitEnabled, setOrbitEnabled] = useState(false);
  const anim = useRef<Transition | null>(null);
  const look = useRef({ yaw: 0, pitch: 0 });
  const free = useRef({ yaw: 0, pitch: 0 });
  const keys = useRef(new Set<string>());
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);

  const seat = selected ? getSeatFromLayout(layout, selected.row, selected.seat) : null;
  const eye = seat?.eye ?? null;
  const base = eye ? directionToYawPitch(eye, layout.screen.center) : null;
  const overview = useMemo(() => getOverviewPose(layout), [layout]);

  const startTransition = (to: Vec3, yaw1: number, pitch1: number, onDone?: () => void) => {
    euler.setFromQuaternion(camera.quaternion, 'YXZ');
    const from = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const { control, duration } = planTransition(from, to, reducedMotion, Math.max(layout.height - 0.3, to.y));
    anim.current = { from, control, to, yaw0: euler.y, pitch0: euler.x, yaw1, pitch1, t: 0, duration, onDone };
    cameraRig.transitioning = true;
    setOrbitEnabled(false);
  };

  const flyToOverview = () =>
    startTransition(overview.position, overview.yaw, overview.pitch, () => {
      const c = orbitRef.current;
      if (c) {
        c.target.set(overview.target.x, overview.target.y, overview.target.z);
        c.update();
      }
      setOrbitEnabled(true);
    });

  // Initial placement (no animation on first paint).
  useEffect(() => {
    camera.position.set(overview.position.x, overview.position.y, overview.position.z);
    camera.rotation.set(overview.pitch, overview.yaw, 0, 'YXZ');
    if (orbitRef.current) {
      orbitRef.current.target.set(overview.target.x, overview.target.y, overview.target.z);
      orbitRef.current.update();
    }
    setOrbitEnabled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seated: fly to the seat whenever the seat or its physical position changes.
  const seatKey =
    mode === 'seated' && eye ? `${seat!.label}|${eye.x.toFixed(4)}|${eye.y.toFixed(4)}|${eye.z.toFixed(4)}|${layout.screen.centerY.toFixed(3)}` : null;
  useEffect(() => {
    if (!seatKey || !eye || !base) return;
    lookAtOffset(0, 0);
    look.current = { yaw: 0, pitch: 0 };
    startTransition(eye, base.yaw, base.pitch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seatKey]);

  // Overview: fly out when entering overview or when the room changes size.
  const overviewKey = mode === 'overview' ? `${overview.position.x.toFixed(3)}|${overview.position.y.toFixed(3)}|${overview.position.z.toFixed(3)}` : null;
  const firstOverview = useRef(true);
  useEffect(() => {
    // Skip only the mount run: the initial placement already put the camera at the overview pose.
    if (firstOverview.current) {
      firstOverview.current = false;
      return;
    }
    if (!overviewKey) return;
    flyToOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overviewKey]);

  // Explore: start from the seat (or the back of the room) and roam freely.
  useEffect(() => {
    if (mode !== 'explore') return;
    const start = eye ?? getExploreStart(layout);
    const dir = directionToYawPitch(start, layout.screen.center);
    free.current = { yaw: dir.yaw, pitch: dir.pitch };
    startTransition(start, dir.yaw, dir.pitch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Reset View button.
  const firstNonce = useRef(true);
  useEffect(() => {
    if (firstNonce.current) {
      firstNonce.current = false;
      return;
    }
    if (mode === 'seated') lookAtOffset(0, 0);
    else if (mode === 'overview') flyToOverview();
    else {
      const start = eye ?? getExploreStart(layout);
      const dir = directionToYawPitch(start, layout.screen.center);
      free.current = { yaw: dir.yaw, pitch: dir.pitch };
      startTransition(start, dir.yaw, dir.pitch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewNonce]);

  // Pointer look, wheel FOV, keyboard.
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onDown = (e: PointerEvent) => {
      if (mode === 'overview') return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      // Degrees per pixel so that dragging "grabs" the scene at any FOV.
      const k = camera.fov / Math.max(200, el.clientHeight);
      const s = useViewer.getState();
      if (s.mode === 'seated') {
        nudgeLook(dx * k, dy * k);
        look.current = { yaw: cameraRig.targetYaw, pitch: cameraRig.targetPitch };
      } else if (s.mode === 'explore') {
        free.current.yaw += dx * k * DEG;
        free.current.pitch = Math.max(-1.45, Math.min(1.45, free.current.pitch + dy * k * DEG));
      }
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      const s = useViewer.getState();
      if (s.mode === 'overview') return; // orbit controls zoom instead
      e.preventDefault();
      s.setFov(s.fov + e.deltaY * 0.03);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = useViewer.getState();
      const k = e.key.toLowerCase();
      if (k === 'escape' && s.mode !== 'overview') {
        s.setMode('overview');
        return;
      }
      if (s.mode === 'seated' || s.mode === 'explore') {
        const step = e.shiftKey ? 15 : 5;
        const arrows: Record<string, [number, number]> = {
          arrowleft: [step, 0],
          arrowright: [-step, 0],
          arrowup: [0, step],
          arrowdown: [0, -step],
        };
        if (arrows[k]) {
          e.preventDefault();
          if (s.mode === 'seated') nudgeLook(arrows[k][0], arrows[k][1]);
          else {
            free.current.yaw += arrows[k][0] * DEG;
            free.current.pitch = Math.max(-1.45, Math.min(1.45, free.current.pitch + arrows[k][1] * DEG));
          }
          return;
        }
      }
      if (s.mode === 'explore' && ['w', 'a', 's', 'd', 'q', 'e', ' '].includes(k)) {
        e.preventDefault();
        keys.current.add(k);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const onBlur = () => keys.current.clear();
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [gl, camera, mode]);

  const tmpDir = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);

    // Smooth FOV changes.
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 10));
      camera.updateProjectionMatrix();
    }

    const a = anim.current;
    if (a) {
      a.t = a.duration <= 0 ? 1 : Math.min(1, a.t + dt / a.duration);
      const e = easeInOutCubic(a.t);
      const p = quadraticBezier(a.from, a.control, a.to, e);
      camera.position.set(p.x, p.y, p.z);
      camera.rotation.set(a.pitch0 + (a.pitch1 - a.pitch0) * e, lerpAngle(a.yaw0, a.yaw1, e), 0, 'YXZ');
      if (a.t >= 1) {
        anim.current = null;
        cameraRig.transitioning = false;
        a.onDone?.();
      }
    } else if (mode === 'seated' && eye && base) {
      const f = 1 - Math.exp(-dt * 9);
      look.current.yaw += (cameraRig.targetYaw - look.current.yaw) * f;
      look.current.pitch += (cameraRig.targetPitch - look.current.pitch) * f;
      const pitch = Math.max(-85 * DEG, Math.min(85 * DEG, base.pitch + look.current.pitch * DEG));
      camera.position.set(eye.x, eye.y, eye.z);
      camera.rotation.set(pitch, base.yaw + look.current.yaw * DEG, 0, 'YXZ');
    } else if (mode === 'explore') {
      const speed = (keys.current.has(' ') ? 5 : 2.5) * dt;
      const { yaw, pitch } = free.current;
      const fwd = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
      const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
      let mx = 0,
        mz = 0,
        my = 0;
      if (keys.current.has('w')) (mx += fwd.x), (mz += fwd.z);
      if (keys.current.has('s')) (mx -= fwd.x), (mz -= fwd.z);
      if (keys.current.has('d')) (mx += right.x), (mz += right.z);
      if (keys.current.has('a')) (mx -= right.x), (mz -= right.z);
      if (keys.current.has('e')) my += 1;
      if (keys.current.has('q')) my -= 1;
      const p = clampToRoom(
        { x: camera.position.x + mx * speed, y: camera.position.y + my * speed, z: camera.position.z + mz * speed },
        layout,
      );
      camera.position.set(p.x, p.y, p.z);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    }

    // Publish pose for the mini-map.
    camera.getWorldDirection(tmpDir);
    cameraRig.position.x = camera.position.x;
    cameraRig.position.y = camera.position.y;
    cameraRig.position.z = camera.position.z;
    cameraRig.heading = Math.atan2(-tmpDir.x, -tmpDir.z) / DEG;
    cameraRig.pitch = Math.asin(Math.max(-1, Math.min(1, tmpDir.y))) / DEG;
  });

  const maxDist = Math.max(layout.width, layout.length, layout.height) * 3 + 10;
  return (
    <OrbitControls
      ref={orbitRef}
      enabled={orbitEnabled && mode === 'overview'}
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI * 0.49}
      minDistance={2}
      maxDistance={maxDist}
      makeDefault={false}
    />
  );
}

