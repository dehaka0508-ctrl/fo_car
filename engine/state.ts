/** GameState 공용 헬퍼 */
import type { GameState, Notice, NoticeKind, TurnPointer } from '@/types/game';
import { hashSeed } from './rng';

export const NOTICE_LIMIT = 80;

export function pushNotice(
  state: GameState,
  notice: { kind: NoticeKind; title: string; body: string; popup?: boolean; turn?: TurnPointer },
): GameState {
  const turn = notice.turn ?? state.turn;
  const entry: Notice = {
    id: `n-${hashSeed(state.notices.length, notice.title, turn.season, turn.phase, state.notices[0]?.id ?? '')}`,
    turn,
    kind: notice.kind,
    title: notice.title,
    body: notice.body,
    popup: notice.popup ?? false,
  };
  return { ...state, notices: [entry, ...state.notices].slice(0, NOTICE_LIMIT) };
}

/** €1.2M / €350K / €8,000 형식 */
export function formatMoney(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `${sign}€${Math.round(abs / 1_000)}K`;
  return `${sign}€${Math.round(abs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function turnLabel(turn: TurnPointer): string {
  const phase = turn.phase === 'FIRST_HALF' ? '전반기' : turn.phase === 'SECOND_HALF' ? '후반기' : '프리시즌';
  return `${turn.season}/${String((turn.season + 1) % 100).padStart(2, '0')} ${phase}`;
}
