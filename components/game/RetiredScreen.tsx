'use client';

import { Avatar } from '@/components/Avatar';
import { PlayerStage } from '@/components/pixel/PlayerStage';
import { AWARD_LABELS } from '@/engine/awards';
import { BASE_WORLD } from '@/engine/career';
import { averageRating } from '@/engine/simulator';
import { formatMoney } from '@/engine/state';
import { useGameStore } from '@/store/gameStore';
import type { AwardType, GameState } from '@/types/game';
import { CareerShareCard } from './CareerShareCard';
import { clubLabel, ratingText } from './format';
import { RecordsTab } from './tabs/RecordsTab';
import { Button, Card, Stat, Tag } from './ui';

export function RetiredScreen({ game }: { game: GameState }) {
  const reset = useGameStore((s) => s.reset);
  const summary = game.retirement;
  const { player } = game;
  const lastClub = player.clubHistory.at(-1)?.clubId;
  const awardCounts = game.awards
    .filter((a) => a.rank === 1)
    .reduce<Partial<Record<AwardType, number>>>((acc, a) => ({ ...acc, [a.type]: (acc[a.type] ?? 0) + 1 }), {});

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8">
      <Card className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <PlayerStage variant="stage">
          <Avatar appearance={player.profile.appearance} kit={lastClub ? BASE_WORLD.clubs[lastClub]?.kitColors : null} size={125} idle />
        </PlayerStage>
        <div className="flex-1">
          <p className="font-pixel text-xs font-bold text-emerald-400">FULL TIME · 현역 은퇴</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-50 drop-shadow-[2px_2px_0_#05080f]">{player.profile.name}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {summary?.age ?? player.age}세 은퇴 · {player.profile.startSeason}–{summary?.season ?? game.turn.season} ·{' '}
            {(summary?.clubs ?? []).map((id) => clubLabel(id)).join(' → ')}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-1 sm:justify-start">
            {Object.entries(awardCounts).map(([type, count]) => (
              <Tag key={type} tone="amber">
                {AWARD_LABELS[type as AwardType]} ×{count}
              </Tag>
            ))}
            {(summary?.legendClubs ?? []).map((id) => (
              <Tag key={id} tone="violet">
                👑 {clubLabel(id)} 레전드
              </Tag>
            ))}
          </div>
        </div>
        <Button variant="primary" onClick={reset}>
          새 커리어 시작
        </Button>
      </Card>

      {summary ? (
        <Card title="커리어 요약">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
            <Stat label="공식전" value={summary.totals.appearances} />
            <Stat label="골" value={summary.totals.goals} />
            <Stat label="도움" value={summary.totals.assists} />
            <Stat label="평균 평점" value={ratingText(averageRating(summary.totals))} />
            <Stat label="우승" value={summary.trophies} />
            <Stat label="발롱도르" value={summary.ballonDorWins} />
            <Stat label="총 자산" value={formatMoney(player.money)} />
          </div>
        </Card>
      ) : null}

      <CareerShareCard game={game} defaultOpen />

      <RecordsTab game={game} showShare={false} />
    </div>
  );
}
