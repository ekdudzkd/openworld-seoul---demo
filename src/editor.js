import * as THREE from 'three';
import {
  Avatar, PARTS, PART_KEYS, FACES, FACE_LABEL, faceDims, pixelLocal, mirrorOf, farmerSkin, basicSkin, cloneSkin,
} from './character.js';

const PALETTE = [
  '#3b2416', '#000000', '#5f5f6e', '#a5a5b5', '#ffffff', '#f2c29b', '#d99a6c', '#8a5a35',
  '#e8413a', '#ff8a5c', '#ffd23f', '#f0cc63', '#8fd16a', '#3f8a2a', '#5bc0eb', '#3a6fd8',
  '#2a3a8a', '#9b5de5', '#f15bb5', '#ffb3c6', '#7a4a26', '#4e7a3a', '#5b8fd8', '#f08a7a',
];
export const TEMPLATES = { farmer: farmerSkin, basic: basicSkin };

// 입체 틀 위에 직접 칠하는 3D 스킨 에디터
export class SkinEditor {
  constructor({ view, faceCanvas, paletteEl, customColorEl, faceLabel, partSel, faceBtns, onChange }) {
    this.view = view; this.faceCanvas = faceCanvas; this.faceLabel = faceLabel; this.partSel = partSel; this.faceBtns = faceBtns;
    this.customColorEl = customColorEl; this.onChange = onChange;
    this.color = PALETTE[8]; this.tool = 'pen'; this.mirror = true; this.walk = false;
    this.undo = [];
    this.sel = { part: 'head', face: 'front' };
    this.orbit = { yaw: 0.5, pitch: 0.22, dist: 5.6 };
    this.buildPalette(paletteEl);
    this.setup3D();
    this.load(farmerSkin());
    this.bind3D();
    this.bindFace();
    this.bindSelectors();
  }

  // ---------- 팔레트 / 도구 ----------
  buildPalette(el) {
    el.innerHTML = '';
    this.swatches = PALETTE.map((col) => {
      const s = document.createElement('button');
      s.className = 'swatch'; s.style.background = col; s.dataset.color = col; s.title = col;
      s.onclick = () => this.setColor(col);
      el.appendChild(s);
      return s;
    });
    this.customColorEl.addEventListener('input', (e) => this.setColor(e.target.value));
    this.setColor(this.color);
  }
  setColor(col) {
    this.color = col;
    this.swatches.forEach((s) => s.classList.toggle('active', s.dataset.color === col));
    if (this.tool === 'picker') this.setTool('pen');
  }
  setTool(t) {
    this.tool = t;
    document.querySelectorAll('.tool[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
  }

  // ---------- 데이터 ----------
  load(skin) {
    this.skin = cloneSkin(skin);
    if (this.avatar) { this.scene.remove(this.avatar.root); this.avatar.dispose(); }
    this.avatar = new Avatar(this.skin, { height: 1.7 });
    this.scene.add(this.avatar.root);
    this.drawFace();
    this.onChange?.(this.skin);
  }
  loadTemplate(name) { this.snapshot(); this.load(TEMPLATES[name]()); }
  snapshot() { this.undo.push(cloneSkin(this.skin)); if (this.undo.length > 40) this.undo.shift(); }
  doUndo() {
    if (!this.undo.length) return;
    const prev = this.undo.pop();
    for (const p of PART_KEYS) for (const f of FACES) this.skin[p][f] = prev[p][f];
    this.avatar.refreshAll(); this.drawFace(); this.onChange?.(this.skin);
  }

  // 픽셀 여러 개 칠하기 (대칭 포함) → 바뀐 면만 다시 그림
  apply(list) {
    const dirty = new Set();
    const put = (part, face, i, col) => { if (this.skin[part][face][i] !== col) { this.skin[part][face][i] = col; dirty.add(`${part}.${face}`); } };
    for (const { part, face, i, col } of list) {
      put(part, face, i, col);
      if (this.mirror) {
        const [w] = faceDims(part, face);
        const m = mirrorOf(part, face, i % w, Math.floor(i / w));
        if (m) put(m.part, m.face, m.i, col);
      }
    }
    for (const k of dirty) { const [p, f] = k.split('.'); this.avatar.refreshFace(p, f); }
    if (dirty.size) { this.drawFace(); this.onChange?.(this.skin); }
  }

  floodList(part, face, i, col) {
    const [w, h] = faceDims(part, face);
    const arr = this.skin[part][face], target = arr[i];
    if (target === col) return [];
    const seen = new Set([i]), stack = [i], out = [];
    while (stack.length) {
      const j = stack.pop(); out.push({ part, face, i: j, col });
      const c = j % w, r = Math.floor(j / w);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr, n = nr * w + nc;
        if (nc < 0 || nr < 0 || nc >= w || nr >= h || seen.has(n) || arr[n] !== target) continue;
        seen.add(n); stack.push(n);
      }
    }
    return out;
  }

