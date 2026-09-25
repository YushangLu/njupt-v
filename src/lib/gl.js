import * as THREE from '../vendor/three.module.min.js';
import { W, H } from '../timeline.js';

export { THREE };

// One WebGL renderer shared by every scene. Scenes register layers that are
// drawn in order on top of a full-screen gradient background.
export function createGL(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 1);

  // Background: radial gradient with dithering (dark gradients band badly
  // after video compression without it).
  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bgUniforms = {
    uInner: { value: new THREE.Color('#0a1330') },
    uOuter: { value: new THREE.Color('#010208') },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uRadius: { value: 0.9 },
    uSeed: { value: 0 },
  };
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: bgUniforms,
      depthWrite: false,
      depthTest: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `
        uniform vec3 uInner; uniform vec3 uOuter; uniform vec2 uCenter; uniform float uRadius; uniform float uSeed;
        varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
        void main(){
          vec2 p = vUv - uCenter; p.x *= ${(W / H).toFixed(4)};
          float d = clamp(length(p) / uRadius, 0.0, 1.0);
          vec3 c = mix(uInner, uOuter, smoothstep(0.0, 1.0, d));
          c += (h(gl_FragCoord.xy) - 0.5) / 255.0 * 1.5;
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  bgScene.add(bg);

  const layers = [];
  return {
    renderer,
    bg: bgUniforms,
    addLayer(scene, camera, order = 0) {
      const layer = { scene, camera, order, visible: false };
      layers.push(layer);
      layers.sort((a, b) => a.order - b.order);
      return layer;
    },
    render(t) {
      bgUniforms.uSeed.value = (t * 60) % 1000;
      renderer.clear(true, true, true);
      renderer.render(bgScene, bgCam);
      for (const l of layers) {
        if (!l.visible) continue;
        renderer.clearDepth();
        renderer.render(l.scene, l.camera);
      }
    },
  };
}

// Additive soft points with per-point size, alpha and color.
export function softPointsMaterial({ size = 4, attenuate = true } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: size },
      uOpacity: { value: 1 },
      uScale: { value: H / 2 },
    },
    vertexShader: `
      attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
      uniform float uSize; uniform float uScale;
      varying float vAlpha; varying vec3 vColor;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        ${attenuate ? 'gl_PointSize = uSize * aSize * (uScale / max(0.001, -mv.z));' : 'gl_PointSize = uSize * aSize;'}
        vAlpha = aAlpha; vColor = aColor;
      }`,
    fragmentShader: `
      uniform float uOpacity; varying float vAlpha; varying vec3 vColor;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d) * 2.0;
        float a = 1.0 - smoothstep(0.0, 1.0, r);
        a = a * a;
        float core = 1.0 - smoothstep(0.0, 0.35, r);
        gl_FragColor = vec4(vColor + core * 0.6, a * vAlpha * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function makePoints(n, material) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  const pts = new THREE.Points(geo, material);
  pts.frustumCulled = false;
  return pts;
}

// Line segments with per-vertex color*alpha baked into color (additive).
export function makeLines(nSegments) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nSegments * 6), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nSegments * 6), 3));
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return lines;
}

// Fibonacci sphere.
export function fibSphere(n, r = 1) {
  const out = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const rr = Math.sqrt(1 - y * y);
    const th = g * i;
    out.push([Math.cos(th) * rr * r, y * r, Math.sin(th) * rr * r]);
  }
  return out;
}
