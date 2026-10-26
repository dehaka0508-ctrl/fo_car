import { describe, expect, it } from 'vitest';
import example from '../data/external/_examples/ITA_SA.example.json';
import { CLUBS } from '@/data/clubs';
import { DATABASE } from '@/data/database';
import { buildDatabase, normalizeColor, normalizeKitColors, normalizeLegends, resolveLeague } from '@/data/dbLoader';
import { LEAGUE_SLOTS } from '@/data/leagues';
import { NATIONS } from '@/data/nations';
import { BASE_WORLD, createCareer } from '@/engine/career';
import { syncSaveWithDatabase } from '@/engine/dbSync';
import { simulateFullSeason } from '@/engine/league';
import { applyPromotionRelegation } from '@/engine/seasonEnd';
import { offerRegionShares, pickOfferClub, playerProximity, proximity, type Proximity } from '@/engine/transfer';
import { rngFor } from '@/engine/rng';
import { createInitialClubStates, legendsFor, type SimulationWorld } from '@/engine/world';

const serieA = { path: 'ITA_SA.json', data: example };

function worldFrom(db: ReturnType<typeof buildDatabase>): SimulationWorld {
  return { ...BASE_WORLD, leagues: db.leagues, clubs: db.clubs, legends: db.legends, records: db.records, clubStates: createInitialClubStates(db.leagues, db.clubs) };
}

describe('리그 슬롯', () => {
  it('기획서의 전체 대상 리그 47개가 정의되어 있다', () => {
    const slots = Object.values(LEAGUE_SLOTS);
    expect(slots).toHaveLength(47);
    const top5 = ['ENG', 'ESP', 'GER', 'ITA', 'FRA'];
    for (const nation of top5) expect(slots.filter((l) => l.nation === nation).map((l) => l.tier).sort()).toEqual([1, 2]);
    expect(slots.filter((l) => l.nation === 'KOR').map((l) => l.tier).sort()).toEqual([1, 2]);
    expect(slots.filter((l) => l.confederation === 'UEFA' && !top5.includes(l.nation))).toHaveLength(16);
    expect(new Set(slots.filter((l) => l.confederation === 'AFC').map((l) => l.nation)).size).toBe(9);
    expect(slots.filter((l) => ['CONMEBOL', 'CONCACAF'].includes(l.confederation))).toHaveLength(7);
    expect(slots.filter((l) => l.confederation === 'CAF')).toHaveLength(4);
  });

  it('모든 슬롯의 국가·국내 컵·상하부 리그 연결이 유효하다', () => {
    for (const league of Object.values(LEAGUE_SLOTS)) {
      expect(NATIONS[league.nation], league.id).toBeDefined();
      expect(BASE_WORLD.competitions[league.domesticCupId], league.id).toBeDefined();
      if (league.lowerLeagueId) expect(LEAGUE_SLOTS[league.lowerLeagueId].upperLeagueId).toBe(league.id);
      for (const slot of league.continentalSlots) expect(BASE_WORLD.competitions[slot.competitionId], league.id).toBeDefined();
    }
  });

  it('외부 DB가 없으면 내장 샘플 8개 리그만 활성화된다', () => {
    expect(Object.keys(DATABASE.leagues).sort()).toEqual(['ENG_CH', 'ENG_PL', 'ESP_L2', 'ESP_LALIGA', 'KOR_K1', 'KOR_K2', 'KSA_SPL', 'USA_MLS']);
    expect(Object.keys(DATABASE.clubs)).toHaveLength(Object.keys(CLUBS).length);
  });
});

