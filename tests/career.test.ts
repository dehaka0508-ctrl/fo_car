import { describe, expect, it } from 'vitest';
import { SHOP_ITEMS } from '@/data/items';
import { GAME_EVENT_MAP } from '@/data/events';
import { autoAnswerEvents, simulateCareer } from '@/engine/autoplay';
import {
  BASE_WORLD,
  canStartTurn,
  completeTurn,
  continueTurn,
  createCareer,
  playTurnAuto,
  startTurn,
  worldOf,
} from '@/engine/career';
import type { CharacterInput } from '@/engine/character';
import { resolveEvent, rollEvents } from '@/engine/events';
import { buildHighlightScene, resolveSituationChoice } from '@/engine/highlight';
import { beginInterTurn, buyInterTurn, seasonStartCondition, shopOffers, trainInterTurn } from '@/engine/interTurn';
import { rngFor } from '@/engine/rng';
import type { GameState } from '@/types/game';

const input = (overrides: Partial<CharacterInput> = {}): CharacterInput => ({
  name: '테스트',
  nationality: 'KOR',
  role: { position: 'ST', playStyle: 'POACHER' },
  heightCm: 182,
  weightKg: 76,
  appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' },
  clubId: 'ulsan',
  ...overrides,
});

/** 사건에 답하고 턴을 하나 진행한다 */
function step(state: GameState): GameState {
  return playTurnAuto(autoAnswerEvents(state));
}

describe('커리어 생성', () => {
  it('16세·시작 팀·2026/27 전반기·READY 상태로 시작한다', () => {
    const state = createCareer(input(), { seed: 1 });
    expect(state.player.age).toBe(16);
    expect(state.player.contract?.clubId).toBe('ulsan');
    expect(state.turn).toEqual({ season: 2026, phase: 'FIRST_HALF' });
    expect(state.stage).toBe('READY');
    expect(canStartTurn(state).ok).toBe(true);
  });
});

describe('턴 순서와 턴 사이 페이즈', () => {
  it('전반기 → 후반기 → 프리시즌 → 다음 시즌 전반기', () => {
    let state = createCareer(input(), { seed: 2 });
    const turns = [];
    for (let i = 0; i < 4; i++) {
      turns.push(state.turn);
      state = step(state);
    }
    expect(turns.map((t) => `${t.season}-${t.phase}`)).toEqual([
      '2026-FIRST_HALF',
      '2026-SECOND_HALF',
      '2026-PRESEASON',
      '2027-FIRST_HALF',
    ]);
    expect(state.player.age).toBe(17);
    expect(state.history).toHaveLength(1);
  });

  it('턴이 끝나면 사건이 1~3개 생기고, 답하기 전에는 다음 턴을 시작할 수 없다', () => {
    const state = playTurnAuto(createCareer(input(), { seed: 3 }));
    expect(state.events.length).toBeGreaterThanOrEqual(1);
    expect(state.events.length).toBeLessThanOrEqual(3);
    expect(canStartTurn(state).ok).toBe(false);
    expect(canStartTurn(autoAnswerEvents(state)).ok).toBe(true);
  });

  it('후반기가 끝나면 프리시즌 휴가 계획이 반드시 나온다', () => {
    let state = step(createCareer(input(), { seed: 4 }));
    state = step(state);
    expect(state.turn.phase).toBe('PRESEASON');
    expect(state.events.some((e) => e.definitionId === 'vacation-plan')).toBe(true);
  });

  it('훈련·구매는 턴 사이에 한 번씩만 가능하다', () => {
    let state = { ...createCareer(input(), { seed: 5 }), player: { ...createCareer(input(), { seed: 5 }).player, money: 100_000 } };
    state = trainInterTurn(state, { kind: 'REST' });
    expect(() => trainInterTurn(state, { kind: 'REST' })).toThrow();
    const [first, second] = shopOffers(state);
    state = buyInterTurn(state, first.id);
    expect(() => buyInterTurn(state, second.id)).toThrow();
  });
});

describe('상점 진열', () => {
  it('턴마다 잔고로 살 수 있는 물건 중 무작위 3개만 진열하고, 같은 턴에는 같은 물건이 나온다', () => {
    const base = createCareer(input(), { seed: 7 });
    const rich = { ...base, player: { ...base.player, money: 50_000_000 } };
    const offers = shopOffers(rich);
    expect(offers).toHaveLength(3);
    expect(shopOffers(rich).map((i) => i.id)).toEqual(offers.map((i) => i.id));
    // 다른 턴에는 진열이 바뀐다
    const nextTurn = { ...rich, turn: { ...rich.turn, phase: 'SECOND_HALF' as const } };
    expect(shopOffers(nextTurn).map((i) => i.id)).not.toEqual(offers.map((i) => i.id));
    // 잔고가 적으면 살 수 있는 것만
    const poor = { ...base, player: { ...base.player, money: 20_000 } };
    for (const item of shopOffers(poor)) expect(item.price).toBeLessThanOrEqual(20_000);
    // 진열되지 않은 물건은 살 수 없다
    const hidden = SHOP_ITEMS.find((i) => !offers.some((o) => o.id === i.id))!;
    expect(() => buyInterTurn(rich, hidden.id)).toThrow('진열');
  });
});

