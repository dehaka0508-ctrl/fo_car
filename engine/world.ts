/**
 * 시뮬레이션 월드: 정적 데이터(data/) + 구단 동적 상태(ClubState)
 */
import { CLUBS } from '@/data/clubs';
import { COMPETITIONS } from '@/data/competitions';
import { LEAGUES } from '@/data/leagues';
import { NATIONS } from '@/data/nations';
import type {
  ClubDefinition,
  ClubState,
  CompetitionDefinition,
  ID,
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
  };
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
