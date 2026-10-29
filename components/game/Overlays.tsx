'use client';

import { Avatar, type AvatarTrophy } from '@/components/Avatar';
import { PixelTrophy } from '@/components/pixel/PixelIcons';
import { PlayerStage } from '@/components/pixel/PlayerStage';
import { BASE_WORLD } from '@/engine/career';
import { kitColorsFor } from '@/engine/world';
import { useGameStore } from '@/store/gameStore';
import type { Ceremony, GameState, Notice } from '@/types/game';
import { Button, cx, Modal, Tag } from './ui';

/** 시상식 무대: 세계 시상식은 턱시도(+수상 트로피), 리그 시상식은 소속팀 유니폼 */
function CeremonyStage({ ceremony }: { ceremony: Ceremony }) {
  const player = useGameStore((s) => s.game?.player);
  if (!player) return null;
  const ballon = ceremony.entries.find((e) => e.award === 'BALLON_DOR');
  const fifa = ceremony.entries.find((e) => e.award === 'FIFA_BEST');
  const isWorld = ceremony.kind === 'WORLD';
  const trophy: AvatarTrophy | null = isWorld ? (ballon?.winner.isPlayer ? 'BALLON_DOR' : fifa?.winner.isPlayer ? 'FIFA_BEST' : null) : null;
  const clubId = player.contract?.clubId;
  const kit = clubId ? kitColorsFor(BASE_WORLD, clubId) : null;
  const rank = ballon?.playerRank ?? null;
  const caption = !isWorld
    ? `${player.profile.name}, 시즌을 마무리하는 시상식에 참석했다.`
    : trophy === 'BALLON_DOR'
      ? `${player.profile.name}, 발롱도르를 들어 올렸다!`
      : trophy === 'FIFA_BEST'
        ? `${player.profile.name}, FIFA 올해의 선수 트로피를 받았다!`
        : rank !== null && rank <= 30
          ? `턱시도를 차려입고 레드카펫에 섰다. 발롱도르 ${rank}위.`
          : '턱시도를 차려입고 시상식을 지켜봤다.';
  return (
    <div className="mb-4 flex items-center gap-4">
      <PlayerStage variant={isWorld ? 'stage' : 'pitch'}>
        <Avatar
          appearance={player.profile.appearance}
          kit={kit}
          outfit={isWorld ? 'TUXEDO' : 'KIT'}
          trophy={trophy}
          size={129}
          idle={Boolean(trophy)}
          label={isWorld ? `${player.profile.name} (턱시도)` : player.profile.name}
        />
      </PlayerStage>
      <p className={cx('text-sm text-zinc-200', trophy && 'font-pixel text-base font-bold text-amber-300')}>{caption}</p>
    </div>
  );
}

export function CeremonyModal({ ceremony }: { ceremony: Ceremony }) {
  const dismiss = useGameStore((s) => s.dismissCeremony);
  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <PixelTrophy size={20} />
          {ceremony.title}
        </span>
      }
    >
      <CeremonyStage ceremony={ceremony} />
      <ul className="flex flex-col gap-3">
        {ceremony.entries.map((entry) => {
          const won = entry.winner.isPlayer;
          return (
            <li
              key={entry.award + entry.label}
              className={cx('m-[2px] p-3', won ? 'bg-amber-950/60 shadow-[0_0_0_2px_#f5b82e]' : 'px-inset')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-pixel text-xs font-bold text-zinc-50">{entry.label}</span>
                {won ? <Tag tone="amber">수상!</Tag> : entry.playerRank && entry.ranking ? <Tag>내 순위 {entry.playerRank}위</Tag> : null}
              </div>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                {entry.winner.name === '-' ? '' : `${entry.winner.name} (${entry.winner.clubName})`}
                {entry.detail ? <span className="text-zinc-500"> · {entry.detail}</span> : null}
              </p>
              {entry.ranking ? (
                <ol className="mt-2 grid grid-cols-1 gap-0.5 text-xs sm:grid-cols-2">
                  {entry.ranking.map((r) => (
                    <li key={r.rank} className={r.isPlayer ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'}>
                      {r.rank}. {r.name} <span className="text-zinc-400">{r.clubName}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Button variant="primary" className="mt-4 w-full" onClick={dismiss}>
        확인
      </Button>
    </Modal>
  );
}

const POPUP_ICON: Partial<Record<Notice['kind'], string>> = {
  RECORD: '📈',
  LEGEND: '👑',
  AWARD: '🏆',
  TRANSFER: '✈️',
  CONTRACT: '📝',
  PROMOTION: '⬆️',
  PARTNER: '🤝',
  RIVAL: '⚔️',
  SQUAD: '⭐',
  INFO: '📣',
};

export function NoticePopup({ notice, pending }: { notice: Notice; pending: Notice[] }) {
  const ack = useGameStore((s) => s.ackPopup);
  const ackAll = useGameStore((s) => s.ackPopups);
  return (
    <Modal title={`${POPUP_ICON[notice.kind] ?? '📣'} ${notice.title}`}>
      <p className="text-sm text-zinc-700 dark:text-zinc-300">{notice.body}</p>
      <div className="mt-4 flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => ack(notice.id)}>
          확인{pending.length > 1 ? ` (${pending.length - 1}개 더)` : ''}
        </Button>
        {pending.length > 1 ? (
          <Button variant="secondary" onClick={() => ackAll(pending.map((n) => n.id))}>
            모두 확인
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}

/** 아직 확인하지 않은 팝업 알림 (오래된 순) */
export function pendingPopups(game: GameState, acked: string[]): Notice[] {
  return game.notices.filter((n) => n.popup && !acked.includes(n.id)).reverse();
}
