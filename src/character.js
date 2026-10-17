import * as THREE from 'three';

// ============================================================
//  입체 틀(마인크래프트 스킨 방식) 캐릭터
//  단위: "픽셀" — 머리 10×10×10, 몸 8×7×5, 팔 3×7×3, 다리 4×5×4 (총 키 22픽셀)
//  왼팔/오른팔은 "앞에서 봤을 때" 화면 기준
// ============================================================

export const FACES = ['right', 'left', 'top', 'bottom', 'front', 'back']; // BoxGeometry 재질 순서
export const FACE_LABEL = { front: '앞', back: '뒤', left: '왼쪽', right: '오른쪽', top: '위', bottom: '아래' };

export const PARTS = {
  head: { label: '머리', size: [10, 10, 10], pivot: [0, 12, 0], offset: [0, 5, 0] },
  body: { label: '몸', size: [8, 7, 5], pivot: [0, 5, 0], offset: [0, 3.5, 0] },
  armL: { label: '왼팔', size: [3, 7, 3], pivot: [-5.5, 12, 0], offset: [0, -3.5, 0] },
  armR: { label: '오른팔', size: [3, 7, 3], pivot: [5.5, 12, 0], offset: [0, -3.5, 0] },
  legL: { label: '왼다리', size: [4, 5, 4], pivot: [-2, 5, 0], offset: [0, -2.5, 0] },
  legR: { label: '오른다리', size: [4, 5, 4], pivot: [2, 5, 0], offset: [0, -2.5, 0] },
};
export const PART_KEYS = Object.keys(PARTS);
export const MODEL_HEIGHT = 22;

export function faceDims(part, face) {
  const [W, H, D] = PARTS[part].size;
  if (face === 'front' || face === 'back') return [W, H];
  if (face === 'left' || face === 'right') return [D, H];
  return [W, D];
}

// 면의 (c, r) 픽셀 중심 → 파트 중심 기준 좌표(픽셀 단위) + 법선
export function pixelLocal(part, face, c, r) {
  const [W, H, D] = PARTS[part].size;
  const hw = W / 2, hh = H / 2, hd = D / 2;
  switch (face) {
    case 'front': return { p: [-hw + c + 0.5, hh - r - 0.5, hd], n: [0, 0, 1] };
    case 'back': return { p: [hw - c - 0.5, hh - r - 0.5, -hd], n: [0, 0, -1] };
    case 'right': return { p: [hw, hh - r - 0.5, hd - c - 0.5], n: [1, 0, 0] };
    case 'left': return { p: [-hw, hh - r - 0.5, -hd + c + 0.5], n: [-1, 0, 0] };
    case 'top': return { p: [-hw + c + 0.5, hh, -hd + r + 0.5], n: [0, 1, 0] };
    default: return { p: [-hw + c + 0.5, -hh, hd - r - 0.5], n: [0, -1, 0] };
  }
}

// 좌우 대칭용: 모델 공간 좌표 → (part, face, idx) 검색표
let MIRROR = null;
function modelKey(x, y, z, face) { return `${Math.round(x * 2)},${Math.round(y * 2)},${Math.round(z * 2)},${face}`; }
function buildMirror() {
  const map = new Map();
  for (const part of PART_KEYS) {
    const { pivot, offset } = PARTS[part];
    for (const face of FACES) {
      const [w, h] = faceDims(part, face);
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        const { p } = pixelLocal(part, face, c, r);
        map.set(modelKey(pivot[0] + offset[0] + p[0], pivot[1] + offset[1] + p[1], pivot[2] + offset[2] + p[2], face), { part, face, i: r * w + c });
      }
    }
  }
  MIRROR = map;
}
export function mirrorOf(part, face, c, r) {
  if (!MIRROR) buildMirror();
  const { pivot, offset } = PARTS[part];
  const { p } = pixelLocal(part, face, c, r);
  const mf = face === 'left' ? 'right' : face === 'right' ? 'left' : face;
  return MIRROR.get(modelKey(-(pivot[0] + offset[0] + p[0]), pivot[1] + offset[1] + p[1], pivot[2] + offset[2] + p[2], mf)) || null;
}

