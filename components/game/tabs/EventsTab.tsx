'use client';

import { GAME_EVENT_MAP } from '@/data/events';
import { isChoiceAffordable, renderEventText } from '@/engine/events';
import { formatMoney } from '@/engine/state';
import { useGameStore } from '@/store/gameStore';
import type { EventCategory, GameState } from '@/types/game';
import { Card, cx, Tag } from '../ui';

const CATEGORY_LABELS: Record<EventCategory, string> = {
  FAMILY: '가정사',
  MEDIA: '언론',
  TRAINING_METHOD: '훈련',
  SPONSORSHIP: '스폰서',
  VACATION: '휴가',
  TEAM: '팀',
  PARTNER: '파트너',
  RIVAL: '라이벌',
};

export function EventsTab({ game }: { game: GameState }) {
  const answerEvent = useGameStore((s) => s.answerEvent);
  if (!game.events.length) {
    return (
      <Card title="사건">
        <p className="text-sm text-zinc-500">지금은 처리할 사건이 없습니다. 턴이 끝날 때마다 1~3개의 사건이 생깁니다.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {game.events.map((event) => {
        const def = GAME_EVENT_MAP[event.definitionId];
        return (
          <Card
            key={event.instanceId}
            title={renderEventText(def.title, event.vars)}
            actions={<Tag tone={def.category === 'VACATION' ? 'emerald' : 'zinc'}>{CATEGORY_LABELS[def.category]}</Tag>}
          >
            <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">{renderEventText(def.body, event.vars)}</p>
            {event.resolution ? (
              <div className="rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800/60">
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                  선택: {def.choices.find((c) => c.id === event.resolution?.choiceId)?.label}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {event.resolution.summary.map((line, i) => (
                    <Tag key={i} tone={line.includes('-') || line.includes('실패') ? 'rose' : 'emerald'}>
                      {line}
                    </Tag>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {def.choices.map((choice) => {
                  const affordable = isChoiceAffordable(choice, game);
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      disabled={!affordable}
                      onClick={() => answerEvent(event.instanceId, choice.id)}
                      className={cx(
                        'rounded-lg border p-3 text-left text-sm transition-colors',
                        affordable
                          ? 'border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50 dark:border-zinc-700 dark:hover:bg-emerald-900/20'
                          : 'cursor-not-allowed border-zinc-100 opacity-50 dark:border-zinc-800',
                      )}
                    >
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{choice.label}</span>
                      {choice.description ? <span className="mt-0.5 block text-xs text-zinc-500">{choice.description}</span> : null}
                      <span className="mt-0.5 block text-[11px] text-zinc-400">
                        {choice.cost ? `비용 ${formatMoney(choice.cost)}` : null}
                        {choice.successChance !== undefined ? ` 성공 확률 ${Math.round(choice.successChance * 100)}%` : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
