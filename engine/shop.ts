/**
 * 상점 (턴 사이 1회 구매)
 *
 * 아이템 효과 = 세부 능력치 1개
 *  - 30세 이하: 상승. 상승량 = min(baseBoost × 나이 보정, 같은 능력치 훈련 1회 기대 상승량)
 *    → 가장 비싼 아이템도 훈련 1회를 넘지 못하고, 나이가 들수록 줄어든다.
 *  - 31세 이상: 상승 없음. 다음 시즌 노화 하락을 baseBoost만큼 막아 준다 (유지 또는 감소폭 완화).
 */
import { SHOP_ITEM_MAP, SHOP_ITEMS } from '@/data/items';
import type { OwnedItem, PlayerState, ShopItemDefinition, TurnPointer } from '@/types/game';
import { expectedTrainingGain, stochasticRound } from './growth';
import { calculateOVR } from './ovr';
import { clamp, type Rng } from './rng';

export const SHOP_CONFIG = {
  /** 이 나이까지 baseBoost를 온전히 받는다 */
  fullBoostAge: 20,
  /** 이 나이부터는 상승 대신 노화 방어 */
  shieldAge: 31,
} as const;

export type ItemEffectPreview =
  | { mode: 'BOOST'; expected: number }
  | { mode: 'SHIELD'; amount: number };

export function itemAgeFactor(age: number): number {
  const { fullBoostAge, shieldAge } = SHOP_CONFIG;
  return clamp((shieldAge - age) / (shieldAge - fullBoostAge), 0, 1);
}

export function previewItemEffect(player: PlayerState, item: ShopItemDefinition): ItemEffectPreview {
  if (player.age >= SHOP_CONFIG.shieldAge) return { mode: 'SHIELD', amount: item.baseBoost };
  const byAge = item.baseBoost * itemAgeFactor(player.age);
  const trainingCap = expectedTrainingGain(player, item.attribute);
  // 반올림하면 훈련 1회 상한을 근소하게 넘을 수 있으므로 내림한다
  return { mode: 'BOOST', expected: Math.floor(Math.min(byAge, trainingCap) * 10) / 10 };
}

export interface PurchaseCheck {
  ok: boolean;
  reason?: string;
}

export function canPurchase(
  player: PlayerState,
  item: ShopItemDefinition,
  alreadyPurchasedThisTurn: boolean,
): PurchaseCheck {
  if (alreadyPurchasedThisTurn) return { ok: false, reason: '이번 턴에는 이미 물건을 샀습니다.' };
  if (player.money < item.price) return { ok: false, reason: '돈이 부족합니다.' };
  return { ok: true };
}

export function purchaseItem(
  player: PlayerState,
  itemId: string,
  turn: TurnPointer,
  rng: Rng,
): { player: PlayerState; owned: OwnedItem } {
  const item = SHOP_ITEM_MAP[itemId];
  if (!item) throw new Error(`알 수 없는 아이템: ${itemId}`);
  const preview = previewItemEffect(player, item);
  let next: PlayerState = { ...player, money: player.money - item.price };
  let owned: OwnedItem;

  if (preview.mode === 'SHIELD') {
    next = {
      ...next,
      agingShields: {
        ...next.agingShields,
        [item.attribute]: (next.agingShields[item.attribute] ?? 0) + preview.amount,
      },
    };
    owned = { itemId, purchasedAt: turn, effect: { mode: 'SHIELD', amount: preview.amount } };
  } else {
    const amount = stochasticRound(rng, preview.expected);
    const attributes = { ...next.attributes, [item.attribute]: clamp(next.attributes[item.attribute] + amount, 1, 99) };
    next = { ...next, attributes, ovr: calculateOVR(attributes, next.profile.role) };
    owned = { itemId, purchasedAt: turn, effect: { mode: 'BOOST', amount } };
  }
  return { player: { ...next, inventory: [...next.inventory, owned] }, owned };
}

export { SHOP_ITEMS };
