'use client';

import { Avatar } from '@/components/Avatar';
import { PlayerStage } from '@/components/pixel/PlayerStage';
import { SQUAD_LEVEL_LABELS } from '@/data/labels';
import { PLAYSTYLE_DEFINITIONS } from '@/data/playstyles';
import { BASE_WORLD } from '@/engine/career';
import { formatMoney, turnLabel } from '@/engine/state';
import type { GameState } from '@/types/game';
import { clubLabel, playingTimeLabel, seasonLabel } from './format';
import { Card, Meter, Stat, Tag } from './ui';

export function PlayerHeader({ game }: { game: GameState }) {
  const { player } = game;
  const contract = player.contract;
  const club = contract ? BASE_WORLD.clubs[contract.clubId] : null;
  const league = contract ? BASE_WORLD.leagues[game.clubs[contract.clubId].leagueId] : null;

  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-4">
        <PlayerStage>
          <Avatar appearance={player.profile.appearance} kit={club?.kitColors} size={129} ball idle />
        </PlayerStage>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-bold text-zinc-50 drop-shadow-[2px_2px_0_#05080f]">{player.profile.name}</h1>
            <Tag tone="emerald">OVR {player.ovr}</Tag>
          </div>
          <p className="text-xs text-zinc-500">
            {BASE_WORLD.nations[player.profile.nationality]?.nameKo} · {player.age}세 · {player.profile.heightCm}cm / {player.weightKg}kg ·{' '}
            {player.profile.role.position} {PLAYSTYLE_DEFINITIONS[player.profile.role.playStyle].label}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-zinc-100">
            {club ? club.nameKo : 'FA (무소속)'}
            {league ? <span className="text-zinc-500"> · {league.nameKo}</span> : null}
            {contract?.type === 'LOAN' ? <Tag tone="sky">임대 · 원소속 {clubLabel(contract.parentClubId)}</Tag> : null}
          </p>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Stat label="진행" value={turnLabel(game.turn)} />
        <Stat
          label="입지"
          value={player.contract ? `${SQUAD_LEVEL_LABELS[player.squad.level]} · ${playingTimeLabel(player.squad.playingTime)}` : '-'}
          sub={player.contract ? `입지 점수 ${player.squad.standing}` : undefined}
        />
        <Stat
          label="계약"
          value={contract ? `~${seasonLabel(contract.endSeason)}` : '없음'}
          sub={contract ? `연봉 ${formatMoney(contract.wage)}` : undefined}
        />
        <Stat label="자산" value={formatMoney(player.money)} sub={`명성 ${Math.round(player.reputation)}`} />
        <Meter label="체력" value={player.condition} />
        <Meter label="멘탈" value={player.mental} />
        <Meter label="명성" value={player.reputation} />
        <Meter label="입지 점수" value={player.squad.standing} />
      </div>
    </Card>
  );
}
