/**
 * 이적 · 임대 · 재계약 · 경쟁 선수 생태계
 *
 * 자동 오퍼 (턴 종료 시)
 *  1) 오퍼 개수를 먼저 정한다: 0~3개 (FA는 1~5개). 활약이 좋거나 계약 만료가 다가오면 늘어난다.
 *  2) 개수만큼 종류(재계약 / 임대 / 완전 이적)와 팀을 고른다.
 *     팀은 실력이 내 OVR과 비슷하고 명성 차이가 크지 않을수록 자주 뽑힌다.
 *     자본 리그(사우디·MLS)는 명성이 낮아도 재정으로 고연봉을 제시한다.
 *  3) 계약 조건(기간·연봉·보장 출전시간)과 이적료를 만든다. 구단 간 이적료 합의는 끝난 상태로 가정한다.
 * 능동 협상: 턴당 타 구단 역제의 3회 + 현 소속팀 재계약 요청 1회.
 * 경쟁 선수: 오퍼·역제의 팀의 동 포지션 선수 0~3명을 보여 주고, 시즌마다 이적·은퇴로 순환한다.
 */
import type {
  CompetitionProgress,
  Contract,
  ContractType,
  GameState,
  ID,
  NpcPlayer,
  OfferType,
  PlayingTime,
  SquadCompetitor,
  TransferOffer,
  TurnPointer,
} from '@/types/game';
import { PLAYING_TIME_LABELS } from '@/data/labels';
import { areNeighbors } from '@/data/regions';
import { determineInitialSquadStatus } from './character';
import { simulateFirstHalfTable } from './league';
import { evaluateDeparture } from './records';
import { separatePartnerIfLeaving } from './narrative';
import { ageNpcOneSeason, createNpc, npcAge } from './npc';
import { clamp, hashSeed, rngFor, type Rng } from './rng';
import { FIELD_ORDER, GK_ORDER, isBetterOrEqual, isRegularRole, playingTimeRank, squadForContract } from './squad';
import { formatMoney, pushNotice } from './state';
import { clubName, type SimulationWorld } from './world';

export const TRANSFER_CONFIG = {
  /** 일반 오퍼 개수 0/1/2/3 확률 */
  offerCountWeights: [0.4, 0.3, 0.2, 0.1],
  freeAgentMaxOffers: 5,
  maxCounterOffers: 3,
  /** 연봉 = wageBase × e^(재정 × wageFinanceSlope) × 역할 × 명성 */
  wageBase: 25_000,
  wageFinanceSlope: 0.06,
  moneyLeagueWageBonus: 1.5,
  /** 시장 가치 = valueBase × e^((OVR − 50)/6) × 나이 보정 */
  valueBase: 80_000,
} as const;

const ROLE_WAGE: Record<PlayingTime, number> = {
  KEY: 1.6, STARTER: 1, ROTATION: 0.6, BACKUP: 0.35, RESERVE: 0.12, GK_FIRST: 0.9, GK_SECOND: 0.35, GK_THIRD: 0.15,
};
const ROLE_FEE: Record<PlayingTime, number> = {
  KEY: 1.3, STARTER: 1.1, ROTATION: 0.9, BACKUP: 0.7, RESERVE: 0.5, GK_FIRST: 1.0, GK_SECOND: 0.6, GK_THIRD: 0.4,
};

// ============================================================================
// 계약 수치
// ============================================================================

/**
 * 계약 마지막 시즌.
 * 시즌 도중(겨울·여름) 서명하면 다음 시즌부터 years 시즌을 센다. 겨울 임대는 그 시즌 끝까지.
 * 계약은 마지막 시즌의 후반기가 끝나고 프리시즌이 시작될 때 만료된다.
 */
export function contractEndSeason(nextTurn: TurnPointer, years: number, type: ContractType): number {
  const base = nextTurn.phase === 'FIRST_HALF' ? nextTurn.season : nextTurn.season + 1;
  if (type === 'LOAN') return nextTurn.phase === 'SECOND_HALF' ? nextTurn.season : base;
  return base + years - 1;
}

/** 남은 시즌 수 (0 = 이번이 마지막 시즌) */
export function seasonsLeft(contract: Contract, nextTurn: TurnPointer): number {
  return contract.endSeason - nextTurn.season;
}

export function marketValue(ovr: number, age: number): number {
  const ageFactor = age <= 21 ? 1.5 : age <= 24 ? 1.3 : age <= 27 ? 1 : age <= 29 ? 0.75 : age <= 31 ? 0.5 : 0.3;
  return Math.round(TRANSFER_CONFIG.valueBase * Math.exp((ovr - 50) / 6) * ageFactor);
}

export function transferFee(ovr: number, age: number, playingTime: PlayingTime, yearsLeft: number): number {
  const fee = marketValue(ovr, age) * ROLE_FEE[playingTime] * (0.6 + 0.2 * clamp(yearsLeft, 0, 2));
  return Math.round(fee / 10_000) * 10_000;
}

export function wageOffer(params: {
  finance: number;
  playingTime: PlayingTime;
  reputation: number;
  moneyLeague: boolean;
  noise: number;
}): number {
  const t = TRANSFER_CONFIG;
  const wage =
    t.wageBase *
    Math.exp(params.finance * t.wageFinanceSlope) *
    ROLE_WAGE[params.playingTime] *
    (0.4 + (params.reputation / 100) * 1.2) *
    (params.moneyLeague ? t.moneyLeagueWageBonus : 1) *
    (0.9 + 0.2 * params.noise);
  return Math.max(5_000, Math.round(wage / 1_000) * 1_000);
}

