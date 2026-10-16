import * as THREE from 'three';
import { box, makeTree } from '../world.js';
import { Avatar } from '../character.js';
import { rng, signTexture } from '../textures.js';
import { sfx } from '../sfx.js';
import { MiniGame } from './base.js';
import { npcSkin, HAIRS, TONES } from './npc.js';

const $ = (id) => document.getElementById(id);
// 동작 4가지 (방향키/WASD)
const MOVES = [
  { id: 'jump', name: '점프', icon: '⬆️', keys: ['ArrowUp', 'KeyW'], note: 784 },
  { id: 'wave', name: '손 흔들기', icon: '🙋', keys: ['ArrowLeft', 'KeyA'], note: 587 },
  { id: 'clap', name: '박수', icon: '👏', keys: ['ArrowRight', 'KeyD'], note: 659 },
  { id: 'spin', name: '빙글', icon: '🌀', keys: ['ArrowDown', 'KeyS'], note: 523 },
];
const BPM = 100, BEAT = 60 / BPM;
const WINDOW = 0.24, PERFECT = 0.1; // 박자 판정 (초)
// 퍼레이드 참가자 망토 색 (여러 나라 국기 색에서 따온 줄무늬)
const CAPES = [['#0055a4', '#ffffff', '#ef4135'], ['#009c3b', '#ffdf00', '#002776'], ['#000000', '#dd0000', '#ffce00'], ['#ff9933', '#ffffff', '#138808'],
  ['#c60b1e', '#ffc400', '#c60b1e'], ['#ffffff', '#cd2e3a', '#0047a0'], ['#007a4d', '#ffb612', '#de3831'], ['#d52b1e', '#ffffff', '#d52b1e']];

// 사람 동작 애니메이션 (아바타 공통)
function perform(st, av, dt, t) {
  const r = av.root;
  st.t += dt;
  const k = Math.min(1, st.t / (BEAT * 0.9));
  const m = st.move;
  r.position.y = st.baseY + (m === 'jump' ? Math.sin(Math.PI * k) * 0.9 : 0);
  if (m === 'spin') r.rotation.y = st.yaw + k * Math.PI * 2; else r.rotation.y += (st.yaw - r.rotation.y) * Math.min(1, dt * 10);
  av.animate(dt, t, {
    air: m === 'jump' && k < 1,
    wave: m === 'wave' && k < 1,
    armsUp: m === 'clap' && k < 1 && Math.floor(st.t / (BEAT / 4)) % 2 === 0,
    moving: !m || k >= 1 ? st.march : false,
  });
  if (k >= 1) st.move = null;
}
const doMove = (st, move) => { st.move = move; st.t = 0; };

// 이태원 지구촌 축제 퍼레이드: 앞사람이 보여 준 동작을 박자에 맞춰 똑같이 따라 하기
export class ParadeGame extends MiniGame {
  static meta = {
    id: 'parade', title: '지구촌 축제 퍼레이드', duration: 75, hearts: 3, resultTitle: '퍼레이드 끝!', fov: 46, sky: '#9fd8f5',
    hint: '↑/W 점프 · ←/A 손 흔들기 · →/D 박수 · ↓/S 빙글 — 대장이 보여 준 동작을 "내 차례"에 박자 맞춰 그대로!',
  };

