/**
 * 턴 시뮬레이터 — 코어 수식 + 턴 진행
 *
 * ─ 능력치와 결과의 분리 원칙 ─────────────────────────────────────────────
 *  1) 팀 성적(스코어·승무패): 팀 실력 + (내 OVR × 멘탈 계수)만 사용한다.
 *       effectiveTeamPower → expectedGoals → simulateScore
 *  2) 개인 기록(골·도움·클린시트·평점): 세부 능력치 분배 + 멘탈만 사용한다.
 *       goalShare / assistShare / calculateMatchRating
 *  스코어·출전 판정·개인 기록은 경기마다 서로 독립된 난수 스트림을 쓰므로
 *  결정력이나 시야를 바꿔도 같은 시드의 팀 결과는 변하지 않는다.
 *
 * ─ 체력과 출전 ───────────────────────────────────────────────────────────
 *  경기마다 체력(컨디션)이 소모되고 경기 사이 휴식일만큼 회복된다.
 *  소모량은 리그 강도 × 포지션·스타일 × 지구력, 회복량은 휴식일 × 지구력에 비례.
 *  체력이 떨어지면 감독이 로테이션을 돌려 출전 확률이 줄어든다.
 *
 * ─ 턴 진행 ───────────────────────────────────────────────────────────────
 *  createTurnSession → advanceTurn (하이라이트 직전에서 멈춤)
 *    → resolveHighlight(바둑돌 매치 결과) → advanceTurn → finalizeTurn
 *  세션은 순수 데이터라 그대로 LocalStorage에 저장할 수 있다.
 */
import { getPlayStyle, getPositionGroup, POSITION_META } from '@/data/playstyles';
import type {
  Appearance,
  AttributeKey,
  Attributes,
  CompetitionProgress,
  CompetitionType,
  Fixture,
  HighlightKind,
  HighlightOutcome,
  HighlightRecord,
  ID,
  MatchLog,
  MatchScore,
  NpcPlayer,
  PartnerBondType,
  PartnerTotals,
  PlayerMatchLine,
  PlayerRole,
  PlayerState,
  PlayerStatLine,
  PlayingTime,
  PlayStyle,
  Position,
  Rival,
  RivalComparison,
  SeasonRatingSummary,
  SoulPartner,
  SquadStatus,
  StandingRow,
  TeamRecord,
  TeamSide,
  TrophyWin,
  TurnPointer,
  TurnRatingSummary,
  TurnResult,
} from '@/types/game';
import { PLAYSTYLES_BY_POSITION } from '@/types/game';
import { emptyStatsByCompetition } from './character';
import { weightedScore } from './ovr';
import { clamp, round1, rngFor, type Rng } from './rng';
import { evaluateNationalDuty, planTurn, type GroupStage, type NationalDuty } from './schedule';
import type { SimulationWorld } from './world';

export { calculateOVR, rankPlayStyleFit, weightedScore } from './ovr';

// ============================================================================
// 밸런스 상수
// ============================================================================

export const SIM_CONFIG = {
  team: {
    /** 선수 1명이 팀 실력에 미치는 비중 (11명 중 1명 ≈ 0.09, 핵심 선수 가중) */
    playerInfluence: 0.12,
    goalkeeperInfluence: 0.1,
    /** 홈 어드밴티지 (실력 포인트) */
    homeAdvantage: 2.5,
    /** 경기 당일 팀 컨디션 변동 = 확률 보정 (실력 포인트 표준편차) */
    formNoiseSd: 1.5,
    /** 실력이 같은 두 팀의 기대 득점 */
    baseGoals: 1.35,
    /** 실력 1포인트 차이당 기대 득점 변화 (지수) */
    goalSlope: 0.045,
    minExpectedGoals: 0.15,
    maxExpectedGoals: 5,
    extraTimeFactor: 1 / 3,
    /** 승부차기: 실력 1포인트당 승률 변화 */
    penaltySkill: 0.01,
  },
  /** 멘탈 0 → 0.9배, 50 → 1.0배, 100 → 1.1배 */
  mental: { min: 0.9, max: 1.1 },
  individual: {
    /** 팀 수준 대비 세부 능력치 차이가 점유율에 미치는 폭 (클수록 완만) */
    shareSpread: 22,
    /** 능력치 우위로 기본 점유율이 커질 수 있는 최대 배율 */
    shareFactorMax: 1.8,
    /**
     * 점유율 상한. 상한의 shareKnee배를 넘는 부분부터 서서히 눌러서
     * 압도적인 선수도 매 시즌 상한에 붙지 않게 한다 (홀란 36골/팀 94골 ≈ 0.38이 역대급).
     * 득점 상한은 팀 수준에 따라 오른다: 강팀은 에이스에게 결정적 찬스를 몰아주는 완성도가 높아
     * 월드클래스 공격수가 시즌 30~45골을 넣고, 약팀에서 혼자 몰아치는 기록은 덜 부풀려진다.
     */
    maxGoalShare: 0.27,
    eliteGoalShareBonus: 0.1,
    /** 이 실력 구간에서 득점 상한이 maxGoalShare → maxGoalShare + eliteGoalShareBonus로 오른다 */
    eliteTeamPower: [70, 90] as readonly [number, number],
    maxAssistShare: 0.27,
    shareKnee: 0.6,
    /** 도움이 기록되는 골의 비율 */
    assistedGoalRatio: 0.72,
    /** 키패스 1개가 도움으로 이어지는 비율 */
    keyPassConversion: 0.16,
    /** 상대 기대 득점 1당 GK 선방 수 */
    savesPerExpectedGoal: 2.0,
  },
  rating: {
    base: 6.45,
    involvementWeight: 0.25,
    /** 팀 수준을 웃도는 미드필더는 골·클린시트 보너스가 적은 대신 경기 장악(관여도)이 평점에 더 크게 반영된다 */
    midfieldInvolvementWeight: 0.42,
    firstGoal: 1.0,
    extraGoal: 0.75,
    assist: 0.6,
    win: 0.3,
    loss: -0.3,
    cleanSheet: { GK: 0.8, DEF: 0.5, DM: 0.25 },
    conceded: { GK: -0.25, DEF: -0.12, DM: -0.05 },
    save: 0.12,
    mentalWeight: 0.15,
    /** 도움이 되지 않은 키패스 1개당 */
    keyPass: 0.1,
    noiseSd: 0.45,
    /** 교체 출전은 평점 편차를 줄인다 */
    substituteRegression: 0.6,
    min: 3,
    max: 10,
  },
  condition: {
    /** 90분 기준 소모량 */
    baseDrain: 7,
    /** 지구력 보정 = staminaDrainBase − staminaDrainSlope × 지구력/100 (지구력 95 → 0.74배, 55 → 1.02배) */
    staminaDrainBase: 1.4,
    staminaDrainSlope: 0.7,
    /** 하루 회복량 = recoveryBase + recoveryStamina × 지구력/100 */
    recoveryBase: 0.45,
    recoveryStamina: 0.6,
    competitionDrain: {
      LEAGUE: 1,
      DOMESTIC_CUP: 1,
      CONTINENTAL: 1.05,
      INTERNATIONAL: 1,
      FRIENDLY: 0.6,
      RESERVE: 0.8,
    } satisfies Record<CompetitionType, number>,
    internationalIntensity: 1.1,
  },
  highlight: {
    /** 하이라이트 경기에서 선택지 외 나머지 시간의 득점 비중 */
    backgroundScale: 0.6,
    penaltyBiasPerNet: 0.05,
    reputationWeight: {
      DERBY: 1,
      BIG_MATCH: 0.8,
      DOMESTIC_CUP_FINAL: 1.5,
      CONTINENTAL_FINAL: 2.5,
      INTERNATIONAL: 2,
      PRESEASON_FRIENDLY: 0.3,
      RESERVE_DERBY: 0.3,
    } satisfies Record<HighlightKind, number>,
  },
} as const;

// ============================================================================
// 코어 수식 — 팀 성적
// ============================================================================

/** 멘탈 계수: 팀 성적 공식에서 OVR에 곱해진다. */
export function mentalCoefficient(mental: number): number {
  const { min, max } = SIM_CONFIG.mental;
  return min + (max - min) * (clamp(mental, 0, 100) / 100);
}

/**
 * 주인공이 뛰는 동안의 팀 실력.
 * 팀 실력 = 구단 실력 + 영향력 × (내 OVR × 멘탈 계수 − 구단 실력) × 출전 비율
 * 구단 실력보다 잘하는 선수는 팀을 끌어올리고, 못하는 선수는 끌어내린다.
 */
export function effectiveTeamPower(
  teamPower: number,
  ovr: number,
  mental: number,
  minutesShare: number,
  isGoalkeeper: boolean,
): number {
  const influence = isGoalkeeper ? SIM_CONFIG.team.goalkeeperInfluence : SIM_CONFIG.team.playerInfluence;
  const playerValue = ovr * mentalCoefficient(mental);
  return teamPower + influence * (playerValue - teamPower) * clamp(minutesShare, 0, 1);
}

