import { describe, expect, it } from 'vitest';
import { ballonScore, leagueRecognition } from '@/engine/awards';
import { createCareer, worldOf } from '@/engine/career';
import type { CharacterInput } from '@/engine/character';
import { maybeFormPartner, separatePartnerIfLeaving } from '@/engine/narrative';
import { checkRecordBreaks, evaluateDeparture } from '@/engine/records';
import { applyPromotionRelegation, closeLeagueSeason } from '@/engine/seasonEnd';
import {
  acceptOffer,
  contractEndSeason,
  ensureCompetitors,
  generateTurnOffers,
  getCompetitors,
  processContractExpiry,
  requestMove,
  rotateCompetitors,
  wageOffer,
} from '@/engine/transfer';
import type { GameState, StandingRow, TransferOffer } from '@/types/game';

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

function grown(state: GameState, ovr: number, reputation: number): GameState {
  return { ...state, player: { ...state.player, ovr, reputation, age: 24 } };
}

describe('계약 기간', () => {
  it('시즌 중 서명하면 다음 시즌부터 센다 · 겨울 임대는 그 시즌 끝까지', () => {
    expect(contractEndSeason({ season: 2026, phase: 'FIRST_HALF' }, 3, 'PERMANENT')).toBe(2028);
    expect(contractEndSeason({ season: 2026, phase: 'SECOND_HALF' }, 3, 'PERMANENT')).toBe(2029);
    expect(contractEndSeason({ season: 2026, phase: 'PRESEASON' }, 1, 'LOAN')).toBe(2027);
    expect(contractEndSeason({ season: 2026, phase: 'SECOND_HALF' }, 1, 'LOAN')).toBe(2026);
  });
});

describe('자동 오퍼', () => {
  it('계약 선수는 0~3개, FA는 1~5개', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const state = grown(createCareer(input(), { seed }), 70, 30);
      const offers = generateTurnOffers(state, worldOf(state), 7.2).offers;
      expect(offers.length).toBeLessThanOrEqual(3);
      const fa = { ...state, player: { ...state.player, contract: null } };
      const faOffers = generateTurnOffers(fa, worldOf(fa), 7.2).offers;
      expect(faOffers.length).toBeGreaterThanOrEqual(1);
      expect(faOffers.length).toBeLessThanOrEqual(5);
      expect(faOffers.every((o) => o.transferFee === 0)).toBe(true);
    }
  });

  it('오퍼에는 조건과 경쟁 선수(0~3명)가 붙는다', () => {
    let found: TransferOffer | undefined;
    for (let seed = 1; seed <= 20 && !found; seed++) {
      const state = grown(createCareer(input(), { seed }), 72, 35);
      found = generateTurnOffers(state, worldOf(state), 7.5).offers.find((o) => o.type !== 'RENEWAL');
    }
    expect(found).toBeDefined();
    expect(found!.terms.wage).toBeGreaterThan(0);
    expect(found!.terms.years).toBeGreaterThanOrEqual(1);
    expect(found!.competitors.length).toBeLessThanOrEqual(3);
    for (const c of found!.competitors) expect(c.name.length).toBeGreaterThan(0);
  });

  it('자본 리그는 명성이 낮아도 같은 조건이면 더 많은 연봉을 제시한다', () => {
    const base = { finance: 70, playingTime: 'STARTER' as const, reputation: 40, noise: 0.5 };
    expect(wageOffer({ ...base, moneyLeague: true })).toBeGreaterThan(wageOffer({ ...base, moneyLeague: false }));
  });

  it('임대 대상(어린 비주전)에게는 임대 오퍼도 온다', () => {
    let loans = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const state = createCareer(input({ clubId: 'man-city', nationality: 'ENG' }), { seed });
      loans += generateTurnOffers({ ...state, player: { ...state.player, ovr: 62 } }, worldOf(state), 7).offers.filter((o) => o.type === 'LOAN').length;
    }
    expect(loans).toBeGreaterThan(0);
  });
});

