'use client';

import { PlayerToken } from '@/components/Avatar';
import { HIGHLIGHT_KIND_LABELS, TURN_PHASE_LABELS } from '@/data/labels';
import { BASE_WORLD } from '@/engine/career';
import { averageRating, mergeStatLines } from '@/engine/simulator';
import { turnLabel } from '@/engine/state';
import { kitColorsFor } from '@/engine/world';
import type { CompetitionType, GameState, NoticeKind, PlayerStatLine, SeasonRecord, TeamRecord, TurnResult } from '@/types/game';
import { competitionName, ratingText, seasonLabel } from './format';
import { cx, signed, Tag } from './ui';

const CLUB_TYPES: CompetitionType[] = ['LEAGUE', 'DOMESTIC_CUP', 'CONTINENTAL'];

function sumTeam(records: Array<TeamRecord | undefined>): TeamRecord | null {
  const list = records.filter((r): r is TeamRecord => Boolean(r));
  if (!list.length) return null;
  return list.reduce(
    (a, r) => ({
      played: a.played + r.played,
      wins: a.wins + r.wins,
      draws: a.draws + r.draws,
      losses: a.losses + r.losses,
      goalsFor: a.goalsFor + r.goalsFor,
      goalsAgainst: a.goalsAgainst + r.goalsAgainst,
    }),
    { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 },
  );
}

/** 한 턴의 대표 기록: 출전이 가장 많은 쪽 (공식전 · B팀·유스 · 친선·대표팀), 셋 다 없으면 공식전 */
export function turnHeadline(turn: TurnResult): { label: string; line: PlayerStatLine; team: TeamRecord | null; others: string[] } {
  const pre: CompetitionType[] = ['INTERNATIONAL', 'FRIENDLY'];
  const candidates = [
    { label: '공식전', line: mergeStatLines(...CLUB_TYPES.map((t) => turn.playerStats[t])), team: sumTeam(CLUB_TYPES.map((t) => turn.teamStats[t])) },
    { label: 'B팀·유스', line: turn.playerStats.RESERVE, team: turn.teamStats.RESERVE ?? null },
    { label: '친선·대표팀', line: mergeStatLines(...pre.map((t) => turn.playerStats[t])), team: sumTeam(pre.map((t) => turn.teamStats[t])) },
  ];
  const best = candidates.reduce((a, c) => (c.line.appearances > a.line.appearances ? c : a), candidates[0]);
  const others = candidates
    .filter((c) => c !== best && c.line.appearances > 0)
    .map((c) => `${c.label} ${c.line.appearances}경기 ${c.line.goals}골 ${c.line.assists}도움`);
  return { ...best, others };
}

function seasonHeadline(record: SeasonRecord): PlayerStatLine {
  const club = mergeStatLines(...CLUB_TYPES.map((t) => record.stats[t]));
  return club.appearances > 0 ? club : record.stats.RESERVE;
}

function ratingTone(rating: number | null): string {
  if (rating === null) return 'text-zinc-400';
  if (rating >= 7.5) return 'text-amber-300';
  if (rating >= 7.0) return 'text-emerald-300';
  if (rating >= 6.5) return 'text-zinc-50';
  return 'text-rose-300';
}

function Tile({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="px-inset m-[2px] flex flex-col items-center px-1 py-2">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <span className={cx('font-pixel text-2xl leading-7 tabular-nums', tone ?? 'text-zinc-50')}>{value}</span>
      {sub ? <span className="text-[10px] text-zinc-500">{sub}</span> : <span className="text-[10px]">&nbsp;</span>}
    </div>
  );
}

const NOTICE_TONE: Partial<Record<NoticeKind, 'emerald' | 'amber' | 'sky' | 'rose' | 'violet'>> = {
  RECORD: 'amber',
  LEGEND: 'amber',
  AWARD: 'amber',
  TRANSFER: 'sky',
  CONTRACT: 'sky',
  PROMOTION: 'emerald',
  PARTNER: 'violet',
  RIVAL: 'rose',
  NATIONAL: 'sky',
};