/** 그 팀에 가면 받을 출전시간: OVR − 팀 실력 (명성이 팀 명성보다 높으면 약간 우대) */
export function expectedPlayingTime(params: {
  ovr: number;
  clubPower: number;
  clubPrestige: number;
  reputation: number;
  isGoalkeeper: boolean;
}): PlayingTime {
  const diff = params.ovr - params.clubPower + clamp((params.reputation - params.clubPrestige) * 0.05, -2, 3);
  if (params.isGoalkeeper) return diff >= 0 ? 'GK_FIRST' : diff >= -4 ? 'GK_SECOND' : 'GK_THIRD';
  if (diff >= 5) return 'KEY';
  if (diff >= 1) return 'STARTER';
  if (diff >= -3) return 'ROTATION';
  if (diff >= -8) return 'BACKUP';
  return 'RESERVE';
}

export function contractYears(age: number, rng: Rng): number {
  if (age <= 23) return rng.int(3, 5);
  if (age <= 29) return rng.int(2, 4);
  if (age <= 32) return rng.int(1, 2);
  return 1;
}

function betterOf(a: PlayingTime, b: PlayingTime): PlayingTime {
  return isBetterOrEqual(a, b) ? a : b;
}

function stepUp(playingTime: PlayingTime): PlayingTime {
  const order = FIELD_ORDER.includes(playingTime) ? FIELD_ORDER : GK_ORDER;
  const index = order.indexOf(playingTime);
  return order[Math.max(0, index - 1)];
}

// ============================================================================
// 경쟁 선수
// ============================================================================

const COMPETITOR_COUNT_WEIGHTS = [0.1, 0.35, 0.35, 0.2];

function competitorsAt(state: GameState, clubId: ID): NpcPlayer[] {
  return (state.clubs[clubId]?.squadNpcIds ?? [])
    .map((id) => state.npcs[id])
    .filter((npc): npc is NpcPlayer => Boolean(npc && !npc.retired && npc.clubId === clubId));
}

/** 그 팀의 동 포지션 경쟁 선수(0~3명)를 만들어 세이브에 저장한다. 이미 있으면 그대로 둔다. */
export function ensureCompetitors(state: GameState, world: SimulationWorld, clubId: ID): GameState {
  if (state.clubs[clubId]?.squadSeason !== null) return state;
  const rng = rngFor(state.seed, 'competitors', clubId, state.turn.season);
  const power = state.clubs[clubId].power;
  const position = state.player.profile.role.position;
  const isGK = position === 'GK';
  const count = rng.weightedIndex(COMPETITOR_COUNT_WEIGHTS);
  const season = state.turn.season;
  const npcs: NpcPlayer[] = [];

  for (let i = 0; i < count; i++) {
    const ovr = i === 0 ? power + rng.normal(1, 3) : i === 1 ? power - 5 + rng.normal(0, 3) : power - 12 + rng.normal(0, 3);
    const age = i === 0 ? rng.int(24, 31) : i === 1 ? rng.int(20, 33) : rng.int(17, 20);
    const playingTime: PlayingTime = isGK
      ? (['GK_FIRST', 'GK_SECOND', 'GK_THIRD'] as const)[i]
      : i === 0
        ? ovr >= power + 4 ? 'KEY' : 'STARTER'
        : i === 1
          ? 'ROTATION'
          : 'RESERVE';
    npcs.push(createNpc(rng, world, { position, ovr, age, season, clubId, playingTime }, `${clubId}:${i}:${season}`));
  }

  const npcMap = { ...state.npcs };
  for (const npc of npcs) npcMap[npc.id] = npc;
  return {
    ...state,
    npcs: npcMap,
    clubs: {
      ...state.clubs,
      [clubId]: { ...state.clubs[clubId], squadNpcIds: npcs.map((n) => n.id), squadSeason: season },
    },
  };
}

export function getCompetitors(state: GameState, clubId: ID): SquadCompetitor[] {
  return competitorsAt(state, clubId)
    .sort((a, b) => playingTimeRank(a.playingTime) - playingTimeRank(b.playingTime) || b.ovr - a.ovr)
    .map((npc) => ({
      id: npc.id,
      name: npc.name,
      nationality: npc.nationality,
      age: npcAge(npc, state.turn.season),
      position: npc.position,
      ovr: npc.ovr,
      playingTime: npc.playingTime,
    }));
}

/** 내 OVR − 소속팀 최고 경쟁 선수 OVR (입지 경쟁 압력) */
export function competitorGap(state: GameState): number {
  const clubId = state.player.contract?.clubId;
  if (!clubId) return 0;
  const rivals = competitorsAt(state, clubId);
  if (!rivals.length) return 0;
  return state.player.ovr - Math.max(...rivals.map((n) => n.ovr));
}

/** 주인공이 주전이면 겹치는 경쟁자의 입지를 한 단계 내린다 (표시용) */
function syncCompetitorRoles(state: GameState): GameState {
  const clubId = state.player.contract?.clubId;
  if (!clubId || !isRegularRole(state.player.squad.playingTime)) return state;
  const npcs = { ...state.npcs };
  for (const npc of competitorsAt(state, clubId)) {
    if (isRegularRole(npc.playingTime) && npc.ovr <= state.player.ovr + 2) {
      npcs[npc.id] = { ...npc, playingTime: npc.position === 'GK' ? 'GK_SECOND' : 'ROTATION' };
    }
  }
  return { ...state, npcs };
}

