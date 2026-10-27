/**
 * 커뮤니티 공유용 커리어 요약
 *
 * 시즌별 [시즌 · 나이 / 소속팀 / 경기 · 골 · 도움(GK는 클린시트) · 평점 / 우승 / 개인상]을 정리하고,
 * 게시판·메신저에 그대로 붙여 넣을 수 있는 텍스트로 만든다.
 */
import { POSITION_META } from '@/data/playstyles';
import type { AwardWin, CompetitionType, GameState, ID, PlayerStatLine } from '@/types/game';
import { AWARD_LABELS } from './awards';
import { emptyStatsByCompetition } from './character';
import { careerTotals } from './records';
import { averageRating, mergeStatLines } from './simulator';
import type { SimulationWorld } from './world';

export interface SummarySeason {
  season: number;
  /** '2026/27' */
  label: string;
  age: number;
  club: string;
  /** 임대 · B팀 · 유스 등 */
  note: string | null;
  apps: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  rating: number | null;
  reserveApps: number;
  reserveGoals: number;
  caps: number;
  intlGoals: number;
  trophies: string[];
  awards: string[];
  inProgress: boolean;
}

export interface CareerSummary {
  name: string;
  nationality: string;
  role: string;
  isGoalkeeper: boolean;
  span: string;
  status: string;
  totals: { apps: number; goals: number; assists: number; cleanSheets: number; rating: number | null; caps: number; intlGoals: number };
  trophyCount: number;
  ballonWins: number;
  bestBallon: number | null;
  majorAwards: string[];
  legends: string[];
  records: string[];
  seasons: SummarySeason[];
}

export function seasonText(season: number): string {
  return `${season}/${String((season + 1) % 100).padStart(2, '0')}`;
}

function competitionName(world: SimulationWorld, id: ID): string {
  return world.competitions[id]?.nameKo ?? world.leagues[id]?.nameKo ?? id;
}

function clubName(world: SimulationWorld, id: ID | null): string {
  if (!id) return '무소속';
  return world.clubs[id]?.nameKo ?? id;
}

/** 시즌 개인상 표기: 수상은 이름만, 발롱도르·FIFA는 순위까지 */
function awardText(award: AwardWin): string | null {
  if (award.rank === 1) return AWARD_LABELS[award.type];
  if (award.type === 'BALLON_DOR' || award.type === 'FIFA_BEST') return `${AWARD_LABELS[award.type]} ${award.rank}위`;
  return null;
}

function seasonRow(
  state: GameState,
  world: SimulationWorld,
  input: {
    season: number;
    age: number;
    clubId: ID | null;
    stats: Record<CompetitionType, PlayerStatLine>;
    trophies: string[];
    awards: AwardWin[];
    inProgress: boolean;
  },
): SummarySeason {
  const club = mergeStatLines(input.stats.LEAGUE, input.stats.DOMESTIC_CUP, input.stats.CONTINENTAL);
  const spell = state.player.clubHistory.find(
    (s) => s.clubId === input.clubId && s.fromSeason <= input.season && (s.toSeason === null || s.toSeason >= input.season),
  );
  const reserveOnly = club.appearances === 0 && input.stats.RESERVE.appearances > 0;
  const note = spell?.type === 'LOAN' ? '임대' : reserveOnly ? 'B팀·유스' : null;
  return {
    season: input.season,
    label: seasonText(input.season),
    age: input.age,
    club: clubName(world, input.clubId),
    note,
    apps: club.appearances,
    goals: club.goals,
    assists: club.assists,
    cleanSheets: club.cleanSheets,
    rating: averageRating(club),
    reserveApps: input.stats.RESERVE.appearances,
    reserveGoals: input.stats.RESERVE.goals,
    caps: input.stats.INTERNATIONAL.appearances,
    intlGoals: input.stats.INTERNATIONAL.goals,
    trophies: input.trophies,
    awards: input.awards
      .sort((a, b) => a.rank - b.rank)
      .map(awardText)
      .filter((t): t is string => t !== null),
    inProgress: input.inProgress,
  };
}

