'use client';

import { useState } from 'react';
import { ATTRIBUTE_GROUP_LABELS, ATTRIBUTE_META, CATEGORY_ATTRIBUTES, GOALKEEPING_ATTRIBUTES } from '@/data/attributes';
import { previewTraining, roleWeights, validateTrainingPlan } from '@/engine/growth';
import { useGameStore } from '@/store/gameStore';
import { STAT_CATEGORIES, type AttributeGroup, type AttributeKey, type GameState, type TrainingIntensity, type TrainingPlan } from '@/types/game';
import { Button, Card, cx, Field, fieldClass, signed, Tag } from '../ui';

type PlanKind = TrainingPlan['kind'];

const KIND_LABELS: Record<PlanKind, { label: string; hint: string }> = {
  CATEGORY: { label: '카테고리 훈련', hint: '큰 영역 1개(세부 3개)를 소폭 올립니다.' },
  FOCUSED: { label: '세부 훈련', hint: '세부 능력치 2~3개를 집중해서 올립니다.' },
  BULK_UP: { label: '벌크업', hint: '몸무게↑ 몸싸움·제공권↑ / 가속력·민첩성↓' },
  CUT: { label: '감량', hint: '몸무게↓ 가속력·민첩성↑ / 몸싸움·제공권↓' },
  REST: { label: '휴식', hint: '체력을 회복하고 멘탈을 다잡습니다.' },
};

const INTENSITY_LABELS: Record<TrainingIntensity, string> = { LIGHT: '가볍게', NORMAL: '보통', INTENSE: '강하게' };

export function TrainingTab({ game }: { game: GameState }) {
  const train = useGameStore((s) => s.train);
  const { player } = game;
  const isGK = player.profile.role.position === 'GK';
  const [kind, setKind] = useState<PlanKind>('FOCUSED');
  const [category, setCategory] = useState<AttributeGroup>(isGK ? 'GOALKEEPING' : 'SHOOTING');
  const [intensity, setIntensity] = useState<TrainingIntensity>('NORMAL');
  const weights = roleWeights(player);
  const suggested = (Object.entries(weights) as Array<[AttributeKey, number]>).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
  const [focused, setFocused] = useState<AttributeKey[]>(suggested);

  const plan: TrainingPlan =
    kind === 'REST'
      ? { kind: 'REST' }
      : kind === 'CATEGORY'
        ? { kind, category, intensity }
        : kind === 'FOCUSED'
          ? { kind, attributes: focused, intensity }
          : { kind, intensity };
  const invalid = validateTrainingPlan(plan);
  const preview = invalid ? null : previewTraining(player, plan);
  const done = game.interTurn.training;
  const attributeGroups: Array<[AttributeGroup, readonly AttributeKey[]]> = [
    ...STAT_CATEGORIES.map((c) => [c, CATEGORY_ATTRIBUTES[c]] as [AttributeGroup, readonly AttributeKey[]]),
    ...(isGK ? [['GOALKEEPING', GOALKEEPING_ATTRIBUTES] as [AttributeGroup, readonly AttributeKey[]]] : []),
  ];

  const toggle = (key: AttributeKey) =>
    setFocused((current) => (current.includes(key) ? current.filter((k) => k !== key) : current.length >= 3 ? current : [...current, key]));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card title="이번 턴 훈련 (1회)">
        {done ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">{KIND_LABELS[done.plan.kind].label} 완료</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(done.deltas).map(([key, delta]) => (
                <Tag key={key} tone={(delta ?? 0) >= 0 ? 'emerald' : 'rose'}>
                  {ATTRIBUTE_META[key as AttributeKey].label} {signed(delta ?? 0)}
                </Tag>
              ))}
              {Object.keys(done.deltas).length === 0 && done.plan.kind !== 'REST' ? <Tag>이번에는 눈에 띄는 변화가 없었다</Tag> : null}
              <Tag tone={done.conditionDelta >= 0 ? 'emerald' : 'amber'}>체력 {signed(done.conditionDelta)}</Tag>
              {done.weightDelta ? <Tag tone="sky">몸무게 {signed(done.weightDelta, 1)}kg</Tag> : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(Object.keys(KIND_LABELS) as PlanKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={cx(
                    'rounded-lg border p-2 text-left text-sm transition-colors',
                    kind === k ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700',
                  )}
                >
                  <span className="block font-semibold text-zinc-900 dark:text-zinc-100">{KIND_LABELS[k].label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500">{KIND_LABELS[kind].hint}</p>

            {kind === 'CATEGORY' ? (
              <Field label="영역">
                <select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value as AttributeGroup)}>
                  {attributeGroups.map(([group]) => (
                    <option key={group} value={group}>
                      {ATTRIBUTE_GROUP_LABELS[group]}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {kind === 'FOCUSED' ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {attributeGroups.map(([group, keys]) => (
                  <div key={group}>
                    <p className="mb-1 text-xs font-semibold text-zinc-500">{ATTRIBUTE_GROUP_LABELS[group]}</p>
                    {keys.map((key) => (
                      <label key={key} className="flex items-center gap-2 py-0.5 text-sm text-zinc-800 dark:text-zinc-200">
                        <input type="checkbox" checked={focused.includes(key)} onChange={() => toggle(key)} />
                        {ATTRIBUTE_META[key].label}
                        <span className="tabular-nums text-xs text-zinc-500">{player.attributes[key]}</span>
                        {(weights[key] ?? 0) >= 0.7 ? <span className="text-[10px] text-emerald-600">핵심</span> : null}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}

            {kind !== 'REST' ? (
              <Field label="강도" className="max-w-xs">
                <select className={fieldClass} value={intensity} onChange={(e) => setIntensity(e.target.value as TrainingIntensity)}>
                  {(Object.keys(INTENSITY_LABELS) as TrainingIntensity[]).map((i) => (
                    <option key={i} value={i}>
                      {INTENSITY_LABELS[i]}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" disabled={Boolean(invalid)} onClick={() => train(plan)}>
                훈련하기
              </Button>
              {invalid ? <span className="text-xs text-rose-600">{invalid}</span> : null}
            </div>
          </div>
        )}
      </Card>

      <Card title="예상 효과">
        {preview && !done ? (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex flex-wrap gap-1">
              {Object.entries(preview.gains).map(([key, gain]) => (
                <Tag key={key} tone={(gain ?? 0) >= 0 ? 'emerald' : 'rose'}>
                  {ATTRIBUTE_META[key as AttributeKey].label} {signed(gain ?? 0, 1)}
                </Tag>
              ))}
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              체력 {signed(preview.conditionDelta)} (현재 {Math.round(player.condition)}){preview.mentalDelta ? ` · 멘탈 ${signed(preview.mentalDelta)}` : ''}
              {preview.weightDelta ? ` · 몸무게 ${signed(preview.weightDelta, 1)}kg` : ''}
            </p>
            <p className="text-[11px] text-zinc-500">
              소수점은 기대값입니다. 나이가 어릴수록, 현재 수치가 낮을수록 많이 오릅니다.
              {player.growthFocus ? ` 육성 보너스: ${ATTRIBUTE_GROUP_LABELS[player.growthFocus.category]} ×${player.growthFocus.multiplier} (${player.growthFocus.remainingTurns}턴)` : ''}
            </p>
            {player.condition + preview.conditionDelta < 40 ? (
              <p className="text-xs text-amber-600">체력이 40 아래로 떨어지면 경기 출전이 줄어듭니다.</p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">{done ? '다음 턴이 끝나면 다시 훈련할 수 있습니다.' : '훈련 계획을 골라 주세요.'}</p>
        )}
      </Card>
    </div>
  );
}
