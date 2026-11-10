'use client';
import { useEffect, useRef } from 'react';
import { useAuditorium } from '@/store/auditoriumStore';
import { cameraRig, useViewer } from '@/store/viewerStore';
import { sampleMainScreen } from '@/lib/geometry';

/**
 * Plan-view mini-map: room, screen (and ScreenX walls), seats, the selected
 * seat and a cone showing the current viewing direction and field of view.
 * Draws on a canvas in its own animation loop, reading the camera pose from
 * `cameraRig` so looking around never re-renders React.
 */
export function MiniMap({ size = 168 }: { size?: number }) {
  const layout = useAuditorium((s) => s.layout);
  const selected = useViewer((s) => s.selected);
  const fov = useViewer((s) => s.fov);
  const ref = useRef<HTMLCanvasElement>(null);

  const pad = 10;
  const aspect = layout.length / layout.width;
  const w = size;
  const h = Math.min(size * 1.5, Math.max(size * 0.7, (size - pad * 2) * aspect + pad * 2));

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const s = Math.min((w - pad * 2) / layout.width, (h - pad * 2) / layout.length);
    const ox = w / 2;
    const oy = (h - layout.length * s) / 2;
    const X = (x: number) => ox + x * s;
    const Y = (z: number) => oy + (z - layout.frontWallZ) * s;
    const mainPts = sampleMainScreen(layout.screen, 16);
    const spr = layout.config.seatsPerRow;
    const sel = selected ? layout.seats[selected.row * spr + selected.seat] : null;
    const aspectRatio = (canvas.parentElement?.closest('[data-viewer]') as HTMLElement | null)?.clientWidth ?? 16;
    const viewerH = (canvas.parentElement?.closest('[data-viewer]') as HTMLElement | null)?.clientHeight ?? 9;
    const hfov = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * (aspectRatio / viewerH));
    let raf = 0;

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // room
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(X(-layout.width / 2), Y(layout.frontWallZ), layout.width * s, layout.length * s);
      ctx.fill();
      ctx.stroke();
      // seats
      const dot = Math.max(1.2, Math.min(3, layout.config.dimensions.seatWidth * s * 0.8));
      ctx.fillStyle = 'rgba(190,60,80,0.75)';
      for (const seat of layout.seats) ctx.fillRect(X(seat.position.x) - dot / 2, Y(seat.position.z) - dot / 2, dot, dot);
      // screen + side surfaces
      ctx.strokeStyle = '#f5d28a';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      mainPts.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.z)) : ctx.moveTo(X(p.x), Y(p.z))));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(245,210,138,0.6)';
      for (const strip of layout.screen.sideStrips) {
        ctx.beginPath();
        strip.samples.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.z)) : ctx.moveTo(X(p.x), Y(p.z))));
        ctx.stroke();
      }
      // selected seat
      if (sel) {
        ctx.fillStyle = '#f5c451';
        ctx.beginPath();
        ctx.arc(X(sel.position.x), Y(sel.position.z), 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      // camera cone
      const c = cameraRig.position;
      const inside =
        Math.abs(c.x) <= layout.width / 2 + 0.01 && c.z >= layout.frontWallZ - 0.01 && c.z <= layout.backWallZ + 0.01;
      if (inside) {
        const heading = (cameraRig.heading * Math.PI) / 180;
        const r = Math.max(18, Math.min(w, h) * 0.3);
        const cx = X(c.x);
        const cy = Y(c.z);
        // forward direction in plan: (-sin(yaw), -cos(yaw)) → canvas (x, y=z)
        const a0 = Math.atan2(-Math.cos(heading), -Math.sin(heading));
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, 'rgba(120,190,255,0.55)');
        grad.addColorStop(1, 'rgba(120,190,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, a0 - hfov / 2, a0 + hfov / 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [layout, selected, fov, w, h]);

  return (
    <figure className="pointer-events-none select-none" aria-label="Auditorium mini-map">
      <canvas ref={ref} style={{ width: w, height: h }} className="block" aria-hidden="true" />
      <figcaption className="sr-only">
        Mini-map showing the screen at the top, seat rows, your seat and the direction you are looking.
      </figcaption>
    </figure>
  );
}
