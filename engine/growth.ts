/**
 * 능력치 성장 · 노화
 *
 * 성장 경로는 네 가지다.
 *  1) 훈련 (턴 사이 1회): 큰 카테고리 1개 소폭 상승 / 세부 능력치 2~3개 상승 / 벌크업·감량 / 휴식
 *  2) 경험 (매 턴): 출전 시간에 비례해 포지션 핵심 능력치가 오른다 (어릴수록 크게)
 *  3) 자연 성장 (매 턴): 모든 능력치가 소폭 오르고 포지션 핵심 능력치가 더 오른다.
 *     피지컬은 어릴 때 빠르게(25세 무렵 멈춤), 기술은 30세 무렵까지, 판단력(멘탈)은 33세 무렵까지 오른다.
 *  4) 노화 (시즌 종료): 30세 전후부터 스피드 → 체력 → 기술 순으로 하락
 * 필드 선수 포텐셜(80~100)은 18개 능력치 단순 평균의 성장 한도, GK(80~100)는 기존 최대 OVR이다.
 *  - levelFactor: 현재 수치가 '포텐셜에 비해' 높을수록 덜 오른다 (재능이 클수록 높은 수치에서도 잘 오른다)
 *  - potentialFactor: 성장 기준값이 포텐셜에 가까워지면 모든 상승이 줄고, 포텐셜에 닿으면 멈춘다
 * 경기·자연 성장의 소수점은 턴을 넘어 누적하고, 선택 훈련은 확률적 반올림으로 정수화한다.
 */
import { CATEGORY_ATTRIBUTES, GOALKEEPING_ATTRIBUTES } from '@/data/attributes';
import { getPositionProfile } from '@/data/playstyles';
import {
  ATTRIBUTE_KEYS,
  FIELD_STAT_KEYS,
  GK_STAT_KEYS,
  type AttributeKey,
  type Attributes,
  type CompetitionType,
  type PlayerState,
  type PlayerStatLine,
  type Position,
  type StatCategory,
  type TrainingIntensity,
  type TrainingPlan,
  type TrainingResult,
  type TurnDevelopmentReport,
} from '@/types/game';
import { BODY_LIMITS } from './character';
import { calculateOVR } from './ovr';
import { clamp, round1, rngFor, type Rng } from './rng';

export const GROWTH_CONFIG = {
  inSeason: {
    youthAge: 19,
    fullExposureMinutes: 1080,
    naturalBase: 1.65,
    adultBenchBase: 0.12,
    paceMin: 0.9,
    paceMax: 1.1,
  },
  training: {
    /** 카테고리 훈련: 세부 3개 각각 */
    categoryBase: 1.15,
    /** 필드는 경기 성장과 훈련의 중첩으로 조기 완성되지 않도록 조정. GK는 기존 효율 유지. */
    fieldEfficiency: 0.6,
    /** 세부 훈련: 고른 개수별 1개당 */
    focusedBase: { 2: 2.1, 3: 1.6 } as Record<number, number>,
    /** 벌크업·감량 주 능력치 변화 */
    bodyBase: 1.6,
    intensity: {
      LIGHT: { gain: 0.6, condition: -6, mental: 0, weight: 1.0 },
      NORMAL: { gain: 1.0, condition: -12, mental: 0, weight: 1.8 },
      INTENSE: { gain: 1.4, condition: -20, mental: -2, weight: 2.6 },
    } satisfies Record<TrainingIntensity, { gain: number; condition: number; mental: number; weight: number }>,
    rest: { condition: 22, mental: 3 },
  },
  experience: {
    reserveWeight: 0.6,
    friendlyWeight: 0.3,
  },
  /**
   * 스타일 간 성장 속도 보정.
   * OVR 가중치가 여러 능력치에 퍼진 스타일(박스 투 박스·인사이드 포워드)은 같은 훈련·경험으로도
   * OVR이 덜 오른다. 이를 맞추지 않으면 포처·스토퍼만 최고 OVR이 5~7 높아진다.
   */
  styleBalance: {
    /** 훈련 효율 = 기준 비중 ÷ (상위 2개 가중치 비중) */
    referenceTopShare: 0.5,
    trainingMin: 0.85,
    trainingMax: 1.6,
    /** 경험·자연 성장 1포인트가 OVR로 이어지는 비율 (모든 스타일 동일) */
    growthOvrRate: 0.72,
  },
  potential: {
    /** 예전 세이브처럼 포텐셜이 없을 때 */
    default: 90,
    /** 성장 기준값이 포텐셜 n 이내로 다가오면 상승이 줄기 시작한다 */
    softZone: 3,
    /** 재능 배율 지수: 포텐셜 80 → 0.79배, 99 → 1.21배 (2일 때) */
    talentExponent: 2,
  },
  /** 매 턴 자연 성장 */
  turnGrowth: {
    /** 나이 곡선 1 · 목표까지 gapUnit 이상 남았을 때 핵심 능력치(가중치 1)의 한 턴 상승량 */
    base: 0.62,
    /** 포지션과 무관한 능력치도 이만큼은 오른다 (핵심 능력치는 1 + 이 값) */
    minShare: 0.25,
    /** 목표까지 남은 거리가 클수록 빨리 오른다: 배율 = 남은 거리 / gapUnit (최대 gapMax) */
    gapUnit: 10,
    gapMax: 2.5,
    /** 능력치별 목표: OVR에 쓰이는 능력치는 포텐셜 + roleTargetBonus, 나머지는 포텐셜 × offRoleTarget */
    roleTargetBonus: 3,
    offRoleTarget: 0.6,
  },
} as const;

