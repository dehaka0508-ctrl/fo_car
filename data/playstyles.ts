/**
 * 포지션·플레이 스타일 테이블
 *
 * - ovrWeights: OVR = 해당 스탯들의 가중 평균. 팀 성적에 쓰이는 유일한 선수 수치다.
 * - scoringProfile / creatingProfile / involvementProfile: 개인 기록(골·도움·평점) 계산용.
 *   같은 OVR이라도 세부 능력치 분배에 따라 개인 기록이 달라지게 하는 장치다.
 * - goalShare / assistShare: 출전 중 팀 득점 1골당 이 선수가 득점(도움)할 기본 확률.
 * - staminaDrain: 포지션 기본 소모량에 곱하는 배율 (박투박·윙백은 크고, 포처는 작다).
 */
import type { AttributeKey, PlayStyle, Position, PositionGroup } from '@/types/game';

export type AttributeWeights = Partial<Record<AttributeKey, number>>;

export interface PositionMeta {
  label: string;
  group: PositionGroup;
  /** 90분 출전 시 체력 소모 기준 배율 */
  baseStaminaDrain: number;
}

export interface PlayStyleDefinition {
  id: PlayStyle;
  label: string;
  positions: readonly Position[];
  ovrWeights: AttributeWeights;
  staminaDrain: number;
  goalShare: number;
  assistShare: number;
  scoringProfile: AttributeWeights;
  creatingProfile: AttributeWeights;
  involvementProfile: AttributeWeights;
}

export const POSITION_META: Record<Position, PositionMeta> = {
  ST: { label: '스트라이커', group: 'FORWARD', baseStaminaDrain: 0.9 },
  LW: { label: '왼쪽 윙어', group: 'FORWARD', baseStaminaDrain: 1.05 },
  RW: { label: '오른쪽 윙어', group: 'FORWARD', baseStaminaDrain: 1.05 },
  AM: { label: '공격형 미드필더', group: 'MIDFIELDER', baseStaminaDrain: 0.95 },
  CM: { label: '중앙 미드필더', group: 'MIDFIELDER', baseStaminaDrain: 1.05 },
  DM: { label: '수비형 미드필더', group: 'MIDFIELDER', baseStaminaDrain: 1.0 },
  LB: { label: '왼쪽 풀백', group: 'DEFENDER', baseStaminaDrain: 1.1 },
  RB: { label: '오른쪽 풀백', group: 'DEFENDER', baseStaminaDrain: 1.1 },
  CB: { label: '센터백', group: 'DEFENDER', baseStaminaDrain: 0.85 },
  GK: { label: '골키퍼', group: 'GOALKEEPER', baseStaminaDrain: 0.4 },
};

// ---------------------------------------------------------------------------
// 개인 기록 프로필 프리셋
// ---------------------------------------------------------------------------

const SCORE_STANDARD: AttributeWeights = { finishing: 5, offTheBall: 3, shotPower: 2 };
const SCORE_AERIAL: AttributeWeights = { finishing: 4, aerial: 3, offTheBall: 2, shotPower: 1 };
const SCORE_HEADER: AttributeWeights = { aerial: 5, strength: 2, finishing: 2, offTheBall: 1 };
const SCORE_LONG_RANGE: AttributeWeights = { shotPower: 4, finishing: 4, setPieces: 2 };

const CREATE_STANDARD: AttributeWeights = { vision: 4, kickAccuracy: 4, technique: 1, setPieces: 1 };
const CREATE_WIDE: AttributeWeights = { kickAccuracy: 4, takeOn: 3, vision: 2, sprintSpeed: 1 };
const CREATE_DIRECT: AttributeWeights = { takeOn: 3, vision: 3, kickAccuracy: 3, technique: 1 };
const CREATE_DEEP: AttributeWeights = { kickAccuracy: 5, vision: 4, setPieces: 1 };

const INVOLVE_ATTACK: AttributeWeights = { takeOn: 3, technique: 3, pressResistance: 2, offTheBall: 2 };
const INVOLVE_MIDFIELD: AttributeWeights = { pressResistance: 3, vision: 3, kickAccuracy: 2, interceptions: 2 };
const INVOLVE_DEFENSIVE_MID: AttributeWeights = { interceptions: 3, tackling: 3, defPositioning: 2, kickAccuracy: 2 };
const INVOLVE_DEFENCE: AttributeWeights = { tackling: 3, interceptions: 3, defPositioning: 3, aerial: 1 };
const INVOLVE_FULLBACK: AttributeWeights = { tackling: 2, interceptions: 2, sprintSpeed: 2, kickAccuracy: 2, stamina: 2 };
const INVOLVE_GK: AttributeWeights = { reflexes: 4, gkPositioning: 3, gkRange: 2, organization: 1 };

