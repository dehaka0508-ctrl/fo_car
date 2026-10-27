'use client';

import { GAME_EVENT_MAP } from '@/data/events';
import { isChoiceAffordable, renderEventText } from '@/engine/events';
import { formatMoney } from '@/engine/state';
import { useGameStore } from '@/store/gameStore';
import { unresolvedEvents } from '@/store/flow';
import type { EventCategory, GameState } from '@/types/game';
import { Tag } from '../ui';

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

/** 2단계: 사건 대응 (한 번에 하나씩) */
export function EventStep({ game }: { game: GameState }) {
  const answerEvent = useGameStore((s) => s.answerEvent);
  const pending = unresolvedEvents(game);
  const event = pending[0];

  if (!event) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-zinc-300">{game.events.length ? '이번 턴의 사건에 모두 답했습니다.' : '이번 턴에는 사건이 없습니다.'}</p>
        <ul className="flex flex-col gap-1">
          {game.events.map((e) => {
            const def = GAME_EVENT_MAP[e.definitionId];
            return (
              <li key={e.instanceId} className="px-inset m-[2px] p-2 text-xs">
                <span className="text-zinc-200">{renderEventText(def.title, e.vars)}</span>
                <span className="text-zinc-400"> · {def.choices.find((c) => c.id === e.resolution?.choiceId)?.label}</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {e.resolution?.summary.map((line, i) => (
                    <Tag key={i} tone={line.includes('-') || line.includes('실패') ? 'rose' : 'emerald'}>
                      {line}
                    </Tag>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const def = GAME_EVENT_MAP[event.definitionId];
  const index = game.events.length - pending.length + 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Tag tone={def.category === 'VACATION' ? 'emerald' : 'zinc'}>{CATEGORY_LABELS[def.category]}</Tag>
        <span className="font-pixel text-xs text-zinc-400">
          사건 {index} / {game.events.length}
        </span>
      </div>
      <h3 className="text-base font-bold text-zinc-50">{renderEventText(def.title, event.vars)}</h3>
      <p className="text-sm leading-relaxed text-zinc-200">{renderEventText(def.body, event.vars)}</p>
      <div className="grid gap-2">
        {def.choices.map((choice) => {
          const affordable = isChoiceAffordable(choice, game);
          return (
            <button
              key={choice.id}
              type="button"
              disabled={!affordable}
              onClick={() => answerEvent(event.instanceId, choice.id)}
              className="px-btn m-[2px] flex flex-col items-start gap-0.5 bg-zinc-800 p-3 text-left hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-xs font-bold text-zinc-50">{choice.label}</span>
              {choice.description ? <span className="font-sans text-[11px] text-zinc-400">{choice.description}</span> : null}
              {choice.cost || choice.successChance !== undefined ? (
                <span className="font-sans text-[11px] text-amber-300">
                  {choice.cost ? `비용 ${formatMoney(choice.cost)}` : ''}
                  {choice.successChance !== undefined ? ` 성공 확률 ${Math.round(choice.successChance * 100)}%` : ''}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
