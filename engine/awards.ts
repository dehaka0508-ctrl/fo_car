/**
 * 개인상 시상
 *
 * 주인공의 시즌 기록으로 '임팩트 점수'를 만들고, 같은 시즌의 NPC 후보들과 비교해 수상을 정한다.
 * - 리그 시상 (후반기 종료): 득점왕 · 도움왕 · MVP · 베스트 11
 * - 세계 시상 (프리시즌 종료, 국제대회 포함): 발롱도르(순위) · FIFA 올해의 선수 · 월드 베스트 11 ·
 *   대륙별 올해의 선수 · 국가별 올해의 선수
 * 수비수·골키퍼는 발롱도르 점수 보정이 낮아 수상이 어렵지만, 압도적인 평점·클린시트·우승이 있으면 가능하다.
 */
import { POSITION_META } from '@/data/playstyles';
import type {
  AwardType,
  AwardWin,
  Ceremony,
  CeremonyEntry,
  CompetitionType,
  Confederation,
  GameState,
  ID,
  PlayerStatLine,
  PositionGroup,
  TrophyWin,
  TurnResult,
} from '@/types/game';
import { emptyStatsByCompetition } from './character';
import { generateName, pickNationality } from './npc';
import { clamp, rngFor, type Rng } from './rng';
import { averageRating, mergeStatLines } from './simulator';
import { clubName, getLeagueClubIds, type SimulationWorld } from './world';

// ----------------------------------------------------------------------------
// 임팩트 점수
// ----------------------------------------------------------------------------

const OUTPUT_WEIGHTS: Record<PositionGroup, { goal: number; assist: number; keyPass: number; cleanSheet: number }> = {
  FORWARD: { goal: 1.0, assist: 0.7, keyPass: 0.03, cleanSheet: 0 },
  MIDFIELDER: { goal: 1.2, assist: 0.9, keyPass: 0.08, cleanSheet: 0.15 },
  DEFENDER: { goal: 1.5, assist: 1.0, keyPass: 0.05, cleanSheet: 0.6 },
  GOALKEEPER: { goal: 2, assist: 1.5, keyPass: 0, cleanSheet: 0.8 },
};

/** 출전 비율 보정: 시즌 경기의 70% 이상 뛰어야 평점 점수를 온전히 받는다 */
function appearanceFactor(line: PlayerStatLine, eligibleMatches: number): number {
  return Math.min(1, line.appearances / Math.max(10, eligibleMatches * 0.7));
}

/** 리그 시상(MVP·베스트 11)용 임팩트 점수 */
export function impactScore(line: PlayerStatLine, group: PositionGroup, eligibleMatches: number): number {
  const rating = averageRating(line);
  if (rating === null) return 0;
  const w = OUTPUT_WEIGHTS[group];
  return (
    (rating - 6.5) * 20 * appearanceFactor(line, eligibleMatches) +
    line.goals * w.goal +
    line.assists * w.assist +
    (line.keyPasses ?? 0) * w.keyPass +
    line.cleanSheets * w.cleanSheet
  );
}

const TROPHY_POINTS: Record<string, number> = {
  UEFA_CL: 14, UEFA_EL: 5, UEFA_ECL: 2.5, AFC_CL: 3.5, CONMEBOL_LIB: 7, CONCACAF_CC: 2.5, CAF_CL: 3.5,
  WORLD_CUP: 20, EURO: 12, COPA_AMERICA: 12, ASIAN_CUP: 5, AFCON: 5, GOLD_CUP: 3, NATIONS_LEAGUE: 3, OLYMPICS: 2,
};

/** 더블·압도 보너스에서 각 대륙 최상위 클럽 대회의 무게 (UCL 기준) */
const CONTINENTAL_WEIGHT: Record<string, number> = { UEFA_CL: 1, CONMEBOL_LIB: 0.7, AFC_CL: 0.4, CAF_CL: 0.4, CONCACAF_CC: 0.35 };