describe('외부 JSON 정규화', () => {
  it("kitColors.secondary가 '' · none · primary와 같은 색이면 null(단색)", () => {
    expect(normalizeKitColors({ kitColors: { primary: '#12A0D7', secondary: '' } }).kit).toEqual({ primary: '#12A0D7', secondary: null });
    expect(normalizeKitColors({ kitColors: { primary: '#12A0D7', secondary: '' } }).emptySecondary).toBe(true);
    expect(normalizeKitColors({ kitColors: { primary: 'red', secondary: 'none' } }).kit.secondary).toBeNull();
    expect(normalizeKitColors({ kitColors: { primary: '#ffffff', secondary: '#FFF' } }).kit.secondary).toBeNull();
    expect(normalizeKitColors({ primaryColor: '8e1f2f', secondaryColor: 'fff' }).kit).toEqual({ primary: '#8E1F2F', secondary: '#FFFFFF' });
    expect(normalizeKitColors({ colors: ['#1E71B8', '#000000'] }).kit).toEqual({ primary: '#1E71B8', secondary: '#000000' });
    expect(normalizeColor(null)).toBeNull();
  });

  it('legends가 null·누락이면 null, 불완전한 항목은 버리고 포지션 표기를 맞춘다', () => {
    expect(normalizeLegends(null, NATIONS).legends).toBeNull();
    expect(normalizeLegends(undefined, NATIONS).legends).toBeNull();
    const { legends, dropped } = normalizeLegends(
      [{ name: '자친토 파케티', position: 'DF', nationality: 'Italy' }, { name: '이름만' }, 'oops', { position: 'GK' }],
      NATIONS,
    );
    expect(legends).toEqual([{ name: '자친토 파케티', position: 'CB', nationality: 'ITA', era: '' }]);
    expect(dropped).toBe(3);
  });

  it('리그를 id · 별칭 · 한글명 · {country, tier} · 파일 이름으로 찾는다', () => {
    expect(resolveLeague('ITA_SA', 'x', LEAGUE_SLOTS, NATIONS)?.id).toBe('ITA_SA');
    expect(resolveLeague('Serie A', 'x', LEAGUE_SLOTS, NATIONS)?.id).toBe('ITA_SA');
    expect(resolveLeague('세리에 B', 'x', LEAGUE_SLOTS, NATIONS)?.id).toBe('ITA_SB');
    expect(resolveLeague('EPL', 'x', LEAGUE_SLOTS, NATIONS)?.id).toBe('ENG_PL');
    expect(resolveLeague({ country: 'Germany', tier: 2 }, 'x', LEAGUE_SLOTS, NATIONS)?.id).toBe('GER_BL2');
    expect(resolveLeague(null, 'JPN_J1', LEAGUE_SLOTS, NATIONS)?.id).toBe('JPN_J1');
    expect(resolveLeague('없는 리그', 'nothing', LEAGUE_SLOTS, NATIONS)).toBeNull();
  });
});

