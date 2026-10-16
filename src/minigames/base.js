import * as THREE from 'three';
import { Avatar } from '../character.js';
import { rng, canvasTexture, drawTile } from '../textures.js';
import { sfx } from '../sfx.js';

const $ = (id) => document.getElementById(id);

// ============================================================
//  모든 미니게임의 공통 뼈대
//  - 하위 클래스가 정의: static meta, build(), reset(), step(dt,t,keys), idle(dt,t), resultRows()
//  - 공통 처리: 카운트다운, 제한시간, 하트, HUD, 피격 깜빡임, 결과 전달
// ============================================================
export class MiniGame {
  constructor({ onEnd, onFloat, ctx }) {
    this.onEnd = onEnd; this.onFloat = onFloat; this.ctx = ctx;
    const m = this.constructor.meta;
    this.meta = m;
    this.duration = m.duration || 0;
    this.maxHearts = m.hearts || 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(m.sky || '#a8dcf5');
    this.baseFov = m.fov || 42;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, 1, 0.1, 200);
    this.ray = new THREE.Raycaster();
    this.flashTargets = [];
    this.build();
  }

  // ---------- 무대 도우미 ----------
  lights({ pos = [-6, 14, 9], size = 12, intensity = 2.0 } = {}) {
    this.scene.add(new THREE.HemisphereLight('#e0f3ff', '#7a9a55', 1.3));
    const sun = new THREE.DirectionalLight('#fff0d0', intensity);
    sun.position.set(...pos); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, far: 80 });
    this.scene.add(sun);
    this.sun = sun;
    return sun;
  }
  tileGround(w, h, pick, seed = 9) {
    const c = document.createElement('canvas'); c.width = w * 16; c.height = h * 16;
    const g = c.getContext('2d'); const r = rng(seed);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) drawTile(g, x * 16, y * 16, pick(x, y), r);
    const tex = canvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }
  ndc(e, w, h) { return new THREE.Vector2((e.clientX / w) * 2 - 1, -(e.clientY / h) * 2 + 1); }

  setPlayer(skin, height = 1.6) {
    if (this.avatar) { this.scene.remove(this.avatar.root); this.avatar.dispose(); }
    this.avatar = new Avatar(skin, { height });
    this.player = this.avatar.root;
    this.scene.add(this.player);
    this.onAvatar?.();
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1.4 ? this.baseFov * (1.4 / aspect) ** 0.8 : this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  // 입력 (main.js가 전달)
  pointer() {} pointerDown() {} pointerUp() {} keyDown() {} keyUp() {}

  // ---------- 진행 ----------
  start() {
    this.time = this.duration; this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.hearts = this.maxHearts; this.hitFlash = 0;
    this.state = 'countdown'; this.cdT = 3.2;
    $('miniOverlay').innerHTML = '';
    this.reset();
    this.setupHud();
    this.renderHud();
  }

  update(dt, t, keys) {
    if (this.state === 'countdown') {
      const prev = Math.ceil(this.cdT);
      this.cdT -= dt;
      const n = Math.ceil(this.cdT);
      const cd = $('countdown');
      cd.classList.remove('hidden');
      cd.textContent = n > 0 ? n : '시작!';
      if (n !== prev) n > 0 ? sfx.tick() : sfx.go();
      if (this.cdT < -0.5) { this.state = 'play'; cd.classList.add('hidden'); }
      this.idle(dt, t);
      return;
    }
    if (this.state !== 'play') { this.idle(dt, t); return; }
    if (this.duration) this.time = Math.max(0, this.time - dt);
    this.step(dt, t, keys);
    // 피격 깜빡임
    if (this.player) {
      if (this.hitFlash > 0) { this.hitFlash -= dt; this.player.visible = Math.floor(this.hitFlash * 15) % 2 === 0; }
      else this.player.visible = true;
      for (const o of this.flashTargets) o.visible = this.player.visible;
    }
    if (this.state === 'play' && ((this.duration && this.time <= 0) || (this.maxHearts && this.hearts <= 0))) this.finish();
    this.renderHud();
  }

  hurt(pos, text = '아야!') {
    if (this.hitFlash > 0) return false;
    this.hearts--; this.combo = 0; this.hitFlash = 1.2;
    sfx.hurt();
    this.float(pos, text, 'bad');
    const v = $('view'); v.classList.remove('shake'); void v.offsetWidth; v.classList.add('shake');
    return true;
  }
  float(pos, text, cls = '') { this.onFloat?.(pos, text, cls, this.camera); }

  setupHud() {
    $('miniTitle').textContent = this.meta.title;
    $('miniHint').textContent = this.meta.hint;
    $('hearts').classList.toggle('hidden', !this.maxHearts);
    $('timerBox').classList.toggle('hidden', !this.duration);
  }
  renderHud() {
    if (this.maxHearts) $('hearts').innerHTML = Array.from({ length: this.maxHearts }, (_, i) => `<div class="heart ${i < this.hearts ? '' : 'off'}"></div>`).join('');
    if (this.duration) $('timerFill').style.width = `${(this.time / this.duration) * 100}%`;
    $('miniScore').textContent = this.score;
    $('miniCombo').textContent = this.extraText?.() || '';
  }

  // 도중에 나가기: 결과를 전달하지 않으므로 이번 판 보상은 반영되지 않음
  quit() {
    this.state = 'done';
    $('countdown').classList.add('hidden');
  }

  finish() {
    if (this.state === 'done') return;
    this.state = 'done';
    $('countdown').classList.add('hidden');
    sfx.end();
    this.onEnd?.({ id: this.meta.id, title: this.meta.resultTitle || '끝!', score: this.score, coins: this.coins?.() ?? this.score, rows: this.resultRows() });
  }
}

// 공통 소품
export function addFence(scene, box, x0, z0, x1, z1, color = '#8a5428') {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len));
  for (let i = 0; i <= n; i++) box(0.16, 0.8, 0.16, color, x0 + ((x1 - x0) * i) / n, 0.4, z0 + ((z1 - z0) * i) / n, scene);
  const w = Math.abs(x1 - x0) || 0.08, d = Math.abs(z1 - z0) || 0.08;
  box(w, 0.1, d, '#b5763b', (x0 + x1) / 2, 0.55, (z0 + z1) / 2, scene);
  box(w, 0.1, d, '#b5763b', (x0 + x1) / 2, 0.3, (z0 + z1) / 2, scene);
}
