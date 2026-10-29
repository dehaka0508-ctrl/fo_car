/** 재현 가능한 OVR 집중 성장 감사: 50개의 독립 시드, 5개 필드 포지션, 16~38세. */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { GAME_EVENT_MAP } from '@/data/events';
import { CATEGORY_ATTRIBUTES } from '@/data/attributes';
import { getPositionProfile } from '@/data/playstyles';
import { autoInterTurn } from '@/engine/autoplay';
import { BASE_WORLD, createCareer, playTurnAuto } from '@/engine/career';
import { applyEventEffects, isChoiceAffordable, resolveEvent } from '@/engine/events';
import { expectedTrainingGain, fieldAttributeAverage, previewTraining } from '@/engine/growth';
import { buyInterTurn, shopOffers, trainInterTurn } from '@/engine/interTurn';
import { weightedScore } from '@/engine/ovr';
import { previewItemEffect } from '@/engine/shop';
import { findClubId } from '@/engine/world';
import { FIELD_STAT_KEYS, STAT_CATEGORIES, type AttributeKey, type EventChoice, type GameState, type PlayerRole, type TrainingPlan } from '@/types/game';

const roles: PlayerRole[] = [
  { position: 'ST', playStyle: 'POACHER' }, { position: 'CM', playStyle: 'BOX_TO_BOX' },
  { position: 'CB', playStyle: 'STOPPER' }, { position: 'LW', playStyle: 'INSIDE_FORWARD' },
  { position: 'AM', playStyle: 'PLAYMAKER' },
];
const value = (state: GameState) => weightedScore(state.player.attributes, getPositionProfile(state.player.profile.role.position).ovrWeights);
function eventScore(state: GameState, choice: EventChoice): number {
  const before = value(state);
  const result = (effects: EventChoice['effects']) => {
    const after = applyEventEffects(state, effects).state;
    const focus = effects.reduce((sum, effect) => sum + (effect.kind === 'GROWTH_FOCUS' ? (effect.multiplier - 1) * effect.turns * CATEGORY_ATTRIBUTES[effect.category].reduce((s, key) => s + (getPositionProfile(state.player.profile.role.position).ovrWeights[key] ?? 0), 0) * 0.08 : 0), 0);
    return value(after) - before + (after.player.condition - state.player.condition) * 0.006 + (after.player.mental - state.player.mental) * 0.003 + (after.player.squad.standing - state.player.squad.standing) * 0.005 + focus;
  };
  return result(choice.effects) * (choice.successChance ?? 1) + result(choice.failureEffects ?? []) * (1 - (choice.successChance ?? 1));
}
function prepare(state: GameState): GameState {
  let next = state;
  for (const event of next.events.filter((event) => !event.resolution)) {
    const definition = GAME_EVENT_MAP[event.definitionId];
    let chosen: string;
    if (event.definitionId === 'position-change-offer') {
      const target = event.vars.targetPosition as PlayerRole['position'];
      const score = weightedScore(next.player.attributes, getPositionProfile(target).ovrWeights);
      chosen = score > value(next) ? 'accept' : 'decline';
    } else {
      const candidates = definition.choices.filter((choice) => isChoiceAffordable(choice, next));
      chosen = candidates.reduce((a, b) => eventScore(next, b) > eventScore(next, a) ? b : a).id;
    }
    next = resolveEvent(next, event.instanceId, chosen);
  }
  if (!next.interTurn.training) {
    const player = next.player;
    const weights = getPositionProfile(player.profile.role.position).ovrWeights;
    const plans: TrainingPlan[] = [{ kind: 'REST' }];
    for (const intensity of ['LIGHT', 'NORMAL', 'INTENSE'] as const) {
      const multiplier = intensity === 'LIGHT' ? 0.6 : intensity === 'INTENSE' ? 1.4 : 1;
      for (const count of [2, 3]) {
        const ranked = FIELD_STAT_KEYS.map((key) => ({ key, score: Math.min(99 - player.attributes[key], expectedTrainingGain(player, key) * multiplier * (count === 2 ? 1 : 1.6 / 2.1)) * (weights[key] ?? 0) })).sort((a, b) => b.score - a.score);
        plans.push({ kind: 'FOCUSED', attributes: ranked.slice(0, count).map((item) => item.key), intensity });
      }
      for (const category of STAT_CATEGORIES) plans.push({ kind: 'CATEGORY', category, intensity });
      plans.push({ kind: 'BULK_UP', intensity }, { kind: 'CUT', intensity });
    }
    const candidates = plans.map((plan) => {
      const preview = previewTraining(player, plan);
      const attributes = { ...player.attributes };
      for (const [key, gain] of Object.entries(preview.gains)) attributes[key as AttributeKey] = Math.max(1, Math.min(99, attributes[key as AttributeKey] + (gain ?? 0)));
      const gain = weightedScore(attributes, weights) - value(next);
      const condition = Math.max(0, Math.min(100, player.condition + preview.conditionDelta));
      return { plan, condition, score: gain + (condition - player.condition) * 0.006 };
    }).filter((candidate) => candidate.plan.kind === 'REST' || candidate.condition >= 55);
    const best = candidates.reduce((a, b) => b.score > a.score ? b : a);
    next = trainInterTurn(next, best.plan);
  }
  if (!next.interTurn.purchasedItemId) {
    const weights = getPositionProfile(next.player.profile.role.position).ovrWeights;
    const offers = shopOffers(next).map((item) => {
      const effect = previewItemEffect(next.player, item);
      const amount = effect.mode === 'BOOST' ? Math.min(99 - next.player.attributes[item.attribute], effect.expected) : effect.amount;
      return { item, value: amount * (weights[item.attribute] ?? 0) };
    }).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
    if (offers.length) next = buyInterTurn(next, offers[0].item.id);
  }
  // 사건·훈련·구매는 위 정책으로 완료. 기존 매니저는 이적·재계약·은퇴만 처리한다.
  return autoInterTurn(next);
}
const output = process.env.AUDIT_OUTPUT ?? '../growth-audit.json';
const count = Number(process.env.CAREERS ?? 50);
interface Observation { age: number; season: number; phase: string; stage: string; ovr: number; rawOvr: number; average: number; position: string }
interface AuditRow { seed: number; startPosition: string; ovr: number; average: number; potential: number; peak: number; peakAge: number; first95Age: number; nearPotentialAge: number | null; fullPotentialAge: number | null; endAge: number; observations: Observation[] }
const rows: AuditRow[] = [];
for (let i = 0; i < count; i++) {
  const seed = i + 1;
  const role = roles[i % roles.length];
  let state = createCareer({ name: `감사-${seed}`, nationality: 'KOR', role, clubId: findClubId(BASE_WORLD.clubs, 'Ulsan', 'KOR')!, heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' } }, { seed });
  const initial = { ovr: state.player.ovr, average: fieldAttributeAverage(state.player.attributes), potential: state.player.potential };
  const observations: Observation[] = [];
  const observe = (stage: string) => observations.push({ age: state.player.age, season: state.turn.season, phase: state.turn.phase, stage, ovr: state.player.ovr, rawOvr: value(state), average: fieldAttributeAverage(state.player.attributes), position: state.player.profile.role.position });
  observe('initial');
  for (let turn = 0; turn < 90 && state.stage === 'READY'; turn++) {
    state = { ...prepare(state), ceremonies: [] };
    observe('choices');
    if (state.stage !== 'READY') break;
    state = playTurnAuto(state);
    observe('turn');
  }
  const peak = Math.max(...observations.map((point) => point.ovr));
  const peakAge = observations.find((point) => point.ovr === peak)!.age;
  const first95Age = observations.find((point) => point.ovr >= peak * 0.95)!.age;
  const nearPotentialAge = observations.find((point) => point.average >= initial.potential - 1)?.age ?? null;
  const fullPotentialAge = observations.find((point) => point.average + 1e-8 >= initial.potential)?.age ?? null;
  const row = { seed, startPosition: role.position, ...initial, peak, peakAge, first95Age, nearPotentialAge, fullPotentialAge, endAge: state.player.age, observations };
  rows.push(row);
  console.log(`#${seed} ${role.position} 초기${initial.ovr}/포텐셜${initial.potential} OVR최고${peak}@${peakAge}세 95%고점${first95Age}세 평균한도-1 ${nearPotentialAge ?? '-'}세 풀포텐셜${fullPotentialAge ?? '-'}세`);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ count: rows.length, policy: 'Expected unrounded OVR gain; best focused 2/3, category, bulk/cut and rest; preserve condition >=55 for match exposure; best affordable item; expected event effects; accept better position; standard AI transfers; no save scumming.', rows }, null, 2));
}
const summary = (key: 'peakAge' | 'first95Age' | 'nearPotentialAge' | 'fullPotentialAge') => {
  const values = rows.map((row) => row[key]).filter((value): value is number => value !== null).sort((a, b) => a - b);
  return { count: values.length, min: values[0], median: values.length ? (values[Math.floor((values.length - 1) / 2)] + values[Math.floor(values.length / 2)]) / 2 : null, max: values.at(-1), mean: values.reduce((sum, age) => sum + age, 0) / values.length, age21OrEarlier: values.filter((age) => age <= 21).length, age25to29: values.filter((age) => age >= 25 && age <= 29).length };
};
console.log(JSON.stringify({ completed: rows.length, peakAge: summary('peakAge'), first95Age: summary('first95Age'), nearPotentialAge: summary('nearPotentialAge'), fullPotentialAge: summary('fullPotentialAge') }, null, 2));

