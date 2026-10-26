/**
 * 발롱도르 점수 보정용 기준 시즌.
 * scripts/sim-ballon.ts(표 출력)와 tests/awards-calibration.test.ts(회귀 테스트)가 함께 쓴다.
 * 각 기준 시즌의 점수를 NPC 후보 풀 2,000개와 비교해 순위 분포를 낸다.
 */
import { ballonBreakdown, npcBallonScores, type BallonBreakdown, type SeasonPerformance } from '@/engine/awards';
import { emptyStatsByCompetition } from '@/engine/character';
import { createRng } from '@/engine/rng';
import type { SimulationWorld } from '@/engine/world';
import type { PlayerStatLine, PositionGroup, TrophyWin } from '@/types/game';

interface LineSpec {
  apps: number;
  rating: number;
  g?: number;
  a?: number;
  kp?: number;
  cs?: number;
}

function line(l: LineSpec): PlayerStatLine {
  return {
    appearances: l.apps,
    starts: l.apps,
    minutes: l.apps * 85,
    goals: l.g ?? 0,
    assists: l.a ?? 0,
    cleanSheets: l.cs ?? 0,
    saves: 0,
    keyPasses: l.kp ?? 0,
    ratingSum: l.rating * l.apps,
  };
}

function club(id: string): TrophyWin {
  return { competitionId: id, season: 2030, teamId: 'club', teamKind: 'CLUB' };
}
function nation(id: string): TrophyWin {
  return { competitionId: id, season: 2030, teamId: 'nation:XXX', teamKind: 'NATION' };
}

/** 클럽 기록의 72%를 리그, 나머지를 대륙 대회로 나눈다 */
function season(
  group: PositionGroup,
  clubLine: LineSpec,
  intl: LineSpec | null,
  trophies: TrophyWin[],
  leagueStrength = 78,
  reputation = 80,
): SeasonPerformance {
  const stats = emptyStatsByCompetition();
  const split = (v = 0) => Math.round(v * 0.72);
  stats.LEAGUE = line({ ...clubLine, apps: split(clubLine.apps), g: split(clubLine.g), a: split(clubLine.a), kp: split(clubLine.kp), cs: split(clubLine.cs) });
  stats.CONTINENTAL = line({
    ...clubLine,
    apps: clubLine.apps - stats.LEAGUE.appearances,
    g: (clubLine.g ?? 0) - stats.LEAGUE.goals,
    a: (clubLine.a ?? 0) - stats.LEAGUE.assists,
    kp: (clubLine.kp ?? 0) - stats.LEAGUE.keyPasses,
    cs: (clubLine.cs ?? 0) - stats.LEAGUE.cleanSheets,
  });
  if (intl) stats.INTERNATIONAL = line(intl);
  return { group, stats, trophies, leagueStrength, reputation, eligibleMatches: 52 };
}

export interface BallonTarget {
  /** 1위 확률 범위 */
  win?: [number, number];
  /** 3위 이내 확률 범위 */
  podium?: [number, number];
  /** 중앙 순위 범위 */
  medianRank?: [number, number];
}

export interface BallonReference {
  label: string;
  season: SeasonPerformance;
  target: BallonTarget;
}

