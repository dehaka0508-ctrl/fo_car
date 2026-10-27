import { getPositionGroup } from '@/data/playstyles';
import { TURN_PHASE_LABELS } from '@/data/labels';
import { mergeStatLines, averageRating, passAccuracy } from '@/engine/simulator';
import type { CompetitionType, GameState, PlayerStatLine } from '@/types/game';
import { clubLabel, competitionName, ratingText, seasonLabel } from './format';
import { Card, cx, Stat, Tag } from './ui';

const COMPETITION_LABELS: Record<CompetitionType, string> = {
  LEAGUE: '리그', DOMESTIC_CUP: '국내컵', CONTINENTAL: '대륙컵',
  INTERNATIONAL: '국가대표', FRIENDLY: '친선경기', RESERVE: 'B팀·유스',
};

/** Last completed turn is the source even when a new season has already started. */
export function TurnSummary({ game }: { game: GameState }) {
  const turn = game.lastTurn;
  if (!turn) return null;
  const total = mergeStatLines(...Object.values(turn.playerStats));
  const group = getPositionGroup(turn.playerPosition ?? game.player.profile.role.position);
  const isGK = group === 'GOALKEEPER';
  const isMidfielder = group === 'MIDFIELDER';
  const isDefender = group === 'DEFENDER';
  const firstStat = isGK ? 'saves' : isDefender ? 'tackles' : 'goals';
  const secondStat = isGK || isDefender ? 'cleanSheets' : 'assists';
  const firstLabel = isGK ? '선방' : isDefender ? '성공 태클' : '골';
  const secondLabel = isGK || isDefender ? '클린시트' : '도움';
  const value = (line: PlayerStatLine, key: typeof firstStat | typeof secondStat) => line[key] ?? 0;
  const clubId = turn.clubId;
  const standing = turn.leagueTable.find((row) => row.clubId === clubId);
  const cups = new Set([
    ...turn.progress.map((p) => p.competitionId),
    ...turn.matches.filter((m) => ['DOMESTIC_CUP', 'CONTINENTAL', 'INTERNATIONAL'].includes(m.competitionType)).map((m) => m.competitionId),
  ]);
  const played = Object.entries(turn.playerStats).filter(([, line]) => line.appearances > 0) as Array<[CompetitionType, PlayerStatLine]>;
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-5">
        <p className="eyebrow">TURN REVIEW</p>
        <h3 className="mt-1 text-xl font-semibold text-zinc-50">{seasonLabel(turn.turn.season)} {TURN_PHASE_LABELS[turn.turn.phase]}</h3>
        <p className="mt-1 text-xs text-zinc-400">{game.player.profile.name} · {turn.playerPosition ?? game.player.profile.role.position} · 이번 턴 전체 대회 합산 · {total.minutes}분 출전</p>
        <div className={cx('mt-5 grid grid-cols-2 gap-5', isMidfielder ? 'sm:grid-cols-3' : 'sm:grid-cols-4')}>
          <Stat label="출전 경기" value={total.appearances} sub={`선발 ${total.starts}회`} accent />
          <Stat label={firstLabel} value={value(total, firstStat)} accent />
          <Stat label={secondLabel} value={value(total, secondStat)} accent />
          <Stat label="평균 평점" value={ratingText(averageRating(total))} accent />
          {isMidfielder ? <><Stat label="패스 성공률" value={passAccuracy(total) === null ? '-' : `${passAccuracy(total)!.toFixed(1)}%`} sub={`${total.passesCompleted ?? 0} / ${total.passesAttempted ?? 0}회`} accent /><Stat label="키패스" value={total.keyPasses} accent /></> : null}
        </div>
        {isDefender ? <p className="mt-3 text-xs text-zinc-300">공격 기여 · {total.goals}골 {total.assists}도움</p> : null}
      </div>

      <Card title="대회별 개인 성적">
        {played.length ? <div className="overflow-x-auto"><table className={cx('w-full text-right text-xs tabular-nums', isMidfielder ? 'min-w-[480px]' : 'min-w-[280px]')}>
          <thead className="text-zinc-400"><tr><th className="pb-3 text-left font-medium">대회</th><th className="pb-3 font-medium">출전</th><th className="pb-3 font-medium">{firstLabel}</th><th className="pb-3 font-medium">{secondLabel}</th>{isMidfielder ? <><th className="pb-3 font-medium">패스 성공률</th><th className="pb-3 font-medium">키패스</th></> : null}<th className="pb-3 font-medium">평점</th></tr></thead>
          <tbody>{played.map(([type, line]) => <tr key={type} className="border-t border-zinc-800"><td className="py-3 text-left text-zinc-200">{COMPETITION_LABELS[type]}</td><td>{line.appearances}</td><td className="text-emerald-300">{value(line, firstStat)}</td><td>{value(line, secondStat)}</td>{isMidfielder ? <><td>{passAccuracy(line) === null ? '-' : `${passAccuracy(line)!.toFixed(1)}%`}</td><td>{line.keyPasses}</td></> : null}<td>{ratingText(averageRating(line))}</td></tr>)}</tbody>
        </table></div> : <p className="text-sm text-zinc-400">이번 턴에는 출전 기록이 없습니다.</p>}
      </Card>

      <div className="grid items-start gap-5 md:grid-cols-2">
        <Card title="리그 결과 · 순위" actions={standing ? <Tag tone="emerald">{standing.position}위 · {standing.points}점</Tag> : undefined}>
          {standing ? <p className="mb-3 text-xs text-zinc-400">{clubLabel(clubId)} · 시즌 누적 {standing.wins}승 {standing.draws}무 {standing.losses}패</p> : null}
          {turn.teamStats.LEAGUE ? <p className="mb-3 text-xs text-zinc-200">이번 턴 {turn.teamStats.LEAGUE.wins}승 {turn.teamStats.LEAGUE.draws}무 {turn.teamStats.LEAGUE.losses}패</p> : null}
          {turn.leagueTable.length ? <div className="max-h-80 overflow-auto"><table className="w-full min-w-[240px] text-right text-xs tabular-nums">
            <thead className="sticky top-0 bg-zinc-900 text-zinc-400"><tr><th className="py-2 text-left font-medium">순위 / 팀</th><th className="font-medium">경기</th><th className="font-medium">득실</th><th className="font-medium">승점</th></tr></thead>
            <tbody>{turn.leagueTable.map((row) => <tr key={row.clubId} className={cx('border-t border-zinc-800', row.clubId === clubId ? 'bg-emerald-400/10 font-semibold text-emerald-300' : 'text-zinc-300')}><td className="py-2.5 text-left">{row.position}. {clubLabel(row.clubId)}</td><td>{row.played}</td><td>{row.goalsFor - row.goalsAgainst}</td><td className="font-semibold">{row.points}</td></tr>)}</tbody>
          </table></div> : <p className="text-sm text-zinc-400">이번 턴에는 1군 리그 경기가 없습니다.</p>}
          {turn.trophies.filter((t) => t.competitionId === turn.leagueId).map((t) => <p key={t.competitionId} className="mt-3 text-sm font-semibold text-amber-300">🏆 {competitionName(t.competitionId)} 우승</p>)}
        </Card>
        <Card title="컵 대회 결과 · 현황">
          {cups.size ? <ul className="flex flex-col gap-4">{[...cups].map((id) => {
            const progress = turn.progress.find((p) => p.competitionId === id);
            const matches = turn.matches.filter((m) => m.competitionId === id);
            const trophy = turn.trophies.some((t) => t.competitionId === id);
            const champion = trophy || progress?.status === 'CHAMPION';
            const status = champion ? '우승' : progress?.status === 'ELIMINATED' ? '탈락' : '진행 중';
            return <li key={id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">{competitionName(id)}</h4><Tag tone={champion ? 'amber' : status === '탈락' ? 'rose' : 'emerald'}>{status}</Tag></div>
              <p className="mt-1 text-xs text-zinc-400">{progress?.stageReached ?? matches.at(-1)?.stage ?? '대회 진행 중'}</p>
              {matches.length ? <p className="mt-2 text-xs text-zinc-200">최근 경기 · {matches.at(-1)!.home.name} <b>{matches.at(-1)!.score.home}–{matches.at(-1)!.score.away}</b> {matches.at(-1)!.away.name}</p> : null}
              {matches.length ? <details className="mt-3 text-xs"><summary className="cursor-pointer text-zinc-300">이번 턴 {matches.length}경기 결과 보기</summary><ul className="mt-2 flex flex-col gap-2">{matches.map((match) => <li key={match.fixtureId} className="text-zinc-400">{match.stage} · {match.home.name} <b className="text-zinc-100">{match.score.home}–{match.score.away}</b> {match.away.name}{match.player ? '' : ' · 미출전'}</li>)}</ul></details> : null}
            </li>;
          })}</ul> : <p className="text-sm text-zinc-400">이번 턴에는 참가 중인 컵 대회가 없습니다.</p>}
        </Card>
      </div>
    </div>
  );
}
