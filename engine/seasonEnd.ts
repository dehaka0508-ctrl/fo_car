/**
 * 시즌 종료 결산
 *
 * closeLeagueSeason (후반기 종료 직후)
 *  - 리그 시상 (득점왕·도움왕·MVP·베스트 11)
 *  - 주인공이 없는 리그는 실력으로 시즌을 시뮬레이션해 최종 순위를 만든다
 *  - 1·2부 승강, 구단 실력·명성·재정 갱신, 다음 시즌 대륙 대회 진출권
 * closeSeasonCycle (프리시즌 종료 직후 = 시즌 사이클 끝)
 *  - 세계 시상 (발롱도르·FIFA·월드 베스트 11·대륙/국가 올해의 선수)
 *  - 시즌 기록 저장, 나이 +1 (자연 성장·노화·아이템 노화 방어)
 *  - 경쟁 선수·파트너·라이벌 생태계 순환
 *  - 새 시즌 시작 체력 (프리시즌 휴식 + 대표팀 미차출 → 100), 다음 시즌으로 이동
 */
import type {
  ClubState,
  CompetitionType,
  GameState,
  ID,
  SeasonRecord,
  StandingRow,
} from '@/types/game';
import { leagueAwards, worldAwards } from './awards';
import { emptyStatsByCompetition } from './character';
import { applySeasonalAging } from './growth';
import { seasonStartCondition } from './interTurn';
import { simulateFullSeason } from './league';
import { evolveNarrative } from './narrative';
import { clamp, rngFor } from './rng';
import { mergeStatLines, summarizeSeasonRatings } from './simulator';
import { pushNotice } from './state';
import { rotateCompetitors } from './transfer';
import { clubName, type SimulationWorld } from './world';

export const CLUB_UPDATE_CONFIG = {
  /** 기대 순위 대비 성적 → 명성 변화 폭 */
  performanceWeight: 6,
  titleBonus: 2.5,
  promotionPrestige: 3,
  relegationPrestige: -6,
  /** 원래 명성으로 돌아가려는 힘 */
  prestigeReversion: 0.05,
  /** 실력이 명성·재정에 맞춰 이동하는 비율과 연간 최대 폭 */
  powerAdjustRate: 0.15,
  powerAdjustMax: 2,
} as const;

// ----------------------------------------------------------------------------
// 승강 · 구단 수치
// ----------------------------------------------------------------------------

function finalTables(state: GameState, world: SimulationWorld, season: number): Record<ID, StandingRow[]> {
  // 주인공이 뛴 리그는 실제 순위표를 쓰고, 나머지 리그는 시뮬레이션한다
  const playerLeague = state.leagueTable.length ? (world.clubStates[state.leagueTable[0].clubId]?.leagueId ?? null) : null;
  const tables: Record<ID, StandingRow[]> = {};
  for (const leagueId of Object.keys(world.leagues)) {
    tables[leagueId] =
      leagueId === playerLeague && state.leagueTable.length
        ? state.leagueTable
        : simulateFullSeason(world, leagueId, state.seed, season);
  }
  return tables;
}

export function applyPromotionRelegation(
  world: SimulationWorld,
  clubs: Record<ID, ClubState>,
  tables: Record<ID, StandingRow[]>,
): { clubs: Record<ID, ClubState>; promoted: Set<ID>; relegated: Set<ID> } {
  const promoted = new Set<ID>();
  const relegated = new Set<ID>();
  const next = { ...clubs };
  for (const upper of Object.values(world.leagues)) {
    if (!upper.lowerLeagueId) continue;
    const lower = world.leagues[upper.lowerLeagueId];
    const count = Math.min(upper.relegationSlots, lower.promotionSlots);
    const down = tables[upper.id].slice(-count).map((r) => r.clubId);
    const up = tables[lower.id]
      .filter((r) => world.clubs[r.clubId]?.promotionEligible !== false)
      .slice(0, count)
      .map((r) => r.clubId);
    for (const id of down) {
      next[id] = { ...next[id], leagueId: lower.id };
      relegated.add(id);
    }
    for (const id of up) {
      next[id] = { ...next[id], leagueId: upper.id };
      promoted.add(id);
    }
  }
  return { clubs: next, promoted, relegated };
}

