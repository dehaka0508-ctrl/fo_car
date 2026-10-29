/**
 * 하이라이트(바둑돌) 매치
 *
 * 시뮬레이터는 하이라이트 경기 직전에서 멈추고, 이 모듈이 그 경기의 브리핑과 장면(상황 1~2개)을 만든다.
 * 각 상황에는 바둑돌 배치와 성공률이 다른 선택지가 있다. 플레이어가 고른 결과를 모아
 * HighlightOutcome으로 resolveHighlight()에 넘기면 스코어·개인 기록·명성·멘탈에 반영된다.
 *
 * 바둑돌 규칙
 * - 주인공 돌은 피부색·머리색을 반영한다 (UI가 appearance로 렌더링)
 * - 상대 팀에 숙명의 라이벌이나 옛 파트너가 있으면 그 돌에 이름을 직접 표시한다
 * - 주인공 팀은 항상 왼쪽에서 오른쪽으로 공격한다
 */
import { getPositionGroup } from '@/data/playstyles';
import type {
  Appearance,
  AttributeKey,
  Fixture,
  HighlightKind,
  HighlightOutcome,
  MatchSituation,
  MatchToken,
  PlayerRole,
  Position,
  PlayingTime,
  ResolvedSituation,
  SituationKind,
  SituationOption,
  TeamRef,
  TeamSide,
  TokenTag,
} from '@/types/game';
import { clamp, rngFor, type Rng } from './rng';
import { choiceSuccessChance, getHighlightFixture, type TurnSession } from './simulator';

/** 상황 유형별 기본 판정 능력치 */
export const SITUATION_KEY_ATTRIBUTES: Record<SituationKind, readonly AttributeKey[]> = {
  SHOT: ['finishing', 'shotPower'],
  KEY_PASS: ['vision', 'kickAccuracy'],
  DRIBBLE: ['takeOn', 'technique'],
  SET_PIECE: ['setPieces', 'aerial'],
  DEFEND: ['tackling', 'defPositioning'],
  SAVE: ['reflexes', 'gkPositioning'],
};

const KIND_DIFFICULTY_BONUS: Record<HighlightKind, number> = {
  DERBY: 2,
  RIVAL_MATCH: 2,
  TITLE_DECIDER: 4,
  BIG_MATCH: 1,
  DOMESTIC_CUP_FINAL: 3,
  CONTINENTAL_FINAL: 5,
  INTERNATIONAL: 4,
  PRESEASON_FRIENDLY: -3,
  RESERVE_DERBY: 0,
};

export interface HighlightBriefing {
  fixture: Fixture;
  kind: HighlightKind;
  playerTeam: TeamRef;
  opponent: TeamRef;
  playerTeamSide: TeamSide;
  protagonist: { name: string; appearance: Appearance };
  /** 바둑돌에 이름을 직접 표시할 선수들 */
  taggedPlayers: Array<{ name: string; tag: TokenTag; side: TeamSide }>;
}

export function getHighlightBriefing(session: TurnSession): HighlightBriefing | null {
  const fixture = getHighlightFixture(session);
  if (!fixture || !fixture.playerTeamSide || !session.highlight) return null;
  const side = fixture.playerTeamSide;
  const opponentSide: TeamSide = side === 'HOME' ? 'AWAY' : 'HOME';
  const playerTeam = side === 'HOME' ? fixture.home : fixture.away;
  const opponent = side === 'HOME' ? fixture.away : fixture.home;
  // 리저브 팀 id는 '<구단id>#<레벨>' 형식이다
  const opponentClubId = opponent.id.split('#')[0];

  const taggedPlayers: HighlightBriefing['taggedPlayers'] = [{ name: session.player.name, tag: 'PROTAGONIST', side }];
  if (session.partner && fixture.squad === 'FIRST') {
    taggedPlayers.push({ name: session.partner.name, tag: 'PARTNER', side });
  }
  for (const notable of session.notable) {
    if (notable.clubId === opponentClubId) taggedPlayers.push({ name: notable.name, tag: notable.tag, side: opponentSide });
  }

  return {
    fixture,
    kind: session.highlight.kind,
    playerTeam,
    opponent,
    playerTeamSide: side,
    protagonist: { name: session.player.name, appearance: session.player.appearance },
    taggedPlayers,
  };
}

