import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { SimulationWorld } from '@/engine/world';
import type { SeasonPerformance } from '@/engine/awards';
import type { CompetitionType, MatchLog, TurnResult } from '@/types/game';

let world: SimulationWorld;
let awards: typeof import('@/engine/awards');
let rng: typeof import('@/engine/rng');
let character: typeof import('@/engine/character');
let worldModule: typeof import('@/engine/world');
beforeAll(async () => {
  vi.stubEnv('FO_CAR_DB', 'full');
  vi.resetModules();
  worldModule = await import('@/engine/world');
  world = worldModule.createDefaultWorld();
  awards = await import('@/engine/awards');
  rng = await import('@/engine/rng');
  character = await import('@/engine/character');
});
const clubId = (name: string, nation: string) => worldModule.findClubId(world.clubs, name, nation)!;
const elite = (id: string) => {
  const league = world.leagues[world.clubStates[id].leagueId];
  return league.tier === 1 && ['ENG', 'ESP', 'GER', 'ITA', 'FRA'].includes(league.nation);
};
function season(id: string): SeasonPerformance {
  const leagueId = world.clubStates[id].leagueId;
  const league = world.leagues[leagueId];
  const stats = character.emptyStatsByCompetition();
  const fill = (type: CompetitionType, appearances: number, goals: number, assists: number) => {
    stats[type] = { ...stats[type], appearances, starts: appearances, minutes: appearances * 85, goals, assists, ratingSum: appearances * 7.6 };
  };
  fill('LEAGUE', 34, 25, 10); fill('DOMESTIC_CUP', 5, 4, 3); fill('CONTINENTAL', 13, 6, 4);
  return { group: 'FORWARD', stats, leagueId, leagueStrength: league.strength, reputation: 85, eligibleMatches: 52,
    trophies: [leagueId, league.domesticCupId, league.confederation === 'UEFA' ? 'UEFA_CL' : league.confederation === 'CONMEBOL' ? 'CONMEBOL_LIB' : 'AFC_CL'].map((competitionId) => ({ competitionId, season: 2030, teamId: id, teamKind: 'CLUB' })) };
}

describe('세계 시상 리그 수준 보정 · 실제 외부 DB', () => {
  it('레알·파우메이라스·알힐랄이 같은 기본 NPC 점수로 경쟁하지 않는다', () => {
    const real = clubId('Real Madrid', 'ESP'), palmeiras = clubId('Palmeiras', 'BRA'), hilal = clubId('Al Hilal', 'KSA');
    expect(real && palmeiras && hilal).toBeTruthy();
    const factor = (id: string) => awards.worldCandidateRecognition(world.leagues[world.clubStates[id].leagueId]);
    expect(factor(real)).toBe(1);
    expect(factor(palmeiras)).toBeLessThanOrEqual(0.75);
    expect(factor(hilal)).toBeLessThanOrEqual(0.65);
    const score = (id: string) => awards.ballonBreakdown(world, season(id)).total;
    expect(score(real)).toBeGreaterThan(score(palmeiras) + 10);
    expect(score(real)).toBeGreaterThan(score(hilal) + 10);
  });

  it('1000개 후보 풀에서 최상위 리그 수상이 대부분이며, 레알 트레블 활약을 비유럽 무작위 후보가 앞서지 않는다', () => {
    const perf = season(clubId('Real Madrid', 'ESP'));
    const score = awards.ballonBreakdown(world, perf).total;
    // 시즌이 쌓여 비유럽 강팀의 전력이 80을 넘은 사용자 재현 상황.
    const strengthened = { ...world.clubStates };
    for (const id of [clubId('Palmeiras', 'BRA'), clubId('Al Hilal', 'KSA')]) strengthened[id] = { ...strengthened[id], power: 90 };
    const auditWorld = { ...world, clubStates: strengthened };
    let topLeagueWins = 0, outsiderNominees = 0, outsiderAboveTreble = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const candidates = awards.worldBallonCandidates(rng.rngFor(seed, 'award-league-audit'), auditWorld).sort((a, b) => b.score - a.score);
      expect(candidates).toHaveLength(40);
      if (elite(candidates[0].clubId!)) topLeagueWins++;
      for (const candidate of candidates) {
        if (!elite(candidate.clubId!)) {
          outsiderNominees++;
          if (candidate.score > score) outsiderAboveTreble++;
        }
      }
    }
    expect(topLeagueWins).toBeGreaterThanOrEqual(980);
    expect(outsiderNominees).toBeGreaterThan(0);
    expect(outsiderAboveTreble).toBe(0);
    console.info(`세계 시상 1000회: 최상위 리그 1위 ${topLeagueWins}, 비최상위 후보 ${outsiderNominees}, 레알 트레블보다 높은 비최상위 후보 ${outsiderAboveTreble}`);
  });

  it('승강 뒤의 동적 소속 리그를 사용하고, 2부의 높은 구단 전력도 그대로 우대하지 않는다', () => {
    const real = clubId('Real Madrid', 'ESP');
    const top = world.clubStates[real];
    const second = Object.values(world.leagues).find((league) => league.nation === 'ESP' && league.tier === 2)!;
    const moved = { ...world, clubStates: { [real]: { ...top, leagueId: second.id } } };
    const pool = awards.worldBallonCandidates(rng.rngFor(8, 'relegated'), moved);
    expect(pool.every((candidate) => candidate.clubId === real && candidate.score < 65)).toBe(true);
  });

  it('트레블만으로 저출전 선수가 자동 수상하지 않고, 비최상위 리그의 압도적인 월드컵 시즌은 여전히 경쟁할 수 있다', () => {
    const real = season(clubId('Real Madrid', 'ESP'));
    const bench = { ...real, stats: character.emptyStatsByCompetition() };
    bench.stats.LEAGUE = { ...bench.stats.LEAGUE, appearances: 3, starts: 1, minutes: 100, ratingSum: 21 };
    expect(awards.ballonBreakdown(world, bench).total).toBeLessThan(70);
    const exceptional = season(clubId('Palmeiras', 'BRA'));
    exceptional.reputation = 100;
    exceptional.stats.LEAGUE = { ...exceptional.stats.LEAGUE, goals: 65, assists: 20, ratingSum: 34 * 8.3 };
    exceptional.stats.INTERNATIONAL = { ...exceptional.stats.INTERNATIONAL, appearances: 7, starts: 7, minutes: 630, goals: 10, assists: 6, ratingSum: 7 * 8.5 };
    exceptional.trophies.push({ competitionId: 'WORLD_CUP', season: 2030, teamId: 'nation:BRA', teamKind: 'NATION' });
    expect(awards.ballonBreakdown(world, exceptional).total).toBeGreaterThan(100);
  });
});