  // 도구 동작 (3D·2D 공통). 반환값 true = 드래그로 계속 칠하기
  act(part, face, i, first) {
    this.select(part, face);
    if (this.tool === 'picker') {
      const col = this.skin[part][face][i];
      this.setColor(col); this.customColorEl.value = col; this.setTool('pen');
      return false;
    }
    if (first) this.snapshot();
    if (this.tool === 'fill') { this.apply(this.floodList(part, face, i, this.color)); return false; }
    if (this.tool === 'part') {
      const list = [];
      for (const f of FACES) this.skin[part][f].forEach((_, j) => list.push({ part, face: f, i: j, col: this.color }));
      this.apply(list); return false;
    }
    this.apply([{ part, face, i, col: this.color }]);
    return true;
  }

  select(part, face) {
    if (this.sel.part === part && this.sel.face === face) return;
    this.sel = { part, face };
    this.partSel.value = part;
    this.drawFace();
  }

  // ---------- 3D 뷰 ----------
  setup3D() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.view, antialias: false, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(this.view.clientWidth || 520, this.view.clientHeight || 520, false);
    this.renderer.shadowMap.enabled = true;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#9ab87a', 1.7));
    const d = new THREE.DirectionalLight('#fff3dc', 1.5); d.position.set(3, 6, 4); d.castShadow = true;
    d.shadow.mapSize.set(512, 512); Object.assign(d.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1 });
    this.scene.add(d);
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.3, 10), new THREE.MeshLambertMaterial({ color: '#74b84f' }));
    ground.position.y = -0.15; ground.receiveShadow = true;
    const dirt = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.3, 0.4, 10), new THREE.MeshLambertMaterial({ color: '#8a5a35' }));
    dirt.position.y = -0.5;
    this.scene.add(ground, dirt);
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    this.ray = new THREE.Raycaster();
    // 커서 위치 표시 (정사각형 테두리) — 대칭 위치도 표시
    const sq = new THREE.BufferGeometry().setFromPoints([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [-0.5, -0.5]].map(([x, y]) => new THREE.Vector3(x, y, 0)));
    this.hl = new THREE.Line(sq, new THREE.LineBasicMaterial({ color: '#ff3a2a', depthTest: false }));
    this.hl2 = new THREE.Line(sq, new THREE.LineBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.7 }));
    for (const h of [this.hl, this.hl2]) { h.renderOrder = 10; h.visible = false; }
  }

  hit(e) {
    const r = this.view.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const h = this.ray.intersectObjects(this.avatar.meshes, false)[0];
    if (!h || !h.uv) return null;
    const part = h.object.userData.part, face = FACES[h.face.materialIndex];
    const [w, hgt] = faceDims(part, face);
    const c = Math.min(w - 1, Math.floor(h.uv.x * w)), rr = Math.min(hgt - 1, Math.floor((1 - h.uv.y) * hgt));
    return { part, face, c, r: rr, i: rr * w + c };
  }

  placeHL(line, part, face, c, r) {
    const mesh = this.avatar.meshes[PART_KEYS.indexOf(part)];
    const s = this.avatar.s;
    const { p, n } = pixelLocal(part, face, c, r);
    const nv = new THREE.Vector3(...n);
    line.position.set(p[0] * s, p[1] * s, p[2] * s).addScaledVector(nv, 0.004);
    line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nv);
    line.scale.setScalar(s);
    mesh.add(line);
    line.visible = true;
  }
  showHover(h) {
    this.hl.visible = this.hl2.visible = false;
    if (!h || this.walk) return;
    this.placeHL(this.hl, h.part, h.face, h.c, h.r);
    if (this.mirror) {
      const m = mirrorOf(h.part, h.face, h.c, h.r);
      if (m && !(m.part === h.part && m.face === h.face && m.i === h.i)) {
        const [w] = faceDims(m.part, m.face);
        this.placeHL(this.hl2, m.part, m.face, m.i % w, Math.floor(m.i / w));
      }
    }
  }

  bind3D() {
    const v = this.view;
    let mode = null, last = null;
    v.addEventListener('contextmenu', (e) => e.preventDefault());
    v.addEventListener('pointerdown', (e) => {
      v.setPointerCapture(e.pointerId);
      last = { x: e.clientX, y: e.clientY };
      const h = e.button === 0 ? this.hit(e) : null;
      if (h) { mode = this.act(h.part, h.face, h.i, true) ? 'paint' : null; }
      else mode = 'orbit';
      v.style.cursor = mode === 'orbit' ? 'grabbing' : 'crosshair';
    });
    v.addEventListener('pointermove', (e) => {
      if (mode === 'orbit') {
        this.orbit.yaw -= (e.clientX - last.x) * 0.01;
        this.orbit.pitch = THREE.MathUtils.clamp(this.orbit.pitch + (e.clientY - last.y) * 0.008, -0.6, 1.2);
      } else if (mode === 'paint') {
        // 빠르게 그어도 끊기지 않도록 중간 지점도 샘플링
        const dx = e.clientX - last.x, dy = e.clientY - last.y;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
        const list = [];
        for (let k = 1; k <= steps; k++) {
          const h = this.hit({ clientX: last.x + (dx * k) / steps, clientY: last.y + (dy * k) / steps });
          if (h) list.push({ part: h.part, face: h.face, i: h.i, col: this.color });
        }
        this.apply(list);
      }
      last = { x: e.clientX, y: e.clientY };
      this.showHover(mode === 'orbit' ? null : this.hit(e));
    });
    const end = () => { mode = null; v.style.cursor = 'crosshair'; };
    v.addEventListener('pointerup', end);
    v.addEventListener('pointercancel', end);
    v.addEventListener('pointerleave', () => this.showHover(null));
    v.addEventListener('wheel', (e) => { e.preventDefault(); this.orbit.dist = THREE.MathUtils.clamp(this.orbit.dist + Math.sign(e.deltaY) * 0.35, 2.4, 8); }, { passive: false });
  }

  setView(name) {
    const yaw = { front: 0, back: Math.PI, left: -Math.PI / 2, right: Math.PI / 2, top: 0 }[name];
    this.orbit.yaw = yaw; this.orbit.pitch = name === 'top' ? 1.15 : 0.18;
  }

  // ---------- 선택한 면 확대 편집 ----------
  drawFace() {
    const cv = this.faceCanvas, ctx = cv.getContext('2d');
    const { part, face } = this.sel;
    const [w, h] = faceDims(part, face);
    const cell = Math.floor(Math.min(cv.width / w, cv.height / h));
    this.fc = { cell, ox: (cv.width - w * cell) >> 1, oy: (cv.height - h * cell) >> 1, w, h };
    ctx.fillStyle = '#e9d3a4'; ctx.fillRect(0, 0, cv.width, cv.height);
    const arr = this.skin[part][face];
    arr.forEach((col, i) => { ctx.fillStyle = col; ctx.fillRect(this.fc.ox + (i % w) * cell, this.fc.oy + Math.floor(i / w) * cell, cell, cell); });
    ctx.fillStyle = 'rgba(63,29,11,0.18)';
    for (let c = 0; c <= w; c++) ctx.fillRect(this.fc.ox + c * cell, this.fc.oy, 1, h * cell);
    for (let r = 0; r <= h; r++) ctx.fillRect(this.fc.ox, this.fc.oy + r * cell, w * cell, 1);
    if (this.fhover !== undefined && this.fhover !== null) {
      ctx.strokeStyle = '#ff3a2a'; ctx.lineWidth = 2;
      ctx.strokeRect(this.fc.ox + (this.fhover % w) * cell + 1, this.fc.oy + Math.floor(this.fhover / w) * cell + 1, cell - 2, cell - 2);
    }
    this.faceLabel.textContent = `${PARTS[part].label} · ${FACE_LABEL[face]} (${w}×${h})`;
    this.faceBtns.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.face === face));
  }
  faceCell(e) {
    const r = this.faceCanvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * this.faceCanvas.width, y = ((e.clientY - r.top) / r.height) * this.faceCanvas.height;
    const c = Math.floor((x - this.fc.ox) / this.fc.cell), rr = Math.floor((y - this.fc.oy) / this.fc.cell);
    if (c < 0 || rr < 0 || c >= this.fc.w || rr >= this.fc.h) return null;
    return { c, r: rr, i: rr * this.fc.w + c };
  }
  bindFace() {
    const cv = this.faceCanvas;
    let painting = false, last = null;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      const p = this.faceCell(e); if (!p) return;
      cv.setPointerCapture(e.pointerId);
      painting = this.act(this.sel.part, this.sel.face, p.i, true); last = p;
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this.faceCell(e);
      this.fhover = p ? p.i : null;
      if (painting && p && last) {
        const list = [];
        let x0 = last.c, y0 = last.r; const x1 = p.c, y1 = p.r;
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
          list.push({ part: this.sel.part, face: this.sel.face, i: y0 * this.fc.w + x0, col: this.color });
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
        this.apply(list);
        last = p;
      } else this.drawFace();
    });
    const end = () => { painting = false; last = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', () => { this.fhover = null; this.drawFace(); });
  }

  bindSelectors() {
    this.partSel.innerHTML = PART_KEYS.map((k) => `<option value="${k}">${PARTS[k].label}</option>`).join('');
    this.partSel.value = this.sel.part;
    this.partSel.onchange = () => { this.sel.part = this.partSel.value; this.drawFace(); };
    this.faceBtns.innerHTML = ['front', 'back', 'left', 'right', 'top', 'bottom']
      .map((f) => `<button class="face-btn" data-face="${f}">${FACE_LABEL[f]}</button>`).join('');
    this.faceBtns.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      this.sel.face = b.dataset.face; this.drawFace();
      if (['front', 'back', 'left', 'right', 'top'].includes(b.dataset.face)) this.setView(b.dataset.face);
    }));
    this.drawFace();
  }

  // ---------- 매 프레임 ----------
  tick(dt, t) {
    const w = this.view.clientWidth, h = this.view.clientHeight;
    if (w && (this._w !== w || this._h !== h)) { this._w = w; this._h = h; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    if (this.walk) {
      this.avatar.animate(dt, t, { moving: true, yaw: 0 });
    } else {
      this.avatar.animate(dt * 3, t, { moving: false, yaw: 0 });
      // 칠하는 동안 흔들리지 않도록 자세 고정
      for (const k of PART_KEYS) this.avatar.joints[k].rotation.set(0, 0, 0);
      this.avatar.torso.position.y = 0; this.avatar.torso.rotation.set(0, 0, 0);
    }
    const o = this.orbit, ty = 0.85;
    this.camera.position.set(Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist, ty + Math.sin(o.pitch) * o.dist, Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist);
    this.camera.lookAt(0, ty, 0);
    this.renderer.render(this.scene, this.camera);
  }
}