const WINGS = ['LW', 'RW'] as const;
const FULLBACKS = ['LB', 'RB'] as const;

// ---------------------------------------------------------------------------
// 플레이 스타일 정의
// ---------------------------------------------------------------------------

export const PLAYSTYLE_DEFINITIONS: Record<PlayStyle, PlayStyleDefinition> = {
  // ----- ST -----
  TARGET_MAN: {
    id: 'TARGET_MAN',
    label: '타겟맨',
    positions: ['ST'],
    ovrWeights: { finishing: 5, aerial: 5, strength: 5, shotPower: 3, offTheBall: 3, technique: 2, pressResistance: 2, kickAccuracy: 1 },
    staminaDrain: 0.95,
    goalShare: 0.22,
    assistShare: 0.12,
    scoringProfile: SCORE_AERIAL,
    creatingProfile: { strength: 3, kickAccuracy: 3, vision: 2, pressResistance: 2 },
    involvementProfile: { strength: 3, aerial: 3, pressResistance: 2, technique: 2 },
  },
  ADVANCED_FORWARD: {
    id: 'ADVANCED_FORWARD',
    label: '전진형 포워드',
    positions: ['ST'],
    ovrWeights: { finishing: 5, offTheBall: 4, sprintSpeed: 4, acceleration: 4, shotPower: 3, takeOn: 2, agility: 2, stamina: 1 },
    staminaDrain: 1.05,
    goalShare: 0.235,
    assistShare: 0.1,
    scoringProfile: SCORE_STANDARD,
    creatingProfile: CREATE_DIRECT,
    involvementProfile: INVOLVE_ATTACK,
  },
  POACHER: {
    id: 'POACHER',
    label: '포처',
    positions: ['ST'],
    ovrWeights: { finishing: 6, offTheBall: 6, acceleration: 3, shotPower: 2, agility: 2, technique: 1 },
    staminaDrain: 0.9,
    goalShare: 0.25,
    assistShare: 0.08,
    scoringProfile: { finishing: 6, offTheBall: 4 },
    creatingProfile: CREATE_STANDARD,
    involvementProfile: { offTheBall: 4, finishing: 3, acceleration: 3 },
  },
  FALSE_NINE: {
    id: 'FALSE_NINE',
    label: '폴스 나인',
    positions: ['ST'],
    ovrWeights: { finishing: 4, vision: 4, kickAccuracy: 4, technique: 4, pressResistance: 3, offTheBall: 2, takeOn: 2, agility: 1 },
    staminaDrain: 1.0,
    goalShare: 0.16,
    assistShare: 0.15,
    scoringProfile: SCORE_STANDARD,
    creatingProfile: CREATE_STANDARD,
    involvementProfile: { technique: 3, vision: 3, pressResistance: 3, takeOn: 1 },
  },

  // ----- LW / RW -----
  CLASSIC_WINGER: {
    id: 'CLASSIC_WINGER',
    label: '클래식 윙어',
    positions: WINGS,
    ovrWeights: { sprintSpeed: 5, acceleration: 5, takeOn: 5, kickAccuracy: 4, technique: 3, agility: 2, vision: 1, stamina: 1 },
    staminaDrain: 1.05,
    goalShare: 0.1,
    assistShare: 0.15,
    scoringProfile: SCORE_STANDARD,
    creatingProfile: CREATE_WIDE,
    involvementProfile: { takeOn: 4, sprintSpeed: 2, technique: 2, kickAccuracy: 2 },
  },
  INSIDE_FORWARD: {
    id: 'INSIDE_FORWARD',
    label: '인사이드 포워드',
    positions: WINGS,
    ovrWeights: { finishing: 5, offTheBall: 4, takeOn: 4, acceleration: 4, technique: 3, shotPower: 3, sprintSpeed: 2, agility: 2 },
    staminaDrain: 1.0,
    goalShare: 0.19,
    assistShare: 0.12,
    scoringProfile: SCORE_STANDARD,
    creatingProfile: CREATE_DIRECT,
    involvementProfile: INVOLVE_ATTACK,
  },
  INVERTED_WINGER: {
    id: 'INVERTED_WINGER',
    label: '인버티드 윙어',
    positions: WINGS,
    ovrWeights: { technique: 5, takeOn: 4, vision: 4, kickAccuracy: 4, agility: 3, acceleration: 3, finishing: 2, pressResistance: 2 },
    staminaDrain: 1.0,
    goalShare: 0.13,
    assistShare: 0.14,
    scoringProfile: SCORE_LONG_RANGE,
    creatingProfile: CREATE_DIRECT,
    involvementProfile: INVOLVE_ATTACK,
  },

  // ----- AM -----
  SHADOW_STRIKER: {
    id: 'SHADOW_STRIKER',
    label: '쉐도우 스트라이커',
    positions: ['AM'],
    ovrWeights: { finishing: 5, offTheBall: 5, acceleration: 3, technique: 3, shotPower: 3, takeOn: 2, agility: 2 },
    staminaDrain: 1.05,
    goalShare: 0.17,
    assistShare: 0.12,
    scoringProfile: SCORE_STANDARD,
    creatingProfile: CREATE_DIRECT,
    involvementProfile: INVOLVE_ATTACK,
  },
  PLAYMAKER: {
    id: 'PLAYMAKER',
    label: '플레이메이커',
    positions: ['AM'],
    ovrWeights: { vision: 6, kickAccuracy: 5, technique: 4, pressResistance: 3, setPieces: 2, takeOn: 2, agility: 1 },
    staminaDrain: 0.95,
    goalShare: 0.09,
    assistShare: 0.16,
    scoringProfile: SCORE_LONG_RANGE,
    creatingProfile: CREATE_STANDARD,
    involvementProfile: INVOLVE_MIDFIELD,
  },
  RAUMDEUTER: {
    id: 'RAUMDEUTER',
    label: '라움도이터',
    positions: ['AM'],
    ovrWeights: { offTheBall: 6, finishing: 5, acceleration: 3, vision: 2, stamina: 2, shotPower: 2, agility: 1 },
    staminaDrain: 0.95,
    goalShare: 0.16,
    assistShare: 0.11,
    scoringProfile: { offTheBall: 5, finishing: 5 },
    creatingProfile: CREATE_STANDARD,
    involvementProfile: { offTheBall: 4, vision: 2, finishing: 2, stamina: 2 },
  },

  // ----- CM -----
  MEZZALA: {
    id: 'MEZZALA',
    label: '메짤라',
    positions: ['CM'],
    ovrWeights: { takeOn: 4, technique: 4, vision: 3, kickAccuracy: 3, offTheBall: 3, pressResistance: 3, finishing: 2, acceleration: 2, stamina: 2 },
    staminaDrain: 1.05,
    goalShare: 0.08,
    assistShare: 0.095,
    scoringProfile: SCORE_STANDARD,
    creatingProfile: CREATE_DIRECT,
    involvementProfile: { takeOn: 3, technique: 3, pressResistance: 2, vision: 2 },
  },
  DEEP_LYING_PLAYMAKER: {
    id: 'DEEP_LYING_PLAYMAKER',
    label: '딥 라잉 플레이메이커',
    positions: ['CM'],
    ovrWeights: { vision: 6, kickAccuracy: 6, pressResistance: 4, technique: 3, setPieces: 2, interceptions: 2, defPositioning: 1 },
    staminaDrain: 0.95,
    goalShare: 0.035,
    assistShare: 0.075,
    scoringProfile: SCORE_LONG_RANGE,
    creatingProfile: CREATE_DEEP,
    involvementProfile: INVOLVE_MIDFIELD,
  },
  BOX_TO_BOX: {
    id: 'BOX_TO_BOX',
    label: '박스 투 박스 미드필더',
    positions: ['CM'],
    ovrWeights: { stamina: 5, kickAccuracy: 3, tackling: 3, interceptions: 3, strength: 3, offTheBall: 2, pressResistance: 2, vision: 2, finishing: 1, shotPower: 1, sprintSpeed: 1 },
    staminaDrain: 1.2,
    goalShare: 0.08,
    assistShare: 0.065,
    scoringProfile: SCORE_LONG_RANGE,
    creatingProfile: CREATE_STANDARD,
    involvementProfile: { stamina: 3, tackling: 2, interceptions: 2, pressResistance: 2, kickAccuracy: 1 },
  },

  // ----- DM -----
  HOLDING_MIDFIELDER: {
    id: 'HOLDING_MIDFIELDER',
    label: '홀딩 미드필더',
    positions: ['DM'],
    ovrWeights: { defPositioning: 5, interceptions: 5, tackling: 4, kickAccuracy: 3, strength: 3, pressResistance: 2, stamina: 2, vision: 1, aerial: 1 },
    staminaDrain: 0.95,
    goalShare: 0.02,
    assistShare: 0.035,
    scoringProfile: SCORE_LONG_RANGE,
    creatingProfile: CREATE_DEEP,
    involvementProfile: INVOLVE_DEFENSIVE_MID,
  },
  BALL_WINNING_MIDFIELDER: {
    id: 'BALL_WINNING_MIDFIELDER',
    label: '볼 위닝 미드필더',
    positions: ['DM'],
    ovrWeights: { tackling: 6, interceptions: 4, strength: 4, stamina: 4, agility: 2, defPositioning: 2, acceleration: 1, kickAccuracy: 1 },
    staminaDrain: 1.15,
    goalShare: 0.022,
    assistShare: 0.03,
    scoringProfile: SCORE_LONG_RANGE,
    creatingProfile: CREATE_STANDARD,
    involvementProfile: { tackling: 4, interceptions: 3, strength: 2, stamina: 1 },
  },
  HALF_BACK: {
    id: 'HALF_BACK',
    label: '하프백',
    positions: ['DM'],
    ovrWeights: { defPositioning: 5, interceptions: 4, aerial: 3, kickAccuracy: 3, tackling: 3, strength: 3, pressResistance: 2, vision: 1 },
    staminaDrain: 0.9,
    goalShare: 0.018,
    assistShare: 0.035,
    scoringProfile: SCORE_HEADER,
    creatingProfile: CREATE_DEEP,
    involvementProfile: INVOLVE_DEFENSIVE_MID,
  },

  // ----- LB / RB -----
  WING_BACK: {
    id: 'WING_BACK',
    label: '윙백',
    positions: FULLBACKS,
    ovrWeights: { stamina: 5, sprintSpeed: 4, acceleration: 4, kickAccuracy: 4, takeOn: 3, tackling: 2, interceptions: 2, defPositioning: 1, technique: 1 },
    staminaDrain: 1.15,
    goalShare: 0.025,
    assistShare: 0.08,
    scoringProfile: SCORE_STANDARD,
    creatingProfile: CREATE_WIDE,
    involvementProfile: INVOLVE_FULLBACK,
  },
  FULL_BACK: {
    id: 'FULL_BACK',
    label: '풀백',
    positions: FULLBACKS,
    ovrWeights: { tackling: 4, defPositioning: 4, interceptions: 3, sprintSpeed: 3, stamina: 3, kickAccuracy: 2, acceleration: 2, strength: 1, aerial: 1 },
    staminaDrain: 1.0,
    goalShare: 0.018,
    assistShare: 0.045,
    scoringProfile: SCORE_STANDARD,
    creatingProfile: CREATE_WIDE,
    involvementProfile: INVOLVE_FULLBACK,
  },
  INVERTED_WING_BACK: {
    id: 'INVERTED_WING_BACK',
    label: '인버티드 윙백',
    positions: FULLBACKS,
    ovrWeights: { kickAccuracy: 4, vision: 4, pressResistance: 4, technique: 3, interceptions: 3, tackling: 2, defPositioning: 2, stamina: 2, agility: 1 },
    staminaDrain: 1.0,
    goalShare: 0.022,
    assistShare: 0.06,
    scoringProfile: SCORE_LONG_RANGE,
    creatingProfile: CREATE_STANDARD,
    involvementProfile: { pressResistance: 3, kickAccuracy: 2, vision: 2, interceptions: 2, tackling: 1 },
  },

  // ----- CB -----
  STOPPER: {
    id: 'STOPPER',
    label: '파이터형 센터백 (스토퍼)',
    positions: ['CB'],
    ovrWeights: { tackling: 5, strength: 5, aerial: 4, interceptions: 3, defPositioning: 3, acceleration: 1, stamina: 1 },
    staminaDrain: 0.95,
    goalShare: 0.017,
    assistShare: 0.015,
    scoringProfile: SCORE_HEADER,
    creatingProfile: CREATE_DEEP,
    involvementProfile: { tackling: 4, strength: 3, aerial: 2, interceptions: 1 },
  },
  COVER: {
    id: 'COVER',
    label: '커맨더형 센터백 (커버)',
    positions: ['CB'],
    ovrWeights: { defPositioning: 6, interceptions: 5, tackling: 3, sprintSpeed: 3, aerial: 2, acceleration: 1, strength: 1 },
    staminaDrain: 0.85,
    goalShare: 0.012,
    assistShare: 0.012,
    scoringProfile: SCORE_HEADER,
    creatingProfile: CREATE_DEEP,
    involvementProfile: INVOLVE_DEFENCE,
  },
  BALL_PLAYING_DEFENDER: {
    id: 'BALL_PLAYING_DEFENDER',
    label: '볼 플레잉 디펜더',
    positions: ['CB'],
    ovrWeights: { defPositioning: 4, kickAccuracy: 4, vision: 3, pressResistance: 3, tackling: 3, interceptions: 3, aerial: 2, strength: 2, technique: 1 },
    staminaDrain: 0.85,
    goalShare: 0.016,
    assistShare: 0.03,
    scoringProfile: SCORE_HEADER,
    creatingProfile: CREATE_DEEP,
    involvementProfile: { defPositioning: 2, interceptions: 2, kickAccuracy: 2, pressResistance: 2, tackling: 2 },
  },
  WIDE_CENTER_BACK: {
    id: 'WIDE_CENTER_BACK',
    label: '와이드 센터백',
    positions: ['CB'],
    ovrWeights: { tackling: 4, defPositioning: 3, interceptions: 3, sprintSpeed: 3, acceleration: 2, takeOn: 2, kickAccuracy: 2, strength: 2, stamina: 2, aerial: 1 },
    staminaDrain: 1.0,
    goalShare: 0.014,
    assistShare: 0.025,
    scoringProfile: SCORE_HEADER,
    creatingProfile: CREATE_WIDE,
    involvementProfile: INVOLVE_DEFENCE,
  },

  // ----- GK -----
  CLASSIC_GOALKEEPER: {
    id: 'CLASSIC_GOALKEEPER',
    label: '클래식 골키퍼',
    positions: ['GK'],
    ovrWeights: { reflexes: 6, gkPositioning: 6, organization: 4, gkRange: 2, goalKick: 1, distribution: 1 },
    staminaDrain: 1.0,
    goalShare: 0,
    assistShare: 0.004,
    scoringProfile: {},
    creatingProfile: { goalKick: 1, distribution: 1 },
    involvementProfile: INVOLVE_GK,
  },
  SWEEPER_KEEPER: {
    id: 'SWEEPER_KEEPER',
    label: '스위퍼 키퍼',
    positions: ['GK'],
    ovrWeights: { gkRange: 6, reflexes: 5, distribution: 4, gkPositioning: 4, goalKick: 2, organization: 2 },
    staminaDrain: 1.1,
    goalShare: 0,
    assistShare: 0.01,
    scoringProfile: {},
    creatingProfile: { distribution: 2, goalKick: 1 },
    involvementProfile: { reflexes: 3, gkRange: 3, gkPositioning: 2, distribution: 2 },
  },
};