// ----------------------------------------------------------------------------
// 공통 보정
// ----------------------------------------------------------------------------

const AGE_CURVE: ReadonlyArray<[number, number]> = [
  [18, 1], [20, 0.95], [22, 0.85], [24, 0.7], [26, 0.55], [28, 0.4], [30, 0.25], [32, 0.12], [34, 0.05],
];

/** 훈련 효율: 어릴수록 높다 */
export function trainingAgeFactor(age: number): number {
  if (age <= AGE_CURVE[0][0]) return AGE_CURVE[0][1];
  for (let i = 1; i < AGE_CURVE.length; i++) {
    const [a1, f1] = AGE_CURVE[i];
    const [a0, f0] = AGE_CURVE[i - 1];
    if (age <= a1) return f0 + ((f1 - f0) * (age - a0)) / (a1 - a0);
  }
  return AGE_CURVE[AGE_CURVE.length - 1][1];
}

export function potentialOf(player: Pick<PlayerState, 'potential'>): number {
  return player.potential ?? GROWTH_CONFIG.potential.default;
}

/**
 * 현재 수치가 포텐셜에 비해 높을수록 덜 오른다.
 * 포텐셜 90 기준 57 → 1.0, 77 → 0.5, 89 → 0.2 (포텐셜이 10 높으면 같은 상승률을 10 높은 수치에서 낸다)
 */
export function levelFactor(value: number, potential: number = GROWTH_CONFIG.potential.default): number {
  return clamp((potential + 7 - value) / 40, 0.1, 1.2);
}

/** 필드 능력치 18개만 같은 비중으로 평균낸다. 반올림하거나 GK 스탯을 포함하지 않는다. */
export function fieldAttributeAverage(attributes: Attributes): number {
  return FIELD_STAT_KEYS.reduce((sum, key) => sum + attributes[key], 0) / FIELD_STAT_KEYS.length;
}

/** 포텐셜과 비교하는 현재 성장값. 포지션 OVR 계산 자체는 바꾸지 않는다. */
export function potentialProgress(player: Pick<PlayerState, 'profile' | 'attributes' | 'ovr'>): number {
  return player.profile.role.position === 'GK' ? player.ovr : fieldAttributeAverage(player.attributes);
}

/** 성장 한도에 가까울수록 상승을 줄인다. GK는 기존 OVR 기준 및 재능 배율을 유지한다. */
export function potentialFactor(player: Pick<PlayerState, 'potential' | 'ovr' | 'profile' | 'attributes'>): number {
  const potential = potentialOf(player);
  const room = potential - potentialProgress(player);
  const talent = (potential / GROWTH_CONFIG.potential.default) ** GROWTH_CONFIG.potential.talentExponent;
  return Math.sqrt(clamp(room / GROWTH_CONFIG.potential.softZone, 0, 1)) * talent;
}

export function stochasticRound(rng: Rng, value: number): number {
  const base = Math.floor(value);
  return base + (rng.next() < value - base ? 1 : 0);
}

export function attributeCategory(key: AttributeKey): StatCategory | 'GOALKEEPING' {
  for (const [category, keys] of Object.entries(CATEGORY_ATTRIBUTES) as Array<[StatCategory, readonly string[]]>) {
    if (keys.includes(key)) return category;
  }
  return 'GOALKEEPING';
}

function focusMultiplier(player: PlayerState, key: AttributeKey): number {
  const focus = player.growthFocus;
  return focus && focus.remainingTurns > 0 && attributeCategory(key) === focus.category ? focus.multiplier : 1;
}

/** 현재 포지션의 OVR 가중치를 0~1로 정규화 */
export function roleWeights(player: PlayerState): Partial<Record<AttributeKey, number>> {
  const weights = getPositionProfile(player.profile.role.position).ovrWeights;
  const max = Math.max(...Object.values(weights).map((w) => w ?? 0));
  return Object.fromEntries(Object.entries(weights).map(([key, w]) => [key, (w ?? 0) / max]));
}

