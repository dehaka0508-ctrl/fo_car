/**
 * 커리어 루프 — 16세 데뷔부터 은퇴까지
 *
 *   createCareer
 *     └→ [READY: 턴 사이 페이즈] 훈련·상점·사건·이적 협상
 *          └→ startTurn ──(하이라이트 대기)──→ resolveHighlight(바둑돌 결과)
 *               └→ completeTurn: 결과 반영 → 기록 경신 → 파트너·라이벌
 *                    → (후반기 뒤) 리그 결산  /  (프리시즌 뒤) 시즌 사이클 결산
 *                    → 오퍼 생성 → 다음 턴 사이 페이즈 (READY)
 *     └→ retire → RETIRED
 *
 * 모든 함수는 GameState를 받아 새 GameState를 돌려주는 순수 함수다 (Zustand 스토어가 그대로 호출).
 */
import { DATABASE } from '@/data/database';
import type { GameState, HighlightOutcome, TurnPhase, TurnPointer, TurnResult } from '@/types/game';
import { createPlayer, type CharacterInput } from './character';
import { syncSaveWithDatabase } from './dbSync';
import { applyMatchExperience } from './growth';
import { buildAutoHighlightOutcome } from './highlight';
import { beginInterTurn, interTurnBlockers } from './interTurn';
import { simulateFirstHalfTable } from './league';
import { POSITION_META } from '@/data/playstyles';
import { isSeniorNationalCaliber } from './schedule';
import { applyTurnNarrative, maybeFormPartner, maybeFormRival } from './narrative';
import { applyTurnToCareer, careerTotals, checkRecordBreaks, evaluateDeparture } from './records';
import { clamp, rngFor } from './rng';
import { closeLeagueSeason, closeSeasonCycle } from './seasonEnd';
import {
  advanceTurn,
  createTurnSession,
  finalizeTurn,
  resolveHighlight,
  type TurnInput,
  type TurnSession,
} from './simulator';
import { updateSquadStatus } from './squad';
import { formatMoney, pushNotice } from './state';
import { competitorGap, ensureCompetitors, generateTurnOffers, processContractExpiry } from './transfer';
import { clubName, createDefaultWorld, worldWithClubStates, type SimulationWorld } from './world';

export const SAVE_VERSION = 2;
export const START_SEASON = 2026;
export const RETIREMENT_AGE = 40;
export const VOLUNTARY_RETIREMENT_AGE = 30;

/** 정적 데이터 + 시작 시점 구단 상태 */
export const BASE_WORLD: SimulationWorld = createDefaultWorld();

export function worldOf(state: GameState): SimulationWorld {
  return worldWithClubStates(BASE_WORLD, state.clubs);
}

/** 구단 DB가 세이브를 만든 뒤 바뀌었으면 맞춘다 (턴 사이에만 호출) */
export function syncWithDatabase(state: GameState): GameState {
  return syncSaveWithDatabase(state, BASE_WORLD, DATABASE.signature);
}

// ============================================================================
// 커리어 생성
// ============================================================================

export function createCareer(input: CharacterInput, options: { seed: number; startSeason?: number }): GameState {
  const startSeason = options.startSeason ?? START_SEASON;
  const world = BASE_WORLD;
  const player = createPlayer(input, world, { seed: options.seed, startSeason });
  let state: GameState = {
    saveVersion: SAVE_VERSION,
    dbSignature: DATABASE.signature,
    seed: options.seed,
    turn: { season: startSeason, phase: 'FIRST_HALF' },
    stage: 'READY',
    player,
    clubs: structuredClone(world.clubStates),
    npcs: {},
    partner: null,
    formerPartners: [],
    rival: null,
    offers: [],
    negotiation: { counterOffersUsed: 0, renewalRequested: false, log: [] },
    events: [],
    interTurn: { training: null, purchasedItemId: null },
    flags: {},
    progress: [],
    leagueTable: [],
    seasonTurns: [],
    seasonStart: { ovr: player.ovr, reputation: player.reputation },
    lastTurn: null,
    history: [],
    careerByClub: {},
    careerByLeague: {},
    awards: [],
    trophies: [],
    recordBreaks: [],
    legends: [],
    notices: [],
    ceremonies: [],
    streaks: { starterTurnsAtClub: 0, freeAgentTurns: 0 },
    retirement: null,
  };
  state = ensureCompetitors(state, world, input.clubId);
  const levelText = { FIRST_TEAM: '1군', RESERVE: 'B팀', YOUTH: '유소년팀(U19)' }[player.squad.level];
  return pushNotice(state, {
    kind: 'INFO',
    title: '커리어 시작',
    body: `${player.profile.name}, ${clubName(world, input.clubId)} ${levelText}에서 프로 생활을 시작한다. (OVR ${player.ovr})`,
  });
}

