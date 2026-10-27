import type { ReactNode } from 'react';

/** A restrained backdrop keeps the player sprite as the focal point. */
export function PlayerStage({ children, variant = 'pitch', className }: { children: ReactNode; variant?: 'pitch' | 'stage'; className?: string }) {
  return (
    <div className={['px-inset player-stage flex shrink-0 items-end justify-center overflow-hidden px-3 pt-3 pb-1', variant === 'stage' && 'player-stage-award', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