describe('프리시즌 휴식 → 체력 100 규칙', () => {
  it('휴식 + 대표팀 미차출이면 100, 차출되면 일반 회복', () => {
    expect(seasonStartCondition(40, true, false)).toBe(100);
    expect(seasonStartCondition(40, true, true)).toBe(65);
    expect(seasonStartCondition(40, false, false)).toBe(65);
  });

  it('실제 진행: 휴가 계획에서 휴식을 고르면 다음 시즌을 체력 100으로 시작한다', () => {
    // 2027년 여름 국제대회가 없는 스코틀랜드 국적 → 대표팀 차출 없음
    let state = createCareer(input({ nationality: 'SCO', clubId: 'leeds' }), { seed: 6 });
    state = step(step(state));
    const vacation = state.events.find((e) => e.definitionId === 'vacation-plan')!;
    state = resolveEvent(state, vacation.instanceId, 'rest');
    state = autoAnswerEvents(state);
    expect(state.flags.PRESEASON_REST).toBe(true);
    state = playTurnAuto(state);
    expect(state.lastTurn?.nationalDuty).toBe(false);
    expect(state.turn.phase).toBe('FIRST_HALF');
    expect(state.player.condition).toBe(100);
  });
});

describe('사건', () => {
  it('조건이 맞지 않는 사건은 나오지 않는다 (파트너 없음 → 파트너 사건 없음)', () => {
    const state = createCareer(input(), { seed: 7 });
    for (let i = 0; i < 30; i++) {
      const events = rollEvents(state, worldOf(state), 'FIRST_HALF', rngFor(i, 'roll'));
      expect(events.every((e) => GAME_EVENT_MAP[e.definitionId].category !== 'PARTNER')).toBe(true);
    }
  });

  it('선택하면 효과가 적용되고 요약이 남는다', () => {
    let state = createCareer(input(), { seed: 8 });
    state = beginInterTurn(state, worldOf(state), 'FIRST_HALF');
    const event = state.events[0];
    const choice = GAME_EVENT_MAP[event.definitionId].choices.find((c) => !c.cost)!;
    const resolved = resolveEvent(state, event.instanceId, choice.id);
    expect(resolved.events[0].resolution?.choiceId).toBe(choice.id);
    expect(() => resolveEvent(resolved, event.instanceId, choice.id)).toThrow();
  });
});

describe('바둑돌 하이라이트', () => {
  it('장면을 만들고 선택지를 판정해 턴에 반영한다', () => {
    const state = autoAnswerEvents(createCareer(input({ clubId: 'arsenal', nationality: 'ENG' }), { seed: 9 }));
    const started = startTurn(state);
    expect(started.session.status).toBe('AWAITING_HIGHLIGHT');
    const scene = buildHighlightScene(started.session)!;
    expect(scene.situations.length).toBeGreaterThanOrEqual(1);
    for (const situation of scene.situations) {
      expect(situation.options.length).toBeGreaterThanOrEqual(2);
      const me = situation.tokens.find((t) => t.tag === 'PROTAGONIST');
      expect(me?.appearance).toEqual(state.player.profile.appearance);
    }
    const resolved = scene.situations.map((s) => resolveSituationChoice(started.session, s, s.options[0].id));
    const session = continueTurn(started.session, { fixtureId: scene.briefing.fixture.id, resolved });
    const next = completeTurn(started.state, session);
    expect(next.lastTurn?.highlight).not.toBeNull();
    expect(next.turn.phase).toBe('SECOND_HALF');
  });
});

describe('풀 커리어 루프', () => {
  const careers = [
    simulateCareer(input(), 11),
    simulateCareer(input({ role: { position: 'GK', playStyle: 'CLASSIC_GOALKEEPER' }, clubId: 'man-utd', nationality: 'ENG', heightCm: 192, weightKg: 86 }), 12),
  ];

  it('16세부터 은퇴까지 끝까지 진행된다', () => {
    for (const state of careers) {
      expect(state.stage).toBe('RETIRED');
      expect(state.retirement).not.toBeNull();
      expect(state.player.age).toBeGreaterThanOrEqual(30);
      expect(state.history.length).toBe(state.player.age - 16);
    }
  });

  it('능력치·돈·명성이 유효한 범위를 유지한다', () => {
    for (const state of careers) {
      for (const value of Object.values(state.player.attributes)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(99);
      }
      expect(state.player.money).toBeGreaterThanOrEqual(0);
      expect(state.player.reputation).toBeLessThanOrEqual(100);
    }
  });

  it('시즌마다 시상식이 열리고 시즌 기록이 남는다', () => {
    const state = careers[0];
    const seasons = state.history.map((s) => s.season);
    expect(seasons).toEqual([...seasons].sort((a, b) => a - b));
    expect(state.history.every((s) => s.ratings !== undefined)).toBe(true);
    expect(state.awards.some((a) => a.type === 'BALLON_DOR' || a.type === 'LEAGUE_BEST_XI' || a.type === 'NATIONAL_POTY')).toBe(true);
  });

  it('세이브(JSON)로 저장했다가 이어서 진행할 수 있다', () => {
    let state = createCareer(input(), { seed: 13 });
    for (let i = 0; i < 3; i++) state = step(state);
    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    expect(step(restored)).toEqual(step(state));
  });

  it('구단 수는 승강 후에도 리그별로 유지된다', () => {
    const state = careers[0];
    const count = (leagueId: string) => Object.values(state.clubs).filter((c) => c.leagueId === leagueId).length;
    for (const league of Object.values(BASE_WORLD.leagues)) {
      const initial = Object.values(BASE_WORLD.clubs).filter((c) => c.leagueId === league.id).length;
      expect(count(league.id)).toBe(initial);
    }
  });
});
