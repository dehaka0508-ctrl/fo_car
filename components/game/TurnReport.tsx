'use client';

import { PlayerToken } from '@/components/Avatar';
import { COMPETITION_TYPE_LABELS, HIGHLIGHT_KIND_LABELS, TURN_PHASE_LABELS } from '@/data/labels';
import { BASE_WORLD } from '@/engine/career';
import { bondLabel } from '@/engine/narrative';
import { averageRating } from '@/engine/simulator';
import { kitColorsFor } from '@/engine/world';
import { COMPETITION_TYPES, type GameState, type TurnResult } from '@/types/game';
import { clubLabel, competitionName, ratingText, seasonLabel } from './format';
import { Card, signed, Tag } from './ui';

function HighlightSummary({ turn, game }: { turn: TurnResult; game: GameState }) {
  const h = turn.highlight;
  if (!h) return null;
  const [us, them] = h.playerTeamSide === 'HOME' ? [h.score.home, h.score.away] : [h.score.away, h.score.home];
  const won = h.score.winner === h.playerTeamSide;
  const draw = h.score.winner === 'DRAW';
  return (
    <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">하이라이트 · {HIGHLIGHT_KIND_LABELS[h.kind]}</span>
        <Tag tone={won ? 'emerald' : draw ? 'amber' : 'rose'}>{won ? '승리' : draw ? '무승부' : '패배'}</Tag>
      </div>
      <div className="flex items-center justify-between gap-2">
        <PlayerToken appearance={game.player.profile.appearance} label={game.player.profile.name} />
        <div className="text-center">
          <div className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {us} - {them}
          </div>
          <div className="text-xs text-zinc-500">vs {h.opponent.name}{h.score.penalties ? ' (승부차기)' : ''}</div>
        </div>
        <PlayerToken kit={kitColorsFor(BASE_WORLD, h.opponent.id)} label={h.opponent.name} />
      </div>
      {h.playerLine ? (
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
          {h.playerLine.minutes}분 · {h.playerLine.goals}골 {h.playerLine.assists}도움 · 평점 {h.playerLine.rating} · 선택 성공 {h.successes}/{h.successes + h.failures}
        </p>
      ) : null}
    </div>
  );
}

export function TurnReport({ turn, game }: { turn: TurnResult; game: GameState }) {
  const rows = COMPETITION_TYPES.filter((type) => turn.playerStats[type].appearances > 0 || turn.teamStats[type]);
  const partnerNpc = turn.partner ? game.npcs[turn.partner.npcId] : null;
  const rivalNpc = turn.rival ? game.npcs[turn.rival.npcId] : null;
  const position = turn.leagueTable.find((row) => row.clubId === turn.clubId)?.position;

  return (
    <Card
      title={`${seasonLabel(turn.turn.season)} ${TURN_PHASE_LABELS[turn.turn.phase]} 결과`}
      actions={
        <span className="text-xs text-zinc-500">
          체력 {turn.condition.start}→{turn.condition.end} · 멘탈 {turn.mental.start}→{turn.mental.end} · 명성 {signed(turn.reputationDelta, 1)} · 입지 {signed(turn.standingDelta)}
        </span>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex min-w-0 flex-col gap-3">
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-xs tabular-nums">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="text-left font-medium">대회</th>
                    <th className="text-right font-medium">팀 승무패</th>
                    <th className="text-right font-medium">출전</th>
                    <th className="text-right font-medium">골</th>
                    <th className="text-right font-medium">도움</th>
                    <th className="text-right font-medium">CS</th>
                    <th className="text-right font-medium">평점</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-800 dark:text-zinc-200">
                  {rows.map((type) => {
                    const line = turn.playerStats[type];
                    const team = turn.teamStats[type];
                    return (
                      <tr key={type}>
                        <td className="py-0.5">{COMPETITION_TYPE_LABELS[type]}</td>
                        <td className="text-right">{team ? `${team.wins}-${team.draws}-${team.losses}` : '-'}</td>
                        <td className="text-right">
                          {line.appearances}
                          {team ? <span className="text-zinc-400">/{team.played}</span> : null}
                        </td>
                        <td className="text-right">{line.goals}</td>
                        <td className="text-right">{line.assists}</td>
                        <td className="text-right">{line.cleanSheets}</td>
                        <td className="text-right">{ratingText(averageRating(line))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">이번 턴에는 경기가 없었다.</p>
          )}
          <div className="flex flex-wrap gap-1">
            {position ? <Tag>리그 {position}위</Tag> : null}
            <Tag>평균 평점 {ratingText(turn.ratings.overall ?? turn.ratings.reserve ?? turn.ratings.friendly)}</Tag>
            {turn.nationalDuty ? <Tag tone="sky">국가대표 차출</Tag> : null}
            {turn.trophies.map((t) => (
              <Tag key={t.competitionId} tone="amber">
                🏆 {competitionName(t.competitionId)}
              </Tag>
            ))}
            {turn.progress
              .filter((p) => p.status !== 'ACTIVE' || turn.turn.phase !== 'PRESEASON')
              .map((p) => (
                <Tag key={p.competitionId} tone={p.status === 'CHAMPION' ? 'amber' : p.status === 'ELIMINATED' ? 'zinc' : 'emerald'}>
                  {competitionName(p.competitionId)}: {p.stageReached}
                  {p.status === 'ELIMINATED' ? ' 탈락' : ''}
                </Tag>
              ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <HighlightSummary turn={turn} game={game} />
          {turn.partner && partnerNpc && game.partner ? (
            <div className="rounded-lg border border-amber-200 p-3 text-xs dark:border-amber-900/50">
              <p className="mb-1 font-semibold text-amber-700 dark:text-amber-300">
                영혼의 파트너 · {partnerNpc.name} ({bondLabel(game.partner.bondType)})
              </p>
              <p className="text-zinc-700 dark:text-zinc-300">
                동반 출전 {turn.partner.appearancesTogether}경기 · {turn.partner.wins}승 {turn.partner.draws}무 {turn.partner.losses}패 · 합작 골{' '}
                {turn.partner.jointGoals} · 클린시트 {turn.partner.cleanSheetsTogether}
              </p>
            </div>
          ) : null}
          {turn.rival && rivalNpc ? (
            <div className="rounded-lg border border-rose-200 p-3 text-xs dark:border-rose-900/50">
              <p className="mb-1 font-semibold text-rose-700 dark:text-rose-300">
                라이벌 비교 · {rivalNpc.name} ({clubLabel(rivalNpc.clubId)})
              </p>
              <table className="w-full tabular-nums">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="text-left font-medium" />
                    <th className="text-right font-medium">경기</th>
                    <th className="text-right font-medium">골</th>
                    <th className="text-right font-medium">도움</th>
                    <th className="text-right font-medium">평점</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-800 dark:text-zinc-200">
                  {[
                    { label: '나', line: turn.rival.player },
                    { label: rivalNpc.name, line: turn.rival.rival },
                  ].map(({ label, line }) => (
                    <tr key={label}>
                      <td className="max-w-20 truncate">{label}</td>
                      <td className="text-right">{line.appearances}</td>
                      <td className="text-right">{line.goals}</td>
                      <td className="text-right">{line.assists}</td>
                      <td className="text-right">{ratingText(line.averageRating)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {turn.rival.headToHead.length ? (
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  맞대결: {turn.rival.headToHead.map((m) => (m.result === 'WIN' ? '승' : m.result === 'DRAW' ? '무' : '패')).join(' ')}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