// ---------- 스킨 데이터 ----------
export function blankSkin(colors = {}) {
  const base = { head: '#f2c29b', body: '#ffffff', armL: '#ffffff', armR: '#ffffff', legL: '#5b8fd8', legR: '#5b8fd8', ...colors };
  const skin = {};
  for (const part of PART_KEYS) {
    skin[part] = {};
    for (const face of FACES) { const [w, h] = faceDims(part, face); skin[part][face] = new Array(w * h).fill(base[part]); }
  }
  return skin;
}
export function cloneSkin(s) { return JSON.parse(JSON.stringify(s)); }
export function validSkin(s) {
  try { return PART_KEYS.every((p) => FACES.every((f) => s[p][f].length === faceDims(p, f)[0] * faceDims(p, f)[1])); } catch { return false; }
}

function painter(skin) {
  const set = (part, face, c, r, col) => { const [w, h] = faceDims(part, face); if (c >= 0 && r >= 0 && c < w && r < h) skin[part][face][r * w + c] = col; };
  const rect = (part, face, c0, r0, c1, r1, col) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) set(part, face, c, r, col); };
  const rows = (part, faces, r0, r1, col) => faces.forEach((f) => { const [w] = faceDims(part, f); rect(part, f, 0, r0, w - 1, r1, col); });
  const all = (part, col) => FACES.forEach((f) => skin[part][f].fill(col));
  return { set, rect, rows, all };
}
const SIDES = ['front', 'back', 'left', 'right'];

// 예시 1: 밀짚모자 농부
export function farmerSkin() {
  const skin = blankSkin();
  const { set, rect, rows, all } = painter(skin);
  const SK = '#f2c29b', HAIR = '#7a4a26', HAT = '#f0cc63', BAND = '#b88a2e', EYE = '#2b1a10';
  const SHIRT = '#5b8fd8', OVER = '#4e7a3a', SHOE = '#6b3b1c';
  all('head', SK);
  rect('head', 'top', 0, 0, 9, 9, HAT);
  rect('head', 'top', 0, 0, 9, 0, '#d9a93a'); rect('head', 'top', 0, 9, 9, 9, '#d9a93a');
  rect('head', 'top', 0, 0, 0, 9, '#d9a93a'); rect('head', 'top', 9, 0, 9, 9, '#d9a93a');
  rows('head', SIDES, 0, 1, HAT); rows('head', SIDES, 2, 2, BAND);
  rect('head', 'back', 0, 3, 9, 9, HAIR);
  rect('head', 'right', 5, 3, 9, 8, HAIR); rect('head', 'right', 4, 3, 4, 4, HAIR); set('head', 'right', 3, 6, '#e0a87e');
  rect('head', 'left', 0, 3, 4, 8, HAIR); rect('head', 'left', 5, 3, 5, 4, HAIR); set('head', 'left', 6, 6, '#e0a87e');
  rect('head', 'front', 0, 3, 9, 3, HAIR); set('head', 'front', 0, 4, HAIR); set('head', 'front', 9, 4, HAIR);
  rect('head', 'front', 2, 5, 2, 6, EYE); rect('head', 'front', 7, 5, 7, 6, EYE);
  set('head', 'front', 2, 5, '#5a3a28'); set('head', 'front', 7, 5, '#5a3a28');
  set('head', 'front', 1, 7, '#f08a7a'); set('head', 'front', 8, 7, '#f08a7a');
  rect('head', 'front', 4, 8, 5, 8, '#a0523a');
  all('body', SHIRT);
  rect('body', 'front', 0, 2, 7, 6, OVER); rect('body', 'front', 1, 0, 1, 1, OVER); rect('body', 'front', 6, 0, 6, 1, OVER);
  set('body', 'front', 1, 2, '#ffd23f'); set('body', 'front', 6, 2, '#ffd23f');
  rect('body', 'back', 0, 3, 7, 6, OVER); rect('body', 'back', 1, 0, 1, 2, OVER); rect('body', 'back', 6, 0, 6, 2, OVER);
  rows('body', ['left', 'right'], 3, 6, OVER); skin.body.bottom.fill(OVER);
  for (const a of ['armL', 'armR']) { all(a, SHIRT); rows(a, SIDES, 5, 6, SK); skin[a].bottom.fill(SK); }
  for (const l of ['legL', 'legR']) { all(l, OVER); rows(l, SIDES, 3, 4, SHOE); skin[l].bottom.fill(SHOE); }
  return skin;
}