/** 기대 득점 = 기준 득점 × e^(기울기 × (공격 팀 실력 − 수비 팀 실력)) */
export function expectedGoals(attackPower: number, defensePower: number): number {
  const { baseGoals, goalSlope, minExpectedGoals, maxExpectedGoals } = SIM_CONFIG.team;
  return clamp(baseGoals * Math.exp(goalSlope * (attackPower - defensePower)), minExpectedGoals, maxExpectedGoals);
}

export interface RawScore {
  home: number;
  away: number;
  lambdaHome: number;
  lambdaAway: number;
}

/** 정규 시간 스코어. 확률 보정 = 경기 당일 컨디션 노이즈 + 포아송 득점. */
export function simulateScore(
  rng: Rng,
  homePower: number,
  awayPower: number,
  neutral: boolean,
  scale = 1,
): RawScore {
  const t = SIM_CONFIG.team;
  const home = homePower + (neutral ? 0 : t.homeAdvantage) + rng.normal(0, t.formNoiseSd);
  const away = awayPower + rng.normal(0, t.formNoiseSd);
  const lambdaHome = expectedGoals(home, away) * scale;
  const lambdaAway = expectedGoals(away, home) * scale;
  return { home: rng.poisson(lambdaHome), away: rng.poisson(lambdaAway), lambdaHome, lambdaAway };
}

/** 녹아웃은 무승부 시 연장 → 승부차기로 승자를 정한다. */
export function finishScore(
  rng: Rng,
  goals: { home: number; away: number },
  lambdas: { home: number; away: number },
  knockout: boolean,
  homePower: number,
  awayPower: number,
  penaltyBias = 0,
): MatchScore {
  let { home, away } = goals;
  if (knockout && home === away) {
    home += rng.poisson(lambdas.home * SIM_CONFIG.team.extraTimeFactor);
    away += rng.poisson(lambdas.away * SIM_CONFIG.team.extraTimeFactor);
  }
  if (home !== away) return { home, away, winner: home > away ? 'HOME' : 'AWAY' };
  if (!knockout) return { home, away, winner: 'DRAW' };

  const pHome = clamp(0.5 + (homePower - awayPower) * SIM_CONFIG.team.penaltySkill + penaltyBias, 0.2, 0.8);
  const homeWins = rng.chance(pHome);
  const winnerPens = rng.int(3, 5);
  const loserPens = rng.int(Math.max(0, winnerPens - 3), winnerPens - 1);
  return {
    home,
    away,
    penalties: homeWins ? { home: winnerPens, away: loserPens } : { home: loserPens, away: winnerPens },
    winner: homeWins ? 'HOME' : 'AWAY',
  };
}

// ============================================================================
// 코어 수식 — 체력과 출전
// ============================================================================

export function conditionDrain(params: {
  minutes: number;
  leagueIntensity: number;
  position: Position;
  playStyle: PlayStyle;
  stamina: number;
  competitionType: CompetitionType;
}): number {
  const c = SIM_CONFIG.condition;
  const positionFactor = POSITION_META[params.position].baseStaminaDrain * getPlayStyle(params.playStyle).staminaDrain;
  const staminaFactor = c.staminaDrainBase - c.staminaDrainSlope * (params.stamina / 100);
  const intensity = params.competitionType === 'INTERNATIONAL' ? c.internationalIntensity : params.leagueIntensity;
  return (
    c.baseDrain *
    intensity *
    positionFactor *
    staminaFactor *
    c.competitionDrain[params.competitionType] *
    (params.minutes / 90)
  );
}

export function conditionRecovery(restDays: number, stamina: number): number {
  const c = SIM_CONFIG.condition;
  return Math.max(0, restDays) * (c.recoveryBase + c.recoveryStamina * (stamina / 100));
}

export type SelectionContext = 'LEAGUE' | 'CUP_EARLY' | 'BIG' | 'FRIENDLY' | 'RESERVE';

/** 출전 등급·경기 성격별 [선발 확률, 교체 출전 확률] */
export const SELECTION_TABLE: Record<SelectionContext, Record<PlayingTime, readonly [number, number]>> = {
  LEAGUE: { KEY: [0.95, 0.03], STARTER: [0.82, 0.12], ROTATION: [0.45, 0.3], BACKUP: [0.12, 0.3], RESERVE: [0.02, 0.04], GK_FIRST: [0.97, 0], GK_SECOND: [0.04, 0.01], GK_THIRD: [0.01, 0] },
  CUP_EARLY: { KEY: [0.5, 0.25], STARTER: [0.6, 0.2], ROTATION: [0.8, 0.12], BACKUP: [0.6, 0.25], RESERVE: [0.15, 0.15], GK_FIRST: [0.35, 0], GK_SECOND: [0.7, 0], GK_THIRD: [0.15, 0] },
  BIG: { KEY: [0.99, 0.01], STARTER: [0.9, 0.08], ROTATION: [0.35, 0.35], BACKUP: [0.08, 0.3], RESERVE: [0.01, 0.03], GK_FIRST: [0.99, 0], GK_SECOND: [0.01, 0], GK_THIRD: [0, 0] },
  FRIENDLY: { KEY: [0.55, 0.4], STARTER: [0.55, 0.4], ROTATION: [0.5, 0.45], BACKUP: [0.45, 0.45], RESERVE: [0.3, 0.5], GK_FIRST: [0.5, 0.4], GK_SECOND: [0.4, 0.5], GK_THIRD: [0.2, 0.5] },
  RESERVE: { KEY: [0.95, 0.03], STARTER: [0.85, 0.1], ROTATION: [0.6, 0.25], BACKUP: [0.4, 0.3], RESERVE: [0.85, 0.1], GK_FIRST: [0.9, 0], GK_SECOND: [0.6, 0], GK_THIRD: [0.4, 0] },
};

const SUBBED_OFF_CHANCE: Record<PlayingTime, number> = {
  KEY: 0.12,
  STARTER: 0.22,
  ROTATION: 0.4,
  BACKUP: 0.45,
  RESERVE: 0.3,
  GK_FIRST: 0,
  GK_SECOND: 0,
  GK_THIRD: 0,
};

export function selectionContext(fixture: Fixture): SelectionContext {
  if (fixture.competitionType === 'FRIENDLY') return 'FRIENDLY';
  if (fixture.competitionType === 'RESERVE') return 'RESERVE';
  if (fixture.competitionType === 'DOMESTIC_CUP' && fixture.importance === 'LOW') return 'CUP_EARLY';
  if (fixture.importance === 'HIGH' || fixture.importance === 'FINAL' || fixture.isDerby) return 'BIG';
  return 'LEAGUE';
}

/** 체력이 낮으면 선발 확률을 깎는다. 큰 경기는 지쳐도 웬만하면 뛴다. */
export function conditionGate(condition: number, context: SelectionContext): number {
  const gate = condition >= 55 ? 1 : condition >= 40 ? 0.8 : condition >= 25 ? 0.45 : 0.15;
  return context === 'BIG' ? Math.max(gate, 0.75) : gate;
}

export interface Participation {
  started: boolean;
  minutes: number;
  /** 피치 위에 있던 구간 (분) */
  onAt: number;
  offAt: number;
}

export function decideParticipation(
  rng: Rng,
  playingTime: PlayingTime,
  context: SelectionContext,
  condition: number,
  isGoalkeeper: boolean,
): Participation | null {
  const [baseStart, baseSub] = SELECTION_TABLE[context][playingTime];
  const gate = conditionGate(condition, context);
  const pStart = baseStart * gate;
  const pSub = isGoalkeeper && context !== 'FRIENDLY' ? 0 : baseSub + baseStart * (1 - gate) * 0.5;
  const roll = rng.next();

  if (roll < pStart) {
    if (context === 'FRIENDLY') {
      const minutes = isGoalkeeper ? rng.pick([45, 90]) : rng.int(45, 75);
      return { started: true, minutes, onAt: 0, offAt: minutes };
    }
    const subbedOff = rng.chance(SUBBED_OFF_CHANCE[playingTime] + (condition < 50 && !isGoalkeeper ? 0.2 : 0));
    const minutes = subbedOff ? rng.int(60, 85) : 90;
    return { started: true, minutes, onAt: 0, offAt: minutes };
  }
  if (roll < pStart + pSub) {
    const minutes = context === 'FRIENDLY' ? rng.int(20, 45) : rng.int(10, 35);
    return { started: false, minutes, onAt: 90 - minutes, offAt: 90 };
  }
  return null;
}

// ============================================================================
// 코어 수식 — 개인 기록
// ============================================================================

function shareFactor(composite: number, teamPower: number): number {
  const { shareSpread, shareFactorMax } = SIM_CONFIG.individual;
  return clamp(Math.exp((composite - teamPower) / shareSpread), 0.3, shareFactorMax);
}

/** 상한의 knee배까지는 그대로, 그 위는 상한에 점점 가까워지기만 한다. */
export function softCap(raw: number, max: number, knee = SIM_CONFIG.individual.shareKnee): number {
  const start = max * knee;
  if (raw <= start) return raw;
  const room = max - start;
  return start + room * (1 - Math.exp(-(raw - start) / room));
}

