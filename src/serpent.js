/*
 * The Serpent — a procedural, coiled diamondback rattlesnake rendered in three.js.
 *
 * Sigma Nu's badge carries a golden coiled serpent on black enamel, and the
 * Fraternity's mascot is the rattlesnake. This module builds exactly that:
 *   - a tapered body swept along a defensive coil, neck raised in an "S"
 *   - keeled, overlapping dorsal scales + broad ventral scutes (shader)
 *   - the diamondback pattern, evaluated per-scale so it reads as a mosaic
 *   - banded "coon tail" ending in a segmented rattle that actually shakes
 *   - a broad triangular pit-viper head: brow ridges, heat pits, slit pupils,
 *     forked tongue
 * Everything is procedural — no model files to download.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const SEG = 460; // samples along the body
const RAD = 40; // samples around the body
const SCALE_ROWS = 25; // dorsal scale rows around the body (real rattlesnakes: 25–29)
const HEAD_SCALE = 0.5;

/* ------------------------------------------------------------------ */
/* Body path                                                           */
/* ------------------------------------------------------------------ */

function restControlPoints() {
  const P = [];
  // Tail — lifted out of the centre of the coil, rattle held high.
  P.push(new V3(0.98, 1.72, -0.74));
  P.push(new V3(0.88, 1.42, -0.62));
  P.push(new V3(0.74, 1.12, -0.46));
  // The coil — a shallow cone, inner loops stacked higher than outer ones.
  const turns = 2.35;
  const n = 42;
  const aEnd = 1.75;
  const a0 = aEnd - turns * TAU;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const ang = a0 + f * turns * TAU;
    const r = 0.52 + Math.pow(f, 0.92) * 1.55;
    const y = 0.74 - f * 0.47;
    P.push(new V3(Math.cos(ang) * r, y, Math.sin(ang) * r));
  }
  // Neck — rises out of the front of the coil in a striking "S".
  P.push(new V3(-0.98, 0.42, 1.92));
  P.push(new V3(-1.42, 0.88, 1.5));
  P.push(new V3(-1.24, 1.52, 0.95));
  P.push(new V3(-0.64, 2.02, 0.92));
  P.push(new V3(-0.14, 2.24, 1.36));
  P.push(new V3(0.0, 2.27, 1.6));
  return P;
}

/** Body radius along the snake, s ∈ [0,1] from rattle to head. */
function radiusAt(s) {
  const tail = smooth(0.0, 0.17, s);
  const neck = 1 - 0.44 * smooth(0.64, 0.95, s);
  let r = (0.095 + 0.192 * tail) * neck;
  r *= 0.9 + 0.1 * Math.sin(Math.PI * Math.min(1, s / 0.72));
  return r;
}

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

const GLSL_COMMON = /* glsl */ `
  float snHash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  vec3 snHash3(vec3 p){
    p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6)));
    return fract(sin(p)*43758.5453123);
  }
  vec2 snVoronoi(vec3 x){
    vec3 p = floor(x); vec3 f = fract(x);
    float f1 = 8.0, f2 = 8.0;
    for(int k=-1;k<=1;k++) for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
      vec3 b = vec3(float(i),float(j),float(k));
      vec3 r = b - f + snHash3(p+b);
      float d = dot(r,r);
      if(d<f1){ f2=f1; f1=d; } else if(d<f2){ f2=d; }
    }
    return vec2(sqrt(f1), sqrt(f2));
  }
  float snSegment(vec2 p, vec2 a, vec2 b){
    vec2 pa = p-a, ba = b-a;
    float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
    return length(pa - ba*h);
  }
  vec3 snPerturb(vec3 surfPos, vec3 surfNorm, float h){
    vec3 sx = dFdx(surfPos); vec3 sy = dFdy(surfPos);
    vec3 r1 = cross(sy, surfNorm); vec3 r2 = cross(surfNorm, sx);
    float det = dot(sx, r1);
    vec2 dh = vec2(dFdx(h), dFdy(h));
    vec3 grad = sign(det) * (dh.x*r1 + dh.y*r2);
    return normalize(abs(det)*surfNorm - grad);
  }
`;