// 예시 2: 기본 (흰 티 + 청바지, 칠하기 편한 상태)
export function basicSkin() {
  const skin = blankSkin({ body: '#f7f3ea', armL: '#f7f3ea', armR: '#f7f3ea', legL: '#4f6fae', legR: '#4f6fae' });
  const { set, rect, rows } = painter(skin);
  rect('head', 'top', 0, 0, 9, 9, '#3b2416'); rows('head', SIDES, 0, 1, '#3b2416');
  rect('head', 'back', 0, 2, 9, 7, '#3b2416');
  rect('head', 'front', 2, 5, 2, 6, '#2b1a10'); rect('head', 'front', 7, 5, 7, 6, '#2b1a10');
  rect('head', 'front', 4, 8, 5, 8, '#c0605a');
  for (const a of ['armL', 'armR']) { rows(a, SIDES, 4, 6, '#f2c29b'); skin[a].bottom.fill('#f2c29b'); }
  for (const l of ['legL', 'legR']) { rows(l, SIDES, 4, 4, '#ffffff'); skin[l].bottom.fill('#ffffff'); }
  set('body', 'front', 0, 0, '#f7f3ea');
  return skin;
}

// NPC: 냥촌장 (주황 고양이 + 파란 조끼)
export function catSkin() {
  const O = '#f0a040', OD = '#d9822a', W = '#fff4e0', VEST = '#3a6fd8';
  const skin = blankSkin({ head: O, body: W, armL: O, armR: O, legL: O, legR: O });
  const { set, rect, rows, all } = painter(skin);
  for (const f of ['top', 'back', 'left', 'right']) for (let i = 0; i < skin.head[f].length; i += 3) if ((i >> 1) % 2) skin.head[f][i] = OD;
  rect('head', 'front', 2, 6, 7, 9, W);
  rect('head', 'front', 2, 4, 2, 5, '#2b1a10'); rect('head', 'front', 7, 4, 7, 5, '#2b1a10');
  set('head', 'front', 2, 4, '#7ad0a0'); set('head', 'front', 7, 4, '#7ad0a0');
  rect('head', 'front', 4, 6, 5, 6, '#ff8fa8'); set('head', 'front', 4, 7, '#3b2416'); set('head', 'front', 5, 7, '#3b2416');
  set('head', 'front', 1, 7, '#ffb3c6'); set('head', 'front', 8, 7, '#ffb3c6');
  rect('head', 'front', 0, 0, 9, 0, OD); rect('head', 'front', 4, 1, 5, 2, OD);
  all('body', VEST); rect('body', 'front', 3, 0, 4, 6, W); set('body', 'front', 2, 3, '#ffd23f'); set('body', 'front', 5, 3, '#ffd23f');
  for (const a of ['armL', 'armR']) { rows(a, ['front', 'back', 'left', 'right'], 0, 2, VEST); rows(a, ['front', 'back', 'left', 'right'], 6, 6, W); skin[a].bottom.fill(W); }
  for (const l of ['legL', 'legR']) { rows(l, ['front', 'back', 'left', 'right'], 4, 4, W); skin[l].bottom.fill(W); }
  return skin;
}

// ---------- 텍스처 ----------
function faceCanvas(part, face) {
  const [w, h] = faceDims(part, face);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c;
}
function paintCanvas(canvas, colors, w) {
  const ctx = canvas.getContext('2d');
  colors.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(i % w, Math.floor(i / w), 1, 1); });
}

