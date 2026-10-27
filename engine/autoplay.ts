/**
 * 자동 진행 정책 (AI 매니저)
 *
 * 턴 사이 결정을 대신 내린다: 사건 응답 → 훈련 → 구매 → 오퍼 판단 → 은퇴 판단.
 * 풀 커리어 통합 테스트, UI의 '자동 진행' 버튼, 밸런스 점검 스크립트에서 쓴다.
 */
import { GAME_EVENT_MAP } from '@/data/events';
import type { AttributeKey, EventChoice, EventEffect, GameState, TrainingPlan } from '@/types/game';
import { canRetire, createCareer, playTurnAuto, retire, worldOf } from './career';
import type { CharacterInput } from './character';
import { isChoiceAffordable, resolveEvent } from './events';
import { levelFactor, potentialOf, roleWeights } from './growth';
import { buyInterTurn, shopOffers, trainInterTurn } from './interTurn';
import { canPurchase, previewItemEffect } from './shop';
import { isRegularRole } from './squad';
import { acceptOffer, offerAttractiveness, rejectOffer, requestMove, requestRenewal, seasonsLeft } from './transfer';

function effectValue(state: GameState, effect: EventEffect): number {
  const { player } = state;
  switch (effect.kind) {
    case 'POSITION':
      return 5;
    case 'MENTAL':
      return effect.delta * (player.mental < 70 ? 0.6 : 0.2);
    case 'CONDITION':
      return effect.delta * (player.condition < 60 ? 0.5 : 0.15);
    case 'ATTRIBUTE':
      return effect.delta * 3 * ((roleWeights(player)[effect.key] ?? 0.1) + 0.2);
    case 'CATEGORY':
      return effect.delta * 5;
    case 'REPUTATION':
      return effect.delta * 1.5;
    case 'MONEY':
      return (effect.delta + (effect.perReputation ?? 0) * player.reputation) / 40_000;
    case 'STANDING':
      return effect.delta * 0.8;
    case 'GROWTH_FOCUS':
      return 4;
    case 'FLAG':
      return effect.value ? 8 : 0;
  }
}

function choiceValue(state: GameState, choice: EventChoice): number {
  const success = choice.effects.reduce((sum, e) => sum + effectValue(state, e), 0);
  if (choice.successChance === undefined) return success;
  const failure = (choice.failureEffects ?? []).reduce((sum, e) => sum + effectValue(state, e), 0);
  return success * choice.successChance + failure * (1 - choice.successChance);
}

export function autoAnswerEvents(state: GameState): GameState {
  let next = state;
  for (const event of state.events.filter((e) => !e.resolution)) {
    const def = GAME_EVENT_MAP[event.definitionId];
    const choices = def.choices.filter((c) => isChoiceAffordable(c, next));
    if (event.definitionId === 'position-change-offer') { next = resolveEvent(next, event.instanceId, 'accept'); continue; }
    const best = choices.reduce((a, b) => (choiceValue(next, b) > choiceValue(next, a) ? b : a), choices[0] ?? def.choices[0]);
    next = resolveEvent(next, event.instanceId, best.id);
  }
  return next;
}

/** OVR이 가장 많이 오를 세부 능력치 2개를 훈련한다. 체력이 낮으면 쉰다. */
export function autoTrainingPlan(state: GameState): TrainingPlan {
  const { player } = state;
  if (player.condition < 45) return { kind: 'REST' };
  const weights = roleWeights(player);
  const ranked = (Object.entries(weights) as Array<[AttributeKey, number]>)
    .map(([key, w]) => ({ key, value: w * levelFactor(player.attributes[key], potentialOf(player)) }))
    .sort((a, b) => b.value - a.value);
  const intensity = player.condition >= 80 ? 'INTENSE' : player.condition >= 60 ? 'NORMAL' : 'LIGHT';
  return { kind: 'FOCUSED', attributes: ranked.slice(0, 2).map((r) => r.key), intensity };
}

function autoShop(state: GameState): GameState {
  const { player } = state;
  const weights = roleWeights(player);
  const candidates = shopOffers(state)
    .filter((item) => canPurchase(player, item, state.interTurn.purchasedItemId !== null).ok && player.money >= item.price * 1.5)
    .map((item) => {
      const preview = previewItemEffect(player, item);
      const amount = preview.mode === 'BOOST' ? preview.expected : preview.amount * 0.6;
      return { item, value: amount * ((weights[item.attribute] ?? 0) + 0.15) };
    })
    .filter((c) => c.value > 0.1)
    .sort((a, b) => b.value - a.value);
  return candidates.length ? buyInterTurn(state, candidates[0].item.id) : state;
}

