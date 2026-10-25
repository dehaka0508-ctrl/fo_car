'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { CreationScreen } from './CreationScreen';
import { HighlightScreen } from './HighlightScreen';
import { CeremonyModal, NoticePopup, pendingPopups } from './Overlays';
import { PlayerHeader } from './PlayerHeader';
import { RetiredScreen } from './RetiredScreen';
import { EventsTab } from './tabs/EventsTab';
import { OverviewTab } from './tabs/OverviewTab';
import { PlayerTab } from './tabs/PlayerTab';
import { RecordsTab } from './tabs/RecordsTab';
import { ShopTab } from './tabs/ShopTab';
import { TrainingTab } from './tabs/TrainingTab';
import { TransferTab } from './tabs/TransferTab';
import { Button, cx } from './ui';

type TabId = 'overview' | 'player' | 'training' | 'shop' | 'events' | 'transfer' | 'records';

/** LocalStorage 세이브 복원이 끝난 뒤에만 그린다 (서버 렌더와 첫 화면 불일치 방지) */
function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsubscribe = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    // 외부 저장소(LocalStorage) 복원 완료 여부와 동기화
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(useGameStore.persist.hasHydrated());
    return unsubscribe;
  }, []);
  return hydrated;
}

export function CareerGame() {
  const hydrated = useHydrated();
  const game = useGameStore((s) => s.game);
  const session = useGameStore((s) => s.session);
  const ackedPopups = useGameStore((s) => s.ackedPopups);
  const message = useGameStore((s) => s.message);
  const clearMessage = useGameStore((s) => s.clearMessage);
  const reset = useGameStore((s) => s.reset);
  const [tab, setTab] = useState<TabId>('overview');

  if (!hydrated) {
    return <p className="p-8 text-center text-sm text-zinc-500">세이브를 불러오는 중…</p>;
  }
  if (!game) return <CreationScreen />;

  const popups = pendingPopups(game, ackedPopups);
  const ceremony = game.ceremonies[0];
  const overlay = ceremony ? (
    <CeremonyModal ceremony={ceremony} />
  ) : popups.length ? (
    <NoticePopup notice={popups[0]} pending={popups} />
  ) : null;

  if (game.stage === 'RETIRED') {
    return (
      <>
        <RetiredScreen game={game} />
        {overlay}
      </>
    );
  }
  if (session) return <HighlightScreen key={session.highlight?.fixtureId} />;

  const unresolved = game.events.filter((e) => !e.resolution).length;
  const offers = game.offers.filter((o) => o.status === 'PENDING').length;
  const tabs: Array<{ id: TabId; label: string; badge?: number }> = [
    { id: 'overview', label: '개요' },
    { id: 'player', label: '선수' },
    { id: 'training', label: '훈련' },
    { id: 'shop', label: '상점' },
    { id: 'events', label: '사건', badge: unresolved },
    { id: 'transfer', label: '이적', badge: offers },
    { id: 'records', label: '기록실' },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
      <PlayerHeader game={game} />

      {message ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200">
          <span>{message}</span>
          <button type="button" className="text-xs" onClick={clearMessage}>
            닫기
          </button>
        </div>
      ) : null}

      <nav className="-mx-4 overflow-x-auto px-4" aria-label="메뉴">
        <div className="flex min-w-max gap-1 border-b border-zinc-200 dark:border-zinc-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cx(
                'relative px-3 py-2 text-sm font-medium',
                tab === t.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
              )}
            >
              {t.label}
              {t.badge ? <span className="ml-1 rounded-full bg-rose-500 px-1.5 text-[10px] text-white">{t.badge}</span> : null}
              {tab === t.id ? <span className="absolute inset-x-2 -bottom-px h-0.5 bg-emerald-600" /> : null}
            </button>
          ))}
        </div>
      </nav>

      {tab === 'overview' ? <OverviewTab game={game} onOpenTab={(id) => setTab(id as TabId)} /> : null}
      {tab === 'player' ? <PlayerTab game={game} /> : null}
      {tab === 'training' ? <TrainingTab game={game} /> : null}
      {tab === 'shop' ? <ShopTab game={game} /> : null}
      {tab === 'events' ? <EventsTab game={game} /> : null}
      {tab === 'transfer' ? <TransferTab game={game} /> : null}
      {tab === 'records' ? <RecordsTab game={game} /> : null}

      <footer className="mt-6 flex justify-end">
        <Button
          variant="ghost"
          className="text-xs"
          onClick={() => {
            if (window.confirm('세이브를 지우고 새로 시작할까요?')) reset();
          }}
        >
          세이브 삭제
        </Button>
      </footer>
      {overlay}
    </div>
  );
}
