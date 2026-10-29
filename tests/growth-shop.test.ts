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
  fieldAttributeAverage,
  potentialProgress,
  previewTraining,
  roleWeights,
  turnGrowthRate,
  validateTrainingPlan,
} from '@/engine/growth';
import { emptyStatsByCompetition, potentialDistribution, rollPotential } from '@/engine/character';
import { ATTRIBUTE_KEYS, FIELD_STAT_KEYS, GK_STAT_KEYS, type AttributeKey } from '@/types/game';
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
  it('필드 선수는 80~100 볼츠만 분포, GK는 기존 80~100 분포를 유지한다', () => {
    for (const [position, min] of [['ST', 80], ['GK', 80]] as const) {
      const dist = potentialDistribution(position);
      expect(dist[0].potential).toBe(min);
      expect(dist.at(-1)!.potential).toBe(100);
      expect(dist.reduce((a, d) => a + d.probability, 0)).toBeCloseTo(1, 10);
      for (let i = 1; i < dist.length; i++) expect(dist[i].probability).toBeLessThan(dist[i - 1].probability);
      const values = Array.from({ length: 5000 }, (_, i) => rollPotential(i + 1, position));
      expect(Math.min(...values)).toBeGreaterThanOrEqual(min);
      expect(Math.max(...values)).toBeLessThanOrEqual(100);
      expect(values.reduce((sum, value) => sum + value, 0) / values.length).toBeGreaterThan(min + 3.5);
      expect(values.reduce((sum, value) => sum + value, 0) / values.length).toBeLessThan(min + 5.5);
    }
    expect([1, 2, 3, 7, 42, 999].map((seed) => rollPotential(seed, 'GK'))).toEqual([88, 91, 88, 84, 83, 82]);
    expect(makePlayer().potential).toBe(rollPotential(1, 'ST'));
    expect(makePlayer({ role: { position: 'GK', playStyle: 'SWEEPER_KEEPER' } }).potential).toBe(88);
  });

  it('필드 선수의 성장 한도는 OVR이나 GK 스탯이 아닌 18개 능력치의 반올림 없는 평균이다', () => {
    const player = { ...makePlayer(), potential: 60 };
    for (const key of FIELD_STAT_KEYS) player.attributes[key] = 60;
    player.attributes.finishing = 59;
    for (const key of GK_STAT_KEYS) player.attributes[key] = 99;
    player.ovr = 99;
    expect(fieldAttributeAverage(player.attributes)).toBeCloseTo(60 - 1 / 18, 10);
    expect(potentialFactor(player)).toBeGreaterThan(0);
    expect(potentialProgress({ ...player, profile: { ...player.profile, role: { position: 'CB', playStyle: 'STOPPER' } } })).toBe(potentialProgress(player));
    player.attributes.finishing = 60;
    player.ovr = 40;
    expect(potentialFactor(player)).toBe(0);
    expect(applyTurnGrowth(player, rng('cap')).deltas).toEqual({});
    expect(previewTraining(player, { kind: 'FOCUSED', attributes: ['finishing', 'offTheBall'], intensity: 'NORMAL' }).gains).toEqual({ finishing: 0, offTheBall: 0 });
    const stats = emptyStatsByCompetition(); stats.LEAGUE.minutes = 1800;
    expect(applyMatchExperience(player, stats, rng('capped-exp')).deltas).toEqual({});
    expect(previewItemEffect(player, SHOP_ITEMS[0])).toEqual({ mode: 'BOOST', expected: 0 });
  });

  it('GK는 기존 OVR 포텐셜 기준을 유지하며 초기 역할은 성장 계산에 영향을 주지 않는다', () => {
    const player = makePlayer({ role: { position: 'GK', playStyle: 'SWEEPER_KEEPER' } });
    const alternate = { ...player, profile: { ...player.profile, role: { position: 'GK' as const, playStyle: 'CLASSIC_GOALKEEPER' as const } } };
    expect(potentialProgress(player)).toBe(player.ovr);
    expect(potentialFactor({ ...player, potential: player.ovr })).toBe(0);
    expect(applyTurnGrowth(player, rng('gk-regression')).deltas).toEqual(applyTurnGrowth(alternate, rng('gk-regression')).deltas);
    const plan = { kind: 'FOCUSED' as const, attributes: ['reflexes' as const, 'gkPositioning' as const], intensity: 'NORMAL' as const };
    expect(previewTraining(player, plan)).toEqual(previewTraining(alternate, plan));
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

  it('턴당 1회, 같은 아이템도 다음 턴에 다시 살 수 있고 돈이 있어야 한다', () => {
    const item = SHOP_ITEMS[0];
    const poor = { ...makePlayer(), money: 0 };
    expect(canPurchase(poor, item, false).ok).toBe(false);
    const rich = { ...makePlayer(), money: 1_000_000 };
    expect(canPurchase(rich, item, true).ok).toBe(false);
    const owner = purchaseItem(rich, item.id, { season: 2026, phase: 'FIRST_HALF' }, rng('own')).player;
    expect(canPurchase(owner, item, false).ok).toBe(true);
  });
});


describe('베테랑의 능력치 재분배', () => {
  it('30~35세에 피지컬이 하락하면서 일부 기술·판단 능력은 오르고 평균 한도는 넘지 않는다', () => {
    for (const age of [29, 31, 33, 34]) {
      const veteran = { ...atAge(makePlayer(), age), potential: 80, attributes: { ...makePlayer().attributes } };
      for (const key of FIELD_STAT_KEYS) veteran.attributes[key] = 80;
      const result = applySeasonalAging(veteran, rng(`veteran-${age}`));
      expect(result.player.age).toBe(age + 1);
      expect(result.player.attributes.sprintSpeed).toBeLessThan(80);
      const positive = Object.entries(result.deltas).filter(([, value]) => (value ?? 0) > 0);
      expect(positive.length).toBeGreaterThan(0);
      expect(positive.length).toBeLessThanOrEqual(3);
      for (const [key] of positive) expect(['sprintSpeed', 'acceleration', 'agility', 'stamina', 'strength', 'aerial']).not.toContain(key);
      expect(fieldAttributeAverage(result.player.attributes)).toBeLessThanOrEqual(80);
      expect(result).toEqual(applySeasonalAging(JSON.parse(JSON.stringify(veteran)), rng(`veteran-${age}`)));
    }
  });

  it('36세 이후와 GK는 재분배 성장 없이 기존 노화만 적용된다', () => {
    const old = applySeasonalAging(atAge(makePlayer(), 35), rng('old-stop'));
    const keeper = applySeasonalAging(atAge(makePlayer({ role: { position: 'GK', playStyle: 'CLASSIC_GOALKEEPER' } }), 32), rng('gk-aging'));
    expect(Object.values(old.deltas).some((value) => (value ?? 0) > 0)).toBe(false);
    expect(Object.values(keeper.deltas).some((value) => (value ?? 0) > 0)).toBe(false);
  });
});
