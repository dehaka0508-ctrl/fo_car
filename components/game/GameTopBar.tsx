import { PixelBall } from '@/components/pixel/PixelIcons';
import { turnLabel } from '@/engine/state';
import type { GameState } from '@/types/game';

/** 화면 맨 위: 로고 + 전광판 (뒤로 밤 경기장 조명이 보이도록 투명) */
export function GameTopBar({ game }: { game: GameState }) {
  return (
    <header className="flex items-center justify-between gap-3 pt-4 pb-1">
      <div className="flex items-center gap-2">
        <PixelBall size={24} className="pixel-idle" />
        <div className="leading-tight">
          <p className="font-pixel text-xs font-bold text-amber-300 drop-shadow-[2px_2px_0_#05080f]">FOOTBALL CAREER</p>
          <p className="text-[11px] text-zinc-300 drop-shadow-[1px_1px_0_#05080f]">축구 커리어 시뮬레이터</p>
        </div>
      </div>
      <div className="px-inset m-[2px] flex items-center gap-2 px-3 py-1.5">
        <span className="size-2 animate-pulse bg-rose-500" aria-hidden="true" />
        <span className="font-pixel text-xs text-amber-300 [text-shadow:0_0_6px_rgb(255_210_63/0.6)]">{turnLabel(game.turn)}</span>
      </div>
    </header>
  );
}