/**
 * 시즌 종료 시 경쟁자 생태계 순환
 * - 소속팀: 주인공에게 주전을 뺏긴 경쟁자는 다른 팀으로 팔려 가고, 나머지는 나이를 먹고 성장·노화·은퇴한다.
 *   빈자리는 유망주로 채운다.
 * - 다른 팀: 경쟁자 목록을 비워 다음 시즌에 새로 만든다.
 */
export function rotateCompetitors(state: GameState, world: SimulationWorld, newSeason: number): GameState {
  const rng = rngFor(state.seed, 'competitor-rotation', newSeason);
  const currentClub = state.player.contract?.clubId ?? null;
  const keepIds = new Set<ID>([state.partner?.npcId, state.rival?.npcId, ...state.formerPartners.map((p) => p.npcId)].filter(Boolean) as ID[]);
  let next: GameState = state;
  const npcs: Record<ID, NpcPlayer> = {};
  const clubs = { ...state.clubs };

  for (const [clubId, club] of Object.entries(state.clubs)) {
    if (club.squadSeason === null) continue;
    if (clubId !== currentClub) {
      clubs[clubId] = { ...club, squadNpcIds: [], squadSeason: null };
      continue;
    }
    const remaining: ID[] = [];
    for (const id of club.squadNpcIds) {
      const npc = state.npcs[id];
      if (!npc) continue;
      let aged = ageNpcOneSeason(rng, npc, newSeason);
      const displaced = !isRegularRole(aged.playingTime) && aged.ovr >= state.clubs[clubId].power - 3 && isRegularRole(state.player.squad.playingTime);
      if (aged.retired) {
        next = pushNotice(next, { kind: 'SQUAD', title: '경쟁 선수 은퇴', body: `${aged.name}이(가) 은퇴를 선언했다.` });
        continue;
      }
      if (displaced && rng.chance(0.6)) {
        const destination = pickDestinationClub(world, clubId, aged.ovr, rng);
        if (destination) {
          aged = { ...aged, clubId: destination, playingTime: 'STARTER' };
          npcs[aged.id] = aged;
          next = pushNotice(next, {
            kind: 'SQUAD',
            title: '경쟁 선수 이적',
            body: `주전 경쟁에서 밀린 ${aged.name}이(가) ${clubName(world, destination)}(으)로 떠났다.`,
          });
          continue;
        }
      }
      npcs[aged.id] = aged;
      remaining.push(aged.id);
    }
    // 빈자리는 유망주로
    if (remaining.length < 2) {
      const position = state.player.profile.role.position;
      const prospect = createNpc(
        rng,
        world,
        {
          position,
          ovr: state.clubs[clubId].power - 10 + rng.normal(0, 3),
          age: rng.int(17, 20),
          season: newSeason,
          clubId,
          playingTime: position === 'GK' ? 'GK_THIRD' : 'RESERVE',
        },
        `${clubId}:prospect:${newSeason}`,
      );
      npcs[prospect.id] = prospect;
      remaining.push(prospect.id);
      next = pushNotice(next, { kind: 'SQUAD', title: '새 경쟁자 등장', body: `유스 출신 ${prospect.name}이(가) 같은 포지션으로 올라왔다.` });
    }
    clubs[clubId] = { ...club, squadNpcIds: remaining, squadSeason: newSeason };
  }

  // 파트너·라이벌·옛 파트너 등 추적 대상은 남기고 나머지 NPC 정리
  for (const id of keepIds) if (state.npcs[id] && !npcs[id]) npcs[id] = state.npcs[id];
  return syncCompetitorRoles({ ...next, npcs, clubs });
}

function pickDestinationClub(world: SimulationWorld, fromClub: ID, ovr: number, rng: Rng): ID | null {
  const candidates = Object.values(world.clubStates).filter((c) => c.clubId !== fromClub && Math.abs(c.power - ovr) <= 4);
  if (!candidates.length) return null;
  return rng.pick(candidates).clubId;
}

// ============================================================================
// 오퍼 생성
// ============================================================================

function clubInterest(state: GameState, world: SimulationWorld, clubId: ID, mode: 'TRANSFER' | 'LOAN'): number {
  const cs = world.clubStates[clubId];
  const league = world.leagues[cs.leagueId];
  const { player } = state;
  const isGK = player.profile.role.position === 'GK';
  const expected = expectedPlayingTime({
    ovr: player.ovr,
    clubPower: cs.power,
    clubPrestige: cs.prestige,
    reputation: player.reputation,
    isGoalkeeper: isGK,
  });
  const fit = Math.exp(-((cs.power - (player.ovr + 1)) ** 2) / (2 * 7 ** 2));

  if (mode === 'LOAN') {
    const enoughTime = isBetterOrEqual(expected, isGK ? 'GK_SECOND' : 'ROTATION');
    if (!enoughTime || cs.power > player.ovr + 4 || cs.power < player.ovr - 10) return 0;
    // 임대는 원소속팀 국가의 구단이 압도적으로 많다
    return (fit + 0.05) * locality(state, world, clubId, 'LOAN') ** 1.4;
  }

  const prospect = player.age <= 20;
  if (!isBetterOrEqual(expected, isGK ? 'GK_SECOND' : 'BACKUP')) {
    // B팀 자리로 데려가는 유망주 영입은 현 소속팀보다 큰 구단만 한다
    const current = player.contract ? state.clubs[player.contract.clubId] : null;
    if (!prospect || (current && cs.prestige < current.prestige)) return 0;
  }
  const prestigeGap = cs.prestige - player.reputation;
  const prestigeFactor = prestigeGap > 40 ? 0.1 : prestigeGap > 25 ? 0.4 : 1;
  const money = league.moneyLeague
    ? player.age >= 27 || player.reputation >= 45
      ? 2.2
      : player.age < 23
        ? 0.15
        : 0.5
    : 1;
  const partnerBonus = state.partner && state.npcs[state.partner.npcId]?.clubId === clubId ? 2 : 1;
  return fit * prestigeFactor * money * partnerBonus * locality(state, world, clubId);
}

