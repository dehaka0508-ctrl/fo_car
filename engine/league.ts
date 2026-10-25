/**
 * 리그 시즌 빠른 시뮬레이션
 *
 * 주인공이 뛰지 않는 리그는 턴 시뮬레이션을 하지 않으므로, 승강제·대륙 대회 진출권 판정을 위해
 * 시즌 종료 시 구단 실력만으로 시즌 전체를 시뮬레이션한다.
 * 경기 id와 난수 스트림을 턴 시뮬레이터(schedule.ts)와 똑같이 만들어 결과가 서로 일관된다.
 */
import type { ID, StandingRow } from '@/types/game';
import { rngFor } from './rng';
import { buildRoundRobin } from './schedule';
import { finishScore, simulateScore } from './simulator';
import { hashSeed } from './rng';
import { clubRef, getLeagueClubIds, type SimulationWorld } from './world';

export function emptyStanding(clubId: ID): StandingRow {
  return { clubId, position: 0, points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
}

export function rankStandings(rows: Iterable<StandingRow>): StandingRow[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
        b.goalsFor - a.goalsFor ||
        a.clubId.localeCompare(b.clubId),
    )
    .map((row, index) => ({ ...row, position: index + 1 }));
}

export function leagueSchedule(world: SimulationWorld, leagueId: ID, seed: number, season: number) {
  const league = world.leagues[leagueId];
  return buildRoundRobin(
    getLeagueClubIds(world, leagueId),
    league.roundRobinCycles,
    hashSeed(seed, 'league', season, leagueId),
  );
}

/** [fromRound, toRound) 라운드를 시뮬레이션해 그 구간의 순위표를 만든다. */
export function simulateLeagueRounds(
  world: SimulationWorld,
  leagueId: ID,
  seed: number,
  season: number,
  fromRound = 0,
  toRound = Number.POSITIVE_INFINITY,
): StandingRow[] {
  const rounds = leagueSchedule(world, leagueId, seed, season);
  const rows = new Map<ID, StandingRow>();
  for (const id of getLeagueClubIds(world, leagueId)) rows.set(id, emptyStanding(id));

  for (let r = fromRound; r < Math.min(toRound, rounds.length); r++) {
    for (const [homeId, awayId] of rounds[r]) {
      const home = clubRef(world, homeId);
      const away = clubRef(world, awayId);
      const fixtureId = `L:${leagueId}:${season}:R${r + 1}:${homeId}:${awayId}`;
      const rng = rngFor(seed, fixtureId, 'score');
      const raw = simulateScore(rng, home.power, away.power, false);
      const score = finishScore(rng, raw, { home: raw.lambdaHome, away: raw.lambdaAway }, false, home.power, away.power);
      const h = rows.get(homeId) as StandingRow;
      const a = rows.get(awayId) as StandingRow;
      h.played++;
      a.played++;
      h.goalsFor += score.home;
      h.goalsAgainst += score.away;
      a.goalsFor += score.away;
      a.goalsAgainst += score.home;
      if (score.home > score.away) {
        h.wins++;
        a.losses++;
        h.points += 3;
      } else if (score.home < score.away) {
        a.wins++;
        h.losses++;
        a.points += 3;
      } else {
        h.draws++;
        a.draws++;
        h.points++;
        a.points++;
      }
    }
  }
  return rankStandings(rows.values());
}

export function firstHalfRounds(world: SimulationWorld, leagueId: ID, seed: number, season: number): number {
  return Math.ceil(leagueSchedule(world, leagueId, seed, season).length / 2);
}

/** 시즌 중 다른 리그로 이적했을 때 새 리그의 전반기 순위표 */
export function simulateFirstHalfTable(world: SimulationWorld, leagueId: ID, seed: number, season: number): StandingRow[] {
  return simulateLeagueRounds(world, leagueId, seed, season, 0, firstHalfRounds(world, leagueId, seed, season));
}

export function simulateFullSeason(world: SimulationWorld, leagueId: ID, seed: number, season: number): StandingRow[] {
  return simulateLeagueRounds(world, leagueId, seed, season);
}
