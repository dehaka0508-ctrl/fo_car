import { describe, expect, it } from 'vitest';
import { makePlayer, world } from './helpers';
import { createCareer } from '@/engine/career';
import { calculateOVR, rankPositionFit } from '@/engine/ovr';
import { applyTurnGrowth, applyTraining, previewTraining, potentialProgress } from '@/engine/growth';
import { goalShare, assistShare, passSuccessChance, passAccuracy, mergeStatLines, simulateTurn, createTurnSession, advanceTurn } from '@/engine/simulator';
import { emptyStatLine } from '@/engine/character';
import { positionChangeProposal, rollEvents, resolveEvent } from '@/engine/events';
import { buildHighlightScene, positionScenePool } from '@/engine/highlight';
import { rngFor } from '@/engine/rng';
import { FIELD_STAT_KEYS, type GameState, type PlayerRole } from '@/types/game';

const random = () => rngFor(7, 'player-evolution');
const turnInput = (player: ReturnType<typeof makePlayer>, seed = 9) => ({ seed, turn: { season: 2026, phase: 'FIRST_HALF' as const }, player, world });

describe('초기 역할과 현재 포지션 분리', () => {
  it('같은 능력치이면 초기 역할을 바꿔도 OVR·훈련·자연 성장·경기 기록이 동일하다', () => {
    const player = makePlayer({ boost: 25 });
    const alternate = { ...player, profile: { ...player.profile, role: { position: 'ST', playStyle: 'TARGET_MAN' } as PlayerRole } };
    expect(calculateOVR(player.attributes, player.profile.role)).toBe(calculateOVR(alternate.attributes, alternate.profile.role));
    const plan = { kind: 'FOCUSED' as const, attributes: ['finishing' as const, 'offTheBall' as const], intensity: 'NORMAL' as const };
    expect(previewTraining(player, plan)).toEqual(previewTraining(alternate, plan));
    expect(applyTurnGrowth(player, random()).deltas).toEqual(applyTurnGrowth(alternate, random()).deltas);
    const a = simulateTurn(turnInput(player)).result;
    const b = simulateTurn(turnInput(alternate)).result;
    expect(a.matches).toEqual(b.matches);
    expect(a.playerStats).toEqual(b.playerStats);
  });

  it('다른 포지션에 더 적합한 선수에게만 확률적으로 변경 제의가 발생하며 수락/거절을 구분한다', () => {
    const base = createCareer({ name: '전환 선수', nationality: 'ENG', role: { position: 'ST', playStyle: 'POACHER' }, clubId: 'arsenal', heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' } }, { seed: 1 });
    const attributes = { ...base.player.attributes };
    for (const key of FIELD_STAT_KEYS) attributes[key] = 25;
    Object.assign(attributes, { tackling: 95, interceptions: 95, defPositioning: 95, strength: 90, aerial: 90 });
    const player = { ...base.player, attributes, ovr: calculateOVR(attributes, base.player.profile.role) };
    let offered = 0;
    let example: GameState | null = null;
    for (let seed = 1; seed <= 80; seed++) {
      const state = { ...base, seed, player };
      const proposal = positionChangeProposal(state);
      const events = rollEvents(state, world, 'FIRST_HALF', rngFor(seed, 'events'));
      const event = events.find((e) => e.definitionId === 'position-change-offer');
      expect(Boolean(event)).toBe(Boolean(proposal));
      if (!proposal) continue;
      offered++;
      expect(proposal).toBe(rankPositionFit(attributes)[0].position);
      example = { ...state, events };
    }
    expect(offered).toBeGreaterThan(0);
    expect(offered).toBeLessThan(80);
    const state = example!;
    const event = state.events.find((e) => e.definitionId === 'position-change-offer')!;
    const accepted = resolveEvent(state, event.instanceId, 'accept');
    const declined = resolveEvent(state, event.instanceId, 'decline');
    expect(accepted.player.profile.role.position).toBe(event.vars.targetPosition);
    expect(accepted.player.ovr).toBeGreaterThan(state.player.ovr);
    expect(accepted.player.attributes).toEqual(state.player.attributes);
    expect(potentialProgress(accepted.player)).toBe(potentialProgress(state.player));
    expect(declined.player.profile.role.position).toBe('ST');
    expect(() => resolveEvent(accepted, event.instanceId, 'accept')).toThrow();
    const keeper = makePlayer({ role: { position: 'GK', playStyle: 'CLASSIC_GOALKEEPER' } });
    expect(positionChangeProposal({ ...base, player: keeper })).toBeNull();
  });
});

describe('약발 숙련도와 패스·수비 집계', () => {
  it('약발 숙련도가 높으면 동일한 능력치에서 골·도움 기대값과 패스 성공 확률이 증가한다', () => {
    const player = makePlayer();
    expect(goalShare(player.attributes, 'ST', 60, 70, 100)).toBeGreaterThan(goalShare(player.attributes, 'ST', 60, 70, 0));
    expect(assistShare(player.attributes, 'ST', 60, 70, 100)).toBeGreaterThan(assistShare(player.attributes, 'ST', 60, 70, 0));
    expect(passSuccessChance(player.attributes, 100)).toBeGreaterThan(passSuccessChance(player.attributes, 0));
  });

  it('약발 훈련은 숙련도만 올리며 100을 넘지 않고 18개 능력치 평균을 바꾸지 않는다', () => {
    const player = { ...makePlayer(), weakFoot: 99 };
    const result = applyTraining(player, { kind: 'WEAK_FOOT' }, random());
    expect(result.player.weakFoot).toBe(100);
    expect(result.player.attributes).toEqual(player.attributes);
    expect(result.player.condition).toBe(player.condition - 8);
    expect(result.result.weakFootDelta).toBe(1);
  });

  it('경기별 태클·패스 합계가 턴 성적과 일치하며 성공률은 전체 시도로 가중 집계한다', () => {
    for (const role of [{ position: 'CM', playStyle: 'BOX_TO_BOX' }, { position: 'CB', playStyle: 'STOPPER' }, { position: 'GK', playStyle: 'SWEEPER_KEEPER' }] as const) {
      const result = simulateTurn(turnInput(makePlayer({ boost: 30, role }))).result;
      expect(result.playerPosition).toBe(role.position);
      const total = mergeStatLines(...Object.values(result.playerStats));
      const lines = result.matches.flatMap((match) => match.player ? [match.player] : []);
      expect(total.tackles).toBe(lines.reduce((sum, line) => sum + (line.tackles ?? 0), 0));
      expect(total.passesAttempted).toBe(lines.reduce((sum, line) => sum + (line.passesAttempted ?? 0), 0));
      expect(total.passesCompleted).toBe(lines.reduce((sum, line) => sum + (line.passesCompleted ?? 0), 0));
      expect(total.passesAttempted).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.passesCompleted).toBeLessThanOrEqual(line.passesAttempted!);
        expect(line.keyPasses).toBeLessThanOrEqual(line.passesCompleted!);
        expect(Number.isInteger(line.tackles)).toBe(true);
      }
    }
    const combined = mergeStatLines({ ...emptyStatLine(), passesAttempted: 10, passesCompleted: 8 }, { ...emptyStatLine(), passesAttempted: 2, passesCompleted: 1 });
    expect(passAccuracy(combined)).toBe(75);
    expect(passAccuracy(emptyStatLine())).toBeNull();
    const legacy = emptyStatLine(); delete legacy.tackles; delete legacy.passesAttempted; delete legacy.passesCompleted;
    expect(mergeStatLines(legacy).passesCompleted).toBe(0);
  });
});

