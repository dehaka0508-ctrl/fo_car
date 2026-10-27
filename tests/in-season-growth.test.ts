import { describe, expect, it } from 'vitest';
import { makePlayer } from './helpers';
import { emptyStatsByCompetition } from '@/engine/character';
import { createCareer, playTurnAuto } from '@/engine/career';
import { autoAnswerEvents } from '@/engine/autoplay';
import { developPlayerDuringTurn, turnDevelopmentFactors, fieldAttributeAverage } from '@/engine/growth';
import { calculateOVR } from '@/engine/ovr';
import { rngFor } from '@/engine/rng';
import { ATTRIBUTE_KEYS, FIELD_STAT_KEYS, GK_STAT_KEYS, type PlayerState } from '@/types/game';

function performance(minutes: number, rating = 7.2) {
  const stats = emptyStatsByCompetition();
  const appearances = Math.ceil(minutes / 90);
  stats.LEAGUE = { ...stats.LEAGUE, minutes, appearances, starts: appearances, ratingSum: appearances * rating };
  return stats;
}
const total = (player: PlayerState) => ATTRIBUTE_KEYS.reduce((sum, key) => sum + player.attributes[key], 0);
function progress(player: PlayerState, minutes: number, rating = 7.2, turns = 3) {
  let next = player;
  for (let turn = 0; turn < turns; turn++) next = developPlayerDuringTurn(next, performance(minutes, rating), rngFor(7, 'turn', turn), 7, player.condition).player;
  return total(next) - total(player);
}

describe('시즌 중 즉시 성장', () => {
  it('16세 선수가 시즌 종료·별도 훈련 없이 전반기와 후반기를 넘길 때마다 실제 능력치가 오른다', () => {
    for (let seed = 1; seed <= 12; seed++) {
      let state = createCareer({ name: '성장 선수', nationality: 'KOR', role: { position: 'ST', playStyle: 'POACHER' }, clubId: 'ulsan', heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' } }, { seed });
      for (const phase of ['FIRST_HALF', 'SECOND_HALF'] as const) {
        state = autoAnswerEvents(state);
        const before = state.player;
        state = playTurnAuto(state);
        const report = state.lastTurn!.development!;
        expect(state.lastTurn!.turn.phase).toBe(phase);
        expect(state.player.age).toBe(16);
        expect(state.turn.season).toBe(2026);
        expect(total(state.player)).toBeGreaterThan(total(before));
        expect(report.changes.length).toBeGreaterThan(0);
        expect(report.ovrBefore).toBe(before.ovr);
        expect(report.ovrAfter).toBe(state.player.ovr);
        expect(report.averageAfter).toBeCloseTo(fieldAttributeAverage(state.player.attributes), 10);
        expect(state.seasonTurns.at(-1)!.development).toEqual(report);
        for (const change of report.changes) {
          expect(change.before).toBe(before.attributes[change.key]);
          expect(change.after).toBe(state.player.attributes[change.key]);
          expect(change.after - change.before).toBe(change.experience + change.natural);
        }
      }
    }
  });

  it('성인 선수는 같은 나이·능력치라도 주전 > 교체 > 미출전 순으로 성장한다', () => {
    const player = { ...makePlayer({ age: 23 }), potential: 95 };
    expect(progress(player, 1620)).toBeGreaterThan(progress(player, 270));
    expect(progress(player, 270)).toBeGreaterThan(progress(player, 0));
  });

  it('평점·컨디션이 좋을수록 더 성장하며 어린 선수가 더 빨리 성장한다', () => {
    const player = { ...makePlayer({ age: 22 }), potential: 95 };
    expect(progress(player, 1080, 8.2)).toBeGreaterThan(progress(player, 1080, 6));
    expect(progress({ ...player, condition: 100 }, 1080)).toBeGreaterThan(progress({ ...player, condition: 20 }, 1080));
    expect(progress({ ...player, age: 17 }, 1080)).toBeGreaterThan(progress({ ...player, age: 29 }, 1080));
  });

  it('유소년 초기 성장 속도로 숨은 포텐셜을 노출하지 않되 필드 평균 한도는 지킨다', () => {
    const young = makePlayer({ age: 16 });
    const a = developPlayerDuringTurn({ ...young, potential: 60 }, performance(900), rngFor(3, 'youth'), 3).player;
    const b = developPlayerDuringTurn({ ...young, potential: 95 }, performance(900), rngFor(3, 'youth'), 3).player;
    expect(a.attributes).toEqual(b.attributes);
    const nearCap = { ...young, potential: 60, attributes: { ...young.attributes } };
    for (const key of FIELD_STAT_KEYS) nearCap.attributes[key] = 60;
    nearCap.attributes.finishing = 59;
    nearCap.ovr = calculateOVR(nearCap.attributes, nearCap.profile.role);
    const grown = developPlayerDuringTurn(nearCap, performance(1800, 9), rngFor(3, 'cap'), 3);
    expect(fieldAttributeAverage(grown.player.attributes)).toBeLessThanOrEqual(60);
    expect(total(grown.player) - total(nearCap)).toBe(1);
    const stopped = developPlayerDuringTurn(grown.player, performance(1800, 9), rngFor(3, 'cap2'), 3);
    expect(stopped.report.status).toBe('AT_POTENTIAL');
    expect(stopped.report.changes).toEqual([]);
  });

  it('소수점 성장 누적은 세이브·복원 후에도 보존되어 다음 턴 결과가 같다', () => {
    const oldSave = { ...makePlayer({ age: 27 }), potential: 95, condition: 30 };
    delete oldSave.developmentCredits;
    const first = developPlayerDuringTurn(oldSave, performance(90), rngFor(4, 'first'), 4).player;
    expect(Object.values(first.developmentCredits!).some((value) => value !== 0)).toBe(true);
    const restored = JSON.parse(JSON.stringify(first)) as PlayerState;
    const a = developPlayerDuringTurn(first, performance(90), rngFor(4, 'next'), 4);
    const b = developPlayerDuringTurn(restored, performance(90), rngFor(4, 'next'), 4);
    expect(a).toEqual(b);
  });

  it('필드 선수는 GK 능력치가 자라지 않고 GK의 상한 판정은 기존 OVR을 쓴다', () => {
    const field = makePlayer();
    const grown = developPlayerDuringTurn(field, performance(1440), rngFor(8, 'field'), 8).player;
    for (const key of GK_STAT_KEYS) expect(grown.attributes[key]).toBe(field.attributes[key]);
    const keeper = makePlayer({ role: { position: 'GK', playStyle: 'SWEEPER_KEEPER' } });
    const stopped = developPlayerDuringTurn({ ...keeper, potential: keeper.ovr }, performance(1440), rngFor(8, 'keeper'), 8);
    expect(stopped.report.status).toBe('AT_POTENTIAL');
    expect(stopped.player.attributes).toEqual(keeper.attributes);
  });

  it('선수별 성장 속도는 시드에 고정되고 모든 턴 단계에서 같은 기준을 쓴다', () => {
    const player = makePlayer();
    const stats = performance(1000);
    expect(turnDevelopmentFactors(player, stats, 17)).toEqual(turnDevelopmentFactors(player, stats, 17));
    expect(turnDevelopmentFactors(player, stats, 17).pace).not.toBe(turnDevelopmentFactors(player, stats, 18).pace);
  });
});
