import * as THREE from 'three';
import {
  rng, canvasTexture, drawTile, dirtSideTexture, waterTexture, plankTexture, roofTexture, stripeTexture, signTexture,
} from './textures.js';
import { Avatar, catSkin } from './character.js';
import { SeoulMap, T, WK, ZN, NX, NZ, HX, HZ, GU } from './seoulMap.js';
import { buildCity, buildTrees, buildBridges, ST } from './city.js';
import { buildLandmarks } from './landmarks.js';

const TILE_NAME = { 1: 'grass', 2: 'sand', 3: 'path', 4: 'soil', 5: 'plaza', 7: 'road' };

const matCache = new Map();
export function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
}
export function box(w, h, d, color, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent?.add(m);
  return m;
}

// ---------- 공용 소품 ----------
export function makeTree(r, kind = 'round', fruitColor = '#e8413a') {
  const g = new THREE.Group();
  const s = 0.9 + r() * 0.4;
  box(0.32, 1.1, 0.32, '#7a4a26', 0, 0.55, 0, g);
  const crown = new THREE.Group();
  crown.position.y = 1.0;
  g.add(crown);
  const greens = ['#4f9a35', '#5fae3e', '#3f8a2a', '#6abf48'];
  const gc = () => greens[(r() * greens.length) | 0];
  if (kind === 'pine') {
    box(1.5, 0.6, 1.5, '#2f7a44', 0, 0.3, 0, crown);
    box(1.1, 0.6, 1.1, '#3a8a50', 0, 0.85, 0, crown);
    box(0.7, 0.6, 0.7, '#46995c', 0, 1.4, 0, crown);
    box(0.3, 0.4, 0.3, '#46995c', 0, 1.85, 0, crown);
  } else {
    box(1.6, 1.0, 1.6, gc(), 0, 0.5, 0, crown);
    box(1.2, 0.6, 1.2, gc(), 0.1, 1.25, -0.05, crown);
    box(0.9, 0.6, 0.9, gc(), -0.5, 0.6, 0.45, crown);
    if (kind === 'fruit') {
      for (let i = 0; i < 6; i++) {
        const a = r() * Math.PI * 2;
        box(0.2, 0.2, 0.2, fruitColor, Math.cos(a) * 0.82, 0.2 + r() * 0.7, Math.sin(a) * 0.82, crown);
      }
    }
  }
  g.scale.setScalar(s);
  g.userData.crown = crown;
  g.userData.phase = r() * 10;
  return g;
}

export function makeChicken() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  box(0.42, 0.34, 0.5, '#fbf6ea', 0, 0.36, 0, body);
  box(0.28, 0.3, 0.26, '#fbf6ea', 0, 0.62, 0.22, body);
  box(0.08, 0.1, 0.14, '#e8413a', 0, 0.82, 0.22, body);
  box(0.1, 0.06, 0.1, '#f2a93b', 0, 0.6, 0.39, body);
  box(0.05, 0.05, 0.02, '#222', 0.1, 0.66, 0.35, body);
  box(0.05, 0.05, 0.02, '#222', -0.1, 0.66, 0.35, body);
  box(0.12, 0.18, 0.18, '#e9e0cc', 0, 0.48, -0.3, body);
  box(0.05, 0.2, 0.05, '#f2a93b', 0.1, 0.1, 0, g);
  box(0.05, 0.2, 0.05, '#f2a93b', -0.1, 0.1, 0, g);
  g.userData.body = body;
  return g;
}

export function makeSign(text) {
  const g = new THREE.Group();
  box(0.14, 1.1, 0.14, '#6b3b1c', 0, 0.55, 0, g);
  const tex = signTexture(text, { w: 112, h: 56, size: 13 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.1), [mat('#8a5428'), mat('#8a5428'), mat('#8a5428'), mat('#8a5428'), new THREE.MeshLambertMaterial({ map: tex }), mat('#8a5428')]);
  board.position.set(0, 1.15, 0.08); board.castShadow = true;
  g.add(board);
  return g;
}

export function makePigeon() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  box(0.26, 0.22, 0.4, '#8d94a3', 0, 0.22, 0, body);
  box(0.18, 0.18, 0.18, '#6f7788', 0, 0.38, 0.16, body);
  box(0.19, 0.06, 0.12, '#5aa58a', 0, 0.3, 0.12, body); // 목의 초록빛
  box(0.06, 0.04, 0.08, '#e8b0a0', 0, 0.36, 0.28, body);
  box(0.03, 0.03, 0.02, '#ff8a2e', 0.07, 0.41, 0.25, body); box(0.03, 0.03, 0.02, '#ff8a2e', -0.07, 0.41, 0.25, body);
  box(0.2, 0.06, 0.2, '#6f7788', 0, 0.26, -0.26, body);
  box(0.03, 0.12, 0.03, '#e86a6a', 0.06, 0.06, 0, g); box(0.03, 0.12, 0.03, '#e86a6a', -0.06, 0.06, 0, g);
  g.userData.body = body;
  return g;
}