export function getPlayStyle(id: PlayStyle): PlayStyleDefinition {
  return PLAYSTYLE_DEFINITIONS[id];
}

export function getPositionGroup(position: Position): PositionGroup {
  return POSITION_META[position].group;
}

/** 생성 이후에는 초기 세부 역할과 무관한 포지션 공통 프로필을 사용한다. */
const POSITION_PROFILES = new Map<Position, PlayStyleDefinition>();
export function getPositionProfile(position: Position): PlayStyleDefinition {
  const cached = POSITION_PROFILES.get(position);
  if (cached) return cached;
  const styles = Object.values(PLAYSTYLE_DEFINITIONS).filter((style) => style.positions.includes(position));
  const average = (key: 'staminaDrain' | 'goalShare' | 'assistShare') => styles.reduce((sum, style) => sum + style[key], 0) / styles.length;
  const weights = (key: 'ovrWeights' | 'scoringProfile' | 'creatingProfile' | 'involvementProfile'): AttributeWeights => {
    const result: AttributeWeights = {};
    for (const style of styles) {
      const total = Object.values(style[key]).reduce((sum, value) => sum + (value ?? 0), 0);
      for (const [attribute, value] of Object.entries(style[key]) as Array<[AttributeKey, number]>) {
        result[attribute] = (result[attribute] ?? 0) + value / (total || 1) / styles.length;
      }
    }
    return result;
  };
  const profile = { ...styles[0], label: POSITION_META[position].label, positions: [position],
    staminaDrain: average('staminaDrain'), goalShare: average('goalShare'), assistShare: average('assistShare'),
    ovrWeights: weights('ovrWeights'), scoringProfile: weights('scoringProfile'),
    creatingProfile: weights('creatingProfile'), involvementProfile: weights('involvementProfile') };
  POSITION_PROFILES.set(position, profile);
  return profile;
}
