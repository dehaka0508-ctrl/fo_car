/**
 * 하이라이트(바둑돌) 매치
 *
 * 시뮬레이터는 하이라이트 경기 직전에서 멈추고, 이 모듈이 그 경기의 브리핑과 장면(상황 2~3개)을 만든다.
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

const SITUATION_TEXT: Record<SituationKind, string> = {
  SHOT: '{minute}분, {name}에게 결정적인 슈팅 기회가 왔다!',
  KEY_PASS: '{minute}분, 하프라인을 넘은 {name}. 수비 뒷공간이 보인다.',
  DRIBBLE: '{minute}분, 측면에서 {name}과(와) 수비수의 1대1!',
  SET_PIECE: '{minute}분, 페널티 박스 근처에서 세트피스 기회.',
  DEFEND: '{minute}분, 상대의 역습! {name}이(가) 마지막 수비수다.',
  SAVE: '{minute}분, 상대 공격수가 골문 앞에서 슈팅을 준비한다!',
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

function scenePlayingTime(session: TurnSession, fixture: Fixture): PlayingTime {
  if (fixture.squad === 'NATIONAL' && session.nationalDuty) return session.nationalDuty.playingTime;
  if (fixture.squad === 'RESERVE') return 'STARTER';
  return session.player.squad.playingTime;
}

/** 하이라이트 장면(상황 2~3개)을 만든다. 같은 세션이면 항상 같은 장면이 나온다. */
export function buildHighlightScene(session: TurnSession): HighlightScene | null {
  const briefing = getHighlightBriefing(session);
  if (!briefing) return null;
  const rng = rngFor(session.seed, briefing.fixture.id, 'scene');
  const difficulty = situationDifficulty(briefing.opponent.power, briefing.kind);
  const kinds = defaultSituationKinds(session.player.role, scenePlayingTime(session, briefing.fixture));
  const minutes = kinds.map(() => rng.int(5, 88)).sort((a, b) => a - b);
  const partnerName = briefing.taggedPlayers.find((t) => t.tag === 'PARTNER')?.name ?? null;

  const situations = kinds.map((kind, i): MatchSituation => {
    const { tokens, ball } = buildTokens(rng, kind, briefing, partnerName);
    const options: SituationOption[] = OPTION_TEMPLATES[kind].map((template, j) => ({
      id: `opt-${j}`,
      label: template.label,
      kind: template.kind,
      keyAttributes: template.keys,
      difficulty: clamp(difficulty + template.delta, 20, 95),
    }));
    return {
      id: `${briefing.fixture.id}:S${i + 1}`,
      minute: minutes[i],
      description: SITUATION_TEXT[kind].replace('{minute}', String(minutes[i])).replace('{name}', session.player.name),
      tokens,
      ball,
      options,
    };
  });
  return { briefing, situations };
}

export function optionSuccessChance(session: TurnSession, option: SituationOption): number {
  return choiceSuccessChance(session.player.attributes, option.keyAttributes, option.difficulty, session.mental);
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
