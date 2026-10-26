import { describe, expect, it } from 'vitest';
import { simulateCareer } from '@/engine/autoplay';
import { BASE_WORLD } from '@/engine/career';
import { buildCareerSummary, formatCareerText, formatSeasonLine } from '@/engine/careerSummary';
import type { CharacterInput } from '@/engine/character';

const base: Omit<CharacterInput, 'role' | 'clubId'> = {
  name: '김유망',
  nationality: 'KOR',
  heightCm: 184,
  weightKg: 78,
  appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' },
};

describe('커리어 요약 · 공유 텍스트', () => {
  const striker = simulateCareer({ ...base, role: { position: 'ST', playStyle: 'POACHER' }, clubId: 'ulsan' }, 2);
  const summary = buildCareerSummary(striker, BASE_WORLD);
  const text = formatCareerText(summary);

  it('은퇴까지 모든 시즌이 한 줄씩 정리된다', () => {
    expect(striker.stage).toBe('RETIRED');
    expect(summary.seasons).toHaveLength(striker.history.length);
    expect(summary.seasons[0].label).toBe('2026/27');
    expect(summary.seasons[0].age).toBe(16);
    expect(summary.status).toMatch(/세 은퇴/);
  });

  it('시즌 줄에 [시즌 · 나이 | 소속 | 경기·골·도움·평점 | 우승 | 개인상]이 들어간다', () => {
    const withTrophy = summary.seasons.find((s) => s.trophies.length && s.awards.length && s.apps > 0);
    expect(withTrophy).toBeDefined();
    const line = formatSeasonLine(withTrophy!, false);
    expect(line).toMatch(/^\d{4}\/\d{2} · \d+세 \| .+ \| \d+경기 \d+골 \d+도움 · 평점 \d\.\d{2}/);
    expect(line).toContain('🏆 ');
    expect(line).toContain('🏅 ');
  });

  it('전체 텍스트에 머리말·통산·시즌별 기록·개인상이 들어간다', () => {
    expect(text.startsWith('⚽ 김유망 커리어 요약 (대한민국 · 스트라이커 · 포처)')).toBe(true);
    expect(text).toContain('[시즌별 기록]');
    expect(text).toMatch(/통산 \d+경기 \d+골 \d+도움/);
    expect(text).toContain('#축구커리어시뮬레이터');
    expect(text.split('\n').filter((l) => /^\d{4}\/\d{2} · /.test(l))).toHaveLength(striker.history.length);
  });

  it('골키퍼는 골·도움 대신 클린시트로 적는다', () => {
    const keeper = simulateCareer({ ...base, heightCm: 191, role: { position: 'GK', playStyle: 'SWEEPER_KEEPER' }, clubId: 'jeonbuk' }, 2);
    const keeperText = formatCareerText(buildCareerSummary(keeper, BASE_WORLD));
    expect(keeperText).toMatch(/통산 \d+경기 · 클린시트 \d+/);
    expect(keeperText).toMatch(/\d+경기 클린시트 \d+ · 평점/);
  });
});