export function buildCareerSummary(state: GameState, world: SimulationWorld): CareerSummary {
  const { player } = state;
  const position = player.profile.role.position;
  const isGoalkeeper = position === 'GK';
  const seasons = state.history.map((record) =>
    seasonRow(state, world, {
      season: record.season,
      age: record.age,
      clubId: record.clubId,
      stats: record.stats,
      trophies: record.trophies.map((t) => competitionName(world, t.competitionId)),
      awards: record.awards,
      inProgress: false,
    }),
  );

  // 진행 중인 시즌 (은퇴 전, 이번 시즌에 치른 턴이 있으면)
  if (state.stage !== 'RETIRED' && state.seasonTurns.length) {
    const stats = emptyStatsByCompetition();
    for (const turn of state.seasonTurns) {
      for (const type of Object.keys(stats) as CompetitionType[]) stats[type] = mergeStatLines(stats[type], turn.playerStats[type]);
    }
    seasons.push(
      seasonRow(state, world, {
        season: state.seasonTurns[0].turn.season,
        age: player.age,
        clubId: state.seasonTurns.at(-1)?.clubId ?? player.contract?.clubId ?? null,
        stats,
        trophies: state.seasonTurns.flatMap((t) => t.trophies).map((t) => competitionName(world, t.competitionId)),
        awards: state.awards.filter((a) => a.season === state.seasonTurns[0].turn.season),
        inProgress: true,
      }),
    );
  }

  const totals = careerTotals(state);
  const club = mergeStatLines(player.career.LEAGUE, player.career.DOMESTIC_CUP, player.career.CONTINENTAL);
  const ballon = state.awards.filter((a) => a.type === 'BALLON_DOR');
  const counts = new Map<string, number>();
  for (const award of state.awards.filter((a) => a.rank === 1)) counts.set(AWARD_LABELS[award.type], (counts.get(AWARD_LABELS[award.type]) ?? 0) + 1);
  const order = Object.values(AWARD_LABELS);
  const firstSeason = player.profile.startSeason;
  const lastSeason = state.retirement?.season ?? state.history.at(-1)?.season ?? firstSeason;

  return {
    name: player.profile.name,
    nationality: world.nations[player.profile.nationality]?.nameKo ?? player.profile.nationality,
    role: POSITION_META[position].label,
    isGoalkeeper,
    span: `${seasonText(firstSeason)} ~ ${seasonText(lastSeason)}`,
    status: state.retirement ? `${state.retirement.age}세 은퇴` : `현역 ${player.age}세`,
    totals: {
      apps: totals.appearances,
      goals: totals.goals,
      assists: totals.assists,
      cleanSheets: totals.cleanSheets,
      rating: averageRating(club),
      caps: player.nationalTeam.caps,
      intlGoals: player.nationalTeam.goals,
    },
    trophyCount: state.trophies.length,
    ballonWins: ballon.filter((a) => a.rank === 1).length,
    bestBallon: ballon.length ? Math.min(...ballon.map((a) => a.rank)) : null,
    majorAwards: [...counts.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([label, n]) => `${label} ${n}회`),
    legends: state.legends.map((l) => clubName(world, l.clubId)),
    records: state.recordBreaks.map((r) => {
      const scope =
        r.scope === 'CLUB' ? clubName(world, r.scopeId) : r.scope === 'LEAGUE' ? competitionName(world, r.scopeId) : `${world.nations[r.scopeId]?.nameKo ?? r.scopeId} 대표팀`;
      return `${scope} 기록 경신 (${r.previousHolder} ${r.previousValue} → ${r.newValue})`;
    }),
    seasons,
  };
}

/** 시즌 한 줄: '2030/31 · 20세 | 울산 HD | 36경기 22골 3도움 · 평점 7.41 | 🏆 K리그1 | 🏅 득점왕' */
export function formatSeasonLine(row: SummarySeason, isGoalkeeper: boolean): string {
  const club = row.note ? `${row.club} (${row.note})` : row.club;
  const stats: string[] = [];
  if (row.apps > 0) {
    stats.push(isGoalkeeper ? `${row.apps}경기 클린시트 ${row.cleanSheets}` : `${row.apps}경기 ${row.goals}골 ${row.assists}도움`);
    if (row.rating !== null) stats.push(`평점 ${row.rating.toFixed(2)}`);
  } else if (row.reserveApps > 0) {
    stats.push(isGoalkeeper ? `B팀 ${row.reserveApps}경기` : `B팀 ${row.reserveApps}경기 ${row.reserveGoals}골`);
  } else {
    stats.push('출전 없음');
  }
  if (row.caps > 0) stats.push(isGoalkeeper ? `A매치 ${row.caps}경기` : `A매치 ${row.caps}경기 ${row.intlGoals}골`);
  const parts = [`${row.label} · ${row.age}세${row.inProgress ? ' (진행 중)' : ''}`, club, stats.join(' · ')];
  if (row.trophies.length) parts.push(`🏆 ${row.trophies.join(', ')}`);
  if (row.awards.length) parts.push(`🏅 ${row.awards.join(', ')}`);
  return parts.join(' | ');
}

/** 커뮤니티에 붙여 넣기 좋은 전체 커리어 텍스트 */
export function formatCareerText(summary: CareerSummary): string {
  const t = summary.totals;
  const main = summary.isGoalkeeper
    ? `통산 ${t.apps}경기 · 클린시트 ${t.cleanSheets}`
    : `통산 ${t.apps}경기 ${t.goals}골 ${t.assists}도움`;
  const lines = [
    `⚽ ${summary.name} 커리어 요약 (${summary.nationality} · ${summary.role})`,
    `${summary.span} · ${summary.status}`,
    `${main} · 평균 평점 ${t.rating !== null ? t.rating.toFixed(2) : '-'} · A매치 ${t.caps}경기 ${t.intlGoals}골`,
    `우승 ${summary.trophyCount}회 · 발롱도르 ${summary.ballonWins}회${summary.bestBallon ? ` (최고 ${summary.bestBallon}위)` : ''}`,
  ];
  if (summary.legends.length) lines.push(`👑 레전드: ${summary.legends.join(', ')}`);
  lines.push('', '[시즌별 기록]', ...summary.seasons.map((row) => formatSeasonLine(row, summary.isGoalkeeper)));
  if (summary.majorAwards.length) lines.push('', `[개인상] ${summary.majorAwards.join(' · ')}`);
  if (summary.records.length) lines.push('', '[기록 경신]', ...summary.records.map((r) => `- ${r}`));
  lines.push('', '#축구커리어시뮬레이터');
  return lines.join('\n');
}