/** 포지션별 기본 상황 구성. 후보 선수는 교체 투입이라 상황이 적다. */
export function defaultSituationKinds(role: PlayerRole, playingTime: PlayingTime): SituationKind[] {
  let kinds: SituationKind[];
  switch (getPositionGroup(role.position)) {
    case 'GOALKEEPER':
      kinds = ['SAVE', 'SAVE', 'SAVE'];
      break;
    case 'DEFENDER':
      kinds = role.position === 'CB' ? ['DEFEND', 'DEFEND', 'SET_PIECE'] : ['DEFEND', 'KEY_PASS', 'DEFEND'];
      break;
    case 'MIDFIELDER':
      kinds = role.position === 'DM' ? ['DEFEND', 'KEY_PASS', 'DEFEND'] : ['KEY_PASS', 'SHOT', 'DRIBBLE'];
      break;
    default:
      kinds = role.position === 'ST' ? ['SHOT', 'SHOT', 'KEY_PASS'] : ['DRIBBLE', 'SHOT', 'KEY_PASS'];
  }
  return playingTime === 'BACKUP' || playingTime === 'RESERVE' ? kinds.slice(0, 1) : kinds;
}

/** 상황 난이도: 상대가 강할수록, 큰 경기일수록 어렵다. */
export function situationDifficulty(opponentPower: number, kind: HighlightKind): number {
  return clamp(Math.round(50 + (opponentPower - 60) * 0.6 + KIND_DIFFICULTY_BONUS[kind]), 30, 90);
}

// ----------------------------------------------------------------------------
// 장면 생성
// ----------------------------------------------------------------------------

interface OptionTemplate {
  label: string;
  kind: SituationKind;
  keys: AttributeKey[];
  /** 기본 난이도 대비 가감 */
  delta: number;
}

const OPTION_TEMPLATES: Record<SituationKind, OptionTemplate[]> = {
  SHOT: [
    { label: '강하게 때린다', kind: 'SHOT', keys: ['shotPower', 'finishing'], delta: 4 },
    { label: '구석으로 감아 찬다', kind: 'SHOT', keys: ['finishing', 'technique'], delta: 6 },
    { label: '더 좋은 위치의 동료에게 내준다', kind: 'KEY_PASS', keys: ['vision', 'kickAccuracy'], delta: -2 },
  ],
  KEY_PASS: [
    { label: '스루패스를 찔러 준다', kind: 'KEY_PASS', keys: ['vision', 'kickAccuracy'], delta: 2 },
    { label: '직접 치고 들어간다', kind: 'DRIBBLE', keys: ['takeOn', 'technique'], delta: 4 },
    { label: '중거리 슛을 노린다', kind: 'SHOT', keys: ['shotPower', 'finishing'], delta: 9 },
  ],
  DRIBBLE: [
    { label: '개인기로 제친다', kind: 'DRIBBLE', keys: ['technique', 'takeOn'], delta: 2 },
    { label: '스피드로 치고 나간다', kind: 'DRIBBLE', keys: ['sprintSpeed', 'acceleration'], delta: 2 },
    { label: '크로스를 올린다', kind: 'KEY_PASS', keys: ['kickAccuracy', 'vision'], delta: 0 },
  ],
  SET_PIECE: [
    { label: '직접 프리킥을 찬다', kind: 'SET_PIECE', keys: ['setPieces', 'shotPower'], delta: 7 },
    { label: '코너킥 헤더 경합', kind: 'SET_PIECE', keys: ['aerial', 'strength'], delta: 3 },
  ],
  DEFEND: [
    { label: '태클로 끊어 낸다', kind: 'DEFEND', keys: ['tackling', 'strength'], delta: 2 },
    { label: '길목을 지킨다', kind: 'DEFEND', keys: ['defPositioning', 'interceptions'], delta: 0 },
    { label: '몸으로 버틴다', kind: 'DEFEND', keys: ['strength', 'aerial'], delta: 3 },
  ],
  SAVE: [
    { label: '몸을 날린다', kind: 'SAVE', keys: ['reflexes', 'gkRange'], delta: 2 },
    { label: '각도를 좁힌다', kind: 'SAVE', keys: ['gkPositioning', 'organization'], delta: 0 },
  ],
};


