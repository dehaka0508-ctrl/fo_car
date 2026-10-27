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
  syncWithDatabase,
  worldOf,
} from '@/engine/career';
import { calculateOVR } from '@/engine/ovr';
import { rollPotential, type CharacterInput } from '@/engine/character';
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
import { ATTRIBUTE_META } from '@/data/attributes';
import { GAME_EVENT_MAP } from '@/data/events';
import { SHOP_ITEM_MAP } from '@/data/items';
import { renderEventText } from '@/engine/events';
import { clubName } from '@/engine/world';
import type { AttributeKey, GameState, PlayingTime, ResolvedSituation, TrainingPlan } from '@/types/game';
import { type FlowStep, nextStep, pendingOffers, unresolvedEvents } from './flow';

/** 방금 한 선택의 결과 (다음 단계 화면 위에 잠깐 보여 준다) */
export interface FlowFlash {
  title: string;
  lines: string[];
}

const signedText = (v: number, digits = 0) => `${v > 0 ? '+' : ''}${digits ? v.toFixed(digits) : Math.round(v)}`;

export const SAVE_KEY = 'fo-car-save';
export const SAVE_VERSION = 2;

interface GameStore {
  game: GameState | null;
  showTurnReport: boolean;
  dismissTurnReport: () => void;
  /** 진행 중인 턴 (하이라이트 대기) */
  session: TurnSession | null;
  /** 바둑돌 매치에서 지금까지 판정된 선택 */
  highlightPicks: ResolvedSituation[];
  /** 이미 확인한 팝업 알림 */
  ackedPopups: string[];
  /** 마지막 오류·안내 메시지 */
  message: string | null;
  /** 턴 진행 단계 (경기 → 사건 → 훈련 → 상점 → 이적) */
  step: FlowStep;
  /** 방금 한 선택의 결과 */
  flash: FlowFlash | null;

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
  /** 단계 표시를 눌러 이동 */
  goStep: (step: FlowStep) => void;
  /** 이 단계를 건너뛰고 다음 단계로 */
  skipStep: () => void;
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
        // 턴이 끝난 뒤에는 구단 DB 변경도 반영한다 (진행 중인 턴에는 손대지 않는다)
        const next = syncWithDatabase(completeTurn(game, session));
        set({ game: next, showTurnReport: true, session: null, highlightPicks: [], step: nextStep(next, 'MATCH'), flash: null });
      };

      return {
        game: null,
        showTurnReport: false,
        dismissTurnReport: () => set({ showTurnReport: false }),
        session: null,
        highlightPicks: [],
        ackedPopups: [],
        message: null,
        step: 'MATCH',
        flash: null,

        newCareer: (input, seed) =>
          run(() => {
            const game = createCareer(input, { seed: seed ?? Math.floor(Math.random() * 1_000_000_000) });
            // 첫 경기 전에도 훈련·상점부터 (답할 사건은 아직 없다)
            return { game, showTurnReport: false, session: null, highlightPicks: [], ackedPopups: game.notices.map((n) => n.id), message: null, step: nextStep(game, 'MATCH'), flash: null };
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

        train: (plan) =>
          run(() => {
            const game = trainInterTurn(get().game!, plan);
            const result = game.interTurn.training!;
            const lines = [
              ...(result.weakFootDelta !== undefined ? [`약발 숙련도 +${result.weakFootDelta}`] : []),
              ...Object.entries(result.deltas).map(([key, delta]) => `${ATTRIBUTE_META[key as AttributeKey].label} ${signedText(delta ?? 0)}`),
              `체력 ${signedText(result.conditionDelta)}`,
              ...(result.weightDelta ? [`몸무게 ${signedText(result.weightDelta, 1)}kg`] : []),
            ];
            return { game, step: nextStep(game, 'TRAINING'), flash: { title: plan.kind === 'REST' ? '휴식 완료' : '훈련 완료', lines } };
          }),
        buy: (itemId) =>
          run(() => {
            const game = buyInterTurn(get().game!, itemId);
            const owned = game.player.inventory.at(-1);
            const item = SHOP_ITEM_MAP[itemId];
            const effect = owned?.effect.mode === 'BOOST' ? `${ATTRIBUTE_META[item.attribute].label} 성장에 도움` : '기량 유지에 도움';
            return { game, step: nextStep(game, 'SHOP'), flash: { title: `${item.name} 구매`, lines: [effect] } };
          }),
        answerEvent: (instanceId, choiceId) =>
          run(() => {
            const game = resolveEvent(get().game!, instanceId, choiceId);
            const event = game.events.find((e) => e.instanceId === instanceId)!;
            const def = GAME_EVENT_MAP[event.definitionId];
            const choice = def.choices.find((c) => c.id === choiceId);
            const flash = { title: `${renderEventText(def.title, event.vars)} · ${choice?.label ?? ''}`, lines: event.resolution?.summary ?? [] };
            return { game, flash, step: unresolvedEvents(game).length ? 'EVENTS' : nextStep(game, 'EVENTS') };
          }),

        acceptOffer: (offerId) =>
          run(() => {
            const before = get().game!;
            const offer = before.offers.find((o) => o.id === offerId);
            const game = acceptTransferOffer(before, worldOf(before), offerId);
            const flash = offer ? { title: `${clubName(worldOf(game), offer.clubId)} 제안 수락`, lines: [] } : null;
            return { game, flash, step: pendingOffers(game).length ? 'TRANSFER' : nextStep(game, 'TRANSFER') };
          }),
        rejectOffer: (offerId) =>
          run(() => {
            const game = rejectTransferOffer(get().game!, offerId);
            return { game, step: pendingOffers(game).length ? 'TRANSFER' : nextStep(game, 'TRANSFER') };
          }),

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
            return { game, showTurnReport: true, message: null, step: nextStep(game, 'MATCH'), flash: null };
          }),

        clearMessage: () => set({ message: null }),
        reset: () => set({ game: null, showTurnReport: false, session: null, highlightPicks: [], ackedPopups: [], message: null, step: 'MATCH', flash: null }),
        goStep: (step) => set({ step, flash: null }),
        skipStep: () => {
          const { game, step } = get();
          if (game) set({ step: nextStep(game, step), flash: null });
        },
      };
    },
    {
      name: SAVE_KEY,
      version: SAVE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ game, session, highlightPicks, ackedPopups, step }) => ({ game, session, highlightPicks, ackedPopups, step }),
      // 이전 버전 세이브는 구조가 달라 새로 시작한다
      migrate: () => ({ game: null, session: null, highlightPicks: [], ackedPopups: [] }),
      // 세이브를 불러올 때 구단 DB(data/external/)가 바뀌었으면 맞춘다 (턴 진행 중이면 턴이 끝난 뒤)
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<GameStore>;
        let loaded = saved.game ?? null;
        // 포텐셜 도입 전 세이브: 시드로 숨은 포텐셜을 정한다
        if (loaded && loaded.player.potential === undefined) loaded = { ...loaded, player: { ...loaded.player, potential: rollPotential(loaded.seed, loaded.player.profile.role.position) } };
        if (loaded) loaded = { ...loaded, player: { ...loaded.player, potential: Math.max(80, Math.min(100, loaded.player.potential)), weakFoot: loaded.player.weakFoot ?? 40, profile: { ...loaded.player.profile, dominantFoot: loaded.player.profile.dominantFoot ?? 'RIGHT' }, ovr: calculateOVR(loaded.player.attributes, loaded.player.profile.role) } };
        const game = loaded && !saved.session && loaded.stage === 'READY' ? syncWithDatabase(loaded) : loaded;
        // 단계 정보가 없는 예전 세이브는 할 일이 남은 첫 단계부터
        const step = saved.step ?? (game ? nextStep(game, 'MATCH') : 'MATCH');
        return { ...current, ...saved, game, step };
      },
    },
  ),
);