// ============================================================================
// 턴 진행
// ============================================================================

export function canStartTurn(state: GameState): { ok: boolean; reasons: string[] } {
  if (state.stage !== 'READY') return { ok: false, reasons: [state.stage === 'RETIRED' ? '은퇴한 선수입니다.' : '턴이 진행 중입니다.'] };
  const reasons = interTurnBlockers(state);
  return { ok: reasons.length === 0, reasons };
}

/** 턴 시작 직전 정리: 미응답 오퍼 만료, 계약 만료(프리시즌 직전), 시즌 중 이적한 리그의 순위표 준비 */
function prepareTurn(state: GameState): GameState {
  let next: GameState = { ...state, offers: [] };
  if (next.turn.phase === 'PRESEASON') next = processContractExpiry(next, worldOf(next));
  const clubId = next.player.contract?.clubId;
  if (next.turn.phase === 'SECOND_HALF' && clubId && !next.leagueTable.some((row) => row.clubId === clubId)) {
    const leagueId = next.clubs[clubId].leagueId;
    next = { ...next, leagueTable: simulateFirstHalfTable(worldOf(next), leagueId, next.seed, next.turn.season) };
  }
  return { ...next, stage: 'IN_TURN' };
}

export function buildTurnInput(state: GameState, world: SimulationWorld): TurnInput {
  const partnerNpc = state.partner ? state.npcs[state.partner.npcId] : undefined;
  const rivalNpc = state.rival ? state.npcs[state.rival.npcId] : undefined;
  return {
    seed: state.seed,
    turn: state.turn,
    player: state.player,
    world,
    progress: state.progress,
    leagueTable: state.leagueTable,
    partner: state.partner && partnerNpc ? { partner: state.partner, npc: partnerNpc } : null,
    rival: state.rival && rivalNpc ? { rival: state.rival, npc: rivalNpc } : null,
    formerPartners: state.formerPartners.map((p) => state.npcs[p.npcId]).filter(Boolean),
  };
}

/** 턴을 시작해 하이라이트 직전(또는 턴 끝)까지 진행한다. */
export function startTurn(state: GameState): { state: GameState; session: TurnSession } {
  const check = canStartTurn(state);
  if (!check.ok) throw new Error(check.reasons.join(', '));
  const prepared = prepareTurn(state);
  const session = advanceTurn(createTurnSession(buildTurnInput(prepared, worldOf(prepared))));
  return { state: prepared, session };
}

/** 하이라이트 결과를 반영하고 턴 끝까지 진행한다. */
export function continueTurn(session: TurnSession, outcome: HighlightOutcome | null): TurnSession {
  return advanceTurn(resolveHighlight(session, outcome));
}

function nextTurnPointer(turn: TurnPointer): TurnPointer {
  if (turn.phase === 'FIRST_HALF') return { season: turn.season, phase: 'SECOND_HALF' };
  return { season: turn.season, phase: 'PRESEASON' };
}