/** 같은 훈련으로 오르는 OVR이 포지션마다 비슷해지도록 하는 훈련 효율 배율 */
export function positionTrainingEfficiency(position: Position): number {
  const b = GROWTH_CONFIG.styleBalance;
  const weights = Object.values(getPositionProfile(position).ovrWeights)
    .map((w) => w ?? 0)
    .sort((a, c) => c - a);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const topShare = (weights[0] + (weights[1] ?? 0)) / total;
  return clamp(b.referenceTopShare / topShare, b.trainingMin, b.trainingMax);
}

/**
 * 경기 경험·자연 성장의 능력치별 배분.
 * 가중치에 비례해 나누되, 어느 포지션이든 성장 1포인트가 OVR을 같은 만큼 올리도록 정규화한다.
 */
export function growthShares(player: PlayerState): Partial<Record<AttributeKey, number>> {
  const weights = getPositionProfile(player.profile.role.position).ovrWeights;
  const values = Object.values(weights).map((w) => w ?? 0);
  const total = values.reduce((sum, w) => sum + w, 0);
  const squares = values.reduce((sum, w) => sum + w * w, 0);
  const scale = (GROWTH_CONFIG.styleBalance.growthOvrRate * total) / squares;
  return Object.fromEntries(Object.entries(weights).map(([key, w]) => [key, (w ?? 0) * scale]));
}

function applyDeltas(
  player: PlayerState,
  deltas: Partial<Record<AttributeKey, number>>,
): PlayerState {
  const attributes: Attributes = { ...player.attributes };
  for (const [key, delta] of Object.entries(deltas) as Array<[AttributeKey, number]>) {
    attributes[key] = Math.round(clamp(attributes[key] + delta, 1, 99));
  }
  return { ...player, attributes, ovr: calculateOVR(attributes, player.profile.role) };
}

function roundDeltas(rng: Rng, expected: Partial<Record<AttributeKey, number>>): Partial<Record<AttributeKey, number>> {
  const out: Partial<Record<AttributeKey, number>> = {};
  for (const [key, value] of Object.entries(expected) as Array<[AttributeKey, number]>) {
    const rounded = value >= 0 ? stochasticRound(rng, value) : -stochasticRound(rng, -value);
    if (rounded !== 0) out[key] = rounded;
  }
  return out;
}

/** 게임의 턴 진행에서는 작은 성장량을 소멸시키지 않고 다음 턴으로 누적한다. */
interface DevelopmentEnvironment { multiplier: number; youth: boolean }

function developmentCap(player: PlayerState, environment?: DevelopmentEnvironment): number {
  const cap = potentialFactor(player);
  if (!environment?.youth || cap <= 0) return cap;
  // 유소년 시기의 성장 속도는 숨은 포텐셜 숫자를 드러내지 않는다. 상한은 그대로 지킨다.
  return cap / ((potentialOf(player) / GROWTH_CONFIG.potential.default) ** GROWTH_CONFIG.potential.talentExponent);
}

function settleDevelopment(player: PlayerState, expected: Partial<Record<AttributeKey, number>>, rng: Rng, environment?: DevelopmentEnvironment): { player: PlayerState; deltas: Partial<Record<AttributeKey, number>> } {
  if (!environment) {
    const deltas = roundDeltas(rng, expected);
    return { player: applyDeltas(player, deltas), deltas };
  }
  const credits = { ...player.developmentCredits };
  const keys = ATTRIBUTE_KEYS.filter((key) => (expected[key] ?? 0) > 0 && player.attributes[key] < 99);
  for (const key of keys) credits[key] = (credits[key] ?? 0) + expected[key]!;
  for (const key of ATTRIBUTE_KEYS) if (player.attributes[key] >= 99) delete credits[key];
  const available = Math.max(0, Math.floor(keys.reduce((sum, key) => sum + (credits[key] ?? 0), 0) + 1e-9));
  const capPoints = player.profile.role.position === 'GK' ? available : Math.max(0, Math.floor((potentialOf(player) - fieldAttributeAverage(player.attributes)) * FIELD_STAT_KEYS.length + 1e-8));
  const deltas: Partial<Record<AttributeKey, number>> = {};
  // 정수 성장 포인트를 가장 많이 누적한 능력치부터 배분한다. 배분한 몫은 다음 계산에서 차감한다.
  for (let point = 0; point < Math.min(available, capPoints); point++) {
    const eligible = keys.filter((key) => player.attributes[key] + (deltas[key] ?? 0) < 99);
    if (!eligible.length) break;
    const key = eligible.reduce((best, current) => (credits[current] ?? 0) > (credits[best] ?? 0) ? current : best);
    deltas[key] = (deltas[key] ?? 0) + 1;
    credits[key] = Math.round(((credits[key] ?? 0) - 1) * 1e10) / 1e10;
  }
  return { player: { ...applyDeltas(player, deltas), developmentCredits: credits }, deltas };
}

