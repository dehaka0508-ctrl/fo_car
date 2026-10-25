/**
 * 시뮬레이션 월드: 정적 데이터(data/) + 구단 동적 상태(ClubState)
 */
import { CLUBS } from '@/data/clubs';
import { COMPETITIONS } from '@/data/competitions';
import { CLUB_LEGENDS, HISTORIC_RECORDS } from '@/data/legends';
import { LEAGUES } from '@/data/leagues';
import { NATIONS } from '@/data/nations';
import type {
  ClubDefinition,
  ClubLegend,
  ClubState,
  CompetitionDefinition,
  HistoricRecord,
  ID,
  KitColors,
  LeagueDefinition,
  NationDefinition,
  TeamRef,
} from '@/types/game';

export interface SimulationWorld {
  leagues: Record<ID, LeagueDefinition>;
  clubs: Record<ID, ClubDefinition>;
  nations: Record<string, NationDefinition>;
  competitions: Record<ID, CompetitionDefinition>;
  clubStates: Record<ID, ClubState>;
  legends: Record<ID, ClubLegend[]>;
  records: HistoricRecord[];
}

/**
 * 게임 시작 시 구단 상태를 만든다.
 * 직전 시즌 순위 데이터가 없으므로 실력 순위를 직전 시즌 순위로 간주해 대륙 대회 진출권을 배정한다.
 */
export function createInitialClubStates(
  leagues: Record<ID, LeagueDefinition>,
  clubs: Record<ID, ClubDefinition>,
): Record<ID, ClubState> {
  const states: Record<ID, ClubState> = {};
  for (const league of Object.values(leagues)) {
    const members = Object.values(clubs)
      .filter((club) => club.leagueId === league.id)
      .sort((a, b) => b.power - a.power || b.prestige - a.prestige);
    members.forEach((club, index) => {
      const position = index + 1;
      const slot = league.continentalSlots.find(
        (s) => position >= s.fromPosition && position <= s.toPosition,
      );
      states[club.id] = {
        clubId: club.id,
        leagueId: league.id,
        power: club.power,
        prestige: club.prestige,
        finance: club.finance,
        continentalCompetitionId: slot?.competitionId ?? null,
        lastLeaguePosition: position,
        squadNpcIds: [],
        squadSeason: null,
      };
    });
  }
  return states;
}

export function createDefaultWorld(): SimulationWorld {
  return {
    leagues: LEAGUES,
    clubs: CLUBS,
    nations: NATIONS,
    competitions: COMPETITIONS,
    clubStates: createInitialClubStates(LEAGUES, CLUBS),
    legends: CLUB_LEGENDS,
    records: HISTORIC_RECORDS,
  };
}

/** 정적 데이터는 공유하고 구단 동적 상태만 세이브의 것으로 바꾼 월드 */
export function worldWithClubStates(base: SimulationWorld, clubStates: Record<ID, ClubState>): SimulationWorld {
  return { ...base, clubStates };
}

export function legendsFor(world: SimulationWorld, clubId: ID): ClubLegend[] {
  return world.clubs[clubId]?.legends ?? world.legends[clubId] ?? [];
}

/** 팀 id(구단·리저브·국가대표)로 유니폼 색을 찾는다. 가상 팀은 null */
export function kitColorsFor(world: SimulationWorld, teamId: ID): KitColors | null {
  if (teamId.startsWith('nation:')) return world.nations[teamId.slice(7)]?.kitColors ?? null;
  return world.clubs[teamId.split('#')[0]]?.kitColors ?? null;
}

export function clubName(world: SimulationWorld, clubId: ID | null | undefined): string {
  if (!clubId) return '무소속';
  return world.clubs[clubId]?.nameKo ?? clubId;
}

export function getLeagueClubIds(world: SimulationWorld, leagueId: ID): ID[] {
  return Object.values(world.clubStates)
    .filter((state) => state.leagueId === leagueId)
    .map((state) => state.clubId)
    .sort();
}

export function clubRef(world: SimulationWorld, clubId: ID): TeamRef {
  const club = world.clubs[clubId];
  return {
    id: clubId,
    name: club.nameKo,
    power: world.clubStates[clubId]?.power ?? club.power,
    kind: 'CLUB',
  };
}

export function isRivalry(world: SimulationWorld, a: ID, b: ID): boolean {
  return Boolean(world.clubs[a]?.rivals.includes(b) || world.clubs[b]?.rivals.includes(a));
}
