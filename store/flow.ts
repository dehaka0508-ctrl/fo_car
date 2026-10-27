/**
 * 한 턴의 진행 순서 (화면 흐름)
 *
 *   경기(턴 수행) → 사건 대응 → 훈련 → 물건 구매 → 이적 → 다음 경기 …
 *
 * 선택을 하면 다음 단계로 자동으로 넘어가고, 할 일이 없는 단계(답할 사건 없음 · 이미 훈련함 · 이미 샀거나 살 수 있는 물건 없음 · 받은 오퍼 없음)는 건너뛴다.
 * 위쪽 단계 표시를 눌러 언제든 앞뒤 단계로 옮겨 갈 수 있다 (그때는 건너뛰지 않는다).
 */
import { shopOffers } from '@/engine/interTurn';
import type { GameState } from '@/types/game';

export type FlowStep = 'MATCH' | 'EVENTS' | 'TRAINING' | 'SHOP' | 'TRANSFER';

export const FLOW_STEPS: FlowStep[] = ['MATCH', 'EVENTS', 'TRAINING', 'SHOP', 'TRANSFER'];

export const FLOW_LABELS: Record<FlowStep, string> = {
  MATCH: '경기',
  EVENTS: '사건',
  TRAINING: '훈련',
  SHOP: '상점',
  TRANSFER: '이적',
};

export function unresolvedEvents(game: GameState) {
  return game.events.filter((e) => !e.resolution);
}

export function pendingOffers(game: GameState) {
  return game.offers.filter((o) => o.status === 'PENDING');
}

/** 이 단계에 지금 할 일이 남았는가 */
export function stepHasWork(game: GameState, step: FlowStep): boolean {
  switch (step) {
    case 'MATCH':
      return true;
    case 'EVENTS':
      return unresolvedEvents(game).length > 0;
    case 'TRAINING':
      return game.interTurn.training === null;
    case 'SHOP':
      return game.interTurn.purchasedItemId === null && shopOffers(game).length > 0;
    case 'TRANSFER':
      return pendingOffers(game).length > 0;
  }
}

/** from 다음 단계 중 할 일이 있는 첫 단계 (경기는 항상 멈춘다) */
export function nextStep(game: GameState, from: FlowStep): FlowStep {
  const start = FLOW_STEPS.indexOf(from);
  for (let i = 1; i <= FLOW_STEPS.length; i++) {
    const step = FLOW_STEPS[(start + i) % FLOW_STEPS.length];
    if (stepHasWork(game, step)) return step;
  }
  return 'MATCH';
}

/** 단계 표시용 상태 */
export function stepStatus(game: GameState, step: FlowStep): 'todo' | 'done' | 'empty' {
  switch (step) {
    case 'MATCH':
      return 'todo';
    case 'EVENTS':
      return game.events.length === 0 ? 'empty' : unresolvedEvents(game).length ? 'todo' : 'done';
    case 'TRAINING':
      return game.interTurn.training ? 'done' : 'todo';
    case 'SHOP':
      return game.interTurn.purchasedItemId ? 'done' : shopOffers(game).length ? 'todo' : 'empty';
    case 'TRANSFER':
      return game.offers.length === 0 ? 'empty' : pendingOffers(game).length ? 'todo' : 'done';
  }
}
