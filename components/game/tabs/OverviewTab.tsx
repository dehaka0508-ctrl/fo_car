'use client';

import { BASE_WORLD, canRetire, canStartTurn } from '@/engine/career';
import { bondLabel } from '@/engine/narrative';
import { npcAge } from '@/engine/npc';
import { turnLabel } from '@/engine/state';
import { useGameStore } from '@/store/gameStore';
import type { GameState, NoticeKind } from '@/types/game';
import { clubLabel, competitionName } from '../format';
import { TurnReport } from '../TurnReport';
import { Button, Card, Tag } from '../ui';

const NOTICE_TONE: Partial<Record<NoticeKind, 'emerald' | 'amber' | 'sky' | 'rose' | 'violet'>> = {
  RECORD: 'amber',
  LEGEND: 'amber',
  AWARD: 'amber',
  TRANSFER: 'sky',
  CONTRACT: 'sky',
  PROMOTION: 'emerald',
  PARTNER: 'violet',
  RIVAL: 'rose',
  NATIONAL: 'sky',
};

export function OverviewTab({ game, onOpenTab }: { game: GameState; onOpenTab: (tab: string) => void }) {
  const playTurn = useGameStore((s) => s.playTurn);
  const autoPlay = useGameStore((s) => s.autoPlay);
  const retire = useGameStore((s) => s.retire);
  const check = canStartTurn(game);
  const pendingOffers = game.offers.filter((o) => o.status === 'PENDING').length;
  const partnerNpc = game.partner ? game.npcs[game.partner.npcId] : null;
  const rivalNpc = game.rival ? game.npcs[game.rival.npcId] : null;
  const nextPhaseText =
    game.turn.phase === 'FIRST_HALF' ? '개막 ~ 겨울 이적시장' : game.turn.phase === 'SECOND_HALF' ? '후반기 · 컵 결승' : '여름 휴식기 · 국제대회';

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Card title={`다음 턴: ${turnLabel(game.turn)}`} actions={<span className="text-xs text-zinc-500">{nextPhaseText}</span>}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {game.interTurn.training ? <Tag tone="emerald">훈련 완료</Tag> : <Tag>훈련 가능</Tag>}
              {game.interTurn.purchasedItemId ? <Tag tone="emerald">구매 완료</Tag> : <Tag>구매 가능</Tag>}
              {game.events.some((e) => !e.resolution) ? <Tag tone="rose">답할 사건 {game.events.filter((e) => !e.resolution).length}개</Tag> : null}
              {pendingOffers ? <Tag tone="sky">오퍼 {pendingOffers}개 (다음 턴 시작 시 만료)</Tag> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={!check.ok} onClick={playTurn}>
                턴 진행
              </Button>
              {!check.ok ? (
                <Button variant="secondary" onClick={() => onOpenTab('events')}>
                  사건에 답하기
                </Button>
              ) : null}
              <Button variant="secondary" onClick={() => autoPlay(1)} title="AI가 턴 사이 결정과 경기를 대신 진행합니다">
                자동 1턴
              </Button>
              <Button variant="secondary" onClick={() => autoPlay(3)}>
                자동 1시즌
              </Button>
              {canRetire(game) ? (
                <Button
                  variant="danger"
                  className="ml-auto"
                  onClick={() => {
                    if (window.confirm('정말 은퇴할까요? 되돌릴 수 없습니다.')) retire();
                  }}
                >
                  은퇴
                </Button>
              ) : null}
            </div>
            {!check.ok ? <p className="text-xs text-rose-600 dark:text-rose-400">{check.reasons.join(', ')}</p> : null}
          </div>
        </Card>

        {game.lastTurn ? (
          <TurnReport turn={game.lastTurn} game={game} />
        ) : (
          <Card title="커리어를 시작합니다">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              첫 턴 전에 훈련과 쇼핑을 할 수 있습니다. 준비가 되면 &lsquo;턴 진행&rsquo;을 눌러 시즌 전반기를 시작하세요. 턴마다 한 번씩 하이라이트
              경기에서 직접 선택을 내리게 됩니다.
            </p>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Card title="영혼의 파트너">
          {game.partner && partnerNpc ? (
            <div className="text-sm">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {partnerNpc.name} <span className="text-xs font-normal text-zinc-500">({partnerNpc.position}, {npcAge(partnerNpc, game.turn.season)}세, OVR {partnerNpc.ovr})</span>
              </p>
              <p className="text-xs text-zinc-500">{bondLabel(game.partner.bondType)} · {clubLabel(game.partner.formedClubId)}</p>
              <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">
                통산 동반 {game.partner.totals.appearancesTogether}경기 · 합작 골 {game.partner.totals.jointGoals} · 승률{' '}
                {game.partner.totals.appearancesTogether
                  ? Math.round((game.partner.totals.wins / game.partner.totals.appearancesTogether) * 100)
                  : 0}
                % · 클린시트 {game.partner.totals.cleanSheetsTogether}
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">한 팀에서 오래 주전으로 뛰면 호흡이 맞는 단짝이 생길 수 있습니다.</p>
          )}
          {game.formerPartners.length ? (
            <p className="mt-2 text-xs text-zinc-500">
              옛 파트너: {game.formerPartners.map((p) => `${game.npcs[p.npcId]?.name ?? '?'}(${clubLabel(game.npcs[p.npcId]?.clubId)})`).join(', ')}
            </p>
          ) : null}
        </Card>

        <Card title="숙명의 라이벌">
          {game.rival && rivalNpc ? (
            <div className="text-sm">
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                {rivalNpc.name} <span className="text-xs font-normal text-zinc-500">({rivalNpc.position}, OVR {rivalNpc.ovr})</span>
              </p>
              <p className="text-xs text-zinc-500">{clubLabel(rivalNpc.clubId)}</p>
              <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">
                맞대결 {game.rival.headToHead.meetings}회 · {game.rival.headToHead.wins}승 {game.rival.headToHead.draws}무 {game.rival.headToHead.losses}패
              </p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">주전으로 자리 잡으면 더비 상대나 순위 경쟁 팀에서 라이벌이 나타납니다.</p>
          )}
        </Card>

        <Card title="소식">
          <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
            {game.notices.slice(0, 30).map((notice) => (
              <li key={notice.id} className="border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800">
                <div className="flex items-center gap-1.5">
                  <Tag tone={NOTICE_TONE[notice.kind] ?? 'zinc'}>{notice.title}</Tag>
                  <span className="text-[10px] text-zinc-400">{turnLabel(notice.turn)}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{notice.body}</p>
              </li>
            ))}
          </ul>
        </Card>

        {game.progress.length ? (
          <Card title="진행 중인 대회">
            <ul className="flex flex-col gap-1 text-xs text-zinc-700 dark:text-zinc-300">
              {game.progress.map((p) => (
                <li key={p.competitionId}>
                  {competitionName(p.competitionId)} — {p.stageReached} {p.status === 'ACTIVE' ? '(진행 중)' : p.status === 'CHAMPION' ? '🏆' : '(탈락)'}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <p className="text-[10px] text-zinc-400">데이터: {Object.keys(BASE_WORLD.leagues).length}개 리그 · {Object.keys(BASE_WORLD.clubs).length}개 구단</p>
      </div>
    </div>
  );
}
