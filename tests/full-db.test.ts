/**
 * 실제 외부 구단 DB(data/external/club-db.json · 47개 리그 801개 구단)로 게임이 돌아가는지 검사한다.
 * 다른 테스트는 내장 샘플로 고정돼 있으므로(vitest.config.mts의 FO_CAR_DB=sample),
 * 여기서는 환경 변수를 바꾼 뒤 모듈을 새로 불러온다.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { GameDatabase } from '@/data/dbLoader';
import type { Proximity } from '@/engine/transfer';
import type { SimulationWorld } from '@/engine/world';

let db: GameDatabase;
let world: SimulationWorld;
let mod: {
  career: typeof import('@/engine/career');
  autoplay: typeof import('@/engine/autoplay');
  transfer: typeof import('@/engine/transfer');
  league: typeof import('@/engine/league');
  worldMod: typeof import('@/engine/world');
  rng: typeof import('@/engine/rng');
};

beforeAll(async () => {
  vi.stubEnv('FO_CAR_DB', 'full');
  vi.resetModules();
  db = (await import('@/data/database')).DATABASE;
  mod = {
    career: await import('@/engine/career'),
    autoplay: await import('@/engine/autoplay'),
    transfer: await import('@/engine/transfer'),
    league: await import('@/engine/league'),
    worldMod: await import('@/engine/world'),
    rng: await import('@/engine/rng'),
  };
  world = mod.career.BASE_WORLD;
}, 60_000);

const club = (name: string, nation: string) => {
  const id = mod.worldMod.findClubId(db.clubs, name, nation);
  if (!id) throw new Error(`구단 없음: ${name}`);
  return db.clubs[id];
};

describe('전체 구단 DB', () => {
  it('47개 리그 801개 구단이 모두 활성화되고, 리그별 팀 수가 슬롯과 맞는다', () => {
    expect(Object.keys(db.leagues)).toHaveLength(47);
    expect(Object.keys(db.clubs)).toHaveLength(801);
    expect(db.report.leagues.every((l) => l.active && l.source === 'EXTERNAL')).toBe(true);
    expect(db.report.warnings).toEqual([]);
    expect(db.report.scaledFiles).toContain('club-db.json');
    expect(db.report.derbiesLinked).toBeGreaterThanOrEqual(240);
  });

  it('엑셀의 구단 정보(한글 이름 · 유니폼 색 · 레전드 · 직전 시즌)가 그대로 들어온다', () => {
    const arsenal = club('Arsenal', 'ENG');
    expect(arsenal.nameKo).toBe('아스널');
    expect(arsenal.leagueId).toBe('ENG_PL');
    expect(arsenal.kitColors).toEqual({ primary: '#EF0107', secondary: null });
    expect(arsenal.lastSeason).toMatchObject({ leagueRank: 1, movement: null, continental: 'UEFA_CL' });
    expect(arsenal.legends?.find((l) => l.position === 'ST')?.name).toBe('티에리 앙리');
    expect(db.records.some((r) => r.holderName === '티에리 앙리' && r.value === 228)).toBe(true);
    // 실력은 엔진 척도로 환산 (DB 92 → 66 + 0.7 × 26)
    expect(arsenal.power).toBeCloseTo(84.2, 0);
    // 더비 목록 연결
    expect(arsenal.rivals).toContain(club('Tottenham', 'ENG').id);
  });

  it('줄무늬 유니폼은 제2색을 가진다', () => {
    const striped = Object.values(db.clubs).filter((c) => c.kitColors.secondary);
    expect(striped.length).toBeGreaterThan(80);
    for (const c of striped) expect(c.kitColors.secondary).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('첫 시즌 대륙 대회 진출은 엑셀의 다음 대륙컵 값을 따른다', () => {
    const ucl = Object.values(world.clubStates).filter((cs) => cs.continentalCompetitionId === 'UEFA_CL');
    expect(ucl.length).toBeGreaterThanOrEqual(30);
    expect(world.clubStates[club('Arsenal', 'ENG').id].continentalCompetitionId).toBe('UEFA_CL');
  });

  it('주요 리그 한 시즌의 경기당 득점이 현실 범위에 있다', () => {
    for (const leagueId of ['ENG_PL', 'ESP_LALIGA', 'KOR_K1', 'BRA_SA', 'THA_T1']) {
      const table = mod.league.simulateFullSeason(world, leagueId, 11, 2026);
      const games = table.reduce((n, r) => n + r.played, 0) / 2;
      const goals = table.reduce((n, r) => n + r.goalsFor, 0);
      expect(goals / games, leagueId).toBeGreaterThan(2.0);
      expect(goals / games, leagueId).toBeLessThan(3.6);
    }
  });

  it('한국 유망주 오퍼는 자국 중심이고 먼 나라 구단 수에 밀리지 않는다', () => {
    const youth = mod.career.createCareer(
      { name: '유망주', nationality: 'KOR', role: { position: 'ST', playStyle: 'POACHER' }, heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' }, clubId: club('Ulsan', 'KOR').id },
      { seed: 3 },
    );
    const state = { ...youth, player: { ...youth.player, age: 18, ovr: 62 } };
    const rng = mod.rng.rngFor(9, 'full-db-offers');
    const counts: Record<Proximity, number> = { SAME_NATION: 0, NEIGHBOR: 0, SAME_CONFEDERATION: 0, ELSEWHERE: 0 };
    let total = 0;
    for (let i = 0; i < 500; i++) {
      const id = mod.transfer.pickOfferClub(state, world, 'TRANSFER', new Set([state.player.contract!.clubId]), rng);
      if (!id) continue;
      counts[mod.transfer.playerProximity(state, world, id)]++;
      total++;
    }
    expect(total).toBeGreaterThan(400);
    expect(counts.SAME_NATION / total).toBeGreaterThan(0.5);
    expect(counts.ELSEWHERE / total).toBeLessThan(0.15);
  });

  it('16세부터 은퇴까지 커리어가 끝까지 진행된다', () => {
    const state = mod.autoplay.simulateCareer(
      { name: '김유망', nationality: 'KOR', role: { position: 'ST', playStyle: 'POACHER' }, heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' }, clubId: club('Ulsan', 'KOR').id },
      1,
    );
    expect(state.player.retired).toBe(true);
    expect(state.history.length).toBeGreaterThanOrEqual(15);
    for (const spell of state.player.clubHistory) expect(db.clubs[spell.clubId], spell.clubId).toBeDefined();
  }, 30_000);
});