/** 우승 점수. 국내 리그·컵 우승은 그 리그의 수준(인지도)만큼만 인정한다. */
function trophyPoints(world: SimulationWorld, trophies: TrophyWin[], domesticRecognition: number): number {
  return trophies.reduce((sum, t) => {
    if (TROPHY_POINTS[t.competitionId] !== undefined) return sum + TROPHY_POINTS[t.competitionId];
    const league = world.leagues[t.competitionId];
    if (league) return sum + (league.tier === 1 ? 8 : 2) * leagueRecognition(league.strength);
    return sum + 3 * domesticRecognition; // 국내 컵
  }, 0);
}

// ----------------------------------------------------------------------------
// NPC 후보
// ----------------------------------------------------------------------------

interface Candidate {
  name: string;
  clubId: ID | null;
  nationality: string;
  group: PositionGroup;
  score: number;
  isPlayer: boolean;
}

function npcCandidate(rng: Rng, world: SimulationWorld, clubs: ID[], group: PositionGroup, score: number): Candidate {
  const clubId = clubs.length ? rng.pick(clubs) : null;
  const home = clubId ? world.clubs[clubId].nation : null;
  const nationality = pickNationality(rng, world, home);
  return { name: generateName(rng, nationality), clubId, nationality, group, score, isPlayer: false };
}

function entryFrom(
  world: SimulationWorld,
  award: AwardType,
  label: string,
  ranked: Candidate[],
  detail?: string,
  rankingSize = 0,
): CeremonyEntry {
  const winner = ranked[0];
  const playerIndex = ranked.findIndex((c) => c.isPlayer);
  return {
    award,
    label,
    winner: {
      name: winner.name,
      clubName: clubName(world, winner.clubId),
      nationality: winner.nationality,
      isPlayer: winner.isPlayer,
    },
    playerRank: playerIndex >= 0 ? playerIndex + 1 : null,
    ranking: rankingSize
      ? ranked.slice(0, rankingSize).map((c, i) => ({ rank: i + 1, name: c.name, clubName: clubName(world, c.clubId), isPlayer: c.isPlayer }))
      : undefined,
    detail,
  };
}

function playerCandidate(state: GameState, score: number): Candidate {
  return {
    name: state.player.profile.name,
    clubId: state.player.contract?.clubId ?? null,
    nationality: state.player.profile.nationality,
    group: POSITION_META[state.player.profile.role.position].group,
    score,
    isPlayer: true,
  };
}

const sortByScore = (list: Candidate[]) => [...list].sort((a, b) => b.score - a.score || Number(b.isPlayer) - Number(a.isPlayer));

// ----------------------------------------------------------------------------
// 리그 시상 (후반기 종료)
// ----------------------------------------------------------------------------

export interface AwardOutcome {
  awards: AwardWin[];
  ceremony: Ceremony | null;
}

function seasonStats(turns: TurnResult[], filter: (t: TurnResult) => boolean): Record<CompetitionType, PlayerStatLine> {
  const stats = emptyStatsByCompetition();
  for (const turn of turns.filter(filter)) {
    for (const type of Object.keys(stats) as CompetitionType[]) stats[type] = mergeStatLines(stats[type], turn.playerStats[type]);
  }
  return stats;
}