/**
 * 지역성 가중치 설정.
 * 유망주(16~21세)와 명성이 낮은 선수는 같은 나라(하부 리그 포함) → 인접국 → 같은 대륙 → 다른 대륙 순으로
 * 관심을 받는다. 명성이 높아질수록 차이가 옅어져 세계 어디서든 오퍼가 온다.
 */
export const LOCALITY_CONFIG = {
  prospectMaxAge: 21,
  /** 이 명성부터 지역성 효과가 줄기 시작해 fullReputation에서 사라진다 */
  fadeStartReputation: 35,
  fullReputation: 65,
  weights: { SAME_NATION: 3.2, NEIGHBOR: 1.6, SAME_CONFEDERATION: 0.7, ELSEWHERE: 0.12 },
  /** 현 소속 국가가 아닌 '국적' 국가에 대한 가중치 비율 (해외 유학 유망주의 귀국 오퍼) */
  nationalityShare: 0.6,
  /** 임대: 같은 나라 하위 리그 구단 추가 가중 */
  loanLowerTierBonus: 1.5,
} as const;

export type Proximity = keyof typeof LOCALITY_CONFIG.weights;

export function proximity(world: SimulationWorld, from: string, clubId: ID): Proximity {
  const club = world.clubs[clubId];
  if (club.nation === from) return 'SAME_NATION';
  if (areNeighbors(from, club.nation)) return 'NEIGHBOR';
  const fromConf = world.nations[from]?.confederation;
  const clubConf = world.leagues[world.clubStates[clubId].leagueId]?.confederation;
  return fromConf && fromConf === clubConf ? 'SAME_CONFEDERATION' : 'ELSEWHERE';
}

/** 지역성 가중치 (1 = 영향 없음) */
export function locality(state: GameState, world: SimulationWorld, clubId: ID, mode: 'TRANSFER' | 'LOAN' = 'TRANSFER'): number {
  const c = LOCALITY_CONFIG;
  const { player } = state;
  const prospect = player.age <= c.prospectMaxAge;
  const fade = clamp((c.fullReputation - player.reputation) / (c.fullReputation - c.fadeStartReputation), 0, 1);
  const strength = prospect ? Math.max(fade, 0.75) : fade;
  if (strength <= 0) return 1;

  const currentClub = player.contract?.clubId ?? player.parentContract?.clubId;
  const base = currentClub ? world.clubs[currentClub]?.nation : undefined;
  const nationality = player.profile.nationality;
  const fromBase = base ? c.weights[proximity(world, base, clubId)] : 0;
  const fromNationality = c.weights[proximity(world, nationality, clubId)] * (base && base !== nationality ? c.nationalityShare : 1);
  let weight = Math.max(fromBase, fromNationality);

  // 임대는 같은 나라의 한 단계 아래 리그로 많이 간다
  if (mode === 'LOAN' && base && world.clubs[clubId].nation === base && currentClub) {
    const fromTier = world.leagues[world.clubStates[currentClub].leagueId]?.tier ?? 1;
    const toTier = world.leagues[world.clubStates[clubId].leagueId]?.tier ?? 1;
    if (toTier > fromTier) weight *= c.loanLowerTierBonus;
  }
  return 1 + (weight - 1) * strength;
}

function pickClub(
  state: GameState,
  world: SimulationWorld,
  mode: 'TRANSFER' | 'LOAN',
  exclude: Set<ID>,
  rng: Rng,
): ID | null {
  const ids = Object.keys(world.clubStates).filter((id) => !exclude.has(id));
  const weights = ids.map((id) => clubInterest(state, world, id, mode));
  if (weights.every((w) => w <= 0.001)) return null;
  return ids[rng.weightedIndex(weights)];
}

