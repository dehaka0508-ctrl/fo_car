/**
 * 8비트 SD 도트 캐릭터 (16 × 25 픽셀, 마지막 줄은 그림자)
 * 문자 격자 → 팔레트 → 가로로 이어지는 같은 색 픽셀을 하나의 사각형으로 합친다 (SVG rect 수를 줄이려고).
 * React와 무관한 순수 함수라 테스트·미리보기 스크립트에서도 쓴다.
 */
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES } from '@/data/appearance';
import type { Appearance, KitColors } from '@/types/game';

export const SPRITE_WIDTH = 16;
export const SPRITE_HEIGHT = 25;

export type SpriteOutfit = 'KIT' | 'TUXEDO';
export type SpriteTrophy = 'BALLON_DOR' | 'FIFA_BEST';

/*
 * 격자 문자
 *  o 외곽선   h 머리   H 머리 하이라이트   s 피부   w 눈 반짝임   e 눈동자   r 볼   m 입
 *  c 칼라     j 상의(줄무늬는 열로 칠함)   J 상의 그늘   a 소매   A 소매 그늘   p 반바지   k 양말   b 축구화   B 축구화 밑창
 *  T 재킷     L 라펠   W 셔츠   x 나비넥타이   P 바지   Q 구두   q 구두 광택
 *  g 금   G 금 하이라이트   d 금 그림자   n 받침대   _ 그림자
 */
const HEAD = [
  '....oooooooo....',
  '..ooHHhhhhhhoo..',
  '.ohHhhhhhhhhhho.',
  'ohhhhhhhhhhhhhho',
  'ohhhhhhhhhhhhhho',
  'ohhsshhsshhsshho',
  'ohssssssssssssho',
  'ohsswesssswessho',
  'ohsseesssseessho',
  'ohrssssmmssssrho',
  '.osssssssssssso.',
  '..oossssssssoo..',
];

const KIT_BODY = [
  '...oajcsscjao...',
  '.ooaajjccjjaaoo.',
  'oaaojjjjjjjJoaAo',
  'oaaojjjjjjjJoaAo',
  'ossojjjjjjjJosso',
  '.ooojjjjjjjJooo.',
  '...oppppppppo...',
  '...opppoopppo...',
  '....ossoosso....',
  '....okkookko....',
  '...obbboobbbo...',
  '...oBBBooBBBo...',
];

const TUXEDO_BODY = [
  '...oTLWxxWLTo...',
  '.ooTTTLWWLTTToo.',
  'oTToTTTWWTTToTTo',
  'oTToTTTWWTTToTTo',
  'ossoTTTTTTTTosso',
  '.oooTTTTTTTTooo.',
  '...oPPPPPPPPo...',
  '...oPPPooPPPo...',
  '....oPPooPPo....',
  '....oPPooPPo....',
  '...oQQqooQQqo...',
  '...oooo..oooo...',
];

const SHADOW = '..____________..';

/** 트로피를 가슴 앞에 두 손으로 든다 (몸통 위에 덮어 그림, '.'은 그대로 둠) */
const TROPHY_OVERLAY: Record<SpriteTrophy, string[]> = {
  BALLON_DOR: [
    '................',
    '.....oooooo.....',
    '....oGGgggdo....',
    '....oGggggdo....',
    '...osggggddso...',
    '....oggggddo....',
    '.....oonnoo.....',
    '.....onnnno.....',
  ],
  FIFA_BEST: [
    '................',
    '...oooooooooo...',
    '...oGGgggggdo...',
    '...oGgggggddo...',
    '...osggggddso...',
    '.....oogdoo.....',
    '......ogdo......',
    '.....onnnno.....',
  ],
};
/** 트로피를 들면 늘어뜨린 손 대신 팔을 닫는다 (손은 트로피 옆에) */
const CLOSED_ARMS: Record<SpriteOutfit, string> = { KIT: '.ooojjjjjjjJooo.', TUXEDO: '.oooTTTTTTTTooo.' };

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  fill: string;
}