describe('외부 DB 병합', () => {
  const db = buildDatabase({ files: [serieA] });

  it('새 리그(세리에 A)가 활성화되고 구단이 정규화되어 들어온다', () => {
    expect(db.leagues.ITA_SA).toBeDefined();
    expect(db.report.leagues.find((l) => l.id === 'ITA_SA')).toMatchObject({ source: 'EXTERNAL', clubs: 6, active: true });
    expect(db.clubs.napoli.kitColors).toEqual({ primary: '#12A0D7', secondary: null });
    expect(db.clubs.inter.kitColors.secondary).toBe('#000000');
    // id 없이 들어온 구단은 이름으로 id를 만든다
    expect(db.clubs['as-roma']).toMatchObject({ nameKo: 'AS 로마', power: 79, prestige: 80, finance: 72, kitColors: { primary: '#8E1F2F', secondary: null } });
    expect(db.report.fixes.emptySecondary).toBe(2);
  });

  it('하부 리그(세리에 B)가 비어 있으면 승강 연결을 끈다', () => {
    expect(db.leagues.ITA_SA.lowerLeagueId).toBeUndefined();
    expect(db.leagues.ITA_SA.relegationSlots).toBe(0);
    expect(db.leagues.ITA_SB).toBeUndefined();
  });

  it('더비 상대는 id·이름으로 찾고 없는 구단은 버린다', () => {
    expect(db.clubs.milan.rivals).toEqual(['inter']);
    expect(db.clubs.juventus.rivals).toEqual(['inter']); // torino는 데이터에 없음
    expect(db.report.fixes.droppedRivals).toBeGreaterThanOrEqual(1);
  });

  it('레전드: 외부 데이터 우선, null·누락이면 생략(빈 목록), 기록은 기존 기록에 더해진다', () => {
    const world = worldFrom(db);
    expect(legendsFor(world, 'inter').map((l) => l.position)).toEqual(['RB', 'ST', 'CB']);
    expect(legendsFor(world, 'milan')).toHaveLength(1);
    expect(legendsFor(world, 'napoli')).toEqual([]);
    expect(db.report.fixes.missingLegends).toBeGreaterThanOrEqual(1);
    expect(db.records.some((r) => r.scopeId === 'inter' && r.category === 'APPEARANCES' && r.value === 858)).toBe(true);
  });

  it('병합된 리그로 시즌 순위표를 시뮬레이션할 수 있다', () => {
    const table = simulateFullSeason(worldFrom(db), 'ITA_SA', 7, 2026);
    expect(table).toHaveLength(6);
    expect(table[0].played).toBe(10);
    // 하부 리그가 없으니 강등도 없다
    const world = worldFrom(db);
    const result = applyPromotionRelegation(world, world.clubStates, { ITA_SA: table, ...Object.fromEntries(Object.keys(world.leagues).filter((id) => id !== 'ITA_SA').map((id) => [id, simulateFullSeason(world, id, 7, 2026)])) });
    expect([...result.relegated].some((id) => world.clubs[id].leagueId === 'ITA_SA')).toBe(false);
  });

  it('외부 DB에 들어온 리그는 내장 샘플 구단을 통째로 대체한다', () => {
    const epl = buildDatabase({
      files: [{ path: 'epl.json', data: [1, 2, 3, 4, 5].map((i) => ({ name: `Club ${i}`, league: 'EPL', power: 70 + i, kitColors: { primary: '#123456', secondary: '' } })) }],
    });
    expect(Object.values(epl.clubs).filter((c) => c.leagueId === 'ENG_PL')).toHaveLength(5);
    expect(epl.clubs.arsenal).toBeUndefined();
    expect(epl.leagues.ENG_PL.lowerLeagueId).toBe('ENG_CH');
    expect(epl.signature).not.toBe(DATABASE.signature);
  });

  it('구단이 4개 미만인 리그는 활성화하지 않고 경고한다', () => {
    const tiny = buildDatabase({ files: [{ path: 'GRE_SL.json', data: { clubs: [{ name: 'Olympiacos' }, { name: 'Panathinaikos' }] } }] });
    expect(tiny.leagues.GRE_SL).toBeUndefined();
    expect(tiny.report.warnings.some((w) => w.includes('비활성'))).toBe(true);
  });
});