function buildClubOffer(
  state: GameState,
  world: SimulationWorld,
  clubId: ID,
  type: Exclude<OfferType, 'RENEWAL'>,
  source: TransferOffer['source'],
  rng: Rng,
  desired?: PlayingTime,
): TransferOffer {
  const { player } = state;
  const cs = world.clubStates[clubId];
  const league = world.leagues[cs.leagueId];
  const isGK = player.profile.role.position === 'GK';
  let playingTime = expectedPlayingTime({
    ovr: player.ovr,
    clubPower: cs.power,
    clubPrestige: cs.prestige,
    reputation: player.reputation,
    isGoalkeeper: isGK,
  });
  if (type === 'LOAN') playingTime = betterOf(playingTime, isGK ? 'GK_SECOND' : 'ROTATION');
  if (desired) playingTime = betterOf(playingTime, desired);
  const years = type === 'LOAN' ? 1 : contractYears(player.age, rng);
  const wage = wageOffer({
    finance: cs.finance,
    playingTime,
    reputation: player.reputation,
    moneyLeague: Boolean(league.moneyLeague),
    noise: rng.next(),
  });
  const contract = player.contract;
  const value = marketValue(player.ovr, player.age);
  const fee = !contract
    ? 0
    : type === 'LOAN'
      ? Math.round((value * 0.05) / 10_000) * 10_000
      : transferFee(player.ovr, player.age, playingTime, seasonsLeft(contract, state.turn));
  const partnerHere = state.partner && state.npcs[state.partner.npcId]?.clubId === clubId ? state.partner.npcId : undefined;
  const notes: string[] = [];
  if (league.moneyLeague && wage > (contract?.wage ?? 0) * 1.5) notes.push('자본 리그의 거액 제안');
  if (partnerHere) notes.push(`영혼의 파트너 ${state.npcs[partnerHere].name}이(가) 뛰는 팀`);
  if (isRegularRole(playingTime)) notes.push('주전 보장');
  if (type === 'LOAN') notes.push('출전 시간 확보용 임대');

  return {
    id: `offer-${hashSeed(state.seed, state.turn.season, state.turn.phase, clubId, type, source, rng.next())}`,
    type,
    source,
    clubId,
    terms: { years, wage, playingTime },
    transferFee: fee,
    competitors: [],
    partnerNpcId: partnerHere,
    note: notes.join(' · ') || undefined,
    createdAt: state.turn,
    status: 'PENDING',
  };
}

function buildRenewalOffer(state: GameState, world: SimulationWorld, rng: Rng, boost = 0): TransferOffer | null {
  const { player } = state;
  const contract = player.contract;
  if (!contract || contract.type !== 'PERMANENT') return null;
  const cs = world.clubStates[contract.clubId];
  const league = world.leagues[cs.leagueId];
  let playingTime = betterOf(player.squad.playingTime === 'RESERVE' ? contract.playingTime : player.squad.playingTime, contract.playingTime);
  if (player.squad.standing >= 75 || boost > 0) playingTime = stepUp(playingTime);
  const market = wageOffer({
    finance: cs.finance,
    playingTime,
    reputation: player.reputation,
    moneyLeague: Boolean(league.moneyLeague),
    noise: rng.next(),
  });
  // 시장가 기준 재계약: 기존 연봉보다 조금 올려 주되 시장가의 1.3배를 넘지 않는다 (노장은 삭감될 수 있다)
  const target = market * (0.95 + 0.15 * rng.next());
  const wage = Math.round(Math.max(target, Math.min(contract.wage * 1.05, market * 1.3)) / 1_000) * 1_000;
  return {
    id: `offer-${hashSeed(state.seed, state.turn.season, state.turn.phase, 'renewal', rng.next())}`,
    type: 'RENEWAL',
    source: boost > 0 ? 'PLAYER_REQUEST' : 'AUTO',
    clubId: contract.clubId,
    terms: { years: contractYears(player.age, rng), wage, playingTime },
    transferFee: 0,
    competitors: [],
    note: seasonsLeft(contract, state.turn) <= 0 ? '계약 만료 임박 — 재계약 제안' : '계약 연장 제안',
    createdAt: state.turn,
    status: 'PENDING',
  };
}

function attachCompetitors(
  state: GameState,
  world: SimulationWorld,
  offer: TransferOffer,
): { state: GameState; offer: TransferOffer } {
  const withSquad = ensureCompetitors(state, world, offer.clubId);
  return { state: withSquad, offer: { ...offer, competitors: getCompetitors(withSquad, offer.clubId) } };
}

/** 턴 종료 시 자동 오퍼. 이전 턴의 미응답 오퍼는 만료된다. */
export function generateTurnOffers(state: GameState, world: SimulationWorld, lastRating: number | null): GameState {
  const { player } = state;
  const rng = rngFor(state.seed, 'offers', state.turn.season, state.turn.phase);
  const contract = player.contract;
  const isFA = !contract;

  let count: number;
  if (isFA) {
    count = Math.round(clamp(1 + player.ovr / 25 + player.reputation / 50 + rng.normal(0, 0.8), 1, TRANSFER_CONFIG.freeAgentMaxOffers));
  } else {
    count = rng.weightedIndex(TRANSFER_CONFIG.offerCountWeights);
    const expiring = seasonsLeft(contract, state.turn) <= 0;
    const bonus = clamp(((lastRating ?? 6.6) - 6.8) * 0.5 + (expiring ? 0.3 : 0), -0.3, 0.6);
    if (bonus > 0 && rng.chance(bonus)) count = Math.min(3, count + 1);
    if (bonus < 0 && rng.chance(-bonus)) count = Math.max(0, count - 1);
  }

  const renewalWanted =
    contract?.type === 'PERMANENT' &&
    (player.squad.standing >= 35 || player.ovr >= world.clubStates[contract.clubId].power - 3) &&
    (seasonsLeft(contract, state.turn) <= 0
      ? rng.chance(0.75)
      : seasonsLeft(contract, state.turn) === 1
        ? rng.chance(0.35)
        : isRegularRole(player.squad.playingTime) && rng.chance(0.08));
  const loanEligible =
    contract?.type === 'PERMANENT' &&
    player.age <= 22 &&
    (player.squad.level !== 'FIRST_TEAM' || ['BACKUP', 'RESERVE', 'GK_SECOND', 'GK_THIRD'].includes(player.squad.playingTime));

  const exclude = new Set<ID>([contract?.clubId, player.parentContract?.clubId].filter(Boolean) as ID[]);
  let next: GameState = { ...state, offers: [] };
  const offers: TransferOffer[] = [];

  for (let i = 0; i < count; i++) {
    let offer: TransferOffer | null = null;
    if (i === 0 && renewalWanted) {
      offer = buildRenewalOffer(next, world, rng);
    } else {
      const mode = loanEligible && rng.chance(0.45) ? 'LOAN' : 'TRANSFER';
      const clubId = pickClub(next, world, mode, exclude, rng);
      if (clubId) {
        exclude.add(clubId);
        offer = buildClubOffer(next, world, clubId, mode, 'AUTO', rng);
      }
    }
    if (!offer) continue;
    const attached = attachCompetitors(next, world, offer);
    offers.push(attached.offer);
    next = attached.state;
  }
  return { ...next, offers };
}

