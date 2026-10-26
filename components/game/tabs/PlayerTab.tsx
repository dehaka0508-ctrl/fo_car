'use client';

import { ATTRIBUTE_GROUP_LABELS, ATTRIBUTE_META } from '@/data/attributes';
import { SHOP_ITEM_MAP } from '@/data/items';
import { PLAYSTYLE_DEFINITIONS } from '@/data/playstyles';
import { roleWeights } from '@/engine/growth';
import { rankPlayStyleFit } from '@/engine/ovr';
import { ATTRIBUTE_KEYS, type AttributeGroup, type AttributeKey, type GameState } from '@/types/game';
import { Card, Stat, Tag } from '../ui';

export function PlayerTab({ game }: { game: GameState }) {
  const { player } = game;
  const isGK = player.profile.role.position === 'GK';
  const weights = roleWeights(player);
  const fits = rankPlayStyleFit(player.attributes, player.profile.role.position);
  const groups = new Map<AttributeGroup, AttributeKey[]>();
  for (const key of ATTRIBUTE_KEYS) {
    const group = ATTRIBUTE_META[key].group;
    if (group === 'GOALKEEPING' && !isGK) continue;
    groups.set(group, [...(groups.get(group) ?? []), key]);
  }
  const shields = Object.entries(player.agingShields).filter(([, v]) => (v ?? 0) > 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card title={`세부 능력치 · OVR ${player.ovr}`}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...groups.entries()].map(([group, keys]) => (
            <div key={group}>
              <h3 className="mb-2 text-xs font-bold text-emerald-300">{ATTRIBUTE_GROUP_LABELS[group]}</h3>
              <ul className="flex flex-col gap-2">
                {keys.map((key) => (
                  <li key={key} className="flex items-center gap-2 text-xs">
                    <span className="w-16 shrink-0 text-zinc-700 dark:text-zinc-300">
                      {ATTRIBUTE_META[key].label}
                      {(weights[key] ?? 0) >= 0.7 ? <span className="ml-0.5 text-emerald-600">●</span> : null}
                    </span>
                    <span className="px-meter mx-[2px] flex-1">
                      <span
                        className={player.attributes[key] >= 80 ? 'bg-amber-400' : player.attributes[key] >= 60 ? 'bg-emerald-400' : 'bg-sky-500'}
                        style={{ width: `${player.attributes[key]}%` }}
                      />
                    </span>
                    <span className="font-pixel w-6 text-right tabular-nums text-zinc-50">{player.attributes[key]}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-zinc-500">● 현재 포지션·스타일의 핵심 능력치 (OVR 가중치 상위)</p>
      </Card>

      <div className="flex flex-col gap-4">
        <Card title="스타일 적합도">
          <ul className="flex flex-col gap-1 text-sm">
            {fits.map((fit) => (
              <li key={fit.playStyle} className="flex justify-between">
                <span className={fit.playStyle === player.profile.role.playStyle ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'}>
                  {PLAYSTYLE_DEFINITIONS[fit.playStyle].label}
                </span>
                <span className="tabular-nums">{fit.ovr}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="몸 상태">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="키" value={`${player.profile.heightCm}cm`} />
            <Stat label="몸무게" value={`${player.weightKg}kg`} />
            <Stat label="체력" value={Math.round(player.condition)} />
            <Stat label="멘탈" value={Math.round(player.mental)} />
          </div>
          {player.growthFocus ? (
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
              육성 보너스: {ATTRIBUTE_GROUP_LABELS[player.growthFocus.category]} 훈련 ×{player.growthFocus.multiplier} ({player.growthFocus.remainingTurns}턴 남음)
            </p>
          ) : null}
          {shields.length ? (
            <p className="mt-2 text-xs text-violet-700 dark:text-violet-400">
              노화 방어: {shields.map(([k, v]) => `${ATTRIBUTE_META[k as AttributeKey].label} ${v}`).join(', ')}
            </p>
          ) : null}
        </Card>
        <Card title={`보유 아이템 (${player.inventory.length})`}>
          {player.inventory.length ? (
            <div className="flex flex-wrap gap-1">
              {player.inventory.map((owned) => (
                <Tag key={owned.itemId} tone={owned.effect.mode === 'BOOST' ? 'emerald' : 'violet'}>
                  {SHOP_ITEM_MAP[owned.itemId]?.name}
                </Tag>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">아직 산 물건이 없다.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