describe('역제의 · 계약 체결', () => {
  it('턴당 역제의는 3회까지', () => {
    let state = grown(createCareer(input(), { seed: 3 }), 70, 30);
    const world = worldOf(state);
    for (const club of ['jeonbuk', 'pohang', 'fc-seoul']) state = requestMove(state, world, club, 'TRANSFER', 'ROTATION').state;
    expect(state.negotiation.counterOffersUsed).toBe(3);
    const fourth = requestMove(state, world, 'daegu', 'TRANSFER', 'ROTATION');
    expect(fourth.accepted).toBe(false);
    expect(fourth.message).toContain('3회');
  });

  it('완전 이적: 계약·소속 기록·입지가 바뀌고 다른 오퍼는 거절된다', () => {
    let state = grown(createCareer(input(), { seed: 4 }), 70, 30);
    const world = worldOf(state);
    for (const club of ['jeonbuk', 'pohang', 'fc-seoul', 'daejeon']) {
      const res = requestMove({ ...state, negotiation: { ...state.negotiation, counterOffersUsed: 0 } }, world, club, 'TRANSFER', 'ROTATION');
      state = res.state;
    }
    const offer = state.offers.find((o) => o.status === 'PENDING')!;
    expect(offer).toBeDefined();
    const after = acceptOffer(state, world, offer.id);
    expect(after.player.contract?.clubId).toBe(offer.clubId);
    expect(after.player.clubHistory.at(-1)?.clubId).toBe(offer.clubId);
    expect(after.player.squad.playingTime).toBe(offer.terms.playingTime);
    expect(after.offers.filter((o) => o.status === 'PENDING')).toHaveLength(0);
  });

  it('임대가 끝나면 원소속팀으로, 완전 계약이 끝나면 FA가 된다', () => {
    const base = createCareer(input(), { seed: 5 });
    const loanOffer: TransferOffer = {
      id: 'loan-test', type: 'LOAN', source: 'AUTO', clubId: 'daegu',
      terms: { years: 1, wage: 20_000, playingTime: 'STARTER' }, transferFee: 0, competitors: [],
      createdAt: base.turn, status: 'PENDING',
    };
    let state = acceptOffer({ ...base, offers: [loanOffer] }, worldOf(base), 'loan-test');
    expect(state.player.contract?.type).toBe('LOAN');
    expect(state.player.parentContract?.clubId).toBe('ulsan');
    // 2026/27 시즌이 끝나고 프리시즌에 들어갈 때 임대 종료
    state = processContractExpiry({ ...state, turn: { season: 2026, phase: 'PRESEASON' } }, worldOf(state));
    expect(state.player.contract?.clubId).toBe('ulsan');
    expect(state.player.parentContract).toBeNull();
    // 원 계약(2028 종료)도 끝나면 FA
    state = processContractExpiry({ ...state, turn: { season: 2028, phase: 'PRESEASON' } }, worldOf(state));
    expect(state.player.contract).toBeNull();
    expect(state.notices[0].title).toContain('FA');
  });
});

describe('경쟁 선수 생태계', () => {
  it('경쟁 선수는 한 번 만들면 시즌 내내 같고, 시즌이 바뀌면 다른 팀 명단은 새로 만든다', () => {
    let state = createCareer(input(), { seed: 6 });
    const world = worldOf(state);
    state = ensureCompetitors(state, world, 'pohang');
    const first = getCompetitors(state, 'pohang');
    expect(getCompetitors(ensureCompetitors(state, world, 'pohang'), 'pohang')).toEqual(first);
    const rotated = rotateCompetitors(state, world, 2027);
    expect(rotated.clubs.pohang.squadSeason).toBeNull();
    expect(rotated.clubs.ulsan.squadSeason).toBe(2027);
  });
});

describe('승강 · 구단 수치', () => {
  it('리그 결산 후에도 리그별 구단 수가 유지되고 하위 3팀이 강등된다', () => {
    const state = createCareer(input({ clubId: 'arsenal', nationality: 'ENG' }), { seed: 7 });
    const world = worldOf(state);
    const plClubs = Object.values(state.clubs).filter((c) => c.leagueId === 'ENG_PL').map((c) => c.clubId);
    const table: StandingRow[] = plClubs.map((clubId, i) => ({
      clubId, position: i + 1, points: 100 - i * 3, played: 38, wins: 30 - i, draws: 0, losses: 8 + i, goalsFor: 60, goalsAgainst: 40,
    }));
    const closed = closeLeagueSeason({ ...state, leagueTable: table, seasonTurns: [] }, world);
    const count = (id: string) => Object.values(closed.clubs).filter((c) => c.leagueId === id).length;
    expect(count('ENG_PL')).toBe(20);
    expect(count('ENG_CH')).toBe(24);
    for (const relegated of table.slice(-3)) expect(closed.clubs[relegated.clubId].leagueId).toBe('ENG_CH');
    expect(closed.clubs[table[0].clubId].continentalCompetitionId).toBe('UEFA_CL');
    for (const club of Object.values(closed.clubs)) {
      expect(club.power).toBeGreaterThanOrEqual(45);
      expect(club.power).toBeLessThanOrEqual(92);
    }
  });

  it('승격 불가 구단(B팀)은 2부 1위여도 올라가지 않고 다음 순위 팀이 승격한다', () => {
    const state = createCareer(input({ clubId: 'real-madrid', nationality: 'ESP' }), { seed: 8 });
    const world = worldOf(state);
    const rows = (leagueId: string, first?: string): StandingRow[] => {
      const ids = Object.values(state.clubs).filter((c) => c.leagueId === leagueId).map((c) => c.clubId);
      const ordered = first ? [first, ...ids.filter((id) => id !== first)] : ids;
      return ordered.map((clubId, i) => ({ clubId, position: i + 1, points: 90 - i, played: 42, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }));
    };
    const tables = Object.fromEntries(Object.keys(world.leagues).map((id) => [id, rows(id, id === 'ESP_L2' ? 'real-sociedad-b' : undefined)]));
    const moved = applyPromotionRelegation(world, state.clubs, tables);
    expect(moved.clubs['real-sociedad-b'].leagueId).toBe('ESP_L2');
    for (const row of tables.ESP_L2.slice(1, 4)) expect(moved.clubs[row.clubId].leagueId).toBe('ESP_LALIGA');
    expect(Object.values(moved.clubs).filter((c) => c.leagueId === 'ESP_LALIGA')).toHaveLength(20);
  });
});

