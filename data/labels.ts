/** UI 표시용 한국어 라벨 */
import type {
  CompetitionType,
  HighlightKind,
  PlayingTime,
  SquadLevel,
  TurnPhase,
} from '@/types/game';

export const TURN_PHASE_LABELS: Record<TurnPhase, string> = {
  FIRST_HALF: '전반기',
  SECOND_HALF: '후반기',
  PRESEASON: '프리시즌',
};

export const PLAYING_TIME_LABELS: Record<PlayingTime, string> = {
  KEY: '핵심',
  STARTER: '주전',
  ROTATION: '준주전',
  BACKUP: '후보',
  RESERVE: 'B팀·유스',
  GK_FIRST: '주전 GK',
  GK_SECOND: '2순위 GK',
  GK_THIRD: '3순위 GK',
};

export const SQUAD_LEVEL_LABELS: Record<SquadLevel, string> = {
  FIRST_TEAM: '1군',
  RESERVE: 'B팀(리저브)',
  YOUTH: '유소년팀(U19)',
};

export const COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
  LEAGUE: '리그',
  DOMESTIC_CUP: '국내컵',
  CONTINENTAL: '대륙컵',
  INTERNATIONAL: '국가대표',
  FRIENDLY: '친선경기',
  RESERVE: 'B팀·유스',
};

export const HIGHLIGHT_KIND_LABELS: Record<HighlightKind, string> = {
  DERBY: '라이벌 더비',
  BIG_MATCH: '빅매치',
  DOMESTIC_CUP_FINAL: '국내컵 결승',
  CONTINENTAL_FINAL: '대륙컵 결승',
  INTERNATIONAL: '국제대회',
  PRESEASON_FRIENDLY: '프리시즌 연습경기',
  RESERVE_DERBY: '리저브 더비',
};
