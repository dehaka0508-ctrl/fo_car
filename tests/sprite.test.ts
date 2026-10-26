import { describe, expect, it } from 'vitest';
import { buildSprite, kitPalette, luminance, SPRITE_HEIGHT, SPRITE_WIDTH, spriteGrid } from '@/components/pixel/sprite';
import type { Appearance } from '@/types/game';

const look: Appearance = { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' };

describe('3등신 도트 캐릭터', () => {
  it('모든 모습이 24 × 43 격자이고, 머리가 키의 1/3쯤인 3등신이다', () => {
    const variants = [
      {},
      { ball: true },
      { outfit: 'TUXEDO' as const },
      { outfit: 'TUXEDO' as const, trophy: 'BALLON_DOR' as const },
      { outfit: 'TUXEDO' as const, trophy: 'FIFA_BEST' as const },
      { trophy: 'BALLON_DOR' as const },
    ];
    for (const v of variants) {
      const grid = spriteGrid(v);
      expect(grid).toHaveLength(SPRITE_HEIGHT);
      for (const row of grid) expect(row).toHaveLength(SPRITE_WIDTH);
    }
    const grid = spriteGrid();
    const filled = grid.map((row) => /[^._]/.test(row));
    const top = filled.indexOf(true);
    const bottom = filled.lastIndexOf(true);
    const neck = grid.findIndex((row) => row.includes('SSSS') && !row.includes('h'));
    expect((neck - top) / (bottom - top + 1)).toBeGreaterThan(0.3);
    expect((neck - top) / (bottom - top + 1)).toBeLessThan(0.38);
  });

  it('사각형이 격자 안에 있고 같은 줄에서 겹치지 않는다', () => {
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
    // 상의 몸통(21행)에 제2색 줄무늬 두 줄 (2칸씩)
    const torso = striped.filter((r) => r.y === 21 && r.fill === '#000000');
    expect(torso.map((r) => [r.x, r.w])).toEqual([[9, 2], [13, 2]]);
  });

  it('반바지·양말은 선택 필드가 있으면 그 색, 없으면 상의 색으로 만든다', () => {
    expect(kitPalette({ primary: '#EF0107', secondary: null, shorts: '#FFFFFF', socks: '#EF0107' }).shorts).toBe('#FFFFFF');
    const derived = kitPalette({ primary: '#1D4DA1', secondary: null });
    // 어두운 단색 상의 → 흰 반바지, 밝은 상의 → 짙은 반바지
    expect(luminance(derived.shorts)).toBeGreaterThan(0.8);
    expect(derived.socks).toBe('#1D4DA1');
    expect(luminance(kitPalette({ primary: '#FDE100', secondary: null }).shorts)).toBeLessThan(0.05);
  });

  it('시상식: 턱시도 + 트로피(금색)를 든다', () => {
    const plain = buildSprite({ appearance: look, outfit: 'TUXEDO' });
    const withBall = buildSprite({ appearance: look, outfit: 'TUXEDO', trophy: 'BALLON_DOR' });
    expect(plain.some((r) => r.fill === '#F5B82E')).toBe(false);
    expect(withBall.some((r) => r.fill === '#F5B82E')).toBe(true);
    expect(buildSprite({ appearance: look, outfit: 'TUXEDO', trophy: 'FIFA_BEST' }).some((r) => r.fill === '#F5B82E')).toBe(true);
  });
});
