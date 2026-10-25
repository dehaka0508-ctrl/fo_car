/**
 * 캐릭터 생성: 초기 능력치 산출 · 시작 팀 입지 배정
 *
 * 16세 시작 능력치 = 포지션·플레이 스타일 가중치 기반 템플릿 + 키·체격 보정 + 소폭 랜덤.
 * 시작 입지 = 내 OVR과 시작 팀 실력의 차이로 1군 / B팀 / 유스 결정.
 */
import { getPlayStyle } from '@/data/playstyles';
import {
  ATTRIBUTE_KEYS,
  COMPETITION_TYPES,
  GK_STAT_KEYS,
  type Appearance,
  type AttributeKey,
  type Attributes,
  type CompetitionType,
  type GKStatKey,
  type ID,
  type NationCode,
  type PlayerRole,
  type PlayerState,
  type PlayerStatLine,
  type PlayingTime,
  type SquadStatus,
} from '@/types/game';
import { calculateOVR } from './ovr';
import { clamp, rngFor } from './rng';
import type { SimulationWorld } from './world';

export const START_AGE = 16;

export const BODY_LIMITS = {
  heightCm: { min: 155, max: 205 },
  weightKg: { min: 50, max: 105 },
} as const;

/** 초기 능력치 템플릿 상수 */
const TEMPLATE = {
  /** 역할과 무관한 필드 스탯 기본값 */
  fieldBase: 34,
  /** 필드 선수의 GK 스탯 기본값 */
  fieldGkBase: 12,
  /** GK의 필드 스탯 기본값 */
  gkFieldBase: 26,
  /** GK의 GK 스탯 기본값 */
  gkBase: 34,
  /** OVR 가중치가 가장 큰 스탯에 더해지는 보너스 */
  roleBonus: 24,
  noiseSd: 2.5,
  min: 15,
  max: 72,
} as const;

const isGkStat = (key: AttributeKey): key is GKStatKey =>
  (GK_STAT_KEYS as readonly string[]).includes(key);

/**
 * 키·체격(BMI)에 따른 능력치 보정.
 * 벌크업·감량 훈련에서도 같은 방향성을 쓴다.
 */
export function bodyModifiers(
  heightCm: number,
  weightKg: number,
): Partial<Record<AttributeKey, number>> {
  const h = (heightCm - 180) / 10; // +1 = 10cm 큼
  const bmi = weightKg / (heightCm / 100) ** 2;
  const b = bmi - 22.5; // +1 = 표준 체격보다 무거움
  const heavyPenalty = Math.max(0, b - 1.5);
  const lightPenalty = Math.max(0, -b - 2);

  return {
    aerial: 6 * h + 1 * b,
    strength: 2 * h + 3 * b - 2 * lightPenalty,
    agility: -3 * h - 2 * b,
    acceleration: -2 * h - 2 * b,
    sprintSpeed: -0.5 * h - 1 * b,
    technique: -1 * h,
    takeOn: -1.5 * h - 0.5 * b,
    stamina: -1.5 * heavyPenalty - 1.5 * lightPenalty,
    gkRange: 4 * h,
    gkPositioning: 1 * h,
    reflexes: -1.5 * h - 1 * heavyPenalty,
  };
}

export function generateInitialAttributes(
  role: PlayerRole,
  heightCm: number,
  weightKg: number,
  seed: number,
): Attributes {
  const rng = rngFor(seed, 'initial-attributes');
  const weights = getPlayStyle(role.playStyle).ovrWeights;
  const maxWeight = Math.max(...Object.values(weights).map((w) => w ?? 0));
  const isGK = role.position === 'GK';
  const body = bodyModifiers(
    clamp(heightCm, BODY_LIMITS.heightCm.min, BODY_LIMITS.heightCm.max),
    clamp(weightKg, BODY_LIMITS.weightKg.min, BODY_LIMITS.weightKg.max),
  );

  const attributes = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) {
    const gkStat = isGkStat(key);
    const base = gkStat
      ? isGK
        ? TEMPLATE.gkBase
        : TEMPLATE.fieldGkBase
      : isGK
        ? TEMPLATE.gkFieldBase
        : TEMPLATE.fieldBase;
    const roleWeight = (weights[key] ?? 0) / maxWeight;
    const value =
      base + roleWeight * TEMPLATE.roleBonus + (body[key] ?? 0) + rng.normal(0, TEMPLATE.noiseSd);
    const [min, max] = gkStat && !isGK ? [5, 30] : [TEMPLATE.min, TEMPLATE.max];
    attributes[key] = Math.round(clamp(value, min, max));
  }
  return attributes;
}