describe('UCL·월드컵 우승과 대회 주축 출전 가산', () => {
  it('주축 우승 선수에게 소폭 가산하고 벤치·기록 부재·준우승에는 같은 가산을 주지 않는다', () => {
    const perf = season(clubId('Real Madrid', 'ESP'));
    const baseline = awards.ballonBreakdown(world, perf);
    const main = { ...perf, majorParticipation: { UEFA_CL: { matches: 13, starts: 11, minutes: 990 } } };
    expect(awards.ballonBreakdown(world, main).majorContribution).toBe(2);
    expect(awards.ballonBreakdown(world, main).total - baseline.total).toBeCloseTo(2, 5);
    const bench = { ...perf, majorParticipation: { UEFA_CL: { matches: 13, starts: 0, minutes: 100 } } };
    expect(awards.ballonBreakdown(world, bench).majorContribution).toBe(0);
    expect(baseline.majorContribution).toBe(0);
    const withoutTitle = { ...main, trophies: main.trophies.filter((trophy) => trophy.competitionId !== 'UEFA_CL') };
    expect(awards.ballonBreakdown(world, withoutTitle).majorContribution).toBe(0);
    const rotation = { ...perf, majorParticipation: { UEFA_CL: { matches: 13, starts: 6, minutes: 540 } } };
    expect(awards.ballonBreakdown(world, rotation).majorContribution).toBeGreaterThan(0);
    expect(awards.ballonBreakdown(world, rotation).majorContribution).toBeLessThan(2);
    const both = { ...main, trophies: [...main.trophies, { competitionId: 'WORLD_CUP', season: 2030, teamId: 'nation:ESP', teamKind: 'NATION' as const }], majorParticipation: { ...main.majorParticipation, WORLD_CUP: { matches: 7, starts: 7, minutes: 630 } } };
    expect(awards.ballonBreakdown(world, both).majorContribution).toBe(5);
  });

  it('리그 주전 기록 대신 우승팀의 해당 대회 경기만 집계하며 미출전과 이적 전 다른 팀 경기를 구분한다', async () => {
    const career = await import('@/engine/career');
    const real = clubId('Real Madrid', 'ESP');
    const state = career.createCareer({ name: '주축 출전', nationality: 'ESP', role: { position: 'ST', playStyle: 'POACHER' }, clubId: real, heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' } }, { seed: 3 });
    const perf = season(real);
    const log = (fixtureId: string, competitionId: string, teamId: string, started: boolean, minutes: number): MatchLog => ({
      fixtureId, competitionId, competitionType: competitionId === 'UEFA_CL' ? 'CONTINENTAL' : 'LEAGUE', stage: '경기', day: 1,
      home: { id: teamId, name: teamId, power: 88, kind: 'CLUB' }, away: { id: 'opponent', name: '상대', power: 80, kind: 'CLUB' },
      score: { home: 1, away: 0, winner: 'HOME' }, playerTeamSide: 'HOME',
      player: minutes ? { started, minutes, goals: 0, assists: 0, cleanSheet: false, saves: 0, keyPasses: 0, rating: 7, conditionAfter: 80 } : null,
      partnerJointGoals: 0, isHighlight: false,
    });
    const turn = { turn: { season: 2030, phase: 'SECOND_HALF' }, clubId: real, leagueId: perf.leagueId, trophies: perf.trophies, playerStats: perf.stats,
      matches: [log('ucl-1', 'UEFA_CL', real, true, 90), log('ucl-2', 'UEFA_CL', real, false, 20), log('ucl-3', 'UEFA_CL', real, false, 0), log('old-team', 'UEFA_CL', 'previous-club', true, 90), log('league-1', perf.leagueId!, real, true, 90)] } as TurnResult;
    const result = awards.seasonPerformance({ ...state, seasonTurns: [turn] }, world);
    expect(result.majorParticipation?.UEFA_CL).toEqual({ matches: 3, starts: 1, minutes: 110 });
    expect(result.majorParticipation?.WORLD_CUP).toBeUndefined();
  });
});