function mentalPerformance(mental: number): number {
  return 0.85 + 0.3 * (clamp(mental, 0, 100) / 100);
}

/**
 * 득점 점유율: 이 선수가 피치에 있을 때 팀 득점 1골을 직접 넣을 확률.
 * = 스타일 기본값 × e^((득점 능력 − 팀 수준)/15) × 멘탈 보정
 * 득점 능력은 스타일별 scoringProfile(결정력·오프더볼·제공권 등)의 가중 평균이다.
 */
export function goalShare(attributes: Attributes, playStyle: PlayStyle, mental: number, teamPower: number): number {
  const style = getPlayStyle(playStyle);
  if (style.goalShare === 0) return 0;
  const composite = weightedScore(attributes, style.scoringProfile);
  return softCap(
    style.goalShare * shareFactor(composite, teamPower) * mentalPerformance(mental),
    goalShareCap(teamPower),
  );
}

/** 득점 점유율 상한: 팀 실력 70 이하 0.27 → 90 이상 0.37 */
export function goalShareCap(teamPower: number): number {
  const { maxGoalShare, eliteGoalShareBonus, eliteTeamPower } = SIM_CONFIG.individual;
  const [low, high] = eliteTeamPower;
  return maxGoalShare + eliteGoalShareBonus * clamp((teamPower - low) / (high - low), 0, 1);
}

/** 도움 점유율: 도움이 기록되는 골 1개를 이 선수가 도울 확률 (creatingProfile 기반) */
export function assistShare(attributes: Attributes, playStyle: PlayStyle, mental: number, teamPower: number): number {
  const style = getPlayStyle(playStyle);
  const composite = weightedScore(attributes, style.creatingProfile);
  return softCap(
    style.assistShare * shareFactor(composite, teamPower) * mentalPerformance(mental),
    SIM_CONFIG.individual.maxAssistShare,
  );
}

/** NPC(파트너)는 세부 능력치가 없으므로 OVR을 능력 합성치로 쓴다. */
function npcShares(position: Position, playStyle: PlayStyle, ovr: number, teamPower: number) {
  const style = getPlayStyle(playStyle);
  const factor = shareFactor(ovr, teamPower);
  return {
    goal: softCap(style.goalShare * factor, goalShareCap(teamPower)),
    assist: softCap(style.assistShare * factor, SIM_CONFIG.individual.maxAssistShare),
  };
}

type DefensiveRole = 'GK' | 'DEF' | 'DM' | null;

function defensiveRole(position: Position): DefensiveRole {
  if (position === 'GK') return 'GK';
  if (position === 'CB' || position === 'LB' || position === 'RB') return 'DEF';
  if (position === 'DM') return 'DM';
  return null;
}

export interface RatingInput {
  role: PlayerRole;
  attributes: Attributes;
  mental: number;
  teamPower: number;
  started: boolean;
  minutes: number;
  goals: number;
  assists: number;
  conceded: number;
  result: 'W' | 'D' | 'L';
  saves: number;
  cleanSheet: boolean;
  /** 키패스 (도움 포함) */
  keyPasses?: number;
  /** 표준정규분포 표본 (호출 측의 개인 기록 스트림에서 뽑는다) */
  noise: number;
  /** 하이라이트 선택지 보너스 */
  bonus?: number;
}

/**
 * 경기 평점 (3.0 ~ 10.0)
 * = 기본 6.3 + 경기 관여도(스타일별 involvementProfile vs 팀 수준) + 골·도움
 *   + 팀 결과 + 수비 기여(클린시트·실점·선방) + 멘탈 + 노이즈
 */
export function calculateMatchRating(input: RatingInput): number {
  const r = SIM_CONFIG.rating;
  const style = getPlayStyle(input.role.playStyle);
  const involvement = weightedScore(input.attributes, style.involvementProfile);
  const defence = defensiveRole(input.role.position);

  let rating = r.base;
  const control = clamp((involvement - input.teamPower) / 10, -2, 2);
  // 팀 수준을 웃도는 미드필더만 경기 장악 보너스를 더 받는다
  const midfieldDominant = control > 0 && POSITION_META[input.role.position].group === 'MIDFIELDER';
  rating += (midfieldDominant ? r.midfieldInvolvementWeight : r.involvementWeight) * control;
  if (input.goals > 0) rating += r.firstGoal + r.extraGoal * (input.goals - 1);
  rating += r.assist * input.assists;
  rating += r.keyPass * Math.max(0, (input.keyPasses ?? 0) - input.assists);
  rating += input.result === 'W' ? r.win : input.result === 'L' ? r.loss : 0;
  if (defence) {
    if (input.cleanSheet) rating += r.cleanSheet[defence];
    rating += r.conceded[defence] * input.conceded;
  }
  if (defence === 'GK') rating += r.save * input.saves;
  rating += r.mentalWeight * ((clamp(input.mental, 0, 100) - 50) / 50);
  rating += r.noiseSd * input.noise;

  if (!input.started || input.minutes < 45) {
    rating = r.base + (rating - r.base) * r.substituteRegression;
  }
  rating += input.bonus ?? 0;
  return round1(clamp(rating, r.min, r.max));
}

/**
 * 하이라이트(바둑돌) 선택지 성공 확률.
 * = 시그모이드((핵심 능력치 평균 − 난이도)/12) × 멘탈 계수 보정, 5% ~ 95%
 */
export function choiceSuccessChance(
  attributes: Attributes,
  keyAttributes: readonly AttributeKey[],
  difficulty: number,
  mental: number,
): number {
  const skill = keyAttributes.length
    ? keyAttributes.reduce((sum, key) => sum + attributes[key], 0) / keyAttributes.length
    : 50;
  const base = 1 / (1 + Math.exp(-(skill - difficulty) / 12));
  return clamp(base * mentalPerformance(mental), 0.05, 0.95);
}

// ============================================================================
// 코어 수식 — 턴 결과 보정
// ============================================================================

/** 리그 수준에 따른 명성 가중치 (EPL 1.0, K리그1 0.7, K리그2 0.55) */
export function leagueReputationWeight(leagueStrength: number): number {
  return 0.4 + clamp((leagueStrength - 50) / 28, 0, 1.05) * 0.6;
}

/** 명성 변화: 평점·공격포인트·리그 수준·우승. 명성이 높을수록 상승폭이 줄어든다. */
export function calculateReputationDelta(params: {
  reputation: number;
  appearances: number;
  eligibleMatches: number;
  averageRating: number | null;
  goals: number;
  assists: number;
  cleanSheets: number;
  /** 키패스 (도움 포함). 골이 적은 플레이메이커도 경기 장악으로 이름을 알린다 */
  keyPasses?: number;
  leagueStrength: number;
  trophyBonus: number;
  highlightBonus: number;
}): number {
  let delta: number;
  if (params.appearances === 0 || params.averageRating === null) {
    delta = -0.3;
  } else {
    const playFactor = Math.min(1, params.appearances / Math.max(1, params.eligibleMatches * 0.8));
    const performance = (params.averageRating - 6.6) * 4 * playFactor;
    const creation = Math.max(0, (params.keyPasses ?? 0) - params.assists) * 0.15;
    const output = (params.goals + params.assists * 0.7 + params.cleanSheets * 0.4 + creation) * 0.12;
    delta = (performance + output) * leagueReputationWeight(params.leagueStrength);
  }
  delta += params.trophyBonus + params.highlightBonus;
  if (delta > 0) delta *= Math.max(0.05, (1 - params.reputation / 105) ** 1.3);
  return round1(delta);
}

/** 팀 내 입지 변화: 평점과 (OVR − 팀 수준). 프리시즌 친선경기 활약도 반영된다. */
export function calculateStandingDelta(params: {
  averageRating: number | null;
  ovr: number;
  teamPower: number;
  isFirstTeam: boolean;
  highlightBonus: number;
}): number {
  if (params.averageRating === null) return params.isFirstTeam ? -2 : 0;
  const delta =
    (params.averageRating - 6.7) * 10 + (params.ovr - params.teamPower) * 0.3 + params.highlightBonus;
  return Math.round(clamp(delta, -12, 12));
}

// ============================================================================
// 기록 집계 유틸
// ============================================================================

export function averageRating(line: PlayerStatLine): number | null {
  return line.appearances > 0 ? Math.round((line.ratingSum / line.appearances) * 100) / 100 : null;
}

export function mergeStatLines(...lines: PlayerStatLine[]): PlayerStatLine {
  return lines.reduce<PlayerStatLine>(
    (acc, line) => ({
      appearances: acc.appearances + line.appearances,
      starts: acc.starts + line.starts,
      minutes: acc.minutes + line.minutes,
      goals: acc.goals + line.goals,
      assists: acc.assists + line.assists,
      cleanSheets: acc.cleanSheets + line.cleanSheets,
      saves: acc.saves + line.saves,
      // 키패스 도입 전 세이브와 섞여도 NaN이 되지 않게
      keyPasses: acc.keyPasses + (line.keyPasses ?? 0),
      ratingSum: acc.ratingSum + line.ratingSum,
    }),
    { appearances: 0, starts: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, saves: 0, keyPasses: 0, ratingSum: 0 },
  );
}