export const BALLON_REFERENCES: BallonReference[] = [
  { label: '공격수 36골 · UCL+리그 더블', season: season('FORWARD', { apps: 48, rating: 7.65, g: 36, a: 7, kp: 30 }, { apps: 6, rating: 7.2, g: 4 }, [club('ENG_PL'), club('UEFA_CL')]), target: { win: [0.6, 1] } },
  { label: '공격수 30골 · 리그 우승', season: season('FORWARD', { apps: 46, rating: 7.45, g: 30, a: 5, kp: 25 }, { apps: 6, rating: 7.0, g: 3 }, [club('ENG_PL')]), target: { medianRank: [4, 10] } },
  { label: '공격수 22골 · 무관', season: season('FORWARD', { apps: 40, rating: 7.2, g: 22, a: 4, kp: 20 }, { apps: 5, rating: 6.9, g: 2 }, [], 78, 65), target: { medianRank: [16, 30] } },
  { label: '공격수 50골 · 트레블', season: season('FORWARD', { apps: 52, rating: 7.95, g: 50, a: 10, kp: 40 }, { apps: 6, rating: 7.3, g: 5 }, [club('ENG_PL'), club('UEFA_CL'), club('ENG_FA_CUP')]), target: { win: [0.95, 1] } },
  { label: '공격수 사우디 40골 · AFC 더블', season: season('FORWARD', { apps: 44, rating: 7.8, g: 40, a: 2, kp: 14 }, { apps: 6, rating: 7.1, g: 3 }, [club('KSA_SPL'), club('KSA_KINGS_CUP'), club('AFC_CL')], 67), target: { win: [0, 0.1], medianRank: [5, 16] } },
  { label: '플레이메이커 20도움 · UCL+리그', season: season('MIDFIELDER', { apps: 48, rating: 7.35, g: 7, a: 20, kp: 100 }, { apps: 6, rating: 7.0, g: 1, a: 2 }, [club('ENG_PL'), club('UEFA_CL')]), target: { win: [0.15, 0.55], podium: [0.5, 0.9] } },
  { label: '플레이메이커 20도움 · 무관', season: season('MIDFIELDER', { apps: 48, rating: 7.35, g: 7, a: 20, kp: 100 }, { apps: 6, rating: 7.0, g: 1, a: 2 }, []), target: { medianRank: [10, 22] } },
  { label: '박스 투 박스 · UCL+리그', season: season('MIDFIELDER', { apps: 48, rating: 7.4, g: 8, a: 12, kp: 45 }, { apps: 6, rating: 7.0, g: 1 }, [club('ENG_PL'), club('UEFA_CL')]), target: { medianRank: [2, 8] } },
  { label: '딥 라잉 PM · UCL+리그+유로', season: season('MIDFIELDER', { apps: 50, rating: 7.25, g: 4, a: 10, kp: 50 }, { apps: 7, rating: 7.2, a: 1 }, [club('ENG_PL'), club('UEFA_CL'), nation('EURO')]), target: { win: [0.08, 0.35], podium: [0.35, 0.75] } },
  { label: '센터백 · UCL+리그', season: season('DEFENDER', { apps: 50, rating: 7.4, g: 4, a: 1, kp: 4, cs: 25 }, { apps: 6, rating: 7.0, cs: 2 }, [club('ESP_LALIGA'), club('UEFA_CL')], 76), target: { win: [0.03, 0.25], podium: [0.25, 0.6] } },
  { label: '센터백 · 리그 우승만', season: season('DEFENDER', { apps: 50, rating: 7.3, g: 3, a: 1, kp: 4, cs: 22 }, { apps: 6, rating: 7.0, cs: 2 }, [club('ESP_LALIGA')], 76), target: { win: [0, 0], medianRank: [14, 30] } },
  { label: '골키퍼 · 월드컵+리그', season: season('GOALKEEPER', { apps: 48, rating: 7.45, cs: 24 }, { apps: 7, rating: 7.3, cs: 4 }, [club('ESP_LALIGA'), nation('WORLD_CUP')], 76), target: { win: [0.03, 0.22], podium: [0.25, 0.6] } },
  { label: '골키퍼 · 리그 우승만', season: season('GOALKEEPER', { apps: 48, rating: 7.3, cs: 20 }, null, [club('ENG_PL')]), target: { win: [0, 0], medianRank: [14, 30] } },
];

export interface RankDistribution {
  breakdown: BallonBreakdown;
  win: number;
  podium: number;
  medianRank: number;
}

/** 기준 시즌 점수를 NPC 후보 풀(pools개)과 비교한 순위 분포 */
export function rankDistribution(world: SimulationWorld, perf: SeasonPerformance, pools = 2000): RankDistribution {
  const breakdown = ballonBreakdown(world, perf);
  const ranks: number[] = [];
  for (let i = 0; i < pools; i++) {
    const scores = npcBallonScores(createRng(1000 + i));
    ranks.push(scores.filter((n) => n.score > breakdown.total).length + 1);
  }
  ranks.sort((a, b) => a - b);
  return {
    breakdown,
    win: ranks.filter((r) => r === 1).length / pools,
    podium: ranks.filter((r) => r <= 3).length / pools,
    medianRank: ranks[Math.floor(pools / 2)],
  };
}
