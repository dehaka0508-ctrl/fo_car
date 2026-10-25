/**
 * 하이라이트(바둑돌) 매치 — 프로토타입
 *
 * 시뮬레이터는 하이라이트 경기 직전에서 멈추고, 이 모듈이 그 경기의 브리핑과
 * 선택지 상황을 만든다. 플레이어의 선택 판정 결과(HighlightOutcome)를
 * resolveHighlight()에 넘기면 스코어·개인 기록·명성·멘탈에 반영된다.
 *
 * 현재는 포지션별 기본 상황 생성과 자동 선택(테스트·샌드박스용)만 구현했다.
 * 바둑돌 배치·애니메이션과 상황별 선택지 UI는 다음 단계에서 이 모듈을 확장한다.
 */
import { getPositionGroup } from '@/data/playstyles';
import type {
  Appearance,
  AttributeKey,
  Fixture,
  HighlightKind,
  HighlightOutcome,
  PlayerRole,
  PlayingTime,
  ResolvedSituation,
  SituationKind,
  TeamRef,
  TeamSide,
  TokenTag,
} from '@/types/game';
import { clamp, rngFor } from './rng';
import { choiceSuccessChance, getHighlightFixture, type TurnSession } from './simulator';

/** 상황 유형별 성공률 판정에 쓰이는 세부 능력치 */
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

  const taggedPlayers: HighlightBriefing['taggedPlayers'] = [
    { name: session.player.name, tag: 'PROTAGONIST', side },
  ];
  if (session.partner && fixture.squad === 'FIRST') {
    taggedPlayers.push({ name: session.partner.name, tag: 'PARTNER', side });
  }
  for (const notable of session.notable) {
    if (notable.clubId === opponentClubId) {
      taggedPlayers.push({ name: notable.name, tag: notable.tag, side: opponentSide });
    }
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

/**
 * 선택지를 자동으로 판정한다 (테스트·샌드박스·자동 진행용).
 * 실제 게임에서는 UI가 상황마다 선택지를 보여주고 플레이어가 고른 결과를 넘긴다.
 */
export function buildAutoHighlightOutcome(session: TurnSession): HighlightOutcome | null {
  const briefing = getHighlightBriefing(session);
  if (!briefing) return null;
  const { attributes, role, squad } = session.player;
  const playingTime =
    briefing.fixture.squad === 'NATIONAL' && session.nationalDuty
      ? session.nationalDuty.playingTime
      : briefing.fixture.squad === 'RESERVE'
        ? 'STARTER'
        : squad.playingTime;
  const difficulty = situationDifficulty(briefing.opponent.power, briefing.kind);
  const rng = rngFor(session.seed, briefing.fixture.id, 'auto-highlight');

  const resolved: ResolvedSituation[] = defaultSituationKinds(role, playingTime).map((kind, index) => {
    const chance = choiceSuccessChance(attributes, SITUATION_KEY_ATTRIBUTES[kind], difficulty, session.mental);
    return { situationId: `${briefing.fixture.id}:S${index + 1}`, kind, success: rng.chance(chance), chance };
  });
  return { fixtureId: briefing.fixture.id, resolved };
}