export function leagueAwards(state: GameState, world: SimulationWorld, season: number): AwardOutcome {
  const clubId = state.player.contract?.clubId ?? state.seasonTurns.find((t) => t.clubId)?.clubId ?? null;
  const leagueId = state.seasonTurns.filter((t) => t.leagueId).at(-1)?.leagueId ?? null;
  if (!clubId || !leagueId) return { awards: [], ceremony: null };

  const league = world.leagues[leagueId];
  const rng = rngFor(state.seed, 'league-awards', season, leagueId);
  const line = seasonStats(state.seasonTurns, (t) => t.leagueId === leagueId).LEAGUE;
  const group = POSITION_META[state.player.profile.role.position].group;
  const rounds = (getLeagueClubIds(world, leagueId).length - 1) * league.roundRobinCycles;
  const r = rounds / 38;
  const table = state.leagueTable;
  const topClubs = table.slice(0, 6).map((row) => row.clubId);
  const position = table.find((row) => row.clubId === clubId)?.position ?? 99;
  const teamBonus = position === 1 ? 6 : position <= 3 ? 3 : position <= 6 ? 1 : 0;
  const impact = impactScore(line, group, rounds) + teamBonus;
  const awards: AwardWin[] = [];
  const entries: CeremonyEntry[] = [];
  const win = (type: AwardType) => awards.push({ type, season, rank: 1, scopeId: leagueId });

  // 득점왕
  const topScorerGoals = Math.max(5, Math.round(rounds * 0.66 + rng.normal(0, 2.5)));
  const scorer = npcCandidate(rng, world, topClubs, 'FORWARD', topScorerGoals);
  const scorers = sortByScore([scorer, playerCandidate(state, line.goals)]);
  if (scorers[0].isPlayer) win('LEAGUE_TOP_SCORER');
  entries.push(entryFrom(world, 'LEAGUE_TOP_SCORER', '득점왕', scorers, `${scorers[0].score}골 (내 기록 ${line.goals}골)`));

  // 도움왕
  const topAssists = Math.max(4, Math.round(rounds * 0.32 + rng.normal(0, 1.5)));
  const assister = npcCandidate(rng, world, topClubs, 'MIDFIELDER', topAssists);
  const assisters = sortByScore([assister, playerCandidate(state, line.assists)]);
  if (assisters[0].isPlayer) win('LEAGUE_TOP_ASSISTS');
  entries.push(entryFrom(world, 'LEAGUE_TOP_ASSISTS', '도움왕', assisters, `${assisters[0].score}도움 (내 기록 ${line.assists}도움)`));

  // MVP
  const mvpRival = npcCandidate(rng, world, topClubs.slice(0, 3), rng.pick(['FORWARD', 'FORWARD', 'MIDFIELDER'] as const), 34 * r + rng.normal(0, 5));
  const mvps = sortByScore([mvpRival, playerCandidate(state, impact)]);
  if (mvps[0].isPlayer) win('LEAGUE_MVP');
  entries.push(entryFrom(world, 'LEAGUE_MVP', '리그 MVP', mvps));

  // 베스트 11 (포지션 그룹별 마지막 자리의 NPC 점수와 비교)
  const threshold = { FORWARD: 24, MIDFIELDER: 20, DEFENDER: 16, GOALKEEPER: 19 }[group] * r + rng.normal(0, 3.5);
  const selected = impact >= threshold && line.appearances >= rounds * 0.5;
  if (selected) win('LEAGUE_BEST_XI');
  entries.push({
    award: 'LEAGUE_BEST_XI',
    label: '리그 베스트 11',
    winner: { name: selected ? state.player.profile.name : '-', clubName: clubName(world, clubId), nationality: state.player.profile.nationality, isPlayer: selected },
    playerRank: selected ? 1 : null,
    detail: selected ? `${POSITION_META[state.player.profile.role.position].label} 부문 선정` : '선정되지 못했다',
  });

  return {
    awards,
    ceremony: { kind: 'LEAGUE', season, title: `${league.nameKo} ${season}/${String((season + 1) % 100).padStart(2, '0')} 시상식`, entries },
  };
}

// ----------------------------------------------------------------------------
// 세계 시상 (프리시즌 종료)
// ----------------------------------------------------------------------------

const POOL_QUOTA: Record<PositionGroup, { count: number; top: number }> = {
  FORWARD: { count: 16, top: 96 },
  MIDFIELDER: { count: 12, top: 90 },
  DEFENDER: { count: 9, top: 80 },
  GOALKEEPER: { count: 3, top: 74 },
};

/** 그해 세계 시상 후보 NPC들의 점수 (포지션별 상위권이 내려가며 이어진다) */
export function npcBallonScores(rng: Rng): Array<{ group: PositionGroup; score: number }> {
  const out: Array<{ group: PositionGroup; score: number }> = [];
  for (const [group, quota] of Object.entries(POOL_QUOTA) as Array<[PositionGroup, { count: number; top: number }]>) {
    let current = quota.top + rng.normal(0, 5);
    for (let i = 0; i < quota.count; i++) {
      out.push({ group, score: current });
      current -= Math.abs(rng.normal(2.6, 1.2));
    }
  }
  return out;
}