// ----------------------------------------------------------------------------
// 훈련
// ----------------------------------------------------------------------------

/**
 * 세부 능력치 1개를 '세부 훈련(2개 선택, 보통 강도)'으로 1회 훈련했을 때의 기대 상승량.
 * 상점 아이템 상승량의 상한으로도 쓰인다.
 */
export function expectedTrainingGain(player: PlayerState, key: AttributeKey): number {
  return (
    GROWTH_CONFIG.training.focusedBase[2] *
    trainingAgeFactor(player.age) *
    levelFactor(player.attributes[key], potentialOf(player)) *
    focusMultiplier(player, key) *
    positionTrainingEfficiency(player.profile.role.position) *
    (player.profile.role.position === 'GK' ? 1 : GROWTH_CONFIG.training.fieldEfficiency) *
    potentialFactor(player)
  );
}

export interface TrainingPreview {
  weakFootDelta?: number;
  gains: Partial<Record<AttributeKey, number>>;
  weightDelta: number;
  conditionDelta: number;
  mentalDelta: number;
}

export function validateTrainingPlan(plan: TrainingPlan): string | null {
  if (plan.kind === 'FOCUSED') {
    const unique = new Set(plan.attributes);
    if (unique.size !== plan.attributes.length) return '같은 능력치를 두 번 고를 수 없습니다.';
    if (plan.attributes.length < 2 || plan.attributes.length > 3) return '세부 훈련은 능력치 2~3개를 골라야 합니다.';
  }
  return null;
}

export function previewTraining(player: PlayerState, plan: TrainingPlan): TrainingPreview {
  const t = GROWTH_CONFIG.training;
  if (plan.kind === 'REST') {
    return { gains: {}, weightDelta: 0, conditionDelta: t.rest.condition, mentalDelta: t.rest.mental };
  }
  if (plan.kind === 'WEAK_FOOT') return { gains: {}, weakFootDelta: Math.min(3, 100 - (player.weakFoot ?? 40)), weightDelta: 0, conditionDelta: -8, mentalDelta: 0 };
  const intensity = t.intensity[plan.intensity];
  const age = trainingAgeFactor(player.age) * positionTrainingEfficiency(player.profile.role.position) * (player.profile.role.position === 'GK' ? 1 : t.fieldEfficiency);
  const potential = potentialOf(player);
  const cap = potentialFactor(player);
  const gains: Partial<Record<AttributeKey, number>> = {};
  let weightDelta = 0;

  const grow = (key: AttributeKey, base: number) => {
    gains[key] = round1(base * intensity.gain * age * levelFactor(player.attributes[key], potential) * focusMultiplier(player, key) * cap);
  };

  if (plan.kind === 'CATEGORY') {
    if (plan.category === 'GOALKEEPING') {
      // 골키핑은 세부 6개라 1개당 상승폭을 절반 수준으로
      for (const key of GOALKEEPING_ATTRIBUTES) grow(key, t.categoryBase * 0.55);
    } else {
      for (const key of CATEGORY_ATTRIBUTES[plan.category]) grow(key, t.categoryBase);
    }
  } else if (plan.kind === 'FOCUSED') {
    const base = t.focusedBase[plan.attributes.length] ?? t.focusedBase[3];
    for (const key of plan.attributes) grow(key, base);
  } else {
    // 벌크업·감량: 몸무게 한계에 가까우면 변화량이 줄어든다
    const direction = plan.kind === 'BULK_UP' ? 1 : -1;
    const target = clamp(player.weightKg + direction * intensity.weight, BODY_LIMITS.weightKg.min, BODY_LIMITS.weightKg.max);
    weightDelta = round1(target - player.weightKg);
    const scale = intensity.weight > 0 ? Math.abs(weightDelta) / intensity.weight : 0;
    const g = t.bodyBase * intensity.gain * Math.max(0.5, age) * scale;
    const [upMain, upSub, downA, downB]: AttributeKey[] =
      plan.kind === 'BULK_UP'
        ? ['strength', 'aerial', 'acceleration', 'agility']
        : ['acceleration', 'agility', 'strength', 'aerial'];
    gains[upMain] = round1(g * levelFactor(player.attributes[upMain], potential) * cap);
    gains[upSub] = round1(0.7 * g * levelFactor(player.attributes[upSub], potential) * cap);
    gains[downA] = round1(-0.6 * g);
    gains[downB] = round1(-0.6 * g);
    const bmi = (player.weightKg + weightDelta) / (player.profile.heightCm / 100) ** 2;
    if (bmi > 27 || bmi < 19.5) gains.stamina = -0.5;
  }

  return { gains, weightDelta, conditionDelta: intensity.condition, mentalDelta: intensity.mental };
}

