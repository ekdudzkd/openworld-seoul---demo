// 서울 도시 생성: 건물(합친 지오메트리), 가로수/숲(인스턴싱), 한강 다리, 시야 투과 셰이더
import * as THREE from 'three';
import { T, ZN, WK, NX, NZ, HX, HZ, GU, STYLE_RECTS } from './seoulMap.js';
import { wallTexture, giwaTexture, plankTexture } from './textures.js';

// ---------- 카메라와 캐릭터 사이 건물을 도트 무늬로 뚫어 보이게 ----------
export const ST = { stP: { value: new THREE.Vector3() }, stC: { value: new THREE.Vector3() }, stOn: { value: 0 }, night: { value: 0 } };
export function seeThrough(m) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, ST);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 stw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          stw = instanceMatrix * stw;
        #endif
        vStW = (modelMatrix * stw).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 stP; uniform vec3 stC; uniform float stOn; uniform float night; varying vec3 vStW;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\nvec3 stTex = sampledDiffuseColor.rgb;\n#endif')
      // 밤이 되면 유리창(푸른 텍스처 픽셀) 중 일부에 불이 켜짐
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_MAP
        if (night > 0.01 && stTex.b - stTex.r > 0.2 && stTex.b > 0.3 && vStW.y > 0.3) {
          vec3 cell = floor(vec3(vStW.x * 1.5, vStW.y * 2.0, vStW.z * 1.5));
          float hh = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          if (hh < 0.42) totalEmissiveRadiance += vec3(1.0, 0.72, 0.36) * night * (0.35 + 0.6 * hh);
        }
        #endif`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (stOn > 0.5 && vStW.y > 0.25) {
          vec3 dd = stP - stC; float L = length(dd); vec3 n = dd / L;
          vec3 w = vStW - stC; float t = dot(w, n);
          if (t > 0.0 && t < L - 0.9) {
            float rr = length(w - n * t);
            vec2 g = floor(gl_FragCoord.xy);
            if (rr < 1.7 || (rr < 2.6 && mod(g.x + g.y, 2.0) < 1.0)) discard;
          }
        }`);
  };
  m.customProgramCacheKey = () => 'seethru';
  return m;
}
const lmatCache = new Map();
// 랜드마크·건물용 재질 (투과 셰이더 적용)
export function lmat(color, extra) {
  const key = color + (extra ? JSON.stringify(Object.keys(extra)) : '');
  if (!extra && lmatCache.has(key)) return lmatCache.get(key);
  const m = seeThrough(new THREE.MeshLambertMaterial({ color, ...extra }));
  if (!extra) lmatCache.set(key, m);
  return m;
}

// ---------- 지오메트리 합치기 (정점색) ----------
const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Matrix3();
const geoCache = {};
export class Merger {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; }
  add(geom, color, matrix) {
    const g = geom.index ? geom.toNonIndexed() : geom;
    const p = g.attributes.position, nm = g.attributes.normal, u = g.attributes.uv;
    _c.set(color);
    _n.getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i).applyMatrix4(matrix); this.pos.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(nm, i).applyMatrix3(_n).normalize(); this.nor.push(_v.x, _v.y, _v.z);
      if (u) this.uv.push(u.getX(i), u.getY(i)); else this.uv.push(0, 0);
      this.col.push(_c.r, _c.g, _c.b);
    }
    return this;
  }
  // w,h,d 상자: (x,y,z)는 중심, ry/rx/rz 회전
  box(w, h, d, color, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    geoCache.box ||= new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
    _e.set(rx, ry, rz); _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _s.set(w, h, d));
    return this.add(geoCache.box, color, _m);
  }
  cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 8, sx = 1, sz = 1) {
    const key = `c${rt}_${rb}_${seg}`;
    geoCache[key] ||= new THREE.CylinderGeometry(rt, rb, 1, seg).toNonIndexed();
    _m.compose(_v.set(x, y, z), _q.identity(), _s.set(sx, h, sz));
    return this.add(geoCache[key], color, _m);
  }
  geom(g, color, x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
    _e.set(rx, ry, rz); _q.setFromEuler(_e);
    _m.compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
    return this.add(g, color, _m);
  }
  // 한옥 지붕: 사다리꼴 단면을 길게 뽑고, 처마 끝을 살짝 들어 올림
  hanokRoof(w, d, h, color, x, y, z, ry = 0) {
    const key = 'hroof';
    if (!geoCache[key]) {
      const s = new THREE.Shape();
      s.moveTo(-0.5, 0); s.lineTo(-0.56, 0.08); s.lineTo(-0.2, 0.75); s.lineTo(0.2, 0.75); s.lineTo(0.56, 0.08); s.lineTo(0.5, 0);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
      g.translate(0, 0, -0.5);
      geoCache[key] = g.toNonIndexed();
    }
    this.geom(geoCache[key], color, x, y, z, ry + Math.PI / 2, d, h, w); // 단면(x)=깊이 d, 용마루(z→x)=길이 w
    // 처마 끝 들림
    const c = Math.cos(ry), sn = Math.sin(ry);
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      const lx = s1 * (w / 2), lz = s2 * (d * 0.55);
      this.box(0.18, 0.12, 0.18, color, x + lx * c + lz * sn, y + 0.12, z - lx * sn + lz * c, ry);
    }
    return this;
  }
  build(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material || lmat('#ffffff', { vertexColors: true }));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  get empty() { return this.pos.length === 0; }
}
export function vcMat() { return seeThrough(new THREE.MeshLambertMaterial({ vertexColors: true })); }

// ---------- 벽면 UV를 실제 크기(유닛)로 매기는 상자 (창문 무늬가 늘어나지 않게) ----------
class WallBatch {
  constructor(tex) { this.tex = tex; this.pos = []; this.nor = []; this.uv = []; this.col = []; }
  quad(a, b, c, d, n, uw, vh, v0, col) {
    for (const [p, uu, vv] of [[a, 0, v0], [b, uw, v0], [c, uw, v0 + vh], [a, 0, v0], [c, uw, v0 + vh], [d, 0, v0 + vh]]) {
      this.pos.push(...p); this.nor.push(...n); this.uv.push(uu, vv); this.col.push(col.r, col.g, col.b);
    }
  }
  walls(x0, x1, z0, z1, y0, y1, color) {
    const col = new THREE.Color(color), w = x1 - x0, d = z1 - z0, h = y1 - y0;
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], w, h, y0, col);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], w, h, y0, col);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], d, h, y0, col);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], d, h, y0, col);
  }
  build() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, seeThrough(new THREE.MeshLambertMaterial({ map: this.tex, vertexColors: true })));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}

// ---------- 구별 건물 성격 ----------
const STYLE = {
  종로구: { villa: 4, hanok: 3, office: 2, apt: 1, d: 0.50 }, 중구: { office: 5, villa: 3, apt: 1, d: 0.56 },
  용산구: { villa: 4, apt: 3, office: 2, d: 0.48 }, 성동구: { villa: 4, apt: 4, office: 1, d: 0.50 },
  광진구: { villa: 5, apt: 3, d: 0.48 }, 동대문구: { villa: 6, apt: 2, d: 0.50 }, 중랑구: { villa: 5, apt: 3, d: 0.46 },
  성북구: { villa: 5, apt: 2, hanok: 1, d: 0.44 }, 강북구: { villa: 6, apt: 2, d: 0.42 }, 도봉구: { apt: 5, villa: 3, d: 0.44 },
  노원구: { apt: 7, villa: 2, d: 0.48 }, 은평구: { villa: 5, apt: 3, hanok: 1, d: 0.44 }, 서대문구: { villa: 6, apt: 2, d: 0.45 },
  마포구: { villa: 5, apt: 3, office: 1, d: 0.50 },
  강서구: { apt: 5, villa: 4, office: 1, d: 0.50 }, 양천구: { apt: 7, villa: 2, d: 0.56 }, 구로구: { villa: 4, apt: 3, office: 3, d: 0.54 },
  금천구: { office: 4, villa: 5, d: 0.54 }, 영등포구: { office: 4, apt: 3, villa: 3, d: 0.58 }, 동작구: { villa: 5, apt: 4, d: 0.53 },
  관악구: { villa: 8, apt: 2, d: 0.54 }, 서초구: { apt: 5, office: 3, villa: 1, d: 0.58 }, 강남구: { office: 5, apt: 4, villa: 1, d: 0.62 },
  송파구: { apt: 6, office: 2, villa: 2, d: 0.59 }, 강동구: { apt: 6, villa: 3, d: 0.54 },
};
function pickStyle(r, gname, x, z) {
  for (const s of STYLE_RECTS) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return s.style;
  const w = STYLE[gname] || { villa: 1 };
  let tot = 0; for (const k in w) if (k !== 'd') tot += w[k];
  let v = r() * tot;
  for (const k in w) { if (k === 'd') continue; v -= w[k]; if (v <= 0) return k; }
  return 'villa';
}

// 지름길: 바둑판 도로가 없는 동네는 SHORTCUT칸마다 가로·세로 한 줄씩 건물을 비워 둠
// → 건물 덩어리가 길어야 SHORTCUT-1칸이라, 길이 없어도 건물 사이로 바로 질러갈 수 있음 (바둑판 지역은 원래 골목이 촘촘함)
const SHORTCUT = 5;
export function buildCity(world, map) {
  const r = world.r, s = world.scene;
  const occ = new Uint8Array(NX * NZ);
  // 랜드마크 바로 옆 한 칸은 비워 둠
  const nearLM = new Uint8Array(NX * NZ);
  for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) {
    if (map.zone[tz * NX + tx] !== ZN.LANDMARK) continue;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const x = tx + dx, z = tz + dz; if (x >= 0 && z >= 0 && x < NX && z < NZ) nearLM[z * NX + x] = 1; }
  }
  const free = (tx, tz) => {
    if (tx < 0 || tz < 0 || tx >= NX || tz >= NZ) return false;
    const k = tz * NX + tx;
    if (!map.grid(k) && (tx % SHORTCUT === 0 || tz % SHORTCUT === 0)) return false; // 지름길 칸
    return !occ[k] && !nearLM[k] && map.tile[k] === T.GRASS && map.zone[k] === ZN.NONE;
  };
  const roadNear = (tx, tz, w, d) => {
    for (let z = tz - 1; z <= tz + d; z++) for (let x = tx - 1; x <= tx + w; x++) {
      if (x < 0 || z < 0 || x >= NX || z >= NZ) continue;
      const t = map.tile[z * NX + x];
      if (t === T.ROAD || t === T.PATH || t === T.PLAZA) return true;
    }
    return false;
  };
  const W = {
    brick: new WallBatch(wallTexture('brick')), tan: new WallBatch(wallTexture('tan')), stucco: new WallBatch(wallTexture('stucco')),
    apt: new WallBatch(wallTexture('apt')), glass: new WallBatch(wallTexture('glass')), glass2: new WallBatch(wallTexture('glass2')),
    glass3: new WallBatch(wallTexture('glass3')), hanok: new WallBatch(wallTexture('hanok')),
  };
  const roofs = new Merger();
  const giwa = new Merger();
  const tints = ['#ffffff', '#f6f0e8', '#eef2f6', '#fff6ea'];
  world.buildings = [];

  const order = [];
  for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) order.push(tz * NX + tx);
  for (let i = order.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }

  for (const k of order) {
    const tx = k % NX, tz = (k / NX) | 0;
    if (!free(tx, tz)) continue;
    const gi = map.gu[k];
    if (gi < 0) continue;
    const g = GU[gi];
    const x = tx - HX, z = tz - HZ;
    const st = STYLE[g.name] || { d: 0.48 };
    if (r() > st.d) continue;
    const style = pickStyle(r, g.name, x, z);
    let w = 1, d = 1;
    if (style === 'apt') { if (r() < 0.5) { w = 3 + ((r() * 2) | 0); d = 1; } else { w = 1; d = 3 + ((r() * 2) | 0); } }
    else if (style === 'office') { w = d = r() < 0.6 ? 2 : 1; }
    else if (style === 'hanok') { w = r() < 0.5 ? 2 : 1; d = 1; }
    else if (r() < 0.25) { if (r() < 0.5) w = 2; else d = 2; }
    let ok = true;
    for (let a = 0; a < d && ok; a++) for (let b = 0; b < w; b++) if (!free(tx + b, tz + a)) { ok = false; break; }
    if (!ok) { w = d = 1; if (style === 'apt') continue; }
    if (!roadNear(tx, tz, w, d) && (!map.grid(k) || r() < 0.5)) continue;
    for (let a = 0; a < d; a++) for (let b = 0; b < w; b++) occ[(tz + a) * NX + tx + b] = 1;
    const ins = 0.12;
    const x0 = x + ins, x1 = x + w - ins, z0 = z + ins, z1 = z + d - ins;
    let h;
    if (style === 'villa') {
      h = 1.0 + ((r() * 3) | 0) * 0.5; // 2~4층
      const kind = ['brick', 'brick', 'tan', 'stucco'][(r() * 4) | 0];
      W[kind].walls(x0, x1, z0, z1, 0, h, tints[(r() * 4) | 0]);
      const rc = r() < 0.65 ? '#5fa35a' : '#b9b4aa'; // 옥상 초록 방수페인트
      roofs.box(x1 - x0, 0.1, z1 - z0, rc, (x0 + x1) / 2, h + 0.05, (z0 + z1) / 2);
      roofs.box(x1 - x0 + 0.06, 0.16, 0.06, '#ddd5c5', (x0 + x1) / 2, h + 0.08, z1);
      if (r() < 0.5) roofs.box(0.3, 0.3, 0.3, r() < 0.5 ? '#3f86c8' : '#e8e2d2', x0 + 0.3, h + 0.25, z0 + 0.3); // 물탱크
    } else if (style === 'hanok') {
      h = 0.8;
      W.hanok.walls(x0 + 0.05, x1 - 0.05, z0 + 0.1, z1 - 0.1, 0, h, '#ffffff');
      giwa.hanokRoof(x1 - x0 + 0.1, z1 - z0 + 0.25, 0.6, '#ffffff', (x0 + x1) / 2, h, (z0 + z1) / 2, 0);
      h = 1.4;
    } else if (style === 'apt') {
      h = 2.5 + ((r() * 4) | 0) * 0.5 + (g.name === '강남구' || g.name === '서초구' || g.name === '송파구' ? 0.5 : 0);
      W.apt.walls(x0, x1, z0, z1, 0, h, tints[(r() * 4) | 0]);
      roofs.box(x1 - x0, 0.12, z1 - z0, '#d6d1c6', (x0 + x1) / 2, h + 0.06, (z0 + z1) / 2);
      roofs.box(0.5, 0.35, 0.5, '#c9c4b8', (x0 + x1) / 2, h + 0.3, (z0 + z1) / 2);
      roofs.box(x1 - x0, 0.25, z1 - z0, '#e9e5dc', (x0 + x1) / 2, 0.125, (z0 + z1) / 2); // 필로티 받침
    } else {
      const big = w >= 2;
      h = big ? 3 + r() * 2 : 2 + r() * 1;
      if (g.name === '강남구' || g.name === '영등포구' || g.name === '중구' || g.name === '서초구') h += 0.5 + r() * 1;
      h = Math.round(h * 2) / 2;
      const kind = ['glass', 'glass2', 'glass3'][(r() * 3) | 0];
      W[kind].walls(x0, x1, z0, z1, 0, h, '#ffffff');
      roofs.box(x1 - x0, 0.15, z1 - z0, '#8d9299', (x0 + x1) / 2, h + 0.07, (z0 + z1) / 2);
      if (big) roofs.box((x1 - x0) * 0.4, 0.4, (z1 - z0) * 0.4, '#a9aeb5', (x0 + x1) / 2, h + 0.3, (z0 + z1) / 2);
    }
    world.addCollider({ type: 'r', x0, x1, z0, z1 });
    world.buildings.push({ x0, x1, z0, z1, h });
  }
  world.occ = occ;
  for (const b of Object.values(W)) { const m = b.build(); if (m) s.add(m); }
  s.add(roofs.build(vcMat()));
  const gt = giwaTexture();
  s.add(giwa.build(seeThrough(new THREE.MeshLambertMaterial({ map: gt, vertexColors: true }))));
}

// ---------- 나무 (인스턴싱) ----------
function treeGeometry(kind) {
  const m = new Merger();
  m.box(0.32, 1.1, 0.32, '#7a4a26', 0, 0.55, 0);
  if (kind === 'pine') {
    m.box(1.5, 0.6, 1.5, '#2f7a44', 0, 1.3, 0); m.box(1.1, 0.6, 1.1, '#3a8a50', 0, 1.85, 0);
    m.box(0.7, 0.6, 0.7, '#46995c', 0, 2.4, 0); m.box(0.3, 0.4, 0.3, '#46995c', 0, 2.85, 0);
  } else if (kind === 'ginkgo') { // 은행나무: 가늘고 길쭉, 노란 단풍
    m.box(1.1, 1.0, 1.1, '#f2c21b', 0, 1.5, 0); m.box(0.8, 0.8, 0.8, '#f7d443', 0.05, 2.3, 0); m.box(0.5, 0.5, 0.5, '#e8b310', 0, 2.9, 0);
  } else {
    m.box(1.6, 1.0, 1.6, '#ffffff', 0, 1.5, 0); m.box(1.2, 0.6, 1.2, '#f2f2f2', 0.1, 2.25, -0.05); m.box(0.9, 0.6, 0.9, '#e6e6e6', -0.5, 1.6, 0.45);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(m.nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(m.col, 3));
  return g;
}

export function buildTrees(world, map, list) {
  // list: [{x,z,kind,s}] kind: round|pine|ginkgo|maple
  const kinds = ['round', 'pine', 'ginkgo'];
  const greens = ['#4f9a35', '#5fae3e', '#3f8a2a', '#6abf48'].map((c) => new THREE.Color(c));
  const maple = ['#d9542e', '#e8743a', '#c8402a'].map((c) => new THREE.Color(c));
  const dummy = new THREE.Object3D();
  for (const kind of kinds) {
    const items = list.filter((t) => (kind === 'round' ? t.kind === 'round' || t.kind === 'maple' : t.kind === kind));
    if (!items.length) continue;
    const g = treeGeometry(kind);
    // 둥근 나무는 줄기만 갈색이 되도록: 정점색이 흰색인 부분만 인스턴스 색을 받게 하는 대신, 줄기는 따로 둔다
    const im = new THREE.InstancedMesh(g, seeThrough(new THREE.MeshLambertMaterial({ vertexColors: true })), items.length);
    items.forEach((t, i) => {
      dummy.position.set(t.x, 0, t.z); dummy.rotation.set(0, t.ry || 0, 0); dummy.scale.setScalar(t.s); dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      const col = kind === 'round' ? (t.kind === 'maple' ? maple[i % 3] : greens[(i * 7) % 4]) : new THREE.Color(1, 1, 1).multiplyScalar(0.92 + ((i * 13) % 9) / 100);
      im.setColorAt(i, col);
    });
    im.castShadow = true; im.receiveShadow = true;
    if (kind === 'round') { // 줄기가 초록으로 물들지 않게: 줄기 정점색을 인스턴스 색으로 나눌 수 없으니 줄기는 별도 메시
      const pos = g.attributes.position, colA = g.attributes.color;
      for (let i = 0; i < 36; i++) colA.setXYZ(i, 0, 0, 0); // 줄기 숨김(검정 X → 아래 trunk 메시로 대체)
      g.setDrawRange(36, pos.count - 36);
      const tg = new THREE.BoxGeometry(0.32, 1.1, 0.32); tg.translate(0, 0.55, 0);
      const trunk = new THREE.InstancedMesh(tg, seeThrough(new THREE.MeshLambertMaterial({ color: '#7a4a26' })), items.length);
      items.forEach((t, i) => { dummy.position.set(t.x, 0, t.z); dummy.rotation.set(0, t.ry || 0, 0); dummy.scale.setScalar(t.s); dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix); });
      trunk.castShadow = true;
      world.scene.add(trunk);
    }
    world.scene.add(im);
  }
}

// ---------- 다리 ----------
// 한강 다리: 물 위로 BRIDGE_H만큼 떠 있고, 양 끝 BRIDGE_RAMP 칸은 비탈 → 수상택시가 다리 밑으로 지나감
export const BRIDGE_H = 1.7, BRIDGE_RAMP = 3;
export function buildBridges(world, map) {
  const big = new Merger(), small = new Merger();
  const isB = (tx, tz, kind) => tx >= 0 && tz >= 0 && tx < NX && tz < NZ && map.tile[tz * NX + tx] === T.BRIDGE && map.bkind[tz * NX + tx] === kind;
  // 다리 칸마다 그 세로 줄(남북으로 이어진 다리 칸들)의 시작·끝 z를 기록 → 높이 h(z) 계산
  const span0 = new Float32Array(NX * NZ), span1 = new Float32Array(NX * NZ);
  for (let tx = 0; tx < NX; tx++) for (let tz = 0; tz < NZ; tz++) {
    if (!isB(tx, tz, 1) || isB(tx, tz - 1, 1)) continue;
    let e = tz; while (isB(tx, e + 1, 1)) e++;
    for (let j = tz; j <= e; j++) { span0[j * NX + tx] = tz - HZ; span1[j * NX + tx] = e + 1 - HZ; }
  }
  // 비탈 길이는 다리가 짧으면 줄임 (짧은 다리도 가운데에 배가 지나갈 높은 구간이 남게)
  const hAt = (k, z) => BRIDGE_H * THREE.MathUtils.smoothstep(Math.min(z - span0[k], span1[k] - z), 0, Math.min(BRIDGE_RAMP, (span1[k] - span0[k]) * 0.2));
  // 걷는 높이 (다리 위면 다리 높이, 아니면 0)
  world.groundY = (x, z) => {
    const tx = Math.floor(x + HX), tz = Math.floor(z + HZ);
    return isB(tx, tz, 1) ? hAt(tz * NX + tx, z) : 0;
  };
  world.bridgePiers = []; // 수상택시가 부딪히는 교각
  // 한강을 넓혀도 교각 수는 넓히기 전과 같게: 예전 다리 길이(원래 한강 칸 수)로 세던 개수를 새 다리의 높은 구간에 고르게 나눔
  // → 다리가 길어진 만큼 교각 사이가 넓어져 수상택시가 지나가기 쉬움
  const pierSpan = (tx, s, x) => {
    let e = s; while (isB(tx, e + 1, 1)) e++;
    const k0 = s * NX + tx;
    // 예전 다리 = 원래 한강이던 칸의 처음~끝
    let o0 = -1, o1 = -1;
    for (let j = s; j <= e; j++) if (map.hanOrig ? map.hanOrig[j * NX + tx] : 1) { if (o0 < 0) o0 = j; o1 = j; }
    if (o0 < 0) return;
    const oldLen = o1 - o0 + 1, off = o0, ramp = Math.min(BRIDGE_RAMP, oldLen * 0.2);
    let n = 0;
    for (let j = 0; j < oldLen; j++) if ((off + j) % 3 === 0 && BRIDGE_H * THREE.MathUtils.smoothstep(Math.min(j + 0.5, oldLen - j - 0.5), 0, ramp) > 0.5) n++;
    if (!n) return;
    let a = -1, b = -1; // 새 다리에서 교각을 세울 수 있는 높은 구간
    for (let j = s; j <= e; j++) if (hAt(k0 + (j - s) * NX, j + 0.5 - HZ) > 0.5) { if (a < 0) a = j; b = j + 1; }
    if (a < 0) return;
    for (let i = 0; i < n; i++) {
      const z = a - HZ + ((i + 0.5) * (b - a)) / n, h = hAt(Math.floor(z + HZ) * NX + tx, z);
      const top = h - 0.28, bot = -1.2;
      big.box(1.7, top - bot, 0.5, '#9c9990', x + 0.5, (top + bot) / 2, z);
      big.box(1.9, 0.12, 0.62, '#b8b4aa', x + 0.5, -0.2, z); // 물 닿는 곳 받침
      world.bridgePiers.push({ x0: x + 0.5 - 0.95, x1: x + 0.5 + 0.95, z0: z - 0.31, z1: z + 0.31 });
    }
  };
  for (let tz = 0; tz < NZ; tz++) for (let tx = 0; tx < NX; tx++) {
    const k = tz * NX + tx;
    if (map.tile[k] !== T.BRIDGE) continue;
    const x = tx + 0.5 - HX, z = tz + 0.5 - HZ;
    if (map.bkind[k] === 1) {
      // 상판은 4조각으로 나눠서 비탈이 계단처럼 보이지 않게
      for (let q = 0; q < 4; q++) {
        const zq = tz - HZ + (q + 0.5) / 4, h = hAt(k, zq);
        big.box(1, 0.3, 0.25, '#b3b0a8', x, h - 0.13, zq);
        big.box(1, 0.04, 0.25, '#8a8784', x, h + 0.04, zq);
      }
      const h = hAt(k, z);
      if (!isB(tx - 1, tz, 1)) { big.box(0.1, 0.35, 1, '#e8e4dc', x - 0.45, h + 0.2, z); if (tz % 2 === 0) big.box(0.12, 1.3, 0.12, '#d8d4cc', x - 0.45, h + 0.65, z); }
      if (!isB(tx + 1, tz, 1)) { big.box(0.1, 0.35, 1, '#e8e4dc', x + 0.45, h + 0.2, z); if (tz % 2 === 0) { big.box(0.12, 1.3, 0.12, '#d8d4cc', x + 0.45, h + 0.65, z); big.box(0.3, 0.12, 0.3, '#fff3b0', x + 0.45, h + 1.3, z); } }
      // 교각: 다리 한 줄(남북으로 이어진 구간)의 첫 칸에서 한꺼번에 세움
      if (!isB(tx - 1, tz, 1) && !isB(tx, tz - 1, 1)) pierSpan(tx, tz, x);
    } else {
      small.box(1, 0.16, 1, '#a86c3a', x, -0.02, z);
      for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = tx + dx, nz = tz + dz;
        if (nx < 0 || nz < 0 || nx >= NX || nz >= NZ) continue;
        if (map.tile[nz * NX + nx] === T.WATER) small.box(dx ? 0.1 : 1, 0.35, dz ? 0.1 : 1, '#7a4a26', x + dx * 0.45, 0.2, z + dz * 0.45);
      }
    }
  }
  const pm = new THREE.MeshLambertMaterial({ map: plankTexture('#ffffff', '#c9c9c9', '#ffffff'), vertexColors: true });
  // 다리도 투과 셰이더: 수상택시가 밑을 지날 때 상판이 도트 무늬로 뚫려 배가 보임
  if (!big.empty) world.scene.add(big.build(seeThrough(new THREE.MeshLambertMaterial({ vertexColors: true }))));
  if (!small.empty) world.scene.add(small.build(pm));
}