// ----------------------------------------------------------------------------
// 색 유틸
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
 * 반바지·양말은 선택 필드(shorts · socks)가 없으면 상의 색에서 만든다.
 */
export function kitPalette(kit: KitColors) {
  const primary = kit.primary;
  const stripe = kit.secondary;
  const darker = stripe && luminance(stripe) < luminance(primary) ? stripe : primary;
  const shorts = kit.shorts ?? (stripe ? shade(darker, -0.15) : shade(primary, luminance(primary) > 0.6 ? -0.55 : -0.4));
  const socks = kit.socks ?? primary;
  // 칼라: 밝은 상의는 짙게, 어두운 상의는 흰색 (줄무늬 색으로 칠하면 줄무늬와 이어져 H자처럼 보인다)
  const trim = luminance(primary) > 0.55 ? shade(primary, -0.6) : '#F4F4F5';
  return { primary, stripe, shorts, socks, trim };
}

const DEFAULT_KIT: KitColors = { primary: '#64748B', secondary: null };

/** 상의 몸통 열(4~11)을 1-2-2-2-1 폭으로 primary · secondary · primary · secondary · primary */
const STRIPE_COLUMNS = new Set([5, 6, 9, 10]);

export function buildSprite(options: {
  appearance: Appearance;
  kit?: KitColors | null;
  outfit?: SpriteOutfit;
  trophy?: SpriteTrophy | null;
}): SpriteRect[] {
  const { appearance, outfit = 'KIT', trophy = null } = options;
  const kit = kitPalette(options.kit ?? DEFAULT_KIT);
  const skin = SKIN_TONES[appearance.skin].color;
  const hair = HAIR_COLORS[appearance.hair].color;
  const eyes = EYE_COLORS[appearance.eyes].color;
  const outline = '#0E0F14';

  const palette: Record<string, string> = {
    o: outline,
    h: hair,
    H: shade(hair, appearance.hair === 'BLACK' ? 0.22 : 0.3),
    s: skin,
    w: '#FFFFFF',
    e: eyes === EYE_COLORS.DARK_BROWN.color ? '#1A120C' : shade(eyes, -0.2),
    r: shade(skin, -0.12),
    m: shade(skin, -0.45),
    c: kit.trim,
    j: kit.primary,
    J: shade(kit.primary, -0.16),
    a: kit.primary,
    A: shade(kit.primary, -0.16),
    p: kit.shorts,
    k: kit.socks,
    b: '#1C1C22',
    B: '#E5E7EB',
    T: '#1A1B25',
    L: '#343647',
    W: '#F4F4F5',
    x: '#050507',
    P: '#15161E',
    Q: '#0B0B10',
    q: '#6B6F80',
    g: '#F5B82E',
    G: '#FFF1A8',
    d: '#B7791F',
    n: '#2A2238',
    _: 'rgba(0,0,0,0.35)',
  };

  const rows = [...HEAD, ...(outfit === 'TUXEDO' ? TUXEDO_BODY : KIT_BODY), SHADOW].map((r) => r.split(''));
  if (trophy) {
    const top = HEAD.length; // 트로피 격자는 턱 줄(11행)부터 그린다
    rows[top + 4] = CLOSED_ARMS[outfit].split('');
    TROPHY_OVERLAY[trophy].forEach((line, i) => {
      line.split('').forEach((ch, x) => {
        if (ch !== '.') rows[top - 1 + i][x] = ch;
      });
    });
  }

  const rects: SpriteRect[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      const color = colorAt(ch, x);
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

  function colorAt(ch: string, x: number): string | null {
    if (ch === '.' || ch === ' ') return null;
    if (ch === 'j' && kit.stripe && STRIPE_COLUMNS.has(x)) return kit.stripe;
    return palette[ch] ?? null;
  }
}

/** 미리보기·테스트용: 격자 행이 모두 16칸인지 */
export function spriteTemplates(): string[][] {
  return [HEAD, KIT_BODY, TUXEDO_BODY, [SHADOW], ...Object.values(TROPHY_OVERLAY)];
}
