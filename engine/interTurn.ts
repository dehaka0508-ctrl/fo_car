/**
 * 턴 사이 페이즈
 *
 * 턴이 끝나면 다음 턴 전까지 플레이어는
 *  - 훈련 1회 (engine/growth.ts)
 *  - 물품 구매 1회 (engine/shop.ts)
 *  - 사건 1~3개 응답 (engine/events.ts) — 모두 답해야 다음 턴 진행
 *  - 이적·임대·재계약 협상 (engine/transfer.ts)
 * 을 할 수 있다. 이 모듈은 페이즈 시작(자연 회복·사건 생성)과 진행 가능 여부를 담당한다.
 */
import type { GameState, TrainingPlan, TurnPhase } from '@/types/game';
import { rollEvents } from './events';
import { applyTraining } from './growth';
import { clamp, rngFor } from './rng';
import { canPurchase, purchaseItem } from './shop';
import { SHOP_ITEM_MAP } from '@/data/items';
import type { SimulationWorld } from './world';

/** 턴 사이 자연 회복량 (방금 끝난 턴 기준) */
export const INTER_TURN_RECOVERY: Record<TurnPhase, number> = {
  FIRST_HALF: 15, // 겨울 휴식기
  SECOND_HALF: 20, // 시즌 종료 직후
  PRESEASON: 25, // 새 시즌 개막 전
};

/**
 * 새 시즌 시작 체력.
 * 프리시즌 휴가 계획에서 '휴식'을 골랐고 그해 여름 대표팀 차출이 없었다면 100으로 시작한다.
 */
export function seasonStartCondition(endCondition: number, restChosen: boolean, nationalDuty: boolean): number {
  if (restChosen && !nationalDuty) return 100;
  return clamp(endCondition + INTER_TURN_RECOVERY.PRESEASON, 0, 100);
}

/**
 * 턴 사이 페이즈를 시작한다: 자연 회복, 육성 방향 보너스 차감, 사건 생성, 협상 횟수 초기화.
 * 시즌 시작 체력(프리시즌 직후)은 seasonEnd가 먼저 계산해 둔다.
 */
export function beginInterTurn(state: GameState, world: SimulationWorld, completedPhase: TurnPhase): GameState {
  const { player } = state;
  const condition =
    completedPhase === 'PRESEASON'
      ? player.condition
      : clamp(player.condition + INTER_TURN_RECOVERY[completedPhase], 0, 100);
  const growthFocus =
    player.growthFocus && player.growthFocus.remainingTurns > 1
      ? { ...player.growthFocus, remainingTurns: player.growthFocus.remainingTurns - 1 }
      : null;

  const next: GameState = {
    ...state,
    player: { ...player, condition, growthFocus },
    interTurn: { training: null, purchasedItemId: null },
    negotiation: { counterOffersUsed: 0, renewalRequested: false, log: [] },
  };
  const rng = rngFor(state.seed, 'events', state.turn.season, state.turn.phase, completedPhase);
  return { ...next, events: rollEvents(next, world, completedPhase, rng) };
}

export function interTurnBlockers(state: GameState): string[] {
  const blockers: string[] = [];
  const unresolved = state.events.filter((e) => !e.resolution).length;
  if (unresolved) blockers.push(`답하지 않은 사건 ${unresolved}개`);
  return blockers;
}

export function trainInterTurn(state: GameState, plan: TrainingPlan): GameState {
  if (state.stage !== 'READY') throw new Error('지금은 훈련할 수 없습니다.');
  if (state.interTurn.training) throw new Error('이번 턴에는 이미 훈련했습니다.');
  const rng = rngFor(state.seed, 'training', state.turn.season, state.turn.phase);
  const { player, result } = applyTraining(state.player, plan, rng);
  return { ...state, player, interTurn: { ...state.interTurn, training: result } };
}

export function buyInterTurn(state: GameState, itemId: string): GameState {
  if (state.stage !== 'READY') throw new Error('지금은 구매할 수 없습니다.');
  const item = SHOP_ITEM_MAP[itemId];
  const check = canPurchase(state.player, item, state.interTurn.purchasedItemId !== null);
  if (!check.ok) throw new Error(check.reason);
  const rng = rngFor(state.seed, 'shop', state.turn.season, state.turn.phase, itemId);
  const { player } = purchaseItem(state.player, itemId, state.turn, rng);
  return { ...state, player, interTurn: { ...state.interTurn, purchasedItemId: itemId } };
}