function jitter(rng: Rng, value: number, spread: number): number {
  return Math.round(clamp(value + rng.float(-spread, spread), 3, 97));
}

function buildTokens(
  rng: Rng,
  kind: SituationKind,
  briefing: HighlightBriefing,
  partnerName: string | null,
): { tokens: MatchToken[]; ball: { x: number; y: number } } {
  const mySide = briefing.playerTeamSide;
  const theirSide: TeamSide = mySide === 'HOME' ? 'AWAY' : 'HOME';
  const attacking = kind === 'SHOT' || kind === 'KEY_PASS' || kind === 'DRIBBLE' || kind === 'SET_PIECE';
  const base = attacking ? 74 : kind === 'SAVE' ? 6 : 24;
  const me = { x: jitter(rng, base, 6), y: jitter(rng, 50, 20) };
  if (kind === 'SAVE') me.y = jitter(rng, 50, 4);

  const tokens: MatchToken[] = [
    { id: 'me', side: mySide, x: me.x, y: me.y, tag: 'PROTAGONIST', label: briefing.protagonist.name, appearance: briefing.protagonist.appearance },
  ];
  const mates = attacking ? [[me.x - 12, me.y - 18], [me.x - 6, me.y + 20], [me.x + 8, clamp(me.y + (me.y > 50 ? -26 : 26), 8, 92)]] : [[me.x + 14, me.y - 16], [me.x + 10, me.y + 18], [3, 50]];
  mates.forEach(([x, y], i) => {
    const isPartner = i === 0 && partnerName !== null;
    tokens.push({ id: `mate-${i}`, side: mySide, x: jitter(rng, x, 3), y: jitter(rng, y, 3), tag: isPartner ? 'PARTNER' : undefined, label: isPartner ? partnerName : undefined });
  });

  const opponentsTagged = briefing.taggedPlayers.filter((t) => t.side === theirSide);
  const opponents = attacking
    ? [[me.x + 8, me.y - 6], [me.x + 12, me.y + 10], [me.x + 16, me.y - 18], [me.x - 4, me.y + 6], [96, 50]]
    : kind === 'SAVE'
      ? [[me.x + 10, me.y - 4], [me.x + 18, me.y + 14], [me.x + 22, me.y - 16]]
      : [[me.x + 6, me.y - 4], [me.x + 14, me.y + 12], [me.x + 20, me.y - 14], [me.x + 30, me.y + 2]];
  opponents.forEach(([x, y], i) => {
    const tagged = opponentsTagged[i];
    tokens.push({ id: `opp-${i}`, side: theirSide, x: jitter(rng, x, 3), y: jitter(rng, y, 3), tag: tagged?.tag, label: tagged?.name });
  });

  const ball = attacking ? { x: me.x + 2, y: me.y } : { x: me.x + 6, y: me.y - 2 };
  return { tokens, ball };
}

export interface HighlightScene {
  briefing: HighlightBriefing;
  situations: MatchSituation[];
}


interface SceneVariant {
  id: string;
  kind: SituationKind;
  text: string;
  options?: OptionTemplate[];
}

