'use client';

import { useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { PixelBall } from '@/components/pixel/PixelIcons';
import { PlayerStage } from '@/components/pixel/PlayerStage';
import { TURN_PHASE_LABELS } from '@/data/labels';
import { BASE_WORLD } from '@/engine/career';
import { averageRating } from '@/engine/simulator';
import { turnLabel } from '@/engine/state';
import { useGameStore } from '@/store/gameStore';
import { FLOW_LABELS, FLOW_STEPS, stepStatus } from '@/store/flow';
import type { GameState } from '@/types/game';
import { StepPanel, type DashboardModal } from './Dashboard';
import { ratingText, seasonLabel } from './format';
import { turnHeadline, TurnResultPanel } from './TurnResultPanel';
import { cx, Tag } from './ui';

/**
 * 휴대폰 세로 화면 (9:16 한 화면, 페이지 스크롤 없음)
 *  위: 선수 한 줄 · 지난 턴 성적 한 줄 · 단계 표시 / 아래: 지금 단계 (또는 성적 자세히)
 */
export function MobileDashboard({ game, onOpen }: { game: GameState; onOpen: (modal: DashboardModal) => void }) {
  const step = useGameStore((s) => s.step);
  const goStep = useGameStore((s) => s.goStep);
  const [view, setView] = useState<'step' | 'result'>('step');

  return (
    <div className="mobile-shell">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <PixelBall size={18} />
          <span className="font-pixel text-[11px] font-bold text-zinc-100">FOOTBALL CAREER</span>
        </div>
        <span className="px-inset font-pixel m-[2px] px-2 py-0.5 text-[11px] text-amber-300">{turnLabel(game.turn)}</span>
      </header>

      <PlayerStrip game={game} onOpen={onOpen} />
      <TurnStrip game={game} open={view === 'result'} onToggle={() => setView((v) => (v === 'result' ? 'step' : 'result'))} />

      <nav aria-label="턴 진행 단계">
        <ol className="step-nav grid grid-cols-5 gap-1">
          {FLOW_STEPS.map((s, i) => {
            const status = stepStatus(game, s);
            const active = s === step && view === 'step';
            return (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => {
                    goStep(s);
                    setView('step');
                  }}
                  aria-current={active ? 'step' : undefined}
                  className={cx(
                    'px-btn font-pixel m-[2px] flex w-[calc(100%-4px)] items-center justify-center gap-1 py-1.5 text-[11px] font-bold',
                    active ? 'bg-emerald-400 text-zinc-950' : status === 'done' ? 'bg-emerald-800 text-emerald-100' : status === 'empty' ? 'bg-zinc-900 text-zinc-500' : 'bg-zinc-800 text-zinc-100',
                  )}
                >
                  {status === 'done' && !active ? '✓' : i + 1}
                  <span>{FLOW_LABELS[s]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {view === 'step' ? (
        <StepPanel game={game} step={step} compact />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <TurnResultPanel game={game} />
        </div>
      )}
    </div>
  );
}

/** 선수 한 줄: 아바타 · 이름 · 소속 · 게이지 4개 */
function PlayerStrip({ game, onOpen }: { game: GameState; onOpen: (modal: DashboardModal) => void }) {
  const { player } = game;
  const contract = player.contract;
  const club = contract ? BASE_WORLD.clubs[contract.clubId] : null;
  const league = contract ? BASE_WORLD.leagues[game.clubs[contract.clubId].leagueId] : null;
  const meters: Array<[string, number]> = [
    ['체력', player.condition],
    ['멘탈', player.mental],
    ['명성', player.reputation],
    ['입지', player.squad.standing],
  ];
  return (
    <section className="px-panel flex gap-3 p-3">
      <PlayerStage className="px-1.5 pt-1.5">
        <Avatar appearance={player.profile.appearance} kit={club?.kitColors} size={86} idle />
      </PlayerStage>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <h1 className="truncate text-base font-bold text-zinc-50">{player.profile.name}</h1>
          <Tag tone="emerald">OVR {player.ovr}</Tag>
          <span className="ml-auto flex gap-1">
            <button type="button" onClick={() => onOpen('player')} className="px-btn m-[2px] bg-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-50">
              선수
            </button>
            <button type="button" onClick={() => onOpen('records')} className="px-btn m-[2px] bg-zinc-700 px-1.5 py-0.5 text-[11px] text-zinc-50">
              기록
            </button>
          </span>
        </div>
        <p className="truncate text-[11px] text-zinc-300">
          {player.age}세 · {club?.nameKo ?? 'FA'} {league ? <span className="text-zinc-500">· {league.nameKo}</span> : null}
        </p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {meters.map(([label, value]) => {
            const ratio = Math.max(0, Math.min(1, value / 100));
            return (
              <div key={label} className="flex items-center gap-1 text-[10px] text-zinc-400">
                <span className="w-6 shrink-0">{label}</span>
                <div className="px-meter mx-[2px] h-2 flex-1">
                  <span className={ratio >= 0.6 ? 'bg-emerald-400' : ratio >= 0.35 ? 'bg-amber-400' : 'bg-rose-500'} style={{ width: `${ratio * 100}%` }} />
                </div>
                <span className="font-pixel w-6 text-right text-zinc-100">{Math.round(value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** 지난 턴 성적 한 줄 (누르면 자세히 / 턴별 기록) */
function TurnStrip({ game, open, onToggle }: { game: GameState; open: boolean; onToggle: () => void }) {
  const turn = game.lastTurn;
  if (!turn) {
    return <p className="px-inset m-[2px] px-2 py-1.5 text-[11px] text-zinc-400">첫 경기를 마치면 여기에 턴 성적이 표시됩니다.</p>;
  }
  const { line, label } = turnHeadline(turn);
  const rating = averageRating(line);
  const position = turn.leagueTable.find((r) => r.clubId === turn.clubId)?.position;
  const isGK = game.player.profile.role.position === 'GK';
  const cells: Array<[string, string | number, string?]> = [
    ['경기', line.appearances],
    [isGK ? 'CS' : '골', isGK ? line.cleanSheets : line.goals, 'text-amber-300'],
    ['도움', line.assists, 'text-emerald-300'],
    ['평점', ratingText(rating), rating !== null && rating >= 7 ? 'text-amber-300' : 'text-zinc-50'],
    ['순위', position ?? '-'],
  ];
  return (
    <button type="button" onClick={onToggle} className="px-inset px-focus m-[2px] flex items-center gap-2 px-2 py-1.5 text-left">
      <div className="w-[4.5rem] shrink-0 leading-tight">
        <p className="text-[10px] text-zinc-400">{seasonLabel(turn.turn.season).slice(2)} {TURN_PHASE_LABELS[turn.turn.phase]}</p>
        <p className="text-[10px] text-zinc-500">{label}</p>
      </div>
      <div className="grid flex-1 grid-cols-5 gap-1">
        {cells.map(([name, value, tone]) => (
          <div key={name} className="flex flex-col items-center leading-tight">
            <span className={cx('font-pixel text-base', tone ?? 'text-zinc-50')}>{value}</span>
            <span className="text-[9px] text-zinc-500">{name}</span>
          </div>
        ))}
      </div>
      <span className="font-pixel text-[10px] text-emerald-300">{open ? '닫기' : '자세히'}</span>
    </button>
  );
}