describe('세이브 ↔ DB 동기화', () => {
  it('내장 샘플 구단이 외부 DB의 같은 구단(다른 id)으로 바뀌면 이름으로 찾아 옮긴다', () => {
    const state = createCareer(
      { name: '테스트', nationality: 'KOR', role: { position: 'ST', playStyle: 'POACHER' }, heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' }, clubId: 'ulsan' },
      { seed: 3 },
    );
    const k1 = ['Ulsan HD', 'Pohang Steelers', 'Jeonbuk Hyundai Motors', 'FC Seoul'].map((name) => ({
      id: `kor_1_${name.toLowerCase().replace(/ /g, '_')}`,
      name,
      kitColors: { primary: '#1D4DA1', secondary: '' },
    }));
    const db = buildDatabase({ files: [{ path: 'k1.json', data: { league: 'KOR_K1', clubs: k1 } }] });
    const synced = syncSaveWithDatabase(state, worldFrom(db), db.signature);
    expect(synced.player.contract?.clubId).toBe('kor_1_ulsan_hd');
    expect(synced.player.clubHistory[0].clubId).toBe('kor_1_ulsan_hd');
    expect(synced.clubs.ulsan).toBeUndefined();
    expect(synced.clubs.kor_1_ulsan_hd.power).toBe(state.clubs.ulsan.power);
    expect(synced.notices.some((n) => n.title === '구단 데이터 갱신')).toBe(true);
    expect(synced.notices.some((n) => n.title === '구단 데이터 변경')).toBe(false);
  });

  it('소속 구단이 사라지면 FA가 되고, 새 구단은 추가된다', () => {
    const state = createCareer(
      { name: '테스트', nationality: 'ENG', role: { position: 'ST', playStyle: 'POACHER' }, heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' }, clubId: 'arsenal' },
      { seed: 3 },
    );
    const db = buildDatabase({
      files: [serieA, { path: 'epl.json', data: { league: 'ENG_PL', clubs: [1, 2, 3, 4].map((i) => ({ name: `New ${i}` })) } }],
    });
    const synced = syncSaveWithDatabase(state, worldFrom(db), db.signature);
    expect(synced.player.contract).toBeNull();
    expect(synced.clubs.arsenal).toBeUndefined();
    expect(synced.clubs.inter).toBeDefined();
    expect(synced.notices[0].title).toBe('구단 데이터 변경');
    expect(synced.dbSignature).toBe(db.signature);
    // 서명이 같으면 그대로
    expect(syncSaveWithDatabase(synced, worldFrom(db), db.signature)).toBe(synced);
  });
});

describe('이적 지역성', () => {
  const youth = createCareer(
    { name: '유망주', nationality: 'KOR', role: { position: 'ST', playStyle: 'POACHER' }, heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' }, clubId: 'ulsan' },
    { seed: 5 },
  );

  it('국가 관계를 같은 나라 → 인접국 → 같은 대륙 → 그 밖으로 구분한다', () => {
    expect(proximity(BASE_WORLD, 'KOR', 'pohang')).toBe('SAME_NATION');
    expect(proximity(BASE_WORLD, 'ENG', 'real-madrid')).toBe('SAME_CONFEDERATION');
    expect(proximity(BASE_WORLD, 'ESP', 'real-madrid')).toBe('SAME_NATION');
    expect(proximity(BASE_WORLD, 'KOR', 'al-hilal')).toBe('SAME_CONFEDERATION');
    expect(proximity(BASE_WORLD, 'KOR', 'arsenal')).toBe('ELSEWHERE');
  });

  /** 오퍼 n개를 뽑아 권역별 비율을 센다 */
  function regionMix(state: typeof youth, mode: 'TRANSFER' | 'LOAN', n = 600) {
    const rng = rngFor(42, 'region-mix');
    const counts: Record<Proximity, number> = { SAME_NATION: 0, NEIGHBOR: 0, SAME_CONFEDERATION: 0, ELSEWHERE: 0 };
    let total = 0;
    for (let i = 0; i < n; i++) {
      const id = pickOfferClub(state, BASE_WORLD, mode, new Set([state.player.contract!.clubId]), rng);
      if (!id) continue;
      counts[playerProximity(state, BASE_WORLD, id)]++;
      total++;
    }
    return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / Math.max(1, total)])) as Record<Proximity, number>;
  }

  it('유망주 오퍼는 권역을 먼저 정해 자국 중심으로 온다 (먼 나라 구단 수에 밀리지 않는다)', () => {
    const shares = offerRegionShares(youth)!;
    expect(shares.SAME_NATION).toBeGreaterThan(0.5);
    expect(shares.ELSEWHERE).toBeLessThan(0.1);
    const mix = regionMix(youth, 'TRANSFER');
    expect(mix.SAME_NATION).toBeGreaterThan(0.5);
    expect(mix.ELSEWHERE).toBeLessThan(0.15);
  });

  it('임대는 더 강하게 자국 중심이고, 자국 하부 리그를 선호한다', () => {
    // 1군 경쟁이 어려운 19세 (임대 대상 구단이 생기는 실력)
    const loanee = { ...youth, player: { ...youth.player, age: 19, ovr: 64 } };
    const mix = regionMix(loanee, 'LOAN');
    expect(mix.SAME_NATION).toBeGreaterThan(0.65);
    expect(mix.ELSEWHERE).toBeLessThan(0.08);
  });

  it('명성이 오르면 해외 비중이 커지고, 스타에게는 권역 제한이 없다', () => {
    const known = { ...youth, player: { ...youth.player, age: 25, reputation: 55 } };
    expect(offerRegionShares(known)!.SAME_NATION).toBeLessThan(offerRegionShares(youth)!.SAME_NATION);
    expect(offerRegionShares(known)!.ELSEWHERE).toBeGreaterThan(offerRegionShares(youth)!.ELSEWHERE);
    const star = { ...youth, player: { ...youth.player, age: 27, reputation: 80 } };
    expect(offerRegionShares(star)).toBeNull();
  });
});