function currentSituationScore(state: GameState): number {
  const { player } = state;
  const contract = player.contract;
  if (!contract) return -Infinity;
  const world = worldOf(state);
  return offerAttractiveness(state, world, {
    id: 'current',
    type: 'RENEWAL',
    source: 'AUTO',
    clubId: contract.clubId,
    terms: { years: 1, wage: contract.wage, playingTime: player.squad.level === 'FIRST_TEAM' ? player.squad.playingTime : 'RESERVE' },
    transferFee: 0,
    competitors: [],
    createdAt: state.turn,
    status: 'PENDING',
  });
}

function autoTransfers(state: GameState): GameState {
  const world = worldOf(state);
  let next = state;
  const contract = next.player.contract;

  // 계약이 끝나 가면 재계약을, FA면 비슷한 수준의 팀에 직접 문을 두드린다
  if (contract && seasonsLeft(contract, next.turn) <= 0 && !next.offers.some((o) => o.type === 'RENEWAL')) {
    next = requestRenewal(next, world).state;
  }
  if (!contract && next.offers.length === 0) {
    const targets = Object.values(world.clubStates)
      .filter((c) => Math.abs(c.power - next.player.ovr) <= 6)
      .sort((a, b) => b.prestige - a.prestige)
      .slice(0, 3);
    for (const club of targets) {
      next = requestMove(next, world, club.clubId, 'TRANSFER', next.player.profile.role.position === 'GK' ? 'GK_SECOND' : 'BACKUP').state;
    }
  }

  const pending = next.offers.filter((o) => o.status === 'PENDING');
  if (!pending.length) return next;
  const scored = pending.map((offer) => ({ offer, score: offerAttractiveness(next, world, offer) })).sort((a, b) => b.score - a.score);
  const best = scored[0];
  const current = currentSituationScore(next);
  const expiring = contract ? seasonsLeft(contract, next.turn) <= 0 : true;
  const wantsMove = !isRegularRole(next.player.squad.playingTime) || next.player.squad.level !== 'FIRST_TEAM';
  const margin = best.offer.type === 'RENEWAL' ? 0 : wantsMove ? 4 : 10;

  if (best.score > current + margin || (expiring && best.score > current - 15) || !contract) {
    return acceptOffer(next, world, best.offer.id);
  }
  for (const { offer } of scored) next = rejectOffer(next, offer.id);
  return next;
}

export function autoRetirementDue(state: GameState): boolean {
  const { player } = state;
  if (!canRetire(state)) return false;
  if (player.age >= 38) return true;
  const clubPower = player.contract ? state.clubs[player.contract.clubId].power : 0;
  return player.age >= 34 && (!player.contract || player.ovr < clubPower - 6);
}

/** 턴 사이 결정을 모두 내린다. */
export function autoInterTurn(state: GameState): GameState {
  if (state.stage !== 'READY') return state;
  let next = autoAnswerEvents(state);
  if (!next.interTurn.training) next = trainInterTurn(next, autoTrainingPlan(next));
  if (!next.interTurn.purchasedItemId) next = autoShop(next);
  next = autoTransfers(next);
  if (autoRetirementDue(next)) return retire(next, 'VOLUNTARY');
  return next;
}

/** 한 턴 + 턴 사이 결정을 자동으로 진행한다. */
export function autoAdvance(state: GameState): GameState {
  if (state.stage !== 'READY') return state;
  const prepared = autoInterTurn(state);
  if (prepared.stage !== 'READY') return prepared;
  return autoInterTurn(playTurnAuto(prepared));
}

/** 16세부터 은퇴까지 커리어 전체를 자동으로 진행한다. */
export function simulateCareer(input: CharacterInput, seed: number, maxTurns = 90): GameState {
  let state = createCareer(input, { seed });
  for (let i = 0; i < maxTurns && state.stage === 'READY'; i++) {
    // 화면이 없으니 시상식 확인 대기열은 바로 비운다
    state = { ...autoInterTurn(state), ceremonies: [] };
    if (state.stage !== 'READY') break;
    state = playTurnAuto(state);
  }
  return { ...state, ceremonies: [] };
}