// ============================================================================
// 능동 협상
// ============================================================================

export interface NegotiationResult {
  state: GameState;
  accepted: boolean;
  message: string;
}

/** 타 구단에 이적·임대 역제의 (턴당 3회) */
export function requestMove(
  state: GameState,
  world: SimulationWorld,
  clubId: ID,
  type: 'TRANSFER' | 'LOAN',
  desired: PlayingTime,
): NegotiationResult {
  const { player } = state;
  if (state.stage !== 'READY') throw new Error('지금은 협상할 수 없습니다.');
  if (state.negotiation.counterOffersUsed >= TRANSFER_CONFIG.maxCounterOffers) {
    return { state, accepted: false, message: '이번 턴의 역제의 기회(3회)를 모두 썼습니다.' };
  }
  if (clubId === player.contract?.clubId) {
    return { state, accepted: false, message: '현 소속팀에는 재계약 요청을 이용하세요.' };
  }
  const cs = world.clubStates[clubId];
  const rng = rngFor(state.seed, 'counter', state.turn.season, state.turn.phase, clubId, state.negotiation.counterOffersUsed);
  const isGK = player.profile.role.position === 'GK';
  const used = { ...state.negotiation, counterOffersUsed: state.negotiation.counterOffersUsed + 1 };
  const name = clubName(world, clubId);

  let message: string;
  let accepted = false;
  if (type === 'LOAN' && (player.age > 23 || !player.contract)) {
    message = `${name}: 임대는 23세 이하 계약 선수만 가능합니다.`;
  } else {
    const expected = expectedPlayingTime({
      ovr: player.ovr,
      clubPower: cs.power,
      clubPrestige: cs.prestige,
      reputation: player.reputation,
      isGoalkeeper: isGK,
    });
    const gap = playingTimeRank(expected) - playingTimeRank(desired); // 양수면 요구가 기대보다 높다
    let chance =
      0.85 - Math.max(0, cs.power - player.ovr - 2) * 0.1 - Math.max(0, cs.prestige - player.reputation - 20) * 0.015;
    if (type === 'LOAN') chance += 0.1;
    if (gap > 0) chance *= gap >= 2 ? 0.15 : 0.45;
    accepted = rng.chance(clamp(chance, 0.03, 0.92));
    message = accepted
      ? `${name}이(가) 제안을 받아들였습니다. 오퍼 목록을 확인하세요.`
      : gap > 0
        ? `${name}: 요구한 출전시간을 보장하기 어렵다는 답변입니다.`
        : `${name}: 지금은 영입 계획이 없다는 답변입니다.`;
  }

  let next: GameState = {
    ...state,
    negotiation: { ...used, log: [...used.log, { clubId, type, accepted, message }] },
  };
  if (accepted) {
    const attached = attachCompetitors(next, world, buildClubOffer(next, world, clubId, type, 'PLAYER_REQUEST', rng, desired));
    next = { ...attached.state, offers: [...attached.state.offers, attached.offer] };
  }
  return { state: next, accepted, message };
}

/** 현 소속팀에 재계약 요청 (턴당 1회) */
export function requestRenewal(state: GameState, world: SimulationWorld): NegotiationResult {
  const { player } = state;
  if (state.negotiation.renewalRequested) return { state, accepted: false, message: '이번 턴에는 이미 재계약을 요청했습니다.' };
  const contract = player.contract;
  const marked: GameState = { ...state, negotiation: { ...state.negotiation, renewalRequested: true } };
  if (!contract) return { state: marked, accepted: false, message: '소속팀이 없습니다.' };
  if (contract.type === 'LOAN') return { state: marked, accepted: false, message: '임대 중에는 재계약을 협상할 수 없습니다.' };

  const cs = world.clubStates[contract.clubId];
  const rng = rngFor(state.seed, 'renewal-request', state.turn.season, state.turn.phase);
  const valued = player.squad.standing >= 40 || player.ovr >= cs.power - 2;
  const accepted = valued && rng.chance(player.squad.standing >= 60 ? 0.9 : 0.6);
  const name = clubName(world, contract.clubId);
  const message = accepted ? `${name}이(가) 재계약 조건을 제시했습니다.` : `${name}: 지금은 재계약을 논의할 때가 아니라는 답변입니다.`;

  let next: GameState = {
    ...marked,
    negotiation: { ...marked.negotiation, log: [...marked.negotiation.log, { clubId: contract.clubId, type: 'RENEWAL', accepted, message }] },
  };
  if (accepted) {
    const offer = buildRenewalOffer(next, world, rng, 1);
    if (offer) {
      const attached = attachCompetitors(next, world, offer);
      next = { ...attached.state, offers: [...attached.state.offers.filter((o) => o.type !== 'RENEWAL'), attached.offer] };
    }
  }
  return { state: next, accepted, message };
}

