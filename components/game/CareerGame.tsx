'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { CreationScreen } from './CreationScreen';
import { Dashboard } from './Dashboard';
import { HighlightScreen } from './HighlightScreen';
import { CeremonyModal, NoticePopup, pendingPopups } from './Overlays';
import { RetiredScreen } from './RetiredScreen';

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

  if (!hydrated) {
    return <p className="font-pixel p-8 text-center text-xs text-zinc-300">LOADING…</p>;
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

  return (
    <>
      <Dashboard game={game} />
      {overlay}
    </>
  );
}
