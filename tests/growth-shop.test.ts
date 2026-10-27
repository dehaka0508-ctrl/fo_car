import { describe, expect, it } from 'vitest';
import { SHOP_ITEMS } from '@/data/items';
import {
  applyMatchExperience,
  applySeasonalAging,
  applyTraining,
  applyTurnGrowth,
  expectedTrainingGain,
  GROWTH_GROUP,
  potentialFactor,
  previewTraining,
  roleWeights,
  turnGrowthRate,
  validateTrainingPlan,
} from '@/engine/growth';
import { emptyStatsByCompetition, potentialDistribution, rollPotential } from '@/engine/character';
import { ATTRIBUTE_KEYS, type AttributeKey } from '@/types/game';
import { rngFor } from '@/engine/rng';
import { canPurchase, previewItemEffect, purchaseItem } from '@/engine/shop';
import type { PlayerState, TrainingPlan } from '@/types/game';
import { makePlayer } from './helpers';

const rng = (salt: string) => rngFor(99, salt);
const atAge = (player: PlayerState, age: number): PlayerState => ({ ...player, age });

describe('훈련', () => {
  it('세부 훈련은 고른 능력치만 올리고 강도만큼 체력을 쓴다', () => {
    const player = makePlayer();
    const { player: after, result } = applyTraining(
      player,
      { kind: 'FOCUSED', attributes: ['finishing', 'offTheBall'], intensity: 'INTENSE' },
      rng('focused'),
    );
    expect(Object.keys(result.deltas).every((k) => k === 'finishing' || k === 'offTheBall')).toBe(true);
    expect(after.attributes.finishing).toBeGreaterThanOrEqual(player.attributes.finishing);
    expect(after.condition).toBe(player.condition - 20);
  });

  it('카테고리 훈련은 세부 3개를 소폭 올린다', () => {
    const preview = previewTraining(makePlayer(), { kind: 'CATEGORY', category: 'SPEED', intensity: 'NORMAL' });
    expect(Object.keys(preview.gains).sort()).toEqual(['acceleration', 'agility', 'sprintSpeed']);
    for (const gain of Object.values(preview.gains)) expect(gain).toBeGreaterThan(0);
  });

  it('어릴수록 훈련 효율이 높다', () => {
    const player = makePlayer();
    const plan: TrainingPlan = { kind: 'FOCUSED', attributes: ['finishing', 'offTheBall'], intensity: 'NORMAL' };
    expect(previewTraining(atAge(player, 17), plan).gains.finishing).toBeGreaterThan(previewTraining(atAge(player, 30), plan).gains.finishing!);
  });

  it('벌크업: 몸무게↑ 몸싸움·제공권↑ 가속력·민첩성↓ / 감량은 반대', () => {
    const player = makePlayer();
    const bulk = previewTraining(player, { kind: 'BULK_UP', intensity: 'NORMAL' });
    expect(bulk.weightDelta).toBeGreaterThan(0);
    expect(bulk.gains.strength).toBeGreaterThan(0);
    expect(bulk.gains.aerial).toBeGreaterThan(0);
    expect(bulk.gains.acceleration).toBeLessThan(0);
    expect(bulk.gains.agility).toBeLessThan(0);
    const cut = previewTraining(player, { kind: 'CUT', intensity: 'NORMAL' });
    expect(cut.weightDelta).toBeLessThan(0);
    expect(cut.gains.acceleration).toBeGreaterThan(0);
    expect(cut.gains.strength).toBeLessThan(0);
  });

  it('몸무게 한계에서는 더 벌크업되지 않는다', () => {
    const heavy = { ...makePlayer(), weightKg: 105 };
    const preview = previewTraining(heavy, { kind: 'BULK_UP', intensity: 'INTENSE' });
    expect(preview.weightDelta).toBe(0);
    expect(preview.gains.strength ?? 0).toBe(0);
  });

  it('휴식은 체력과 멘탈을 회복한다', () => {
    const tired = { ...makePlayer(), condition: 40 };
    expect(applyTraining(tired, { kind: 'REST' }, rng('rest')).player.condition).toBe(62);
  });

  it('잘못된 세부 훈련 계획은 거부한다', () => {
    expect(validateTrainingPlan({ kind: 'FOCUSED', attributes: ['finishing'], intensity: 'NORMAL' })).not.toBeNull();
    expect(validateTrainingPlan({ kind: 'FOCUSED', attributes: ['finishing', 'finishing'], intensity: 'NORMAL' })).not.toBeNull();
  });
});