// ============================================================================
// 계약 체결 · 만료
// ============================================================================

function closeSpell(state: GameState, season: number): GameState['player']['clubHistory'] {
  return state.player.clubHistory.map((spell, i, all) =>
    i === all.length - 1 && spell.toSeason === null ? { ...spell, toSeason: season } : spell,
  );
}

/** 시즌 도중 팀을 옮기면 새 팀의 대회 진행 상황을 추정한다. */
function progressAfterMove(state: GameState, world: SimulationWorld, clubId: ID): CompetitionProgress[] {
  if (state.turn.phase !== 'SECOND_HALF') return state.progress.filter((p) => world.competitions[p.competitionId]?.type === 'INTERNATIONAL');
  const cs = world.clubStates[clubId];
  const league = world.leagues[cs.leagueId];
  const rng = rngFor(state.seed, 'progress-after-move', clubId, state.turn.season);
  const progress: CompetitionProgress[] = [];
  const cupChance = clamp(0.35 + (cs.power - league.strength) * 0.04, 0.1, 0.85);
  if (rng.chance(cupChance)) progress.push({ competitionId: league.domesticCupId, status: 'ACTIVE', stageReached: '16강' });
  if (cs.continentalCompetitionId && rng.chance(0.6)) {
    progress.push({ competitionId: cs.continentalCompetitionId, status: 'ACTIVE', stageReached: '조별리그 통과' });
  }
  return progress;
}

export function acceptOffer(state: GameState, world: SimulationWorld, offerId: ID): GameState {
  const offer = state.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== 'PENDING') throw new Error('유효한 오퍼가 아닙니다.');
  const { player } = state;
  const name = clubName(world, offer.clubId);
  const closeOthers = (s: GameState): GameState => ({
    ...s,
    offers: s.offers.map((o) => (o.id === offerId ? { ...o, status: 'ACCEPTED' } : o.status === 'PENDING' ? { ...o, status: 'REJECTED' } : o)),
  });

  if (offer.type === 'RENEWAL') {
    if (!player.contract) throw new Error('재계약할 계약이 없습니다.');
    const contract: Contract = {
      ...player.contract,
      endSeason: contractEndSeason(state.turn, offer.terms.years, 'PERMANENT'),
      wage: offer.terms.wage,
      playingTime: offer.terms.playingTime,
    };
    const squad = isBetterOrEqual(offer.terms.playingTime, player.squad.playingTime) && player.squad.level === 'FIRST_TEAM'
      ? { ...player.squad, playingTime: offer.terms.playingTime, standing: Math.max(player.squad.standing, squadForContract(offer.terms.playingTime, player.age).standing - 5) }
      : player.squad;
    const next = closeOthers({ ...state, player: { ...player, contract, squad } });
    return pushNotice(next, {
      kind: 'CONTRACT',
      title: '재계약 체결',
      body: `${name}과(와) ${contract.endSeason}/${String((contract.endSeason + 1) % 100).padStart(2, '0')} 시즌까지 재계약했다. 연봉 ${formatMoney(contract.wage)}.`,
    });
  }

  // 완전 이적·임대: 떠나는 팀 처리 (레전드 판정, 파트너 이별)
  let next: GameState = state;
  const leavingClub = player.contract?.clubId ?? null;
  const leavingForGood = offer.type === 'TRANSFER' ? (player.parentContract?.clubId ?? leavingClub) : null;
  if (leavingClub) next = separatePartnerIfLeaving(next, world, leavingClub);
  if (leavingForGood) next = evaluateDeparture(next, world, leavingForGood, 'TRANSFER');
  if (offer.type === 'TRANSFER' && player.parentContract && leavingClub && leavingClub !== leavingForGood) {
    next = evaluateDeparture(next, world, leavingClub, 'TRANSFER');
  }

  const type: ContractType = offer.type === 'LOAN' ? 'LOAN' : 'PERMANENT';
  const contract: Contract = {
    clubId: offer.clubId,
    type,
    parentClubId: type === 'LOAN' ? (leavingClub ?? undefined) : undefined,
    // 여름(프리시즌 직전) 이적은 다음 시즌 소속으로 기록
    startSeason: state.turn.phase === 'PRESEASON' ? state.turn.season + 1 : state.turn.season,
    endSeason: contractEndSeason(state.turn, offer.terms.years, type),
    wage: offer.terms.wage,
    playingTime: offer.terms.playingTime,
    transferFee: offer.transferFee,
  };
  const newLeague = world.clubStates[offer.clubId].leagueId;
  const sameLeague = leavingClub ? world.clubStates[leavingClub]?.leagueId === newLeague : false;
  const midSeason = state.turn.phase === 'SECOND_HALF';

  next = {
    ...next,
    player: {
      ...next.player,
      contract,
      parentContract: type === 'LOAN' ? player.contract : null,
      squad: squadForContract(offer.terms.playingTime, player.age),
      clubHistory: [
        ...closeSpell(next, state.turn.season),
        { clubId: offer.clubId, type, fromSeason: contract.startSeason, toSeason: null },
      ],
    },
    streaks: { ...next.streaks, starterTurnsAtClub: 0, freeAgentTurns: 0 },
    progress: progressAfterMove(next, world, offer.clubId),
    leagueTable: midSeason && !sameLeague ? simulateFirstHalfTable(world, newLeague, state.seed, state.turn.season) : sameLeague ? next.leagueTable : [],
  };
  next = syncCompetitorRoles(ensureCompetitors(next, world, offer.clubId));
  next = closeOthers(next);
  const feeText = offer.transferFee > 0 ? ` 이적료 ${formatMoney(offer.transferFee)}.` : '';
  return pushNotice(next, {
    kind: 'TRANSFER',
    title: type === 'LOAN' ? '임대 이적' : '이적 완료',
    body: `${name}${type === 'LOAN' ? '(으)로 임대 이적했다.' : '(으)로 이적했다.'}${feeText} 연봉 ${formatMoney(contract.wage)}, 보장 출전시간: ${PLAYING_TIME_LABELS[offer.terms.playingTime]}.`,
    popup: true,
  });
}