  build() {
    const s = this.scene;
    this.lights({ pos: [-6, 14, 10], size: 16 });
    this.tileGround(34, 16, (x, y) => (y >= 5 && y <= 10 ? 'path' : 'grass'), 61).position.z = -1;
    // 길가 가게들 + 만국기 줄
    const r = rng(22), flagC = ['#e8413a', '#ffd23f', '#2f7fd8', '#5fc04a', '#ffffff', '#9b5de5', '#f28c28'];
    for (let i = 0; i < 9; i++) {
      const x = -16 + i * 4, h = 2.4 + r() * 1.5;
      box(3.6, h, 2.4, ['#f4a6c0', '#7fc8f0', '#ffd23f', '#a5e07f', '#ff9e7a', '#c39bf0'][i % 6], x, h / 2, -6.2, s);
      box(3.0, 1.0, 0.06, '#bfe6fa', x, 0.8, -4.98, s);
    }
    for (let i = 0; i < 40; i++) { const f = box(0.3, 0.34, 0.02, flagC[i % flagC.length], -16 + i * 0.82, 3.3 - Math.abs(Math.sin(i * 0.4)) * 0.3, -3.5, s); f.castShadow = false; }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(7, 0.8, 0.1), new THREE.MeshLambertMaterial({ map: signTexture('이태원 지구촌 축제', { w: 160, h: 20, size: 13, bg: '#2f7fd8', fg: '#ffffff' }) }));
    banner.position.set(0, 4.1, -3.5); s.add(banner);
    for (const x of [-3.6, 3.6]) box(0.2, 4.4, 0.2, '#f4ead8', x, 2.2, -3.5, s);
    for (let i = 0; i < 10; i++) { const t = makeTree(r, 'round'); t.position.set(-17 + i * 3.8, 0, -8.6 - r()); t.scale.setScalar(1.3); s.add(t); } // 가게 뒤쪽 (화면을 가리지 않게)
    // 퍼레이드 줄: 대장(가운데 앞) + 양옆 춤꾼들
    const mkDancer = (i, x, z, lead = false) => {
      const sk = npcSkin({ shirt: lead ? '#ffd23f' : CAPES[i % CAPES.length][1], pants: '#3a3f4a', hair: HAIRS[(i * 3) % HAIRS.length], skin: TONES[(i * 5) % TONES.length] });
      const av = new Avatar(sk, { height: lead ? 1.8 : 1.55 });
      // 망토 (국기 색 세 줄)
      const cape = CAPES[i % CAPES.length];
      cape.forEach((c, j) => box(0.4, 0.75 / 3, 0.04, c, 0, 0.95 - j * 0.25, -0.23, av.torso));
      if (lead) { box(0.06, 0.9, 0.06, '#8a5428', 0, -0.4, 0.12, av.joints.armR); box(0.5, 0.32, 0.03, '#e8413a', 0.25, 0.05, 0.12, av.joints.armR); }
      av.root.position.set(x, 0, z); s.add(av.root);
      return { av, st: { move: null, t: 0, baseY: 0, yaw: 0, march: true } };
    };
    this.leader = mkDancer(0, 0, -1.4, true);
    this.dancers = [[-3.2, -0.6], [3.2, -0.6], [-5.6, 0.4], [5.6, 0.4], [-1.9, 1.5], [4.4, 1.7]].map(([x, z], i) => mkDancer(i + 1, x, z));
    this.camera.position.set(0, 3.4, 8.2);
    this.camera.lookAt(0, 1.2, -0.5);
  }

  onAvatar() { this.player.position.set(1.4, 0, 1.9); this.me = { av: this.avatar, st: { move: null, t: 0, baseY: 0, yaw: 0, march: true } }; }

  reset() {
    this.round = 0; this.cleared = 0; this.perfects = 0; this.goods = 0; this.misses = 0;
    this.songT = 0; this.lastBeat = -1;
    this.player.position.set(1.4, 0, 1.9); // 대장을 가리지 않게 살짝 옆
    this.overlay();
    this.newRound(1);
  }
  overlay() {
    const o = $('miniOverlay');
    const tr = document.createElement('div'); tr.className = 'parade-track'; o.appendChild(tr); this.trackEl = tr;
    const ph = document.createElement('div'); ph.className = 'parade-phase'; o.appendChild(ph); this.phaseEl = ph;
    const keys = document.createElement('div'); keys.className = 'parade-keys';
    keys.innerHTML = MOVES.map((m, i) => `<div><b>${['↑', '←', '→', '↓'][i]}</b>${m.icon} ${m.name}</div>`).join('');
    o.appendChild(keys);
  }

  // 한 판: [준비 1박] → [대장 시범 n박] → [쉼 1박] → [내 차례 n박]
  newRound(startBeat) {
    this.round++;
    const n = Math.min(7, 2 + Math.floor((this.round - 1) / 2));
    const seq = [];
    for (let i = 0; i < n; i++) { let m; do m = (Math.random() * 4) | 0; while (i > 0 && m === seq[i - 1] && Math.random() < 0.6); seq.push(m); }
    this.seq = seq; this.n = n;
    this.callStart = startBeat + 1; this.respStart = this.callStart + n + 1; this.roundEnd = this.respStart + n;
    this.inputs = new Array(n).fill(null); // 박자별 판정 결과
    this.trackEl.innerHTML = seq.map((m, i) => `<span data-i="${i}" class="slot"><i>${MOVES[m].icon}</i></span>`).join('');
    this.slots = [...this.trackEl.querySelectorAll('.slot')];
  }

  keyDown(code) {
    const m = MOVES.findIndex((x) => x.keys.includes(code));
    if (m < 0 || this.state !== 'play') return;
    doMove(this.me.st, MOVES[m].id);
    const b = this.songT / BEAT;
    const i = Math.round(b) - this.respStart;
    if (i < 0 || i >= this.n) { this.float(this.player.position.clone().add(new THREE.Vector3(0, 2.4, 0)), '아직 대장 차례!', 'bad'); return; }
    if (this.inputs[i]) return;
    const off = Math.abs(b - Math.round(b)) * BEAT;
    if (off > WINDOW) return;
    const ok = m === this.seq[i];
    this.inputs[i] = ok ? (off < PERFECT ? 'perfect' : 'good') : 'wrong';
    const slot = this.slots[i]; slot.classList.add(ok ? 'ok' : 'bad');
    const pos = this.player.position.clone().add(new THREE.Vector3(0, 2.4, 0));
    if (ok) {
      this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo);
      const perf = off < PERFECT; perf ? this.perfects++ : this.goods++;
      this.score += (perf ? 4 : 2) + Math.floor(Math.min(this.combo, 10) / 2);
      sfx.note(MOVES[m].note, 0.18, 'square', 0.06);
      this.float(pos, perf ? '완벽!' : '좋아요!', 'gold');
      for (const d of this.dancers) doMove(d.st, MOVES[m].id); // 다 같이 따라 함
    } else { this.misses++; this.combo = 0; this.hurt(pos, `${MOVES[this.seq[i]].name}였어요!`); }
  }

  idle(dt, t) {
    for (const c of [this.leader, ...this.dancers, this.me]) { c.st.march = this.state === 'done' ? false : true; perform(c.st, c.av, dt, t); }
    if (this.state === 'done') this.me.av.animate(dt, t, { wave: true });
  }

  step(dt, t) {
    this.songT += dt;
    const b = Math.floor(this.songT / BEAT + 0.0001);
    if (b !== this.lastBeat) {
      this.lastBeat = b;
      sfx.drum('kick'); setTimeout(() => sfx.drum('hat'), BEAT * 500);
      if (b >= this.callStart && b < this.callStart + this.n) {
        const i = b - this.callStart, m = this.seq[i];
        doMove(this.leader.st, MOVES[m].id); sfx.note(MOVES[m].note, 0.18, 'triangle', 0.07);
        this.slots[i].classList.add('show');
      }
      if (b === this.respStart - 1) for (const s of this.slots) s.classList.add('dim'); // 내 차례 전: 아이콘 흐리게 (외워서!)
      // 지나간 박자에 입력이 없으면 놓침
      const missI = b - this.respStart - 1;
      if (missI >= 0 && missI < this.n && !this.inputs[missI]) {
        this.inputs[missI] = 'miss'; this.slots[missI].classList.add('bad'); this.misses++; this.combo = 0;
        this.hurt(this.player.position.clone().add(new THREE.Vector3(0, 2.4, 0)), `${MOVES[this.seq[missI]].name}!`);
      }
      if (b >= this.roundEnd + 1) {
        const all = this.inputs.every((x) => x === 'perfect' || x === 'good');
        if (all) { this.cleared++; const bonus = this.n * 2; this.score += bonus; sfx.gold(); this.float(new THREE.Vector3(0, 3.5, -1), `${this.n}동작 성공! +${bonus}`, 'gold'); }
        this.newRound(b);
      }
    }
    // 단계 안내
    const bf = this.songT / BEAT;
    const ph = bf < this.callStart ? '준비…' : bf < this.respStart - 0.5 ? '👀 대장을 잘 봐요!' : bf < this.roundEnd - 0.5 ? '🕺 내 차례! 따라 해요' : '👏';
    this.phaseEl.textContent = ph;
    this.phaseEl.classList.toggle('mine', ph.includes('내 차례'));
    // 내 차례 박자 표시
    const cur = Math.round(bf) - this.respStart;
    this.slots.forEach((s, i) => s.classList.toggle('now', i === cur && bf > this.respStart - 0.5));
    for (const c of [this.leader, ...this.dancers, this.me]) perform(c.st, c.av, dt, t);
  }

  extraText() { return `${this.round}번째 · 콤보 ${this.combo}`; }
  resultRows() { return [['성공한 판', `${this.cleared}판`], ['완벽 / 좋아요', `${this.perfects} / ${this.goods}`], ['틀림·놓침', `${this.misses}번`], ['최대 콤보', `${this.maxCombo}`]]; }
}
