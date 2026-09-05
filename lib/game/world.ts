import * as T from 'three';
import { inCreek, isLand } from './state';

export type Collider = { x: number; z: number; radius: number };
const materials = new Map<string, T.MeshStandardMaterial>();
function mat(color: string) {
  let m = materials.get(color);
  if (!m) {
    m = new T.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
    materials.set(color, m);
  }
  return m;
}
export function mesh(
  parent: T.Object3D,
  geo: T.BufferGeometry,
  color: string,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new T.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(
  p: T.Object3D,
  c: string,
  w: number,
  h: number,
  d: number,
  x = 0,
  y = 0,
  z = 0,
) {
  return mesh(p, new T.BoxGeometry(w, h, d), c, x, y, z);
}
function ball(p: T.Object3D, c: string, r: number, x = 0, y = 0, z = 0) {
  return mesh(p, new T.IcosahedronGeometry(r, 1), c, x, y, z);
}
function cyl(
  p: T.Object3D,
  c: string,
  rt: number,
  rb: number,
  h: number,
  x = 0,
  y = 0,
  z = 0,
  n = 8,
) {
  return mesh(p, new T.CylinderGeometry(rt, rb, h, n), c, x, y, z);
}
export function ground(x: number, z: number) {
  if (x > 53) return 1.1 + 0.25 * Math.sin(x * 0.3) * Math.cos(z * 0.2);
  const fade = T.MathUtils.clamp((44 - Math.hypot(x, z)) / 6, 0, 1);
  return (
    (0.95 +
      0.38 * Math.sin(x * 0.13) * Math.cos(z * 0.12) +
      0.15 * Math.sin(z * 0.3)) *
    fade
  );
}
let seed = 731;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
const paths = [
  [-18, 30, -17, -12],
  [-17, -12, -24, 4],
  [-17, -12, -11, -24],
  [-17, -12, -4, 0],
  [-4, 0, 22, 0],
  [-4, 0, 0, 21],
  [0, 21, 15, 21],
  [15, 21, 22, 0],
  [22, 0, 22, -9],
  [22, 0, 37, 9],
  [64, -15, 81, -18],
];
function lineDistance(x: number, z: number, p: number[]) {
  const [a, b, c, d] = p;
  const t = T.MathUtils.clamp(
    ((x - a) * (c - a) + (z - b) * (d - b)) / ((c - a) ** 2 + (d - b) ** 2),
    0,
    1,
  );
  return Math.hypot(x - a - t * (c - a), z - b - t * (d - b));
}
function nearPath(x: number, z: number) {
  return paths.some((p) => lineDistance(x, z, p) < 2.6);
}
function path(
  parent: T.Object3D,
  points: number[],
  width = 2.1,
  color = '#ddc28b',
) {
  const [ax, az, bx, bz] = points,
    len = Math.hypot(bx - ax, bz - az),
    nx = ((-(bz - az) / len) * width) / 2,
    nz = (((bx - ax) / len) * width) / 2,
    verts: number[] = [];
  for (let i = 0; i < Math.ceil(len * 2); i++) {
    const n = Math.ceil(len * 2),
      t = i / n,
      u = (i + 1) / n;
    const corners = [
      [ax + (bx - ax) * t + nx, az + (bz - az) * t + nz],
      [ax + (bx - ax) * t - nx, az + (bz - az) * t - nz],
      [ax + (bx - ax) * u + nx, az + (bz - az) * u + nz],
      [ax + (bx - ax) * u - nx, az + (bz - az) * u - nz],
    ];
    if (
      inCreek(
        (corners[0][0] + corners[2][0]) / 2,
        (corners[0][1] + corners[2][1]) / 2,
      )
    )
      continue;
    for (const j of [0, 2, 1, 1, 2, 3]) {
      const [x, z] = corners[j];
      verts.push(x, ground(x, z) + 0.045, z);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return mesh(parent, geo, color);
}
export function label(
  parent: T.Object3D,
  text: string,
  x: number,
  y: number,
  z: number,
  scale = 4.5,
) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff9e9';
  ctx.beginPath();
  ctx.roundRect(4, 12, 504, 102, 35);
  ctx.fill();
  ctx.font = '500 39px Trebuchet MS';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3f553d';
  ctx.fillText(text, 256, 64);
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  const s = new T.Sprite(
    new T.SpriteMaterial({ map: texture, depthTest: true }),
  );
  s.position.set(x, y, z);
  s.scale.set(scale, scale / 4, 1);
  parent.add(s);
  return s;
}
function terrain(scene: T.Scene, cx: number, cz: number, radius: number) {
  cyl(scene, '#e3cd99', radius + 0.9, radius + 1.5, 0.75, cx, -0.69, cz, 80);
  const verts: number[] = [],
    colors: number[] = [],
    color = new T.Color();
  for (let x = -radius; x < radius; x += 1.1)
    for (let z = -radius; z < radius; z += 1.1) {
      if (Math.hypot(x + 0.55, z + 0.55) > radius) continue;
      const wx = x + cx,
        wz = z + cz;
      if (cx === 0 && inCreek(wx + 0.55, wz + 0.55)) continue;
      const shade = rand();
      color.set(shade > 0.8 ? '#93b65b' : shade > 0.35 ? '#87ac53' : '#80a64f');
      for (const [dx, dz] of [
        [0, 0],
        [0, 1.1],
        [1.1, 0],
        [1.1, 0],
        [0, 1.1],
        [1.1, 1.1],
      ]) {
        verts.push(wx + dx, ground(wx + dx, wz + dz), wz + dz);
        colors.push(color.r, color.g, color.b);
      }
    }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const land = new T.Mesh(
    geo,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      flatShading: true,
    }),
  );
  land.receiveShadow = true;
  scene.add(land);
}
function tree(p: T.Object3D, x: number, z: number, s: number, pine = false) {
  const g = new T.Group();
  g.position.set(x, ground(x, z), z);
  g.scale.setScalar(s);
  p.add(g);
  cyl(g, '#856448', 0.14, 0.27, 2.5, 0, 1.25, 0);
  if (pine) {
    for (let i = 0; i < 3; i++)
      mesh(
        g,
        new T.ConeGeometry(1.4 - i * 0.26, 2.4, 7),
        ['#3b7453', '#4d895b', '#69a269'][i],
        0,
        2 + i * 0.85,
        0,
      );
  } else {
    ball(g, '#6f9e4c', 1.6, 0, 3.2, 0);
    ball(g, '#83ac52', 1.25, -0.7, 2.8, 0.45);
    ball(g, '#a3ba5b', 1.15, 0.65, 3.8, 0.15);
  }
  return g;
}
function house(
  p: T.Object3D,
  x: number,
  z: number,
  color: string,
  roof: string,
  s = 1,
) {
  const g = new T.Group();
  g.position.set(x, ground(x, z), z);
  g.scale.setScalar(s);
  p.add(g);
  box(g, '#c7b88d', 5.5, 0.3, 4.6, 0, 0.1, 0);
  box(g, color, 4.8, 3.3, 4, 0, 1.75, 0);
  const shape = new T.Shape();
  shape.moveTo(-2.9, 0);
  shape.lineTo(2.9, 0);
  shape.lineTo(0, 2);
  shape.closePath();
  mesh(
    g,
    new T.ExtrudeGeometry(shape, { depth: 4.8, bevelEnabled: false }),
    roof,
    0,
    3.3,
    -2.4,
  );
  box(g, '#6e5942', 1.05, 2, 0.14, 0.3, 1.2, 2.06);
  ball(g, '#d2b26b', 0.07, 0.64, 1.2, 2.17);
  for (const wx of [-1.45, 1.55]) {
    box(g, '#efe8c9', 1.1, 1.15, 0.15, wx, 2, 2.05);
    box(g, '#6f9d9c', 0.85, 0.9, 0.17, wx, 2, 2.15);
    box(g, '#f2e9c4', 0.07, 1, 0.19, wx, 2, 2.25);
    box(g, '#f2e9c4', 0.95, 0.07, 0.19, wx, 2, 2.25);
    box(g, '#a87754', 1.3, 0.3, 0.55, wx, 1.28, 2.2);
    for (let i = 0; i < 4; i++)
      ball(
        g,
        i % 2 ? '#efbc62' : '#c5716b',
        0.17,
        wx - 0.4 + i * 0.26,
        1.53,
        2.2,
      );
  }
  box(g, '#e9dec0', 0.7, 2, 0.75, 1.5, 4.5, -0.6);
  box(g, '#a87754', 0.9, 0.18, 0.95, 1.5, 5.45, -0.6);
  return g;
}
function fence(p: T.Object3D, ax: number, az: number, bx: number, bz: number) {
  const g = new T.Group();
  p.add(g);
  const length = Math.hypot(bx - ax, bz - az),
    n = Math.ceil(length / 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      x = ax + (bx - ax) * t,
      z = az + (bz - az) * t;
    cyl(g, '#e1d6ad', 0.09, 0.12, 1.25, x, ground(x, z) + 0.58, z, 5);
  }
  for (const h of [0.5, 0.95]) {
    const rail = box(
      g,
      '#e9dcb3',
      length,
      0.12,
      0.14,
      (ax + bx) / 2,
      ground((ax + bx) / 2, (az + bz) / 2) + h,
      (az + bz) / 2,
    );
    rail.rotation.y = -Math.atan2(bz - az, bx - ax);
  }
  return g;
}
export function animal(kind: 'fox' | 'rabbit' | 'bear' | 'otter' | 'puffin') {
  const g = new T.Group(),
    fur = {
      fox: '#d78b43',
      rabbit: '#e5ddbf',
      bear: '#91694a',
      otter: '#a17b5b',
      puffin: '#384b4b',
    }[kind],
    coat =
      kind === 'fox' ? '#537b67' : kind === 'rabbit' ? '#b07176' : '#718c78';
  const body = ball(g, coat, 0.52, 0, 0.85, 0);
  body.scale.set(0.85, 1.1, 0.7);
  const head = ball(g, fur, 0.48, 0, 1.57, 0.04);
  head.scale.set(1, 1, 0.88);
  for (const side of [-1, 1]) {
    if (kind === 'fox') {
      const ear = mesh(
        g,
        new T.ConeGeometry(0.21, 0.5, 4),
        fur,
        side * 0.29,
        2,
        0.02,
      );
      ear.rotation.z = side * -0.2;
      mesh(
        g,
        new T.ConeGeometry(0.11, 0.28, 4),
        '#644b3b',
        side * 0.29,
        2.02,
        0.1,
      );
    } else if (kind === 'rabbit') {
      const ear = ball(g, fur, 0.2, side * 0.23, 2.1, 0);
      ear.scale.set(0.7, 2.6, 0.65);
      const inner = ball(g, '#d2a69e', 0.12, side * 0.23, 2.13, 0.1);
      inner.scale.set(0.6, 3, 0.3);
    } else if (kind !== 'puffin') ball(g, fur, 0.17, side * 0.35, 1.91, 0);
    ball(g, '#293532', 0.055, side * 0.185, 1.63, 0.438);
    const leg = cyl(
      g,
      kind === 'fox' ? '#4f4d3c' : fur,
      0.14,
      0.16,
      0.48,
      side * 0.22,
      0.28,
      0.02,
    );
    leg.name = side === -1 ? 'leftLeg' : 'rightLeg';
    const arm = ball(g, fur, 0.19, side * 0.48, 0.9, 0.05);
    arm.scale.set(0.7, 1.7, 0.8);
    arm.name = side === -1 ? 'leftArm' : 'rightArm';
  }
  const snout = ball(
    g,
    kind === 'puffin' ? '#e5ac4a' : '#f3e4c1',
    0.22,
    0,
    1.4,
    0.39,
  );
  snout.scale.set(1, 0.7, 1);
  ball(g, '#3d3c32', 0.065, 0, 1.46, 0.61);
  if (kind === 'fox') {
    const tail = mesh(g, new T.ConeGeometry(0.25, 1.2, 7), fur, 0, 0.72, -0.53);
    tail.rotation.x = -0.85;
    const tip = ball(g, '#eee4c6', 0.22, 0, 0.98, -0.86);
    tip.scale.set(1, 1.5, 1);
    cyl(g, '#476e5b', 0.42, 0.45, 0.16, 0, 1.94, 0.06);
    box(g, '#476e5b', 0.6, 0.07, 0.4, 0, 1.93, 0.32);
    box(g, '#bd7c43', 0.72, 0.78, 0.35, 0, 0.98, -0.41);
    box(g, '#e6c17d', 0.75, 0.22, 0.39, 0, 1.26, -0.42);
    box(g, '#edce74', 0.12, 0.6, 0.03, 0, 1.04, -0.62);
    const scarf = box(g, '#d76947', 0.6, 0.15, 0.54, 0, 1.25, 0.02);
    scarf.name = 'scarf';
  }
  return g;
}
function flowers(
  p: T.Object3D,
  count: number,
  cx: number,
  cz: number,
  r: number,
  avoid = true,
) {
  const entries: { x: number; z: number; s: number; col: T.Color }[] = [];
  for (let i = 0; i < count * 4 && entries.length < count; i++) {
    const x = cx + (rand() - 0.5) * r * 2,
      z = cz + (rand() - 0.5) * r * 2;
    if (
      !isLand(x, z) ||
      Math.hypot(x - cx, z - cz) > r ||
      (avoid && nearPath(x, z))
    )
      continue;
    entries.push({
      x,
      z,
      s: 0.7 + rand() * 0.7,
      col: new T.Color(
        ['#f1d56e', '#f3ecd0', '#c98eae', '#d98b69'][Math.floor(rand() * 4)],
      ),
    });
  }
  const stems = new T.InstancedMesh(
      new T.ConeGeometry(0.07, 0.55, 3),
      mat('#668b3f'),
      entries.length,
    ),
    petals = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.13, 0),
      mat('#ffffff'),
      entries.length,
    ),
    dummy = new T.Object3D();
  entries.forEach((v, i) => {
    dummy.position.set(v.x, ground(v.x, v.z) + 0.22 * v.s, v.z);
    dummy.scale.setScalar(v.s);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 0.29 * v.s;
    dummy.scale.set(v.s * 1.2, v.s * 0.55, v.s * 1.2);
    dummy.updateMatrix();
    petals.setMatrixAt(i, dummy.matrix);
    petals.setColorAt(i, v.col);
  });
  p.add(stems, petals);
  return { stems, petals };
}
export function makeWorld(scene: T.Scene) {
  seed = 731;
  materials.clear();
  const colliders: Collider[] = [];
  terrain(scene, 0, 0, 43);
  terrain(scene, 80, -15, 18.5);
  const waterGeo = new T.PlaneGeometry(700, 700, 90, 90);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new T.Mesh(
    waterGeo,
    new T.MeshStandardMaterial({
      color: '#72b9b7',
      roughness: 0.42,
      metalness: 0.12,
      flatShading: true,
    }),
  );
  water.position.y = -0.22;
  water.receiveShadow = true;
  scene.add(water);
  for (const p of paths) path(scene, p);
  house(scene, -17, -16, '#f2dbb1', '#b9543e', 1.2);
  colliders.push({ x: -17, z: -16, radius: 3.4 });
  label(scene, 'WILLOW POST', -17, 6.8, -13, 5);
  const postbox = new T.Group();
  postbox.position.set(-17, ground(-17, -12), -12);
  scene.add(postbox);
  cyl(postbox, '#8e7250', 0.09, 0.12, 1.1, 0, 0.5, 0);
  box(postbox, '#b84e3e', 0.7, 0.6, 0.6, 0, 1.3, 0);
  box(postbox, '#f5dfb9', 0.47, 0.06, 0.02, 0, 1.36, 0.31);
  house(scene, -27, 0.5, '#b3cfcb', '#687f75', 0.85);
  colliders.push({ x: -27, z: 0.5, radius: 2.7 });
  house(scene, -11, -29, '#d7b985', '#866449', 1);
  colliders.push({ x: -11, z: -29, radius: 3 });
  house(scene, 24, -14, '#e6c590', '#b96846', 0.9);
  colliders.push({ x: 24, z: -14, radius: 2.8 });
  house(scene, -5, 26, '#ebe0ba', '#c78555', 0.7);
  colliders.push({ x: -5, z: 26, radius: 2.1 });
  const windmill = new T.Group();
  windmill.position.set(20, ground(20, -23), -23);
  scene.add(windmill);
  cyl(windmill, '#e9dbb4', 1.5, 2.3, 7, 0, 3.5, 0);
  mesh(windmill, new T.ConeGeometry(2.1, 2.4, 10), '#aa654b', 0, 8, 0);
  const blades = new T.Group();
  blades.position.set(0, 6, 1.7);
  windmill.add(blades);
  for (let i = 0; i < 4; i++) {
    const arm = new T.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    blades.add(arm);
    box(arm, '#795e41', 0.14, 4.2, 0.14, 0, 2, 0);
    box(arm, '#fbebbf', 0.8, 2.6, 0.08, 0.33, 2.5, 0.03);
    for (let j = 0; j < 5; j++)
      box(arm, '#bc9a65', 0.85, 0.07, 0.1, 0.33, 1.4 + j * 0.55, 0.1);
  }
  ball(blades, '#725c3f', 0.35);
  colliders.push({ x: 20, z: -23, radius: 2.8 });
  const lighthouse = new T.Group();
  lighthouse.position.set(84, ground(84, -23), -23);
  scene.add(lighthouse);
  cyl(lighthouse, '#eee8ce', 1.25, 2.1, 9, 0, 4.5, 0);
  cyl(lighthouse, '#b76551', 1.5, 1.7, 1.5, 0, 5.5, 0);
  cyl(lighthouse, '#465f59', 1.7, 1.7, 0.25, 0, 9, 0);
  cyl(lighthouse, '#d4dbbb', 1.15, 1.15, 1.5, 0, 9.8, 0);
  mesh(lighthouse, new T.ConeGeometry(1.9, 1.4, 12), '#b8664e', 0, 11.2, 0);
  const beacon = new T.PointLight('#ffdda0', 0, 45, 1.2);
  beacon.position.set(0, 9.7, 0);
  lighthouse.add(beacon);
  colliders.push({ x: 84, z: -23, radius: 2.7 });
  const bridge = new T.Group();
  scene.add(bridge);
  for (let i = 0; i < 18; i++) {
    const x = 2 + i * 0.5,
      h = ground(2, 0) + 0.2 + Math.sin((i / 17) * Math.PI) * 0.55;
    box(bridge, '#b59160', 0.47, 0.2, 3.5, x, h, 0);
    if (i % 3 === 0)
      for (const z of [-1.7, 1.7])
        cyl(bridge, '#815f43', 0.08, 0.1, 1.4, x, h + 0.55, z);
  }
  for (const z of [-1.7, 1.7])
    box(bridge, '#d3b281', 8.8, 0.13, 0.12, 6.25, ground(2, 0) + 1.1, z);
  bridge.visible = false;
  label(scene, 'A bridge would be nice…', 1, 3.3, 1, 5.8);
  const gate = fence(scene, -23, -18, -17, -18);
  fence(scene, -32, -18, -23, -18);
  fence(scene, -17, -18, -14, -18);
  fence(scene, -30, 7, -27, 13);
  fence(scene, -27, 13, -22, 13);
  const garden = new T.Group();
  scene.add(garden);
  path(garden, [-18, 17, -20, -5], 3.5, '#cdbc87');
  flowers(garden, 220, -20, 6, 11, false);
  garden.visible = false;
  const seedGarden = new T.Group();
  scene.add(seedGarden);
  for (let i = 0; i < 12; i++) {
    const x = -30 + (i % 4) * 0.8,
      z = 6 + Math.floor(i / 4) * 0.7,
      y = ground(x, z);
    cyl(seedGarden, '#6d913e', 0.04, 0.04, 1.3, x, y + 0.65, z, 4);
    const flower = ball(seedGarden, '#e8ba49', 0.24, x, y + 1.4, z);
    flower.scale.z = 0.35;
    ball(seedGarden, '#806840', 0.12, x, y + 1.4, z + 0.08);
  }
  seedGarden.visible = false;
  const picnic = new T.Group();
  picnic.position.set(-13, ground(-13, -23) + 0.07, -23);
  scene.add(picnic);
  box(picnic, '#d99679', 4, 0.045, 3);
  for (let i = 0; i < 5; i++)
    box(picnic, '#f7dfb2', 0.2, 0.055, 3, -1.8 + i * 0.8, 0.02, 0);
  cyl(picnic, '#b18a59', 0.34, 0.4, 0.4, 0.8, 0.2, 0);
  ball(picnic, '#c96845', 0.17, 0.4, 0.15, 0.4);
  picnic.visible = false;
  const workshop = house(scene, 31, 1, '#e8d5a1', '#699289', 0.8);
  workshop.visible = false;
  function dock(x: number, z: number, sign: number) {
    const g = new T.Group();
    scene.add(g);
    for (let i = 0; i < 10; i++) {
      const px = x + (i - 5) * 0.6;
      box(g, '#a8875d', 0.56, 0.18, 2.8, px, 0.35, z);
      if (i === 0 || i === 9)
        for (const dz of [-1.5, 1.5])
          cyl(g, '#795f44', 0.13, 0.16, 1.8, px, 0, z + dz);
    }
    label(
      g,
      sign === 1 ? 'Willow landing' : 'Gull landing',
      x,
      2.8,
      z - 2,
      4.2,
    );
  }
  dock(40, 9, 1);
  dock(62, -15, -1);
  const boat = new T.Group();
  scene.add(boat);
  const hull = ball(boat, '#a66a43', 1.3);
  hull.scale.set(0.75, 0.4, 1.6);
  box(boat, '#dec08a', 1.5, 0.13, 2.6, 0, 0.28, 0);
  box(boat, '#b9744b', 1.5, 0.2, 0.32, 0, 0.48, 0.8);
  cyl(boat, '#826146', 0.06, 0.07, 3.5, 0, 1.9, 0);
  const sailGeo = new T.BufferGeometry();
  sailGeo.setAttribute(
    'position',
    new T.Float32BufferAttribute([0, 3.45, 0, 0, 0.9, 0, 1.9, 1.05, 0], 3),
  );
  sailGeo.computeVertexNormals();
  const sail = new T.Mesh(
    sailGeo,
    new T.MeshStandardMaterial({
      color: '#f7e7b9',
      side: T.DoubleSide,
      roughness: 1,
    }),
  );
  boat.add(sail);
  boat.position.set(44, -0.05, 9);
  boat.visible = false;
  const buoys: T.Object3D[] = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 7,
      x = 45 + t * 14,
      z = 9 - t * 24,
      b = new T.Group();
    b.position.set(x, -0.05, z);
    scene.add(b);
    cyl(b, '#d87d5c', 0.19, 0.3, 0.7, 0, 0.1, 0, 6);
    cyl(b, '#efdfad', 0.2, 0.22, 0.2, 0, 0.25, 0, 6);
    buoys.push(b);
  }
  const creatures = [
    animal('rabbit'),
    animal('bear'),
    animal('otter'),
    animal('puffin'),
  ];
  [
    [-24, 4],
    [-11, -24],
    [22, -9],
    [81, -18],
  ].forEach(([x, z], i) => {
    creatures[i].position.set(x, ground(x, z), z);
    scene.add(creatures[i]);
  });
  const birds: T.Group[] = [];
  for (let i = 0; i < 12; i++) {
    const bird = new T.Group();
    for (const side of [-1, 1]) {
      const wing = box(bird, '#fff0ce', 0.75, 0.04, 0.2, side * 0.35, 0, 0);
      wing.name = side === -1 ? 'left' : 'right';
    }
    birds.push(bird);
    scene.add(bird);
  }
  const clouds: T.Group[] = [];
  for (let i = 0; i < 16; i++) {
    const cloud = new T.Group();
    for (let j = 0; j < 4; j++) {
      const puff = ball(cloud, '#f4f0d9', 2.8 + (j % 2), j * 2, 0, j % 2);
      puff.scale.y = 0.43;
    }
    cloud.position.set(
      (rand() - 0.4) * 240,
      23 + rand() * 14,
      (rand() - 0.5) * 180,
    );
    scene.add(cloud);
    clouds.push(cloud);
  }
  for (let i = 0; i < 170; i++) {
    const x = (rand() - 0.5) * 87,
      z = (rand() - 0.5) * 87;
    if (
      !isLand(x, z) ||
      nearPath(x, z) ||
      Math.hypot(x, z) > 39 ||
      colliders.some((c) => Math.hypot(x - c.x, z - c.z) < c.radius + 4) ||
      Math.hypot(x + 24, z - 4) < 5 ||
      Math.hypot(x + 13, z + 23) < 5 ||
      Math.abs(z + 18) < 2
    )
      continue;
    const s = 0.8 + rand() * 0.9;
    tree(scene, x, z, s, rand() > 0.55);
    colliders.push({ x, z, radius: 0.35 * s });
  }
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2,
      r = rand() * 13;
    const x = 80 + Math.cos(a) * r,
      z = -15 + Math.sin(a) * r;
    if (Math.hypot(x - 84, z + 23) > 5 && !nearPath(x, z))
      tree(scene, x, z, 0.65 + rand() * 0.4);
  }
  flowers(scene, 1700, 0, 0, 41);
  flowers(scene, 190, 80, -15, 17);
  const grass = new T.InstancedMesh(
      new T.ConeGeometry(0.16, 0.55, 3),
      mat('#739948'),
      1500,
    ),
    dummy = new T.Object3D();
  let gi = 0;
  for (let i = 0; i < 7000 && gi < 1500; i++) {
    const x = (rand() - 0.5) * 85,
      z = (rand() - 0.5) * 85;
    if (!isLand(x, z) || nearPath(x, z)) continue;
    dummy.position.set(x, ground(x, z) + 0.18, z);
    dummy.scale.set(1, 0.5 + rand(), 1);
    dummy.rotation.y = rand() * Math.PI;
    dummy.updateMatrix();
    grass.setMatrixAt(gi++, dummy.matrix);
  }
  grass.count = gi;
  scene.add(grass);
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2,
      r = 39 + rand() * 6,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    const rock = ball(
      scene,
      rand() > 0.5 ? '#c5be99' : '#a9b399',
      0.5 + rand() * 0.9,
      x,
      -0.1,
      z,
    );
    rock.scale.set(1.4, 0.7, 1);
  }
  // Distant scenery gives the small playable world a larger horizon.
  for (const [x, z, r] of [
    [-90, -80, 18],
    [110, -105, 26],
    [-95, 20, 12],
  ]) {
    cyl(scene, '#789c85', r, r + 4, 3, x, -0.2, z, 10);
    mesh(
      scene,
      new T.ConeGeometry(r * 0.7, r * 0.9, 7),
      '#75947a',
      x,
      r * 0.35,
      z,
    );
  }
  const marker = new T.Group();
  scene.add(marker);
  const envelope = box(marker, '#fff0ba', 1.1, 0.75, 0.12, 0, 0, 0);
  envelope.rotation.y = 0.2;
  const seal = ball(marker, '#c49143', 0.12, 0, 0, 0.1);
  seal.scale.z = 0.25;
  mesh(
    marker,
    new T.ConeGeometry(0.15, 0.3, 4),
    '#f2d784',
    0,
    -0.7,
    0,
  ).rotation.z = Math.PI;
  const ring = mesh(scene, new T.RingGeometry(1.25, 1.4, 40), '#f9db83');
  ring.rotation.x = -Math.PI / 2;
  ring.castShadow = false;
  const wildlife: T.Group[] = [];
  for (let i = 0; i < 5; i++) {
    const bunny = animal('rabbit');
    bunny.scale.setScalar(0.42);
    bunny.userData.home = [-30 + i * 3, 20];
    scene.add(bunny);
    wildlife.push(bunny);
  }
  const ducks: T.Group[] = [];
  for (let i = 0; i < 4; i++) {
    const duck = new T.Group();
    const body = ball(duck, '#eae5c8', 0.4);
    body.scale.set(0.8, 0.6, 1.2);
    ball(duck, '#49725a', 0.23, 0, 0.3, 0.38);
    box(duck, '#deb153', 0.16, 0.07, 0.25, 0, 0.25, 0.65);
    scene.add(duck);
    ducks.push(duck);
  }
  return {
    water,
    colliders,
    windmill: blades,
    bridge,
    gate,
    garden,
    seedGarden,
    picnic,
    workshop,
    boat,
    creatures,
    birds,
    clouds,
    buoys,
    beacon,
    marker,
    ring,
    wildlife,
    ducks,
  };
}
export type WorldAssets = ReturnType<typeof makeWorld>;