const COMPETITIVE: readonly CompetitionType[] = ['LEAGUE', 'DOMESTIC_CUP', 'CONTINENTAL', 'INTERNATIONAL'];

export function competitiveLine(stats: Record<CompetitionType, PlayerStatLine>): PlayerStatLine {
  return mergeStatLines(...COMPETITIVE.map((type) => stats[type]));
}

export function summarizeTurnRatings(stats: Record<CompetitionType, PlayerStatLine>): TurnRatingSummary {
  return {
    overall: averageRating(competitiveLine(stats)),
    league: averageRating(stats.LEAGUE),
    cups: averageRating(mergeStatLines(stats.DOMESTIC_CUP, stats.CONTINENTAL)),
    international: averageRating(stats.INTERNATIONAL),
    friendly: averageRating(stats.FRIENDLY),
    reserve: averageRating(stats.RESERVE),
  };
}

/** 시즌 평점 집계: 전반기 / 후반기 / 시즌 통합 / 컵 대회(국내·대륙) */
export function summarizeSeasonRatings(firstHalf: TurnResult | null, secondHalf: TurnResult | null): SeasonRatingSummary {
  const empty = emptyStatsByCompetition();
  const a = firstHalf?.playerStats ?? empty;
  const b = secondHalf?.playerStats ?? empty;
  const clubCompetitive = (s: Record<CompetitionType, PlayerStatLine>) =>
    mergeStatLines(s.LEAGUE, s.DOMESTIC_CUP, s.CONTINENTAL);
  return {
    firstHalf: averageRating(clubCompetitive(a)),
    secondHalf: averageRating(clubCompetitive(b)),
    season: averageRating(mergeStatLines(clubCompetitive(a), clubCompetitive(b))),
    cups: averageRating(mergeStatLines(a.DOMESTIC_CUP, a.CONTINENTAL, b.DOMESTIC_CUP, b.CONTINENTAL)),
    domesticCup: averageRating(mergeStatLines(a.DOMESTIC_CUP, b.DOMESTIC_CUP)),
    continental: averageRating(mergeStatLines(a.CONTINENTAL, b.CONTINENTAL)),
  };
}

function addPlayerLine(line: PlayerStatLine, match: PlayerMatchLine) {
  line.appearances += 1;
  line.starts += match.started ? 1 : 0;
  line.minutes += match.minutes;
  line.goals += match.goals;
  line.assists += match.assists;
  line.cleanSheets += match.cleanSheet ? 1 : 0;
  line.saves += match.saves;
  line.keyPasses = (line.keyPasses ?? 0) + match.keyPasses;
  line.ratingSum += match.rating;
}

function emptyTeamRecord(): TeamRecord {
  return { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
}

/** 승무패는 연장까지의 스코어 기준 (승부차기는 무승부로 기록) */
function resultFor(score: MatchScore, side: TeamSide): 'W' | 'D' | 'L' {
  const mine = side === 'HOME' ? score.home : score.away;
  const theirs = side === 'HOME' ? score.away : score.home;
  return mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
}

// ============================================================================
// 턴 세션
// ============================================================================

interface SessionPlayer {
  name: string;
  appearance: Appearance;
  role: PlayerRole;
  attributes: Attributes;
  ovr: number;
  age: number;
  reputation: number;
  squad: SquadStatus;
  isGoalkeeper: boolean;
}

interface SessionPartner {
  npcId: ID;
  name: string;
  position: Position;
  playStyle: PlayStyle;
  ovr: number;
  playingTime: PlayingTime;
  bondType: PartnerBondType;
}

interface SessionRival {
  npcId: ID;
  name: string;
  position: Position;
  ovr: number;
  playingTime: PlayingTime;
  clubId: ID | null;
  clubPower: number;
}

/** 하이라이트에서 이름을 직접 표시할 상대 선수 */
export interface NotableOpponent {
  npcId: ID;
  name: string;
  clubId: ID;
  tag: 'RIVAL' | 'FORMER_PARTNER';
}

export interface HighlightTarget {
  fixtureId: ID;
  kind: HighlightKind;
}

export interface TurnInput {
  seed: number;
  turn: TurnPointer;
  player: PlayerState;
  world: SimulationWorld;
  /** 이전 턴에서 이월된 대회 진행 상황 */
  progress?: CompetitionProgress[];
  /** 후반기: 전반기까지의 리그 순위표 */
  leagueTable?: StandingRow[];
  partner?: { partner: SoulPartner; npc: NpcPlayer } | null;
  rival?: { rival: Rival; npc: NpcPlayer } | null;
  formerPartners?: NpcPlayer[];
}

export type TurnSessionStatus = 'RUNNING' | 'AWAITING_HIGHLIGHT' | 'COMPLETE';

export interface TurnSession {
  seed: number;
  turn: TurnPointer;
  player: SessionPlayer;
  clubId: ID | null;
  /** 1군 구단 실력 (FA면 null) */
  clubPower: number | null;
  leagueId: ID | null;
  leagueStrength: number;
  leagueIntensity: number;
  nationalDuty: NationalDuty | null;
  partner: SessionPartner | null;
  rival: SessionRival | null;
  notable: NotableOpponent[];
  fixtures: Fixture[];
  groups: GroupStage[];
  /** 대륙·국제대회 위상 (우승 명성 보너스용). 국내 컵은 없음 */
  competitionPrestige: Record<ID, number>;
  carryTable: StandingRow[];
  progressIn: CompetitionProgress[];
  status: TurnSessionStatus;
  cursor: number;
  results: Record<ID, MatchScore>;
  skipped: ID[];
  groupAdvanced: Record<ID, boolean>;
  logs: MatchLog[];
  conditionStart: number;
  condition: number;
  mentalStart: number;
  mental: number;
  lastRecoveryDay: number;
  partnerTally: PartnerTotals | null;
  highlight: HighlightTarget | null;
  highlightRecord: HighlightRecord | null;
  highlightEffects: { reputation: number; standing: number };
}

const defaultPlayStyle = (position: Position): PlayStyle => PLAYSTYLES_BY_POSITION[position][0];

export function createTurnSession(input: TurnInput): TurnSession {
  const { player, world, turn, seed } = input;
  const clubId = player.contract?.clubId ?? null;
  const clubState = clubId ? world.clubStates[clubId] : null;
  const league = clubState ? world.leagues[clubState.leagueId] : null;
  const isGoalkeeper = player.profile.role.position === 'GK';

  const nationalDuty = evaluateNationalDuty({
    seed,
    turn,
    world,
    nationality: player.profile.nationality,
    ovr: player.ovr,
    reputation: player.reputation,
    age: player.age,
    isGoalkeeper,
  });

  const plan = planTurn({
    seed,
    turn,
    world,
    clubId,
    squadLevel: player.squad.level,
    progress: input.progress ?? [],
    nationalDuty,
  });

  const partnerInput = input.partner;
  const partner: SessionPartner | null =
    partnerInput && partnerInput.partner.status === 'ACTIVE' && clubId && partnerInput.npc.clubId === clubId
      ? {
          npcId: partnerInput.npc.id,
          name: partnerInput.npc.name,
          position: partnerInput.npc.position,
          playStyle: partnerInput.npc.playStyle ?? defaultPlayStyle(partnerInput.npc.position),
          ovr: partnerInput.npc.ovr,
          playingTime: partnerInput.npc.playingTime,
          bondType: partnerInput.partner.bondType,
        }
      : null;

  const rivalNpc = input.rival?.npc;
  const rival: SessionRival | null = rivalNpc
    ? {
        npcId: rivalNpc.id,
        name: rivalNpc.name,
        position: rivalNpc.position,
        ovr: rivalNpc.ovr,
        playingTime: rivalNpc.playingTime,
        clubId: rivalNpc.clubId,
        clubPower: (rivalNpc.clubId && world.clubStates[rivalNpc.clubId]?.power) || 70,
      }
    : null;

  const notable: NotableOpponent[] = [];
  if (rivalNpc?.clubId) notable.push({ npcId: rivalNpc.id, name: rivalNpc.name, clubId: rivalNpc.clubId, tag: 'RIVAL' });
  for (const former of input.formerPartners ?? []) {
    if (former.clubId && former.clubId !== clubId) {
      notable.push({ npcId: former.id, name: former.name, clubId: former.clubId, tag: 'FORMER_PARTNER' });
    }
  }

  const session: TurnSession = {
    seed,
    turn,
    player: {
      name: player.profile.name,
      appearance: player.profile.appearance,
      role: player.profile.role,
      attributes: { ...player.attributes },
      ovr: player.ovr,
      age: player.age,
      reputation: player.reputation,
      squad: player.squad,
      isGoalkeeper,
    },
    clubId,
    clubPower: clubState?.power ?? null,
    leagueId: league?.id ?? null,
    leagueStrength: league?.strength ?? 60,
    leagueIntensity: league?.intensity ?? 1,
    nationalDuty,
    partner,
    rival,
    notable,
    fixtures: plan.fixtures,
    groups: plan.groups,
    competitionPrestige: Object.fromEntries(
      plan.fixtures
        .filter((f) => f.competitionType === 'CONTINENTAL' || f.competitionType === 'INTERNATIONAL')
        .map((f) => [f.competitionId, world.competitions[f.competitionId]?.prestige ?? 50]),
    ),
    carryTable: turn.phase === 'SECOND_HALF' ? (input.leagueTable ?? []) : [],
    progressIn: input.progress ?? [],
    status: 'RUNNING',
    cursor: 0,
    results: {},
    skipped: [],
    groupAdvanced: {},
    logs: [],
    conditionStart: player.condition,
    condition: player.condition,
    mentalStart: player.mental,
    mental: player.mental,
    lastRecoveryDay: 0,
    partnerTally: partner
      ? { appearancesTogether: 0, wins: 0, draws: 0, losses: 0, jointGoals: 0, cleanSheetsTogether: 0 }
      : null,
    highlight: null,
    highlightRecord: null,
    highlightEffects: { reputation: 0, standing: 0 },
  };
  session.highlight = chooseHighlight(session);
  return session;
}

/** 하이라이트 직전(또는 턴 끝)까지 경기를 진행한다. 입력 세션은 변경하지 않는다. */
export function advanceTurn(session: TurnSession): TurnSession {
  const s = structuredClone(session);
  runFixtures(s, true);
  return s;
}

/**
 * 하이라이트 경기 결과를 반영한다.
 * outcome이 null이면 선택지 없이 일반 경기처럼 시뮬레이션한다 (주인공 출전은 보장).
 */
export function resolveHighlight(session: TurnSession, outcome: HighlightOutcome | null): TurnSession {
  if (session.status !== 'AWAITING_HIGHLIGHT') throw new Error('하이라이트 대기 상태가 아닙니다.');
  const s = structuredClone(session);
  const fixture = s.fixtures[s.cursor];
  processFixture(s, fixture, { outcome });
  s.cursor += 1;
  s.status = 'RUNNING';
  return s;
}

export function getHighlightFixture(session: TurnSession): Fixture | null {
  if (!session.highlight) return null;
  return session.fixtures.find((f) => f.id === session.highlight?.fixtureId) ?? null;
}

export interface SimulateTurnOptions {
  /** 하이라이트 선택지를 대신 고르는 함수 (테스트·자동 진행용). 없으면 일반 경기로 처리 */
  highlightResolver?: (session: TurnSession) => HighlightOutcome | null;
}

/** 한 턴을 끝까지 자동 진행한다. */
export function simulateTurn(
  input: TurnInput,
  options: SimulateTurnOptions = {},
): { result: TurnResult; session: TurnSession } {
  let session = advanceTurn(createTurnSession(input));
  if (session.status === 'AWAITING_HIGHLIGHT') {
    session = resolveHighlight(session, options.highlightResolver?.(session) ?? null);
    session = advanceTurn(session);
  }
  return { result: finalizeTurn(session), session };
}

// ----------------------------------------------------------------------------
// 경기 진행
// ----------------------------------------------------------------------------

function runFixtures(s: TurnSession, pauseAtHighlight: boolean) {
  while (s.cursor < s.fixtures.length) {
    const fixture = s.fixtures[s.cursor];
    const isHighlight = pauseAtHighlight && s.highlight?.fixtureId === fixture.id && !s.highlightRecord;
    if (isHighlight && isFixtureActive(s, fixture)) {
      s.status = 'AWAITING_HIGHLIGHT';
      return;
    }
    processFixture(s, fixture, null);
    s.cursor += 1;
  }
  s.status = 'COMPLETE';
}

function fixtureById(s: TurnSession, id: ID): Fixture | undefined {
  return s.fixtures.find((f) => f.id === id);
}

function isFixtureActive(s: TurnSession, fixture: Fixture): boolean {
  const req = fixture.requires;
  if (!req) return true;
  if (req.kind === 'GROUP_ADVANCE') return evaluateGroupAdvance(s, req.groupId);
  const previous = fixtureById(s, req.fixtureId);
  const result = s.results[req.fixtureId];
  return Boolean(previous && result && result.winner === previous.playerTeamSide);
}

/** 조 순위를 계산해 주인공 팀의 통과 여부를 정한다 (결과는 세션에 캐시). */
function evaluateGroupAdvance(s: TurnSession, groupId: ID): boolean {
  if (groupId in s.groupAdvanced) return s.groupAdvanced[groupId];
  const group = s.groups.find((g) => g.id === groupId);
  if (!group) return false;

  const tiebreak = rngFor(s.seed, groupId, 'tiebreak');
  const rows = new Map(group.teamIds.map((id) => [id, { id, pts: 0, gd: 0, gf: 0, coin: tiebreak.next() }]));
  for (const fixtureId of group.fixtureIds) {
    const fixture = fixtureById(s, fixtureId);
    const score = s.results[fixtureId];
    if (!fixture || !score) continue;
    const home = rows.get(fixture.home.id);
    const away = rows.get(fixture.away.id);
    if (!home || !away) continue;
    home.gf += score.home;
    away.gf += score.away;
    home.gd += score.home - score.away;
    away.gd += score.away - score.home;
    if (score.home > score.away) home.pts += 3;
    else if (score.home < score.away) away.pts += 3;
    else {
      home.pts += 1;
      away.pts += 1;
    }
  }
  const table = [...rows.values()].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || b.coin - a.coin);
  const position = table.findIndex((row) => row.id === group.playerTeamId) + 1;
  const advanced =
    position > 0 &&
    (position <= group.advance ||
      (position === group.advance + 1 &&
        rngFor(s.seed, groupId, 'third-place').chance(group.thirdPlaceAdvanceChance)));
  s.groupAdvanced[groupId] = advanced;
  return advanced;
}

