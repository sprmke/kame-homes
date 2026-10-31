import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import { SPEC } from './spec';

/**
 * Kame v6 as a posable, frame-deterministic 3D component. The model is built from
 * `SPEC` exactly like the artifact's live page; everything that moves is a pure function
 * of the `pose` prop, so stills and every video frame render the same on any tab.
 *
 * A pose is plain data (see `Pose`), built with `poses.*` and `blendPose` in `poses.ts`.
 */

export type Eyes = 'open' | 'happy' | 'closed';
export type Prop = 'none' | 'receipt' | 'key' | 'phone' | 'coin';

export interface Pose {
  /** Arm angles in degrees (0 = straight down; right arm positive goes out and up). */
  armL: number;
  armR: number;
  /** Whole body lift in model units (a hop). */
  hop: number;
  /** Body turn in degrees, added to the model's default three-quarter yaw. */
  yaw: number;
  /** Head turn / nod / tilt, degrees. */
  headYaw: number;
  headPitch: number;
  tilt: number;
  eyes: Eyes;
  /** Eye openness 0..1 (blinks, sleepy). */
  lids: number;
  /** 0 = closed smile, >0 = open grin (talking, cheering). */
  open: number;
  /** Mouth width for speech shapes, 0..1. */
  wide: number;
  /** Cheek scale, 1 = default. */
  blush: number;
  /** Breathing phase input (frame); 0 freezes the body. */
  breath: number;
  /** What the right hand holds. */
  prop: Prop;
}

export const REST: Pose = {
  armL: SPEC.groups.armL.rest ?? -18,
  armR: SPEC.groups.armR.rest ?? 18,
  hop: 0,
  yaw: 0,
  headYaw: 0,
  headPitch: 0,
  tilt: 0,
  eyes: 'open',
  lids: 1,
  open: 0,
  wide: 0.5,
  blush: 1,
  breath: 0,
  prop: 'none',
};

export interface KameLook {
  /** Contact shadow color (a darker shade of the plane), or null for none. */
  shadow?: string | null;
  shadowOpacity?: number;
  /** Ground bounce color for the hemisphere light (warm by default). */
  bounce?: string;
  exposure?: number;
}

const deg = (d: number) => (d * Math.PI) / 180;
const PROP_GOLD = '#F2B544';

/* ------------------------------------------------------------------ *
 * Scene build (once per mounted canvas)
 * ------------------------------------------------------------------ */

interface Rig {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  body: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  headPivot: THREE.Group;
  eyeL: THREE.Group;
  eyeR: THREE.Group;
  happyL: THREE.Group;
  happyR: THREE.Group;
  eyeMeshes: THREE.Mesh[];
  cheeks: THREE.Mesh[];
  smile: THREE.Group;
  grin: THREE.Group;
  props: Record<Exclude<Prop, 'none'>, THREE.Group>;
  ground: THREE.Mesh;
  hemi: THREE.HemisphereLight;
}

function makeMaterials() {
  const cache: Record<string, THREE.Material> = {};
  return (hex: string, kind: string): THREE.Material => {
    const k = hex + kind;
    if (cache[k]) return cache[k];
    let m: THREE.Material;
    if (kind === 'emit') m = new THREE.MeshBasicMaterial({ color: hex });
    else if (kind === 'gloss')
      m = new THREE.MeshPhysicalMaterial({
        color: hex,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1,
      });
    else if (kind === 'flat')
      m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.75, envMapIntensity: 0.4 });
    else if (kind === 'metal')
      m = new THREE.MeshPhysicalMaterial({
        color: hex,
        roughness: 0.28,
        metalness: 0.65,
        clearcoat: 0.6,
        envMapIntensity: 1.1,
      });
    else
      m = new THREE.MeshPhysicalMaterial({
        color: hex,
        roughness: 0.42,
        clearcoat: 0.35,
        clearcoatRoughness: 0.45,
        sheen: 0.5,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color('#ffffff'),
        envMapIntensity: 0.65,
      });
    return (cache[k] = m);
  };
}