/** 포지션별 경기 맥락을 뽑아 같은 종류의 선택도 서로 다른 상황으로 보여준다. */
export function positionScenePool(position: Position): SceneVariant[] {
  const cross: SceneVariant = { id: 'incoming-cross', kind: 'SHOT', text: '{minute}분, 측면에서 {name}에게 크로스가 올라온다. 수비수와 공중볼을 다퉈야 한다!', options: [
    { label: '높이 뛰어 헤더로 마무리한다', kind: 'SHOT', keys: ['aerial', 'offTheBall'], delta: 2 },
    { label: '타이밍을 맞춰 발리슛을 시도한다', kind: 'SHOT', keys: ['technique', 'finishing'], delta: 7 },
    { label: '동료에게 머리로 떨궈 준다', kind: 'KEY_PASS', keys: ['aerial', 'vision'], delta: -2 },
  ] };
  const base = (id: string, kind: SituationKind, text: string): SceneVariant => ({ id, kind, text });
  switch (getPositionGroup(position)) {
    case 'GOALKEEPER': return [
      base('one-on-one-save', 'SAVE', '{minute}분, 상대 공격수가 수비 뒷공간을 뚫었다. {name}과의 일대일!'),
      base('long-shot-save', 'SAVE', '{minute}분, 수비수 사이로 날카로운 중거리 슈팅이 날아온다!'),
      { id: 'claim-cross', kind: 'SAVE', text: '{minute}분, 골문 앞으로 높은 크로스가 올라온다. {name}의 판단이 필요하다!', options: [
        { label: '뛰어나가 공을 잡는다', kind: 'SAVE', keys: ['gkRange', 'gkPositioning'], delta: 3 },
        { label: '펀칭으로 위험 지역을 벗긴다', kind: 'SAVE', keys: ['reflexes', 'organization'], delta: 0 },
      ] },
      base('penalty-save', 'SAVE', '{minute}분, 페널티킥! {name}이 상대 키커와 눈을 맞춘다.'),
    ];
    case 'DEFENDER': return [
      base('stop-counter', 'DEFEND', '{minute}분, 상대가 빠른 역습을 전개한다. {name}이 마지막 수비수다!'),
      { id: 'clear-cross', kind: 'DEFEND', text: '{minute}분, 위험한 크로스가 박스 안으로 들어온다. {name}이 공격수보다 먼저 처리해야 한다!', options: [
        { label: '헤더로 멀리 걷어 낸다', kind: 'DEFEND', keys: ['aerial', 'strength'], delta: 1 },
        { label: '낙하지점을 선점해 차단한다', kind: 'DEFEND', keys: ['defPositioning', 'interceptions'], delta: 0 },
      ] },
      base('defensive-duel', 'DEFEND', '{minute}분, 상대 윙어가 {name} 앞에서 돌파를 시도한다!'),
      base('corner-header', 'SET_PIECE', '{minute}분, 공격 코너킥. {name}이 골문 앞 빈 공간으로 파고든다.'),
      base('build-from-back', 'KEY_PASS', '{minute}분, 상대 압박이 몰려온다. {name}이 전진 패스 길을 찾는다.'),
    ];
    case 'MIDFIELDER': return [
      base('through-ball', 'KEY_PASS', '{minute}분, {name} 앞에서 동료가 수비 뒷공간으로 뛰어간다!'),
      base('press-escape', 'DRIBBLE', '{minute}분, 두 명이 {name}을 압박한다. 공을 지키며 전진해야 한다!'),
      base('midfield-interception', 'DEFEND', '{minute}분, 상대의 전진 패스가 {name}의 수비 구역으로 들어온다.'),
      base('second-ball', 'SHOT', '{minute}분, 걷어 낸 공이 박스 밖 {name} 앞으로 떨어진다!'),
      base('midfield-set-piece', 'SET_PIECE', '{minute}분, 좋은 위치의 프리킥. {name}이 공 앞에 선다.'),
    ];
    default: return position === 'ST' ? [
      cross,
      base('one-on-one-shot', 'SHOT', '{minute}분, 침투 패스를 받은 {name}! 골키퍼와 일대일 기회다.'),
      { id: 'back-to-goal', kind: 'SHOT', text: '{minute}분, {name}이 골문을 등지고 공을 받았다. 수비수가 바짝 붙는다!', options: [
        { label: '몸으로 버티며 돌아서 슛한다', kind: 'SHOT', keys: ['strength', 'finishing'], delta: 4 },
        { label: '뒤에서 뛰어오는 동료에게 내준다', kind: 'KEY_PASS', keys: ['pressResistance', 'kickAccuracy'], delta: 0 },
      ] },
      base('cutback-shot', 'SHOT', '{minute}분, 골라인까지 돌파한 동료가 {name}에게 낮은 컷백을 보낸다!'),
      base('striker-counter', 'DRIBBLE', '{minute}분, 역습 기회! {name} 앞에는 수비수 한 명만 남았다.'),
      base('striker-linkup', 'KEY_PASS', '{minute}분, {name}에게 수비가 몰렸다. 옆으로 동료가 침투한다!'),
    ] : [
      base('wing-duel', 'DRIBBLE', '{minute}분, 측면에서 공을 받은 {name}이 풀백과 일대일로 맞선다!'),
      base('wing-cross', 'KEY_PASS', '{minute}분, {name}이 측면을 뚫었다. 박스 안 동료에게 크로스를 보낼 기회다!'),
      base('cut-inside', 'SHOT', '{minute}분, {name}이 안쪽으로 접고 들어온다. 반대편 골문이 열렸다!'),
      cross,
      base('wing-counter', 'DRIBBLE', '{minute}분, 상대 수비가 올라간 틈으로 {name}이 빠르게 전진한다!'),
    ];
  }
}

