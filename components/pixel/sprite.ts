/** 머리가 큰 2등신 도트 선수. 외형·유니폼·시상식 의상을 같은 격자로 그린다. */
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES } from '@/data/appearance';
import type { Appearance, KitColors } from '@/types/game';

export const SPRITE_WIDTH = 24;
export const SPRITE_HEIGHT = 32;
export type SpriteOutfit = 'KIT' | 'TUXEDO';
export type SpriteTrophy = 'BALLON_DOR' | 'FIFA_BEST';
type Grid = string[][];
export interface SpriteOptions { outfit?: SpriteOutfit; trophy?: SpriteTrophy | null; ball?: boolean }
function span(g: Grid, y: number, x0: number, x1: number, ch: string) {
  for (let x = x0; x <= x1; x++) g[y][x] = ch;
}

export function spriteGrid({ outfit = 'KIT', trophy = null, ball = false }: SpriteOptions = {}): string[] {
  const g: Grid = Array.from({ length: SPRITE_HEIGHT }, () => Array<string>(SPRITE_WIDTH).fill('.'));
  // 둥근 사각형 실루엣, 넓은 얼굴과 단순한 옆가르마.
  span(g, 1, 7, 16, 'h');
  span(g, 2, 5, 18, 'h');
  for (let y = 3; y <= 7; y++) span(g, y, 4, 19, 'h');
  span(g, 2, 7, 15, 'H');
  for (let y = 8; y <= 14; y++) {
    span(g, y, 4, 19, 's');
    g[y][4] = 'h'; g[y][19] = 'y';
  }
  span(g, 7, 10, 17, 's');
  span(g, 8, 8, 18, 's');
  span(g, 9, 6, 18, 's');
  g[8][9] = 'h'; g[9][8] = 'h';
  for (let y = 10; y <= 12; y++) { g[y][8] = 'e'; g[y][15] = 'e'; }
  g[10][8] = 'E'; g[10][15] = 'E';
  span(g, 12, 3, 4, 's'); span(g, 12, 19, 20, 'S');
  span(g, 13, 3, 4, 's'); span(g, 13, 19, 20, 'S');
  g[14][6] = 'r'; g[14][17] = 'r';
  span(g, 15, 5, 18, 's');
  span(g, 16, 6, 17, 's');
  span(g, 17, 7, 16, 'S');
  span(g, 18, 9, 14, 's');
  span(g, 19, 10, 13, 'S');
  const tux = outfit === 'TUXEDO';
  for (let y = 20; y <= 25; y++) span(g, y, 6, 17, tux ? 'T' : 'j');
  span(g, 20, 9, 14, tux ? 'W' : 'c');
  for (let y = 21; y <= 24; y++) {
    span(g, y, 4, 5, tux ? 'T' : 'a'); span(g, y, 18, 19, tux ? 'Y' : 'A');
    g[y][17] = tux ? 'Y' : 'J';
  }
  if (tux) {
    for (let y = 21; y <= 24; y++) span(g, y, 11, 12, 'W');
    span(g, 21, 10, 13, 'x');
    g[23][12] = 'z'; g[25][12] = 'z';
  } else { span(g, 21, 10, 13, 'j'); g[22][7] = 'u'; }
  span(g, 25, 4, 5, 's'); span(g, 25, 18, 19, 'S');
  span(g, 26, 5, 6, 's'); span(g, 26, 17, 18, 'S');
  for (let y = 26; y <= 27; y++) span(g, y, 7, 16, tux ? 'P' : 'p');
  span(g, 28, 8, 10, tux ? 'P' : 'k'); span(g, 28, 13, 15, tux ? 'R' : 'K');
  span(g, 29, 7, 10, tux ? 'Q' : 'b'); span(g, 29, 13, 16, tux ? 'Q' : 'b');
  if (ball && !trophy && !tux) {
    span(g, 27, 20, 21, 'O'); span(g, 28, 19, 22, 'O');
    span(g, 29, 19, 22, 'O'); span(g, 30, 20, 21, 'O');
    g[28][20] = 'f'; g[29][22] = 'f';
  }
  if (trophy) {
    if (trophy === 'BALLON_DOR') {
      span(g, 20, 20, 21, 'G'); span(g, 21, 19, 22, 'g'); span(g, 22, 19, 22, 'g'); span(g, 23, 20, 21, 'D');
    } else {
      span(g, 19, 20, 21, 'G'); span(g, 20, 20, 21, 'g'); span(g, 21, 19, 22, 'g'); span(g, 22, 20, 21, 'g'); span(g, 23, 20, 21, 'D');
    }
    span(g, 24, 20, 21, 'g'); span(g, 25, 19, 22, 'N');
    span(g, 24, 18, 19, 's');
  }
  // 한 픽셀의 짙은 외곽선. 기존 칠한 픽셀은 덮지 않는다.
  const rows = g.map((row) => [...row]);
  for (let y = 0; y < SPRITE_HEIGHT - 1; y++) for (let x = 0; x < SPRITE_WIDTH; x++) {
    if (g[y][x] === '.') continue;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < SPRITE_WIDTH && yy >= 0 && yy < SPRITE_HEIGHT - 1 && g[yy][xx] === '.') rows[yy][xx] = 'o';
    }
  }
  span(rows, SPRITE_HEIGHT - 1, 5, 18, '_');
  return rows.map((row) => row.join(''));
}

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/** amount > 0 이면 흰색 쪽으로, < 0 이면 검은색 쪽으로 섞는다 */
export function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  return toHex(rgb.map((v) => v + (target - v) * t));
}

