'use client';

import { useState } from 'react';
import { ATTRIBUTE_GROUP_LABELS, ATTRIBUTE_META, CATEGORY_ATTRIBUTES, GOALKEEPING_ATTRIBUTES } from '@/data/attributes';
import { previewTraining, roleWeights, validateTrainingPlan } from '@/engine/growth';
import { useGameStore } from '@/store/gameStore';
import { STAT_CATEGORIES, type AttributeGroup, type AttributeKey, type GameState, type TrainingIntensity, type TrainingPlan } from '@/types/game';
import { Button, cx, signed, Tag } from '../ui';

type PlanKind = TrainingPlan['kind'];

const KIND_LABELS: Record<PlanKind, { label: string; hint: string }> = {
  FOCUSED: { label: '세부', hint: '세부 능력치 2~3개를 집중해서 올립니다.' },
  CATEGORY: { label: '영역', hint: '큰 영역 1개(세부 3개)를 고르게 조금씩 올립니다.' },
  BULK_UP: { label: '벌크업', hint: '몸무게↑ 몸싸움·제공권↑ / 가속력·민첩성↓' },
  CUT: { label: '감량', hint: '몸무게↓ 가속력·민첩성↑ / 몸싸움·제공권↓' },
  REST: { label: '휴식', hint: '체력을 회복하고 멘탈을 다잡습니다.' },
};

const INTENSITY_LABELS: Record<TrainingIntensity, string> = { LIGHT: '가볍게', NORMAL: '보통', INTENSE: '강하게' };

