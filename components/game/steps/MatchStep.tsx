'use client';

import { TURN_PHASE_LABELS } from '@/data/labels';
import { BASE_WORLD, canStartTurn } from '@/engine/career';
import { useGameStore } from '@/store/gameStore';
import { pendingOffers, stepStatus, unresolvedEvents } from '@/store/flow';
import type { GameState } from '@/types/game';
import { clubLabel, competitionName, seasonLabel } from '../format';
import { Button, cx, Tag } from '../ui';

const PHASE_TEXT = {
  FIRST_HALF: '개막 ~ 겨울 이적시장 · 리그 전반기와 컵 대회 초반',
  SECOND_HALF: '후반기 · 우승 경쟁과 컵 결승',
  PRESEASON: '여름 휴식기 · 친선경기와 국제대회',
} as const;

/** 1단계: 경기 (턴 수행) */
export function MatchStep({ game }: { game: GameState }) {
  const playTurn = useGameStore((s) => s.playTurn);
  const autoPlay = useGameStore((s) => s.autoPlay);
  const goStep = useGameStore((s) => s.goStep);
  const check = canStartTurn(game);
  const unresolved = unresolvedEvents(game);
  const offers = pendingOffers(game);
  const shopStatus = stepStatus(game, 'SHOP');
  const clubId = game.player.contract?.clubId;
  const table = game.leagueTable;
  const myIndex = table.findIndex((r) => r.clubId === clubId);
  const shown = table.filter((_, i) => i < 3 || Math.abs(i - myIndex) <= 1);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-pixel text-2xl text-zinc-50 drop-shadow-[2px_2px_0_#05080f]">
          {seasonLabel(game.turn.season)} {TURN_PHASE_LABELS[game.turn.phase]}
        </p>
        <p className="text-xs text-zinc-400">{PHASE_TEXT[game.turn.phase]}</p>
      </div>

      <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Check done={Boolean(game.interTurn.training)} label="훈련" doneText="완료" todoText="안 함" onClick={() => goStep('TRAINING')} />
        <Check
          done={shopStatus !== 'todo'}
          label="구매"
          doneText={shopStatus === 'done' ? '완료' : '살 것 없음'}
          todoText="안 함"
          onClick={() => goStep('SHOP')}
        />
        <Check
          done={unresolved.length === 0}
          label="사건"
          doneText={game.events.length ? '모두 답함' : '없음'}
          todoText={`${unresolved.length}개 남음`}
          warn
          onClick={() => goStep('EVENTS')}
        />
        <Check done={offers.length === 0} label="오퍼" doneText="없음" todoText={`${offers.length}개 대기`} onClick={() => goStep('TRANSFER')} />
      </ul>

      {game.player.condition < 55 ? (
        <p className="text-xs text-amber-300">체력이 {Math.round(game.player.condition)}입니다. 55 아래면 감독이 로테이션을 돌려 출전이 줄어듭니다.</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {shown.length ? (
          <div className="px-inset m-[2px] p-2">
            <p className="mb-1 text-[11px] font-bold text-emerald-300">{BASE_WORLD.leagues[game.clubs[clubId ?? '']?.leagueId ?? '']?.nameKo ?? '리그'} 순위</p>
            <table className="w-full text-[11px] tabular-nums">
              <tbody>
                {shown.map((row) => (
                  <tr key={row.clubId} className={row.clubId === clubId ? 'text-amber-300' : 'text-zinc-300'}>
                    <td className="w-6 py-0.5">{row.position}</td>
                    <td className="truncate">{clubLabel(row.clubId)}</td>
                    <td className="text-right">{row.played}경기</td>
                    <td className="w-10 text-right font-bold">{row.points}점</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {game.progress.length ? (
          <div className="px-inset m-[2px] p-2">
            <p className="mb-1 text-[11px] font-bold text-emerald-300">진행 중인 대회</p>
            <ul className="flex flex-col gap-0.5 text-[11px] text-zinc-300">
              {game.progress.map((p) => (
                <li key={p.competitionId} className="flex justify-between gap-2">
                  <span className="truncate">{competitionName(p.competitionId)}</span>
                  <span className={p.status === 'CHAMPION' ? 'text-amber-300' : p.status === 'ELIMINATED' ? 'text-zinc-500' : ''}>
                    {p.stageReached} {p.status === 'CHAMPION' ? '🏆' : p.status === 'ELIMINATED' ? '탈락' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" className="px-6 py-3 text-sm" disabled={!check.ok} onClick={playTurn}>
          ▶ 턴 진행
        </Button>
        <Button onClick={() => autoPlay(1)} title="AI가 사건·훈련·구매·이적과 경기를 대신 진행합니다">
          자동 1턴
        </Button>
        <Button onClick={() => autoPlay(3)}>자동 1시즌</Button>
        {!check.ok ? <Tag tone="rose">{check.reasons.join(', ')}</Tag> : null}
      </div>
      <p className="text-[11px] text-zinc-500">턴마다 하이라이트 경기 한 번은 직접 선택을 내립니다. 경기가 끝나면 사건 → 훈련 → 상점 → 이적 순서로 넘어갑니다.</p>
    </div>
  );
}

function Check({
  done,
  label,
  doneText,
  todoText,
  warn,
  onClick,
}: {
  done: boolean;
  label: string;
  doneText: string;
  todoText: string;
  warn?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button type="button" onClick={onClick} className="px-inset px-focus m-[2px] flex w-full flex-col items-start px-2 py-1.5 text-left hover:bg-zinc-900">
        <span className="text-[11px] text-zinc-400">{label}</span>
        <span className={cx('font-pixel text-xs', done ? 'text-emerald-300' : warn ? 'text-rose-300' : 'text-zinc-200')}>
          {done ? `✓ ${doneText}` : todoText}
        </span>
      </button>
    </li>
  );
}
