/**
 * 3등신 도트 캐릭터 (24 × 43 픽셀, 마지막 줄은 그림자)
 *
 * 부위(머리카락 · 얼굴 · 유니폼 · 다리 …)를 문자로 칠한 뒤 바깥 테두리를 자동으로 두른다.
 * 색은 외형(피부 · 머리 · 눈동자)과 유니폼(kitColors)에서 정하고, 같은 색이 가로로 이어지면 사각형 하나로 합친다.
 * React와 무관한 순수 함수라 테스트·미리보기 스크립트에서도 쓴다.
 */
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES } from '@/data/appearance';
import type { Appearance, KitColors } from '@/types/game';

export const SPRITE_WIDTH = 24;
export const SPRITE_HEIGHT = 43;

export type SpriteOutfit = 'KIT' | 'TUXEDO';
export type SpriteTrophy = 'BALLON_DOR' | 'FIFA_BEST';

/*
 * 칠하는 문자
 *  o 외곽선   h 머리   H 머리 하이라이트   y 머리 그늘   s 피부   S 피부 그늘   r 볼   m 입
 *  E 윗눈꺼풀   w 눈 반짝임   e 눈동자
 *  j 상의   J 상의 그늘   u 상의 하이라이트   a 소매   A 소매 그늘   c 칼라 · 양말 윗단
 *  p 반바지   q 반바지 그늘   k 양말   K 양말 그늘   b 축구화   v 축구화 광택   B 밑창   O 공   f 공 무늬
 *  T 재킷   Y 재킷 그늘   L 라펠   W 셔츠   x 나비넥타이   z 단추 · 구두 밑창   P 바지   R 바지 그늘   Q 구두   Z 구두 광택
 *  g 금   G 금 하이라이트   D 금 그늘   N 받침대   _ 그림자
 */

type Grid = string[][];
const H_PAINT = SPRITE_HEIGHT; // 칠할 때는 맨 위 한 줄을 비워 두고(머리 위 외곽선 자리), 마지막에 한 칸 내린다

function canvas(): Grid {
  return Array.from({ length: H_PAINT }, () => Array<string>(SPRITE_WIDTH).fill('.'));
}
function span(g: Grid, y: number, x0: number, x1: number, ch: string) {
  for (let x = x0; x <= x1; x++) g[y][x] = ch;
}
function put(g: Grid, y: number, xs: number[], ch: string) {
  for (const x of xs) g[y][x] = ch;
}

function paintHead(g: Grid) {
  // 머리카락: 정수리 삐침 + 둥근 실루엣 + 옆 삐침
  put(g, 0, [11, 12], 'h');
  span(g, 1, 8, 15, 'h');
  span(g, 2, 6, 17, 'h');
  for (let y = 3; y <= 6; y++) span(g, y, 5, 18, 'h');
  put(g, 4, [4], 'h');
  put(g, 5, [4], 'h');
  put(g, 4, [19], 'y');
  put(g, 5, [19], 'y');
  put(g, 1, [9], 'H');
  put(g, 2, [8, 9, 10], 'H');
  put(g, 3, [7, 8], 'H');
  put(g, 4, [6], 'H');
  put(g, 2, [16, 17], 'y');
  put(g, 3, [17, 18], 'y');
  for (const y of [4, 5, 6]) put(g, y, [18], 'y');
  // 앞머리 (아래로 뾰족)
  put(g, 6, [7, 8, 11, 12, 15, 16], 's');
  // 얼굴
  for (const y of [7, 8, 9]) {
    span(g, y, 6, 17, 's');
    put(g, y, [5], 'h');
    put(g, y, [18], 'y');
  }
  put(g, 7, [10], 'h');
  put(g, 8, [4], 's');
  put(g, 9, [4], 's');
  put(g, 8, [19], 'S');
  put(g, 9, [19], 'S');
  span(g, 10, 5, 18, 's');
  span(g, 11, 6, 17, 's');
  span(g, 12, 7, 16, 's');
  span(g, 13, 9, 14, 's');
  put(g, 10, [18], 'S');
  put(g, 11, [17], 'S');
  put(g, 12, [16], 'S');
  put(g, 13, [14], 'S');
  // 눈 (2 × 3): 윗눈꺼풀 · 반짝임 · 눈동자
  put(g, 8, [8, 9, 14, 15], 'E');
  put(g, 9, [8, 14], 'w');
  put(g, 9, [9, 15], 'e');
  put(g, 10, [8, 9, 14, 15], 'e');
  // 볼 · 입
  put(g, 11, [7, 16], 'r');
  put(g, 12, [11, 12], 'm');
}