function tube(
  points: THREE.Vector3[],
  radius: number,
  mat: THREE.Material,
  parent: THREE.Object3D
) {
  const curve = new THREE.CatmullRomCurve3(points);
  parent.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 14, false), mat));
  const cap = new THREE.SphereGeometry(radius, 16, 12);
  [points[0], points[points.length - 1]].forEach((pt) => {
    const m = new THREE.Mesh(cap, mat);
    m.position.copy(pt);
    parent.add(m);
  });
}

/** Props are modelled around the hand: origin = palm, +y up, facing the camera (+z). */
function buildProps(mat: ReturnType<typeof makeMaterials>) {
  const shadowed = (g: THREE.Group) => {
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return g;
  };
  const brand = '#0E8A62';

  // Receipt: white slip, three ink lines, an emerald check badge.
  const receipt = new THREE.Group();
  const slip = new THREE.Mesh(
    new RoundedBoxGeometry(0.5, 0.66, 0.03, 4, 0.04),
    mat('#FFFFFF', 'flat')
  );
  slip.position.set(0, 0.26, 0);
  receipt.add(slip);
  [0.46, 0.36, 0.26].forEach((y, i) => {
    const bar = new THREE.Mesh(
      new RoundedBoxGeometry(i === 0 ? 0.3 : 0.36, 0.035, 0.01, 2, 0.012),
      mat('#C9D3CE', 'flat')
    );
    bar.position.set(i === 0 ? -0.03 : 0, y, 0.02);
    receipt.add(bar);
  });
  const badge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.025, 40),
    mat(brand, 'vinyl')
  );
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0.1, 0.07, 0.025);
  receipt.add(badge);
  const tickA = new THREE.Mesh(
    new RoundedBoxGeometry(0.035, 0.08, 0.01, 2, 0.012),
    mat('#FFFFFF', 'emit')
  );
  tickA.position.set(0.075, 0.06, 0.042);
  tickA.rotation.z = deg(40);
  const tickB = new THREE.Mesh(
    new RoundedBoxGeometry(0.035, 0.13, 0.01, 2, 0.012),
    mat('#FFFFFF', 'emit')
  );
  tickB.position.set(0.118, 0.08, 0.042);
  tickB.rotation.z = deg(-38);
  receipt.add(tickA, tickB);

  // Key: gold bow ring, shaft, two teeth.
  const key = new THREE.Group();
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.045, 20, 48), mat(PROP_GOLD, 'metal'));
  bow.position.set(0, 0.38, 0);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 0.4, 20),
    mat(PROP_GOLD, 'metal')
  );
  shaft.position.set(0, 0.06, 0);
  const t1 = new THREE.Mesh(
    new RoundedBoxGeometry(0.1, 0.05, 0.05, 2, 0.015),
    mat(PROP_GOLD, 'metal')
  );
  t1.position.set(0.06, -0.08, 0);
  const t2 = new THREE.Mesh(
    new RoundedBoxGeometry(0.07, 0.05, 0.05, 2, 0.015),
    mat(PROP_GOLD, 'metal')
  );
  t2.position.set(0.045, 0.0, 0);
  key.add(bow, shaft, t1, t2);

  // Phone: graphite slab, light screen with an emerald header and two rows.
  const phone = new THREE.Group();
  const slab = new THREE.Mesh(
    new RoundedBoxGeometry(0.44, 0.84, 0.05, 6, 0.07),
    mat('#1B2421', 'gloss')
  );
  slab.position.set(0, 0.3, 0);
  const screen = new THREE.Mesh(
    new RoundedBoxGeometry(0.39, 0.77, 0.01, 4, 0.05),
    mat('#F4F7F5', 'emit')
  );
  screen.position.set(0, 0.3, 0.027);
  const head = new THREE.Mesh(
    new RoundedBoxGeometry(0.33, 0.12, 0.01, 2, 0.03),
    mat(brand, 'emit')
  );
  head.position.set(0, 0.56, 0.034);
  const row1 = new THREE.Mesh(
    new RoundedBoxGeometry(0.33, 0.16, 0.01, 2, 0.03),
    mat('#DDE7E2', 'emit')
  );
  row1.position.set(0, 0.36, 0.034);
  const row2 = row1.clone();
  row2.position.set(0, 0.17, 0.034);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.035, 24), mat(brand, 'emit'));
  dot.position.set(-0.11, 0.36, 0.041);
  phone.add(slab, screen, head, row1, row2, dot);

  // Coin: gold disc with a raised inner ring.
  const coin = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.06, 56),
    mat(PROP_GOLD, 'metal')
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.set(0, 0.22, 0);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.018, 12, 56),
    mat('#E3A21F', 'metal')
  );
  ring.position.set(0, 0.22, 0.032);
  coin.add(disc, ring);

  return {
    receipt: shadowed(receipt),
    key: shadowed(key),
    phone: shadowed(phone),
    coin: shadowed(coin),
  };
}

