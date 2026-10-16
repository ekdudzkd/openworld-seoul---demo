import * as THREE from 'three';

import { rng } from './rng.js';
export { rng };

export function canvasTexture(canvas, repeat = false) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// 16x16 픽셀 타일 그리기
export function drawTile(ctx, ox, oy, type, r) {
  const px = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(ox + x, oy + y, 1, 1); };
  const base = {
    grass: '#74b84f', sand: '#ecd89c', path: '#c9a26b', soil: '#8f5d37', bed: '#b39561', plaza: '#b9b0a0', road: '#8a8784',
  }[type];
  ctx.fillStyle = base;
  ctx.fillRect(ox, oy, 16, 16);
  if (type === 'grass') {
    for (let i = 0; i < 14; i++) px((r() * 16) | 0, (r() * 16) | 0, r() < 0.5 ? '#68a845' : '#86c75c');
    for (let i = 0; i < 3; i++) { // 풀잎
      const x = (r() * 15) | 0, y = 1 + ((r() * 14) | 0);
      px(x, y, '#5a9a3c'); px(x, y - 1, '#5a9a3c');
    }
    if (r() < 0.08) { const x = 2 + ((r() * 12) | 0), y = 2 + ((r() * 12) | 0); const c = ['#fff3a6', '#ff9fb4', '#ffffff'][(r() * 3) | 0]; px(x, y, c); px(x + 1, y, c); px(x, y + 1, c); px(x + 1, y + 1, '#e8b830'); }
  } else if (type === 'sand') {
    for (let i = 0; i < 12; i++) px((r() * 16) | 0, (r() * 16) | 0, r() < 0.6 ? '#dcc488' : '#f7e8b8');
  } else if (type === 'path') {
    for (let i = 0; i < 10; i++) px((r() * 16) | 0, (r() * 16) | 0, r() < 0.5 ? '#b88f58' : '#d9b67f');
    for (let i = 0; i < 2; i++) { const x = (r() * 14) | 0, y = (r() * 14) | 0; px(x, y, '#9e8a74'); px(x + 1, y, '#a99581'); px(x, y + 1, '#857260'); }
  } else if (type === 'soil') {
    for (let y = 2; y < 16; y += 4) for (let x = 0; x < 16; x++) px(x, y, '#7a4c2b');
    for (let i = 0; i < 8; i++) px((r() * 16) | 0, (r() * 16) | 0, '#a06c43');
  } else if (type === 'bed') {
    for (let i = 0; i < 10; i++) px((r() * 16) | 0, (r() * 16) | 0, '#a38653');
  } else if (type === 'road') {
    for (let i = 0; i < 12; i++) px((r() * 16) | 0, (r() * 16) | 0, r() < 0.5 ? '#7d7a77' : '#97948f');
    if (r() < 0.12) { const x = (r() * 13) | 0, y = (r() * 15) | 0; px(x, y, '#6e6b68'); px(x + 1, y, '#6e6b68'); px(x + 2, y + 1, '#6e6b68'); }
  } else if (type === 'plaza') {
    ctx.fillStyle = '#9d9384';
    for (let y = 0; y < 16; y += 8) ctx.fillRect(ox, oy + y, 16, 1);
    ctx.fillRect(ox + 8, oy, 1, 8); ctx.fillRect(ox + 3, oy + 8, 1, 8); ctx.fillRect(ox + 12, oy + 8, 1, 8);
  }
}

export function dirtSideTexture() {
  const [c, ctx] = makeCanvas(16, 16);
  const r = rng(7);
  ctx.fillStyle = '#8a5a35'; ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#74b84f'; ctx.fillRect(0, 0, 16, 3);
  ctx.fillStyle = '#5a9a3c'; for (let x = 0; x < 16; x += 2) ctx.fillRect(x, 3, 1, (r() * 2) | 0);
  for (let i = 0; i < 18; i++) { ctx.fillStyle = r() < 0.5 ? '#74482a' : '#a06c43'; ctx.fillRect((r() * 16) | 0, 4 + ((r() * 12) | 0), 2, 1); }
  return canvasTexture(c, true);
}

export function waterTexture() {
  const [c, ctx] = makeCanvas(32, 32);
  const r = rng(3);
  ctx.fillStyle = '#4fa8e0'; ctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 10; i++) { ctx.fillStyle = r() < 0.5 ? '#7cc6f2' : '#3d93cc'; const x = (r() * 30) | 0, y = (r() * 32) | 0; ctx.fillRect(x, y, 3 + ((r() * 3) | 0), 1); }
  for (let i = 0; i < 3; i++) { ctx.fillStyle = '#d6f1ff'; ctx.fillRect((r() * 31) | 0, (r() * 32) | 0, 2, 1); }
  return canvasTexture(c, true);
}

export function plankTexture(base = '#b5763b', dark = '#8a5428', light = '#cf9150') {
  const [c, ctx] = makeCanvas(16, 16);
  const r = rng(11);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = dark;
  for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
  for (let row = 0; row < 4; row++) ctx.fillRect(((row * 7) % 16), row * 4, 1, 3);
  ctx.fillStyle = light;
  for (let i = 0; i < 6; i++) ctx.fillRect((r() * 15) | 0, ((r() * 4) | 0) * 4, 2, 1);
  return canvasTexture(c, true);
}

export function roofTexture() {
  const [c, ctx] = makeCanvas(16, 16);
  ctx.fillStyle = '#c0443a'; ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#93302a';
  for (let y = 3; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
  for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < 16; x += 8) ctx.fillRect(x, y, 1, 3);
  ctx.fillStyle = '#d9645a';
  for (let y = 0; y < 16; y += 4) ctx.fillRect(1, y, 2, 1), ctx.fillRect(9, y, 2, 1);
  return canvasTexture(c, true);
}

