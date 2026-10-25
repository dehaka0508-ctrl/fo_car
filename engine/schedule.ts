/**
 * 턴 일정 · 대진 생성기
 *
 * 한 턴에 열리는 모든 경기(Fixture)를 시간순으로 만든다.
 * - 전반기/후반기: 소속 리그 전 경기(순위표용), 국내컵, 대륙 대회, (1군이 아니면) B팀·유스 리그
 * - 프리시즌: 국가대표 메이저 대회(차출 시), 프리시즌 친선경기
 * 토너먼트는 이전 경기 승리(또는 조 통과)를 조건으로 미리 대진을 짜 두고,
 * 조건이 충족되지 않으면 시뮬레이터가 해당 경기를 건너뛴다.
 */
import {
  CONTINENTAL_FORMAT,
  DOMESTIC_CUP_ROUNDS,
  INTERNATIONAL_TOURNAMENTS,
  type InternationalTournamentDefinition,
} from '@/data/competitions';
import type {
  CompetitionDefinition,
  CompetitionProgress,
  Fixture,
  FixtureRequirement,
  ID,
  InternationalTournamentId,
  NationDefinition,
  PlayingTime,
  SquadLevel,
  TeamRef,
  TurnPointer,
} from '@/types/game';
import { hashSeed, rngFor, type Rng } from './rng';
import { clubRef, getLeagueClubIds, isRivalry, type SimulationWorld } from './world';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export interface GroupStage {
  id: ID;
  competitionId: ID;
  stageLabel: string;
  teamIds: ID[];
  fixtureIds: ID[];
  playerTeamId: ID;
  advance: number;
  thirdPlaceAdvanceChance: number;
}

/** 프리시즌 국가대표 차출 정보 */
export interface NationalDuty {
  tournamentId: InternationalTournamentId;
  team: TeamRef;
  playingTime: PlayingTime;
}

export interface TurnPlanInput {
  seed: number;
  turn: TurnPointer;
  world: SimulationWorld;
  clubId: ID | null;
  squadLevel: SquadLevel;
  progress: readonly CompetitionProgress[];
  nationalDuty: NationalDuty | null;
}

export interface TurnPlan {
  fixtures: Fixture[];
  groups: GroupStage[];
}

// ---------------------------------------------------------------------------
// 공용 유틸
// ---------------------------------------------------------------------------

const weekendDay = (week: number) => week * 7 + 5;
const midweekDay = (week: number) => week * 7 + 2;

/** 턴이 속한 달력 연도 (전반기 = 시즌 시작 연도, 후반기·프리시즌 = 다음 해) */
export function calendarYear(turn: TurnPointer): number {
  return turn.phase === 'FIRST_HALF' ? turn.season : turn.season + 1;
}

/** 서클 방식 라운드로빈. cycles가 짝수 번째면 홈·원정을 뒤집는다. */
export function buildRoundRobin(
  teamIds: readonly ID[],
  cycles: number,
  seed: number,
): Array<Array<[ID, ID]>> {
  const rng = rngFor(seed, 'round-robin');
  const teams: Array<ID | null> = rng.shuffle(teamIds);
  if (teams.length % 2 === 1) teams.push(null);
  const n = teams.length;

  const cycle: Array<Array<[ID, ID]>> = [];
  let order = [...teams];
  for (let r = 0; r < n - 1; r++) {
    const round: Array<[ID, ID]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      if (a === null || b === null) continue;
      const flip = i === 0 ? r % 2 === 1 : (r + i) % 2 === 1;
      round.push(flip ? [b, a] : [a, b]);
    }
    cycle.push(round);
    order = [order[0], order[n - 1], ...order.slice(1, n - 1)];
  }

  const rounds: Array<Array<[ID, ID]>> = [];
  for (let c = 0; c < cycles; c++) {
    for (const round of cycle) {
      rounds.push(c % 2 === 0 ? round : round.map(([h, a]): [ID, ID] => [a, h]));
    }
  }
  return rounds;
}

