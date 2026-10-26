import { describe, expect, it } from 'vitest';
import { BALLON_REFERENCES, rankDistribution } from '../scripts/ballon-references';
import { createDefaultWorld } from '@/engine/world';

/**
 * 발롱도르 점수 보정 회귀 테스트.
 * 공격수 위주 → 포지션별 균형을 맞춘 목표(scripts/ballon-references.ts)를 벗어나면 실패한다.
 * 수치를 바꿨다면 npm run sim:ballon 으로 표를 확인하자.
 */
describe('발롱도르 기준 시즌 보정', () => {
  const world = createDefaultWorld();
  for (const ref of BALLON_REFERENCES) {
    it(ref.label, () => {
      const d = rankDistribution(world, ref.season, 800);
      const { win, podium, medianRank } = ref.target;
      if (win) {
        expect(d.win).toBeGreaterThanOrEqual(win[0]);
        expect(d.win).toBeLessThanOrEqual(win[1]);
      }
      if (podium) {
        expect(d.podium).toBeGreaterThanOrEqual(podium[0]);
        expect(d.podium).toBeLessThanOrEqual(podium[1]);
      }
      if (medianRank) {
        expect(d.medianRank).toBeGreaterThanOrEqual(medianRank[0]);
        expect(d.medianRank).toBeLessThanOrEqual(medianRank[1]);
      }
    });
  }

  it('수비수·골키퍼도 압도적인 더블·월드컵 시즌이면 수상이 불가능하지 않다', () => {
    const defenders = BALLON_REFERENCES.filter((r) => r.season.group === 'DEFENDER' || r.season.group === 'GOALKEEPER');
    const best = Math.max(...defenders.map((r) => rankDistribution(world, r.season, 800).win));
    expect(best).toBeGreaterThan(0.02);
  });
});
