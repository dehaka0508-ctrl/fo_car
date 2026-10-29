/**
 * 턴 사이 페이즈
 *
 * 턴이 끝나면 다음 턴 전까지 플레이어는
 *  - 훈련 1회 (engine/growth.ts)
 *  - 물품 구매 1회 (engine/shop.ts) — 진열은 잔고로 살 수 있는 물건 중 무작위 3개
 *  - 사건 1~3개 응답 (engine/events.ts) — 모두 답해야 다음 턴 진행
 *  - 이적·임대·재계약 협상 (engine/transfer.ts)
 * 을 할 수 있다. 이 모듈은 페이즈 시작(자연 회복·사건 생성)과 진행 가능 여부를 담당한다.
 */
import type { GameState, ShopItemDefinition, TrainingPlan, TurnPhase } from '@/types/game';
import { eventTurnIndex, rollEvents } from './events';
import { applyTraining } from './growth';
import { clamp, rngFor } from './rng';
import { canPurchase, purchaseItem } from './shop';
import { SHOP_ITEM_MAP, SHOP_ITEMS } from '@/data/items';
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
  const events = rollEvents(next, world, completedPhase, rng);
  const eventHistory = { ...state.eventHistory };
  const turnIndex = eventTurnIndex(state);
  // Seed cooldowns for events still present in an older save.
  for (const event of state.events) {
    eventHistory[event.definitionId] ??= { count: 1, lastTurn: turnIndex - 1 };
  }
  for (const event of events) {
    eventHistory[event.definitionId] = { count: (eventHistory[event.definitionId]?.count ?? 0) + 1, lastTurn: turnIndex };
  }
  return { ...next, events, eventHistory };
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

/** 상점에 한 번에 진열하는 물건 수 */
export const SHOP_OFFER_COUNT = 3;

/**
 * 이번 턴 상점 진열: 지금 잔고로 살 수 있는 물건 중 무작위 3개.
 * 순서는 (시드 · 시즌 · 턴)으로 고정해 같은 턴에는 다시 열어도 같은 물건이 나온다.
 */
export function shopOffers(state: GameState): ShopItemDefinition[] {
  const rng = rngFor(state.seed, 'shop-offers', state.turn.season, state.turn.phase);
  const { player } = state;
  return rng
    .shuffle(SHOP_ITEMS)
    .filter((item) => item.price <= player.money)
    .slice(0, SHOP_OFFER_COUNT);
}

export function buyInterTurn(state: GameState, itemId: string): GameState {
  if (state.stage !== 'READY') throw new Error('지금은 구매할 수 없습니다.');
  if (state.interTurn.purchasedItemId === null && !shopOffers(state).some((item) => item.id === itemId)) {
    throw new Error('이번 턴 상점에 진열되지 않은 물건입니다.');
  }
  const item = SHOP_ITEM_MAP[itemId];
  const check = canPurchase(state.player, item, state.interTurn.purchasedItemId !== null);
  if (!check.ok) throw new Error(check.reason);
  const rng = rngFor(state.seed, 'shop', state.turn.season, state.turn.phase, itemId);
  const { player } = purchaseItem(state.player, itemId, state.turn, rng);
  return { ...state, player, interTurn: { ...state.interTurn, purchasedItemId: itemId } };
}