/** 턴 결과를 선수·구단·기록에 반영한다. */
function applyTurnResult(state: GameState, world: SimulationWorld, result: TurnResult): GameState {
  const { player } = state;
  const rng = rngFor(state.seed, 'turn-apply', result.turn.season, result.turn.phase);
  const clubId = player.contract?.clubId ?? null;

  // 입지·출전 등급
  const squadUpdate = clubId
    ? updateSquadStatus({
        squad: player.squad,
        standingDelta: result.standingDelta,
        competitorGap: competitorGap(state),
        ovr: player.ovr,
        clubPower: state.clubs[clubId].power,
        age: player.age,
        isGoalkeeper: player.profile.role.position === 'GK',
        contract: player.contract,
      })
    : { squad: player.squad, change: null };

  // 연봉 (턴당 1/3) + 우승 보너스
  const trophyBonus = result.trophies.length * Math.round((player.contract?.wage ?? 0) * 0.1);
  const income = Math.round((player.contract?.wage ?? 0) / 3) + trophyBonus;

  let next: GameState = {
    ...state,
    player: {
      ...player,
      condition: result.condition.end,
      mental: result.mental.end,
      reputation: clamp(Math.round((player.reputation + result.reputationDelta) * 10) / 10, 0, 100),
      money: player.money + income,
      squad: squadUpdate.squad,
    },
    lastTurn: result,
    seasonTurns: [...state.seasonTurns, result],
    leagueTable: result.leagueTable.length ? result.leagueTable : state.leagueTable,
    progress: result.progress,
    trophies: [...state.trophies, ...result.trophies],
    streaks: { ...state.streaks, freeAgentTurns: clubId ? 0 : state.streaks.freeAgentTurns + 1 },
  };

  // 출전 경험 성장
  const experience = applyMatchExperience(next.player, result.playerStats, rng);
  next = { ...next, player: experience.player };

  next = applyTurnToCareer(next, result);
  next = applyTurnNarrative(next, result);

  const squadMessages = {
    PROMOTED_TO_FIRST_TEAM: ['1군 승격!', '감독이 1군 훈련에 합류하라고 지시했다.'],
    DEMOTED_TO_RESERVE: ['B팀 강등', '1군 경쟁에서 밀려 B팀으로 내려갔다.'],
    ROLE_UP: ['입지 상승', `팀 내 입지가 올라갔다.`],
    ROLE_DOWN: ['입지 하락', `팀 내 입지가 내려갔다.`],
  } as const;
  if (squadUpdate.change) {
    const [title, body] = squadMessages[squadUpdate.change];
    next = pushNotice(next, { kind: 'SQUAD', title, body, popup: squadUpdate.change === 'PROMOTED_TO_FIRST_TEAM', turn: result.turn });
  }
  for (const trophy of result.trophies) {
    const name = world.competitions[trophy.competitionId]?.nameKo ?? world.leagues[trophy.competitionId]?.nameKo ?? trophy.competitionId;
    next = pushNotice(next, { kind: 'AWARD', title: `${name} 우승!`, body: `${name} 정상에 올랐다! 우승 보너스 ${formatMoney(trophyBonus / Math.max(1, result.trophies.length))}.`, popup: true, turn: result.turn });
  }
  return next;
}

/**
 * 시즌 중 A매치 기간 (월드컵 예선·친선전).
 * 메이저 대회와 같은 발탁 기준을 넘으면 2~4경기를 치른 것으로 기록한다 (국가대표 통산 기록용).
 */
function internationalWindow(state: GameState, world: SimulationWorld, result: TurnResult): GameState {
  if (result.turn.phase === 'PRESEASON') return state;
  const { player } = state;
  const nation = world.nations[player.profile.nationality];
  if (!nation) return state;
  const rng = rngFor(state.seed, 'international-window', result.turn.season, result.turn.phase);
  if (!isSeniorNationalCaliber(player.ovr, player.reputation, nation.power, rng.normal(0, 1.5))) return state;

  const caps = rng.int(2, 4);
  const group = POSITION_META[player.profile.role.position].group;
  const factor = Math.exp((player.ovr - nation.power) / 15);
  const goals = rng.poisson(caps * { FORWARD: 0.35, MIDFIELDER: 0.12, DEFENDER: 0.04, GOALKEEPER: 0 }[group] * factor);
  const assists = rng.poisson(caps * { FORWARD: 0.15, MIDFIELDER: 0.14, DEFENDER: 0.05, GOALKEEPER: 0 }[group] * factor);
  const next: GameState = {
    ...state,
    player: {
      ...player,
      nationalTeam: {
        caps: player.nationalTeam.caps + caps,
        goals: player.nationalTeam.goals + goals,
        assists: player.nationalTeam.assists + assists,
        lastCallUp: result.turn,
      },
    },
  };
  return pushNotice(next, {
    kind: 'NATIONAL',
    title: 'A매치 소집',
    body: `${nation.nameKo} 대표팀 A매치 ${caps}경기 ${goals}골 ${assists}도움. (통산 ${next.player.nationalTeam.caps}경기 ${next.player.nationalTeam.goals}골)`,
    turn: result.turn,
  });
}