/** 토너먼트 상대 추첨. depth(0~1)가 클수록 강팀이 뽑힐 확률이 높다. */
function drawOpponent(rng: Rng, pool: readonly TeamRef[], used: Set<ID>, depth: number): TeamRef {
  const avg = pool.reduce((sum, t) => sum + t.power, 0) / pool.length;
  let weights = pool.map((t) => (used.has(t.id) ? 0 : Math.exp((t.power - avg) * 0.08 * depth)));
  if (weights.every((w) => w === 0)) weights = pool.map(() => 1);
  const pick = pool[rng.weightedIndex(weights)];
  used.add(pick.id);
  return pick;
}

function progressStatus(progress: readonly CompetitionProgress[], competitionId: ID) {
  return progress.find((p) => p.competitionId === competitionId)?.status;
}

class PlanBuilder {
  readonly fixtures: Fixture[] = [];
  readonly groups: GroupStage[] = [];
  private readonly playerDays = new Set<number>();

  constructor(readonly input: TurnPlanInput) {}

  add(fixture: Fixture) {
    this.fixtures.push(fixture);
    if (fixture.playerTeamSide) this.playerDays.add(fixture.day);
  }

  /** 주인공 팀 경기와 겹치지 않는 가장 가까운 날 */
  freeDay(desired: number): number {
    let day = desired;
    while (this.playerDays.has(day)) day++;
    return day;
  }

  rng(...parts: Array<string | number>): Rng {
    return rngFor(this.input.seed, this.input.turn.season, this.input.turn.phase, ...parts);
  }

  build(): TurnPlan {
    // 같은 날짜는 추가 순서를 유지 (Array.sort는 안정 정렬)
    return { fixtures: [...this.fixtures].sort((a, b) => a.day - b.day), groups: this.groups };
  }
}

// ---------------------------------------------------------------------------
// 리그
// ---------------------------------------------------------------------------

/** 소속 리그의 이번 턴 라운드 전체를 추가하고 라운드 수(주 수)를 돌려준다. */
function planLeague(b: PlanBuilder, clubId: ID): number {
  const { world, turn, seed } = b.input;
  const leagueId = world.clubStates[clubId].leagueId;
  const league = world.leagues[leagueId];
  const rounds = buildRoundRobin(
    getLeagueClubIds(world, leagueId),
    league.roundRobinCycles,
    hashSeed(seed, 'league', turn.season, leagueId),
  );
  const firstHalfRounds = Math.ceil(rounds.length / 2);
  const [from, to] = turn.phase === 'FIRST_HALF' ? [0, firstHalfRounds] : [firstHalfRounds, rounds.length];

  for (let r = from; r < to; r++) {
    const day = weekendDay(r - from);
    for (const [home, away] of rounds[r]) {
      const side = home === clubId ? 'HOME' : away === clubId ? 'AWAY' : null;
      const isDerby = isRivalry(world, home, away);
      b.add({
        id: `L:${leagueId}:${turn.season}:R${r + 1}:${home}:${away}`,
        competitionId: leagueId,
        competitionType: 'LEAGUE',
        stage: `${r + 1}라운드`,
        day,
        home: clubRef(world, home),
        away: clubRef(world, away),
        neutral: false,
        playerTeamSide: side,
        squad: side ? 'FIRST' : null,
        knockout: false,
        isFinal: false,
        isDerby,
        importance: isDerby ? 'HIGH' : 'NORMAL',
      });
    }
  }
  return to - from;
}

// ---------------------------------------------------------------------------
// 국내 컵
// ---------------------------------------------------------------------------

