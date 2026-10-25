import { describe, expect, it } from 'vitest';
import { buildRoundRobin, evaluateNationalDuty, planTurn } from '@/engine/schedule';
import { getLeagueClubIds } from '@/engine/world';
import { world } from './helpers';

describe('라운드로빈', () => {
  const teams = getLeagueClubIds(world, 'ENG_PL');
  const rounds = buildRoundRobin(teams, 2, 42);

  it('20팀 더블 라운드로빈 = 38라운드, 라운드마다 모든 팀이 한 번씩', () => {
    expect(rounds).toHaveLength(38);
    for (const round of rounds) {
      const ids = round.flat();
      expect(new Set(ids).size).toBe(20);
    }
  });

  it('모든 팀이 홈·원정 19경기씩, 같은 상대와 홈·원정 1회씩', () => {
    const home = new Map<string, number>();
    const pairs = new Set<string>();
    for (const [h, a] of rounds.flat()) {
      home.set(h, (home.get(h) ?? 0) + 1);
      pairs.add(`${h}>${a}`);
    }
    for (const team of teams) expect(home.get(team)).toBe(19);
    expect(pairs.size).toBe(20 * 19);
  });

  it('홀수 팀이면 라운드마다 한 팀이 쉰다', () => {
    const odd = buildRoundRobin(['a', 'b', 'c', 'd', 'e'], 1, 1);
    expect(odd).toHaveLength(5);
    for (const round of odd) expect(round).toHaveLength(2);
  });
});

describe('턴 일정', () => {
  it('전반기 EPL: 리그 190경기 + 대륙컵 조별리그 + 국내컵 2라운드', () => {
    const plan = planTurn({
      seed: 1,
      turn: { season: 2026, phase: 'FIRST_HALF' },
      world,
      clubId: 'arsenal',
      squadLevel: 'FIRST_TEAM',
      progress: [],
      nationalDuty: null,
    });
    const league = plan.fixtures.filter((f) => f.competitionType === 'LEAGUE');
    expect(league).toHaveLength(190);
    expect(league.filter((f) => f.playerTeamSide)).toHaveLength(19);
    expect(plan.fixtures.filter((f) => f.competitionType === 'CONTINENTAL' && f.playerTeamSide)).toHaveLength(6);
    expect(plan.fixtures.filter((f) => f.competitionType === 'DOMESTIC_CUP')).toHaveLength(2);
    // 주인공 팀 경기끼리 날짜가 겹치지 않는다
    const days = plan.fixtures.filter((f) => f.playerTeamSide).map((f) => f.day);
    expect(new Set(days).size).toBe(days.length);
    // 시간순 정렬
    expect(plan.fixtures.map((f) => f.day)).toEqual([...plan.fixtures.map((f) => f.day)].sort((a, b) => a - b));
  });

  it('후반기 컵 일정은 전반기에 살아남았을 때만 생긴다', () => {
    const base = {
      seed: 1,
      turn: { season: 2026, phase: 'SECOND_HALF' as const },
      world,
      clubId: 'arsenal',
      squadLevel: 'FIRST_TEAM' as const,
      nationalDuty: null,
    };
    const alive = planTurn({ ...base, progress: [{ competitionId: 'ENG_FA_CUP', status: 'ACTIVE', stageReached: '16강' }] });
    const out = planTurn({ ...base, progress: [{ competitionId: 'ENG_FA_CUP', status: 'ELIMINATED', stageReached: '3라운드' }] });
    expect(alive.fixtures.filter((f) => f.competitionType === 'DOMESTIC_CUP')).toHaveLength(3);
    expect(out.fixtures.filter((f) => f.competitionType === 'DOMESTIC_CUP')).toHaveLength(0);
  });

  it('B팀 선수는 리저브 경기가 추가된다', () => {
    const plan = planTurn({
      seed: 1,
      turn: { season: 2026, phase: 'FIRST_HALF' },
      world,
      clubId: 'ulsan',
      squadLevel: 'RESERVE',
      progress: [],
      nationalDuty: null,
    });
    const reserve = plan.fixtures.filter((f) => f.competitionType === 'RESERVE');
    expect(reserve.length).toBeGreaterThan(0);
    expect(reserve.every((f) => f.squad === 'RESERVE')).toBe(true);
  });
});

describe('국가대표 차출', () => {
  const base = { seed: 3, world, reputation: 70, age: 25, isGoalkeeper: false };

  it('월드컵 해(2030년 여름 = 2029 시즌 프리시즌)에 실력이 되면 월드컵 차출', () => {
    const duty = evaluateNationalDuty({ ...base, turn: { season: 2029, phase: 'PRESEASON' }, nationality: 'ENG', ovr: 92 });
    expect(duty?.tournamentId).toBe('WORLD_CUP');
    // 대표팀 실력(87) + 4 이상이면 핵심 자원
    expect(duty?.playingTime).toBe('KEY');
  });

  it('실력이 모자라면 차출되지 않는다', () => {
    const duty = evaluateNationalDuty({ ...base, turn: { season: 2029, phase: 'PRESEASON' }, nationality: 'ENG', ovr: 60, reputation: 5 });
    expect(duty).toBeNull();
  });

  it('국제대회가 없는 해에는 차출이 없다 (아시아, 2029년 여름)', () => {
    const duty = evaluateNationalDuty({ ...base, turn: { season: 2028, phase: 'PRESEASON' }, nationality: 'KOR', ovr: 90 });
    expect(duty).toBeNull();
  });

  it('프리시즌이 아니면 차출 판정을 하지 않는다', () => {
    const duty = evaluateNationalDuty({ ...base, turn: { season: 2029, phase: 'FIRST_HALF' }, nationality: 'ENG', ovr: 90 });
    expect(duty).toBeNull();
  });
});