export function applyTraining(
  player: PlayerState,
  plan: TrainingPlan,
  rng: Rng,
): { player: PlayerState; result: TrainingResult } {
  const error = validateTrainingPlan(plan);
  if (error) throw new Error(error);
  const preview = previewTraining(player, plan);
  const deltas = roundDeltas(rng, preview.gains);
  const trained = applyDeltas(player, deltas);
  return {
    player: {
      ...trained,
      weakFoot: clamp((player.weakFoot ?? 40) + (preview.weakFootDelta ?? 0), 0, 100),
      weightKg: round1(player.weightKg + preview.weightDelta),
      condition: clamp(player.condition + preview.conditionDelta, 0, 100),
      mental: clamp(player.mental + preview.mentalDelta, 0, 100),
    },
    result: {
      plan,
      ...(preview.weakFootDelta !== undefined ? { weakFootDelta: preview.weakFootDelta } : {}),
      deltas,
      weightDelta: preview.weightDelta,
      conditionDelta: preview.conditionDelta,
      mentalDelta: preview.mentalDelta,
    },
  };
}

// ----------------------------------------------------------------------------
// 경험 성장 (출전 시간)
// ----------------------------------------------------------------------------

function experienceRate(age: number): number {
  if (age <= 19) return 0.07;
  if (age <= 22) return 0.045;
  if (age <= 25) return 0.025;
  if (age <= 28) return 0.012;
  return 0.004;
}

export function applyMatchExperience(
  player: PlayerState,
  stats: Record<CompetitionType, PlayerStatLine>,
  rng: Rng,
  environment?: DevelopmentEnvironment,
): { player: PlayerState; deltas: Partial<Record<AttributeKey, number>> } {
  const e = GROWTH_CONFIG.experience;
  const minutes =
    stats.LEAGUE.minutes +
    stats.DOMESTIC_CUP.minutes +
    stats.CONTINENTAL.minutes +
    stats.INTERNATIONAL.minutes +
    stats.RESERVE.minutes * e.reserveWeight +
    stats.FRIENDLY.minutes * e.friendlyWeight;
  const points = (minutes / 90) * experienceRate(player.age) * developmentCap(player, environment) * (environment?.multiplier ?? 1);
  if (points <= 0) return { player, deltas: {} };

  const expected: Partial<Record<AttributeKey, number>> = {};
  const potential = environment?.youth ? GROWTH_CONFIG.potential.default : potentialOf(player);
  for (const [key, weight] of Object.entries(growthShares(player)) as Array<[AttributeKey, number]>) {
    expected[key] = points * weight * levelFactor(player.attributes[key], potential);
  }
  return settleDevelopment(player, expected, rng, environment);
}

// ----------------------------------------------------------------------------
// 자연 성장 (매 턴)
// ----------------------------------------------------------------------------

export type GrowthGroup = 'PHYSICAL' | 'TECHNICAL' | 'MENTAL';

/** 피지컬(신체) · 기술 · 멘탈(판단 · 위치 선정) */
export const GROWTH_GROUP: Record<AttributeKey, GrowthGroup> = {
  sprintSpeed: 'PHYSICAL', acceleration: 'PHYSICAL', agility: 'PHYSICAL', stamina: 'PHYSICAL', strength: 'PHYSICAL', aerial: 'PHYSICAL',
  reflexes: 'PHYSICAL', gkRange: 'PHYSICAL',
  finishing: 'TECHNICAL', shotPower: 'TECHNICAL', kickAccuracy: 'TECHNICAL', setPieces: 'TECHNICAL', technique: 'TECHNICAL', takeOn: 'TECHNICAL',
  tackling: 'TECHNICAL', distribution: 'TECHNICAL', goalKick: 'TECHNICAL',
  offTheBall: 'MENTAL', vision: 'MENTAL', pressResistance: 'MENTAL', interceptions: 'MENTAL', defPositioning: 'MENTAL',
  gkPositioning: 'MENTAL', organization: 'MENTAL',
};

/** 나이별 한 턴 자연 성장 배율 (사이 나이는 보간) */
export const TURN_GROWTH_CURVE: Record<GrowthGroup, ReadonlyArray<[number, number]>> = {
  PHYSICAL: [[16, 1.0], [19, 1.0], [21, 0.7], [23, 0.35], [25, 0.1], [27, 0]],
  TECHNICAL: [[16, 0.7], [20, 0.8], [24, 0.8], [27, 0.65], [29, 0.45], [31, 0.15], [33, 0]],
  MENTAL: [[16, 0.5], [20, 0.65], [24, 0.8], [27, 0.8], [29, 0.6], [31, 0.35], [34, 0.1], [36, 0]],
};