function processFixture(s: TurnSession, fixture: Fixture, highlight: { outcome: HighlightOutcome | null } | null) {
  if (!isFixtureActive(s, fixture)) {
    s.skipped.push(fixture.id);
    return;
  }
  if (!fixture.playerTeamSide) {
    const rng = rngFor(s.seed, fixture.id, 'score');
    const raw = simulateScore(rng, fixture.home.power, fixture.away.power, fixture.neutral);
    s.results[fixture.id] = finishScore(
      rng,
      raw,
      { home: raw.lambdaHome, away: raw.lambdaAway },
      fixture.knockout,
      fixture.home.power,
      fixture.away.power,
    );
    return;
  }
  playTeamFixture(s, fixture, highlight);
}

function isEligible(s: TurnSession, fixture: Fixture): boolean {
  switch (fixture.squad) {
    case 'FIRST':
      return fixture.competitionType === 'FRIENDLY' || s.player.squad.level === 'FIRST_TEAM';
    case 'RESERVE':
      return s.player.squad.level !== 'FIRST_TEAM';
    case 'NATIONAL':
      return s.nationalDuty !== null;
    default:
      return false;
  }
}

function playingTimeFor(s: TurnSession, fixture: Fixture): PlayingTime {
  if (fixture.squad === 'NATIONAL' && s.nationalDuty) return s.nationalDuty.playingTime;
  if (fixture.squad === 'RESERVE') return s.player.isGoalkeeper ? 'GK_FIRST' : 'RESERVE';
  return s.player.squad.playingTime;
}

/** 하이라이트 경기는 주인공 출전이 보장된다 (후보는 교체로 30분). */
function forcedParticipation(playingTime: PlayingTime, fixture: Fixture): Participation {
  const benchRole = playingTime === 'BACKUP' || (playingTime === 'RESERVE' && fixture.squad === 'FIRST');
  return benchRole
    ? { started: false, minutes: 30, onAt: 60, offAt: 90 }
    : { started: true, minutes: 90, onAt: 0, offAt: 90 };
}

interface GoalTally {
  playerGoals: number;
  playerAssists: number;
  jointGoals: number;
}

/**
 * 팀 득점을 골마다 득점자·도움자에게 배분한다.
 * 골 시각을 뽑아 그 순간 피치에 있던 선수만 후보가 된다.
 */