function paintKitBody(g: Grid, ball: boolean) {
  span(g, 14, 10, 13, 'S'); // 목
  span(g, 15, 7, 16, 'j');
  put(g, 15, [9, 14], 'c');
  put(g, 15, [10, 11, 12, 13], 'S');
  span(g, 16, 5, 18, 'j');
  put(g, 16, [10, 13], 'c');
  put(g, 16, [11, 12], 'S');
  put(g, 16, [5, 6, 17, 18], 'a');
  // 몸통 7~16 · 팔 3~5 / 18~20 (사이 한 칸은 외곽선)
  for (let y = 17; y <= 24; y++) {
    span(g, y, 7, 16, 'j');
    put(g, y, [15, 16], 'J');
  }
  put(g, 17, [11, 12], 'c');
  put(g, 17, [7, 8], 'u');
  put(g, 18, [7], 'u');
  for (const y of [17, 18, 19]) {
    put(g, y, [4, 5, 18], 'a');
    put(g, y, [19], 'A');
  }
  for (const y of [20, 21]) {
    put(g, y, [4, 5, 18], 's');
    put(g, y, [19], 'S');
  }
  for (const y of [22, 23]) {
    put(g, y, [3, 4, 5, 18, 19], 's');
    put(g, y, [20], 'S');
  }
  span(g, 24, 7, 16, 'J');
  // 반바지
  for (const y of [25, 26, 27]) {
    span(g, y, 6, 17, 'p');
    put(g, y, [16, 17], 'q');
  }
  for (const y of [28, 29]) {
    span(g, y, 6, 10, 'p');
    span(g, y, 13, 17, 'p');
    put(g, y, [10, 16, 17], 'q');
  }
  span(g, 29, 6, 10, 'q');
  span(g, 29, 13, 17, 'q');
  // 무릎 · 양말 · 축구화
  for (const y of [30, 31]) {
    span(g, y, 7, 9, 's');
    span(g, y, 14, 16, 's');
    put(g, y, [9, 16], 'S');
  }
  span(g, 32, 7, 9, 'c');
  span(g, 32, 14, 16, 'c');
  for (let y = 33; y <= 36; y++) {
    span(g, y, 7, 9, 'k');
    span(g, y, 14, 16, 'k');
    put(g, y, [9, 16], 'K');
  }
  span(g, 37, 6, 9, 'b');
  span(g, 37, 14, 17, 'b');
  span(g, 38, 5, 9, 'b');
  span(g, 38, 14, 18, 'b');
  put(g, 37, [7, 15], 'v');
  span(g, 39, 5, 9, 'B');
  span(g, 39, 14, 18, 'B');
  if (ball) {
    // 오른발 옆 공 (6 × 6): 오각형 하나 + 가장자리 무늬
    const ballRows = ['.OOfO.', 'OOOOOf', 'OffOOO', 'OffOOO', 'OOOOfO', '.fOOO.'];
    ballRows.forEach((row, i) => row.split('').forEach((ch, j) => ch !== '.' && put(g, 33 + i, [18 + j], ch)));
    // 공에 닿는 오른발 앞코는 줄인다
    put(g, 37, [17], 'b');
    g[38][18] = '.';
    g[39][18] = '.';
  }
}

function paintTuxedoBody(g: Grid) {
  span(g, 14, 10, 13, 'S');
  span(g, 15, 7, 16, 'T');
  put(g, 15, [9, 14], 'W');
  put(g, 15, [10, 11, 12, 13], 'x');
  span(g, 16, 5, 18, 'T');
  put(g, 16, [9, 14], 'L');
  put(g, 16, [10, 11, 12, 13], 'W');
  for (let y = 17; y <= 24; y++) {
    span(g, y, 7, 16, 'T');
    put(g, y, [15, 16], 'Y');
  }
  put(g, 17, [9, 14], 'L');
  put(g, 17, [10, 11, 12, 13], 'W');
  put(g, 18, [10, 13], 'L');
  put(g, 18, [11, 12], 'W');
  put(g, 19, [11, 12], 'W');
  put(g, 20, [11], 'z');
  put(g, 22, [11], 'z');
  for (const y of [17, 18, 19, 20]) {
    put(g, y, [4, 5, 18], 'T');
    put(g, y, [19], 'Y');
  }
  put(g, 21, [4, 5, 18, 19], 'W'); // 셔츠 소맷부리
  for (const y of [22, 23]) {
    put(g, y, [3, 4, 5, 18, 19], 's');
    put(g, y, [20], 'S');
  }
  span(g, 24, 7, 16, 'Y');
  for (const y of [25, 26, 27]) {
    span(g, y, 6, 17, 'P');
    put(g, y, [16, 17], 'R');
  }
  for (let y = 28; y <= 36; y++) {
    span(g, y, 7, 10, 'P');
    span(g, y, 13, 16, 'P');
    put(g, y, [10, 16], 'R');
  }
  span(g, 37, 6, 10, 'Q');
  span(g, 37, 13, 17, 'Q');
  span(g, 38, 5, 10, 'Q');
  span(g, 38, 13, 18, 'Q');
  put(g, 37, [7, 15], 'Z');
  span(g, 39, 5, 10, 'z');
  span(g, 39, 13, 18, 'z');
}

type Cells = Map<string, string>;
const key = (x: number, y: number) => `${x},${y}`;