/** 상대 밝기 0~1 */
export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0.5;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 유니폼 한 벌의 색. DB에는 상의 제1색 · 줄무늬 제2색만 있으므로
 * 반바지 · 양말은 선택 필드(shorts · socks)가 없으면 상의 색에서 만든다.
 * - 줄무늬: 두 색 중 어두운 쪽 반바지
 * - 단색: 밝은 상의(흰색 · 노랑)는 짙은 반바지, 그 밖은 흰 반바지
 */
export function kitPalette(kit: KitColors) {
  const primary = kit.primary;
  const stripe = kit.secondary;
  const light = luminance(primary) > 0.55;
  const darker = stripe && luminance(stripe) < luminance(primary) ? stripe : primary;
  const shorts = kit.shorts ?? (stripe ? shade(darker, -0.1) : light ? '#1F2430' : '#F2F4F7');
  const socks = kit.socks ?? primary;
  const trim = light ? shade(primary, -0.6) : '#F4F4F5';
  return { primary, stripe, shorts, socks, trim };
}

const DEFAULT_KIT: KitColors = { primary: '#64748B', secondary: null };
/** 상의 몸통(7~16열)의 줄무늬 열: 2칸씩 primary · secondary · primary · secondary · primary */
const STRIPE_COLUMNS = new Set([9, 10, 13, 14]);

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  fill: string;
}

export function buildSprite(options: { appearance: Appearance; kit?: KitColors | null } & SpriteOptions): SpriteRect[] {
  const { appearance } = options;
  const kit = kitPalette(options.kit ?? DEFAULT_KIT);
  const skin = SKIN_TONES[appearance.skin].color;
  const hair = HAIR_COLORS[appearance.hair].color;
  const eyes = EYE_COLORS[appearance.eyes].color;
  const darkHair = appearance.hair === 'BLACK';

  const palette: Record<string, string> = {
    o: '#111D27',
    h: hair,
    H: shade(hair, darkHair ? 0.2 : 0.28),
    y: shade(hair, darkHair ? -0.35 : -0.3),
    s: skin,
    S: shade(skin, -0.18),
    r: mixRed(skin),
    m: shade(skin, -0.3),
    E: '#16100D',
    w: '#FFFFFF',
    e: eyes === EYE_COLORS.DARK_BROWN.color ? '#3A2416' : eyes,
    j: kit.primary,
    J: shade(kit.primary, -0.22),
    u: shade(kit.primary, 0.25),
    a: kit.primary,
    A: shade(kit.primary, -0.22),
    c: kit.trim,
    p: kit.shorts,
    q: shade(kit.shorts, -0.15),
    k: kit.socks,
    K: shade(kit.socks, -0.22),
    b: '#1E1E26',
    v: '#5A5A68',
    B: '#E6E6EC',
    O: '#FAFAFA',
    f: '#1F2433',
    T: '#1C1C28',
    Y: '#101018',
    L: '#3A3A4E',
    W: '#F4F4F5',
    x: '#08080C',
    z: '#0A0A0E',
    P: '#181822',
    R: '#0E0E14',
    Q: '#0A0A0E',
    Z: '#6E7282',
    g: '#F5B82E',
    G: '#FFF1A8',
    D: '#B7791F',
    N: '#3A2F52',
    _: 'rgba(0,0,0,0.35)',
  };

  const colorAt = (ch: string, x: number): string | null => {
    if (ch === '.') return null;
    if (kit.stripe && STRIPE_COLUMNS.has(x)) {
      if (ch === 'j' || ch === 'u') return kit.stripe;
      if (ch === 'J') return shade(kit.stripe, -0.22);
    }
    return palette[ch] ?? null;
  };

  const rects: SpriteRect[] = [];
  spriteGrid(options).forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const color = colorAt(row[x], x);
      if (!color) {
        x++;
        continue;
      }
      let w = 1;
      while (x + w < row.length && colorAt(row[x + w], x + w) === color) w++;
      rects.push({ x, y, w, fill: color });
      x += w;
    }
  });
  return rects;
}

/** 볼터치: 피부색에 붉은 기를 섞는다 */
function mixRed(skin: string): string {
  const rgb = parseHex(skin);
  if (!rgb) return skin;
  return toHex([rgb[0] * 0.75 + 232 * 0.25, rgb[1] * 0.75 + 120 * 0.25, rgb[2] * 0.75 + 110 * 0.25]);
}