function attributeGoals(
  rng: Rng,
  goals: number,
  minuteRange: readonly [number, number],
  player: { on: Participation; goal: number; assist: number } | null,
  partner: { on: Participation; goal: number; assist: number } | null,
): GoalTally {
  const tally: GoalTally = { playerGoals: 0, playerAssists: 0, jointGoals: 0 };
  for (let i = 0; i < goals; i++) {
    const minute = rng.int(minuteRange[0], minuteRange[1]);
    const onPitch = (p: Participation) => minute >= p.onAt && (minute <= p.offAt || (p.offAt >= 90 && minute > 90));
    const playerOn = player !== null && onPitch(player.on);
    const partnerOn = partner !== null && onPitch(partner.on);

    let sp = playerOn ? player.goal : 0;
    let sq = partnerOn ? partner.goal : 0;
    const scorerTotal = sp + sq;
    if (scorerTotal > 0.85) {
      sp = (sp / scorerTotal) * 0.85;
      sq = (sq / scorerTotal) * 0.85;
    }
    const roll = rng.next();
    const scorer = roll < sp ? 'P' : roll < sp + sq ? 'Q' : 'O';

    let assister: 'P' | 'Q' | 'O' | null = null;
    if (rng.chance(SIM_CONFIG.individual.assistedGoalRatio)) {
      let ap = playerOn && scorer !== 'P' ? player.assist : 0;
      let aq = partnerOn && scorer !== 'Q' ? partner.assist : 0;
      const assistTotal = ap + aq;
      if (assistTotal > 0.85) {
        ap = (ap / assistTotal) * 0.85;
        aq = (aq / assistTotal) * 0.85;
      }
      const assistRoll = rng.next();
      assister = assistRoll < ap ? 'P' : assistRoll < ap + aq ? 'Q' : 'O';
    }

    if (scorer === 'P') tally.playerGoals++;
    if (assister === 'P') tally.playerAssists++;
    if ((scorer === 'P' && assister === 'Q') || (scorer === 'Q' && assister === 'P')) tally.jointGoals++;
  }
  return tally;
}

interface HighlightEffect {
  forGoals: number;
  againstGoals: number;
  playerGoals: number;
  playerAssists: number;
  jointGoals: number;
  saves: number;
  ratingBonus: number;
  successes: number;
  failures: number;
}

/** 바둑돌 매치 선택지 판정 결과를 실제 득실점·개인 기록으로 바꾼다. */
function applyHighlightOutcome(rng: Rng, outcome: HighlightOutcome, partnerOn: boolean): HighlightEffect {
  const effect: HighlightEffect = {
    forGoals: 0,
    againstGoals: 0,
    playerGoals: 0,
    playerAssists: 0,
    jointGoals: 0,
    saves: 0,
    ratingBonus: 0,
    successes: 0,
    failures: 0,
  };
  for (const situation of outcome.resolved) {
    if (situation.success) effect.successes++;
    else effect.failures++;

    switch (situation.kind) {
      case 'SHOT':
      case 'SET_PIECE':
        if (situation.success) {
          effect.forGoals++;
          effect.playerGoals++;
          if (partnerOn && rng.chance(0.35)) effect.jointGoals++;
        } else effect.ratingBonus -= 0.1;
        break;
      case 'KEY_PASS':
        if (situation.success) {
          effect.forGoals++;
          effect.playerAssists++;
          if (partnerOn && rng.chance(0.4)) effect.jointGoals++;
        } else effect.ratingBonus -= 0.05;
        break;
      case 'DRIBBLE':
        if (situation.success) {
          effect.ratingBonus += 0.3;
          if (rng.chance(0.6)) {
            effect.forGoals++;
            if (rng.chance(0.5)) effect.playerAssists++;
          }
        } else effect.ratingBonus -= 0.1;
        break;
      case 'DEFEND':
        if (situation.success) effect.ratingBonus += 0.35;
        else {
          effect.againstGoals++;
          effect.ratingBonus -= 0.2;
        }
        break;
      case 'SAVE':
        if (situation.success) {
          effect.saves++;
          effect.ratingBonus += 0.35;
        } else {
          effect.againstGoals++;
          effect.ratingBonus -= 0.15;
        }
        break;
    }
  }
  return effect;
}

function playTeamFixture(s: TurnSession, fixture: Fixture, highlight: { outcome: HighlightOutcome | null } | null) {
  const side = fixture.playerTeamSide as TeamSide;
  const myTeam = side === 'HOME' ? fixture.home : fixture.away;
  const opponent = side === 'HOME' ? fixture.away : fixture.home;
  const { role, attributes, isGoalkeeper } = s.player;
  const eligible = isEligible(s, fixture);
  const playingTime = playingTimeFor(s, fixture);
  const context = selectionContext(fixture);

  // 1) 경기 전 회복
  if (eligible) {
    s.condition = Math.min(
      100,
      s.condition + conditionRecovery(fixture.day - s.lastRecoveryDay, attributes.stamina),
    );
    s.lastRecoveryDay = fixture.day;
  }

  // 2) 출전 판정 (주인공·파트너)
  const selectionRng = rngFor(s.seed, fixture.id, 'selection');
  const participation = eligible
    ? highlight
      ? forcedParticipation(playingTime, fixture)
      : decideParticipation(selectionRng, playingTime, context, s.condition, isGoalkeeper)
    : null;
  const partnerParticipation =
    s.partner && fixture.squad === 'FIRST'
      ? decideParticipation(
          rngFor(s.seed, fixture.id, 'partner-selection'),
          s.partner.playingTime,
          context,
          80,
          s.partner.position === 'GK',
        )
      : null;

  // 3) 팀 결과: 팀 실력 + (OVR × 멘탈 계수)만 사용
  const myPower = participation
    ? effectiveTeamPower(myTeam.power, s.player.ovr, s.mental, participation.minutes / 90, isGoalkeeper)
    : myTeam.power;
  const homePower = side === 'HOME' ? myPower : fixture.home.power;
  const awayPower = side === 'AWAY' ? myPower : fixture.away.power;
  const scoreRng = rngFor(s.seed, fixture.id, 'score');
  const outcome = highlight?.outcome ?? null;
  const scale = outcome ? SIM_CONFIG.highlight.backgroundScale : 1;
  const raw = simulateScore(scoreRng, homePower, awayPower, fixture.neutral, scale);

  // 4) 개인 기록: 세부 능력치 + 멘탈만 사용 (독립 스트림)
  const individualRng = rngFor(s.seed, fixture.id, 'individual');
  const playerShares = participation
    ? {
        on: participation,
        goal: goalShare(attributes, role.playStyle, s.mental, myTeam.power),
        assist: assistShare(attributes, role.playStyle, s.mental, myTeam.power),
      }
    : null;
  const partnerShares =
    partnerParticipation && s.partner
      ? { on: partnerParticipation, ...npcShares(s.partner.position, s.partner.playStyle, s.partner.ovr, myTeam.power) }
      : null;

  const regularGoals = side === 'HOME' ? raw.home : raw.away;
  const tally = attributeGoals(individualRng, regularGoals, [1, 90], playerShares, partnerShares);

  const effect = outcome
    ? applyHighlightOutcome(individualRng, outcome, partnerParticipation !== null)
    : null;
  const net = effect ? effect.successes - effect.failures : 0;

  const goals = {
    home: raw.home + (effect ? (side === 'HOME' ? effect.forGoals : effect.againstGoals) : 0),
    away: raw.away + (effect ? (side === 'AWAY' ? effect.forGoals : effect.againstGoals) : 0),
  };
  const score = finishScore(
    scoreRng,
    goals,
    { home: raw.lambdaHome / scale, away: raw.lambdaAway / scale },
    fixture.knockout,
    homePower,
    awayPower,
    (side === 'HOME' ? 1 : -1) * net * SIM_CONFIG.highlight.penaltyBiasPerNet,
  );

  // 연장전 골 배분
  const myGoalsFinal = side === 'HOME' ? score.home : score.away;
  const myGoalsBeforeExtra = side === 'HOME' ? goals.home : goals.away;
  const extraTally = attributeGoals(
    individualRng,
    myGoalsFinal - myGoalsBeforeExtra,
    [91, 120],
    playerShares,
    partnerShares,
  );

  const conceded = side === 'HOME' ? score.away : score.home;
  const result = resultFor(score, side);
  let line: PlayerMatchLine | null = null;

  if (participation) {
    const defence = defensiveRole(role.position);
    const playerGoals = tally.playerGoals + extraTally.playerGoals + (effect?.playerGoals ?? 0);
    const playerAssists = tally.playerAssists + extraTally.playerAssists + (effect?.playerAssists ?? 0);
    // 키패스: 기대 도움 ÷ 전환율. 다른 기록과 섞이지 않도록 별도 스트림을 쓴다.
    const myLambda = (side === 'HOME' ? raw.lambdaHome : raw.lambdaAway) / scale;
    const expectedAssists =
      (playerShares?.assist ?? 0) * SIM_CONFIG.individual.assistedGoalRatio * myLambda * (participation.minutes / 90);
    const keyPasses =
      playerAssists +
      rngFor(s.seed, fixture.id, 'key-pass').poisson(expectedAssists * (1 / SIM_CONFIG.individual.keyPassConversion - 1));
    const cleanSheet = defence !== null && participation.started && participation.minutes >= 60 && conceded === 0;
    const opponentLambda = side === 'HOME' ? raw.lambdaAway : raw.lambdaHome;
    const keeperQuality = 0.8 + (weightedScore(attributes, { reflexes: 2, gkPositioning: 1 }) / 100) * 0.4;
    const saves = isGoalkeeper
      ? individualRng.poisson(
          opponentLambda * SIM_CONFIG.individual.savesPerExpectedGoal * keeperQuality * (participation.minutes / 90),
        ) + (effect?.saves ?? 0)
      : 0;

    const rating = calculateMatchRating({
      role,
      attributes,
      mental: s.mental,
      teamPower: myTeam.power,
      started: participation.started,
      minutes: participation.minutes,
      goals: playerGoals,
      assists: playerAssists,
      conceded,
      result,
      saves,
      cleanSheet,
      keyPasses,
      noise: individualRng.normal(0, 1),
      bonus: effect?.ratingBonus,
    });

    // 5) 체력 소모
    s.condition = Math.max(
      0,
      s.condition -
        conditionDrain({
          minutes: participation.minutes,
          leagueIntensity: fixture.squad === 'NATIONAL' ? 1 : s.leagueIntensity,
          position: role.position,
          playStyle: role.playStyle,
          stamina: attributes.stamina,
          competitionType: fixture.competitionType,
        }),
    );

    line = {
      started: participation.started,
      minutes: participation.minutes,
      goals: playerGoals,
      assists: playerAssists,
      cleanSheet,
      saves,
      keyPasses,
      rating,
      conditionAfter: Math.round(s.condition),
    };
  }

  const jointGoals = participation
    ? tally.jointGoals + extraTally.jointGoals + (effect?.jointGoals ?? 0)
    : 0;
  if (s.partnerTally && participation && partnerParticipation) {
    s.partnerTally.appearancesTogether++;
    if (result === 'W') s.partnerTally.wins++;
    else if (result === 'D') s.partnerTally.draws++;
    else s.partnerTally.losses++;
    s.partnerTally.jointGoals += jointGoals;
    if (conceded === 0) s.partnerTally.cleanSheetsTogether++;
  }

  s.results[fixture.id] = score;
  s.logs.push({
    fixtureId: fixture.id,
    competitionId: fixture.competitionId,
    competitionType: fixture.competitionType,
    stage: fixture.stage,
    day: fixture.day,
    home: fixture.home,
    away: fixture.away,
    score,
    playerTeamSide: side,
    player: line,
    partnerJointGoals: jointGoals,
    isHighlight: Boolean(highlight),
  });

  // 6) 하이라이트 후속 효과: 멘탈은 즉시 반영되어 남은 경기에 영향을 준다
  if (highlight && s.highlight) {
    const won = score.winner === side;
    const resultScore = won ? 1 : score.winner === 'DRAW' ? 0 : -0.5;
    const kind = s.highlight.kind;
    s.mental = clamp(s.mental + clamp(net * 2 + resultScore * 2, -8, 8), 0, 100);
    s.highlightEffects = {
      reputation: round1(SIM_CONFIG.highlight.reputationWeight[kind] * (net * 0.5 + resultScore)),
      standing: kind === 'PRESEASON_FRIENDLY' ? net * 2 + resultScore : net * 0.5,
    };
    s.highlightRecord = {
      fixtureId: fixture.id,
      kind,
      opponent,
      successes: effect?.successes ?? 0,
      failures: effect?.failures ?? 0,
      score,
      playerTeamSide: side,
      playerLine: line,
    };
  }
}

