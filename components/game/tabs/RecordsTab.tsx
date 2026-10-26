'use client';

import { AWARD_LABELS } from '@/engine/awards';
import { BASE_WORLD } from '@/engine/career';
import { careerTotals } from '@/engine/records';
import { averageRating, mergeStatLines } from '@/engine/simulator';
import type { GameState } from '@/types/game';
import { CareerShareCard } from '../CareerShareCard';
import { clubLabel, competitionName, ratingText, seasonLabel } from '../format';
import { Card, Stat, Tag } from '../ui';

export function RecordsTab({ game, showShare = true }: { game: GameState; showShare?: boolean }) {
  const totals = careerTotals(game);
  const { nationalTeam } = game.player;
  const titles = game.awards.filter((a) => a.rank === 1);
  const ballon = game.awards.filter((a) => a.type === 'BALLON_DOR');

  return (
    <div className="flex flex-col gap-4">
      {showShare ? <CareerShareCard game={game} /> : null}
      <Card title="통산 기록 (공식전)">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Stat label="출전" value={totals.appearances} />
          <Stat label="골" value={totals.goals} />
          <Stat label="도움" value={totals.assists} />
          <Stat label="클린시트" value={totals.cleanSheets} />
          <Stat label="평균 평점" value={ratingText(averageRating(totals))} />
          <Stat label="A매치" value={`${nationalTeam.caps}경기`} sub={`${nationalTeam.goals}골 ${nationalTeam.assists}도움`} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`개인상 (${titles.length})`}>
          {game.awards.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {[...game.awards].reverse().map((award, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="text-zinc-800 dark:text-zinc-200">
                    {seasonLabel(award.season)} {AWARD_LABELS[award.type]}
                  </span>
                  <Tag tone={award.rank === 1 ? 'amber' : 'zinc'}>{award.rank === 1 ? '수상' : `${award.rank}위`}</Tag>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">아직 수상 기록이 없다.</p>
          )}
          {ballon.length ? (
            <p className="mt-2 text-xs text-zinc-500">발롱도르 최고 순위: {Math.min(...ballon.map((b) => b.rank))}위</p>
          ) : null}
        </Card>

        <Card title={`우승 (${game.trophies.length})`}>
          {game.trophies.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {[...game.trophies].reverse().map((t, i) => (
                <li key={i} className="text-zinc-800 dark:text-zinc-200">
                  🏆 {seasonLabel(t.season)} {competitionName(t.competitionId)} <span className="text-xs text-zinc-500">({t.teamKind === 'NATION' ? '국가대표' : clubLabel(t.teamId)})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">첫 우승을 향해!</p>
          )}
        </Card>
      </div>

      {game.recordBreaks.length || game.legends.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="기록 경신">
            <ul className="flex flex-col gap-2 text-sm">
              {game.recordBreaks.map((r, i) => (
                <li key={i} className="text-zinc-800 dark:text-zinc-200">
                  {r.scope === 'CLUB' ? clubLabel(r.scopeId) : r.scope === 'LEAGUE' ? competitionName(r.scopeId) : `${BASE_WORLD.nations[r.scopeId]?.nameKo ?? r.scopeId} 대표팀`} — {r.previousHolder}의{' '}
                  {r.previousValue} 경신 → {r.newValue}
                </li>
              ))}
              {!game.recordBreaks.length ? <li className="text-xs text-zinc-500">아직 없다.</li> : null}
            </ul>
          </Card>
          <Card title="구단 레전드">
            <ul className="flex flex-col gap-2 text-sm">
              {game.legends.map((l) => (
                <li key={l.clubId} className="text-zinc-800 dark:text-zinc-200">
                  <span className="font-semibold">{clubLabel(l.clubId)}</span>
                  <p className="text-xs text-zinc-500">{l.tribute}</p>
                </li>
              ))}
              {!game.legends.length ? <li className="text-xs text-zinc-500">아직 없다.</li> : null}
            </ul>
          </Card>
        </div>
      ) : null}

      <Card title="시즌별 기록">
        {game.history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs tabular-nums">
              <thead className="text-zinc-500">
                <tr>
                  <th className="text-left font-medium">시즌</th>
                  <th className="text-left font-medium">소속</th>
                  <th className="text-right font-medium">나이</th>
                  <th className="text-right font-medium">OVR</th>
                  <th className="text-right font-medium">출전</th>
                  <th className="text-right font-medium">골</th>
                  <th className="text-right font-medium">도움</th>
                  <th className="text-right font-medium">평점(전/후/시즌/컵)</th>
                  <th className="text-right font-medium">순위</th>
                  <th className="pl-4 text-left font-medium">수상·우승</th>
                </tr>
              </thead>
              <tbody className="text-zinc-800 dark:text-zinc-200">
                {[...game.history].reverse().map((s) => {
                  const club = mergeStatLines(s.stats.LEAGUE, s.stats.DOMESTIC_CUP, s.stats.CONTINENTAL);
                  return (
                    <tr key={s.season} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="py-1">{seasonLabel(s.season)}</td>
                      <td className="max-w-28 truncate">{clubLabel(s.clubId)}</td>
                      <td className="text-right">{s.age}</td>
                      <td className="text-right">
                        {s.ovrStart}→{s.ovrEnd}
                      </td>
                      <td className="text-right">
                        {club.appearances}
                        {s.stats.RESERVE.appearances ? <span className="text-zinc-400"> (B {s.stats.RESERVE.appearances})</span> : null}
                      </td>
                      <td className="text-right">{club.goals}</td>
                      <td className="text-right">{club.assists}</td>
                      <td className="text-right">
                        {ratingText(s.ratings.firstHalf)} / {ratingText(s.ratings.secondHalf)} / {ratingText(s.ratings.season)} / {ratingText(s.ratings.cups)}
                      </td>
                      <td className="text-right">{s.leaguePosition ?? '-'}</td>
                      <td className="max-w-48 truncate pl-4">
                        {[...s.awards.filter((a) => a.rank === 1 || a.type === 'BALLON_DOR').map((a) => (a.rank === 1 ? AWARD_LABELS[a.type] : `발롱 ${a.rank}위`)), ...s.trophies.map((t) => `🏆${competitionName(t.competitionId)}`)].join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">첫 시즌이 끝나면 기록이 쌓입니다.</p>
        )}
      </Card>

      <Card title="구단별 통산">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-xs tabular-nums">
            <thead className="text-zinc-500">
              <tr>
                <th className="text-left font-medium">구단</th>
                <th className="text-right font-medium">기간</th>
                <th className="text-right font-medium">출전</th>
                <th className="text-right font-medium">골</th>
                <th className="text-right font-medium">도움</th>
                <th className="text-right font-medium">CS</th>
                <th className="text-right font-medium">우승</th>
              </tr>
            </thead>
            <tbody className="text-zinc-800 dark:text-zinc-200">
              {Object.entries(game.careerByClub).map(([clubId, line]) => (
                <tr key={clubId}>
                  <td>{clubLabel(clubId)}</td>
                  <td className="text-right">
                    {line.firstSeason}–{line.lastSeason}
                  </td>
                  <td className="text-right">{line.appearances}</td>
                  <td className="text-right">{line.goals}</td>
                  <td className="text-right">{line.assists}</td>
                  <td className="text-right">{line.cleanSheets}</td>
                  <td className="text-right">{line.trophies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