function buildRig(canvas: HTMLCanvasElement): Rig {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(SPEC.camera.fov, 1, 0.1, 100);

  const hemi = new THREE.HemisphereLight(0xfff4e4, 0xf2b878, 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  // Higher than the artifact's key so the contact shadow stays short and under Kame.
  key.position.set(2.6, 11, 4.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -1 });
  key.shadow.bias = -0.0005;
  key.shadow.radius = 6;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xfff0dc, 0.6);
  fill.position.set(-7, 3.5, 6);
  scene.add(fill);
  const back = new THREE.DirectionalLight(0xffe0b0, 1.1);
  back.position.set(-2, 5, -9);
  scene.add(back);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.ShadowMaterial({ opacity: 0.2 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const mat = makeMaterials();
  const SPH = new THREE.SphereGeometry(1, 64, 48);
  const HEMI = new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);

  const root = new THREE.Group();
  scene.add(root);
  const body = new THREE.Group();
  root.add(body);
  const G: Record<string, THREE.Group> = { body };
  const mk = (name: string, parent: THREE.Group) => {
    const g = new THREE.Group();
    const o = SPEC.groups[name].origin;
    g.position.set(o[0], o[1], o[2]);
    parent.add(g);
    G[name] = g;
    return g;
  };
  mk('armL', body);
  mk('armR', body);
  const NK = SPEC.neck;
  const headPivot = new THREE.Group();
  headPivot.position.set(NK[0], NK[1], NK[2]);
  body.add(headPivot);
  const head = new THREE.Group();
  const ho = SPEC.groups.head.origin;
  head.position.set(ho[0] - NK[0], ho[1] - NK[1], ho[2] - NK[2]);
  headPivot.add(head);
  G.head = head;
  ['eyeL', 'eyeR', 'happyL', 'happyR'].forEach((n) => {
    const g = new THREE.Group();
    head.add(g);
    G[n] = g;
  });

  const eyeMeshes: THREE.Mesh[] = [];
  const cheeks: THREE.Mesh[] = [];
  for (const p of SPEC.parts) {
    const m = new THREE.Mesh(p.half ? HEMI : SPH, mat(p.color, p.mat));
    m.position.set(p.c[0], p.c[1], p.c[2]);
    m.quaternion.set(p.q[0], p.q[1], p.q[2], p.q[3]);
    m.scale.set(p.r[0], p.r[1], p.r[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData = { r: p.r.slice(), name: p.name };
    G[p.group].add(m);
    if (p.group === 'eyeL' || p.group === 'eyeR') eyeMeshes.push(m);
    if (p.name === 'cheek') cheeks.push(m);
  }

  // Face curves drawn on the head ellipsoid (same maths as the artifact).
  const HR = SPEC.parts.find((p) => p.name === 'head')!.r;
  const F = SPEC.face as Record<string, number>;
  const onHead = (x: number, y: number, inset: number) => {
    const nx = x / HR[0];
    const ny = y / HR[1];
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const p = new THREE.Vector3(x, y, nz * HR[2]);
    const n = new THREE.Vector3(x / HR[0] ** 2, y / HR[1] ** 2, p.z / HR[2] ** 2).normalize();
    return { p: p.addScaledVector(n, -inset), n };
  };
  const smile = new THREE.Group();
  head.add(smile);
  tube(
    Array.from({ length: 13 }, (_, i) => {
      const x = -F.smileW + (2 * F.smileW * i) / 12;
      return onHead(x, F.smileY - F.smileDip * (1 - (x / F.smileW) ** 2), 0.012).p;
    }),
    0.021,
    mat(SPEC.palette.mouth, 'flat'),
    smile
  );
  [-1, 1].forEach((side) => {
    const g = side < 0 ? G.happyL : G.happyR;
    tube(
      Array.from({ length: 11 }, (_, i) => {
        const dx = -F.arcW + (2 * F.arcW * i) / 10;
        return onHead(F.eyeX * side + dx, F.eyeY - 0.04 + F.arcH * (1 - (dx / F.arcW) ** 2), 0.012)
          .p;
      }),
      0.024,
      mat(SPEC.palette.eye, 'gloss'),
      g
    );
  });

  const grin = new THREE.Group();
  const ds = new THREE.Shape();
  ds.moveTo(-0.2, 0);
  ds.quadraticCurveTo(0, -0.34, 0.2, 0);
  ds.quadraticCurveTo(0, 0.045, -0.2, 0);
  const dGeo = new THREE.ExtrudeGeometry(ds, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 3,
  });
  dGeo.translate(0, 0, -0.03);
  grin.add(new THREE.Mesh(dGeo, mat(SPEC.palette.mouth, 'flat')));
  const tongue = new THREE.Mesh(SPH, mat(SPEC.palette.tongue, 'flat'));
  tongue.position.set(0, -0.12, 0.012);
  tongue.scale.set(0.1, 0.055, 0.03);
  grin.add(tongue);
  const gp = onHead(0, F.grinY, 0.02);
  const grinHolder = new THREE.Group();
  grinHolder.position.copy(gp.p);
  grinHolder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), gp.n);
  grinHolder.scale.setScalar(F.grinS);
  grinHolder.add(grin);
  head.add(grinHolder);

  // Props hang from the right hand and are counter-rotated to stay upright.
  const props = buildProps(mat);
  Object.values(props).forEach((g) => {
    g.visible = false;
    G.armR.add(g);
  });

  return {
    renderer,
    scene,
    camera,
    root,
    body,
    armL: G.armL,
    armR: G.armR,
    headPivot,
    eyeL: G.eyeL,
    eyeR: G.eyeR,
    happyL: G.happyL,
    happyR: G.happyR,
    eyeMeshes,
    cheeks,
    smile,
    grin,
    props,
    ground,
    hemi,
  };
}