/** 트로피 (칠할 때 좌표, 한 칸 내리기 전) */
function trophyCells(kind: SpriteTrophy): Cells {
  const cells: Cells = new Map();
  const fill = (rows: Record<number, [number, number]>, ch: string) => {
    for (const [y, [x0, x1]] of Object.entries(rows)) for (let x = x0; x <= x1; x++) cells.set(key(x, Number(y)), ch);
  };
  const mark = (points: Array<[number, number]>, ch: string) => points.forEach(([x, y]) => cells.set(key(x, y), ch));
  if (kind === 'BALLON_DOR') {
    fill({ 16: [10, 13], 17: [9, 14], 18: [8, 15], 19: [8, 15], 20: [8, 15], 21: [9, 14], 22: [10, 13] }, 'g');
    mark([[10, 17], [9, 18], [10, 18], [9, 19]], 'G');
    mark([[14, 19], [15, 19], [14, 20], [15, 20], [13, 21], [14, 21], [12, 22], [13, 22]], 'D');
    fill({ 23: [10, 13], 24: [9, 14] }, 'N');
  } else {
    fill({ 15: [8, 15], 16: [8, 15], 17: [9, 14], 18: [10, 13], 19: [11, 12], 20: [11, 12], 21: [11, 12] }, 'g');
    mark([[9, 15], [9, 16], [10, 16], [10, 17], [11, 18], [11, 19]], 'G');
    mark([[15, 15], [15, 16], [14, 16], [14, 17], [13, 18], [12, 19], [12, 20], [12, 21]], 'D');
    fill({ 22: [10, 13], 23: [9, 14], 24: [9, 14] }, 'N');
  }
  return cells;
}

/** 트로피를 받치는 팔: 소매 끝에서 안쪽으로 굽힌 팔뚝과 손 */
function holdingArmCells(outfit: SpriteOutfit): Cells {
  const [sleeve, shadeCh] = outfit === 'KIT' ? ['a', 'A'] : ['T', 'Y'];
  const entries: Array<[number, number, string]> = [
    [4, 20, sleeve], [5, 20, sleeve], [5, 21, sleeve], [6, 21, 's'], [7, 21, 's'], [7, 20, 's'],
    [19, 20, shadeCh], [18, 20, sleeve], [18, 21, sleeve], [17, 21, 's'], [16, 21, 'S'], [16, 20, 's'],
  ];
  return new Map(entries.map(([x, y, ch]) => [key(x, y), ch]));
}

const NEIGHBORS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** 빈칸 중 칠한 칸과 맞닿은 곳에 외곽선 */
function autoOutline(g: Grid): Grid {
  return g.map((row, y) =>
    row.map((ch, x) => {
      if (ch !== '.') return ch;
      const touches = NEIGHBORS.some(([dx, dy]) => {
        const v = g[y + dy]?.[x + dx];
        return v !== undefined && v !== '.' && v !== '_';
      });
      return touches ? 'o' : '.';
    }),
  );
}

/** 이미 칠한 그림 위에 덮어 그린다 (둘레 외곽선 포함, keep이 참인 칸은 외곽선으로 덮지 않음) */
function overlay(g: Grid, cells: Cells, dy: number, keep: (x: number, y: number) => boolean = () => false) {
  const shifted = new Map([...cells].map(([k, ch]) => {
    const [x, y] = k.split(',').map(Number);
    return [key(x, y + dy), ch] as const;
  }));
  for (const k of shifted.keys()) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, ddy] of NEIGHBORS) {
      const nx = x + dx;
      const ny = y + ddy;
      if (shifted.has(key(nx, ny)) || !g[ny] || nx < 0 || nx >= SPRITE_WIDTH || keep(nx, ny)) continue;
      g[ny][nx] = 'o';
    }
  }
  for (const [k, ch] of shifted) {
    const [x, y] = k.split(',').map(Number);
    g[y][x] = ch;
  }
}

export interface SpriteOptions {
  outfit?: SpriteOutfit;
  trophy?: SpriteTrophy | null;
  /** 발밑에 공 (유니폼일 때만) */
  ball?: boolean;
}

/** 문자 격자 (색과 무관한 모양) */
export function spriteGrid({ outfit = 'KIT', trophy = null, ball = false }: SpriteOptions = {}): string[] {
  const g = canvas();
  paintHead(g);
  if (outfit === 'KIT') paintKitBody(g, ball && !trophy);
  else paintTuxedoBody(g);
  if (trophy) {
    // 늘어뜨린 손을 지우고 트로피를 든 팔로
    for (let y = 20; y <= 23; y++) for (const x of [3, 4, 5, 18, 19, 20]) g[y][x] = '.';
  }
  // 머리 위 외곽선 자리를 위해 한 칸 내린다
  let rows: Grid = [Array<string>(SPRITE_WIDTH).fill('.'), ...g.slice(0, H_PAINT - 1)];
  rows = autoOutline(rows);
  if (trophy) {
    overlay(rows, trophyCells(trophy), 1);
    overlay(rows, holdingArmCells(outfit), 1, (x, y) => (x <= 5 || x >= 18) && y <= 21);
  }
  span(rows, SPRITE_HEIGHT - 1, 4, 19, '_');
  return rows.map((r) => r.join(''));
}

// ----------------------------------------------------------------------------
// 색
// ----------------------------------------------------------------------------

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
    o: '#18161F',
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
