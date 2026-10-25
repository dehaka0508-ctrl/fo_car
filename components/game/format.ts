/** 게임 화면 표기 헬퍼 */
import { PLAYING_TIME_LABELS } from '@/data/labels';
import { BASE_WORLD } from '@/engine/career';
import type { ID, OfferType, PlayingTime } from '@/types/game';

export function competitionName(id: ID): string {
  return BASE_WORLD.competitions[id]?.nameKo ?? BASE_WORLD.leagues[id]?.nameKo ?? id;
}

export function clubLabel(id: ID | null | undefined): string {
  if (!id) return '무소속';
  return BASE_WORLD.clubs[id]?.nameKo ?? id;
}

export function seasonLabel(season: number): string {
  return `${season}/${String((season + 1) % 100).padStart(2, '0')}`;
}

export function playingTimeLabel(playingTime: PlayingTime): string {
  return PLAYING_TIME_LABELS[playingTime];
}

export const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  TRANSFER: '완전 이적',
  LOAN: '임대',
  RENEWAL: '재계약',
};

export function ratingText(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : value.toFixed(2);
}
