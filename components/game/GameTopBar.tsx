import { PixelBall } from '@/components/pixel/PixelIcons';
import { turnLabel } from '@/engine/state';
import { FLOW_LABELS, FLOW_STEPS, stepStatus, type FlowStep } from '@/store/flow';
import type { GameState } from '@/types/game';
import { cx } from './ui';

/** 화면 맨 위: 로고 · 턴 진행 단계(경기 → 사건 → 훈련 → 상점 → 이적) · 전광판 */
export function GameTopBar({ game, step, onStep }: { game: GameState; step?: FlowStep; onStep?: (step: FlowStep) => void }) {
  return (
    <header className="game-topbar">
      <div className="flex items-center gap-2">
        <span className="brand-mark"><PixelBall size={22} /></span>
        <div className="leading-tight">
          <p className="font-pixel text-xs font-bold tracking-wide text-zinc-100">FOOTBALL CAREER</p>
          <p className="text-[11px] text-zinc-300">축구 커리어 시뮬레이터</p>
        </div>
      </div>

      {step && onStep ? (
        <nav aria-label="턴 진행 단계" className="order-last w-full overflow-x-auto md:order-none md:w-auto">
          <ol className="step-nav min-w-max items-center">
            {FLOW_STEPS.map((s, i) => {
              const status = stepStatus(game, s);
              const active = s === step;
              return (
                <li key={s}>
                    <button
                      type="button"
                      onClick={() => onStep(s)}
                      aria-current={active ? 'step' : undefined}
                      className={cx(
                        'px-focus flex items-center gap-1.5 px-3 py-2 text-xs font-bold',
                        active ? 'bg-emerald-400 text-zinc-950' : status === 'done' ? 'bg-emerald-800 text-emerald-100' : status === 'empty' ? 'bg-zinc-900 text-zinc-500' : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
                      )}
                    >
                      <span>{status === 'done' && !active ? '✓' : i + 1}</span>
                      {FLOW_LABELS[s]}
                    </button>
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}

      <div className="px-inset m-[2px] flex items-center gap-2 px-3 py-1.5">
        <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
        <span className="font-pixel text-xs text-zinc-300">{turnLabel(game.turn)}</span>
      </div>
    </header>
  );
}