export function turnGrowthRate(group: GrowthGroup, age: number): number {
  const curve = TURN_GROWTH_CURVE[group];
  if (age <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [a1, r1] = curve[i];
    const [a0, r0] = curve[i - 1];
    if (age <= a1) return r0 + ((r1 - r0) * (age - a0)) / (a1 - a0);
  }
  return curve[curve.length - 1][1];
}

/**
 * 매 턴 자연 성장: 모든 능력치가 소폭 오르고 포지션 핵심 능력치가 더 오른다.
 * 필드 선수는 GK 스탯이 오르지 않고, GK는 GK 스탯과 신체 능력만 오른다.
 */
export function applyTurnGrowth(player: PlayerState, rng: Rng, environment?: DevelopmentEnvironment): { player: PlayerState; deltas: Partial<Record<AttributeKey, number>> } {
  const cap = developmentCap(player, environment);
  if (cap <= 0) return { player, deltas: {} };
  const g = GROWTH_CONFIG.turnGrowth;
  const isGK = player.profile.role.position === 'GK';
  const weights = roleWeights(player);
  const potential = potentialOf(player);
  const expected: Partial<Record<AttributeKey, number>> = {};
  for (const key of ATTRIBUTE_KEYS) {
    const isGkStat = (GK_STAT_KEYS as readonly string[]).includes(key);
    if (isGK ? !isGkStat && GROWTH_GROUP[key] !== 'PHYSICAL' : isGkStat) continue;
    const rate = turnGrowthRate(GROWTH_GROUP[key], player.age);
    if (rate <= 0) continue;
    const weight = weights[key] ?? 0;
    // 필드 선수는 비주력 능력치도 같은 평균 한도를 향해 성장한다. GK의 기존 목표는 유지한다.
    const target = environment?.youth ? Math.min(99, player.attributes[key] + g.gapUnit) : !isGK || weight > 0 ? Math.min(99, potential + g.roleTargetBonus) : potential * g.offRoleTarget;
    const remaining = target - player.attributes[key];
    if (remaining <= 0) continue;
    const pull = clamp(remaining / g.gapUnit, 0, g.gapMax);
    expected[key] = g.base * rate * (g.minShare + weight) * pull * cap * (environment?.multiplier ?? 1);
  }
  return settleDevelopment(player, expected, rng, environment);
}

// ----------------------------------------------------------------------------
// 노화 (시즌 종료)
// ----------------------------------------------------------------------------

type DeclineGroup = 'SPEED' | 'ENDURANCE' | 'POWER' | 'TECHNICAL' | 'MIND';

const DECLINE_GROUP: Record<AttributeKey, DeclineGroup> = {
  sprintSpeed: 'SPEED', acceleration: 'SPEED', agility: 'SPEED',
  stamina: 'ENDURANCE',
  strength: 'POWER', aerial: 'POWER',
  technique: 'TECHNICAL', takeOn: 'TECHNICAL', pressResistance: 'TECHNICAL',
  finishing: 'MIND', shotPower: 'MIND', offTheBall: 'MIND', kickAccuracy: 'MIND', vision: 'MIND', setPieces: 'MIND',
  tackling: 'MIND', interceptions: 'MIND', defPositioning: 'MIND',
  reflexes: 'SPEED', gkRange: 'SPEED',
  gkPositioning: 'MIND', organization: 'MIND', distribution: 'MIND', goalKick: 'MIND',
};

/** 새 나이 기준 그룹별 연간 하락량. GK는 3년 늦게 시작한다. */
export function declineProfile(age: number, isGoalkeeper: boolean): Record<DeclineGroup, number> {
  const a = isGoalkeeper ? age - 3 : age;
  const table: Record<number, [number, number, number, number, number]> = {
    30: [1, 0.5, 0, 0, 0],
    31: [1.5, 1, 0.3, 0.3, 0],
    32: [2, 1.5, 0.6, 0.8, 0.3],
    33: [2.5, 2, 1, 1.2, 0.6],
    34: [3, 2.5, 1.5, 1.6, 1],
    35: [3.5, 3, 2, 2, 1.4],
  };
  const extra = Math.max(0, a - 35) * 0.3;
  const row = a < 30 ? [0, 0, 0, 0, 0] : (table[Math.min(a, 35)] ?? table[35]).map((v) => (v > 0 ? v + extra : v));
  const speed = isGoalkeeper ? row[0] * 0.8 : row[0];
  return { SPEED: speed, ENDURANCE: row[1], POWER: row[2], TECHNICAL: row[3], MIND: row[4] };
}