describe('포지션별 하이라이트 상황', () => {
  it('스트라이커의 크로스 대응에는 제공권·발리·연계 선택이 있으며 포지션별로 상황 풀이 다르다', () => {
    const cross = positionScenePool('ST').find((scene) => scene.id === 'incoming-cross')!;
    expect(cross.text).toContain('크로스');
    expect(cross.options!.some((option) => option.keys.includes('aerial'))).toBe(true);
    expect(cross.options!.some((option) => option.kind === 'KEY_PASS')).toBe(true);
    expect(positionScenePool('GK').every((scene) => scene.kind === 'SAVE')).toBe(true);
    expect(positionScenePool('CB').some((scene) => scene.id === 'clear-cross')).toBe(true);
  });

  it('하이라이트 상황은 턴마다 달라지며 2개 이하이고 실제 출전 시간 안에 발생한다', () => {
    const contexts = new Set<string>();
    const player = makePlayer({ boost: 30 });
    for (let seed = 1; seed <= 40; seed++) {
      const session = advanceTurn(createTurnSession(turnInput(player, seed)));
      const scene = buildHighlightScene(session);
      if (!scene) continue;
      expect(scene.situations.length).toBeLessThanOrEqual(2);
      expect(buildHighlightScene(JSON.parse(JSON.stringify(session)))).toEqual(scene);
      for (const situation of scene.situations) {
        contexts.add(situation.context!);
        expect(situation.minute).toBeGreaterThan(session.highlight!.appearance!.from);
        expect(situation.minute).toBeLessThanOrEqual(session.highlight!.appearance!.to);
      }
    }
    expect(contexts.size).toBeGreaterThanOrEqual(4);
    expect(contexts.has('incoming-cross')).toBe(true);
  });
});