/**
 * 시작 팀 수준과 내 OVR을 비교해 입지를 정한다.
 * diff = OVR - 팀 실력
 *   diff ≥ -3  → 1군 (핵심 ~ 후보)
 *   diff ≥ -12 → B팀(리저브)
 *   그 외      → 유소년팀(U19)
 */
export function determineInitialSquadStatus(
  ovr: number,
  clubPower: number,
  isGK: boolean,
): SquadStatus {
  const diff = ovr - clubPower;

  if (diff >= -3) {
    let playingTime: PlayingTime;
    if (isGK) playingTime = diff >= 0 ? 'GK_FIRST' : 'GK_SECOND';
    else if (diff >= 6) playingTime = 'KEY';
    else if (diff >= 2) playingTime = 'STARTER';
    else if (diff >= -1) playingTime = 'ROTATION';
    else playingTime = 'BACKUP';
    return { level: 'FIRST_TEAM', playingTime, standing: clamp(Math.round(55 + diff * 3), 20, 90) };
  }

  const playingTime: PlayingTime = isGK ? 'GK_THIRD' : 'RESERVE';
  if (diff >= -12) {
    return { level: 'RESERVE', playingTime, standing: clamp(Math.round(40 + (diff + 12) * 2), 15, 60) };
  }
  return { level: 'YOUTH', playingTime, standing: clamp(Math.round(30 + (diff + 25)), 5, 40) };
}

export function emptyStatLine(): PlayerStatLine {
  return { appearances: 0, starts: 0, minutes: 0, goals: 0, assists: 0, cleanSheets: 0, saves: 0, ratingSum: 0 };
}

export function emptyStatsByCompetition(): Record<CompetitionType, PlayerStatLine> {
  return Object.fromEntries(COMPETITION_TYPES.map((type) => [type, emptyStatLine()])) as Record<
    CompetitionType,
    PlayerStatLine
  >;
}

export interface CharacterInput {
  name: string;
  nationality: NationCode;
  role: PlayerRole;
  heightCm: number;
  weightKg: number;
  appearance: Appearance;
  clubId: ID;
}

export function createPlayer(
  input: CharacterInput,
  world: SimulationWorld,
  options: { seed: number; startSeason: number },
): PlayerState {
  const heightCm = clamp(input.heightCm, BODY_LIMITS.heightCm.min, BODY_LIMITS.heightCm.max);
  const weightKg = clamp(input.weightKg, BODY_LIMITS.weightKg.min, BODY_LIMITS.weightKg.max);
  const attributes = generateInitialAttributes(input.role, heightCm, weightKg, options.seed);
  const ovr = calculateOVR(attributes, input.role);
  const clubState = world.clubStates[input.clubId];
  const isGK = input.role.position === 'GK';
  const squad = determineInitialSquadStatus(ovr, clubState.power, isGK);
  const wage =
    squad.level === 'FIRST_TEAM'
      ? Math.round(40_000 + clubState.finance ** 2 * 25)
      : Math.round(12_000 + clubState.finance * 400);

  return {
    profile: {
      id: `player-${options.seed}`,
      name: input.name,
      nationality: input.nationality,
      birthYear: options.startSeason - START_AGE,
      heightCm,
      appearance: input.appearance,
      role: input.role,
      startSeason: options.startSeason,
    },
    age: START_AGE,
    weightKg,
    attributes,
    ovr,
    reputation: squad.level === 'FIRST_TEAM' ? 10 : 5,
    condition: 100,
    mental: 60,
    money: 0,
    parentContract: null,
    contract: {
      clubId: input.clubId,
      type: 'PERMANENT',
      startSeason: options.startSeason,
      endSeason: options.startSeason + 2,
      wage,
      playingTime: squad.playingTime,
      transferFee: 0,
    },
    squad,
    nationalTeam: { caps: 0, goals: 0, assists: 0, lastCallUp: null },
    growthFocus: null,
    inventory: [],
    agingShields: {},
    career: emptyStatsByCompetition(),
    clubHistory: [{ clubId: input.clubId, type: 'PERMANENT', fromSeason: options.startSeason, toSeason: null }],
    retired: false,
  };
}
