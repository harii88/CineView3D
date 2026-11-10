'use client';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import type { AuditoriumLayout } from '@/types';
import { getScreenArcLength } from '@/lib/geometry';
import { createScreenMaterial, proceduralAverageColor } from './screenMaterial';
import { useScreenContent } from './useScreenContent';
import { StandardScreen } from './StandardScreen';
import { IMAXScreen } from './IMAXScreen';
import { ScreenX } from './ScreenX';

let rectInit = false;

/**
 * Screen system entry point: owns the shared content material and the screen
 * light, and delegates geometry to the component for the active screen type.
 */
export function CinemaScreen({ layout }: { layout: AuditoriumLayout }) {
  if (!rectInit) {
    RectAreaLightUniformsLib.init();
    rectInit = true;
  }
  const material = useMemo(() => createScreenMaterial(), []);
  useEffect(() => () => material.dispose(), [material]);
  const content = useScreenContent();
  const { screen } = layout;
  const mainLight = useRef<THREE.RectAreaLight>(null);
  const sideLights = useRef<(THREE.RectAreaLight | null)[]>([]);
  const color = useMemo(() => new THREE.Color(), []);

  const sideExtent = useMemo(() => {
    let m = 0.0001;
    for (const strip of screen.sideStrips)
      for (const s of strip.samples) m = Math.max(m, s.p < 0 ? -s.p : s.p - 1);
    return m;
  }, [screen]);

  useFrame(({ clock }) => {
    const u = material.uniforms;
    const t = clock.getElapsedTime();
    u.uTime.value = t;
    u.uAspect.value = getScreenArcLength(screen) / screen.height;
    u.uHasMap.value = content.texture ? 1 : 0;
    u.uMap.value = content.texture;
    u.uMapAspect.value = content.aspect;
    u.uSideExtent.value = sideExtent;
    if (content.texture) color.copy(content.average);
    else proceduralAverageColor(t, color);
    // Brighter content casts more light on the room.
    const lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
    const hue = color.clone().multiplyScalar(1 / Math.max(lum, 0.05));
    const intensity = 0.6 + lum * 5.5;
    if (mainLight.current) {
      mainLight.current.color.copy(hue).lerp(new THREE.Color(1, 1, 1), 0.4);
      mainLight.current.intensity = intensity;
    }
    for (const l of sideLights.current) {
      if (!l) continue;
      l.color.copy(hue).lerp(new THREE.Color(1, 1, 1), 0.4);
      l.intensity = intensity * 0.55;
    }
  });

  // One area light per side wall surface (ScreenX), placed at its centre facing inward.
  const sideLightDefs = useMemo(
    () =>
      screen.sideStrips.map((strip) => {
        const s = strip.samples;
        const first = s[0];
        const last = s[s.length - 1];
        const len = Math.max(0.5, last.z - first.z);
        const x = strip.side === 'left' ? -Math.abs(last.x) + 0.05 : Math.abs(last.x) - 0.05;
        const yb = s.reduce((a, q) => a + q.bottom, 0) / s.length;
        return { x, y: (yb + screen.top) / 2, z: (first.z + last.z) / 2, w: len, h: Math.max(0.5, screen.top - yb), side: strip.side };
      }),
    [screen],
  );

  return (
    <group>
      {screen.type === 'imax' ? (
        <IMAXScreen layout={layout} material={material} />
      ) : screen.type === 'screenx' ? (
        <ScreenX layout={layout} material={material} />
      ) : (
        <StandardScreen layout={layout} material={material} />
      )}
      <rectAreaLight
        ref={mainLight}
        width={screen.width}
        height={screen.height}
        position={[0, screen.centerY, screen.sagitta * 0.5 + 0.05]}
        rotation={[0, Math.PI, 0]} /* lights emit along local -z; turn to face the audience (+z) */
        intensity={2}
      />
      {sideLightDefs.map((d, i) => (
        <rectAreaLight
          key={`${d.side}-${i}`}
          ref={(el) => {
            sideLights.current[i] = el;
          }}
          width={d.w}
          height={d.h}
          position={[d.x, d.y, d.z]}
          rotation={[0, d.side === 'left' ? -Math.PI / 2 : Math.PI / 2, 0]}
          intensity={1}
        />
      ))}
    </group>
  );
}
