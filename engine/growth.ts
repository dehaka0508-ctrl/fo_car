/**
 * 능력치 성장 · 노화
 *
 * 성장 경로는 세 가지다.
 *  1) 훈련 (턴 사이 1회): 큰 카테고리 1개 소폭 상승 / 세부 능력치 2~3개 상승 / 벌크업·감량 / 휴식
 *  2) 경험 (매 턴): 출전 시간에 비례해 포지션 핵심 능력치가 오른다 (어릴수록 크게)
 *  3) 자연 성장·노화 (시즌 종료): 24세까지 자연 성장, 30세 전후부터 스피드 → 체력 → 기술 순으로 하락
 * 모든 상승량은 '현재 수치가 높을수록 덜 오르는' levelFactor를 거친다.
 * 소수점 상승량은 기대값을 지키는 확률적 반올림으로 정수화한다.
 */
import { CATEGORY_ATTRIBUTES, GOALKEEPING_ATTRIBUTES } from '@/data/attributes';
import { getPlayStyle } from '@/data/playstyles';
import {
  ATTRIBUTE_KEYS,
  GK_STAT_KEYS,
  type AttributeKey,
  type Attributes,
  type CompetitionType,
  type PlayerState,
  type PlayerStatLine,
  type PlayStyle,
  type StatCategory,
  type TrainingIntensity,
  type TrainingPlan,
  type TrainingResult,
} from '@/types/game';
import { BODY_LIMITS } from './character';
import { calculateOVR } from './ovr';
import { clamp, round1, type Rng } from './rng';

export const GROWTH_CONFIG = {
  training: {
    /** 카테고리 훈련: 세부 3개 각각 */
    categoryBase: 1.15,
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

/** 현재 수치가 높을수록 덜 오른다 (57 → 1.0, 77 → 0.5, 89 → 0.2) */
export function levelFactor(value: number): number {
  return clamp((97 - value) / 40, 0.1, 1.2);
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

/** 포지션·스타일의 OVR 가중치를 0~1로 정규화 */
export function roleWeights(player: PlayerState): Partial<Record<AttributeKey, number>> {
  const weights = getPlayStyle(player.profile.role.playStyle).ovrWeights;
  const max = Math.max(...Object.values(weights).map((w) => w ?? 0));
  return Object.fromEntries(Object.entries(weights).map(([key, w]) => [key, (w ?? 0) / max]));
}

/** 같은 훈련으로 오르는 OVR이 스타일마다 비슷해지도록 하는 훈련 효율 배율 */
export function styleTrainingEfficiency(playStyle: PlayStyle): number {
  const b = GROWTH_CONFIG.styleBalance;
  const weights = Object.values(getPlayStyle(playStyle).ovrWeights)
    .map((w) => w ?? 0)
    .sort((a, c) => c - a);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const topShare = (weights[0] + (weights[1] ?? 0)) / total;
  return clamp(b.referenceTopShare / topShare, b.trainingMin, b.trainingMax);
}

/**
 * 경기 경험·자연 성장의 능력치별 배분.
 * 가중치에 비례해 나누되, 어느 스타일이든 성장 1포인트가 OVR을 같은 만큼 올리도록 정규화한다.
 */
export function growthShares(player: PlayerState): Partial<Record<AttributeKey, number>> {
  const weights = getPlayStyle(player.profile.role.playStyle).ovrWeights;
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
    levelFactor(player.attributes[key]) *
    focusMultiplier(player, key) *
    styleTrainingEfficiency(player.profile.role.playStyle)
  );
}

export interface TrainingPreview {
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
  const intensity = t.intensity[plan.intensity];
  const age = trainingAgeFactor(player.age) * styleTrainingEfficiency(player.profile.role.playStyle);
  const gains: Partial<Record<AttributeKey, number>> = {};
  let weightDelta = 0;

  const grow = (key: AttributeKey, base: number) => {
    gains[key] = round1(base * intensity.gain * age * levelFactor(player.attributes[key]) * focusMultiplier(player, key));
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
    gains[upMain] = round1(g * levelFactor(player.attributes[upMain]));
    gains[upSub] = round1(0.7 * g * levelFactor(player.attributes[upSub]));
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
      weightKg: round1(player.weightKg + preview.weightDelta),
      condition: clamp(player.condition + preview.conditionDelta, 0, 100),
      mental: clamp(player.mental + preview.mentalDelta, 0, 100),
    },
    result: {
      plan,
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
): { player: PlayerState; deltas: Partial<Record<AttributeKey, number>> } {
  const e = GROWTH_CONFIG.experience;
  const minutes =
    stats.LEAGUE.minutes +
    stats.DOMESTIC_CUP.minutes +
    stats.CONTINENTAL.minutes +
    stats.INTERNATIONAL.minutes +
    stats.RESERVE.minutes * e.reserveWeight +
    stats.FRIENDLY.minutes * e.friendlyWeight;
  const points = (minutes / 90) * experienceRate(player.age);
  if (points <= 0) return { player, deltas: {} };

  const expected: Partial<Record<AttributeKey, number>> = {};
  for (const [key, weight] of Object.entries(growthShares(player)) as Array<[AttributeKey, number]>) {
    expected[key] = points * weight * levelFactor(player.attributes[key]);
  }
  const deltas = roundDeltas(rng, expected);
  return { player: applyDeltas(player, deltas), deltas };
}

// ----------------------------------------------------------------------------
// 자연 성장 · 노화 (시즌 종료)
// ----------------------------------------------------------------------------

/** 방금 끝난 시즌의 나이 기준 자연 성장량 (핵심 능력치 기준) */
export function naturalGrowth(age: number): number {
  const table: Record<number, number> = { 16: 3.2, 17: 3.2, 18: 2.8, 19: 2.4, 20: 2, 21: 1.6, 22: 1.2, 23: 0.8, 24: 0.4 };
  return table[age] ?? 0;
}

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

/** 나이를 1살 올리고 자연 성장·노화를 적용한다. 노화 방어(agingShields)는 소모된다. */
export function applySeasonalAging(player: PlayerState, rng: Rng): AgingResult {
  const isGK = player.profile.role.position === 'GK';
  const growth = naturalGrowth(player.age);
  const newAge = player.age + 1;
  const decline = declineProfile(newAge, isGK);
  const weights = growthShares(player);
  const expected: Partial<Record<AttributeKey, number>> = {};
  const shielded: Partial<Record<AttributeKey, number>> = {};

  for (const key of ATTRIBUTE_KEYS) {
    const isGkStat = (GK_STAT_KEYS as readonly string[]).includes(key);
    if (isGkStat && !isGK) continue;
    let delta = 0;
    if (growth > 0) {
      const share = weights[key] ?? (isGkStat ? 0 : 0.2);
      delta += growth * share * levelFactor(player.attributes[key]);
    }
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
  const aged = applyDeltas({ ...player, age: newAge }, deltas);
  return { player: { ...aged, agingShields: {} }, deltas, shielded };
}