export function rejectOffer(state: GameState, offerId: ID): GameState {
  return { ...state, offers: state.offers.map((o) => (o.id === offerId && o.status === 'PENDING' ? { ...o, status: 'REJECTED' } : o)) };
}

/**
 * 계약 만료 처리 (후반기가 끝나고 프리시즌 턴을 시작할 때).
 * 임대는 원소속팀으로 복귀하고, 완전 계약이 끝나면 FA가 된다.
 */
export function processContractExpiry(state: GameState, world: SimulationWorld): GameState {
  const { player, turn } = state;
  const contract = player.contract;
  if (!contract || contract.endSeason > turn.season) return state;
  let next = state;

  if (contract.type === 'LOAN' && player.parentContract && player.parentContract.endSeason > turn.season) {
    const parent = player.parentContract;
    const clubPower = world.clubStates[parent.clubId].power;
    const squad = determineInitialSquadStatus(player.ovr, clubPower, player.profile.role.position === 'GK');
    next = {
      ...next,
      player: {
        ...player,
        contract: parent,
        parentContract: null,
        squad,
        clubHistory: [...closeSpell(next, turn.season), { clubId: parent.clubId, type: 'PERMANENT', fromSeason: turn.season + 1, toSeason: null }],
      },
      streaks: { ...next.streaks, starterTurnsAtClub: 0 },
    };
    next = separatePartnerIfLeaving(next, world, contract.clubId);
    next = syncCompetitorRoles(ensureCompetitors(next, world, parent.clubId));
    return pushNotice(next, {
      kind: 'CONTRACT',
      title: '임대 복귀',
      body: `임대 기간이 끝나 ${clubName(world, parent.clubId)}(으)로 돌아왔다.`,
      popup: true,
    });
  }

  // 완전 계약 만료 → FA
  const formerClub = contract.type === 'LOAN' ? (player.parentContract?.clubId ?? contract.clubId) : contract.clubId;
  next = separatePartnerIfLeaving(next, world, contract.clubId);
  next = evaluateDeparture(next, world, formerClub, 'TRANSFER');
  next = {
    ...next,
    player: { ...next.player, contract: null, parentContract: null, clubHistory: closeSpell(next, turn.season) },
    streaks: { ...next.streaks, starterTurnsAtClub: 0 },
    progress: [],
    leagueTable: [],
  };
  return pushNotice(next, {
    kind: 'CONTRACT',
    title: '계약 만료 — 자유계약(FA)',
    body: `${clubName(world, formerClub)}과(와)의 계약이 끝났다. FA 신분에서는 최대 5개 팀의 제안을 받을 수 있다.`,
    popup: true,
  });
}

/** 대륙 최상위 클럽 대회 (야망 있는 선수가 노리는 무대) */
const TOP_CONTINENTAL_IDS = new Set(['UEFA_CL', 'CONMEBOL_LIB', 'AFC_CL', 'CAF_CL', 'CONCACAF_CC']);

/**
 * 오퍼 매력도 (자동 진행 정책·UI 추천용)
 * 정상급(OVR 78+)이고 31세 이하인 선수는 출전 시간 경쟁을 감수하고 강팀·대륙 대회 진출 팀을 더 선호한다.
 */
export function offerAttractiveness(state: GameState, world: SimulationWorld, offer: TransferOffer): number {
  const cs = world.clubStates[offer.clubId];
  const { player } = state;
  const ambition = clamp((player.ovr - 78) / 8, 0, 1) * (player.age <= 31 ? 1 : 0.3);
  const roleScore = (4 - playingTimeRank(offer.terms.playingTime)) * 12 * (1 - 0.4 * ambition);
  const wageScore = Math.log10(Math.max(offer.terms.wage, 1_000)) * 4;
  const continental = cs.continentalCompetitionId
    ? (TOP_CONTINENTAL_IDS.has(cs.continentalCompetitionId) ? 10 * (world.competitions[cs.continentalCompetitionId]?.prestige ?? 50) / 100 : 3) * ambition
    : 0;
  return roleScore + cs.prestige * 0.5 + cs.power * (0.6 + 0.3 * ambition) + continental + wageScore + (offer.partnerNpcId ? 6 : 0);
}