describe('경험 성장과 노화', () => {
  it('출전 시간이 많을수록 더 많이 성장한다', () => {
    const player = makePlayer();
    const lots = emptyStatsByCompetition();
    lots.LEAGUE.minutes = 1800;
    const few = emptyStatsByCompetition();
    few.LEAGUE.minutes = 90;
    const sum = (d: object) => Object.values(d).reduce((s: number, v) => s + (v as number), 0);
    expect(sum(applyMatchExperience(player, lots, rng('exp')).deltas)).toBeGreaterThan(sum(applyMatchExperience(player, few, rng('exp')).deltas));
  });

  it('시즌 종료 시 나이가 1살 오르고, 어리면 성장·30대면 스피드가 떨어진다', () => {
    const young = applySeasonalAging(atAge(makePlayer(), 17), rng('young'));
    expect(young.player.age).toBe(18);
    expect(young.player.ovr).toBeGreaterThanOrEqual(makePlayer().ovr);

    const veteran = atAge(makePlayer({ boost: 30 }), 33);
    const aged = applySeasonalAging(veteran, rng('old'));
    expect(aged.player.attributes.sprintSpeed).toBeLessThan(veteran.attributes.sprintSpeed);
  });

  it('아이템 노화 방어는 하락을 줄이고 소모된다', () => {
    const veteran = atAge(makePlayer({ boost: 30 }), 33);
    const shielded = { ...veteran, agingShields: { sprintSpeed: 5 } };
    const plain = applySeasonalAging(veteran, rng('shield'));
    const defended = applySeasonalAging(shielded, rng('shield'));
    expect(defended.player.attributes.sprintSpeed).toBeGreaterThan(plain.player.attributes.sprintSpeed);
    expect(defended.shielded.sprintSpeed).toBeGreaterThan(0);
    expect(defended.player.agingShields).toEqual({});
  });
});

describe('숨은 포텐셜 · 매 턴 자연 성장', () => {
  it('포텐셜은 80~100 볼츠만 분포: 80이 가장 흔하고 높을수록 지수적으로 드물다', () => {
    const dist = potentialDistribution();
    expect(dist[0].potential).toBe(80);
    expect(dist.at(-1)!.potential).toBe(100);
    expect(dist.reduce((a, d) => a + d.probability, 0)).toBeCloseTo(1, 10);
    for (let i = 1; i < dist.length; i++) expect(dist[i].probability).toBeLessThan(dist[i - 1].probability);
    // 표본: 5000명
    const values = Array.from({ length: 5000 }, (_, i) => rollPotential(i + 1));
    const share = (f: (v: number) => boolean) => values.filter(f).length / values.length;
    expect(Math.min(...values)).toBeGreaterThanOrEqual(80);
    expect(Math.max(...values)).toBeLessThanOrEqual(100);
    expect(share((v) => v === 80)).toBeGreaterThan(0.15);
    expect(share((v) => v >= 90)).toBeGreaterThan(0.08);
    expect(share((v) => v >= 90)).toBeLessThan(0.16);
    expect(share((v) => v >= 95)).toBeLessThan(0.06);
    const mean = values.reduce((a, v) => a + v, 0) / values.length;
    expect(mean).toBeGreaterThan(83.5);
    expect(mean).toBeLessThan(85.5);
    expect(rollPotential(7)).toBe(rollPotential(7));
  });

  it('OVR이 포텐셜에 닿으면 훈련 · 경험 · 자연 성장이 멈춘다', () => {
    const capped = { ...makePlayer({ boost: 20 }), potential: 0 };
    capped.potential = capped.ovr;
    expect(potentialFactor(capped)).toBe(0);
    const preview = previewTraining(capped, { kind: 'FOCUSED', attributes: ['finishing', 'offTheBall'], intensity: 'NORMAL' });
    expect(Object.values(preview.gains).every((g) => (g ?? 0) <= 0)).toBe(true);
    expect(applyTurnGrowth(capped, rng('cap')).deltas).toEqual({});
  });

  it('매 턴 모든 능력치가 소폭 오르고 포지션 핵심 능력치가 더 오른다', () => {
    const player = { ...makePlayer(), potential: 95 };
    const weights = roleWeights(player);
    const total: Partial<Record<AttributeKey, number>> = {};
    let p = player;
    for (let i = 0; i < 6; i++) {
      const r = applyTurnGrowth(p, rng(`turn-${i}`));
      for (const [k, d] of Object.entries(r.deltas)) total[k as AttributeKey] = (total[k as AttributeKey] ?? 0) + (d ?? 0);
      p = { ...r.player, age: player.age };
    }
    const core = (Object.keys(weights) as AttributeKey[]).filter((k) => (weights[k] ?? 0) >= 0.7);
    const offRole = ATTRIBUTE_KEYS.filter((k) => !(k in weights) && !['reflexes', 'goalKick', 'gkPositioning', 'gkRange', 'organization', 'distribution'].includes(k));
    const avg = (keys: AttributeKey[]) => keys.reduce((s, k) => s + (total[k] ?? 0), 0) / keys.length;
    expect(avg(core)).toBeGreaterThan(avg(offRole));
    expect(avg(offRole)).toBeGreaterThan(0);
  });

  it('피지컬은 어릴 때 빨리 자라고 25세 무렵 멈추지만, 기술 · 멘탈은 그 뒤에도 자란다', () => {
    expect(turnGrowthRate('PHYSICAL', 17)).toBeGreaterThan(turnGrowthRate('TECHNICAL', 17));
    expect(turnGrowthRate('PHYSICAL', 27)).toBe(0);
    expect(turnGrowthRate('TECHNICAL', 28)).toBeGreaterThan(0);
    expect(turnGrowthRate('MENTAL', 30)).toBeGreaterThan(0);
    expect(GROWTH_GROUP.sprintSpeed).toBe('PHYSICAL');
    expect(GROWTH_GROUP.vision).toBe('MENTAL');
  });
});

