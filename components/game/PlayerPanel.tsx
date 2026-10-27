'use client';

import { Avatar } from '@/components/Avatar';
import { PlayerStage } from '@/components/pixel/PlayerStage';
import { SQUAD_LEVEL_LABELS } from '@/data/labels';
import { BASE_WORLD, canRetire } from '@/engine/career';
import { formatMoney } from '@/engine/state';
import { useGameStore } from '@/store/gameStore';
import type { GameState } from '@/types/game';
import { clubLabel, playingTimeLabel, seasonLabel } from './format';
import { Button, Meter, Tag } from './ui';

/** 왼쪽: 선수 카드 (아바타 · 소속 · 상태 게이지 · 계약) */
export function PlayerPanel({ game, onOpen }: { game: GameState; onOpen: (modal: 'player' | 'records' | 'turn') => void }) {
  const retire = useGameStore((s) => s.retire);
  const reset = useGameStore((s) => s.reset);
  const { player } = game;
  const contract = player.contract;
  const club = contract ? BASE_WORLD.clubs[contract.clubId] : null;
  const league = contract ? BASE_WORLD.leagues[game.clubs[contract.clubId].leagueId] : null;
  const partner = game.partner ? game.npcs[game.partner.npcId] : null;
  const rival = game.rival ? game.npcs[game.rival.npcId] : null;

  return (
    <section className="px-panel player-panel flex min-h-0 flex-col gap-5 p-5">
      <div className="flex items-end gap-3 lg:flex-col lg:items-stretch">
        <PlayerStage className="lg:w-full">
          <Avatar appearance={player.profile.appearance} kit={club?.kitColors} size={129} ball idle />
        </PlayerStage>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-bold text-zinc-50">{player.profile.name}</h1>
            <Tag tone="emerald">OVR {player.ovr}</Tag>
          </div>
          <p className="truncate text-[11px] text-zinc-400">
            {BASE_WORLD.nations[player.profile.nationality]?.nameKo} · {player.age}세 · {player.profile.role.position}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-zinc-50">{club ? club.nameKo : 'FA (무소속)'}</p>
          <p className="truncate text-[11px] text-zinc-400">
            {league?.nameKo ?? '-'}
            {contract ? ` · ${SQUAD_LEVEL_LABELS[player.squad.level]} · ${playingTimeLabel(player.squad.playingTime)}` : ''}
          </p>
          {contract?.type === 'LOAN' ? (
            <div className="mt-1">
              <Tag tone="sky">임대 · 원소속 {clubLabel(contract.parentClubId)}</Tag>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <Meter label="체력" value={player.condition} />
        <Meter label="멘탈" value={player.mental} />
        <Meter label="명성" value={player.reputation} />
        <Meter label="입지" value={player.squad.standing} />
        <div className="col-span-2"><Meter label={`약발 숙련도 · 주발 ${player.profile.dominantFoot === 'LEFT' ? '왼발' : '오른발'}`} value={player.weakFoot ?? 40} /></div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <dt className="text-zinc-400">계약</dt>
          <dd className="font-pixel text-xs text-zinc-50">{contract ? `~${seasonLabel(contract.endSeason)}` : '없음'}</dd>
          {contract ? <dd className="text-zinc-400">연봉 {formatMoney(contract.wage)}</dd> : null}
        </div>
        <div>
          <dt className="text-zinc-400">자산</dt>
          <dd className="font-pixel text-xs text-amber-300">{formatMoney(player.money)}</dd>
          <dd className="text-zinc-400">A매치 {player.nationalTeam.caps}경기</dd>
        </div>
      </dl>

      {partner || rival ? (
        <ul className="flex flex-col gap-1 text-[11px]">
          {partner ? (
            <li className="truncate text-violet-300">🤝 파트너 {partner.name} · 합작 {game.partner!.totals.jointGoals}골</li>
          ) : null}
          {rival ? (
            <li className="truncate text-rose-300">
              ⚔️ 라이벌 {rival.name} · {game.rival!.headToHead.wins}승 {game.rival!.headToHead.draws}무 {game.rival!.headToHead.losses}패
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="mt-auto flex flex-col gap-2 pt-1">
        {game.lastTurn ? <Button variant="primary" onClick={() => onOpen('turn')}>이번 턴 결과 보기</Button> : null}
        <div className="grid grid-cols-2 gap-1">
          <Button onClick={() => onOpen('player')}>선수 정보</Button>
          <Button onClick={() => onOpen('records')}>기록실</Button>
        </div>
        <div className="flex justify-between text-[11px]">
          {canRetire(game) ? (
            <button
              type="button"
              className="px-focus text-rose-300 hover:text-rose-200"
              onClick={() => {
                if (window.confirm('정말 은퇴할까요? 되돌릴 수 없습니다.')) retire();
              }}
            >
              은퇴하기
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="px-focus text-zinc-500 hover:text-zinc-300"
            onClick={() => {
              if (window.confirm('세이브를 지우고 새로 시작할까요?')) reset();
            }}
          >
            세이브 삭제
          </button>
        </div>
      </div>
    </section>
  );
}