// Palette (linear). Black enamel, antique gold, bronze.
const GLSL_PALETTE = /* glsl */ `
  const vec3 SN_BLACK  = vec3(0.010, 0.009, 0.008);
  const vec3 SN_CORE   = vec3(0.045, 0.032, 0.016);
  const vec3 SN_GOLD   = vec3(0.86, 0.60, 0.22);
  const vec3 SN_PALE   = vec3(0.95, 0.80, 0.50);
  const vec3 SN_BRONZE = vec3(0.022, 0.016, 0.009);
  const vec3 SN_BELLY  = vec3(0.42, 0.30, 0.13);
`;

function patchMaterial(material, { head = false, uniforms }) {
  // Body and head share the patch function — give each its own program.
  material.customProgramCacheKey = () => (head ? 'sn-head' : 'sn-body');
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        ${head ? 'varying vec3 vObj;' : 'attribute vec2 aSnake; varying vec2 vSnake;'}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        ${head ? 'vObj = position;' : 'vSnake = aSnake;'}`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        ${head ? 'varying vec3 vObj;' : 'varying vec2 vSnake;'}
        uniform float uTailA;
        uniform float uBump;
        uniform float uGlow;
        ${GLSL_COMMON}
        ${GLSL_PALETTE}
        float snH; float snMetal; float snRough; vec3 snCol;
        `
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        ${head ? HEAD_PATTERN : BODY_PATTERN}
        diffuseColor.rgb = snCol;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = snRough;`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        metalnessFactor = snMetal;`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = snPerturb(-vViewPosition, normal, snH * uBump);`
      );
  };
}

const BODY_PATTERN = /* glsl */ `
  {
    float K = ${SCALE_ROWS.toFixed(1)};
    float yv = vSnake.y * K;
    float row = floor(yv);
    float odd = mod(row, 2.0);
    float xs = vSnake.x + 0.5*odd;
    vec2 cell = vec2(fract(xs)-0.5, fract(yv)-0.5);
    vec2 cid = vec2(floor(xs) - 0.5*odd + 0.5, row + 0.5);

    // Overlapping, keeled dorsal scale: an oval dome, raised toward its free edge.
    float d = length(cell*vec2(1.0, 1.18));
    float dome = smoothstep(0.66, 0.1, d);
    float keel = exp(-abs(cell.y)*20.0) * smoothstep(0.5, 0.05, abs(cell.x)) * 0.4;
    float h = dome*(0.5 + 0.5*(cell.x+0.5)) + keel*dome;
    float crev = smoothstep(0.36, 0.6, d);

    // Ventral scutes — broad transverse plates on the belly.
    float vc = min(vSnake.y, 1.0 - vSnake.y);
    float belly = smoothstep(0.35, 0.41, vc);
    float bx = fract(vSnake.x*0.85) - 0.5;
    float bh = smoothstep(0.5, 0.15, abs(bx)) * (0.55 + 0.45*(bx+0.5));
    h = mix(h, bh, belly);
    crev = mix(crev, smoothstep(0.36, 0.5, abs(bx)), belly);

    // Evaluate the colour pattern at the scale centre -> reads as a mosaic of scales.
    float cvCell = min(cid.y/K, 1.0 - cid.y/K);
    float cx = cid.x;
    float P = 9.0;
    float a = fract(cx/P + 0.5) - 0.5;
    float aPix = fract(vSnake.x/P + 0.5) - 0.5;
    // half scale-mosaic, half smooth: pattern follows the scales without stair-stepping
    float m = mix(abs(a)*2.0 + cvCell/0.205, abs(aPix)*2.0 + vc/0.205, 0.55);
    float rnd = snHash(cid);

    vec3 col; float metal; float rough;
    if (m < 0.58) { col = mix(SN_BLACK, SN_CORE, smoothstep(0.5, 0.0, m)); metal = 0.0; rough = 0.42; }
    else if (m < 0.88) { col = mix(SN_GOLD, SN_PALE, rnd*0.35); metal = 1.0; rough = 0.26 + rnd*0.08; }
    else if (m < 0.99) { col = SN_BLACK; metal = 0.0; rough = 0.4; }
    else {
      col = SN_BRONZE * (0.8 + 0.4*rnd);
      metal = 0.15; rough = 0.46;
      // sparse gold flecks on the flanks
      if (rnd > 0.93) { col = SN_GOLD*0.5; metal = 0.9; rough = 0.35; }
    }
    // lower flanks warm toward the belly
    float flank = smoothstep(0.24, 0.36, cvCell);
    col = mix(col, SN_BRONZE*1.4, flank*0.5);
    // belly
    col = mix(col, SN_BELLY*(0.85+0.2*snHash(vec2(floor(vSnake.x*0.85), 3.0))), belly);
    metal = mix(metal, 0.65, belly);
    rough = mix(rough, 0.36, belly);

    // "Coon tail": crisp black & gold rings before the rattle.
    if (vSnake.x < uTailA) {
      float band = smoothstep(0.46, 0.5, fract(vSnake.x/4.5)) * (1.0 - smoothstep(0.96, 1.0, fract(vSnake.x/4.5)));
      col = mix(SN_BLACK, SN_PALE*0.95, band);
      metal = band; rough = mix(0.4, 0.24, band);
    }

    // crevices between scales: darker, rougher
    col *= mix(1.0, 0.28, crev);
    rough = mix(rough, 0.75, crev*0.7);
    metal *= mix(1.0, 0.6, crev);

    // fade the micro-relief out where it would alias
    float fw = fwidth(vSnake.x);
    h *= smoothstep(0.9, 0.25, fw);

    snH = h; snMetal = metal; snRough = rough; snCol = col;
  }
`;

const HEAD_PATTERN = /* glsl */ `
  {
    vec3 o = vObj;
    vec2 vr = snVoronoi(o*vec3(9.0, 11.0, 8.0));
    float edge = vr.y - vr.x;
    float h = smoothstep(0.0, 0.22, edge);
    float crev = 1.0 - smoothstep(0.0, 0.12, edge);

    float side = smoothstep(0.2, 0.42, abs(o.x));
    vec2 pz = vec2(o.z, o.y);
    // post-ocular stripe: eye -> corner of the jaw
    float s1 = 1.0 - smoothstep(0.035, 0.06, snSegment(pz, vec2(0.18, 0.06), vec2(-0.78, -0.2)));
    // pre-ocular stripe: snout -> front of the eye
    float s2 = 1.0 - smoothstep(0.03, 0.055, snSegment(pz, vec2(0.88, 0.14), vec2(0.34, 0.2)));
    float lip = smoothstep(-0.08, -0.15, o.y) * side;
    // crown: fine gold speckles
    float crown = step(0.975, snHash(floor(o.xz*vec2(24.0, 20.0)))) * smoothstep(0.05, 0.15, o.y);
    float gold = max(max(s1, s2)*side, max(lip*0.45, crown*0.6));

    vec3 col = mix(SN_BLACK, SN_GOLD, gold);
    float metal = gold;
    float rough = mix(0.4, 0.26, gold);
    col *= mix(1.0, 0.3, crev);
    rough = mix(rough, 0.7, crev*0.6);

    snH = h * 0.55; snMetal = metal; snRough = rough; snCol = col;
  }
`;

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

function makeHeadGeometry() {
  const g = new THREE.SphereGeometry(1, 128, 96);
  const pos = g.attributes.position;
  const v = new V3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let { x, y, z } = v;
    // Boxy (superellipse) cross-section: flat crown, flat cheeks.
    const th = Math.atan2(y, x);
    const n = 2.7;
    const f = Math.pow(Math.pow(Math.abs(Math.cos(th)), n) + Math.pow(Math.abs(Math.sin(th)), n), -1 / n);
    const rr = Math.hypot(x, y);
    x = Math.cos(th) * rr * Math.min(f, 1.25);
    y = Math.sin(th) * rr * Math.min(f, 1.25);

    // Triangular plan: broad venom-gland jowls, narrowing to the snout.
    const jowl = 1 + 0.4 * Math.exp(-Math.pow((z + 0.38) / 0.36, 2));
    const taper = 1 - 0.47 * smooth(-0.1, 1.0, z);
    const w = 0.55 * jowl * taper;
    let hgt = 0.27 + 0.07 * smooth(-0.35, 0.35, y);
    hgt *= 1 - 0.3 * smooth(0.2, 1.0, z);
    hgt *= 1 + 0.16 * Math.exp(-Math.pow((z + 0.45) / 0.4, 2));
    x *= w;
    y *= hgt;
    z *= 0.95;
    // Squared-off snout tip.
    if (z > 0.78) z = 0.78 + (z - 0.78) * 0.55;

    // Supraocular brow ridges — the "hooded", menacing look.
    for (const sx of [-1, 1]) {
      const b = Math.exp(-(Math.pow(x - sx * 0.3, 2) / 0.016 + Math.pow(z - 0.18, 2) / 0.05));
      if (y > 0) y += b * 0.035;
    }
    // Mouth line groove.
    const groove = Math.exp(-Math.pow(y + 0.03, 2) / 0.0007) * smooth(-0.85, -0.2, z) * (1 - smooth(0.8, 0.95, z));
    x *= 1 - 0.03 * groove;

    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

function makeEyeTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  // iris — molten gold with radial striations
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#3a2408');
  grd.addColorStop(0.5, '#d9a441');
  grd.addColorStop(1, '#3a2408');
  g.fillStyle = grd;
  g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    g.strokeStyle = `rgba(${Math.random() > 0.5 ? '255,214,130' : '60,30,5'},${Math.random() * 0.25})`;
    g.lineWidth = Math.random() * 1.5;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 30);
    g.stroke();
  }
  // vertical slit pupil — centred at u=0.25 (faces +Z on a three.js sphere)
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(128, 128, 9, 70, 0, 0, TAU);
  g.fill();
  // dark limbal ring
  const ring = g.createRadialGradient(128, 128, 60, 128, 128, 150);
  ring.addColorStop(0, 'rgba(0,0,0,0)');
  ring.addColorStop(1, 'rgba(0,0,0,0.85)');
  g.fillStyle = ring;
  g.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeTongue() {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x1a0406, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.2 });
  const grp = new THREE.Group();
  const shaft = new THREE.CatmullRomCurve3([new V3(0, 0, 0), new V3(0, 0.01, 0.12), new V3(0, 0.0, 0.24)]);
  grp.add(new THREE.Mesh(new THREE.TubeGeometry(shaft, 16, 0.012, 8), mat));
  for (const sx of [-1, 1]) {
    const tine = new THREE.CatmullRomCurve3([new V3(0, 0, 0.23), new V3(sx * 0.02, 0.005, 0.3), new V3(sx * 0.055, 0.02, 0.37)]);
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(tine, 12, 0.007, 6), mat));
  }
  return grp;
}

function makeRattle() {
  const grp = new THREE.Group();
  const count = 9;
  const geo = new THREE.SphereGeometry(1, 40, 24);
  // Pinch each segment into two lobes so the stack reads as interlocking keratin.
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const pinch = 1 - 0.12 * Math.exp(-(y * y) / 0.05);
    p.setXYZ(i, x * pinch, y, z * (0.85 + 0.15 * Math.abs(y)));
  }
  geo.computeVertexNormals();
  const base = new THREE.Color('#c9a462');
  const tip = new THREE.Color('#4a3519');
  let z = 0.0;
  for (let k = 0; k < count; k++) {
    const f = k / (count - 1);
    const size = 0.135 * (1 - f * 0.45);
    const mat = new THREE.MeshPhysicalMaterial({
      color: base.clone().lerp(tip, Math.pow(f, 1.4)),
      roughness: 0.34,
      metalness: 0.35,
      clearcoat: 0.7,
      clearcoatRoughness: 0.3,
      sheen: 0.4,
      sheenColor: new THREE.Color('#f3dca6'),
    });
    const seg = new THREE.Mesh(geo, mat);
    seg.scale.set(size * 0.62, size * 1.12, size * 0.6);
    z += size * (k === 0 ? 0.25 : 0.62);
    seg.position.z = z;
    grp.add(seg);
  }
  return grp;
}

function makeDustTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,230,170,1)');
  grd.addColorStop(0.25, 'rgba(230,180,90,0.6)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ */
/* The Serpent                                                         */
/* ------------------------------------------------------------------ */

export class Serpent {
  constructor(canvas, { lowPower = false } = {}) {
    this.canvas = canvas;
    this.lowPower = lowPower;
    this.visible = true;
    this.mouse = { x: 0, y: 0, sx: 0, sy: 0 };
    // Driven externally by ScrollTrigger timelines.
    this.state = { cx: 0, cy: 2.2, cz: 8.6, tx: 0, ty: 1.3, tz: 0.35, rot: 0, lift: 0 };
    this.shakeUntil = 0;
    this.nextShake = 4;
    this.nextFlick = 2.2;
    this.flickStart = -10;
    this.clock = new THREE.Timer();

    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.25 : 1.75));
    r.setClearColor(0x050505, 1);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.12;
    r.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 80);

    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.42;

    const key = new THREE.DirectionalLight(0xfff0d8, 2.4);
    key.position.set(3, 6, 5);
    const rim = new THREE.DirectionalLight(0xe8b45c, 4.2);
    rim.position.set(-5, 3, -6);
    const rim2 = new THREE.DirectionalLight(0xf7d9a0, 2.2);
    rim2.position.set(6, 1.5, -4);
    const under = new THREE.DirectionalLight(0xc98f3a, 0.8);
    under.position.set(0, -4, 3);
    this.scene.add(key, rim, rim2, under, new THREE.HemisphereLight(0x2c2a33, 0x000000, 0.35));

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.#buildBody();
    this.#buildHead();
    this.rattle = makeRattle();
    this.root.add(this.rattle);
    this.#buildDust();

    this.root.position.y = -0.15;
    this.resize();
    this.#update(0);
  }

  #buildBody() {
    this.rest = restControlPoints();
    this.pts = this.rest.map((p) => p.clone());
    this.curve = new THREE.CatmullRomCurve3(this.pts, false, 'centripetal');
    this.curve.arcLengthDivisions = 1400;

    const vCount = (SEG + 1) * (RAD + 1);
    const geo = new THREE.BufferGeometry();
    this.bodyPos = new Float32Array(vCount * 3);
    this.bodyNrm = new Float32Array(vCount * 3);
    const snake = new Float32Array(vCount * 2);
    geo.setAttribute('position', new THREE.BufferAttribute(this.bodyPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.bodyNrm, 3).setUsage(THREE.DynamicDrawUsage));

    // Along-body coordinate in "scale units" — scales shrink with the body radius, like the real thing.
    const samples = this.curve.getSpacedPoints(SEG);
    let A = 0;
    this.tailA = 0;
    const along = new Float32Array(SEG + 1);
    for (let i = 0; i <= SEG; i++) {
      if (i > 0) {
        const ds = samples[i].distanceTo(samples[i - 1]);
        const rMid = radiusAt((i - 0.5) / SEG);
        A += (ds * SCALE_ROWS) / (TAU * rMid * 1.12);
      }
      along[i] = A;
      if (i / SEG <= 0.085) this.tailA = A;
    }
    for (let i = 0; i <= SEG; i++) {
      for (let j = 0; j <= RAD; j++) {
        const k = i * (RAD + 1) + j;
        snake[k * 2] = along[i];
        snake[k * 2 + 1] = j / RAD;
      }
    }
    geo.setAttribute('aSnake', new THREE.BufferAttribute(snake, 2));

    const idx = [];
    for (let i = 0; i < SEG; i++) {
      for (let j = 0; j < RAD; j++) {
        const a = i * (RAD + 1) + j;
        const b = (i + 1) * (RAD + 1) + j;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new V3(0, 1, 0), 4);

    this.uniforms = {
      uTailA: { value: this.tailA },
      uBump: { value: 0.0065 },
      uGlow: { value: 0 },
    };
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
    });
    patchMaterial(mat, { uniforms: this.uniforms });
    this.body = new THREE.Mesh(geo, mat);
    this.body.frustumCulled = false;
    this.root.add(this.body);

    this.frames = {
      P: Array.from({ length: SEG + 1 }, () => new V3()),
      T: Array.from({ length: SEG + 1 }, () => new V3()),
      N: Array.from({ length: SEG + 1 }, () => new V3()),
      B: Array.from({ length: SEG + 1 }, () => new V3()),
    };
  }

  #buildHead() {
    this.head = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.12 });
    patchMaterial(mat, { head: true, uniforms: this.uniforms });
    const skull = new THREE.Mesh(makeHeadGeometry(), mat);
    this.head.add(skull);

    const eyeMat = new THREE.MeshPhysicalMaterial({
      map: makeEyeTexture(),
      roughness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      emissive: new THREE.Color('#3b2406'),
      emissiveIntensity: 0.6,
    });
    const eyeGeo = new THREE.SphereGeometry(0.095, 48, 32);
    const dark = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.9 });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(sx * 0.43, 0.11, 0.22);
      eye.rotation.y = sx * 0.85;
      this.head.add(eye);
      // heat-sensing pit, between eye and nostril
      const pit = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), dark);
      pit.position.set(sx * 0.355, 0.03, 0.5);
      pit.scale.set(0.7, 1, 1);
      this.head.add(pit);
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.017, 12, 10), dark);
      nostril.position.set(sx * 0.17, 0.1, 0.8);
      this.head.add(nostril);
    }
    this.tongue = makeTongue();
    this.tongue.position.set(0, -0.07, 0.78);
    this.tongue.scale.setScalar(1 / HEAD_SCALE);
    this.tongue.scale.z = 0.0001;
    this.head.add(this.tongue);

    this.head.scale.setScalar(HEAD_SCALE);
    this.root.add(this.head);
  }

  #buildDust() {
    const n = this.lowPower ? 260 : 620;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    this.dustSeed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = 2 + Math.random() * 7;
      const a = Math.random() * TAU;
      p[i * 3] = Math.cos(a) * r;
      p[i * 3 + 1] = -2 + Math.random() * 8;
      p[i * 3 + 2] = Math.sin(a) * r - 1.5;
      this.dustSeed[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.dust = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 0.05,
        map: makeDustTexture(),
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xe6c27a,
      })
    );
    this.scene.add(this.dust);
  }

  /** Rattle the tail — call on bursts of scroll velocity. */
  shake(duration = 1.1) {
    const t = this.clock.getElapsed();
    this.shakeUntil = Math.max(this.shakeUntil, t + duration);
  }

  setMouse(nx, ny) {
    this.mouse.x = nx;
    this.mouse.y = ny;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the whole coil in frame on portrait screens.
    this.camera.fov = w / h < 0.8 ? 52 : w / h < 1.2 ? 42 : 34;
    this.camera.updateProjectionMatrix();
  }

  #update(t) {
    const m = this.mouse;
    m.sx += (m.x - m.sx) * 0.05;
    m.sy += (m.y - m.sy) * 0.05;

    // --- animate control points: breathing coil, swaying neck, head tracks the cursor
    const R = this.rest;
    const P = this.pts;
    const nNeck = 6;
    for (let i = 0; i < R.length; i++) {
      P[i].copy(R[i]);
    }
    for (let k = 0; k < nNeck; k++) {
      const i = R.length - nNeck + k;
      const w = Math.pow((k + 1) / nNeck, 1.6);
      P[i].x += (Math.sin(t * 0.9 + k * 0.3) * 0.07 + m.sx * 0.42) * w;
      P[i].y += (Math.sin(t * 0.7 + k * 0.2) * 0.05 + m.sy * 0.22 + this.state.lift) * w;
      P[i].z += Math.sin(t * 0.55) * 0.05 * w;
    }
    // tail sway (+ violent buzz while rattling)
    const shaking = t < this.shakeUntil;
    const buzz = shaking ? Math.sin(t * 95) * 0.035 : 0;
    for (let k = 0; k < 3; k++) {
      const w = (3 - k) / 3;
      P[k].x += (Math.sin(t * 0.8) * 0.05 + buzz) * w;
      P[k].z += Math.cos(t * 0.6) * 0.04 * w;
    }
    this.curve.needsUpdate = true;
    this.curve.updateArcLengths();
    const S = this.curve.getSpacedPoints(SEG);

    // --- frames: dorsal = world-up where defined, parallel transport where the body is vertical
    const { P: FP, T, N, B } = this.frames;
    const up = new V3(0, 1, 0);
    const tmp = new V3();
    for (let i = 0; i <= SEG; i++) {
      FP[i].copy(S[i]);
      const a = S[Math.max(0, i - 1)];
      const b = S[Math.min(SEG, i + 1)];
      T[i].subVectors(b, a).normalize();
    }
    for (let i = 0; i <= SEG; i++) {
      const proj = tmp.copy(up).addScaledVector(T[i], -up.dot(T[i]));
      const pl = proj.length();
      if (i === 0) {
        N[0].copy(pl > 0.2 ? proj.multiplyScalar(1 / pl) : new V3(0, 0, -1));
        N[0].addScaledVector(T[0], -N[0].dot(T[0])).normalize();
      } else {
        const tr = N[i].copy(N[i - 1]).addScaledVector(T[i], -N[i - 1].dot(T[i])).normalize();
        const w = smooth(0.25, 0.7, pl);
        if (w > 0) tr.lerp(proj.multiplyScalar(1 / Math.max(pl, 1e-5)), w).normalize();
      }
      B[i].crossVectors(T[i], N[i]).normalize();
    }

    // --- sweep the cross-section
    const breath = 1 + 0.022 * Math.sin(t * 1.25);
    const pos = this.bodyPos;
    const nrm = this.bodyNrm;
    const lat = 1.06;
    for (let i = 0; i <= SEG; i++) {
      const s = i / SEG;
      const r = radiusAt(s) * (s > 0.15 && s < 0.85 ? breath : 1);
      const p = FP[i];
      const n = N[i];
      const bb = B[i];
      for (let j = 0; j <= RAD; j++) {
        const phi = (j / RAD) * TAU;
        const c = Math.cos(phi);
        const sn = Math.sin(phi);
        const bv = c > 0 ? 0.95 : 0.72; // flattened belly
        const ox = n.x * c * bv * r + bb.x * sn * lat * r;
        const oy = n.y * c * bv * r + bb.y * sn * lat * r;
        const oz = n.z * c * bv * r + bb.z * sn * lat * r;
        const k = (i * (RAD + 1) + j) * 3;
        pos[k] = p.x + ox;
        pos[k + 1] = p.y + oy;
        pos[k + 2] = p.z + oz;
        let nx = (n.x * c) / bv + (bb.x * sn) / lat;
        let ny = (n.y * c) / bv + (bb.y * sn) / lat;
        let nz = (n.z * c) / bv + (bb.z * sn) / lat;
        const l = Math.hypot(nx, ny, nz) || 1;
        nrm[k] = nx / l;
        nrm[k + 1] = ny / l;
        nrm[k + 2] = nz / l;
      }
    }
    this.body.geometry.attributes.position.needsUpdate = true;
    this.body.geometry.attributes.normal.needsUpdate = true;

    // --- head: rides the end of the neck, looking along it
    const e = SEG;
    const hp = FP[e];
    const ht = T[e];
    const basis = new THREE.Matrix4().makeBasis(tmp.crossVectors(N[e], ht).normalize(), N[e], ht);
    this.head.quaternion.setFromRotationMatrix(basis);
    // a slight downward, predatory tilt
    this.head.rotateX(0.12 - m.sy * 0.1);
    this.head.position.copy(hp).addScaledVector(ht, 0.26);

    // --- tongue flicks
    if (t > this.nextFlick) {
      this.flickStart = t;
      this.nextFlick = t + 2.4 + Math.random() * 3.2;
    }
    const ft = t - this.flickStart;
    const flick = ft < 0.75 ? Math.sin((ft / 0.75) * Math.PI) : 0;
    this.tongue.scale.z = Math.max(0.0001, flick) / HEAD_SCALE;
    this.tongue.rotation.x = flick * Math.sin(t * 38) * 0.35;

    // --- rattle: sits on the tail tip, points out along the tail
    if (t > this.nextShake) {
      this.shake(1.2);
      this.nextShake = t + 6 + Math.random() * 5;
    }
    const tt = tmp.copy(T[0]).negate();
    const rb = new THREE.Matrix4().makeBasis(new V3().crossVectors(N[0], tt).normalize(), N[0], tt);
    this.rattle.quaternion.setFromRotationMatrix(rb);
    if (shaking) this.rattle.rotateY(Math.sin(t * 88) * 0.22);
    this.rattle.position.copy(FP[0]);

    // --- gold dust drifts upward
    const dp = this.dust.geometry.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      let y = dp.getY(i) + 0.0025 * (0.4 + this.dustSeed[i]);
      if (y > 6) y = -2;
      dp.setY(i, y);
    }
    dp.needsUpdate = true;
    this.dust.rotation.y = t * 0.02;

    // --- camera (damped toward the pose the page asks for)
    if (!this.cam) this.cam = { ...this.state };
    const st = this.cam;
    for (const k in this.state) st[k] += (this.state[k] - st[k]) * 0.075;
    this.root.rotation.y = st.rot + Math.sin(t * 0.12) * 0.08 + m.sx * 0.12;
    this.camera.position.set(st.cx + m.sx * 0.35, st.cy + m.sy * 0.2, st.cz);
    this.camera.lookAt(st.tx, st.ty, st.tz);
  }

  /** Compile shaders up-front so the first scroll is smooth. */
  warmup() {
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (!this.visible) return;
      this.clock.update();
      const t = this.clock.getElapsed();
      this.#update(t);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}