/* ------------------------------------------------------------------ *
 * Pose application
 * ------------------------------------------------------------------ */

function apply(rig: Rig, pose: Pose, look: KameLook) {
  const b = pose.breath ? Math.sin(pose.breath * 0.07) : 0;
  rig.root.position.y = pose.hop;
  rig.root.rotation.y = deg(SPEC.yaw + pose.yaw);
  rig.body.scale.set(1 - b * 0.008, 1 + b * 0.012, 1 - b * 0.008);
  rig.armL.rotation.z = deg(pose.armL);
  rig.armR.rotation.z = deg(pose.armR);
  rig.headPivot.rotation.set(deg(pose.headPitch) + b * 0.012, deg(pose.headYaw), deg(pose.tilt));

  const happy = pose.eyes === 'happy';
  const lids = pose.eyes === 'closed' ? 0.08 : Math.max(0.05, pose.lids);
  rig.eyeL.visible = rig.eyeR.visible = !happy;
  rig.happyL.visible = rig.happyR.visible = happy;
  rig.eyeMeshes.forEach((m) => {
    const r = m.userData.r as number[];
    if (m.userData.name === 'eye') m.scale.y = r[1] * lids;
    else m.visible = lids > 0.5;
  });
  rig.cheeks.forEach((m) => {
    const r = m.userData.r as number[];
    m.scale.set(r[0] * pose.blush, r[1] * pose.blush, r[2]);
  });

  const grin = pose.open > 0.06;
  rig.grin.visible = grin;
  rig.smile.visible = !grin;
  rig.grin.scale.set(0.75 + pose.wide * 0.35, 0.35 + pose.open * 0.75, 1);

  (Object.keys(rig.props) as Exclude<Prop, 'none'>[]).forEach((k) => {
    const g = rig.props[k];
    g.visible = pose.prop === k;
    if (!g.visible) return;
    // Palm sits at the arm tip; keep the prop upright and turned to camera.
    g.position.set(0, -0.5, 0.12);
    g.rotation.set(0, -deg(SPEC.yaw + pose.yaw) * 0.6, -deg(pose.armR));
  });

  const ground = rig.ground.material as THREE.ShadowMaterial;
  rig.ground.visible = look.shadow !== null;
  ground.color.set(look.shadow ?? '#000000');
  ground.opacity = look.shadowOpacity ?? 0.22;
  rig.hemi.groundColor.set(look.bounce ?? '#f2b878');
  rig.renderer.toneMappingExposure = look.exposure ?? 0.95;
}

