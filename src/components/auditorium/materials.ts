import * as THREE from 'three';

/**
 * Shared procedural textures and materials. Built once per page and reused by
 * every mesh so the GPU sees a handful of materials regardless of seat count.
 */

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = true) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

let cache: ReturnType<typeof build> | null = null;

function build() {
  const carpet = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#1b1222';
    ctx.fillRect(0, 0, 256, 256);
    const r = rand(7);
    for (let i = 0; i < 9000; i++) {
      const v = 18 + r() * 26;
      ctx.fillStyle = `rgba(${v + 14},${v * 0.6},${v + 22},0.5)`;
      ctx.fillRect(r() * 256, r() * 256, 1.5, 1.5);
    }
    // subtle geometric cinema-carpet motif
    ctx.strokeStyle = 'rgba(160,90,140,0.10)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        ctx.arc(32 + i * 64, 32 + j * 64, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });

  const fabric = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#231a24';
    ctx.fillRect(0, 0, 256, 256);
    const r = rand(13);
    for (let i = 0; i < 6000; i++) {
      const v = 26 + r() * 16;
      ctx.fillStyle = `rgba(${v + 6},${v * 0.75},${v + 4},0.35)`;
      ctx.fillRect(r() * 256, r() * 256, 1, 2);
    }
    // acoustic panel seams
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 3, 256);
    ctx.fillRect(0, 0, 256, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(3, 0, 1, 256);
  });

  const velvet = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    const r = rand(29);
    for (let i = 0; i < 3000; i++) {
      const v = 200 + r() * 55;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(r() * 128, r() * 128, 1, 1);
    }
  });

  return {
    carpet,
    fabric,
    velvet,
    floor: new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95, metalness: 0 }),
    riser: new THREE.MeshStandardMaterial({ color: '#120d16', roughness: 0.9 }),
    wall: new THREE.MeshStandardMaterial({ map: fabric, roughness: 0.92, side: THREE.FrontSide }),
    frontWall: new THREE.MeshStandardMaterial({ color: '#050407', roughness: 1 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#0d0a10', roughness: 1 }),
    stage: new THREE.MeshStandardMaterial({ color: '#0b0a0d', roughness: 0.7 }),
    masking: new THREE.MeshStandardMaterial({ color: '#020203', roughness: 1 }),
    curtain: new THREE.MeshStandardMaterial({ color: '#5a0f1c', roughness: 0.85, side: THREE.DoubleSide }),
    seatFabric: new THREE.MeshStandardMaterial({ map: velvet, roughness: 0.82, metalness: 0 }),
    seatFrame: new THREE.MeshStandardMaterial({ color: '#161318', roughness: 0.55, metalness: 0.2 }),
    stepLight: new THREE.MeshBasicMaterial({ color: '#ffb35c', toneMapped: false }),
    ceilingLight: new THREE.MeshBasicMaterial({ color: '#ffe2b8', toneMapped: false }),
    sconce: new THREE.MeshBasicMaterial({ color: '#ffcf8f', toneMapped: false }),
  };
}

export function getMaterials() {
  if (!cache) cache = build();
  return cache;
}
