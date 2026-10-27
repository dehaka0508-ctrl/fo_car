'use client';

import { useState, type ReactNode } from 'react';
import { canRetire } from '@/engine/career';
import { useGameStore } from '@/store/gameStore';
import { FLOW_STEPS, type FlowStep } from '@/store/flow';
import type { GameState } from '@/types/game';
import { GameTopBar } from './GameTopBar';
import { PlayerPanel } from './PlayerPanel';
import { EventStep } from './steps/EventStep';
import { MatchStep } from './steps/MatchStep';
import { ShopStep } from './steps/ShopStep';
import { TrainingStep } from './steps/TrainingStep';
import { TransferStep } from './steps/TransferStep';
import { RecordsTab } from './tabs/RecordsTab';
import { PlayerTab } from './tabs/PlayerTab';
import { MobileDashboard } from './MobileDashboard';
import { TurnSummary } from './TurnSummary';
import { TurnResultPanel } from './TurnResultPanel';
import { Button, cx, Modal, Tag } from './ui';
import { useIsDesktop } from './useIsDesktop';

export const STEP_META: Record<FlowStep, { title: string; hint: string; skip?: string }> = {
  MATCH: { title: '경기', hint: '턴을 진행해 경기를 치릅니다' },
  EVENTS: { title: '사건 대응', hint: '모두 답해야 다음 경기를 할 수 있습니다', skip: '나중에 답하기' },
  TRAINING: { title: '훈련', hint: '턴당 1회 · 고르면 바로 다음 단계로', skip: '훈련 건너뛰기' },
  SHOP: { title: '물건 구매', hint: '턴당 1개 · 이번 턴 진열 3개', skip: '사지 않기' },
  TRANSFER: { title: '이적', hint: '제안 수락·거절 · 역제의 · 재계약', skip: '다음 경기로' },
};

const STEP_BODY: Record<FlowStep, (game: GameState) => ReactNode> = {
  MATCH: (game) => <MatchStep game={game} />,
  EVENTS: (game) => <EventStep game={game} />,
  TRAINING: (game) => <TrainingStep game={game} />,
  SHOP: (game) => <ShopStep game={game} />,
  TRANSFER: (game) => <TransferStep game={game} />,
};

export type DashboardModal = null | 'player' | 'records' | 'turn';

/** 은퇴 · 세이브 삭제 (휴대폰에서는 선수 정보 창 아래에만 있다) */
function CareerMenu({ game, onDone }: { game: GameState; onDone: () => void }) {
  const retire = useGameStore((s) => s.retire);
  const reset = useGameStore((s) => s.reset);
  return (
    <div className="mt-4 flex justify-end gap-2 border-t border-zinc-700 pt-3">
      {canRetire(game) ? (
        <Button
          variant="danger"
          onClick={() => {
            if (window.confirm('정말 은퇴할까요? 되돌릴 수 없습니다.')) {
              retire();
              onDone();
            }
          }}
        >
          은퇴하기
        </Button>
      ) : null}
      <Button
        variant="ghost"
        onClick={() => {
          if (window.confirm('세이브를 지우고 새로 시작할까요?')) {
            reset();
            onDone();
          }
        }}
      >
        세이브 삭제
      </Button>
    </div>
  );
}

