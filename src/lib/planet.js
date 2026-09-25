// A dotted planet seen from just above its north pole. Signal arcs launch from
// the pole (our "origin") and land around the globe.
import { THREE, softPointsMaterial, makePoints, makeLines, fibSphere } from './gl.js';
import { mulberry32, clamp, lerp } from './util.js';

function blob(x, y, z) {
  return (
    Math.sin(1.3 * x + 0.4) * Math.sin(1.1 * y + 1.7) * Math.sin(1.2 * z + 2.3) +
    0.55 * Math.sin(2.9 * x + 1.9 * z + 0.7) * Math.sin(2.3 * y - 1.1) +
    0.3 * Math.sin(5.1 * y + 3.3 * x) * Math.sin(4.7 * z + 0.3)
  );
}

export function createPlanet({ n = 30000, R = 9, arcs = 36, seed = 7 } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 400);
  const group = new THREE.Group();
  scene.add(group);

  // Surface dots.
  const dotMat = softPointsMaterial({ size: 0.075 });
  const dots = makePoints(n, dotMat);
  const pos = dots.geometry.attributes.position.array;
  const alpha = dots.geometry.attributes.aAlpha.array;
  const size = dots.geometry.attributes.aSize.array;
  const col = dots.geometry.attributes.aColor.array;
  fibSphere(n, R).forEach(([x, y, z], i) => {
    pos.set([x, y, z], i * 3);
    const land = blob(x / R * 2.2, y / R * 2.2, z / R * 2.2) > 0.12;
    alpha[i] = land ? 0.85 : 0.24;
    size[i] = land ? 1 : 0.75;
    const c = land ? [0.55, 0.78, 1.0] : [0.15, 0.35, 0.85];
    col.set(c, i * 3);
  });
  group.add(dots);

  // Atmosphere rim (fresnel) and outer halo.
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#3aa0ff') }, uOpacity: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
      void main(){ float f = 1.0 - abs(dot(vN, vV)); f = pow(f, 3.0); gl_FragColor = vec4(uColor * f * 1.4, f * uOpacity); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.01, 96, 64), atmoMat);
  group.add(atmo);
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#1f6bff') }, uOpacity: { value: 1 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
      void main(){ float d = dot(vN, vV); float f = pow(clamp(0.62 + d, 0.0, 1.0), 5.0); gl_FragColor = vec4(uColor * f, f * uOpacity); }`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.13, 96, 64), haloMat);
  group.add(halo);

  // Occluder so arcs/dots on the far side are hidden.
  const occ = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.985, 64, 48),
    new THREE.MeshBasicMaterial({ color: 0x01030a })
  );
  group.add(occ);

  // Arcs from the north pole.
  const rnd = mulberry32(seed);
  const SEG = 72;
  const pole = new THREE.Vector3(0, R, 0);
  const arcList = [];
  for (let k = 0; k < arcs; k++) {
    const polar = lerp(0.35, 1.25, rnd());
    const az = rnd() * Math.PI * 2;
    const target = new THREE.Vector3(
      Math.sin(polar) * Math.cos(az) * R,
      Math.cos(polar) * R,
      Math.sin(polar) * Math.sin(az) * R
    );
    const h = (0.12 + rnd() * 0.3) * polar * R * 0.42;
    const pts = [];
    const a = pole.clone().normalize();
    const b = target.clone().normalize();
    const omega = Math.acos(clamp(a.dot(b), -1, 1));
    for (let i = 0; i <= SEG; i++) {
      const s = i / SEG;
      const p = a
        .clone()
        .multiplyScalar(Math.sin((1 - s) * omega) / Math.sin(omega))
        .add(b.clone().multiplyScalar(Math.sin(s * omega) / Math.sin(omega)));
      p.multiplyScalar(R + Math.sin(Math.PI * s) * h);
      pts.push(p);
    }
    arcList.push({ pts, target, delay: rnd(), dur: 0.9 + rnd() * 0.7, hue: rnd() });
  }
  const lines = makeLines(arcs * SEG);
  const lp = lines.geometry.attributes.position.array;
  const lc = lines.geometry.attributes.color.array;
  arcList.forEach((arc, k) => {
    for (let i = 0; i < SEG; i++) {
      const o = (k * SEG + i) * 6;
      const p0 = arc.pts[i];
      const p1 = arc.pts[i + 1];
      lp.set([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z], o);
    }
  });
  group.add(lines);

  // Landing flares + origin beacon.
  const flareMat = softPointsMaterial({ size: 0.9 });
  const flares = makePoints(arcs + 1, flareMat);
  const fp = flares.geometry.attributes.position.array;
  arcList.forEach((arc, k) => fp.set([arc.target.x * 1.002, arc.target.y * 1.002, arc.target.z * 1.002], k * 3));
  fp.set([0, R * 1.003, 0], arcs * 3);
  group.add(flares);

  // Vertical beam from the pole.
  const beam = makeLines(40);
  const bp = beam.geometry.attributes.position.array;
  for (let i = 0; i < 40; i++) {
    bp.set([0, R + i * 0.35, 0, 0, R + (i + 1) * 0.35, 0], i * 6);
  }
  group.add(beam);

  const cyan = [0.25, 0.85, 1.0];
  const white = [1, 1, 1];

  return {
    scene,
    camera,
    group,
    R,
    // t: seconds since the planet's own clock start; launches spread over `spread` seconds.
    update({
      t,
      opacity = 1,
      rot = 0,
      tilt = 0,
      center = [0, -11, 0],
      cam = [0, 0.8, 11],
      look = [0, -0.6, 0],
      arcAmt = 1,
      spread = 5,
      beamAmt = 0,
      fov = 36,
    }) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camera.position.set(...cam);
      camera.lookAt(...look);
      group.position.set(...center);
      group.rotation.set(tilt, rot, 0);
      dotMat.uniforms.uOpacity.value = opacity;
      atmoMat.uniforms.uOpacity.value = opacity;
      haloMat.uniforms.uOpacity.value = opacity * 0.9;
      flareMat.uniforms.uOpacity.value = opacity;

      const fa = flares.geometry.attributes.aAlpha.array;
      const fs = flares.geometry.attributes.aSize.array;
      arcList.forEach((arc, k) => {
        const start = arc.delay * spread;
        const head = (t - start) / arc.dur; // 0..1 travelling, >1 landed
        for (let i = 0; i < SEG; i++) {
          const s = (i + 0.5) / SEG;
          let I = 0;
          if (head > 0) {
            const base = 0.07 * clamp(head * 2);
            const tail = s <= head ? Math.exp(-(head - s) * 7) : 0;
            const land = head > 1 ? Math.exp(-(head - 1) * 1.5) : 1;
            I = base + tail * land;
          }
          I *= arcAmt * opacity;
          const hot = s <= head && head - s < 0.03 ? 1 : 0;
          const c = hot ? white : cyan;
          const o = (k * SEG + i) * 6;
          lc[o] = lc[o + 3] = c[0] * I;
          lc[o + 1] = lc[o + 4] = c[1] * I;
          lc[o + 2] = lc[o + 5] = c[2] * I;
        }
        const landed = head - 1;
        fa[k] = landed > 0 ? Math.exp(-landed * 1.2) * arcAmt : 0;
        fs[k] = landed > 0 ? 0.5 + 1.2 * Math.exp(-landed * 3) : 0;
      });
      fa[arcs] = arcAmt * (0.7 + 0.3 * Math.sin(t * 6));
      fs[arcs] = 1.2;
      flares.geometry.attributes.aAlpha.needsUpdate = true;
      flares.geometry.attributes.aSize.needsUpdate = true;
      lines.geometry.attributes.color.needsUpdate = true;

      const bc = beam.geometry.attributes.color.array;
      for (let i = 0; i < 40; i++) {
        const I = Math.min(1, beamAmt) * Math.pow(1 - i / 40, 1.6) * opacity;
        bc.set([0.6 * I, 0.9 * I, I, 0.6 * I, 0.9 * I, I], i * 6);
      }
      beam.geometry.attributes.color.needsUpdate = true;
    },
  };
}
