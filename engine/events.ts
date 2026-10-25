/**
 * 턴 사이 사건
 *
 * 매 턴이 끝나면 1~3개의 사건이 생긴다 (후반기 뒤에는 '프리시즌 휴가 계획'이 반드시 포함).
 * 선택에 따라 멘탈·체력·능력치·명성·돈·입지·육성 방향·플래그가 바뀐다.
 */
import { ATTRIBUTE_GROUP_LABELS, ATTRIBUTE_META, CATEGORY_ATTRIBUTES } from '@/data/attributes';
import { GAME_EVENT_MAP, GAME_EVENTS } from '@/data/events';
import type {
  ActiveEvent,
  EventChoice,
  EventEffect,
  GameEventDefinition,
  GameState,
  TurnPhase,
} from '@/types/game';
import { calculateOVR } from './ovr';
import { clamp, hashSeed, rngFor, type Rng } from './rng';
import { formatMoney } from './state';
import { clubName, type SimulationWorld } from './world';

export function isEventAvailable(def: GameEventDefinition, state: GameState, completedPhase: TurnPhase): boolean {
  const { player } = state;
  if (!def.phases.includes(completedPhase)) return false;
  if (def.minAge !== undefined && player.age < def.minAge) return false;
  if (def.maxAge !== undefined && player.age > def.maxAge) return false;
  const req = def.requires;
  if (!req) return true;
  if (req.partner && !(state.partner && state.partner.status === 'ACTIVE')) return false;
  if (req.rival && !state.rival) return false;
  if (req.firstTeam && player.squad.level !== 'FIRST_TEAM') return false;
  if (req.hasClub && !player.contract) return false;
  if (req.minReputation !== undefined && player.reputation < req.minReputation) return false;
  if (req.minMoney !== undefined && player.money < req.minMoney) return false;
  return true;
}

export function eventVars(state: GameState, world: SimulationWorld): Record<string, string> {
  return {
    name: state.player.profile.name,
    club: clubName(world, state.player.contract?.clubId),
    partner: state.partner ? (state.npcs[state.partner.npcId]?.name ?? '단짝') : '단짝',
    rival: state.rival ? (state.npcs[state.rival.npcId]?.name ?? '라이벌') : '라이벌',
  };
}

export function renderEventText(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? key);
}

/** 이번 턴 사이 사건 개수: 1개 45%, 2개 35%, 3개 20% */
function eventCount(rng: Rng): number {
  return 1 + rng.weightedIndex([0.45, 0.35, 0.2]);
}

export function rollEvents(
  state: GameState,
  world: SimulationWorld,
  completedPhase: TurnPhase,
  rng: Rng,
): ActiveEvent[] {
  const available = GAME_EVENTS.filter((def) => isEventAvailable(def, state, completedPhase));
  const guaranteed = available.filter((def) => def.guaranteed);
  const pool = available.filter((def) => !def.guaranteed);
  const picked: GameEventDefinition[] = [...guaranteed];
  const target = Math.max(eventCount(rng), guaranteed.length);

  while (picked.length < target && pool.length) {
    const index = rng.weightedIndex(pool.map((def) => def.weight));
    picked.push(pool.splice(index, 1)[0]);
  }

  const vars = eventVars(state, world);
  return picked.map((def, i) => ({
    instanceId: `ev-${hashSeed(state.seed, state.turn.season, completedPhase, def.id, i)}`,
    definitionId: def.id,
    vars,
    resolution: null,
  }));
}

export function isChoiceAffordable(choice: EventChoice, state: GameState): boolean {
  return state.player.money >= (choice.cost ?? 0);
}

const sign = (value: number) => (value >= 0 ? `+${value}` : `${value}`);

/** 사건 효과를 적용하고 한 줄 요약 목록을 돌려준다. */
export function applyEventEffects(state: GameState, effects: readonly EventEffect[]): { state: GameState; summary: string[] } {
  let player = { ...state.player, attributes: { ...state.player.attributes }, squad: { ...state.player.squad } };
  let flags = { ...state.flags };
  const summary: string[] = [];

  for (const effect of effects) {
    switch (effect.kind) {
      case 'MENTAL':
        player.mental = clamp(player.mental + effect.delta, 0, 100);
        summary.push(`멘탈 ${sign(effect.delta)}`);
        break;
      case 'CONDITION':
        player.condition = clamp(player.condition + effect.delta, 0, 100);
        summary.push(`체력 ${sign(effect.delta)}`);
        break;
      case 'ATTRIBUTE':
        player.attributes[effect.key] = clamp(player.attributes[effect.key] + effect.delta, 1, 99);
        summary.push(`${ATTRIBUTE_META[effect.key].label} ${sign(effect.delta)}`);
        break;
      case 'CATEGORY':
        for (const key of CATEGORY_ATTRIBUTES[effect.category]) {
          player.attributes[key] = clamp(player.attributes[key] + effect.delta, 1, 99);
        }
        summary.push(`${ATTRIBUTE_GROUP_LABELS[effect.category]} 전체 ${sign(effect.delta)}`);
        break;
      case 'REPUTATION':
        player.reputation = clamp(player.reputation + effect.delta, 0, 100);
        summary.push(`명성 ${sign(effect.delta)}`);
        break;
      case 'MONEY': {
        const amount = Math.round(effect.delta + (effect.perReputation ?? 0) * player.reputation);
        player.money = Math.max(0, player.money + amount);
        summary.push(`${amount >= 0 ? '수입' : '지출'} ${formatMoney(Math.abs(amount))}`);
        break;
      }
      case 'STANDING':
        player.squad.standing = clamp(player.squad.standing + effect.delta, 0, 100);
        summary.push(`팀 내 입지 ${sign(effect.delta)}`);
        break;
      case 'GROWTH_FOCUS':
        player.growthFocus = { category: effect.category, multiplier: effect.multiplier, remainingTurns: effect.turns };
        summary.push(`${ATTRIBUTE_GROUP_LABELS[effect.category]} 훈련 효율 ×${effect.multiplier} (${effect.turns}턴)`);
        break;
      case 'FLAG':
        flags = { ...flags, [effect.flag]: effect.value };
        if (effect.flag === 'PRESEASON_REST' && effect.value) summary.push('여름 휴식 (차출이 없으면 다음 시즌 체력 100)');
        break;
    }
  }
  player = { ...player, ovr: calculateOVR(player.attributes, player.profile.role) };
  return { state: { ...state, player, flags }, summary };
}

export function resolveEvent(state: GameState, instanceId: string, choiceId: string): GameState {
  const event = state.events.find((e) => e.instanceId === instanceId);
  if (!event) throw new Error('사건을 찾을 수 없습니다.');
  if (event.resolution) throw new Error('이미 답한 사건입니다.');
  const def = GAME_EVENT_MAP[event.definitionId];
  const choice = def.choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error('선택지를 찾을 수 없습니다.');
  if (!isChoiceAffordable(choice, state)) throw new Error('돈이 부족합니다.');

  const success = choice.successChance === undefined || rngFor(state.seed, instanceId, choiceId).chance(choice.successChance);
  const effects = success ? choice.effects : (choice.failureEffects ?? []);
  const applied = applyEventEffects(state, effects);
  const summary = choice.successChance === undefined ? applied.summary : [success ? '성공!' : '실패…', ...applied.summary];

  return {
    ...applied.state,
    events: applied.state.events.map((e) =>
      e.instanceId === instanceId ? { ...e, resolution: { choiceId, success, summary } } : e,
    ),
  };
}