// ============================================================
//  Avatar: 관절(피벗)이 있는 3D 캐릭터
// ============================================================
export class Avatar {
  constructor(skin, { height = 1.7 } = {}) {
    this.skin = skin;
    this.s = height / MODEL_HEIGHT;
    const s = this.s;
    this.root = new THREE.Group();       // 위치/회전(바라보는 방향)
    this.torso = new THREE.Group();      // 몸 흔들림
    this.root.add(this.torso);
    this.joints = {}; this.meshes = []; this.tex = {};
    for (const part of PART_KEYS) {
      const def = PARTS[part];
      const pivot = new THREE.Group();
      pivot.position.set(def.pivot[0] * s, def.pivot[1] * s, def.pivot[2] * s);
      const mats = FACES.map((face) => {
        const cv = faceCanvas(part, face);
        paintCanvas(cv, skin[part][face], cv.width);
        const t = new THREE.CanvasTexture(cv);
        t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
        t.colorSpace = THREE.SRGBColorSpace;
        this.tex[`${part}.${face}`] = { tex: t, canvas: cv };
        return new THREE.MeshLambertMaterial({ map: t });
      });
      const [W, H, D] = def.size;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(W * s, H * s, D * s), mats);
      mesh.position.set(def.offset[0] * s, def.offset[1] * s, def.offset[2] * s);
      mesh.castShadow = true;
      mesh.userData.part = part;
      pivot.add(mesh);
      (part.startsWith('leg') ? this.root : this.torso).add(pivot);
      this.joints[part] = pivot;
      this.meshes.push(mesh);
    }
    this.height = MODEL_HEIGHT * s;
    this.phase = 0; this.yaw = 0; this.idleT = 0;
  }

  refreshFace(part, face) {
    const { tex, canvas } = this.tex[`${part}.${face}`];
    paintCanvas(canvas, this.skin[part][face], canvas.width);
    tex.needsUpdate = true;
  }
  refreshAll() { for (const p of PART_KEYS) for (const f of FACES) this.refreshFace(p, f); }

  dispose() {
    this.meshes.forEach((m) => { m.geometry.dispose(); m.material.forEach((mt) => { mt.map.dispose(); mt.dispose(); }); });
  }

  // state: { moving, run, air, wave, yaw }
  animate(dt, t, st = {}) {
    const k = 1 - Math.exp(-dt * 14);
    const J = this.joints;
    const lerp = (obj, prop, v) => { obj[prop] += (v - obj[prop]) * k; };
    // 방향 회전 (가장 짧은 쪽으로)
    if (st.yaw !== undefined) {
      let d = st.yaw - this.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.root.rotation.y += d * (1 - Math.exp(-dt * 12));
    }
    const s = this.s;
    let legA = 0, armA = 0, bob = 0, lean = 0, headY = 0, headX = 0, armZ = 0.06, armRZ = null, armRX = null;
    if (st.air) {
      legA = 0.5; armA = 0; armRX = -2.5;
      J.armL.rotation.x += (-2.5 - J.armL.rotation.x) * k;
      lean = -0.08;
    } else if (st.moving) {
      this.phase += dt * (st.run ? 15 : 10);
      const amp = st.run ? 0.95 : 0.7;
      legA = Math.sin(this.phase) * amp;
      armA = -Math.sin(this.phase) * amp * 0.85;
      bob = Math.abs(Math.cos(this.phase)) * (st.run ? 1.2 : 0.8) * s;
      lean = st.run ? 0.14 : 0.05;
      headX = st.run ? -0.08 : 0;
    } else {
      this.idleT += dt;
      bob = Math.sin(t * 2.4) * 0.15 * s;
      armZ = 0.06 + Math.sin(t * 2.4) * 0.03;
      headY = Math.sin(t * 0.6) * 0.25 * (Math.sin(t * 0.23) > 0 ? 1 : 0.2);
    }
    if (st.wave) { armRZ = 2.7 + Math.sin(t * 12) * 0.35; armRX = 0; }
    if (st.armsUp) { armA = 0; armRX = 0; armZ = -2.75; armRZ = 2.75; }
    // 박수: 두 팔을 앞으로 뻗고 안쪽으로 모음 (clap 0=벌림, 1=손 맞댐)
    if (st.clap !== undefined) { const a = 0.15 + st.clap * 0.45; armA = -1.35; armRX = -1.35; armZ = -a; armRZ = -a; }

    lerp(J.legL.rotation, 'x', st.air ? -legA : legA);
    lerp(J.legR.rotation, 'x', st.air ? legA * 0.3 : -legA);
    if (!st.air) lerp(J.armL.rotation, 'x', armA);
    lerp(J.armR.rotation, 'x', armRX !== null ? armRX : -armA);
    lerp(J.armL.rotation, 'z', -armZ);
    lerp(J.armR.rotation, 'z', armRZ !== null ? armRZ : armZ);
    if (st.armsUp) { J.armL.rotation.x = 0; }
    lerp(J.head.rotation, 'y', headY);
    lerp(J.head.rotation, 'x', headX);
    lerp(this.torso.rotation, 'x', lean);
    this.torso.position.y += (bob - this.torso.position.y) * k;
  }
}

// HUD 초상화: 머리 앞면
export function drawPortrait(skin, canvas) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const [w, h] = faceDims('head', 'front');
  const sc = Math.floor(Math.min(canvas.width / w, canvas.height / h));
  const ox = (canvas.width - w * sc) >> 1, oy = (canvas.height - h * sc) >> 1;
  skin.head.front.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(ox + (i % w) * sc, oy + Math.floor(i / w) * sc, sc, sc); });
}