/** 하이라이트 장면(상황 1~2개)을 만든다. 같은 세션이면 항상 같은 장면이 나온다. */
export function buildHighlightScene(session: TurnSession): HighlightScene | null {
  const briefing = getHighlightBriefing(session);
  if (!briefing) return null;
  const rng = rngFor(session.seed, briefing.fixture.id, 'scene');
  const difficulty = situationDifficulty(briefing.opponent.power, briefing.kind);
  const pool = positionScenePool(session.player.role.position);
  const variants = Array.from({ length: session.highlight?.situationCount ?? 2 }, () => pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  const from = session.highlight?.appearance?.from ?? 4;
  const to = session.highlight?.appearance?.to ?? 89;
  const minutes = variants.map(() => rng.int(from + 1, to)).sort((a, b) => a - b);
  const partnerName = briefing.taggedPlayers.find((t) => t.tag === 'PARTNER')?.name ?? null;

  const situations = variants.map((variant, i): MatchSituation => {
    const kind = variant.kind;
    const { tokens, ball } = buildTokens(rng, kind, briefing, partnerName);
    const options: SituationOption[] = (variant.options ?? OPTION_TEMPLATES[kind]).map((template, j) => ({
      id: `opt-${j}`,
      label: template.label,
      kind: template.kind,
      keyAttributes: template.keys,
      difficulty: clamp(difficulty + template.delta, 20, 95),
    }));
    return {
      id: `${briefing.fixture.id}:S${i + 1}`,
      context: variant.id,
      minute: minutes[i],
      description: variant.text.replace('{minute}', String(minutes[i])).replace('{name}', session.player.name),
      tokens,
      ball,
      options,
    };
  });
  return { briefing, situations };
}

export function optionSuccessChance(session: TurnSession, option: SituationOption): number {
  const base = choiceSuccessChance(session.player.attributes, option.keyAttributes, option.difficulty, session.mental);
  const kicking = ['SHOT', 'KEY_PASS', 'SET_PIECE'].includes(option.kind);
  return clamp(base + (kicking ? ((session.player.weakFoot ?? 40) - 40) * 0.001 : 0), 0.05, 0.95);
}

/** 선택지 하나를 판정한다. 같은 선택이면 항상 같은 결과 (세이브·리로드 악용 방지) */
export function resolveSituationChoice(session: TurnSession, situation: MatchSituation, optionId: string): ResolvedSituation {
  const option = situation.options.find((o) => o.id === optionId);
  if (!option) throw new Error('선택지를 찾을 수 없습니다.');
  const chance = optionSuccessChance(session, option);
  const success = rngFor(session.seed, situation.id, 'choice').chance(chance);
  return { situationId: situation.id, kind: option.kind, success, chance };
}

/**
 * 선택지를 자동으로 고른다 (테스트·자동 진행용): 상황마다 성공률이 가장 높은 선택지.
 */
export function buildAutoHighlightOutcome(session: TurnSession): HighlightOutcome | null {
  const scene = buildHighlightScene(session);
  if (!scene) return null;
  const resolved = scene.situations.map((situation) => {
    const best = situation.options.reduce((a, b) => (optionSuccessChance(session, b) > optionSuccessChance(session, a) ? b : a));
    return resolveSituationChoice(session, situation, best.id);
  });
  return { fixtureId: scene.briefing.fixture.id, resolved };
}