const SIGN_CLEAR = 3.5;  // 표지판에서 이 거리 안의 나무는 없앰
const SPAWN_CLEAR = 10;  // 처음 들어오는 곳(광화문광장) 둘레

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#8fd0f0');
    this.scene.fog = new THREE.Fog('#8fd0f0', 48, 135);
    this.r = rng(2026);
    this.colliders = [];   // {type:'c', x,z,r} | {type:'r', x0,x1,z0,z1}
    this.cgrid = new Map(); // 충돌체 공간 해시 (4유닛 칸)
    this.walkRects = [];   // 물 위지만 걸을 수 있는 곳 (부두)
    this.interactables = [];
    this.trees = [];       // 흔들리는 개별 나무
    this.treeList = [];    // 인스턴싱 나무
    this.animals = [];
    this.pigeons = [];
    this.butterflies = [];
    this.markers = [];
    this.signSpots = [];   // 표지판 자리 (주변 나무는 시야를 가려서 뺌)
    this.map = new SeoulMap();
    this.spawn = new THREE.Vector3(1.6, 0, -1.4); // 광화문광장

    this.buildLights();
    this.buildTerrain();
    this.buildWater();
    buildBridges(this, this.map);
    buildLandmarks(this, this.map);
    this.buildRiverSpots();
    buildCity(this, this.map);
    this.scatter();
    this.buildLife();
    this.buildMinimap();
  }

  // ---------- 지형 데이터 ----------
  tileAt(x, z) { return this.map.tileAt(x, z); }
  // 지금 서 있는 곳의 구 이름
  placeName(x, z) {
    const m = this.map, [tx, tz] = m.t(x, z);
    if (!m.inb(tx, tz)) return '서울 밖';
    const k = m.i(tx, tz);
    if (m.wk[k] === WK.HAN) return '한강';
    const gi = m.gu[k];
    return gi >= 0 ? GU[gi].name : '서울';
  }

  // ---------- 충돌체 ----------
  addCollider(c) {
    this.colliders.push(c);
    const [x0, x1, z0, z1] = c.type === 'c' ? [c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r] : [c.x0, c.x1, c.z0, c.z1];
    for (let gz = Math.floor(z0 / 4); gz <= Math.floor(z1 / 4); gz++) for (let gx = Math.floor(x0 / 4); gx <= Math.floor(x1 / 4); gx++) {
      const key = gx * 1000 + gz;
      if (!this.cgrid.has(key)) this.cgrid.set(key, []);
      this.cgrid.get(key).push(c);
    }
  }

  // ---------- 조명 ----------
  buildLights() {
    this.hemi = new THREE.HemisphereLight('#d8efff', '#7a9a55', 1.25);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight('#fff0d0', 2.0);
    sun.position.set(-12, 22, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 90;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.sunOffset = sun.position.clone();
  }
  followSun(p) {
    this.sun.position.copy(p).add(this.sunOffset);
    this.sun.target.position.copy(p);
  }

  // ---------- 땅(조각별 텍스처) + 물가 옆면 ----------
  buildTerrain() {
    const S = 16, CH = 44, m = this.map;
    const r = rng(42);
    // 타일 종류별로 무늬 8가지를 미리 그려 두고 찍어 넣기 (빠름)
    const variants = {};
    for (const [id, name] of Object.entries(TILE_NAME)) {
      variants[id] = [];
      for (let v = 0; v < 8; v++) {
        const c = document.createElement('canvas'); c.width = c.height = S;
        drawTile(c.getContext('2d'), 0, 0, name, r);
        variants[id].push(c);
      }
    }
    for (let cz = 0; cz < NZ; cz += CH) for (let cx = 0; cx < NX; cx += CH) {
      const c = document.createElement('canvas');
      c.width = CH * S; c.height = CH * S;
      const ctx = c.getContext('2d');
      let any = false;
      for (let tz = cz; tz < Math.min(NZ, cz + CH); tz++) for (let tx = cx; tx < Math.min(NX, cx + CH); tx++) {
        const t = m.tile[tz * NX + tx];
        if (t === T.WATER || t === T.BRIDGE) continue; // 투명 → 물이 비침
        any = true;
        const vs = variants[t];
        ctx.drawImage(vs[(r() * vs.length) | 0], (tx - cx) * S, (tz - cz) * S);
      }
      if (!any) continue;
      const tex = canvasTexture(c);
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(CH, CH), new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(cx + CH / 2 - HX, 0, cz + CH / 2 - HZ);
      ground.receiveShadow = true;
      this.scene.add(ground);
    }

    // 물과 맞닿은 땅의 옆면 (블록 느낌)
    const pos = [], uv = [], nor = [];
    const quad = (a, b, cc, d, n) => {
      for (const [v, u] of [[a, [0, 0]], [b, [1, 0]], [cc, [1, 1]], [a, [0, 0]], [cc, [1, 1]], [d, [0, 1]]]) { pos.push(...v); uv.push(...u); nor.push(...n); }
    };
    const Y0 = -0.9, Y1 = 0;
    const isW = (tx, tz) => tx < 0 || tz < 0 || tx >= NX || tz >= NZ || m.tile[tz * NX + tx] === T.WATER || m.tile[tz * NX + tx] === T.BRIDGE;
    for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) {
      if (isW(tx, tz)) continue;
      const x0 = tx - HX, x1 = x0 + 1, z0 = tz - HZ, z1 = z0 + 1;
      if (isW(tx, tz + 1)) quad([x0, Y0, z1], [x1, Y0, z1], [x1, Y1, z1], [x0, Y1, z1], [0, 0, 1]);
      if (isW(tx, tz - 1)) quad([x1, Y0, z0], [x0, Y0, z0], [x0, Y1, z0], [x1, Y1, z0], [0, 0, -1]);
      if (isW(tx - 1, tz)) quad([x0, Y0, z0], [x0, Y0, z1], [x0, Y1, z1], [x0, Y1, z0], [-1, 0, 0]);
      if (isW(tx + 1, tz)) quad([x1, Y0, z1], [x1, Y0, z0], [x1, Y1, z0], [x1, Y1, z1], [1, 0, 0]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const sides = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: dirtSideTexture() }));
    sides.receiveShadow = true;
    this.scene.add(sides);

    const bed = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), mat('#c9ad72'));
    bed.rotation.x = -Math.PI / 2; bed.position.y = -0.9;
    this.scene.add(bed);
  }

  buildWater() {
    const tex = waterTexture();
    tex.repeat.set(400, 400);
    this.waterTex = tex;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshLambertMaterial({ map: tex, transparent: true, opacity: 0.82 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -0.22;
    water.receiveShadow = true;
    this.scene.add(water);
  }

  // 나무 심기 마무리: 표지판 주변·시작 지점 주변 나무를 빼고(충돌체도 같이) 인스턴싱해서 그림
  // 지하철역·선착장처럼 월드 생성 뒤에 세우는 것까지 다 놓은 다음 main.js에서 한 번 부름
  finishTrees() {
    const clear = [
      ...this.signSpots.map((p) => ({ x: p.x, z: p.z, r: p.r ?? SIGN_CLEAR })),
      ...this.markers.map((m) => ({ x: m.position.x, z: m.position.z, r: SIGN_CLEAR })), // 미니게임 입구
      { x: this.spawn.x, z: this.spawn.z, r: SPAWN_CLEAR },
    ];
    const gone = new Set();
    this.treeList = this.treeList.filter((t) => {
      if (!clear.some((c) => Math.hypot(t.x - c.x, t.z - c.z) < c.r)) return true;
      gone.add(`${t.x},${t.z}`); return false;
    });
    const keep = (c) => !(c.type === 'c' && gone.has(`${c.x},${c.z}`));
    this.colliders = this.colliders.filter(keep);
    for (const [k, list] of this.cgrid) this.cgrid.set(k, list.filter(keep));
    this.removedTrees = gone.size;
    buildTrees(this, this.map, this.treeList);
  }

  addMarker(x, y, z) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshLambertMaterial({ color: '#ffd23f', emissive: '#7a5a00', flatShading: true }));
    m.position.set(x, y, z); m.userData.y = y;
    this.scene.add(m); this.markers.push(m);
  }

  // 한강 위 놀거리: 낚시 부두, 한강 달리기 출발선, 다리 이름 표지판
  buildRiverSpots() {
    const m = this.map, s = this.scene;
    const firstWaterNorth = (x, zStart) => { for (let z = zStart; z > zStart - 20; z -= 0.5) if (m.wk[m.i(...m.t(x, z))] === WK.HAN && m.tile[m.i(...m.t(x, z))] === T.WATER) return Math.floor(z + HZ) + 1 - HZ; return null; };
    // 낚시 부두 (노량진수산시장 앞)
    const dx = -16.5, bank = firstWaterNorth(dx, 37);
    if (bank !== null) {
      const len = 5.5, z1 = bank, z0 = bank - len;
      const dplank = new THREE.MeshLambertMaterial({ map: plankTexture('#a86c3a', '#7a4a26', '#c98a50') });
      dplank.map.repeat.set(1, 6);
      box(1.8, 0.16, len + 0.6, dplank, dx, -0.02, (z0 + z1) / 2, s);
      for (let z = z0 + 0.3; z <= z1; z += 1.8) for (const x of [dx - 0.8, dx + 0.8]) box(0.2, 1.2, 0.2, '#6b3b1c', x, -0.4, z, s);
      this.walkRects.push({ x0: dx - 0.9, x1: dx + 0.9, z0: z0 - 0.3, z1: z1 + 0.5 });
      box(0.6, 0.5, 0.6, '#5b8fd8', dx + 0.5, 0.3, z0 + 0.4, s);
      this.addMarker(dx, 2.3, z0 + 0.6);
      this.interactables.push({ x: dx, z: z0 + 0.8, r: 1.7, label: '한강 낚시하기', kind: 'minigame', game: 'fish', ret: [dx, z0 + 1.6] });
    }
    // 한강 달리기 출발선 (여의도 한강공원 모래톱)
    const rx = -28.5;
    let gz = null;
    for (let z = 26; z > 6; z -= 0.5) { const k = m.i(...m.t(rx, z)); if (m.tile[k] === T.SAND) { gz = Math.floor(z + HZ) + 0.5 - HZ; break; } }
    if (gz !== null) {
      const gate = new THREE.Group(); gate.position.set(rx, 0, gz);
      for (const gx of [-1.9, 1.9]) { box(0.25, 2.8, 0.25, '#f4ead8', gx, 1.4, 0, gate); box(0.35, 0.3, 0.35, '#e8413a', gx, 2.85, 0, gate); }
      const banner = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.6, 0.08), new THREE.MeshLambertMaterial({ map: signTexture('한강 달리기', { w: 128, h: 26, size: 14, bg: '#ffd23f' }) }));
      banner.position.set(0, 2.45, 0); gate.add(banner);
      for (let i = 0; i < 6; i++) box(0.3, 0.02, 0.3, i % 2 ? '#222222' : '#ffffff', -1.5 + i * 0.6, 0.02, 0.4, gate);
      s.add(gate);
      this.addCollider({ type: 'c', x: rx - 1.9, z: gz, r: 0.3 }); this.addCollider({ type: 'c', x: rx + 1.9, z: gz, r: 0.3 });
      this.addMarker(rx, 3.6, gz);
      this.interactables.push({ x: rx, z: gz + 0.6, r: 1.9, label: '한강 달리기 시작', kind: 'minigame', game: 'runner', ret: [rx, gz + 1.6] });
    }
    // 오리배 선착장 (성동구 뚝섬·응봉 한강공원)
    const ox = 31.5;
    let oz = null;
    for (let z = 12; z < 22; z += 0.5) { const k = m.i(...m.t(ox, z)); if (m.tile[k] === T.SAND) { oz = Math.floor(z + HZ) + 0.5 - HZ; break; } }
    if (oz !== null) {
      const dock = new THREE.Group(); dock.position.set(ox, 0, oz);
      const dplank = new THREE.MeshLambertMaterial({ map: plankTexture('#a86c3a', '#7a4a26', '#c98a50') }); dplank.map.repeat.set(3, 1);
      box(4.2, 0.14, 1.2, dplank, 0, 0.0, 1.1, dock);
      // 물 위에 떠 있는 오리배들
      const cols = ['#ffd23f', '#f6f3ea', '#ff9ec4', '#7fc8f0'];
      cols.forEach((c, i) => {
        const b = new THREE.Group(); b.position.set(-1.6 + i * 1.05, -0.1, 2.4); b.rotation.y = Math.PI;
        box(0.7, 0.3, 1.0, c, 0, 0, 0, b); box(0.32, 0.32, 0.32, c, 0, 0.42, 0.45, b); box(0.2, 0.08, 0.16, '#f28c28', 0, 0.38, 0.66, b);
        dock.add(b); this.duckBoats = (this.duckBoats || []).concat(b);
      });
      const banner = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.08), new THREE.MeshLambertMaterial({ map: signTexture('오리배 레이스', { w: 112, h: 22, size: 13, bg: '#ffd23f' }) }));
      for (const gx of [-1.4, 1.4]) box(0.18, 2.2, 0.18, '#f4ead8', gx, 1.1, 0.4, dock);
      banner.position.set(0, 2.0, 0.4); dock.add(banner);
      s.add(dock);
      this.walkRects.push({ x0: ox - 2.1, x1: ox + 2.1, z0: oz + 0.4, z1: oz + 1.7 });
      this.addCollider({ type: 'c', x: ox - 1.4, z: oz + 0.4, r: 0.25 }); this.addCollider({ type: 'c', x: ox + 1.4, z: oz + 0.4, r: 0.25 });
      this.addMarker(ox, 3.0, oz + 0.9);
      this.interactables.push({ x: ox, z: oz + 1.0, r: 1.9, label: '오리배 레이스 (최대 6척)', kind: 'minigame', game: 'duckboat', ret: [ox, oz] });
    }
    // 다리 이름표 (북단)
    for (const b of m.bridgeInfo) {
      const sg = makeSign(b.name);
      const x = b.x0 - 0.6, z = b.z0 - 1.2;
      if (m.tileAt(x, z) === T.WATER) continue;
      sg.position.set(x, 0, z); s.add(sg);
      this.addCollider({ type: 'c', x, z, r: 0.35 });
      this.signSpots.push({ x, z });
    }
  }

  // ---------- 가로등: 넓은 길가에 띄엄띄엄, 밤에 불이 켜짐 ----------
  buildLamps(wideAt) {
    const m = this.map, occ = this.occ, spots = [];
    const taken = new Set();
    const cellKey = (x, z) => `${Math.floor(x / 5)},${Math.floor(z / 5)}`; // 5칸 격자에 하나씩
    for (let tz = 1; tz < NZ - 1; tz++) for (let tx = 1; tx < NX - 1; tx++) {
      const k = m.i(tx, tz), t = m.tile[k];
      if (occ[k] || (t !== T.GRASS && t !== T.PLAZA) || m.zone[k] === ZN.LANDMARK || m.zone[k] === ZN.FOREST) continue;
      // 바로 옆이 넓은 길이어야 함 → 그 길 쪽으로 등을 내밂
      let dir = null;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (wideAt(tx + dx, tz + dz)) { dir = [dx, dz]; break; }
      if (!dir) continue;
      const ck = cellKey(tx, tz);
      if (taken.has(ck) || (tx * 7 + tz * 13) % 5) continue;
      taken.add(ck);
      const x = tx + 0.5 - HX - dir[0] * 0.3, z = tz + 0.5 - HZ - dir[1] * 0.3;
      spots.push({ x, z, ry: Math.atan2(dir[0], dir[1]) });
      this.addCollider({ type: 'c', x, z, r: 0.14 });
    }
    const n = spots.length;
    const pole = new THREE.BoxGeometry(0.1, 2.0, 0.1); pole.translate(0, 1.0, 0);
    const arm = new THREE.BoxGeometry(0.07, 0.07, 0.5); arm.translate(0, 1.96, 0.22);
    const head = new THREE.BoxGeometry(0.26, 0.12, 0.3); head.translate(0, 1.9, 0.42);
    const halo = new THREE.BoxGeometry(0.7, 0.45, 0.75); halo.translate(0, 1.86, 0.42);
    const pool = new THREE.CircleGeometry(1.7, 10); pool.rotateX(-Math.PI / 2); pool.translate(0, 0.035, 0.75);
    const metal = new THREE.MeshLambertMaterial({ color: '#4a5058' });
    this.lampHead = new THREE.MeshBasicMaterial({ color: '#cfd2d6' });
    this.lampHalo = new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.lampPool = new THREE.MeshBasicMaterial({ color: '#ffc46a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const dummy = new THREE.Object3D();
    const meshes = [[pole, metal, true], [arm, metal, true], [head, this.lampHead, false], [halo, this.lampHalo, false], [pool, this.lampPool, false]].map(([g, mt, sh]) => {
      const im = new THREE.InstancedMesh(g, mt, n);
      spots.forEach((p, i) => { dummy.position.set(p.x, 0, p.z); dummy.rotation.set(0, p.ry, 0); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
      im.castShadow = sh; im.frustumCulled = false;
      this.scene.add(im); return im;
    });
    this.lampMeshes = meshes;
    this.lampCount = n;
  }
  // 밤 정도(0~1)에 맞춰 가로등 켜기
  setLamps(night) {
    if (!this.lampHead) return;
    const on = THREE.MathUtils.smoothstep(night, 0.3, 0.7);
    this.lampHead.color.set('#cfd2d6').lerp(new THREE.Color('#fff1b8'), on);
    this.lampHalo.opacity = on * 0.35;
    this.lampPool.opacity = on * 0.4;
    this.lampMeshes[3].visible = this.lampMeshes[4].visible = on > 0.01;
  }

  // ---------- 나무/풀 흩뿌리기 ----------
  scatter() {
    const r = this.r, m = this.map, s = this.scene, occ = this.occ;
    const near = (tx, tz, type) => {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = tx + dx, z = tz + dz; if (m.inb(x, z) && m.tile[m.i(x, z)] === type) return true; }
      return false;
    };
    const blocked = (x, z, rad) => {
      const cell = this.cgrid.get(Math.floor(x / 4) * 1000 + Math.floor(z / 4)) || [];
      return cell.some((c) => (c.type === 'c' ? Math.hypot(x - c.x, z - c.z) < c.r + rad : x > c.x0 - rad && x < c.x1 + rad && z > c.z0 - rad && z < c.z1 + rad));
    };
    const plant = (x, z, kind, sc) => {
      if (blocked(x, z, 0.5)) return;
      this.treeList.push({ x, z, kind, s: sc, ry: r() * 3 });
      this.addCollider({ type: 'c', x, z, r: 0.42 * sc });
    };
    // 나무 배치 규칙 (숲 지역 제외):
    //  - 건물 바로 옆 칸엔 심지 않음 (걸어다니기 편하게)
    //  - 넓은 길(아스팔트 큰길, 폭 2 이상의 흙길) 가에는 가로수를 줄지어
    //  - 좁은 골목·빈 풀밭은 아주 가끔, 그것도 건물이 적은 동네에서만
    const sat = new Uint32Array((NX + 1) * (NZ + 1)); // 건물 칸 누적합 표
    for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) {
      sat[(tz + 1) * (NX + 1) + tx + 1] = occ[tz * NX + tx] + sat[tz * (NX + 1) + tx + 1] + sat[(tz + 1) * (NX + 1) + tx] - sat[tz * (NX + 1) + tx];
    }
    const boxSum = (tx, tz, R) => {
      const x0 = Math.max(0, tx - R), x1 = Math.min(NX, tx + R + 1), z0 = Math.max(0, tz - R), z1 = Math.min(NZ, tz + R + 1);
      return [sat[z1 * (NX + 1) + x1] - sat[z0 * (NX + 1) + x1] - sat[z1 * (NX + 1) + x0] + sat[z0 * (NX + 1) + x0], (x1 - x0) * (z1 - z0)];
    };
    const isWay = (t) => t === T.ROAD || t === T.PATH;
    // 넓은 길: 주변 3×3에 길 칸이 5개 이상
    const wideAt = (x, z) => {
      if (!m.inb(x, z) || !isWay(m.tile[m.i(x, z)])) return false;
      if (m.tile[m.i(x, z)] === T.ROAD) return true;
      let c = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (m.inb(x + dx, z + dz) && isWay(m.tile[m.i(x + dx, z + dz)])) c++;
      return c >= 5;
    };
    const nearWide = (tx, tz) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => wideAt(tx + dx, tz + dz));
    this.buildLamps(wideAt); // 가로등을 먼저 세우고 나무는 그 자리를 피함
    for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) {
      const k = m.i(tx, tz);
      if (m.tile[k] !== T.GRASS || occ[k]) continue;
      const zone = m.zone[k];
      if (zone === ZN.LANDMARK || zone === ZN.PARK) continue;
      const x = tx + 0.5 - HX + (r() - 0.5) * 0.5, z = tz + 0.5 - HZ + (r() - 0.5) * 0.5;
      if (zone === ZN.FOREST) {
        if (r() < 0.5) { const v = r(); plant(x, z, v < 0.5 ? 'pine' : v < 0.88 ? 'round' : 'maple', 0.85 + r() * 0.35); }
        continue;
      }
      const touchB = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => m.inb(tx + dx, tz + dz) && occ[m.i(tx + dx, tz + dz)]);
      if (touchB) continue; // 건물 바로 옆
      if (nearWide(tx, tz)) {
        // 가로수: 길을 따라 3칸마다
        if ((tx + tz) % 3 === 0 && r() < 0.8) plant(x, z, m.organic(k) && r() < 0.35 ? 'round' : 'ginkgo', 0.75 + r() * 0.15);
        continue;
      }
      if (boxSum(tx, tz, 1)[0] > 0) continue; // 대각선 옆도 건물이면 빈 풀밭 나무는 안 심음
      const [bc, area] = boxSum(tx, tz, 3), crowd = bc / area;
      if (crowd < 0.08 && r() < (near(tx, tz, T.PATH) ? 0.03 : 0.04)) {
        const v = r(); plant(x, z, v < 0.6 ? 'round' : v < 0.8 ? 'pine' : v < 0.92 ? 'maple' : 'ginkgo', 0.85 + r() * 0.35);
      }
    }
    // 풀포기 & 꽃 (인스턴싱)
    const dummy = new THREE.Object3D();
    const GMAX = 9000, FMAX = 1600;
    const grass = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), new THREE.MeshLambertMaterial(), GMAX);
    const flowers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshLambertMaterial(), FMAX);
    const gc = ['#5a9a3c', '#68a845', '#86c75c'].map((c) => new THREE.Color(c));
    const fc = ['#fff3a6', '#ff9fb4', '#ffffff', '#9b5de5', '#ff8a5c'].map((c) => new THREE.Color(c));
    let gi = 0, fi = 0;
    for (let i = 0; i < 60000 && (gi < GMAX || fi < FMAX); i++) {
      const x = (r() - 0.5) * NX, z = (r() - 0.5) * NZ;
      const [tx, tz] = m.t(x, z);
      if (!m.inb(tx, tz)) continue;
      const k = m.i(tx, tz);
      if (m.tile[k] !== T.GRASS || occ[k] || m.zone[k] === ZN.LANDMARK) continue;
      if (r() < 0.84 && gi < GMAX) {
        for (let j = 0; j < 3 && gi < GMAX; j++) {
          dummy.position.set(x + (r() - 0.5) * 0.25, 0.12, z + (r() - 0.5) * 0.25);
          dummy.rotation.set((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4);
          dummy.scale.set(1, 0.6 + r() * 0.8, 1);
          dummy.updateMatrix();
          grass.setMatrixAt(gi, dummy.matrix); grass.setColorAt(gi, gc[(r() * 3) | 0]); gi++;
        }
      } else if (fi < FMAX) {
        dummy.position.set(x, 0.22, z); dummy.rotation.set(0, r() * 3, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
        flowers.setMatrixAt(fi, dummy.matrix); flowers.setColorAt(fi, fc[(r() * fc.length) | 0]); fi++;
      }
    }
    grass.count = gi; flowers.count = fi;
    grass.receiveShadow = true; flowers.castShadow = true;
    s.add(grass, flowers);
  }

  // ---------- 동물 / NPC / 나비 ----------
  buildLife() {
    const r = this.r;
    const coop = this.coop || { x: 0, z: 0 };
    for (let i = 0; i < 5; i++) {
      const c = makeChicken();
      c.position.set(coop.x - 2 + r() * 4, 0, coop.z + 0.5 + r() * 1.5);
      c.userData.target = c.position.clone();
      c.userData.home = c.position.clone();
      c.userData.wait = r() * 2;
      this.scene.add(c); this.animals.push(c);
    }
    // 비둘기: 광화문광장 · 서울광장 · 강남역 · 여의도
    for (const [hx, hz, n] of [[-0.6, -3.2, 6], [1.2, 9, 4], [32.4, 51.4, 4], [-30, 26, 4]]) {
      for (let i = 0; i < n; i++) {
        const p = makePigeon();
        p.position.set(hx + (r() - 0.5) * 2, 0, hz + (r() - 0.5) * 2);
        if (!this.canWalk(p.position.x, p.position.z, 0.2)) continue;
        p.userData = { ...p.userData, target: p.position.clone(), home: new THREE.Vector3(hx, 0, hz), wait: r() * 2, fly: 0 };
        this.scene.add(p); this.pigeons.push(p);
      }
    }
    // 고양이 시장님 (광화문광장)
    const catAv = new Avatar(catSkin(), { height: 1.35 });
    const cs = catAv.s;
    for (const ex of [-3, 3]) { // 귀
      const ear = box(3 * cs, 3 * cs, 2 * cs, '#f0a040', ex * cs, 11.2 * cs, 0, catAv.joints.head);
      box(1.4 * cs, 1.6 * cs, 0.3 * cs, '#ffb3c6', 0, -0.4 * cs, 1.05 * cs, ear);
    }
    const tail = new THREE.Group(); tail.position.set(0, 1.5 * cs, -2.5 * cs); catAv.joints.body.add(tail);
    box(1.6 * cs, 1.6 * cs, 7 * cs, '#f0a040', 0, 2 * cs, -3 * cs, tail).rotation.x = -0.7;
    this.catTail = tail;
    const cat = catAv.root;
    cat.userData.avatar = catAv;
    cat.position.set(-1.1, 0, -3.4);
    cat.userData.home = cat.position.clone();
    cat.userData.target = cat.position.clone();
    cat.userData.wait = 1;
    cat.userData.npc = true;
    this.scene.add(cat);
    this.cat = cat;
    this.catInteract = {
      x: cat.position.x, z: cat.position.z, r: 1.6, label: '말 걸기', kind: 'dialog', name: '냥시장',
      lines: [
        '어서 오라냥! 나는 서울의 시장, 냥시장이다냥.\n여기는 서울 한가운데, 광화문광장이다냥.',
        '서울은 한강을 사이에 두고 강북과 강남으로 나뉜다냥.\n강북은 꼬불꼬불 옛길, 강남은 바둑판처럼 반듯한 길이다냥.',
        '25개 구마다 랜드마크가 있다냥!\n경복궁, 남산타워, 롯데월드타워, 올림픽공원… 다 찾아보라냥.',
        '노란 마름모가 떠 있는 곳에선 놀이를 할 수 있다냥.\n경동시장 · 노들섬 · 한강 부두 · 여의도 · 암사동을 찾아가 보라냥!',
        'M을 누르면 서울 지도를 크게 볼 수 있다냥~',
      ],
    };
    this.interactables.push(this.catInteract);
    // 나비 (공원 위주)
    const wingMat = ['#fff3a6', '#ffb3c6', '#ffffff'].map((c) => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }));
    const spots = [[2, -12], [8, 12], [36, 11], [63.5, 8.5], [88, 31], [42, -93], [0, 0], [-20, -60], [75, 42], [-10.5, 33.5]];
    for (let i = 0; i < 24; i++) {
      const b = new THREE.Group();
      const m = wingMat[i % 3];
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), m); l.position.x = -0.08;
      const rr = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), m); rr.position.x = 0.08;
      const lw = new THREE.Group(); lw.add(l); const rw = new THREE.Group(); rw.add(rr);
      b.add(lw, rw);
      const [sx, sz] = spots[i % spots.length];
      b.userData = { lw, rw, phase: r() * 10, cx: sx + (r() - 0.5) * 6, cz: sz + (r() - 0.5) * 6, rad: 1.5 + r() * 2.5 };
      this.scene.add(b); this.butterflies.push(b);
    }
  }

  // 미니맵용 이미지 (1px = 1타일)
  buildMinimap() {
    const m = this.map, c = document.createElement('canvas');
    c.width = NX; c.height = NZ;
    const ctx = c.getContext('2d'), img = ctx.createImageData(NX, NZ);
    const col = { [T.GRASS]: [116, 184, 79], [T.SAND]: [236, 216, 156], [T.PATH]: [201, 162, 107], [T.SOIL]: [143, 93, 55], [T.PLAZA]: [196, 188, 172], [T.BRIDGE]: [150, 146, 140], [T.ROAD]: [150, 146, 140] };
    for (let k = 0; k < NX * NZ; k++) {
      const t = m.tile[k];
      let cc = t === T.WATER ? (m.wk[k] === WK.OUT ? [62, 132, 196] : [92, 178, 232]) : col[t];
      if (t === T.GRASS && m.zone[k] === ZN.FOREST) cc = [72, 140, 62];
      if (this.occ[k]) cc = [228, 222, 210];
      img.data.set([...cc, 255], k * 4);
    }
    ctx.putImageData(img, 0, 0);
    this.minimap = c;
  }

  // ---------- 충돌 ----------
  canWalk(x, z, rad = 0.3) {
    for (const w of this.walkRects) if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) return true;
    for (const [dx, dz] of [[rad, 0], [-rad, 0], [0, rad], [0, -rad]]) if (this.tileAt(x + dx, z + dz) === T.WATER) return false;
    const seen = new Set();
    for (const [qx, qz] of [[x - rad, z - rad], [x + rad, z - rad], [x - rad, z + rad], [x + rad, z + rad]]) {
      const key = Math.floor(qx / 4) * 1000 + Math.floor(qz / 4);
      if (seen.has(key)) continue;
      seen.add(key);
      const cell = this.cgrid.get(key);
      if (!cell) continue;
      for (const c of cell) {
        if (c.type === 'c') { if (Math.hypot(x - c.x, z - c.z) < c.r + rad) return false; }
        else if (x > c.x0 - rad && x < c.x1 + rad && z > c.z0 - rad && z < c.z1 + rad) return false;
      }
    }
    return true;
  }

  update(dt, t, playerPos, camera) {
    this.waterTex.offset.x = (t * 0.02) % 1;
    this.waterTex.offset.y = Math.floor(t * 2) * 0.004 % 1;
    // 캐릭터를 가리는 건물은 도트 무늬로 뚫어 보이게
    if (playerPos && camera) {
      ST.stOn.value = 1;
      ST.stP.value.set(playerPos.x, playerPos.y + 0.9, playerPos.z);
      ST.stC.value.copy(camera.position);
    } else ST.stOn.value = 0;
    for (const tr of this.trees) tr.userData.crown.rotation.z = Math.sin(t * 1.3 + tr.userData.phase) * 0.025;
    for (const m of this.markers) { m.position.y = m.userData.y + Math.sin(t * 3) * 0.15; m.rotation.y = t * 2; }
    // 닭
    for (const a of this.animals) {
      const ud = a.userData;
      const d = a.position.distanceTo(ud.target);
      if (d < 0.1) {
        ud.wait -= dt;
        ud.body.rotation.x = Math.max(0, Math.sin(t * 6 + a.id)) * 0.4; // 모이 쪼기
        if (ud.wait < 0) {
          ud.wait = 1 + Math.random() * 3;
          const nx = a.position.x + (Math.random() - 0.5) * 5, nz = a.position.z + (Math.random() - 0.5) * 5;
          if (this.canWalk(nx, nz, 0.3) && Math.hypot(nx - ud.home.x, nz - ud.home.z) < 5) ud.target.set(nx, 0, nz);
        }
      } else {
        ud.body.rotation.x = 0;
        const dir = ud.target.clone().sub(a.position).normalize();
        a.position.addScaledVector(dir, Math.min(d, dt * 1.6));
        a.rotation.y = Math.atan2(dir.x, dir.z);
        a.position.y = Math.abs(Math.sin(t * 16)) * 0.06;
      }
      if (playerPos && a.position.distanceTo(playerPos) < 1.4) { // 플레이어 피해 도망
        const away = a.position.clone().sub(playerPos).setY(0).normalize().multiplyScalar(2.5).add(a.position);
        if (this.canWalk(away.x, away.z, 0.3)) ud.target.copy(away);
      }
    }
    // 비둘기: 가까이 가면 푸드덕 날아올랐다가 다른 곳에 내려앉음
    for (const p of this.pigeons) {
      const ud = p.userData;
      if (ud.fly > 0) {
        ud.fly -= dt;
        const dir = ud.target.clone().sub(p.position).setY(0);
        const d = dir.length();
        if (d > 0.05) { p.position.addScaledVector(dir.normalize(), Math.min(d, dt * 4)); p.rotation.y = Math.atan2(dir.x, dir.z); }
        p.position.y = Math.max(0, Math.sin(Math.min(1, 1 - ud.fly / 1.4) * Math.PI) * 1.6);
        ud.body.rotation.z = Math.sin(t * 40) * 0.3;
        if (ud.fly <= 0) { p.position.y = 0; ud.body.rotation.z = 0; }
        continue;
      }
      ud.wait -= dt;
      ud.body.rotation.x = Math.max(0, Math.sin(t * 7 + p.id)) * 0.5;
      if (ud.wait < 0) {
        ud.wait = 0.6 + Math.random() * 2;
        const nx = p.position.x + (Math.random() - 0.5) * 1.2, nz = p.position.z + (Math.random() - 0.5) * 1.2;
        if (this.canWalk(nx, nz, 0.2) && Math.hypot(nx - ud.home.x, nz - ud.home.z) < 2.5) { p.position.set(nx, 0, nz); p.rotation.y = Math.random() * 6; }
      }
      if (playerPos && p.position.distanceTo(playerPos) < 1.6) {
        for (let k = 0; k < 6; k++) {
          const nx = ud.home.x + (Math.random() - 0.5) * 4, nz = ud.home.z + (Math.random() - 0.5) * 4;
          if (this.canWalk(nx, nz, 0.2) && Math.hypot(nx - playerPos.x, nz - playerPos.z) > 2.5) { ud.target.set(nx, 0, nz); ud.fly = 1.4; break; }
        }
      }
    }
    // 고양이 시장: 광장을 느긋하게 산책, 플레이어가 오면 멈춤
    const cat = this.cat, cu = cat.userData;
    const near = playerPos && cat.position.distanceTo(playerPos) < 2.2;
    const cd = cat.position.distanceTo(cu.target);
    let catMoving = false, yaw;
    if (near) {
      yaw = Math.atan2(playerPos.x - cat.position.x, playerPos.z - cat.position.z);
    } else if (cd < 0.1) {
      cu.wait -= dt;
      if (cu.wait < 0) {
        cu.wait = 2 + Math.random() * 3;
        const nx = cu.home.x + (Math.random() - 0.5) * 1.4, nz = cu.home.z + (Math.random() - 0.5) * 4;
        if (this.canWalk(nx, nz, 0.4)) cu.target.set(nx, 0, nz);
      }
    } else {
      const dir = cu.target.clone().sub(cat.position).normalize();
      cat.position.addScaledVector(dir, Math.min(cd, dt * 1.2));
      catMoving = true; yaw = Math.atan2(dir.x, dir.z);
    }
    cu.avatar.animate(dt, t, { moving: catMoving, yaw, wave: near && Math.sin(t * 0.8) > 0.4 });
    this.catTail.rotation.y = Math.sin(t * 3) * 0.5;
    this.catInteract.x = cat.position.x; this.catInteract.z = cat.position.z + 0.4;
    // 나비
    for (const b of this.butterflies) {
      const u = b.userData, ph = t * 0.5 + u.phase;
      b.position.set(u.cx + Math.cos(ph) * u.rad, 1.2 + Math.sin(ph * 3) * 0.4, u.cz + Math.sin(ph * 1.3) * u.rad);
      b.rotation.y = -ph;
      const f = Math.sin(t * 22 + u.phase) * 1.1;
      u.lw.rotation.y = f; u.rw.rotation.y = -f;
    }
    // 서울 하늘을 도는 비행기
    if (this.flyPlane) {
      const a = t * 0.045, R = 70;
      this.flyPlane.position.set(Math.cos(a) * R * 1.3, 24 + Math.sin(t * 0.3) * 1.5, Math.sin(a) * R);
      const ax = -Math.sin(a) * R * 1.3, az = Math.cos(a) * R;
      this.flyPlane.rotation.set(0, Math.atan2(ax, az), 0);
      this.flyPlane.rotateZ(-0.25);
    }
    // 강남역 전광판
    const sc = this.screen;
    if (sc && (sc.t += dt) > 0.25) {
      sc.t = 0;
      const ctx = sc.ctx, ph = Math.floor(t * 4);
      const pals = [['#ff4f8b', '#ffd23f', '#3fd0ff'], ['#7cff6b', '#3f7bff', '#ffffff'], ['#ffd23f', '#ff6b3f', '#9b5de5']];
      const p = pals[Math.floor(t / 3) % 3];
      ctx.fillStyle = '#10131a'; ctx.fillRect(0, 0, 32, 20);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = p[(i + ph) % 3]; ctx.fillRect(((i * 7 + ph * 3) % 36) - 4, 3 + (i % 3) * 5, 6, 3); }
      ctx.fillStyle = '#ffffff'; ctx.fillRect(2 + (ph % 28), 16, 3, 2);
      sc.tex.needsUpdate = true;
    }
  }
}