function domesticPool(world: SimulationWorld, clubId: ID): TeamRef[] {
  const nation = world.clubs[clubId].nation;
  const topLeague = Object.values(world.leagues).find((l) => l.nation === nation && l.tier === 1);
  const clubs = Object.values(world.clubStates)
    .filter((s) => s.clubId !== clubId && world.clubs[s.clubId].nation === nation)
    .map((s) => clubRef(world, s.clubId));
  // 하부 리그 데이터가 없는 국가를 위한 가상 하부 리그 팀
  const lowerBase = (topLeague?.strength ?? 65) - 14;
  const nationName = world.nations[nation]?.nameKo ?? nation;
  const generic: TeamRef[] = [0, 1, 2, 3].map((i) => ({
    id: `generic:${nation}:lower:${i}`,
    name: `${nationName} 하부리그 ${String.fromCharCode(65 + i)}`,
    power: lowerBase + i * 2,
    kind: 'GENERIC',
  }));
  return [...clubs, ...generic];
}

function planDomesticCup(b: PlanBuilder, clubId: ID, weeks: number) {
  const { world, turn, progress } = b.input;
  const league = world.leagues[world.clubStates[clubId].leagueId];
  const cupId = league.domesticCupId;
  const rounds = DOMESTIC_CUP_ROUNDS.filter((round) => round.phase === turn.phase);
  if (rounds.length === 0) return;
  if (turn.phase === 'SECOND_HALF' && progressStatus(progress, cupId) !== 'ACTIVE') return;

  const rng = b.rng('cup-draw', cupId);
  const pool = domesticPool(world, clubId);
  const used = new Set<ID>();
  const me = clubRef(world, clubId);
  const weekFractions = turn.phase === 'FIRST_HALF' ? [0.3, 0.7] : [0.25, 0.55];
  let previous: ID | undefined;

  rounds.forEach((round, k) => {
    const roundIndex = DOMESTIC_CUP_ROUNDS.indexOf(round);
    const opponent = drawOpponent(rng, pool, used, roundIndex / (DOMESTIC_CUP_ROUNDS.length - 1));
    const isHome = round.final ? true : rng.chance(0.5);
    const day = round.final
      ? weekendDay(weeks) + 7
      : b.freeDay(midweekDay(Math.max(1, Math.round(weeks * weekFractions[k]))));
    const id = `C:${cupId}:${turn.season}:${round.stage}`;
    b.add({
      id,
      competitionId: cupId,
      competitionType: 'DOMESTIC_CUP',
      stage: round.stage,
      day,
      home: isHome ? me : opponent,
      away: isHome ? opponent : me,
      neutral: Boolean(round.final),
      playerTeamSide: isHome ? 'HOME' : 'AWAY',
      squad: 'FIRST',
      knockout: true,
      isFinal: Boolean(round.final),
      isDerby: isRivalry(world, clubId, opponent.id),
      importance: round.final ? 'FINAL' : roundIndex >= 3 ? 'HIGH' : 'LOW',
      requires: previous ? { kind: 'WIN', fixtureId: previous } : undefined,
    });
    previous = id;
  });
}

// ---------------------------------------------------------------------------
// 대륙 대회
// ---------------------------------------------------------------------------

/** 대륙 대회 데이터가 부족할 때 쓰는 가상 상대의 실력 */
const GENERIC_CONTINENTAL_POWER: Record<string, number> = {
  UEFA_CL: 81,
  UEFA_EL: 76,
  UEFA_ECL: 72,
  AFC_CL: 64,
  CONMEBOL_LIB: 72,
  CONCACAF_CC: 67,
  CAF_CL: 62,
};

function continentalPool(
  world: SimulationWorld,
  competition: CompetitionDefinition,
  clubId: ID,
  rng: Rng,
): TeamRef[] {
  const ownLeague = world.clubStates[clubId].leagueId;
  const sameConfederation = Object.values(world.clubStates).filter(
    (s) =>
      s.clubId !== clubId &&
      s.leagueId !== ownLeague &&
      world.leagues[s.leagueId]?.confederation === competition.confederation,
  );
  const qualified = sameConfederation.filter((s) => s.continentalCompetitionId === competition.id);
  const source = qualified.length >= 3 ? qualified : sameConfederation;
  const pool = source.map((s) => clubRef(world, s.clubId));

  const base = GENERIC_CONTINENTAL_POWER[competition.id] ?? 65;
  for (let i = 0; pool.length < 6; i++) {
    pool.push({
      id: `generic:${competition.id}:${i}`,
      name: `${competition.confederation ?? ''} 클럽 ${String.fromCharCode(65 + i)}`,
      power: Math.round(base + rng.normal(0, 3)),
      kind: 'GENERIC',
    });
  }
  return pool;
}

