import type { ReactNode } from 'react';

/**
 * 도트 캐릭터를 세우는 무대.
 * - pitch: 조명이 비추는 잔디 (평소)
 * - stage: 금빛 조명 + 레드카펫 (시상식)
 */
export function PlayerStage({ children, variant = 'pitch', className }: { children: ReactNode; variant?: 'pitch' | 'stage'; className?: string }) {
  const background =
    variant === 'stage'
      ? 'radial-gradient(ellipse 70% 60% at 50% 0%, rgb(255 214 102 / 0.45), transparent 70%), linear-gradient(180deg, #1a1030 0 70%, #7a1c2a 70% 74%, #a3263a 74% 100%)'
      : 'radial-gradient(ellipse 70% 60% at 50% 0%, rgb(255 246 205 / 0.28), transparent 70%), linear-gradient(180deg, #0f1a2c 0 66%, #e8f2e4 66% calc(66% + 2px), #1f7a3c calc(66% + 2px) 83%, #1b6c35 83% 100%)';
  return (
    <div
      className={['px-inset m-[2px] flex shrink-0 items-end justify-center overflow-hidden px-3 pt-3 pb-1', className ?? ''].join(' ')}
      style={{ background }}
    >
      {children}
    </div>
  );
}
