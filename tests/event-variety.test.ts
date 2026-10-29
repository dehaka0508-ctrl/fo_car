import { describe, expect, it } from 'vitest';
import { GAME_EVENTS, GAME_EVENT_MAP } from '@/data/events';
import { autoAnswerEvents } from '@/engine/autoplay';
import { createCareer, worldOf } from '@/engine/career';
import { eventTurnIndex, isEventAvailable, resolveEvent } from '@/engine/events';
import { beginInterTurn } from '@/engine/interTurn';
import { TURN_PHASES, type GameState } from '@/types/game';

const career = () => createCareer({ name: '사건 검사', nationality: 'KOR', role: { position: 'ST', playStyle: 'POACHER' }, clubId: 'ulsan', heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' } }, { seed: 31 });

describe('140종 사건과 커리어 단계별 해금', () => {
  it('기존 28종의 정확히 5배이며 ID·제목·본문을 재활용하지 않는다', () => {
    expect(GAME_EVENTS).toHaveLength(140);
    for (const field of ['id', 'title', 'body'] as const) expect(new Set(GAME_EVENTS.map((event) => event[field])).size).toBe(140);
    for (const event of GAME_EVENTS) {
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      expect(new Set(event.choices.map((choice) => choice.id)).size).toBe(event.choices.length);
      expect(event.choices.some((choice) => !choice.cost)).toBe(true);
      if (!event.guaranteed) expect(event.cooldownTurns).toBeGreaterThanOrEqual(6);
    }
  });

  it('실력·명성·나이의 경계를 모두 적용한다', () => {
    const state = career();
    const player = { ...state.player, age: 26, ovr: 84, reputation: 70 };
    const worldBest = GAME_EVENT_MAP['press-world-eleven'];
    expect(isEventAvailable(worldBest, { ...state, player }, 'FIRST_HALF')).toBe(false);
    expect(isEventAvailable(worldBest, { ...state, player: { ...player, ovr: 85 } }, 'FIRST_HALF')).toBe(true);
    expect(isEventAvailable(worldBest, { ...state, player: { ...player, ovr: 85, reputation: 69 } }, 'FIRST_HALF')).toBe(false);
    const prodigy = GAME_EVENT_MAP['career-early-prodigy'];
    expect(isEventAvailable(prodigy, { ...state, player: { ...player, age: 19, ovr: 65 } }, 'FIRST_HALF')).toBe(true);
    expect(isEventAvailable(prodigy, { ...state, player: { ...player, age: 20, ovr: 65 } }, 'FIRST_HALF')).toBe(false);
    expect(isEventAvailable(GAME_EVENT_MAP['career-load-plan'], { ...state, player: { ...player, age: 29 } }, 'FIRST_HALF')).toBe(false);
    expect(isEventAvailable(GAME_EVENT_MAP['career-load-plan'], { ...state, player: { ...player, age: 30 } }, 'FIRST_HALF')).toBe(true);
    expect(isEventAvailable(GAME_EVENT_MAP['press-local-column'], { ...state, player: { ...player, reputation: 20 } }, 'FIRST_HALF')).toBe(false);
    expect(isEventAvailable(GAME_EVENT_MAP['practice-keeper-feet'], state, 'FIRST_HALF')).toBe(false);
  });

  it('어린 선수·스타·베테랑에 서로 다른 사건 풀이 열린다', () => {
    const state = career();
    const available = (age: number, ovr: number, reputation: number) => GAME_EVENTS.filter((event) => isEventAvailable(event, { ...state, player: { ...state.player, age, ovr, reputation }, events: [] }, 'FIRST_HALF')).map((event) => event.id);
    const young = available(16, 50, 5), star = available(26, 87, 80), veteran = available(33, 79, 70);
    expect(young).toContain('life-first-dorm');
    expect(star).toContain('press-world-eleven');
    expect(veteran).toContain('career-load-plan');
    expect(young).not.toContain('career-load-plan');
    expect(star).not.toContain('life-first-dorm');
    expect(veteran).not.toContain('career-early-prodigy');
  });

  it('수십 턴을 진행해도 재등장 간격·단발 사건 횟수를 지키고 새로운 선택이 적용된다', () => {
    let state = career();
    const seen = new Map<string, number>();
    for (let turn = 0; turn < 60; turn++) {
      state = { ...state, turn: { ...state.turn, season: 2026 + Math.floor(turn / 3), phase: TURN_PHASES[turn % 3] }, player: { ...state.player, age: 16 + Math.floor(turn / 3), ovr: Math.min(87, 45 + turn), reputation: Math.min(85, 5 + turn * 2) } };
      state = beginInterTurn(state, worldOf(state), TURN_PHASES[(turn + 2) % 3]);
      const tick = eventTurnIndex(state);
      for (const event of state.events) {
        const definition = GAME_EVENT_MAP[event.definitionId];
        const previous = seen.get(event.definitionId);
        if (!definition.guaranteed && previous !== undefined) expect(tick - previous).toBeGreaterThanOrEqual(definition.cooldownTurns!);
        seen.set(event.definitionId, tick);
        if (definition.maxOccurrences) expect(state.eventHistory![definition.id].count).toBeLessThanOrEqual(definition.maxOccurrences);
      }
      state = autoAnswerEvents(JSON.parse(JSON.stringify(state)) as GameState);
    }
    expect(seen.size).toBeGreaterThan(40);
    const base = career();
    const definition = GAME_EVENT_MAP['life-first-dorm'];
    const event = { instanceId: 'test-dorm', definitionId: definition.id, vars: {}, resolution: null };
    const resolved = resolveEvent({ ...base, events: [event] }, event.instanceId, definition.choices[0].id);
    expect(resolved.player.mental).toBe(base.player.mental + 3);
    expect(resolved.events[0].resolution?.summary).toContain('멘탈 +3');
  });
});