function planContinental(b: PlanBuilder, clubId: ID, weeks: number) {
  const { world, turn, progress, seed } = b.input;
  const competitionId = world.clubStates[clubId].continentalCompetitionId;
  if (!competitionId) return;
  const competition = world.competitions[competitionId];
  const rng = b.rng('continental-draw', competitionId);
  const pool = continentalPool(world, competition, clubId, rng);
  const me = clubRef(world, clubId);

  if (turn.phase === 'FIRST_HALF') {
    const used = new Set<ID>();
    const opponents = [0, 1, 2].map(() => drawOpponent(rng, pool, used, 0));
    const teams = [me, ...opponents];
    const refs = Object.fromEntries(teams.map((t) => [t.id, t]));
    const groupId = `G:${competitionId}:${turn.season}`;
    const fixtureIds: ID[] = [];
    const rounds = buildRoundRobin(
      teams.map((t) => t.id),
      CONTINENTAL_FORMAT.groupCycles,
      hashSeed(seed, groupId),
    );
    rounds.forEach((round, md) => {
      const day = b.freeDay(midweekDay(Math.max(1, Math.round(((md + 1) * weeks) / (rounds.length + 1)))));
      for (const [home, away] of round) {
        const side = home === clubId ? 'HOME' : away === clubId ? 'AWAY' : null;
        const id = `CG:${competitionId}:${turn.season}:MD${md + 1}:${home}:${away}`;
        fixtureIds.push(id);
        b.add({
          id,
          competitionId,
          competitionType: 'CONTINENTAL',
          stage: `조별리그 ${md + 1}차전`,
          day,
          home: refs[home],
          away: refs[away],
          neutral: false,
          playerTeamSide: side,
          squad: side ? 'FIRST' : null,
          knockout: false,
          isFinal: false,
          isDerby: false,
          importance: 'HIGH',
        });
      }
    });
    b.groups.push({
      id: groupId,
      competitionId,
      stageLabel: '조별리그',
      teamIds: teams.map((t) => t.id),
      fixtureIds,
      playerTeamId: clubId,
      advance: CONTINENTAL_FORMAT.advancePerGroup,
      thirdPlaceAdvanceChance: 0,
    });
    return;
  }

  if (turn.phase !== 'SECOND_HALF' || progressStatus(progress, competitionId) !== 'ACTIVE') return;

  const used = new Set<ID>();
  const fractions = [0.15, 0.4, 0.65];
  const stages = CONTINENTAL_FORMAT.knockout;
  let previous: ID | undefined;
  stages.forEach((round, k) => {
    const opponent = drawOpponent(rng, pool, used, (k + 1) / stages.length);
    const isHome = round.final ? true : rng.chance(0.5);
    const day = round.final
      ? weekendDay(weeks) + 14
      : b.freeDay(midweekDay(Math.max(1, Math.round(weeks * fractions[k]))));
    const id = `CK:${competitionId}:${turn.season}:${round.stage}`;
    b.add({
      id,
      competitionId,
      competitionType: 'CONTINENTAL',
      stage: round.stage,
      day,
      home: isHome ? me : opponent,
      away: isHome ? opponent : me,
      neutral: Boolean(round.final),
      playerTeamSide: isHome ? 'HOME' : 'AWAY',
      squad: 'FIRST',
      knockout: true,
      isFinal: Boolean(round.final),
      isDerby: isRivalry(world, clubId, opponent.id),
      importance: round.final ? 'FINAL' : 'HIGH',
      requires: previous ? { kind: 'WIN', fixtureId: previous } : undefined,
    });
    previous = id;
  });
}

