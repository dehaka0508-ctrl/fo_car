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
import { rngFor, type Rng } from './rng';
import { averageRating, mergeStatLines } from './simulator';
import { clubName, getLeagueClubIds, type SimulationWorld } from './world';

// ----------------------------------------------------------------------------
// 임팩트 점수
// ----------------------------------------------------------------------------

const OUTPUT_WEIGHTS: Record<PositionGroup, { goal: number; assist: number; cleanSheet: number }> = {
  FORWARD: { goal: 1.0, assist: 0.7, cleanSheet: 0 },
  MIDFIELDER: { goal: 1.2, assist: 0.9, cleanSheet: 0.15 },
  DEFENDER: { goal: 1.5, assist: 1.0, cleanSheet: 0.6 },
  GOALKEEPER: { goal: 2, assist: 1.5, cleanSheet: 0.8 },
};

/** 발롱도르 계열 시상의 포지션 보정 (수비수·GK 수상 난이도) */
const BALLON_POSITION_FACTOR: Record<PositionGroup, number> = {
  FORWARD: 1,
  MIDFIELDER: 0.97,
  DEFENDER: 0.85,
  GOALKEEPER: 0.8,
};

export function impactScore(line: PlayerStatLine, group: PositionGroup, eligibleMatches: number): number {
  const rating = averageRating(line);
  if (rating === null) return 0;
  const appsFactor = Math.min(1, line.appearances / Math.max(10, eligibleMatches * 0.7));
  const w = OUTPUT_WEIGHTS[group];
  return (rating - 6.5) * 20 * appsFactor + line.goals * w.goal + line.assists * w.assist + line.cleanSheets * w.cleanSheet;
}

const TROPHY_POINTS: Record<string, number> = {
  UEFA_CL: 18, UEFA_EL: 6, UEFA_ECL: 3, AFC_CL: 4, CONMEBOL_LIB: 8, CONCACAF_CC: 3, CAF_CL: 4,
  WORLD_CUP: 20, EURO: 12, COPA_AMERICA: 12, ASIAN_CUP: 6, AFCON: 6, GOLD_CUP: 4, NATIONS_LEAGUE: 3, OLYMPICS: 2,
};

function trophyPoints(world: SimulationWorld, trophies: TrophyWin[]): number {
  return trophies.reduce((sum, t) => {
    if (TROPHY_POINTS[t.competitionId] !== undefined) return sum + TROPHY_POINTS[t.competitionId];
    const league = world.leagues[t.competitionId];
    if (league) return sum + (league.tier === 1 ? 8 : 2);
    return sum + 3; // 국내 컵
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

/** 리그 수준 보정: 약한 리그에서 몰아친 기록은 세계 시상에서 덜 인정받는다 (EPL 1.0, K리그1 0.5) */
export function leagueRecognition(strength: number): number {
  return Math.min(1.05, Math.max(0.35, (strength - 50) / 28));
}

const CONTINENTAL_TOP: Record<Confederation, number> = {
  UEFA: 0,
  CONMEBOL: 70,
  AFC: 58,
  CONCACAF: 60,
  CAF: 62,
  OFC: 45,
};

const WORLD_XI_SLOTS: Record<PositionGroup, number> = { FORWARD: 3, MIDFIELDER: 3, DEFENDER: 4, GOALKEEPER: 1 };

/** 발롱도르 점수 (클럽 공식전 + 국제대회 + 우승 + 명성, 포지션 보정) */
export function ballonScore(state: GameState, world: SimulationWorld): number {
  const turns = state.seasonTurns;
  const stats = seasonStats(turns, () => true);
  const club = mergeStatLines(stats.LEAGUE, stats.DOMESTIC_CUP, stats.CONTINENTAL);
  const group = POSITION_META[state.player.profile.role.position].group;
  const eligible = turns
    .filter((t) => t.turn.phase !== 'PRESEASON')
    .reduce((n, t) => n + t.matches.filter((m) => m.competitionType !== 'FRIENDLY' && m.competitionType !== 'RESERVE').length, 0);
  const leagueId = turns.filter((t) => t.leagueId).at(-1)?.leagueId;
  const strength = leagueId ? world.leagues[leagueId].strength : 55;
  const clubImpact = impactScore(club, group, eligible) * leagueRecognition(strength);
  const intl = stats.INTERNATIONAL;
  const intlRating = averageRating(intl);
  const intlImpact = intlRating === null ? 0 : (intlRating - 6.5) * 8 * Math.min(1, intl.appearances / 4) + intl.goals * 1.5 + intl.assists;
  const trophies = trophyPoints(world, turns.flatMap((t) => t.trophies));
  return (clubImpact + intlImpact + trophies + state.player.reputation * 0.15) * BALLON_POSITION_FACTOR[group];
}

export function worldAwards(state: GameState, world: SimulationWorld, season: number): AwardOutcome {
  const rng = rngFor(state.seed, 'world-awards', season);
  const score = ballonScore(state, world);
  const me = playerCandidate(state, score);
  const bigClubs = Object.values(world.clubStates).filter((c) => c.power >= 80).map((c) => c.clubId);

  const pool: Candidate[] = [];
  for (const [group, quota] of Object.entries(POOL_QUOTA) as Array<[PositionGroup, { count: number; top: number }]>) {
    let current = quota.top + rng.normal(0, 5);
    for (let i = 0; i < quota.count; i++) {
      pool.push(npcCandidate(rng, world, bigClubs, group, current));
      current -= Math.abs(rng.normal(2.6, 1.2));
    }
  }

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
    const nationalTop = 25 + nation.power * 0.65 + rng.normal(0, 4);
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