/** 리그 수준 보정: 약한 리그에서 몰아친 기록은 세계 시상에서 덜 인정받는다 (EPL 1.0, K리그1 0.5) */
export function leagueRecognition(strength: number): number {
  return Math.min(1.05, Math.max(0.35, (strength - 50) / 28));
}

/** UEFA 외 대륙 올해의 선수 경쟁자 점수 (발롱도르 점수 척도) */
const CONTINENTAL_TOP: Record<Confederation, number> = {
  UEFA: 0,
  CONMEBOL: 80,
  AFC: 76,
  CONCACAF: 77,
  CAF: 76,
  OFC: 62,
};

const WORLD_XI_SLOTS: Record<PositionGroup, number> = { FORWARD: 3, MIDFIELDER: 3, DEFENDER: 4, GOALKEEPER: 1 };

// ----------------------------------------------------------------------------
// 발롱도르 점수
// ----------------------------------------------------------------------------

/**
 * 발롱도르 계열 시상 점수 설정.
 * - 성과: 평점(포지션별 기준 대비) + 공격포인트·키패스·클린시트. 리그 수준 보정을 받는다.
 * - 팀 성과: 우승 점수 × 포지션 가중치 (+ 대륙컵·리그 더블, 트레블 보너스)
 * - 압도 보너스: 미드필더·수비수·골키퍼가 더블 또는 메이저 국제대회 우승을 이끌면서
 *   평점·클린시트·키패스가 압도적이면 크게 가산된다. 공격수에게는 없다.
 * NPC 후보 1위가 평균 약 98점, 3위가 약 92점이다.
 */
export const BALLON_CONFIG = {
  /** 시즌 대부분을 뛴 주전이 받는 기본 점수 (출전 비율만큼, 약한 리그는 최대 30% 감소) */
  starterBase: 50,
  starterBaseLeagueShare: 0.3,
  /** 포지션별 '평범한 주전' 평점. 이보다 높은 만큼 점수가 된다. */
  ratingBaseline: { FORWARD: 7.0, MIDFIELDER: 6.9, DEFENDER: 7.0, GOALKEEPER: 7.0 } as Record<PositionGroup, number>,
  ratingWeight: { FORWARD: 22, MIDFIELDER: 30, DEFENDER: 30, GOALKEEPER: 30 } as Record<PositionGroup, number>,
  output: {
    FORWARD: { goal: 1.0, assist: 0.8, keyPass: 0.05, cleanSheet: 0 },
    MIDFIELDER: { goal: 1.25, assist: 0.9, keyPass: 0.06, cleanSheet: 0.1 },
    DEFENDER: { goal: 1.4, assist: 1.0, keyPass: 0.08, cleanSheet: 0.6 },
    GOALKEEPER: { goal: 0, assist: 1.5, keyPass: 0, cleanSheet: 0.75 },
  } as Record<PositionGroup, { goal: number; assist: number; keyPass: number; cleanSheet: number }>,
  /** 개인 성과 전체 배율 */
  performanceScale: 0.37,
  /** 개인 성과 부분에만 곱하는 포지션 보정 (수비수·GK 수상 난이도) */
  positionFactor: { FORWARD: 1, MIDFIELDER: 0.8, DEFENDER: 0.85, GOALKEEPER: 0.85 } as Record<PositionGroup, number>,
  /** 우승 점수 가중치 */
  trophyWeight: { FORWARD: 0.52, MIDFIELDER: 0.45, DEFENDER: 0.5, GOALKEEPER: 0.45 } as Record<PositionGroup, number>,
  /** 1부 리그 + 대륙 최상위 대회 동시 우승 (대회 무게를 곱한다) */
  doubleBonus: 6,
  trebleBonus: 3,
  /** 압도 보너스 최대치 (압도 지수 1 · UCL 더블 또는 월드컵 우승 기준) */
  legacyBonus: { FORWARD: 0, MIDFIELDER: 7, DEFENDER: 6, GOALKEEPER: 7 } as Record<PositionGroup, number>,
  /** 압도 지수가 1이 되는 평점 (기준 평점 + 이 값) */
  dominanceRatingSpan: 0.5,
  internationalScale: 0.5,
  reputationWeight: 0.15,
};

