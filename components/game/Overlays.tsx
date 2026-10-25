'use client';

import { useGameStore } from '@/store/gameStore';
import type { Ceremony, GameState, Notice } from '@/types/game';
import { Button, cx, Modal, Tag } from './ui';

export function CeremonyModal({ ceremony }: { ceremony: Ceremony }) {
  const dismiss = useGameStore((s) => s.dismissCeremony);
  return (
    <Modal title={`🏆 ${ceremony.title}`}>
      <ul className="flex flex-col gap-3">
        {ceremony.entries.map((entry) => {
          const won = entry.winner.isPlayer;
          return (
            <li
              key={entry.award + entry.label}
              className={cx('rounded-lg border p-3', won ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20' : 'border-zinc-200 dark:border-zinc-700')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{entry.label}</span>
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
