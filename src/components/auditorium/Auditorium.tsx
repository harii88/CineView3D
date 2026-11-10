'use client';
import { useEffect, useMemo } from 'react';
import type { AuditoriumLayout } from '@/types';
import { useViewer } from '@/store/viewerStore';
import { CinemaScreen } from '@/components/screen/CinemaScreen';
import { Floor } from './Floor';
import { Walls } from './Walls';
import { SeatGrid } from './SeatGrid';
import { Aisles } from './Aisles';
import { getMaterials } from './materials';

/**
 * House lighting. The projected image (rect area lights in CinemaScreen) is
 * the dominant light; this adds a low ambient fill and dimmable house lights
 * so the room is dark but seats remain readable.
 */
function Lighting({ layout }: { layout: AuditoriumLayout }) {
  const house = useViewer((s) => s.houseLights);
  const mats = getMaterials();
  useEffect(() => {
    mats.ceilingLight.color.setRGB(1, 0.89, 0.72).multiplyScalar(0.15 + house * 0.85);
    mats.sconce.color.setRGB(1, 0.8, 0.55).multiplyScalar(0.35 + house * 0.65);
    mats.stepLight.color.setRGB(1, 0.7, 0.36).multiplyScalar(0.9);
  }, [house, mats]);

  const points = useMemo(() => {
    const n = Math.min(6, Math.max(2, Math.round(layout.length / 8)));
    return Array.from({ length: n }, (_, i) => layout.frontWallZ + (layout.length * (i + 0.5)) / n);
  }, [layout]);
  const pointIntensity = house * 4 * layout.height * layout.height;

  return (
    <>
      <ambientLight intensity={0.06 + house * 0.25} color="#b8b0d0" />
      <hemisphereLight args={['#8f9cff', '#3a1c24', 0.12 + house * 0.45]} />
      {house > 0.02 &&
        points.map((z, i) => (
          <pointLight
            key={i}
            position={[0, layout.height - 0.4, z]}
            intensity={pointIntensity}
            distance={layout.height * 3 + layout.width}
            decay={2}
            color="#ffd9a8"
          />
        ))}
    </>
  );
}

export function Auditorium({ layout }: { layout: AuditoriumLayout }) {
  return (
    <group>
      <Lighting layout={layout} />
      <Floor layout={layout} />
      <Walls layout={layout} />
      <Aisles layout={layout} />
      <SeatGrid layout={layout} />
      <CinemaScreen layout={layout} />
    </group>
  );
}