/** 압도 보너스를 여는 국가대표 대회와 그 무게 */
const MAJOR_INTERNATIONAL: Record<string, number> = { WORLD_CUP: 1, EURO: 0.85, COPA_AMERICA: 0.85, AFCON: 0.45, ASIAN_CUP: 0.4, GOLD_CUP: 0.35 };

/** 한 시즌의 시상 평가 입력. GameState(진행 중)와 SeasonRecord(기록) 어느 쪽에서도 만들 수 있다. */
export interface SeasonPerformance {
  group: PositionGroup;
  stats: Record<CompetitionType, PlayerStatLine>;
  trophies: TrophyWin[];
  leagueStrength: number;
  reputation: number;
  /** 클럽 공식전 경기 수 (출전 비율 계산용) */
  eligibleMatches: number;
}

export interface BallonBreakdown {
  performance: number;
  international: number;
  teamSuccess: number;
  /** 0~1: 평점·클린시트·키패스가 포지션 기준보다 얼마나 압도적인가 */
  dominance: number;
  legacy: number;
  reputation: number;
  total: number;
}

/** 평점·핵심 지표가 포지션 기준을 얼마나 웃도는지 (0~1) */
export function dominanceIndex(group: PositionGroup, club: PlayerStatLine): number {
  const rating = averageRating(club);
  if (rating === null || club.appearances < 15) return 0;
  const byRating = clamp((rating - BALLON_CONFIG.ratingBaseline[group]) / BALLON_CONFIG.dominanceRatingSpan, 0, 1);
  let byMetric = byRating;
  if (group === 'DEFENDER' || group === 'GOALKEEPER') byMetric = clamp((club.cleanSheets / club.appearances - 0.3) / 0.2, 0, 1);
  else if (group === 'MIDFIELDER') byMetric = clamp(((club.keyPasses ?? 0) / club.appearances - 0.8) / 1.2, 0, 1);
  return Math.round((byRating * 0.6 + byMetric * 0.4) * 100) / 100;
}

export function ballonBreakdown(world: SimulationWorld, perf: SeasonPerformance): BallonBreakdown {
  const c = BALLON_CONFIG;
  const { group, stats } = perf;
  const club = mergeStatLines(stats.LEAGUE, stats.DOMESTIC_CUP, stats.CONTINENTAL);
  const rating = averageRating(club);
  const w = c.output[group];
  const recognition = leagueRecognition(perf.leagueStrength);

  // 개인 성과 (리그 수준 보정)
  const ratingPart =
    rating === null ? 0 : (rating - c.ratingBaseline[group]) * c.ratingWeight[group] * appearanceFactor(club, perf.eligibleMatches);
  const outputPart = club.goals * w.goal + club.assists * w.assist + (club.keyPasses ?? 0) * w.keyPass + club.cleanSheets * w.cleanSheet;
  const performance =
    c.starterBase * appearanceFactor(club, perf.eligibleMatches) * (1 - c.starterBaseLeagueShare + c.starterBaseLeagueShare * Math.min(1, recognition)) +
    (ratingPart + outputPart) * recognition * c.performanceScale * c.positionFactor[group];

  // 국가대표
  const intl = stats.INTERNATIONAL;
  const intlRating = averageRating(intl);
  const international =
    intlRating === null
      ? 0
      : c.internationalScale *
        ((intlRating - c.ratingBaseline[group]) * 8 * Math.min(1, intl.appearances / 4) +
          intl.goals * 1.5 +
          intl.assists +
          (group === 'DEFENDER' || group === 'GOALKEEPER' ? intl.cleanSheets * 0.8 : 0));

  // 팀 성과: 우승 점수 + (1부 리그 + 대륙 최상위 대회) 더블 보너스
  const won = perf.trophies.map((t) => t.competitionId);
  const wonLeague = perf.trophies.some((t) => world.leagues[t.competitionId]?.tier === 1);
  const continental = Math.max(0, ...won.map((id) => CONTINENTAL_WEIGHT[id] ?? 0));
  const wonCup = perf.trophies.some((t) => world.competitions[t.competitionId]?.type === 'DOMESTIC_CUP');
  const double = wonLeague && continental > 0 ? continental : 0;
  const bonus = double * (c.doubleBonus + (wonCup ? c.trebleBonus : 0));
  const teamSuccess = (trophyPoints(world, perf.trophies, recognition) + bonus) * c.trophyWeight[group];

  // 압도 보너스 (비공격수): 더블 또는 메이저 국제대회 우승 × 압도 지수
  const dominance = dominanceIndex(group, club);
  const intlMajor = Math.max(0, ...won.map((id) => MAJOR_INTERNATIONAL[id] ?? 0));
  const success = Math.max(double * (wonCup ? 1.15 : 1), intlMajor, continental * 0.5);
  const legacy = c.legacyBonus[group] * dominance * success;

  const reputation = perf.reputation * c.reputationWeight;
  const total = performance + international + teamSuccess + legacy + reputation;
  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    performance: round(performance),
    international: round(international),
    teamSuccess: round(teamSuccess),
    dominance,
    legacy: round(legacy),
    reputation: round(reputation),
    total: round(total),
  };
}