/** 오른쪽: 지난 턴 성적 (크게) + 턴별 기록 + 소식 */
export function TurnResultPanel({ game }: { game: GameState }) {
  const turn = game.lastTurn;
  const isGK = game.player.profile.role.position === 'GK';

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <section className="px-panel flex min-h-0 flex-1 flex-col gap-4 p-4">
        {turn ? <LastTurn turn={turn} game={game} isGK={isGK} /> : <NoTurnYet />}
        <TurnHistory game={game} isGK={isGK} />
      </section>
      <section className="px-panel flex max-h-44 min-h-0 shrink-0 flex-col p-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-emerald-400" />
          소식
        </h2>
        <ul className="flex min-h-0 flex-col gap-1.5 overflow-y-auto pr-1">
          {game.notices.slice(0, 12).map((n) => (
            <li key={n.id} className="text-[11px] leading-snug">
              <Tag tone={NOTICE_TONE[n.kind] ?? 'zinc'}>{n.title}</Tag> <span className="text-zinc-500">{turnLabel(n.turn)}</span>
              <p className="text-zinc-300">{n.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function NoTurnYet() {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-zinc-100">턴 성적</h2>
      <p className="px-inset m-[2px] p-3 text-sm text-zinc-300">아직 치른 경기가 없습니다. 첫 경기를 마치면 여기에 턴 성적이 크게 표시됩니다.</p>
    </div>
  );
}

function LastTurn({ turn, game, isGK }: { turn: TurnResult; game: GameState; isGK: boolean }) {
  const { label, line, team, others } = turnHeadline(turn);
  const rating = averageRating(line);
  const position = turn.leagueTable.find((row) => row.clubId === turn.clubId)?.position ?? null;
  const previous = game.seasonTurns.length >= 2 ? game.seasonTurns[game.seasonTurns.length - 2] : null;
  const prevPosition = previous && previous.leagueId === turn.leagueId ? previous.leagueTable.find((r) => r.clubId === previous.clubId)?.position : undefined;
  const moved = position !== null && prevPosition !== undefined ? prevPosition - position : 0;
  const h = turn.highlight;
  const [us, them] = h ? (h.playerTeamSide === 'HOME' ? [h.score.home, h.score.away] : [h.score.away, h.score.home]) : [0, 0];
  const result = h ? (h.score.winner === h.playerTeamSide ? '승' : h.score.winner === 'DRAW' ? '무' : '패') : null;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">
          {seasonLabel(turn.turn.season)} {TURN_PHASE_LABELS[turn.turn.phase]} 성적
        </h2>
        <Tag>{label}</Tag>
      </div>
      <div className="grid grid-cols-4">
        <Tile label="출전" value={line.appearances} sub={team ? `팀 ${team.played}경기` : undefined} />
        {isGK ? (
          <Tile label="클린시트" value={line.cleanSheets} tone="text-sky-300" sub={`선방 ${line.saves}`} />
        ) : (
          <Tile label="골" value={line.goals} tone="text-amber-300" sub={line.appearances ? `경기당 ${(line.goals / line.appearances).toFixed(2)}` : undefined} />
        )}
        <Tile label="도움" value={line.assists} tone="text-emerald-300" sub={`키패스 ${line.keyPasses}`} />
        <Tile label="평점" value={ratingText(rating)} tone={ratingTone(rating)} />
      </div>
      <p className="text-xs text-zinc-200">
        {team ? (
          <>
            팀 <b className="text-zinc-50">{team.wins}승 {team.draws}무 {team.losses}패</b>
          </>
        ) : null}
        {position !== null ? (
          <>
            {' · '}
            {label === '공식전' ? '리그' : '1군 리그'} <b className="text-zinc-50">{position}위</b>
            {moved ? <span className={moved > 0 ? 'text-emerald-300' : 'text-rose-300'}> {moved > 0 ? `▲${moved}` : `▼${-moved}`}</span> : null}
          </>
        ) : null}
      </p>
      {others.length ? <p className="text-[11px] text-zinc-400">{others.join(' · ')}</p> : null}
      {h ? (
        <div className="px-inset m-[2px] flex items-center gap-2 px-2 py-1.5">
          <PlayerToken kit={kitColorsFor(BASE_WORLD, h.opponent.id)} size={18} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[10px] text-zinc-400">하이라이트 · {HIGHLIGHT_KIND_LABELS[h.kind]}</p>
            <p className="truncate text-xs text-zinc-100">vs {h.opponent.name}</p>
          </div>
          <div className="text-right leading-tight">
            <p className={cx('font-pixel text-base', result === '승' ? 'text-emerald-300' : result === '무' ? 'text-amber-300' : 'text-rose-300')}>
              {us}-{them} {result}
            </p>
            {h.playerLine ? (
              <p className="text-[10px] text-zinc-400">
                {h.playerLine.goals}골 {h.playerLine.assists}도움 · {h.playerLine.rating}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {turn.trophies.map((t) => (
          <Tag key={t.competitionId} tone="amber">
            🏆 {competitionName(t.competitionId)}
          </Tag>
        ))}
        {turn.progress
          .filter((p) => p.status !== 'ACTIVE')
          .map((p) => (
            <Tag key={p.competitionId} tone={p.status === 'CHAMPION' ? 'amber' : 'zinc'}>
              {competitionName(p.competitionId)} {p.stageReached}
              {p.status === 'ELIMINATED' ? ' 탈락' : ''}
            </Tag>
          ))}
        {turn.nationalDuty ? <Tag tone="sky">국가대표 차출</Tag> : null}
      </div>
      <p className="text-[11px] text-zinc-400">
        체력 {turn.condition.start}→{turn.condition.end} · 멘탈 {turn.mental.start}→{turn.mental.end} · 명성 {signed(turn.reputationDelta, 1)} · 입지{' '}
        {signed(turn.standingDelta)}
      </p>
    </div>
  );
}

/** 턴별 기록: 이번 시즌은 턴마다, 지난 시즌은 시즌 합계 */
function TurnHistory({ game, isGK }: { game: GameState; isGK: boolean }) {
  const rows = [
    ...[...game.seasonTurns].reverse().map((t) => {
      const { line } = turnHeadline(t);
      return {
        key: `${t.turn.season}-${t.turn.phase}`,
        label: `${seasonLabel(t.turn.season).slice(2)} ${TURN_PHASE_LABELS[t.turn.phase]}`,
        line,
        position: t.leagueTable.find((r) => r.clubId === t.clubId)?.position ?? null,
        season: false,
      };
    }),
    ...[...game.history].reverse().map((s) => ({
      key: `season-${s.season}`,
      label: `${seasonLabel(s.season).slice(2)} 시즌`,
      line: seasonHeadline(s),
      position: s.leaguePosition,
      season: true,
    })),
  ];
  if (!rows.length) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h3 className="mb-1 text-[11px] font-bold text-emerald-300">턴별 기록</h3>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <table className="w-full text-[11px] tabular-nums">
          <thead className="sticky top-0 bg-[#131d2e] text-zinc-400">
            <tr>
              <th className="py-1 text-left font-medium">턴</th>
              <th className="text-right font-medium">경기</th>
              <th className="text-right font-medium">{isGK ? 'CS' : '골'}</th>
              <th className="text-right font-medium">도움</th>
              <th className="text-right font-medium">평점</th>
              <th className="text-right font-medium">순위</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const rating = averageRating(r.line);
              return (
                <tr key={r.key} className={cx('border-t border-zinc-800', i === 0 && !r.season ? 'bg-emerald-950/40 text-zinc-50' : r.season ? 'text-zinc-400' : 'text-zinc-200')}>
                  <td className="py-1">{r.label}</td>
                  <td className="text-right">{r.line.appearances}</td>
                  <td className="text-right">{isGK ? r.line.cleanSheets : r.line.goals}</td>
                  <td className="text-right">{r.line.assists}</td>
                  <td className={cx('text-right', ratingTone(rating))}>{ratingText(rating)}</td>
                  <td className="text-right">{r.position ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