/** 핵심 행동을 중앙에 두고 상세 기록은 필요할 때 펼친다. */
export function Dashboard({ game }: { game: GameState }) {
  const desktop = useIsDesktop();
  const [modal, setModal] = useState<DashboardModal>(null);
  const showTurnReport = useGameStore((s) => s.showTurnReport);
  const dismissTurnReport = useGameStore((s) => s.dismissTurnReport);
  return (
    <>
      {desktop ? <DesktopDashboard game={game} onOpen={setModal} /> : <MobileDashboard game={game} onOpen={setModal} />}
      {(showTurnReport || modal === 'turn') && game.lastTurn ? (
        <Modal title="턴 결과" onClose={() => { dismissTurnReport(); setModal(null); }}>
          <TurnSummary game={game} />
          <div className="report-confirm"><Button className="w-full py-3.5 text-sm" variant="primary" onClick={() => { dismissTurnReport(); setModal(null); }}>확인하고 계속하기 →</Button></div>
        </Modal>
      ) : null}
      {modal === 'player' ? (
        <Modal wide title="선수 정보" onClose={() => setModal(null)}>
          <PlayerTab game={game} />
          <CareerMenu game={game} onDone={() => setModal(null)} />
        </Modal>
      ) : null}
      {modal === 'records' ? (
        <Modal wide title="기록실" onClose={() => setModal(null)}>
          <RecordsTab game={game} />
        </Modal>
      ) : null}
    </>
  );
}

/**
 * PC: 선수 카드를 보조 열에 두고 현재 행동과 펼칠 수 있는 기록을 중앙에 배치한다.
 */
function DesktopDashboard({ game, onOpen }: { game: GameState; onOpen: (modal: DashboardModal) => void }) {
  const step = useGameStore((s) => s.step);
  const goStep = useGameStore((s) => s.goStep);
  return (
    <div className="game-shell">
      <GameTopBar game={game} step={step} onStep={goStep} />
      <div className="game-grid">
        <PlayerPanel game={game} onOpen={(m) => onOpen(m)} />
        <main className="flex min-w-0 flex-col gap-5">
          <StepPanel game={game} step={step} />
          <details className="career-details"><summary>지난 성적 · 턴별 기록 · 소식</summary><div className="pt-4"><TurnResultPanel game={game} /></div></details>
        </main>
      </div>
    </div>
  );
}

/** 지금 단계 패널 (PC는 제목 포함, 휴대폰은 compact: 제목은 위 단계 표시가 대신한다) */
export function StepPanel({ game, step, compact = false }: { game: GameState; step: FlowStep; compact?: boolean }) {
  const flash = useGameStore((s) => s.flash);
  const message = useGameStore((s) => s.message);
  const clearMessage = useGameStore((s) => s.clearMessage);
  const skipStep = useGameStore((s) => s.skipStep);
  const meta = STEP_META[step];

  return (
    <section className={cx('px-panel flex min-h-0 flex-col', compact && 'flex-1')}>
      <header
        className={cx(
          'flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-700',
          compact ? 'px-3 py-2' : 'px-5 py-4',
        )}
      >
        <h2 className="text-xl font-semibold text-zinc-50">
          {FLOW_STEPS.indexOf(step) + 1}. {meta.title}
        </h2>
        
      </header>

      {message ? (
        <div className="mx-3 mt-2 flex items-start justify-between gap-2 bg-sky-950/70 px-3 py-2 text-xs text-sky-200 shadow-[inset_0_0_0_1px_#0369a1]">
          <span>{message}</span>
          <button type="button" className="px-focus text-sky-300" onClick={clearMessage} aria-label="닫기">
            ✕
          </button>
        </div>
      ) : null}
      {flash ? (
        <div className="mx-3 mt-2 flex flex-wrap items-center gap-1.5 bg-emerald-950/70 px-3 py-2 text-xs shadow-[inset_0_0_0_1px_#1b7a41]">
          <span className="font-pixel text-emerald-300">✓ {flash.title}</span>
          {flash.lines.map((line, i) => (
            <Tag key={i} tone={/-|실패/.test(line) ? 'rose' : 'emerald'}>
              {line}
            </Tag>
          ))}
        </div>
      ) : null}

      <div className={cx('step-content min-h-0 flex-1', compact ? 'px-3 py-2' : 'px-5 py-4')}>{STEP_BODY[step](game)}</div>

      {meta.skip ? (
        <footer className={cx('flex justify-end border-t border-zinc-700', compact ? 'px-3 py-1.5' : 'px-4 py-2')}>
          <Button onClick={skipStep}>{meta.skip} ▶</Button>
        </footer>
      ) : null}
    </section>
  );
}