describe('시상 · 기록 · 레전드', () => {
  it('리그 수준이 낮을수록 세계 시상에서 덜 인정받는다', () => {
    expect(leagueRecognition(78)).toBeGreaterThan(leagueRecognition(64));
  });

  it('같은 활약이면 수비수의 발롱도르 점수가 공격수보다 낮다', () => {
    const forward = createCareer(input({ clubId: 'arsenal', nationality: 'ENG' }), { seed: 9 });
    const defender = createCareer(input({ clubId: 'arsenal', nationality: 'ENG', role: { position: 'CB', playStyle: 'STOPPER' } }), { seed: 9 });
    expect(ballonScore(defender, worldOf(defender))).toBeLessThanOrEqual(ballonScore(forward, worldOf(forward)));
  });

  it('구단 역대 기록을 넘으면 기존 보유자를 언급하는 팝업 알림이 뜬다', () => {
    const state = createCareer(input({ clubId: 'arsenal', nationality: 'ENG' }), { seed: 10 });
    const before = { ...state, careerByClub: { arsenal: { appearances: 300, goals: 228, assists: 50, cleanSheets: 0, trophies: 2, firstSeason: 2026, lastSeason: 2036 } } };
    const after = { ...before, careerByClub: { arsenal: { ...before.careerByClub.arsenal, goals: 229 } } };
    const checked = checkRecordBreaks(after, worldOf(after), before);
    expect(checked.recordBreaks).toHaveLength(1);
    expect(checked.notices[0].body).toContain('티에리 앙리');
    expect(checked.notices[0].popup).toBe(true);
  });

  it('대기록을 남기고 떠나면 동 포지션 레전드와 함께 헌액된다 (데이터 없는 구단은 언급 생략)', () => {
    const state = createCareer(input({ clubId: 'arsenal', nationality: 'ENG' }), { seed: 11 });
    const legendary = { ...state, careerByClub: { arsenal: { appearances: 320, goals: 150, assists: 40, cleanSheets: 0, trophies: 4, firstSeason: 2026, lastSeason: 2038 }, daegu: { appearances: 320, goals: 150, assists: 40, cleanSheets: 0, trophies: 4, firstSeason: 2026, lastSeason: 2038 } } };
    const arsenal = evaluateDeparture(legendary, worldOf(legendary), 'arsenal', 'TRANSFER');
    expect(arsenal.legends[0].comparedWith).toContain('티에리 앙리');
    const daegu = evaluateDeparture(legendary, worldOf(legendary), 'daegu', 'RETIREMENT');
    expect(daegu.legends[0].comparedWith).toEqual([]);
    expect(daegu.legends[0].tribute).toContain('레전드');
  });
});

describe('영혼의 파트너', () => {
  it('3턴 연속 주전 이후에만 생기고, 주인공이 팀을 떠나면 옛 파트너가 된다', () => {
    const base = createCareer(input({ clubId: 'arsenal', nationality: 'ENG' }), { seed: 12 });
    const regular = { ...base, player: { ...base.player, squad: { level: 'FIRST_TEAM' as const, playingTime: 'STARTER' as const, standing: 70 } } };
    expect(maybeFormPartner({ ...regular, streaks: { starterTurnsAtClub: 1, freeAgentTurns: 0 } }, worldOf(base)).partner).toBeNull();

    let formed: GameState | null = null;
    for (let season = 2026; season < 2060 && !formed; season++) {
      const attempt = maybeFormPartner({ ...regular, turn: { season, phase: 'FIRST_HALF' }, streaks: { starterTurnsAtClub: 5, freeAgentTurns: 0 } }, worldOf(base));
      if (attempt.partner) formed = attempt;
    }
    expect(formed).not.toBeNull();
    const npc = formed!.npcs[formed!.partner!.npcId];
    expect(npc.clubId).toBe('arsenal');
    expect(['STRIKE_DUO', 'STRIKER_PLAYMAKER']).toContain(formed!.partner!.bondType);

    const separated = separatePartnerIfLeaving(formed!, worldOf(base), 'arsenal');
    expect(separated.partner).toBeNull();
    expect(separated.formerPartners[0].npcId).toBe(npc.id);
  });
});