/** 진행 중인 시즌(GameState.seasonTurns)의 시상 평가 입력 */
export function seasonPerformance(state: GameState, world: SimulationWorld): SeasonPerformance {
  const turns = state.seasonTurns;
  const eligibleMatches = turns
    .filter((t) => t.turn.phase !== 'PRESEASON')
    .reduce((n, t) => n + t.matches.filter((m) => m.competitionType !== 'FRIENDLY' && m.competitionType !== 'RESERVE').length, 0);
  const leagueId = turns.filter((t) => t.leagueId).at(-1)?.leagueId;
  return {
    group: POSITION_META[state.player.profile.role.position].group,
    stats: seasonStats(turns, () => true),
    trophies: turns.flatMap((t) => t.trophies),
    leagueStrength: leagueId ? world.leagues[leagueId].strength : 55,
    reputation: state.player.reputation,
    eligibleMatches,
  };
}

/** 발롱도르 점수 (클럽 공식전 + 국제대회 + 우승 + 압도 보너스 + 명성) */
export function ballonScore(state: GameState, world: SimulationWorld): number {
  return ballonBreakdown(world, seasonPerformance(state, world)).total;
}

export function worldAwards(state: GameState, world: SimulationWorld, season: number): AwardOutcome {
  const rng = rngFor(state.seed, 'world-awards', season);
  const score = ballonScore(state, world);
  const me = playerCandidate(state, score);
  const bigClubs = Object.values(world.clubStates).filter((c) => c.power >= 80).map((c) => c.clubId);

  const pool: Candidate[] = npcBallonScores(rng).map(({ group, score }) => npcCandidate(rng, world, bigClubs, group, score));

  const awards: AwardWin[] = [];
  const entries: CeremonyEntry[] = [];
  const nation = world.nations[state.player.profile.nationality];

  // 발롱도르 (30위까지 순위 기록)
  const ballon = sortByScore([...pool, me]);
  const ballonRank = ballon.findIndex((c) => c.isPlayer) + 1;
  if (ballonRank <= 30) awards.push({ type: 'BALLON_DOR', season, rank: ballonRank });
  entries.push(
    entryFrom(world, 'BALLON_DOR', '발롱도르', ballon, ballonRank <= 30 ? `${state.player.profile.name} ${ballonRank}위` : '30위 밖', 10),
  );

  // FIFA 올해의 선수 (심사 기준이 달라 점수에 소폭 변동)
  const fifa = sortByScore([...pool.map((c) => ({ ...c, score: c.score * (0.95 + rng.next() * 0.1) })), { ...me, score: score * (0.95 + rng.next() * 0.1) }]);
  const fifaRank = fifa.findIndex((c) => c.isPlayer) + 1;
  if (fifaRank <= 3) awards.push({ type: 'FIFA_BEST', season, rank: fifaRank });
  entries.push(entryFrom(world, 'FIFA_BEST', 'FIFA 올해의 선수', fifa, fifaRank <= 3 ? `최종 후보 ${fifaRank}위` : undefined, 3));

  // 월드 베스트 11
  const sameGroup = sortByScore([...pool.filter((c) => c.group === me.group), me]);
  const xiRank = sameGroup.findIndex((c) => c.isPlayer) + 1;
  const inWorldXI = xiRank <= WORLD_XI_SLOTS[me.group];
  if (inWorldXI) awards.push({ type: 'WORLD_BEST_XI', season, rank: 1 });
  entries.push({
    award: 'WORLD_BEST_XI',
    label: '월드 베스트 11',
    winner: { name: inWorldXI ? me.name : '-', clubName: clubName(world, me.clubId), nationality: me.nationality, isPlayer: inWorldXI },
    playerRank: inWorldXI ? 1 : null,
    detail: inWorldXI ? `${POSITION_META[state.player.profile.role.position].label} 부문 선정` : `포지션 내 ${xiRank}위`,
  });

  // 대륙별 올해의 선수 (소속 리그 대륙, FA면 국적 대륙)
  const leagueId = state.player.contract ? world.clubStates[state.player.contract.clubId].leagueId : null;
  const confederation: Confederation = leagueId ? world.leagues[leagueId].confederation : (nation?.confederation ?? 'UEFA');
  const continentalTop =
    confederation === 'UEFA' ? ballon.find((c) => !c.isPlayer)!.score * 0.97 : CONTINENTAL_TOP[confederation] + rng.normal(0, 4);
  const continentalRival = npcCandidate(
    rng,
    world,
    Object.values(world.clubStates).filter((c) => world.leagues[c.leagueId]?.confederation === confederation).map((c) => c.clubId),
    'FORWARD',
    continentalTop,
  );
  const continental = sortByScore([continentalRival, me]);
  if (continental[0].isPlayer) awards.push({ type: 'CONTINENTAL_POTY', season, rank: 1, scopeId: confederation });
  entries.push(entryFrom(world, 'CONTINENTAL_POTY', `${confederation} 올해의 선수`, continental));

  // 국가별 올해의 선수
  if (nation) {
    // 그 나라 최고 선수의 점수: 강국일수록 높다 (잉글랜드 ≈ 84, 한국 ≈ 78)
    const nationalTop = 32 + nation.power * 0.6 + rng.normal(0, 4);
    const rngName = rngFor(state.seed, 'national-poty', season);
    const compatriot: Candidate = {
      name: generateName(rngName, nation.code),
      clubId: bigClubs.length ? rngName.pick(bigClubs) : null,
      nationality: nation.code,
      group: 'MIDFIELDER',
      score: nationalTop,
      isPlayer: false,
    };
    const national = sortByScore([compatriot, me]);
    if (national[0].isPlayer) awards.push({ type: 'NATIONAL_POTY', season, rank: 1, scopeId: nation.code });
    entries.push(entryFrom(world, 'NATIONAL_POTY', `${nation.nameKo} 올해의 선수`, national));
  }

  return {
    awards,
    ceremony: { kind: 'WORLD', season, title: `${season + 1} 세계 축구 시상식`, entries },
  };
}

export const AWARD_LABELS: Record<AwardType, string> = {
  BALLON_DOR: '발롱도르',
  FIFA_BEST: 'FIFA 올해의 선수',
  WORLD_BEST_XI: '월드 베스트 11',
  CONTINENTAL_POTY: '대륙 올해의 선수',
  NATIONAL_POTY: '국가 올해의 선수',
  LEAGUE_BEST_XI: '리그 베스트 11',
  LEAGUE_TOP_SCORER: '득점왕',
  LEAGUE_TOP_ASSISTS: '도움왕',
  LEAGUE_MVP: '리그 MVP',
};
