/**
 * 게임 상태 스토어 (Zustand + LocalStorage 세이브)
 *
 * 엔진의 순수 함수(engine/career.ts 등)를 호출해 GameState를 갱신한다.
 * 진행 중인 턴(TurnSession)과 바둑돌 매치에서 이미 고른 선택도 함께 저장되므로
 * 하이라이트 도중 새로고침해도 이어서 플레이할 수 있다.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { autoAdvance } from '@/engine/autoplay';
import {
  completeTurn,
  continueTurn,
  createCareer,
  retire as retireCareer,
  startTurn as startCareerTurn,
  worldOf,
} from '@/engine/career';
import type { CharacterInput } from '@/engine/character';
import { resolveEvent } from '@/engine/events';
import { buildAutoHighlightOutcome, buildHighlightScene, resolveSituationChoice } from '@/engine/highlight';
import { buyInterTurn, trainInterTurn } from '@/engine/interTurn';
import type { TurnSession } from '@/engine/simulator';
import {
  acceptOffer as acceptTransferOffer,
  rejectOffer as rejectTransferOffer,
  requestMove,
  requestRenewal,
} from '@/engine/transfer';
import type { GameState, PlayingTime, ResolvedSituation, TrainingPlan } from '@/types/game';

export const SAVE_KEY = 'fo-car-save';
export const SAVE_VERSION = 2;

interface GameStore {
  game: GameState | null;
  /** 진행 중인 턴 (하이라이트 대기) */
  session: TurnSession | null;
  /** 바둑돌 매치에서 지금까지 판정된 선택 */
  highlightPicks: ResolvedSituation[];
  /** 이미 확인한 팝업 알림 */
  ackedPopups: string[];
  /** 마지막 오류·안내 메시지 */
  message: string | null;

  newCareer: (input: CharacterInput, seed?: number) => void;
  playTurn: () => void;
  chooseOption: (situationId: string, optionId: string) => void;
  finishHighlight: () => void;
  autoHighlight: () => void;
  train: (plan: TrainingPlan) => void;
  buy: (itemId: string) => void;
  answerEvent: (instanceId: string, choiceId: string) => void;
  acceptOffer: (offerId: string) => void;
  rejectOffer: (offerId: string) => void;
  requestTransfer: (clubId: string, type: 'TRANSFER' | 'LOAN', playingTime: PlayingTime) => void;
  requestContractRenewal: () => void;
  dismissCeremony: () => void;
  ackPopup: (noticeId: string) => void;
  ackPopups: (noticeIds: string[]) => void;
  retire: () => void;
  autoPlay: (turns: number) => void;
  clearMessage: () => void;
  reset: () => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      /** 엔진 호출을 감싸 오류를 메시지로 바꾼다 */
      const run = (fn: () => Partial<GameStore> | void) => {
        try {
          const patch = fn();
          if (patch) set(patch);
        } catch (error) {
          set({ message: errorText(error) });
        }
      };
      const finish = (session: TurnSession) => {
        const game = get().game;
        if (!game) return;
        set({ game: completeTurn(game, session), session: null, highlightPicks: [] });
      };

      return {
        game: null,
        session: null,
        highlightPicks: [],
        ackedPopups: [],
        message: null,

        newCareer: (input, seed) =>
          run(() => {
            const game = createCareer(input, { seed: seed ?? Math.floor(Math.random() * 1_000_000_000) });
            return { game, session: null, highlightPicks: [], ackedPopups: game.notices.map((n) => n.id), message: null };
          }),

        playTurn: () =>
          run(() => {
            const game = get().game;
            if (!game) return;
            const started = startCareerTurn(game);
            if (started.session.status === 'AWAITING_HIGHLIGHT') {
              return { game: started.state, session: started.session, highlightPicks: [] };
            }
            set({ game: started.state });
            finish(started.session);
          }),

        chooseOption: (situationId, optionId) =>
          run(() => {
            const { session, highlightPicks } = get();
            if (!session || highlightPicks.some((p) => p.situationId === situationId)) return;
            const situation = buildHighlightScene(session)?.situations.find((s) => s.id === situationId);
            if (!situation) return;
            return { highlightPicks: [...highlightPicks, resolveSituationChoice(session, situation, optionId)] };
          }),

        finishHighlight: () =>
          run(() => {
            const { session, highlightPicks } = get();
            if (!session) return;
            const scene = buildHighlightScene(session);
            const outcome = scene ? { fixtureId: scene.briefing.fixture.id, resolved: highlightPicks } : null;
            finish(continueTurn(session, outcome));
          }),

        autoHighlight: () =>
          run(() => {
            const { session } = get();
            if (!session) return;
            finish(continueTurn(session, buildAutoHighlightOutcome(session)));
          }),

        train: (plan) => run(() => ({ game: trainInterTurn(get().game!, plan) })),
        buy: (itemId) => run(() => ({ game: buyInterTurn(get().game!, itemId) })),
        answerEvent: (instanceId, choiceId) => run(() => ({ game: resolveEvent(get().game!, instanceId, choiceId) })),

        acceptOffer: (offerId) =>
          run(() => {
            const game = get().game!;
            return { game: acceptTransferOffer(game, worldOf(game), offerId) };
          }),
        rejectOffer: (offerId) => run(() => ({ game: rejectTransferOffer(get().game!, offerId) })),

        requestTransfer: (clubId, type, playingTime) =>
          run(() => {
            const game = get().game!;
            const result = requestMove(game, worldOf(game), clubId, type, playingTime);
            return { game: result.state, message: result.message };
          }),
        requestContractRenewal: () =>
          run(() => {
            const game = get().game!;
            const result = requestRenewal(game, worldOf(game));
            return { game: result.state, message: result.message };
          }),

        dismissCeremony: () => run(() => ({ game: { ...get().game!, ceremonies: get().game!.ceremonies.slice(1) } })),
        ackPopup: (noticeId) => set({ ackedPopups: [noticeId, ...get().ackedPopups].slice(0, 200) }),
        ackPopups: (noticeIds) => set({ ackedPopups: [...noticeIds, ...get().ackedPopups].slice(0, 200) }),

        retire: () => run(() => ({ game: retireCareer(get().game!, 'VOLUNTARY') })),

        autoPlay: (turns) =>
          run(() => {
            let game = get().game;
            if (!game) return;
            for (let i = 0; i < turns && game.stage === 'READY'; i++) game = autoAdvance(game);
            return { game, message: null };
          }),

        clearMessage: () => set({ message: null }),
        reset: () => set({ game: null, session: null, highlightPicks: [], ackedPopups: [], message: null }),
      };
    },
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ game, session, highlightPicks, ackedPopups }) => ({ game, session, highlightPicks, ackedPopups }),
      // 이전 버전 세이브는 구조가 달라 새로 시작한다
      migrate: () => ({ game: null, session: null, highlightPicks: [], ackedPopups: [] }),
    },
  ),
);