export interface AgingResult {
  player: PlayerState;
  deltas: Partial<Record<AttributeKey, number>>;
  /** 아이템 노화 방어로 막아 낸 하락량 */
  shielded: Partial<Record<AttributeKey, number>>;
}

/** 나이를 1살 올리고 노화를 적용한다 (자연 성장은 매 턴 applyTurnGrowth). 노화 방어(agingShields)는 소모된다. */
export function applySeasonalAging(player: PlayerState, rng: Rng): AgingResult {
  const isGK = player.profile.role.position === 'GK';
  const newAge = player.age + 1;
  const decline = declineProfile(newAge, isGK);
  const expected: Partial<Record<AttributeKey, number>> = {};
  const shielded: Partial<Record<AttributeKey, number>> = {};

  for (const key of ATTRIBUTE_KEYS) {
    const isGkStat = (GK_STAT_KEYS as readonly string[]).includes(key);
    if (isGkStat && !isGK) continue;
    let delta = 0;
    const loss = decline[DECLINE_GROUP[key]] * (0.8 + 0.4 * rng.next());
    if (loss > 0) {
      const shield = player.agingShields[key] ?? 0;
      const blocked = Math.min(shield, loss);
      if (blocked > 0) shielded[key] = round1(blocked);
      delta -= loss - blocked;
    }
    if (delta !== 0) expected[key] = delta;
  }

  const deltas = roundDeltas(rng, expected);
  let veteranDevelopmentCredit = player.veteranDevelopmentCredit ?? 0;
  if (!isGK && newAge >= 30 && newAge <= 35) {
    const lostPhysical = FIELD_STAT_KEYS.reduce((sum, key) => sum + (GROWTH_GROUP[key] === 'PHYSICAL' ? Math.max(0, player.attributes[key] - clamp(player.attributes[key] + (deltas[key] ?? 0), 1, 99)) : 0), 0);
    const credit = veteranDevelopmentCredit + lostPhysical * 0.35;
    let budget = Math.min(3, Math.floor(credit));
    veteranDevelopmentCredit = credit - Math.floor(credit);
    const afterDecline = applyDeltas(player, deltas);
    let room = Math.max(0, Math.floor((potentialOf(player) - fieldAttributeAverage(afterDecline.attributes)) * FIELD_STAT_KEYS.length + 1e-8));
    const weights = roleWeights(player);
    const candidates = FIELD_STAT_KEYS.filter((key) => GROWTH_GROUP[key] !== 'PHYSICAL' && player.attributes[key] < 99);
    while (budget > 0 && candidates.length) {
      const eligible = candidates.filter((key) => 1 - (deltas[key] ?? 0) <= Math.min(budget, room));
      if (!eligible.length) break;
      const key = eligible[rng.weightedIndex(eligible.map((candidate) => 0.5 + (weights[candidate] ?? 0)))];
      const cost = 1 - (deltas[key] ?? 0);
      deltas[key] = 1;
      budget -= cost;
      room -= cost;
      candidates.splice(candidates.indexOf(key), 1);
    }
  }
  const aged = applyDeltas({ ...player, age: newAge }, deltas);
  return { player: { ...aged, veteranDevelopmentCredit, agingShields: {} }, deltas, shielded };
}

/** 공개된 성장 가이드의 원칙을 바탕으로 출전·활약·컨디션을 매 턴 반영한다. */
export function turnDevelopmentFactors(player: PlayerState, stats: Record<CompetitionType, PlayerStatLine>, seed: number, conditionStart = player.condition) {
  const lines = Object.values(stats);
  const minutes = lines.reduce((sum, line) => sum + line.minutes, 0);
  const weightedMinutes = stats.LEAGUE.minutes + stats.DOMESTIC_CUP.minutes + stats.CONTINENTAL.minutes + stats.INTERNATIONAL.minutes + stats.RESERVE.minutes * GROWTH_CONFIG.experience.reserveWeight + stats.FRIENDLY.minutes * GROWTH_CONFIG.experience.friendlyWeight;
  const appearances = lines.reduce((sum, line) => sum + line.appearances, 0);
  const rating = appearances ? lines.reduce((sum, line) => sum + line.ratingSum, 0) / appearances : null;
  const performance = rating === null ? 1 : clamp(1 + (rating - 6.7) * 0.25, 0.65, 1.4);
  const condition = clamp((conditionStart + player.condition) / 2, 0, 100);
  const health = 0.35 + 0.65 * condition / 100;
  const config = GROWTH_CONFIG.inSeason;
  const exposure = clamp(weightedMinutes / config.fullExposureMinutes, 0, 1.25);
  const youth = player.age < config.youthAge;
  const opportunity = youth ? 0.8 + 0.4 * exposure : config.adultBenchBase + (1 - config.adultBenchBase) * exposure;
  const pace = rngFor(seed, 'development-pace').float(config.paceMin, config.paceMax);
  return { minutes, rating, condition, youth, performance, health, exposure, pace,
    experienceMultiplier: performance * health * pace,
    naturalMultiplier: config.naturalBase * opportunity * performance * health * pace };
}

