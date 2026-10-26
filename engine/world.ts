/**
 * 시뮬레이션 월드: 정적 데이터(data/) + 구단 동적 상태(ClubState)
 */
import { COMPETITIONS } from '@/data/competitions';
import { DATABASE } from '@/data/database';
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

/** 직전 시즌 실적으로 정하는 시작 순서: 강등팀 → 잔류팀(직전 순위) → 승격팀, 정보가 없으면 실력순 */
function initialOrder(a: ClubDefinition, b: ClubDefinition): number {
  const group = (c: ClubDefinition) => (c.lastSeason?.movement === 'DOWN' ? 0 : c.lastSeason?.movement === 'UP' ? 2 : 1);
  const rank = (c: ClubDefinition) => (c.lastSeason?.movement === null ? (c.lastSeason?.leagueRank ?? null) : null);
  const byPower = b.power - a.power || b.prestige - a.prestige;
  if (group(a) !== group(b)) return group(a) - group(b);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== null && rb !== null && ra !== rb) return ra - rb;
  if ((ra === null) !== (rb === null)) return ra === null ? 1 : -1;
  return byPower;
}

/**
 * 게임 시작 시 구단 상태를 만든다.
 * 외부 DB에 직전 시즌 순위·다음 시즌 대륙 대회가 있으면 그대로 쓰고,
 * 없으면 실력 순위를 직전 시즌 순위로 간주해 대륙 대회 진출권을 배정한다.
 */
export function createInitialClubStates(
  leagues: Record<ID, LeagueDefinition>,
  clubs: Record<ID, ClubDefinition>,
): Record<ID, ClubState> {
  const states: Record<ID, ClubState> = {};
  for (const league of Object.values(leagues)) {
    const members = Object.values(clubs)
      .filter((club) => club.leagueId === league.id)
      .sort(initialOrder);
    const continentalFromData = members.some((club) => club.lastSeason && 'continental' in club.lastSeason);
    members.forEach((club, index) => {
      const position = index + 1;
      const fromSlots = league.continentalSlots.find(
        (s) => position >= s.fromPosition && position <= s.toPosition,
      );
      const slot = continentalFromData
        ? club.lastSeason?.continental
          ? { competitionId: club.lastSeason.continental }
          : undefined
        : fromSlots;
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

/** 내장 샘플 + 외부 DB(data/external/)를 합친 데이터베이스로 월드를 만든다 */
export function createDefaultWorld(): SimulationWorld {
  return {
    leagues: DATABASE.leagues,
    clubs: DATABASE.clubs,
    nations: NATIONS,
    competitions: COMPETITIONS,
    clubStates: createInitialClubStates(DATABASE.leagues, DATABASE.clubs),
    legends: DATABASE.legends,
    records: DATABASE.records,
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

const searchKey = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\b(fc|cf|afc|sc|ac|f\.c\.|c\.f\.)\b/g, '')
    .replace(/[^a-z0-9가-힣]/g, '');

/**
 * 구단 이름(한글·영문·약칭) 또는 ID로 구단을 찾는다. 외부 DB를 바꿔도 화면·스크립트의 기본 구단이 깨지지 않도록.
 * 여러 개가 맞으면 nation이 같은 쪽 → 정확히 같은 이름 → 상위 리그 → 명성 순.
 */
export function findClubId(clubs: Record<ID, ClubDefinition>, query: string, nation?: string): ID | null {
  if (clubs[query]) return query;
  const key = searchKey(query);
  if (!key) return null;
  const candidates: Array<{ id: ID; exact: boolean; club: ClubDefinition }> = [];
  const loose: typeof candidates = [];
  for (const club of Object.values(clubs)) {
    const names = [club.name, club.nameKo, club.shortName, club.id].map(searchKey);
    const exact = names.includes(key);
    if (exact || names.some((n) => n.startsWith(key))) candidates.push({ id: club.id, exact, club });
    // 'RCD Mallorca' ↔ 'Mallorca'처럼 한쪽이 다른 쪽을 품는 이름 (짧은 이름은 오인이 많아 제외)
    else if (names.some((n) => n.length >= 5 && key.length >= 5 && (n.includes(key) || key.includes(n)))) loose.push({ id: club.id, exact: false, club });
  }
  if (!candidates.length) candidates.push(...loose);
  if (!candidates.length) return null;
  candidates.sort(
    (a, b) =>
      Number(b.club.nation === nation) - Number(a.club.nation === nation) ||
      Number(b.exact) - Number(a.exact) ||
      b.club.prestige - a.club.prestige,
  );
  return candidates[0].id;
}