/** 끝난 턴을 반영하고 다음 턴 사이 페이즈를 연다. */
export function completeTurn(state: GameState, session: TurnSession): GameState {
  if (session.status !== 'COMPLETE') throw new Error('턴이 아직 끝나지 않았습니다.');
  const result = finalizeTurn(session);
  const completed: TurnPhase = result.turn.phase;
  const world = worldOf(state);

  let next = applyTurnResult(state, world, result);
  next = internationalWindow(next, world, result);
  next = checkRecordBreaks(next, world, state);
  next = maybeFormPartner(next, world);
  next = maybeFormRival(next, world);

  if (completed === 'PRESEASON') {
    next = closeSeasonCycle({ ...next, turn: result.turn }, world);
  } else {
    next = { ...next, turn: nextTurnPointer(result.turn) };
    if (completed === 'SECOND_HALF') next = closeLeagueSeason(next, world);
  }

  const updatedWorld = worldOf(next);
  next = generateTurnOffers(next, updatedWorld, result.ratings.overall);
  next = beginInterTurn({ ...next, stage: 'READY' }, updatedWorld, completed);

  if (next.player.age >= RETIREMENT_AGE) return retire(next, 'AGE');
  if (!next.player.contract && next.streaks.freeAgentTurns >= 6 && next.player.age >= 33) return retire(next, 'NO_CLUB');
  return next;
}

/** 하이라이트 선택을 AI가 대신하며 한 턴을 끝까지 진행한다. */
export function playTurnAuto(state: GameState, useHighlightChoices = true): GameState {
  const started = startTurn(state);
  let session = started.session;
  if (session.status === 'AWAITING_HIGHLIGHT') {
    session = continueTurn(session, useHighlightChoices ? buildAutoHighlightOutcome(session) : null);
  }
  return completeTurn(started.state, session);
}

// ============================================================================
// 은퇴
// ============================================================================

export function canRetire(state: GameState): boolean {
  return state.stage === 'READY' && (state.player.age >= VOLUNTARY_RETIREMENT_AGE || (!state.player.contract && state.streaks.freeAgentTurns >= 2));
}

export function retire(state: GameState, reason: 'VOLUNTARY' | 'AGE' | 'NO_CLUB'): GameState {
  const world = worldOf(state);
  let next = state;
  const clubId = state.player.contract?.clubId;
  const parentId = state.player.parentContract?.clubId;
  if (clubId) next = evaluateDeparture(next, world, clubId, 'RETIREMENT');
  if (parentId && parentId !== clubId) next = evaluateDeparture(next, world, parentId, 'RETIREMENT');

  const clubs = [...new Set(next.player.clubHistory.map((spell) => spell.clubId))];
  const summary = {
    season: next.turn.season,
    age: next.player.age,
    reason,
    totals: careerTotals(next),
    trophies: next.trophies.length,
    awards: next.awards.filter((a) => a.rank === 1).length,
    ballonDorWins: next.awards.filter((a) => a.type === 'BALLON_DOR' && a.rank === 1).length,
    clubs,
    legendClubs: next.legends.map((l) => l.clubId),
  };
  const message =
    reason === 'AGE' ? `${next.player.age}세, 마침내 축구화를 벗는다.` : reason === 'NO_CLUB' ? '새 팀을 찾지 못해 은퇴를 결심했다.' : '스스로 은퇴를 선택했다.';
  next = pushNotice(next, { kind: 'INFO', title: '현역 은퇴', body: message, popup: true });
  return {
    ...next,
    stage: 'RETIRED',
    offers: [],
    events: [],
    player: {
      ...next.player,
      retired: true,
      clubHistory: next.player.clubHistory.map((spell, i, all) => (i === all.length - 1 && spell.toSeason === null ? { ...spell, toSeason: next.turn.season } : spell)),
    },
    retirement: summary,
  };
}