// ----------------------------------------------------------------------------
// 하이라이트 경기 선정
// ----------------------------------------------------------------------------

/**
 * 턴을 선택지 없이 미리 한 번 돌려 본 뒤 규칙에 맞는 경기를 고른다.
 * 경기마다 독립 시드를 쓰므로 하이라이트 이전까지는 실제 진행과 결과가 같다.
 *  - 전반기: 라이벌 더비 (없으면 가장 강한 상대와의 빅매치)
 *  - 후반기: 대륙컵 결승 > 국내컵 결승 > 후반기 더비 > 빅매치
 *  - 프리시즌: 대표팀이 치른 마지막 국제대회 경기 > 친선경기
 *  - B팀·유스: 리저브 더비 > 리저브 빅매치
 */
function chooseHighlight(session: TurnSession): HighlightTarget | null {
  const dry = structuredClone(session);
  dry.highlight = null;
  runFixtures(dry, false);

  const candidates = dry.logs
    .map((log) => ({ log, fixture: fixtureById(dry, log.fixtureId) as Fixture }))
    .filter(({ fixture }) => isEligible(dry, fixture));
  const opponentPower = ({ log }: { log: MatchLog }) =>
    log.playerTeamSide === 'HOME' ? log.away.power : log.home.power;
  const strongest = (list: typeof candidates) =>
    list.reduce<(typeof candidates)[number] | null>(
      (best, c) => (!best || opponentPower(c) > opponentPower(best) ? c : best),
      null,
    );
  const target = (c: (typeof candidates)[number] | null | undefined, kind: HighlightKind) =>
    c ? { fixtureId: c.fixture.id, kind } : null;

  if (session.turn.phase === 'PRESEASON') {
    const international = candidates.filter((c) => c.fixture.competitionType === 'INTERNATIONAL');
    if (international.length) return target(international[international.length - 1], 'INTERNATIONAL');
    return target(
      strongest(candidates.filter((c) => c.fixture.competitionType === 'FRIENDLY')),
      'PRESEASON_FRIENDLY',
    );
  }

  if (session.player.squad.level !== 'FIRST_TEAM') {
    const reserve = candidates.filter((c) => c.fixture.competitionType === 'RESERVE');
    const derby = reserve.find((c) => c.fixture.isDerby);
    return derby ? target(derby, 'RESERVE_DERBY') : target(strongest(reserve), 'BIG_MATCH');
  }

  if (session.turn.phase === 'SECOND_HALF') {
    const finals = candidates.filter((c) => c.fixture.isFinal);
    const continental = finals.find((c) => c.fixture.competitionType === 'CONTINENTAL');
    if (continental) return target(continental, 'CONTINENTAL_FINAL');
    const domestic = finals.find((c) => c.fixture.competitionType === 'DOMESTIC_CUP');
    if (domestic) return target(domestic, 'DOMESTIC_CUP_FINAL');
  }

  const league = candidates.filter((c) => c.fixture.competitionType === 'LEAGUE');
  const derby = league.find((c) => c.fixture.isDerby);
  if (derby) return target(derby, 'DERBY');
  return target(
    strongest(candidates.filter((c) => c.fixture.competitionType === 'LEAGUE' || c.fixture.competitionType === 'CONTINENTAL')),
    'BIG_MATCH',
  );
}

// ----------------------------------------------------------------------------
// 턴 마무리
// ----------------------------------------------------------------------------

function computeLeagueTable(s: TurnSession): StandingRow[] {
  if (!s.leagueId) return [];
  const rows = new Map<ID, StandingRow>();
  for (const row of s.carryTable) rows.set(row.clubId, { ...row });
  const ensure = (clubId: ID) => {
    if (!rows.has(clubId)) rows.set(clubId, { clubId, position: 0, points: 0, ...emptyTeamRecord() });
    return rows.get(clubId) as StandingRow;
  };

  for (const fixture of s.fixtures) {
    if (fixture.competitionType !== 'LEAGUE' || fixture.competitionId !== s.leagueId) continue;
    const home = ensure(fixture.home.id);
    const away = ensure(fixture.away.id);
    const score = s.results[fixture.id];
    if (!score) continue;
    home.played++;
    away.played++;
    home.goalsFor += score.home;
    home.goalsAgainst += score.away;
    away.goalsFor += score.away;
    away.goalsAgainst += score.home;
    if (score.home > score.away) {
      home.wins++;
      away.losses++;
      home.points += 3;
    } else if (score.home < score.away) {
      away.wins++;
      home.losses++;
      away.points += 3;
    } else {
      home.draws++;
      away.draws++;
      home.points++;
      away.points++;
    }
  }

  return [...rows.values()]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
        b.goalsFor - a.goalsFor ||
        a.clubId.localeCompare(b.clubId),
    )
    .map((row, index) => ({ ...row, position: index + 1 }));
}

function computeProgress(s: TurnSession): CompetitionProgress[] {
  const updates = new Map<ID, CompetitionProgress>();
  const tracked: readonly CompetitionType[] = ['DOMESTIC_CUP', 'CONTINENTAL', 'INTERNATIONAL'];
  const competitionIds = [
    ...new Set(
      s.fixtures
        .filter((f) => f.playerTeamSide && tracked.includes(f.competitionType))
        .map((f) => f.competitionId),
    ),
  ];

  for (const competitionId of competitionIds) {
    const played = s.fixtures.filter(
      (f) => f.competitionId === competitionId && f.playerTeamSide && s.results[f.id],
    );
    const knockouts = played.filter((f) => f.knockout);
    const group = s.groups.find((g) => g.competitionId === competitionId);

    if (knockouts.length) {
      const last = knockouts[knockouts.length - 1];
      const won = s.results[last.id].winner === last.playerTeamSide;
      updates.set(competitionId, {
        competitionId,
        status: won ? (last.isFinal ? 'CHAMPION' : 'ACTIVE') : 'ELIMINATED',
        stageReached: last.stage,
      });
    } else if (group) {
      const advanced = evaluateGroupAdvance(s, group.id);
      updates.set(competitionId, {
        competitionId,
        status: advanced ? 'ACTIVE' : 'ELIMINATED',
        stageReached: advanced ? `${group.stageLabel} 통과` : group.stageLabel,
      });
    }
  }

  return [...s.progressIn.filter((p) => !updates.has(p.competitionId)), ...updates.values()];
}