describe('상점 밸런스', () => {
  it('어떤 아이템도 같은 능력치 훈련 1회 기대 상승량을 넘지 않는다', () => {
    for (const age of [16, 19, 23, 27, 30]) {
      for (const boost of [0, 20, 35]) {
        const player = atAge(makePlayer({ boost }), age);
        for (const item of SHOP_ITEMS) {
          const effect = previewItemEffect(player, item);
          if (effect.mode === 'BOOST') expect(effect.expected).toBeLessThanOrEqual(expectedTrainingGain(player, item.attribute) + 1e-9);
        }
      }
    }
  });

  it('상승량은 나이에 반비례하고 31세부터는 노화 방어로 바뀐다', () => {
    const item = SHOP_ITEMS.find((i) => i.id === 'mental-coach')!;
    const young = previewItemEffect(atAge(makePlayer(), 17), item);
    const mid = previewItemEffect(atAge(makePlayer(), 27), item);
    const old = previewItemEffect(atAge(makePlayer(), 32), item);
    expect(young.mode === 'BOOST' && mid.mode === 'BOOST' && young.expected > mid.expected).toBe(true);
    expect(old).toEqual({ mode: 'SHIELD', amount: item.baseBoost });
  });

  it('노장이 산 아이템은 노화 방어로 저장된다', () => {
    const item = SHOP_ITEMS.find((i) => i.id === 'altitude-room')!;
    const rich = { ...atAge(makePlayer(), 33), money: 10_000_000 };
    const { player, owned } = purchaseItem(rich, item.id, { season: 2040, phase: 'FIRST_HALF' }, rng('buy'));
    expect(owned.effect.mode).toBe('SHIELD');
    expect(player.agingShields.sprintSpeed).toBe(item.baseBoost);
    expect(player.money).toBe(10_000_000 - item.price);
    expect(player.attributes.sprintSpeed).toBe(rich.attributes.sprintSpeed);
  });

  it('턴당 1회, 같은 아이템은 한 번만, 돈이 있어야 살 수 있다', () => {
    const item = SHOP_ITEMS[0];
    const poor = { ...makePlayer(), money: 0 };
    expect(canPurchase(poor, item, false).ok).toBe(false);
    const rich = { ...makePlayer(), money: 1_000_000 };
    expect(canPurchase(rich, item, true).ok).toBe(false);
    const owner = purchaseItem(rich, item.id, { season: 2026, phase: 'FIRST_HALF' }, rng('own')).player;
    expect(canPurchase(owner, item, false).ok).toBe(false);
  });
});