function Segment<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cx(
            'px-btn m-[2px] px-3 py-1.5 text-xs font-bold',
            value === key ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** 3단계: 훈련 (턴당 1회) */
export function TrainingStep({ game }: { game: GameState }) {
  const train = useGameStore((s) => s.train);
  const { player } = game;
  const isGK = player.profile.role.position === 'GK';
  const weights = roleWeights(player);
  const suggested = (Object.entries(weights) as Array<[AttributeKey, number]>).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
  const [kind, setKind] = useState<PlanKind>('FOCUSED');
  const [category, setCategory] = useState<AttributeGroup>(isGK ? 'GOALKEEPING' : 'SHOOTING');
  const [intensity, setIntensity] = useState<TrainingIntensity>('NORMAL');
  const [focused, setFocused] = useState<AttributeKey[]>(suggested);
  const done = game.interTurn.training;

  if (done) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-zinc-200">이번 턴에는 이미 훈련했습니다 ({KIND_LABELS[done.plan.kind].label}).</p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(done.deltas).map(([key, delta]) => (
            <Tag key={key} tone={(delta ?? 0) >= 0 ? 'emerald' : 'rose'}>
              {ATTRIBUTE_META[key as AttributeKey].label} {signed(delta ?? 0)}
            </Tag>
          ))}
          <Tag tone={done.conditionDelta >= 0 ? 'emerald' : 'amber'}>체력 {signed(done.conditionDelta)}</Tag>
        </div>
      </div>
    );
  }

  const plan: TrainingPlan =
    kind === 'REST' ? { kind } : kind === 'CATEGORY' ? { kind, category, intensity } : kind === 'FOCUSED' ? { kind, attributes: focused, intensity } : { kind, intensity };
  const invalid = validateTrainingPlan(plan);
  const preview = invalid ? null : previewTraining(player, plan);
  const groups: Array<[AttributeGroup, readonly AttributeKey[]]> = [
    ...STAT_CATEGORIES.map((c) => [c, CATEGORY_ATTRIBUTES[c]] as [AttributeGroup, readonly AttributeKey[]]),
    ...(isGK ? [['GOALKEEPING', GOALKEEPING_ATTRIBUTES] as [AttributeGroup, readonly AttributeKey[]]] : []),
  ];
  const toggle = (key: AttributeKey) =>
    setFocused((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : cur.length >= 3 ? cur : [...cur, key]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Segment value={kind} onChange={setKind} options={(Object.keys(KIND_LABELS) as PlanKind[]).map((k) => [k, KIND_LABELS[k].label])} />
        <p className="text-[11px] text-zinc-400">{KIND_LABELS[kind].hint}</p>
      </div>

      {kind === 'FOCUSED' || kind === 'CATEGORY' ? (
        <div className="grid grid-cols-3 gap-x-3 gap-y-2 xl:grid-cols-6">
          {groups.map(([group, keys]) => (
            <div key={group}>
              {kind === 'CATEGORY' ? (
                <button
                  type="button"
                  onClick={() => setCategory(group)}
                  className={cx('px-focus mb-1 text-[11px] font-bold', category === group ? 'text-amber-300' : 'text-emerald-300 hover:text-emerald-200')}
                >
                  {category === group ? '▶ ' : ''}
                  {ATTRIBUTE_GROUP_LABELS[group]}
                </button>
              ) : (
                <p className="mb-1 text-[11px] font-bold text-emerald-300">{ATTRIBUTE_GROUP_LABELS[group]}</p>
              )}
              <div className="flex flex-col gap-1">
                {keys.map((key) => {
                  const on = kind === 'FOCUSED' ? focused.includes(key) : category === group;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => (kind === 'FOCUSED' ? toggle(key) : setCategory(group))}
                      className={cx(
                        'px-focus flex items-center justify-between gap-1 px-1.5 py-1 text-left text-[11px]',
                        on ? 'bg-emerald-900/70 text-zinc-50 shadow-[inset_0_0_0_1px_#44d17a]' : 'bg-zinc-950/60 text-zinc-300 hover:bg-zinc-800',
                      )}
                    >
                      <span className="truncate">
                        {ATTRIBUTE_META[key].label}
                        {(weights[key] ?? 0) >= 0.7 ? <span className="text-amber-300">★</span> : null}
                      </span>
                      <span className="font-pixel tabular-nums">{player.attributes[key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {kind !== 'REST' ? (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-zinc-400">강도</span>
          <Segment value={intensity} onChange={setIntensity} options={(Object.keys(INTENSITY_LABELS) as TrainingIntensity[]).map((i) => [i, INTENSITY_LABELS[i]])} />
        </div>
      ) : null}

      <div className="px-inset m-[2px] flex flex-wrap items-center gap-1 p-2 text-[11px]">
        <span className="mr-1 text-zinc-400">예상</span>
        {preview ? (
          <>
            {Object.entries(preview.gains).map(([key, gain]) => (
              <Tag key={key} tone={(gain ?? 0) >= 0 ? 'emerald' : 'rose'}>
                {ATTRIBUTE_META[key as AttributeKey].label} {signed(gain ?? 0, 1)}
              </Tag>
            ))}
            <Tag tone={preview.conditionDelta >= 0 ? 'emerald' : 'amber'}>
              체력 {signed(preview.conditionDelta)} (지금 {Math.round(player.condition)})
            </Tag>
            {preview.mentalDelta ? <Tag tone="violet">멘탈 {signed(preview.mentalDelta)}</Tag> : null}
            {preview.weightDelta ? <Tag tone="sky">몸무게 {signed(preview.weightDelta, 1)}kg</Tag> : null}
          </>
        ) : (
          <span className="text-rose-300">{invalid}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="primary" className="px-6 py-2.5" disabled={Boolean(invalid)} onClick={() => train(plan)}>
          {kind === 'REST' ? '휴식하기' : '훈련하기'}
        </Button>
        {player.growthFocus ? (
          <span className="text-[11px] text-emerald-300">
            육성 보너스 {ATTRIBUTE_GROUP_LABELS[player.growthFocus.category]} ×{player.growthFocus.multiplier} ({player.growthFocus.remainingTurns}턴)
          </span>
        ) : null}
      </div>
    </div>
  );
}