function updateClubValues(
  state: GameState,
  world: SimulationWorld,
  clubs: Record<ID, ClubState>,
  tables: Record<ID, StandingRow[]>,
  promoted: Set<ID>,
  relegated: Set<ID>,
  season: number,
): Record<ID, ClubState> {
  const c = CLUB_UPDATE_CONFIG;
  const rng = rngFor(state.seed, 'club-update', season);
  const next = { ...clubs };

  for (const [leagueId, table] of Object.entries(tables)) {
    const league = world.leagues[leagueId];
    const byPower = [...table].sort((a, b) => world.clubStates[b.clubId].power - world.clubStates[a.clubId].power);
    for (const row of table) {
      const before = world.clubStates[row.clubId];
      const base = world.clubs[row.clubId];
      const expectedRank = byPower.findIndex((r) => r.clubId === row.clubId) + 1;
      const slot =
        league.tier === 1
          ? league.continentalSlots.find((s) => row.position >= s.fromPosition && row.position <= s.toPosition)
          : undefined;
      const isUp = promoted.has(row.clubId);
      const isDown = relegated.has(row.clubId);
      const prestigeDelta =
        ((expectedRank - row.position) / table.length) * c.performanceWeight +
        (row.position === 1 ? (league.tier === 1 ? c.titleBonus : 1) : 0) +
        (slot ? (slot.competitionId.endsWith('_CL') ? 1 : 0.5) : 0) +
        (isUp ? c.promotionPrestige : 0) +
        (isDown ? c.relegationPrestige : 0) +
        (base.prestige - before.prestige) * c.prestigeReversion;
      const prestige = clamp(before.prestige + prestigeDelta, 5, 99);
      const powerTarget = 50 + prestige * 0.4 + (before.finance - prestige) * 0.08;
      const power = clamp(
        before.power +
          clamp((powerTarget - before.power) * c.powerAdjustRate, -c.powerAdjustMax, c.powerAdjustMax) +
          rng.normal(0, 0.8) +
          (isUp ? 1 : 0) -
          (isDown ? 1.5 : 0),
        45,
        92,
      );
      const financeFloor = league.moneyLeague ? base.finance - 3 : 10;
      const finance = clamp(
        before.finance + prestigeDelta * 0.3 + (isUp ? 2 : 0) - (isDown ? 4 : 0) + (slot ? 1 : 0),
        financeFloor,
        99,
      );
      next[row.clubId] = {
        ...next[row.clubId],
        prestige: Math.round(prestige * 10) / 10,
        power: Math.round(power * 10) / 10,
        finance: Math.round(finance * 10) / 10,
        lastLeaguePosition: row.position,
        continentalCompetitionId: slot?.competitionId ?? null,
      };
    }
  }
  return next;
}

/** 후반기가 끝난 직후의 리그 결산 */
export function closeLeagueSeason(state: GameState, world: SimulationWorld): GameState {
  const season = state.seasonTurns.find((t) => t.turn.phase === 'SECOND_HALF')?.turn.season ?? state.turn.season;
  let next = state;

  // 1) 리그 시상
  const awards = leagueAwards(next, world, season);
  if (awards.ceremony) {
    next = { ...next, awards: [...next.awards, ...awards.awards], ceremonies: [...next.ceremonies, awards.ceremony] };
  }

  // 2) 최종 순위 · 승강 · 구단 수치
  const tables = finalTables(next, world, season);
  const moved = applyPromotionRelegation(world, next.clubs, tables);
  const clubs = updateClubValues(next, world, moved.clubs, tables, moved.promoted, moved.relegated, season);
  next = { ...next, clubs };

  const clubId = next.player.contract?.clubId;
  if (clubId) {
    const name = clubName(world, clubId);
    if (moved.promoted.has(clubId)) {
      next = pushNotice(next, { kind: 'PROMOTION', title: '승격!', body: `${name}이(가) ${world.leagues[clubs[clubId].leagueId].nameKo} 승격을 확정했다!`, popup: true });
    } else if (moved.relegated.has(clubId)) {
      next = pushNotice(next, { kind: 'PROMOTION', title: '강등…', body: `${name}이(가) ${world.leagues[clubs[clubId].leagueId].nameKo}로 강등됐다.`, popup: true });
    }
    const continental = clubs[clubId].continentalCompetitionId;
    if (continental) {
      next = pushNotice(next, {
        kind: 'INFO',
        title: '대륙 대회 진출',
        body: `${name}이(가) 다음 시즌 ${world.competitions[continental]?.nameKo ?? continental}에 나간다.`,
      });
    }
  }
  return next;
}