export function stripeTexture(a = '#e8453a', b = '#fff4e0') {
  const [c, ctx] = makeCanvas(16, 4);
  for (let x = 0; x < 16; x++) { ctx.fillStyle = (x >> 2) % 2 ? b : a; ctx.fillRect(x, 0, 1, 4); }
  return canvasTexture(c, true);
}

// 픽셀 폰트로 쓴 표지판 텍스처
export function signTexture(text, { w = 128, h = 48, bg = '#c98a46', fg = '#3f1d0b', size = 16 } = {}) {
  const [c, ctx] = makeCanvas(w, h);
  ctx.fillStyle = '#5b2f12'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = bg; ctx.fillRect(3, 3, w - 6, h - 6);
  ctx.fillStyle = '#e0a868'; ctx.fillRect(3, 3, w - 6, 2);
  ctx.fillStyle = '#9a5f2c';
  for (let y = 14; y < h - 4; y += 12) ctx.fillRect(4, y, w - 8, 1);
  ctx.fillStyle = fg;
  ctx.font = `700 ${size}px Galmuri11`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((ln, i) => ctx.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (size + 2) + 1));
  return canvasTexture(c);
}

// ---------- 서울 건물 외벽 (16px = 1유닛, 층고 0.5유닛) ----------
export function wallTexture(kind) {
  const [c, ctx] = makeCanvas(16, 16);
  const r = rng(kind.length * 31 + 5);
  const f = (col, x, y, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };
  const P = {
    brick: ['#b4553f', '#9a4535', '#a4cfe4', '#efe3cf'],
    tan: ['#d4ad7f', '#bd956a', '#a4cfe4', '#f6eddc'],
    stucco: ['#ece3d0', '#d6ccb8', '#86b6d6', '#c9bfaa'],
  };
  if (P[kind]) { // 빌라·다세대
    const [base, mortar, glass, frame] = P[kind];
    f(base, 0, 0, 16, 16);
    if (kind !== 'stucco') for (let y = 1; y < 16; y += 3) { f(mortar, 0, y, 16, 1); for (let x = (y % 2) * 3; x < 16; x += 6) f(mortar, x, y - 1, 1, 1); }
    else for (let i = 0; i < 6; i++) f(mortar, (r() * 16) | 0, (r() * 16) | 0);
    for (const fy of [1, 9]) for (const fx of [2, 9]) { f(frame, fx, fy, 6, 5); f(glass, fx + 1, fy + 1, 4, 3); f('#e6f6ff', fx + 1, fy + 1, 1, 1); }
  } else if (kind === 'apt') { // 아파트: 층마다 베란다 띠
    f('#f2efe6', 0, 0, 16, 16);
    for (const fy of [0, 8]) {
      f('#8fb9d6', 1, fy + 2, 14, 4); f('#b9dbef', 2, fy + 2, 3, 1);
      f('#d2cec4', 0, fy + 6, 16, 2); f('#e6e2d8', 0, fy + 6, 16, 1);
    }
    f('#d8d4ca', 0, 0, 1, 16);
  } else if (kind === 'glass' || kind === 'glass2' || kind === 'glass3') {
    const [b, line, hi] = kind === 'glass' ? ['#5f92bd', '#40709a', '#a6d0ec'] : kind === 'glass2' ? ['#5fa69f', '#3f8079', '#a5dcd5'] : ['#8fa3b8', '#6b7f94', '#d0dde9'];
    f(b, 0, 0, 16, 16);
    for (let y = 0; y < 16; y += 4) f(line, 0, y, 16, 1);
    for (let x = 0; x < 16; x += 4) f(line, x, 0, 1, 16);
    for (let i = 0; i < 5; i++) { const x = (r() * 14) | 0, y = (r() * 14) | 0; f(hi, x, y, 2, 1); f(hi, x + 1, y + 1, 1, 1); }
  } else if (kind === 'hanok') { // 회벽 + 나무 기둥 + 아래 돌
    f('#f1ead9', 0, 0, 16, 16);
    f('#7a4a26', 0, 0, 2, 16); f('#7a4a26', 0, 2, 16, 1); f('#7a4a26', 8, 2, 1, 10);
    f('#c9a46a', 3, 5, 4, 5); f('#a07a45', 3, 7, 4, 1); f('#c9a46a', 10, 5, 4, 5); f('#a07a45', 10, 7, 4, 1);
    f('#a69f92', 0, 12, 16, 4); f('#8f887c', 0, 12, 16, 1); for (let x = 2; x < 16; x += 5) f('#8f887c', x, 13, 1, 3);
  } else if (kind === 'stone') {
    f('#c9c1b2', 0, 0, 16, 16);
    for (let y = 3; y < 16; y += 4) f('#b1a999', 0, y, 16, 1);
    for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 2 : 6; x < 16; x += 8) f('#b1a999', x, y, 1, 3);
    f('#4d5966', 5, 5, 2, 6); f('#4d5966', 11, 5, 2, 6);
  }
  return canvasTexture(c, true);
}

// 한옥 기와
export function giwaTexture() {
  const [c, ctx] = makeCanvas(16, 16);
  ctx.fillStyle = '#4e545e'; ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#3b4048'; for (let x = 0; x < 16; x += 4) ctx.fillRect(x, 0, 1, 16);
  ctx.fillStyle = '#656c78'; for (let x = 2; x < 16; x += 4) ctx.fillRect(x, 0, 1, 16);
  ctx.fillStyle = '#3b4048'; for (let y = 5; y < 16; y += 6) ctx.fillRect(0, y, 16, 1);
  return canvasTexture(c, true);
}