// ---------------------------------------------------------------------------
// B팀 · 유스
// ---------------------------------------------------------------------------

export const RESERVE_POWER_OFFSET: Record<Exclude<SquadLevel, 'FIRST_TEAM'>, number> = {
  RESERVE: 12,
  YOUTH: 18,
};

export function reserveRef(world: SimulationWorld, clubId: ID, level: Exclude<SquadLevel, 'FIRST_TEAM'>): TeamRef {
  const base = clubRef(world, clubId);
  return {
    id: `${clubId}#${level}`,
    name: `${base.name} ${level === 'YOUTH' ? 'U19' : 'B'}`,
    power: base.power - RESERVE_POWER_OFFSET[level],
    kind: 'CLUB',
  };
}

function planReserve(b: PlanBuilder, clubId: ID, weeks: number) {
  const { world, turn, squadLevel } = b.input;
  if (squadLevel === 'FIRST_TEAM') return;
  const level = squadLevel;
  const leagueId = world.clubStates[clubId].leagueId;
  const rng = b.rng('reserve', clubId);
  const opponents = rng.shuffle(getLeagueClubIds(world, leagueId).filter((id) => id !== clubId));
  const me = reserveRef(world, clubId, level);
  const count = Math.max(4, Math.ceil(weeks * 0.6));

  for (let i = 0; i < count; i++) {
    const opponentClub = opponents[i % opponents.length];
    const opponent = reserveRef(world, opponentClub, level);
    const isHome = i % 2 === 0;
    b.add({
      id: `R:${turn.season}:${turn.phase}:${i + 1}:${opponentClub}`,
      competitionId: 'RESERVE_LEAGUE',
      competitionType: 'RESERVE',
      stage: `${level === 'YOUTH' ? 'U19' : 'B팀'} ${i + 1}차전`,
      day: Math.floor((i * weeks) / count) * 7 + 6,
      home: isHome ? me : opponent,
      away: isHome ? opponent : me,
      neutral: false,
      playerTeamSide: isHome ? 'HOME' : 'AWAY',
      squad: 'RESERVE',
      knockout: false,
      isFinal: false,
      isDerby: isRivalry(world, clubId, opponentClub),
      importance: 'LOW',
    });
  }
}

// ---------------------------------------------------------------------------
// 프리시즌: 국제대회 + 친선경기
// ---------------------------------------------------------------------------

export function findTournament(id: InternationalTournamentId): InternationalTournamentDefinition {
  const tournament = INTERNATIONAL_TOURNAMENTS.find((t) => t.id === id);
  if (!tournament) throw new Error(`Unknown tournament: ${id}`);
  return tournament;
}

function nationRef(nation: NationDefinition, tournament: InternationalTournamentDefinition): TeamRef {
  return {
    id: `nation:${nation.code}`,
    name: tournament.ageLimit ? `${nation.nameKo} U-${tournament.ageLimit}` : nation.nameKo,
    power: nation.power + (tournament.teamPowerOffset ?? 0),
    kind: 'NATION',
  };
}

function participates(tournament: InternationalTournamentDefinition, nation: NationDefinition): boolean {
  const inConfederation =
    tournament.confederations === 'GLOBAL' || tournament.confederations.includes(nation.confederation);
  return inConfederation && (!tournament.minNationPower || nation.power >= tournament.minNationPower);
}

/** 본선 진출 확률 근사 (월드컵 48개국, 대륙컵 24개국 등) */
function qualificationChance(tournament: InternationalTournamentDefinition, nation: NationDefinition): number {
  switch (tournament.id) {
    case 'WORLD_CUP':
      return nation.power >= 78 ? 0.95 : nation.power >= 72 ? 0.75 : nation.power >= 66 ? 0.4 : 0.12;
    case 'OLYMPICS':
      return nation.power >= 78 ? 0.6 : 0.3;
    case 'COPA_AMERICA':
    case 'NATIONS_LEAGUE':
      return 1;
    default:
      return nation.power >= 72 ? 0.9 : 0.55;
  }
}

