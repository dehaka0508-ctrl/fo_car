'use client';

import { useState } from 'react';
import { ATTRIBUTE_META } from '@/data/attributes';
import { SHOP_ITEMS } from '@/data/items';
import { canPurchase, previewItemEffect, SHOP_CONFIG } from '@/engine/shop';
import { formatMoney } from '@/engine/state';
import { useGameStore } from '@/store/gameStore';
import type { GameState, ItemCategory } from '@/types/game';
import { Button, Card, cx, Tag } from '../ui';

const CATEGORY_LABELS: Record<ItemCategory | 'ALL', string> = {
  ALL: '전체',
  EQUIPMENT: '장비',
  FASHION: '패션',
  HOUSE: '집',
  SUPERCAR: '차',
  WELLNESS: '웰니스',
};

export function ShopTab({ game }: { game: GameState }) {
  const buy = useGameStore((s) => s.buy);
  const [filter, setFilter] = useState<ItemCategory | 'ALL'>('ALL');
  const { player } = game;
  const bought = game.interTurn.purchasedItemId;
  const items = SHOP_ITEMS.filter((item) => filter === 'ALL' || item.category === filter);

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={`상점 · 자산 ${formatMoney(player.money)}`}
        actions={<span className="text-xs text-zinc-500">{bought ? '이번 턴 구매 완료' : '턴 사이에 1개 구매 가능'}</span>}
      >
        <p className="mb-3 text-xs text-zinc-600 dark:text-zinc-400">
          아이템은 세부 능력치 1개만 올리며, 같은 능력치를 훈련 1회 했을 때보다 많이 오르지 않습니다. 나이가 들수록 효과가 줄고,{' '}
          {SHOP_CONFIG.shieldAge}세부터는 능력치를 올리는 대신 다음 시즌의 노화 하락을 막아 줍니다.
        </p>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(CATEGORY_LABELS) as Array<ItemCategory | 'ALL'>).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilter(c)}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-medium',
                filter === c ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
              )}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const owned = player.inventory.find((o) => o.itemId === item.id);
          const effect = previewItemEffect(player, item);
          const check = canPurchase(player, item, bought !== null);
          return (
            <Card key={item.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                  <p className="text-xs text-zinc-500">{item.description}</p>
                </div>
                <Tag>{CATEGORY_LABELS[item.category]}</Tag>
              </div>
              <div className="flex flex-wrap items-center gap-1 text-xs">
                <Tag tone="sky">{ATTRIBUTE_META[item.attribute].label}</Tag>
                {owned ? (
                  <Tag tone="emerald">
                    보유 · {owned.effect.mode === 'BOOST' ? `+${owned.effect.amount}` : `노화 방어 ${owned.effect.amount}`}
                  </Tag>
                ) : effect.mode === 'BOOST' ? (
                  <Tag tone={effect.expected >= 0.5 ? 'emerald' : 'zinc'}>예상 +{effect.expected.toFixed(1)}</Tag>
                ) : (
                  <Tag tone="violet">노화 방어 {effect.amount}</Tag>
                )}
              </div>
              <div className="mt-auto flex items-center justify-between">
                <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatMoney(item.price)}</span>
                <Button variant="primary" disabled={!check.ok} title={check.reason} onClick={() => buy(item.id)}>
                  {owned ? '보유 중' : '구매'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
