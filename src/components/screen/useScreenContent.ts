'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useViewer } from '@/store/viewerStore';

export interface ScreenContentHandle {
  texture: THREE.Texture | null;
  aspect: number;
  /** Updated a few times per second from the actual pixels (image/video). */
  average: THREE.Color;
}

/**
 * Turns the user's chosen content (generated / image / video) into a Three.js
 * texture. Failed loads fall back to the generated content with an error toast.
 */
export function useScreenContent(): ScreenContentHandle {
  const content = useViewer((s) => s.content);
  const paused = useViewer((s) => s.videoPaused);
  const muted = useViewer((s) => s.videoMuted);
  const [state, setState] = useState<{ texture: THREE.Texture | null; aspect: number }>({ texture: null, aspect: 16 / 9 });
  const average = useRef(new THREE.Color(0.5, 0.4, 0.4));
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const { setContent, toast } = useViewer.getState();
    const fail = (msg: string) => {
      toast('error', msg);
      setContent({ kind: 'procedural' });
    };
    if (content.kind === 'procedural') {
      setState({ texture: null, aspect: 16 / 9 });
      return;
    }

    let disposed = false;
    let tex: THREE.Texture | null = null;
    let sampler: number | undefined;
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const sampleAverage = (src: CanvasImageSource) => {
      if (!ctx) return;
      try {
        ctx.drawImage(src, 0, 0, 8, 8);
        const d = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
        }
        const n = (d.length / 4) * 255;
        average.current.setRGB(r / n, g / n, b / n);
      } catch {
        /* ignore tainted canvas etc. */
      }
    };

    if (content.kind === 'image') {
      const img = new Image();
      img.onload = () => {
        if (disposed) return;
        tex = new THREE.Texture(img);
        tex.colorSpace = THREE.NoColorSpace; // shader writes sRGB values directly
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
        sampleAverage(img);
        setState({ texture: tex, aspect: img.naturalWidth / Math.max(1, img.naturalHeight) });
      };
      img.onerror = () => !disposed && fail(`Could not load the image "${content.name}". Is it a valid image file?`);
      img.src = content.url;
    } else {
      const video = document.createElement('video');
      video.src = content.url;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      videoRef.current = video;
      video.onloadeddata = () => {
        if (disposed) return;
        tex = new THREE.VideoTexture(video);
        tex.colorSpace = THREE.NoColorSpace;
        setState({ texture: tex, aspect: video.videoWidth / Math.max(1, video.videoHeight) });
        video.play().catch(() => useViewer.getState().setVideoPaused(true));
        sampler = window.setInterval(() => sampleAverage(video), 250);
      };
      video.onerror = () =>
        !disposed && fail(`This browser cannot play "${content.name}". Try an MP4 (H.264) or WebM file.`);
    }

    return () => {
      disposed = true;
      if (sampler) clearInterval(sampler);
      tex?.dispose();
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
        videoRef.current = null;
      }
    };
  }, [content]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, muted, state.texture]);

  return { texture: state.texture, aspect: state.aspect, average: average.current };
}
