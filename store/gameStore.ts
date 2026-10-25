/**
 * 게임 상태 스토어 (Zustand + LocalStorage 세이브)
 *
 * 현재는 세이브 구조만 정의한 골격이다. 턴 진행·턴 사이 페이즈 액션은
 * 커리어 루프(engine/career) 구현 단계에서 추가한다.
 * TurnSession은 순수 데이터라 하이라이트 대기 중에도 그대로 저장·복원된다.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { TurnSession } from '@/engine/simulator';
import type { GameState } from '@/types/game';

export const SAVE_KEY = 'fo-car-save';
export const SAVE_VERSION = 1;

interface GameStore {
  game: GameState | null;
  /** 진행 중인 턴 (없으면 턴 사이 페이즈) */
  session: TurnSession | null;
  setGame: (game: GameState | null) => void;
  setSession: (session: TurnSession | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      game: null,
      session: null,
      setGame: (game) => set({ game }),
      setSession: (session) => set({ session }),
      reset: () => set({ game: null, session: null }),
    }),
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ game, session }) => ({ game, session }),
    },
  ),
);