/** 남은 평균 격차 중 1년 동안 성장하는 비율. 어린 선수일수록 높다. */
export function fieldGrowthRate(age: number): number {
  const curve: ReadonlyArray<[number, number]> = [[16, 0.18], [19, 0.17], [23, 0.16], [27, 0.15], [30, 0.06], [32, 0]];
  if (age <= 16) return 0.18;
  for (let i = 1; i < curve.length; i++) {
    const [end, value] = curve[i];
    const [start, previous] = curve[i - 1];
    if (age <= end) return previous + (value - previous) * (age - start) / (end - start);
  }
  return 0;
}

function applyFieldDevelopment(player: PlayerState, factors: ReturnType<typeof turnDevelopmentFactors>, experiencePoints: number, rng: Rng): { player: PlayerState; deltas: Partial<Record<AttributeKey, number>> } {
  const rate = fieldGrowthRate(player.age);
  if (rate <= 0 || potentialFactor(player) <= 0) return { player, deltas: {} };
  const room = Math.max(0, potentialOf(player) - fieldAttributeAverage(player.attributes));
  // 연간 평균 성장 기대값 = 남은 격차 × 나이별 성장률 + 1. 한도 직전에도 실제로 도달할 수 있다.
  const annual = room * rate + 1;
  const opportunity = factors.youth ? 1 : GROWTH_CONFIG.inSeason.adultBenchBase + (1 - GROWTH_CONFIG.inSeason.adultBenchBase) * Math.min(1.1, factors.exposure);
  const health = 0.85 + 0.15 * factors.condition / 100;
  const performance = factors.rating === null ? 1 : clamp(1 + (factors.rating - 6.7) * 0.12, 0.85, 1.2);
  const points = Math.max(0, annual / 3 * FIELD_STAT_KEYS.length * opportunity * health * performance * factors.pace - experiencePoints);
  const weights = roleWeights(player);
  const shares = FIELD_STAT_KEYS.filter((key) => player.attributes[key] < 99).map((key) => ({
    key,
    // 모든 필드 능력치가 같은 평균 한도에 도달할 수 있어야 한다. 핵심 능력치는 먼저 자란다.
    share: (1 + 0.5 * (weights[key] ?? 0)) * Math.max(0.35, turnGrowthRate(GROWTH_GROUP[key], player.age)) * Math.sqrt((100 - player.attributes[key]) / 60) * focusMultiplier(player, key),
  }));
  const sum = shares.reduce((total, item) => total + item.share, 0);
  const expected = Object.fromEntries(shares.map(({ key, share }) => [key, points * share / sum]));
  return settleDevelopment(player, expected, rng, { multiplier: 1, youth: factors.youth });
}

/** 경기 경험과 자연 성장을 시즌 중 전반기·후반기를 포함한 모든 턴에 즉시 적용한다. */
export function developPlayerDuringTurn(player: PlayerState, stats: Record<CompetitionType, PlayerStatLine>, rng: Rng, seed: number, conditionStart = player.condition): { player: PlayerState; report: TurnDevelopmentReport } {
  const factors = turnDevelopmentFactors(player, stats, seed, conditionStart);
  const experience = applyMatchExperience(player, stats, rng, { multiplier: factors.experienceMultiplier, youth: factors.youth });
  const natural = player.profile.role.position === 'GK'
    ? applyTurnGrowth(experience.player, rng, { multiplier: factors.naturalMultiplier, youth: factors.youth })
    : applyFieldDevelopment(experience.player, factors, Object.values(experience.deltas).reduce((sum, value) => sum + (value ?? 0), 0), rng);
  const changes = ATTRIBUTE_KEYS.flatMap((key) => {
    const before = player.attributes[key];
    const after = natural.player.attributes[key];
    return after > before ? [{ key, before, after, experience: experience.deltas[key] ?? 0, natural: natural.deltas[key] ?? 0 }] : [];
  });
  return { player: natural.player, report: {
    ovrBefore: player.ovr, ovrAfter: natural.player.ovr,
    averageBefore: fieldAttributeAverage(player.attributes), averageAfter: fieldAttributeAverage(natural.player.attributes),
    minutes: factors.minutes, rating: factors.rating, condition: Math.round(factors.condition), changes,
    status: changes.length ? 'GROWN' : potentialFactor(player) <= 0 ? 'AT_POTENTIAL' : Object.values(GROWTH_GROUP).every((group) => turnGrowthRate(group, player.age) <= 0) && player.age > 35 ? 'AGE_LIMIT' : 'ACCUMULATING',
  } };
}

