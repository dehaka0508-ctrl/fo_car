import { Fragment } from 'react';
import { PixelBall } from '@/components/pixel/PixelIcons';
import { turnLabel } from '@/engine/state';
import { FLOW_LABELS, FLOW_STEPS, stepStatus, type FlowStep } from '@/store/flow';
import type { GameState } from '@/types/game';
import { cx } from './ui';

/** 화면 맨 위: 로고 · 턴 진행 단계(경기 → 사건 → 훈련 → 상점 → 이적) · 전광판 */
export function GameTopBar({ game, step, onStep }: { game: GameState; step?: FlowStep; onStep?: (step: FlowStep) => void }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-3">
      <div className="flex items-center gap-2">
        <PixelBall size={24} className="pixel-idle" />
        <div className="leading-tight">
          <p className="font-pixel text-xs font-bold text-amber-300 drop-shadow-[2px_2px_0_#05080f]">FOOTBALL CAREER</p>
          <p className="text-[11px] text-zinc-300 drop-shadow-[1px_1px_0_#05080f]">축구 커리어 시뮬레이터</p>
        </div>
      </div>

      {step && onStep ? (
        <nav aria-label="턴 진행 단계" className="order-last w-full overflow-x-auto md:order-none md:w-auto">
          <ol className="flex min-w-max items-center gap-1">
            {FLOW_STEPS.map((s, i) => {
              const status = stepStatus(game, s);
              const active = s === step;
              return (
                <Fragment key={s}>
                  {i > 0 ? (
                    <li aria-hidden="true" className="text-[10px] text-zinc-500">
                      ▶
                    </li>
                  ) : null}
                  <li>
                    <button
                      type="button"
                      onClick={() => onStep(s)}
                      aria-current={active ? 'step' : undefined}
                      className={cx(
                        'px-btn font-pixel m-[2px] flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold',
                        active ? 'bg-amber-400 text-zinc-950' : status === 'done' ? 'bg-emerald-800 text-emerald-100' : status === 'empty' ? 'bg-zinc-900 text-zinc-500' : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
                      )}
                    >
                      <span>{status === 'done' && !active ? '✓' : i + 1}</span>
                      {FLOW_LABELS[s]}
                    </button>
                  </li>
                </Fragment>
              );
            })}
          </ol>
        </nav>
      ) : null}

      <div className="px-inset m-[2px] flex items-center gap-2 px-3 py-1.5">
        <span className="size-2 animate-pulse bg-rose-500" aria-hidden="true" />
        <span className="font-pixel text-xs text-amber-300 [text-shadow:0_0_6px_rgb(255_210_63/0.6)]">{turnLabel(game.turn)}</span>
      </div>
    </header>
  );
}