/**
 * Camera framing. `full` keeps the whole body (arms raised included) inside the box;
 * `bust` frames head and shoulders. The character is centered horizontally.
 */
function frameCamera(rig: Rig, w: number, h: number, framing: 'full' | 'bust') {
  const aspect = w / h;
  const lookY = framing === 'full' ? 1.36 : 1.9;
  const halfH = framing === 'full' ? 1.62 : 0.98;
  const halfW = framing === 'full' ? 1.55 : 1.0;
  const d = 9.2;
  const fov = Math.max(2 * Math.atan(halfH / d), 2 * Math.atan(halfW / (d * aspect)));
  rig.camera.fov = (fov * 180) / Math.PI;
  rig.camera.aspect = aspect;
  rig.camera.position.set(0, lookY + 0.55, d);
  rig.camera.lookAt(0, lookY, 0);
  rig.camera.updateProjectionMatrix();
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export function Kame({
  w,
  h,
  pose,
  look = {},
  framing = 'full',
  quality = 1.5,
  style,
}: {
  /** Box size in design pixels; the character is fitted inside it. */
  w: number;
  h: number;
  pose: Pose;
  look?: KameLook;
  framing?: 'full' | 'bust';
  /** Supersampling factor for crisp edges. */
  quality?: number;
  style?: CSSProperties;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rig = useRef<Rig | null>(null);
  const pw = Math.round(w * quality);
  const ph = Math.round(h * quality);

  useLayoutEffect(() => {
    if (!canvas.current) return;
    if (!rig.current) rig.current = buildRig(canvas.current);
    const r = rig.current;
    r.renderer.setSize(pw, ph, false);
    frameCamera(r, pw, ph, framing);
    apply(r, pose, look);
    r.renderer.render(r.scene, r.camera);
  });

  useEffect(
    () => () => {
      const r = rig.current;
      if (!r) return;
      r.renderer.dispose();
      r.renderer.forceContextLoss();
      rig.current = null;
    },
    []
  );

  return (
    <canvas
      ref={canvas}
      width={pw}
      height={ph}
      style={{ width: w, height: h, display: 'block', ...style }}
    />
  );
}