/** 우승 명성 보너스: 리그 우승·국내컵은 고정, 대륙·국제대회는 대회 위상(0~100)에 비례 */
const LEAGUE_TITLE_BONUS = 4;
const DOMESTIC_CUP_BONUS = 2;
const PRESTIGE_TROPHY_SCALE = 8;

function buildRivalComparison(
  s: TurnSession,
  stats: Record<CompetitionType, PlayerStatLine>,
): RivalComparison | null {
  const rival = s.rival;
  if (!rival || s.turn.phase === 'PRESEASON') return null;
  const rng = rngFor(s.seed, s.turn.season, s.turn.phase, 'rival', rival.npcId);
  const clubLine = mergeStatLines(stats.LEAGUE, stats.DOMESTIC_CUP, stats.CONTINENTAL);

  const leagueFixtures = s.fixtures.filter((f) => f.competitionType === 'LEAGUE' && s.results[f.id]);
  const rivalMatches = rival.clubId
    ? leagueFixtures.filter((f) => f.home.id === rival.clubId || f.away.id === rival.clubId).length
    : 0;
  const ownMatches = leagueFixtures.filter((f) => f.playerTeamSide).length;
  const matches = rivalMatches || ownMatches || 19;

  const [start, sub] = SELECTION_TABLE.LEAGUE[rival.playingTime];
  let appearances = 0;
  for (let i = 0; i < matches; i++) if (rng.chance(start + sub)) appearances++;

  const group = getPositionGroup(rival.position);
  const factor = clamp(Math.exp((rival.ovr - rival.clubPower) / 15), 0.3, 2.5);
  const goalRate = { FORWARD: 0.42, MIDFIELDER: 0.12, DEFENDER: 0.04, GOALKEEPER: 0 }[group];
  const assistRate = { FORWARD: 0.16, MIDFIELDER: 0.14, DEFENDER: 0.05, GOALKEEPER: 0.005 }[group];
  const goals = rng.poisson(appearances * goalRate * factor);
  const assists = rng.poisson(appearances * assistRate * factor);
  let cleanSheets = 0;
  if (group === 'DEFENDER' || group === 'GOALKEEPER') {
    const rate = clamp(0.28 + (rival.clubPower - s.leagueStrength) * 0.02, 0.1, 0.55);
    for (let i = 0; i < appearances; i++) if (rng.chance(rate)) cleanSheets++;
  }
  const rivalRating = appearances
    ? Math.round(
        (6.55 +
          (rival.ovr - rival.clubPower) * 0.03 +
          (goals * 0.9 + assists * 0.5 + cleanSheets * 0.4) / appearances +
          rng.normal(0, 0.1)) *
          100,
      ) / 100
    : null;

  return {
    npcId: rival.npcId,
    player: {
      appearances: clubLine.appearances,
      goals: clubLine.goals,
      assists: clubLine.assists,
      cleanSheets: clubLine.cleanSheets,
      averageRating: averageRating(clubLine),
    },
    rival: { appearances, goals, assists, cleanSheets, averageRating: rivalRating },
    headToHead: s.logs
      .filter((log) => rival.clubId && (log.home.id === rival.clubId || log.away.id === rival.clubId))
      .map((log) => {
        const r = resultFor(log.score, log.playerTeamSide);
        return { fixtureId: log.fixtureId, result: r === 'W' ? 'WIN' : r === 'D' ? 'DRAW' : 'LOSS' };
      }),
  };
}

export function finalizeTurn(session: TurnSession): TurnResult {
  if (session.status !== 'COMPLETE') throw new Error('턴이 아직 끝나지 않았습니다.');
  const s = structuredClone(session);

  const playerStats = emptyStatsByCompetition();
  const teamStats: Partial<Record<CompetitionType, TeamRecord>> = {};
  for (const log of s.logs) {
    if (log.player) addPlayerLine(playerStats[log.competitionType], log.player);
    const record = (teamStats[log.competitionType] ??= emptyTeamRecord());
    const r = resultFor(log.score, log.playerTeamSide);
    record.played++;
    record.wins += r === 'W' ? 1 : 0;
    record.draws += r === 'D' ? 1 : 0;
    record.losses += r === 'L' ? 1 : 0;
    record.goalsFor += log.playerTeamSide === 'HOME' ? log.score.home : log.score.away;
    record.goalsAgainst += log.playerTeamSide === 'HOME' ? log.score.away : log.score.home;
  }

  const leagueTable = computeLeagueTable(s);
  const progress = computeProgress(s);
  const ratings = summarizeTurnRatings(playerStats);

  // 우승: 후반기 리그 1위 + 이번 턴에 치른 결승 승리.
  // 클럽 우승은 1군 소속일 때만 기록한다 (유스·B팀 선수에게 1군 트로피를 주지 않음).
  const trophies: TrophyWin[] = [];
  const isFirstTeam = s.player.squad.level === 'FIRST_TEAM';
  if (isFirstTeam && s.turn.phase === 'SECOND_HALF' && s.clubId && s.leagueId && leagueTable[0]?.clubId === s.clubId) {
    trophies.push({ competitionId: s.leagueId, season: s.turn.season, teamId: s.clubId, teamKind: 'CLUB' });
  }
  for (const fixture of s.fixtures) {
    const score = s.results[fixture.id];
    if (!fixture.isFinal || !fixture.playerTeamSide || !score || score.winner !== fixture.playerTeamSide) continue;
    const national = fixture.squad === 'NATIONAL';
    if (!national && !isFirstTeam) continue;
    const team = fixture.playerTeamSide === 'HOME' ? fixture.home : fixture.away;
    trophies.push({ competitionId: fixture.competitionId, season: s.turn.season, teamId: team.id, teamKind: national ? 'NATION' : 'CLUB' });
  }
  // 팀 우승은 출전 여부와 무관하게 기록하되, 명성 보너스는 공식전에 출전했을 때만 준다
  const competitive = competitiveLine(playerStats);
  const trophyBonus =
    competitive.appearances > 0
      ? trophies.reduce((sum, t) => {
          const domesticWeight = leagueReputationWeight(s.leagueStrength);
          if (t.competitionId === s.leagueId) return sum + LEAGUE_TITLE_BONUS * domesticWeight;
          const prestige = s.competitionPrestige[t.competitionId];
          return sum + (prestige === undefined ? DOMESTIC_CUP_BONUS * domesticWeight : (prestige / 100) * PRESTIGE_TROPHY_SCALE);
        }, 0)
      : 0;

  const eligibleMatches = s.fixtures.filter(
    (f) => s.results[f.id] && f.playerTeamSide && isEligible(s, f) && COMPETITIVE.includes(f.competitionType),
  ).length;

  const reputationDelta = calculateReputationDelta({
    reputation: s.player.reputation,
    appearances: competitive.appearances,
    eligibleMatches,
    averageRating: averageRating(competitive),
    goals: competitive.goals,
    assists: competitive.assists,
    cleanSheets: competitive.cleanSheets,
    keyPasses: competitive.keyPasses,
    leagueStrength: s.leagueStrength,
    trophyBonus,
    highlightBonus: s.highlightEffects.reputation,
  });

  const standingDelta = calculateStandingDelta({
    averageRating: ratings.overall ?? ratings.reserve ?? ratings.friendly,
    ovr: s.player.ovr,
    teamPower: teamPowerForStanding(s) ?? s.clubPower ?? s.player.ovr,
    isFirstTeam: s.player.squad.level === 'FIRST_TEAM',
    highlightBonus: s.highlightEffects.standing,
  });

  // 팀 성적에 따른 멘탈 변화
  const moraleRecords = Object.entries(teamStats)
    .filter(([type]) => type !== 'FRIENDLY')
    .map(([, record]) => record as TeamRecord);
  const played = moraleRecords.reduce((sum, r) => sum + r.played, 0);
  const wins = moraleRecords.reduce((sum, r) => sum + r.wins, 0);
  const moraleDrift = played > 0 ? (wins / played - 0.45) * 8 : 0;

  return {
    turn: s.turn,
    clubId: s.clubId,
    leagueId: s.leagueId,
    matches: s.logs,
    playerStats,
    teamStats,
    leagueTable,
    progress,
    ratings,
    condition: { start: Math.round(s.conditionStart), end: Math.round(s.condition) },
    mental: { start: Math.round(s.mentalStart), end: Math.round(clamp(s.mental + moraleDrift, 0, 100)) },
    highlight: s.highlightRecord,
    partner: s.partner && s.partnerTally ? { npcId: s.partner.npcId, ...s.partnerTally } : null,
    rival: buildRivalComparison(s, playerStats),
    trophies,
    nationalDuty: s.nationalDuty !== null,
    reputationDelta,
    standingDelta,
  };
}

/** 입지 판단 기준 팀 실력: 주인공이 뛴 스쿼드(1군/B팀)의 실력 */
function teamPowerForStanding(s: TurnSession): number | null {
  const log = s.logs.find((l) => l.player && l.competitionType !== 'INTERNATIONAL');
  if (!log) return null;
  return log.playerTeamSide === 'HOME' ? log.home.power : log.away.power;
}