function nationalPlayingTime(ovr: number, teamPower: number, isGoalkeeper: boolean): PlayingTime {
  const diff = ovr - teamPower;
  if (isGoalkeeper) return diff >= -1 ? 'GK_FIRST' : diff >= -5 ? 'GK_SECOND' : 'GK_THIRD';
  if (diff >= 4) return 'KEY';
  if (diff >= -1) return 'STARTER';
  if (diff >= -5) return 'ROTATION';
  return 'BACKUP';
}

/**
 * 이번 여름 국가대표 메이저 대회 차출 판정.
 * 같은 해 대회가 겹치면 우선순위가 높은 대회부터 본선 진출·발탁 여부를 본다.
 */
export function evaluateNationalDuty(params: {
  seed: number;
  turn: TurnPointer;
  world: SimulationWorld;
  nationality: string;
  ovr: number;
  reputation: number;
  age: number;
  isGoalkeeper: boolean;
}): NationalDuty | null {
  const { seed, turn, world, nationality, ovr, reputation, age, isGoalkeeper } = params;
  if (turn.phase !== 'PRESEASON') return null;
  const nation = world.nations[nationality];
  if (!nation) return null;

  const year = calendarYear(turn);
  const candidates = INTERNATIONAL_TOURNAMENTS.filter(
    (t) => year % t.every === t.offset && participates(t, nation),
  ).sort((a, b) => b.priority - a.priority);

  for (const tournament of candidates) {
    const qualified = rngFor(seed, 'qualify', year, tournament.id, nation.code).chance(
      qualificationChance(tournament, nation),
    );
    if (!qualified) continue;

    const team = nationRef(nation, tournament);
    const form = rngFor(seed, 'call-up', year, tournament.id).normal(0, 1.5);
    let selected: boolean;
    if (tournament.ageLimit) {
      selected =
        age <= tournament.ageLimit
          ? ovr + reputation * 0.03 + form >= team.power - 6
          : ovr >= nation.power + 3; // 와일드카드
    } else {
      selected = ovr + reputation * 0.04 + form >= nation.power - 8;
    }
    if (selected) {
      return {
        tournamentId: tournament.id,
        team,
        playingTime: nationalPlayingTime(ovr, team.power, isGoalkeeper),
      };
    }
  }
  return null;
}

