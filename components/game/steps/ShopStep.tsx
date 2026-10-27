'use client';

import { ATTRIBUTE_META } from '@/data/attributes';
import { SHOP_ITEM_MAP } from '@/data/items';
import { shopOffers } from '@/engine/interTurn';
import { SHOP_CONFIG } from '@/engine/shop';
import { formatMoney } from '@/engine/state';
import { useGameStore } from '@/store/gameStore';
import type { GameState, ItemCategory } from '@/types/game';
import { Button, Tag } from '../ui';

const CATEGORY_LABELS: Record<ItemCategory, string> = {
  EQUIPMENT: '장비',
  FASHION: '패션',
  HOUSE: '집',
  SUPERCAR: '차',
  WELLNESS: '웰니스',
};

/** 4단계: 물건 구매 — 이번 턴 진열(잔고로 살 수 있는 무작위 3개) 중 1개 */
export function ShopStep({ game }: { game: GameState }) {
  const buy = useGameStore((s) => s.buy);
  const { player } = game;
  const bought = game.interTurn.purchasedItemId;

  if (bought) {
    const item = SHOP_ITEM_MAP[bought];
    return <p className="text-sm text-zinc-200">이번 턴에는 이미 {item.name}을(를) 샀습니다.</p>;
  }

  const items = shopOffers(game);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] text-zinc-400">
        자산 <b className="font-pixel text-amber-300">{formatMoney(player.money)}</b> · 턴당 1개 구매
      </p>
      {items.length ? (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const maintaining = player.age >= SHOP_CONFIG.shieldAge;
            return (
              <div key={item.id} className="px-inset m-[2px] flex flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-bold text-zinc-50">{item.name}</p>
                  <Tag>{CATEGORY_LABELS[item.category]}</Tag>
                </div>
                <p className="text-[11px] text-zinc-400">{item.description}</p>
                <div className="flex flex-wrap gap-1">
                  <Tag tone="sky">{ATTRIBUTE_META[item.attribute].label}</Tag>
                  <Tag tone={maintaining ? 'violet' : 'emerald'}>{maintaining ? '기량 유지에 도움' : '성장에 도움'}</Tag>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span className="font-pixel text-xs text-amber-300">{formatMoney(item.price)}</span>
                  <Button variant="primary" onClick={() => buy(item.id)}>
                    구매
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="px-inset m-[2px] p-3 text-sm text-zinc-300">지금 자산으로 살 수 있는 물건이 없습니다. 다음 턴을 기다리세요.</p>
      )}
    </div>
  );
}
