import * as THREE from 'three';

/**
 * Screen content material.
 *
 * Every projection surface carries uv = (P, v):
 *   P – panoramic coordinate; the main screen spans [0, 1], ScreenX side
 *       surfaces continue below 0 (left) and above 1 (right).
 *   v – 0 at the nominal screen bottom, 1 at the top.
 *
 * Content sources:
 *   - procedural: an original, generated cinematic landscape that is
 *     naturally continuous across all P, so it wraps around ScreenX walls.
 *   - texture (image/video): fitted ("contain") to the main screen. On ScreenX
 *     side surfaces the outer band of the frame is stretched outward and
 *     dimmed – an approximation of ScreenX's extended content.
 *
 * PROJECTION MAPPING HOOK: `sampleSide()` is the single place where side
 * surface content is derived. A real projection-mapping implementation (e.g.
 * dedicated side feeds or per-projector warps) only needs to replace it.
 */

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;      // main screen width / height
  uniform float uHasMap;
  uniform sampler2D uMap;
  uniform float uMapAspect;   // content width / height
  uniform float uBrightness;
  uniform float uSideDim;
  uniform float uSideExtent;  // max |P| beyond the main screen
  uniform float uEdgeBand;    // fraction of the frame stretched onto side walls

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  // Original generated "establishing shot": dusk sky, sun, clouds, stars,
  // parallax mountain ranges and a lake – drifting slowly like a camera move.
  vec3 procedural(vec2 uv) {
    float t = uTime;
    vec2 q = vec2(uv.x * uAspect, uv.y);
    float phase = 0.5 + 0.5 * sin(t * 0.045);
    float horizon = 0.34;

    vec3 skyTop = mix(vec3(0.02, 0.025, 0.09), vec3(0.08, 0.16, 0.42), phase);
    vec3 skyMid = mix(vec3(0.20, 0.08, 0.22), vec3(0.55, 0.32, 0.50), phase);
    vec3 skyHor = mix(vec3(0.75, 0.25, 0.18), vec3(1.0, 0.62, 0.30), phase);
    float h = max(q.y - horizon, 0.0);
    vec3 col = mix(skyHor, skyMid, smoothstep(0.0, 0.25, h));
    col = mix(col, skyTop, smoothstep(0.2, 0.7, h));

    vec2 sun = vec2(0.5 * uAspect + 0.35 * sin(t * 0.02), horizon + 0.06 + 0.12 * phase);
    float d = length(q - sun);
    col += vec3(1.0, 0.78, 0.5) * (smoothstep(0.075, 0.07, d) * 1.2 + 0.45 * exp(-d * 5.0));

    float stars = step(0.996, hash(floor(q * 220.0))) * smoothstep(0.55, 0.95, q.y) * (1.0 - phase);
    col += stars * (0.6 + 0.4 * sin(t * 2.0 + hash(floor(q * 220.0)) * 40.0));

    float cl = fbm(vec2(q.x * 1.4 + t * 0.03, q.y * 4.0));
    float clMask = smoothstep(0.52, 0.85, cl) * smoothstep(horizon + 0.05, horizon + 0.4, q.y);
    col = mix(col, skyHor * 0.9 + vec3(0.12, 0.06, 0.1), clMask * 0.55);

    vec3 hazeCol = skyHor * 0.55;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float speed = 0.012 + 0.018 * fi;
      float ridge = horizon + 0.11 - 0.045 * fi + (0.16 - 0.03 * fi) * (fbm(vec2(q.x * (0.7 + 0.5 * fi) + t * speed + fi * 17.0, fi * 3.1)) - 0.5);
      vec3 mc = mix(hazeCol, vec3(0.015, 0.012, 0.03), (fi + 1.0) / 3.2);
      col = mix(col, mc, smoothstep(ridge + 0.003, ridge - 0.003, q.y) * step(horizon - 0.02, q.y));
    }

    if (q.y < horizon - 0.02) {
      float depth = (horizon - 0.02 - q.y);
      vec2 rq = vec2(q.x + 0.01 * sin(q.y * 140.0 + t * 1.5), horizon + depth * 1.4);
      vec3 refl = mix(skyHor, skyMid, smoothstep(0.0, 0.25, depth * 1.4));
      float sd = length(rq - sun);
      refl += vec3(1.0, 0.7, 0.4) * 0.5 * exp(-sd * 6.0) * (0.6 + 0.4 * sin(q.y * 300.0 + t * 3.0));
      col = refl * 0.45 * (1.0 - depth * 1.2);
    }
    return col;
  }

  vec3 sampleMain(vec2 uv) {
    // Contain-fit the content inside the main screen (letterbox / pillarbox).
    vec2 tuv = uv;
    float r = uMapAspect / uAspect;
    if (r > 1.0) tuv.y = (uv.y - 0.5) * r + 0.5; else tuv.x = (uv.x - 0.5) / r + 0.5;
    if (tuv.x < 0.0 || tuv.x > 1.0 || tuv.y < 0.0 || tuv.y > 1.0) return vec3(0.0);
    return texture2D(uMap, tuv).rgb;
  }

  vec3 sampleSide(vec2 uv) {
    float beyond = uv.x < 0.0 ? -uv.x : uv.x - 1.0;
    float k = clamp(beyond / max(uSideExtent, 1e-3), 0.0, 1.0);
    float band = uEdgeBand * (1.0 - k);
    float u = uv.x < 0.0 ? band : 1.0 - band;
    vec3 c = vec3(0.0);
    for (int i = -2; i <= 2; i++) {
      c += sampleMain(vec2(clamp(u + float(i) * 0.01, 0.0, 1.0), uv.y + float(i) * 0.008));
    }
    return c / 5.0 * (1.0 - 0.5 * k);
  }

  void main() {
    bool side = vUv.x < 0.0 || vUv.x > 1.0;
    vec3 col = uHasMap > 0.5 ? (side ? sampleSide(vUv) : sampleMain(vUv)) : procedural(vUv);
    if (side) col *= uSideDim;
    gl_FragColor = vec4(col * uBrightness, 1.0);
  }
`;

export function createScreenMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: 1.85 },
      uHasMap: { value: 0 },
      uMap: { value: null },
      uMapAspect: { value: 16 / 9 },
      uBrightness: { value: 1 },
      uSideDim: { value: 0.82 },
      uSideExtent: { value: 1 },
      uEdgeBand: { value: 0.12 },
    },
    toneMapped: false,
    side: THREE.FrontSide,
  });
}

/**
 * Approximate average colour of the procedural content at time t. Mirrors
 * the palette in the shader so the screen's light on the room matches what is
 * on screen.
 */
export function proceduralAverageColor(t: number, out: THREE.Color) {
  const phase = 0.5 + 0.5 * Math.sin(t * 0.045);
  const mix = (a: number, b: number) => a + (b - a) * phase;
  out.setRGB(mix(0.32, 0.55), mix(0.14, 0.34), mix(0.2, 0.36));
  return out;
}
