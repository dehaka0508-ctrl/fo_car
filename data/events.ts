/**
 * 턴 사이 사건 DB
 *
 * phases: 이 턴이 끝난 직후의 턴 사이에만 발생한다.
 * 본문 치환: {name} 주인공, {club} 소속 구단, {partner} 영혼의 파트너, {rival} 숙명의 라이벌
 * 프리시즌 휴가 계획(vacation-plan)은 후반기 종료 후 반드시 발생하며, '휴식'을 고르고
 * 그해 여름 대표팀 차출이 없으면 다음 시즌을 체력 100으로 시작한다 (engine/interTurn.ts).
 */
import { EXPANDED_EVENTS } from './eventExpansion';
import type { GameEventDefinition, TurnPhase } from '@/types/game';

const ALL: TurnPhase[] = ['FIRST_HALF', 'SECOND_HALF', 'PRESEASON'];
const SEASON: TurnPhase[] = ['FIRST_HALF', 'PRESEASON'];

const ORIGINAL_EVENTS: GameEventDefinition[] = [
  {
    id: 'position-change-offer', category: 'TEAM', title: '새 포지션 제의',
    body: '코치가 {name}의 능력치를 분석했습니다. 현재 {currentPosition}보다 {targetPositionLabel}에서 더 좋은 활약이 기대됩니다. 포지션을 바꿔 볼까요?',
    phases: ALL, weight: 0,
    choices: [
      { id: 'accept', label: '새 포지션에 도전한다', description: '능력치는 그대로 유지하고, 제안받은 포지션으로 변경합니다.', effects: [] },
      { id: 'decline', label: '현재 포지션을 유지한다', effects: [] },
    ],
  },
  // ----- 프리시즌 휴가 계획 (필수) -----
  {
    id: 'vacation-plan',
    category: 'VACATION',
    title: '프리시즌 휴가 계획',
    body: '시즌이 끝났다. {name}의 여름 휴가를 어떻게 보낼까?',
    phases: ['SECOND_HALF'],
    guaranteed: true,
    weight: 0,
    choices: [
      {
        id: 'rest',
        label: '완전한 휴식',
        description: '대표팀 차출이 없다면 다음 시즌을 체력 100으로 시작한다.',
        effects: [{ kind: 'FLAG', flag: 'PRESEASON_REST', value: true }, { kind: 'MENTAL', delta: 4 }],
      },
      {
        id: 'personal-training',
        label: '개인 훈련 캠프',
        description: '능력치를 올리지만 휴식 효과는 없다.',
        cost: 30_000,
        effects: [
          { kind: 'FLAG', flag: 'PRESEASON_REST', value: false },
          { kind: 'GROWTH_FOCUS', category: 'PHYSICAL', multiplier: 1.3, turns: 2 },
          { kind: 'ATTRIBUTE', key: 'stamina', delta: 1 },
          { kind: 'CONDITION', delta: -10 },
        ],
      },
      {
        id: 'tour',
        label: '팬 투어·화보 촬영',
        description: '명성과 수입을 얻지만 쉬지 못한다.',
        effects: [
          { kind: 'FLAG', flag: 'PRESEASON_REST', value: false },
          { kind: 'REPUTATION', delta: 2 },
          { kind: 'MONEY', delta: 20_000, perReputation: 2_000 },
          { kind: 'CONDITION', delta: -5 },
        ],
      },
    ],
  },

  // ----- 가정사 -----
  {
    id: 'family-hospital',
    category: 'FAMILY',
    title: '가족의 입원',
    body: '{name}의 어머니가 갑자기 병원에 입원하셨다는 연락이 왔다.',
    phases: ALL,
    weight: 0.4,
    cooldownTurns: 12,
    maxOccurrences: 2,
    choices: [
      { id: 'visit', label: '경기 후 바로 병원으로', effects: [{ kind: 'MENTAL', delta: 4 }, { kind: 'CONDITION', delta: -6 }] },
      { id: 'leave', label: '구단에 휴가를 요청한다', effects: [{ kind: 'MENTAL', delta: 7 }, { kind: 'STANDING', delta: -4 }] },
      { id: 'focus', label: '경기에 집중한다', effects: [{ kind: 'MENTAL', delta: -5 }, { kind: 'STANDING', delta: 2 }] },
    ],
  },
  {
    id: 'family-sibling',
    category: 'FAMILY',
    title: '동생의 축구 입문',
    body: '동생이 형처럼 축구 선수가 되고 싶다고 한다.',
    phases: ALL,
    weight: 2,
    maxAge: 28,
    choices: [
      { id: 'coach', label: '직접 가르쳐 준다', effects: [{ kind: 'ATTRIBUTE', key: 'technique', delta: 1 }, { kind: 'CONDITION', delta: -5 }, { kind: 'MENTAL', delta: 3 }] },
      { id: 'academy', label: '유소년 아카데미 비용을 대 준다', cost: 20_000, effects: [{ kind: 'MONEY', delta: -20_000 }, { kind: 'MENTAL', delta: 5 }] },
    ],
  },
  {
    id: 'family-relationship',
    category: 'FAMILY',
    title: '연인과의 관계',
    body: '오래 만난 연인과의 관계가 언론에 알려질 것 같다.',
    phases: ALL,
    weight: 2,
    minAge: 20,
    choices: [
      { id: 'public', label: '당당하게 공개한다', effects: [{ kind: 'MENTAL', delta: 5 }, { kind: 'REPUTATION', delta: 1 }] },
      { id: 'private', label: '사생활은 지킨다', effects: [{ kind: 'MENTAL', delta: 2 }] },
    ],
  },
  {
    id: 'family-hometown',
    category: 'FAMILY',
    title: '고향 방문',
    body: '짧은 휴식일, 고향에 다녀올 시간이 생겼다.',
    phases: ['FIRST_HALF', 'SECOND_HALF'],
    weight: 3,
    choices: [
      { id: 'academy', label: '고향 유소년팀을 찾아간다', effects: [{ kind: 'REPUTATION', delta: 1 }, { kind: 'MENTAL', delta: 3 }, { kind: 'CONDITION', delta: -3 }] },
      { id: 'rest', label: '집에서 푹 쉰다', effects: [{ kind: 'CONDITION', delta: 10 }, { kind: 'MENTAL', delta: 2 }] },
    ],
  },
  {
    id: 'family-wedding',
    category: 'FAMILY',
    title: '결혼 준비',
    body: '{name}이(가) 결혼을 앞두고 있다. 시즌 중에 식을 올릴까?',
    phases: ['SECOND_HALF'],
    weight: 1,
    minAge: 24,
    choices: [
      { id: 'now', label: '휴가 기간에 식을 올린다', cost: 100_000, effects: [{ kind: 'MONEY', delta: -100_000 }, { kind: 'MENTAL', delta: 10 }] },
      { id: 'later', label: '은퇴 후로 미룬다', effects: [{ kind: 'MENTAL', delta: -3 }, { kind: 'STANDING', delta: 1 }] },
    ],
  },

  // ----- 언론 -----
  {
    id: 'media-transfer-rumor',
    category: 'MEDIA',
    title: '이적설 인터뷰',
    body: '기자가 묻는다. "{club}을(를) 떠난다는 소문이 사실입니까?"',
    phases: ALL,
    weight: 3,
    requires: { hasClub: true, minReputation: 15 },
    choices: [
      { id: 'loyal', label: '"이 팀에 남고 싶습니다"', effects: [{ kind: 'STANDING', delta: 4 }, { kind: 'MENTAL', delta: 1 }] },
      { id: 'ambition', label: '"더 큰 무대를 꿈꿉니다"', effects: [{ kind: 'REPUTATION', delta: 2 }, { kind: 'STANDING', delta: -5 }] },
      { id: 'no-comment', label: '노코멘트', effects: [{ kind: 'MENTAL', delta: 1 }] },
    ],
  },
  {
    id: 'media-criticism',
    category: 'MEDIA',
    title: '비판 기사',
    body: '"{name}, 기대 이하의 활약" — 한 매체가 혹평을 쏟아냈다.',
    phases: ALL,
    weight: 2,
    choices: [
      {
        id: 'rebut',
        label: '공개적으로 반박한다',
        successChance: 0.5,
        effects: [{ kind: 'MENTAL', delta: 5 }, { kind: 'REPUTATION', delta: 1 }],
        failureEffects: [{ kind: 'STANDING', delta: -5 }, { kind: 'MENTAL', delta: -3 }],
      },
      { id: 'ignore', label: '실력으로 보여 준다', effects: [{ kind: 'MENTAL', delta: -2 }, { kind: 'CATEGORY', category: 'SHOOTING', delta: 1 }] },
    ],
  },
  {
    id: 'media-sns',
    category: 'MEDIA',
    title: 'SNS 논란',
    body: '{name}의 오래된 SNS 게시물이 논란이 되고 있다.',
    phases: ALL,
    weight: 2,
    minAge: 18,
    choices: [
      { id: 'apologize', label: '즉시 사과문을 올린다', effects: [{ kind: 'REPUTATION', delta: -1 }, { kind: 'MENTAL', delta: -1 }] },
      {
        id: 'live',
        label: '라이브 방송으로 해명한다',
        successChance: 0.6,
        effects: [{ kind: 'REPUTATION', delta: 2 }],
        failureEffects: [{ kind: 'REPUTATION', delta: -3 }, { kind: 'MENTAL', delta: -3 }],
      },
    ],
  },
  {
    id: 'media-documentary',
    category: 'MEDIA',
    title: '다큐멘터리 출연 제의',
    body: '글로벌 OTT가 {name}의 한 시즌을 따라가는 다큐멘터리를 찍고 싶어 한다.',
    phases: SEASON,
    weight: 1,
    requires: { minReputation: 40 },
    choices: [
      { id: 'accept', label: '출연한다', effects: [{ kind: 'MONEY', delta: 100_000, perReputation: 10_000 }, { kind: 'REPUTATION', delta: 3 }, { kind: 'CONDITION', delta: -6 }] },
      { id: 'decline', label: '축구에만 집중한다', effects: [{ kind: 'MENTAL', delta: 2 }] },
    ],
  },

  // ----- 훈련 방식 -----
  {
    id: 'training-physical-coach',
    category: 'TRAINING_METHOD',
    title: '새 피지컬 코치 부임',
    body: '{club}에 새 피지컬 코치가 왔다. 개인 프로그램 방향을 정하자.',
    phases: SEASON,
    weight: 3,
    requires: { hasClub: true },
    choices: [
      { id: 'power', label: '근력·지구력 위주', effects: [{ kind: 'GROWTH_FOCUS', category: 'PHYSICAL', multiplier: 1.5, turns: 2 }] },
      { id: 'speed', label: '스피드·민첩성 위주', effects: [{ kind: 'GROWTH_FOCUS', category: 'SPEED', multiplier: 1.5, turns: 2 }] },
    ],
  },
  {
    id: 'training-tactics',
    category: 'TRAINING_METHOD',
    title: '전술 미팅',
    body: '감독이 개인 전술 과제를 내 줬다.',
    phases: ALL,
    weight: 3,
    requires: { hasClub: true },
    choices: [
      { id: 'video', label: '영상 분석에 몰두한다', effects: [{ kind: 'ATTRIBUTE', key: 'vision', delta: 1 }, { kind: 'ATTRIBUTE', key: 'defPositioning', delta: 1 }] },
      { id: 'shooting', label: '개인 슈팅 훈련을 늘린다', effects: [{ kind: 'ATTRIBUTE', key: 'finishing', delta: 1 }, { kind: 'CONDITION', delta: -4 }] },
      { id: 'technique', label: '볼 컨트롤 훈련을 늘린다', effects: [{ kind: 'ATTRIBUTE', key: 'technique', delta: 1 }, { kind: 'CONDITION', delta: -4 }] },
    ],
  },
  {
    id: 'training-yoga',
    category: 'TRAINING_METHOD',
    title: '요가·필라테스 제안',
    body: '팀 동료가 회복에 좋다며 요가 수업을 권한다.',
    phases: ALL,
    weight: 2,
    choices: [
      { id: 'join', label: '함께 해 본다', effects: [{ kind: 'ATTRIBUTE', key: 'agility', delta: 1 }, { kind: 'MENTAL', delta: 2 }, { kind: 'CONDITION', delta: 4 }] },
      { id: 'skip', label: '하던 대로 한다', effects: [] },
    ],
  },
  {
    id: 'training-attitude',
    category: 'TRAINING_METHOD',
    title: '훈련 태도 지적',
    body: '코치가 {name}의 훈련 태도를 공개적으로 지적했다.',
    phases: ALL,
    weight: 2,
    requires: { hasClub: true },
    choices: [
      { id: 'night', label: '반성하고 야간 훈련을 한다', effects: [{ kind: 'CONDITION', delta: -10 }, { kind: 'STANDING', delta: 5 }, { kind: 'CATEGORY', category: 'PHYSICAL', delta: 1 }] },
      { id: 'argue', label: '억울하다고 항변한다', effects: [{ kind: 'STANDING', delta: -6 }, { kind: 'MENTAL', delta: 2 }] },
    ],
  },
  {
    id: 'training-mental-coach',
    category: 'TRAINING_METHOD',
    title: '심리 상담',
    body: '구단 심리 상담사가 상담을 권했다.',
    phases: ALL,
    weight: 2,
    choices: [
      { id: 'accept', label: '상담을 받는다', cost: 15_000, effects: [{ kind: 'MONEY', delta: -15_000 }, { kind: 'MENTAL', delta: 8 }] },
      { id: 'decline', label: '괜찮다고 한다', effects: [{ kind: 'MENTAL', delta: -1 }] },
    ],
  },
  {
    id: 'training-legend-session',
    category: 'TRAINING_METHOD',
    title: '레전드의 원포인트 레슨',
    body: '구단 레전드가 훈련장을 찾아와 원포인트 레슨을 해 주겠다고 한다.',
    phases: SEASON,
    weight: 1,
    requires: { hasClub: true },
    choices: [
      { id: 'attack', label: '공격 노하우를 배운다', effects: [{ kind: 'ATTRIBUTE', key: 'offTheBall', delta: 1 }, { kind: 'ATTRIBUTE', key: 'finishing', delta: 1 }] },
      { id: 'defense', label: '수비 노하우를 배운다', effects: [{ kind: 'ATTRIBUTE', key: 'interceptions', delta: 1 }, { kind: 'ATTRIBUTE', key: 'tackling', delta: 1 }] },
    ],
  },

  // ----- 스폰서 -----
  {
    id: 'sponsor-brand',
    category: 'SPONSORSHIP',
    title: '스포츠 브랜드 계약',
    body: '대형 스포츠 브랜드가 {name}에게 개인 스폰서 계약을 제안했다.',
    phases: ALL,
    weight: 2,
    requires: { minReputation: 25 },
    choices: [
      { id: 'long', label: '장기 계약 (안정적)', effects: [{ kind: 'MONEY', delta: 50_000, perReputation: 8_000 }, { kind: 'REPUTATION', delta: 1 }] },
      { id: 'short', label: '단기 고액 계약', effects: [{ kind: 'MONEY', delta: 80_000, perReputation: 12_000 }, { kind: 'MENTAL', delta: -2 }] },
    ],
  },
  {
    id: 'sponsor-local',
    category: 'SPONSORSHIP',
    title: '지역 광고 출연',
    body: '{club} 연고지의 식당 체인이 광고 모델을 제안했다.',
    phases: ALL,
    weight: 3,
    requires: { hasClub: true },
    maxAge: 30,
    choices: [
      { id: 'accept', label: '출연한다', effects: [{ kind: 'MONEY', delta: 15_000, perReputation: 500 }, { kind: 'CONDITION', delta: -3 }, { kind: 'REPUTATION', delta: 1 }] },
      { id: 'decline', label: '거절한다', effects: [{ kind: 'CONDITION', delta: 3 }] },
    ],
  },
  {
    id: 'sponsor-energy',
    category: 'SPONSORSHIP',
    title: '에너지 드링크 광고',
    body: '에너지 드링크 회사가 극한 스포츠 콘셉트 광고를 찍자고 한다.',
    phases: ALL,
    weight: 1,
    requires: { minReputation: 15 },
    choices: [
      { id: 'accept', label: '찍는다', effects: [{ kind: 'MONEY', delta: 30_000, perReputation: 3_000 }, { kind: 'CONDITION', delta: -8 }] },
      { id: 'decline', label: '부상 위험이 있어 거절한다', effects: [{ kind: 'STANDING', delta: 1 }] },
    ],
  },

  // ----- 팀 -----
  {
    id: 'team-leadership',
    category: 'TEAM',
    title: '리더 역할 제안',
    body: '주장단이 {name}에게 라커룸 리더 역할을 맡아 달라고 한다.',
    phases: ALL,
    weight: 2,
    minAge: 24,
    requires: { firstTeam: true },
    choices: [
      { id: 'accept', label: '맡는다', effects: [{ kind: 'STANDING', delta: 4 }, { kind: 'MENTAL', delta: 3 }, { kind: 'CONDITION', delta: -3 }] },
      { id: 'decline', label: '경기력에 집중한다', effects: [{ kind: 'MENTAL', delta: 1 }] },
    ],
  },
  {
    id: 'team-fight',
    category: 'TEAM',
    title: '동료와의 언쟁',
    body: '훈련 중 팀 동료와 언성을 높였다.',
    phases: ALL,
    weight: 2,
    requires: { hasClub: true },
    choices: [
      { id: 'reconcile', label: '먼저 사과한다', effects: [{ kind: 'MENTAL', delta: 2 }] },
      { id: 'report', label: '감독에게 이야기한다', effects: [{ kind: 'STANDING', delta: 2 }, { kind: 'MENTAL', delta: -3 }] },
    ],
  },
  {
    id: 'team-position-cover',
    category: 'TEAM',
    title: '임시 포지션 변경',
    body: '부상자가 많아 감독이 {name}에게 낯선 포지션을 부탁했다.',
    phases: ['FIRST_HALF', 'SECOND_HALF'],
    weight: 2,
    requires: { firstTeam: true },
    choices: [
      { id: 'accept', label: '팀을 위해 맡는다', effects: [{ kind: 'STANDING', delta: 5 }, { kind: 'CONDITION', delta: -6 }, { kind: 'CATEGORY', category: 'DEFENDING', delta: 1 }] },
      { id: 'refuse', label: '정중히 거절한다', effects: [{ kind: 'STANDING', delta: -3 }] },
    ],
  },
  {
    id: 'team-fan-event',
    category: 'TEAM',
    title: '팬 사인회',
    body: '{club} 팬 사인회에 참석해 달라는 요청이 왔다.',
    phases: ALL,
    weight: 3,
    requires: { hasClub: true },
    choices: [
      { id: 'attend', label: '참석한다', effects: [{ kind: 'REPUTATION', delta: 1 }, { kind: 'MENTAL', delta: 2 }, { kind: 'CONDITION', delta: -2 }] },
      { id: 'skip', label: '회복에 집중한다', effects: [{ kind: 'CONDITION', delta: 4 }] },
    ],
  },

  // ----- 파트너 -----
  {
    id: 'partner-extra-training',
    category: 'PARTNER',
    title: '단짝과의 연계 훈련',
    body: '{partner}이(가) 훈련 후에 둘만의 패턴 훈련을 하자고 한다.',
    phases: ALL,
    weight: 4,
    requires: { partner: true },
    choices: [
      { id: 'stay', label: '남아서 함께 훈련한다', effects: [{ kind: 'ATTRIBUTE', key: 'kickAccuracy', delta: 1 }, { kind: 'ATTRIBUTE', key: 'offTheBall', delta: 1 }, { kind: 'CONDITION', delta: -5 }] },
      { id: 'rest', label: '오늘은 쉬자고 한다', effects: [{ kind: 'CONDITION', delta: 3 }] },
    ],
  },
  {
    id: 'partner-dinner',
    category: 'PARTNER',
    title: '단짝의 고민',
    body: '{partner}이(가) 저녁을 먹으며 이적 고민을 털어놓는다.',
    phases: SEASON,
    weight: 2,
    requires: { partner: true },
    choices: [
      { id: 'persuade', label: '같이 더 뛰자고 설득한다', effects: [{ kind: 'MENTAL', delta: 3 }] },
      { id: 'support', label: '네 꿈을 응원한다고 말한다', effects: [{ kind: 'MENTAL', delta: 1 }, { kind: 'REPUTATION', delta: 1 }] },
    ],
  },

  // ----- 라이벌 -----
  {
    id: 'rival-provocation',
    category: 'RIVAL',
    title: '라이벌의 도발',
    body: '{rival}이(가) 인터뷰에서 "{name}은(는) 아직 멀었다"고 말했다.',
    phases: ALL,
    weight: 4,
    requires: { rival: true },
    choices: [
      {
        id: 'respond',
        label: '맞받아친다',
        successChance: 0.55,
        effects: [{ kind: 'MENTAL', delta: 6 }, { kind: 'REPUTATION', delta: 1 }],
        failureEffects: [{ kind: 'MENTAL', delta: -4 }],
      },
      { id: 'ignore', label: '경기장에서 증명하겠다고만 한다', effects: [{ kind: 'MENTAL', delta: 2 }] },
    ],
  },
  {
    id: 'rival-ad',
    category: 'RIVAL',
    title: '라이벌과의 동반 광고',
    body: '{rival}과(와) 함께 맞대결 콘셉트 광고를 찍자는 제안이 왔다.',
    phases: SEASON,
    weight: 1,
    requires: { rival: true, minReputation: 35 },
    choices: [
      { id: 'accept', label: '찍는다', effects: [{ kind: 'MONEY', delta: 50_000, perReputation: 6_000 }, { kind: 'REPUTATION', delta: 2 }] },
      { id: 'decline', label: '라이벌과는 같이 찍지 않는다', effects: [{ kind: 'MENTAL', delta: 3 }] },
    ],
  },
];

/** 반복 가능한 일상도 최소 두 시즌 간격. 단발성 인생 사건은 한 번만 발생한다. */
export const GAME_EVENTS: GameEventDefinition[] = [...ORIGINAL_EVENTS, ...EXPANDED_EVENTS].map((event) => ({
  ...event,
  cooldownTurns: event.guaranteed ? undefined : event.cooldownTurns ?? 6,
  maxOccurrences: ['family-sibling', 'family-relationship', 'family-wedding'].includes(event.id) ? 1 : event.maxOccurrences,
}));

export const GAME_EVENT_MAP: Record<string, GameEventDefinition> = Object.fromEntries(
  GAME_EVENTS.map((event) => [event.id, event]),
);