// ----------------------------------------------------------------------------
// 시즌 사이클 종료
// ----------------------------------------------------------------------------

function buildSeasonRecord(state: GameState, season: number): SeasonRecord {
  const stats = emptyStatsByCompetition();
  for (const turn of state.seasonTurns) {
    for (const type of Object.keys(stats) as CompetitionType[]) stats[type] = mergeStatLines(stats[type], turn.playerStats[type]);
  }
  const first = state.seasonTurns.find((t) => t.turn.phase === 'FIRST_HALF') ?? null;
  const second = state.seasonTurns.find((t) => t.turn.phase === 'SECOND_HALF') ?? null;
  const clubId = second?.clubId ?? first?.clubId ?? null;
  return {
    season,
    clubId,
    leagueId: second?.leagueId ?? first?.leagueId ?? null,
    age: state.player.age,
    ovrStart: state.seasonStart.ovr,
    ovrEnd: state.player.ovr,
    stats,
    ratings: summarizeSeasonRatings(first, second),
    leaguePosition: second?.leagueTable.find((r) => r.clubId === clubId)?.position ?? null,
    trophies: state.seasonTurns.flatMap((t) => t.trophies),
    awards: state.awards.filter((a) => a.season === season),
  };
}

/** 프리시즌이 끝난 직후: 세계 시상 → 시즌 기록 → 노화 → 생태계 → 다음 시즌 */
export function closeSeasonCycle(state: GameState, world: SimulationWorld): GameState {
  const season = state.seasonTurns.at(-1)?.turn.season ?? state.turn.season;
  const newSeason = season + 1;
  let next = state;

  // 1) 세계 시상
  const awards = worldAwards(next, world, season);
  if (awards.ceremony) {
    next = { ...next, awards: [...next.awards, ...awards.awards], ceremonies: [...next.ceremonies, awards.ceremony] };
  }
  for (const award of awards.awards) {
    if (award.type === 'BALLON_DOR' && award.rank === 1) {
      next = pushNotice(next, { kind: 'AWARD', title: '발롱도르 수상!', body: `${next.player.profile.name}이(가) 세계 최고의 선수로 선정됐다!`, popup: true });
    }
  }

  // 2) 시즌 기록
  next = { ...next, history: [...next.history, buildSeasonRecord(next, season)] };

  // 3) 나이 +1, 자연 성장·노화
  const aging = applySeasonalAging(next.player, rngFor(next.seed, 'aging', newSeason));
  next = { ...next, player: aging.player };
  const declines = Object.values(aging.deltas).filter((d) => (d ?? 0) < 0).reduce((s, d) => s + (d ?? 0), 0);
  if (declines <= -4) {
    const shielded = Object.values(aging.shielded).reduce((s, d) => s + (d ?? 0), 0);
    next = pushNotice(next, {
      kind: 'INFO',
      title: '세월의 흐름',
      body: `${next.player.age}세가 되며 능력치가 ${Math.abs(declines)}만큼 떨어졌다.${shielded > 0 ? ` (아이템 관리로 ${Math.round(shielded)} 방어)` : ''}`,
    });
  }

  // 4) 생태계 순환
  next = rotateCompetitors(next, world, newSeason);
  next = evolveNarrative(next, world, newSeason);

  // 5) 새 시즌 시작 체력
  const preseason = next.seasonTurns.find((t) => t.turn.phase === 'PRESEASON');
  const rested = Boolean(next.flags.PRESEASON_REST);
  const duty = Boolean(preseason?.nationalDuty);
  const condition = seasonStartCondition(next.player.condition, rested, duty);
  if (rested) {
    next = pushNotice(next, {
      kind: 'INFO',
      title: duty ? '휴식 계획 차질' : '완벽한 휴식',
      body: duty ? '여름 대표팀 일정 때문에 충분히 쉬지 못했다.' : '여름 내내 푹 쉬어 체력 100으로 새 시즌을 시작한다.',
    });
  }

  return {
    ...next,
    player: { ...next.player, condition },
    flags: {},
    progress: [],
    leagueTable: [],
    seasonTurns: [],
    seasonStart: { ovr: next.player.ovr, reputation: next.player.reputation },
    turn: { season: newSeason, phase: 'FIRST_HALF' },
  };
}
