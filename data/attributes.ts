import type {
  AttributeGroup,
  AttributeKey,
  FieldStatKey,
  GKStatKey,
  StatCategory,
} from '@/types/game';

export interface AttributeMeta {
  label: string;
  group: AttributeGroup;
}

export const ATTRIBUTE_META: Record<AttributeKey, AttributeMeta> = {
  finishing: { label: '결정력', group: 'SHOOTING' },
  shotPower: { label: '슛 파워', group: 'SHOOTING' },
  offTheBall: { label: '오프더볼', group: 'SHOOTING' },
  kickAccuracy: { label: '킥 정확도', group: 'PASSING' },
  vision: { label: '시야', group: 'PASSING' },
  setPieces: { label: '세트피스', group: 'PASSING' },
  technique: { label: '개인기', group: 'DRIBBLING' },
  takeOn: { label: '돌파', group: 'DRIBBLING' },
  pressResistance: { label: '탈압박', group: 'DRIBBLING' },
  sprintSpeed: { label: '속력', group: 'SPEED' },
  acceleration: { label: '가속력', group: 'SPEED' },
  agility: { label: '민첩성', group: 'SPEED' },
  tackling: { label: '태클', group: 'DEFENDING' },
  interceptions: { label: '가로채기', group: 'DEFENDING' },
  defPositioning: { label: '위치 선정', group: 'DEFENDING' },
  strength: { label: '몸싸움', group: 'PHYSICAL' },
  aerial: { label: '제공권', group: 'PHYSICAL' },
  stamina: { label: '지구력', group: 'PHYSICAL' },
  reflexes: { label: '반사 신경', group: 'GOALKEEPING' },
  goalKick: { label: '골킥', group: 'GOALKEEPING' },
  gkPositioning: { label: '위치 선정', group: 'GOALKEEPING' },
  gkRange: { label: '수비 범위', group: 'GOALKEEPING' },
  organization: { label: '수비 조율', group: 'GOALKEEPING' },
  distribution: { label: '볼 배급', group: 'GOALKEEPING' },
};

export const ATTRIBUTE_GROUP_LABELS: Record<AttributeGroup, string> = {
  SHOOTING: '슈팅',
  PASSING: '패스',
  DRIBBLING: '드리블',
  SPEED: '스피드',
  DEFENDING: '수비',
  PHYSICAL: '피지컬',
  GOALKEEPING: '골키핑',
};

/** 6대 영역별 세부 스탯 (카테고리 훈련 대상) */
export const CATEGORY_ATTRIBUTES: Record<StatCategory, readonly FieldStatKey[]> = {
  SHOOTING: ['finishing', 'shotPower', 'offTheBall'],
  PASSING: ['kickAccuracy', 'vision', 'setPieces'],
  DRIBBLING: ['technique', 'takeOn', 'pressResistance'],
  SPEED: ['sprintSpeed', 'acceleration', 'agility'],
  DEFENDING: ['tackling', 'interceptions', 'defPositioning'],
  PHYSICAL: ['strength', 'aerial', 'stamina'],
};

export const GOALKEEPING_ATTRIBUTES: readonly GKStatKey[] = [
  'reflexes',
  'goalKick',
  'gkPositioning',
  'gkRange',
  'organization',
  'distribution',
];

export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 99;