/** 국제대회 일정을 추가하고 마지막 경기 가능일을 돌려준다. */
function planInternational(b: PlanBuilder, duty: NationalDuty): number {
  const { world, turn, seed } = b.input;
  const tournament = findTournament(duty.tournamentId);
  const rng = b.rng('international-draw', tournament.id);
  const pool = Object.values(world.nations)
    .filter((n) => `nation:${n.code}` !== duty.team.id && participates(tournament, n))
    .map((n) => nationRef(n, tournament));
  const me = duty.team;
  const used = new Set<ID>();
  let day = 3;
  let requirement: FixtureRequirement | undefined;

  if (tournament.hasGroupStage) {
    const opponents = [0, 1, 2].map(() => drawOpponent(rng, pool, used, 0));
    const teams = [me, ...opponents];
    const refs = Object.fromEntries(teams.map((t) => [t.id, t]));
    const groupId = `IG:${tournament.id}:${turn.season}`;
    const fixtureIds: ID[] = [];
    const rounds = buildRoundRobin(
      teams.map((t) => t.id),
      1,
      hashSeed(seed, groupId),
    );
    rounds.forEach((round, md) => {
      day = 3 + md * 4;
      for (const [home, away] of round) {
        const side = home === me.id ? 'HOME' : away === me.id ? 'AWAY' : null;
        const id = `IG:${tournament.id}:${turn.season}:MD${md + 1}:${home}:${away}`;
        fixtureIds.push(id);
        b.add({
          id,
          competitionId: tournament.id,
          competitionType: 'INTERNATIONAL',
          stage: `조별리그 ${md + 1}차전`,
          day,
          home: refs[home],
          away: refs[away],
          neutral: true,
          playerTeamSide: side,
          squad: side ? 'NATIONAL' : null,
          knockout: false,
          isFinal: false,
          isDerby: false,
          importance: 'HIGH',
        });
      }
    });
    b.groups.push({
      id: groupId,
      competitionId: tournament.id,
      stageLabel: '조별리그',
      teamIds: teams.map((t) => t.id),
      fixtureIds,
      playerTeamId: me.id,
      advance: 2,
      thirdPlaceAdvanceChance: tournament.thirdPlaceAdvanceChance,
    });
    requirement = { kind: 'GROUP_ADVANCE', groupId };
  }

  const stages = tournament.knockoutStages;
  stages.forEach((stage, k) => {
    day += 4;
    const opponent = drawOpponent(rng, pool, used, (k + 1) / stages.length);
    const isFinal = k === stages.length - 1;
    const id = `IK:${tournament.id}:${turn.season}:${stage}`;
    b.add({
      id,
      competitionId: tournament.id,
      competitionType: 'INTERNATIONAL',
      stage,
      day,
      home: k % 2 === 0 ? me : opponent,
      away: k % 2 === 0 ? opponent : me,
      neutral: true,
      playerTeamSide: k % 2 === 0 ? 'HOME' : 'AWAY',
      squad: 'NATIONAL',
      knockout: true,
      isFinal,
      isDerby: false,
      importance: isFinal ? 'FINAL' : 'HIGH',
      requires: requirement,
    });
    requirement = { kind: 'WIN', fixtureId: id };
  });
  return day;
}

function planFriendlies(b: PlanBuilder, clubId: ID, days: number[]) {
  const { world, turn } = b.input;
  const rng = b.rng('friendlies', clubId);
  const me = clubRef(world, clubId);
  const candidates = Object.values(world.clubStates)
    .filter((s) => s.clubId !== clubId && Math.abs(s.power - me.power) <= 10)
    .map((s) => clubRef(world, s.clubId));
  const pool: TeamRef[] = candidates.length
    ? candidates
    : [{ id: 'generic:friendly', name: '친선 상대', power: me.power - 3, kind: 'GENERIC' }];
  const used = new Set<ID>();

  days.forEach((desired, i) => {
    const opponent = drawOpponent(rng, pool, used, 0);
    const isHome = rng.chance(0.5);
    b.add({
      id: `F:${turn.season}:${i + 1}:${opponent.id}`,
      competitionId: 'CLUB_FRIENDLY',
      competitionType: 'FRIENDLY',
      stage: `친선경기 ${i + 1}`,
      day: b.freeDay(desired),
      home: isHome ? me : opponent,
      away: isHome ? opponent : me,
      neutral: rng.chance(0.4),
      playerTeamSide: isHome ? 'HOME' : 'AWAY',
      squad: 'FIRST',
      knockout: false,
      isFinal: false,
      isDerby: isRivalry(world, clubId, opponent.id),
      importance: 'LOW',
    });
  });
}

// ---------------------------------------------------------------------------
// 진입점
// ---------------------------------------------------------------------------

export function planTurn(input: TurnPlanInput): TurnPlan {
  const b = new PlanBuilder(input);
  const { clubId, turn, nationalDuty } = input;

  if (turn.phase === 'PRESEASON') {
    const lastInternationalDay = nationalDuty ? planInternational(b, nationalDuty) : 0;
    if (clubId) {
      // 대표팀 차출이 있으면 복귀 후 친선경기 1회만
      planFriendlies(b, clubId, nationalDuty ? [lastInternationalDay + 6] : [10, 17, 24, 31]);
    }
    return b.build();
  }

  if (!clubId) return b.build();
  const weeks = planLeague(b, clubId);
  planContinental(b, clubId, weeks);
  planDomesticCup(b, clubId, weeks);
  planReserve(b, clubId, weeks);
  return b.build();
}
