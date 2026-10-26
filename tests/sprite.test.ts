import { describe, expect, it } from 'vitest';
import { buildSprite, kitPalette, luminance, SPRITE_HEIGHT, SPRITE_WIDTH, spriteTemplates } from '@/components/pixel/sprite';
import type { Appearance } from '@/types/game';

const look: Appearance = { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' };

describe('8비트 도트 캐릭터', () => {
  it('모든 격자 행이 16칸이다', () => {
    for (const template of spriteTemplates()) for (const row of template) expect(row, row).toHaveLength(SPRITE_WIDTH);
  });

  it('사각형이 16 × 25 안에 있고 같은 줄에서 겹치지 않는다', () => {
    const rects = buildSprite({ appearance: look, kit: { primary: '#EF0107', secondary: null } });
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(SPRITE_WIDTH);
      expect(r.y).toBeLessThan(SPRITE_HEIGHT);
    }
    for (let y = 0; y < SPRITE_HEIGHT; y++) {
      const row = rects.filter((r) => r.y === y).sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++) expect(row[i].x).toBeGreaterThanOrEqual(row[i - 1].x + row[i - 1].w);
    }
  });

  it('DB 유니폼 색을 입힌다: 단색은 제1색, 줄무늬는 제2색 세로줄', () => {
    const solid = buildSprite({ appearance: look, kit: { primary: '#EF0107', secondary: null } });
    expect(solid.some((r) => r.fill === '#EF0107')).toBe(true);
    const striped = buildSprite({ appearance: look, kit: { primary: '#FFFFFF', secondary: '#000000' } });
    // 상의 몸통(14행)에 제2색 줄무늬 두 줄
    const torso = striped.filter((r) => r.y === 14 && r.fill === '#000000');
    expect(torso.length).toBe(2);
  });

  it('반바지·양말은 선택 필드가 있으면 그 색, 없으면 상의 색으로 만든다', () => {
    expect(kitPalette({ primary: '#EF0107', secondary: null, shorts: '#FFFFFF', socks: '#EF0107' }).shorts).toBe('#FFFFFF');
    const derived = kitPalette({ primary: '#1D4DA1', secondary: null });
    expect(luminance(derived.shorts)).toBeLessThan(luminance('#1D4DA1'));
    expect(derived.socks).toBe('#1D4DA1');
  });

  it('시상식: 턱시도 + 트로피(금색)를 든다', () => {
    const plain = buildSprite({ appearance: look, outfit: 'TUXEDO' });
    const withBall = buildSprite({ appearance: look, outfit: 'TUXEDO', trophy: 'BALLON_DOR' });
    expect(plain.some((r) => r.fill === '#F5B82E')).toBe(false);
    expect(withBall.some((r) => r.fill === '#F5B82E')).toBe(true);
    expect(buildSprite({ appearance: look, outfit: 'TUXEDO', trophy: 'FIFA_BEST' }).some((r) => r.fill === '#F5B82E')).toBe(true);
  });
});
