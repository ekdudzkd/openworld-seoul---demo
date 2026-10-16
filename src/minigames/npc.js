import { basicSkin, PART_KEYS, FACES } from '../character.js';

// 기본 스킨의 색만 바꿔서 NPC(팀원·상대·경주 참가자) 스킨을 만든다
const BASE = { hair: '#3b2416', shirt: '#f7f3ea', pants: '#4f6fae', shoe: '#ffffff', skin: '#f2c29b' };
export function npcSkin({ shirt, pants = '#3a3f4a', hair = BASE.hair, shoe = '#ffffff', skin = BASE.skin, number = null } = {}) {
  const s = basicSkin();
  const map = { [BASE.hair]: hair, [BASE.shirt]: shirt, [BASE.pants]: pants, [BASE.shoe]: shoe, [BASE.skin]: skin };
  for (const p of PART_KEYS) for (const f of FACES) s[p][f] = s[p][f].map((c) => map[c] ?? c);
  // 등번호 (몸 뒤 8×7 면에 세로 막대 2줄)
  if (number) for (let r = 1; r < 6; r++) { s.body.back[r * 8 + 3] = number; s.body.back[r * 8 + 4] = number; }
  return s;
}

export const HAIRS = ['#3b2416', '#1e1a18', '#7a4a26', '#c98a46', '#5a3a2a', '#2a2420'];
export const TONES = ['#f2c29b', '#e8b48a', '#d9a273', '#f6d0ae'];
