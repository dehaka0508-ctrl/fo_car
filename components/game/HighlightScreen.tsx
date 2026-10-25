'use client';

import { useMemo, useState } from 'react';
import { PlayerToken } from '@/components/Avatar';
import { ATTRIBUTE_META } from '@/data/attributes';
import { HAIR_COLORS, SKIN_TONES } from '@/data/appearance';
import { HIGHLIGHT_KIND_LABELS } from '@/data/labels';
import { BASE_WORLD } from '@/engine/career';
import { buildHighlightScene, optionSuccessChance } from '@/engine/highlight';
import { kitColorsFor } from '@/engine/world';
import { useGameStore } from '@/store/gameStore';
import type { KitColors, MatchSituation, MatchToken, ResolvedSituation } from '@/types/game';
import { Button, Card, cx, Tag } from './ui';

const RESULT_TEXT: Record<ResolvedSituation['kind'], [string, string]> = {
  SHOT: ['골!!! 그물이 출렁인다!', '아쉽게 막혔다…'],
  SET_PIECE: ['세트피스 골!', '골문을 벗어났다…'],
  KEY_PASS: ['어시스트! 동료가 마무리했다!', '패스가 끊겼다.'],
  DRIBBLE: ['수비를 완벽하게 제쳤다!', '공을 빼앗겼다.'],
  DEFEND: ['완벽한 수비!', '뚫렸다… 실점.'],
  SAVE: ['슈퍼 세이브!', '막지 못했다… 실점.'],
};

/** 판정 후 공이 향할 곳 */
function ballTarget(situation: MatchSituation, resolved: ResolvedSituation | undefined) {
  if (!resolved) return situation.ball;
  const me = situation.tokens.find((t) => t.tag === 'PROTAGONIST')!;
  const nearestOpponent = situation.tokens
    .filter((t) => t.side !== me.side)
    .sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
  switch (resolved.kind) {
    case 'SHOT':
    case 'SET_PIECE':
    case 'KEY_PASS':
      return resolved.success ? { x: 99, y: 50 } : { x: nearestOpponent?.x ?? 95, y: nearestOpponent?.y ?? 50 };
    case 'DRIBBLE':
      return resolved.success ? { x: Math.min(95, me.x + 14), y: me.y } : { x: nearestOpponent?.x ?? me.x, y: nearestOpponent?.y ?? me.y };
    case 'DEFEND':
      return resolved.success ? { x: Math.min(60, me.x + 22), y: me.y } : { x: 1, y: 50 };
    case 'SAVE':
      return resolved.success ? { x: me.x + 1, y: me.y } : { x: 0.5, y: 50 };
  }
}

function TokenDot({ token, kit, moved }: { token: MatchToken; kit: KitColors | null; moved: { x: number; y: number } | null }) {
  const isMe = token.tag === 'PROTAGONIST';
  const fill = isMe && token.appearance ? SKIN_TONES[token.appearance.skin].color : (kit?.primary ?? '#a1a1aa');
  const ring = isMe && token.appearance ? HAIR_COLORS[token.appearance.hair].color : (kit?.secondary ?? '#18181b88');
  const position = moved ?? token;
  const badge =
    token.tag === 'RIVAL' ? 'bg-rose-600' : token.tag === 'FORMER_PARTNER' ? 'bg-violet-600' : token.tag === 'PARTNER' ? 'bg-amber-500' : 'bg-zinc-900/70';
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-all duration-700 ease-out"
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
    >
      {token.label ? (
        <span className={cx('mb-0.5 max-w-24 truncate rounded px-1 text-[10px] font-semibold text-white', isMe ? 'bg-emerald-700' : badge)}>
          {token.tag === 'RIVAL' ? '라이벌 ' : token.tag === 'FORMER_PARTNER' ? '옛 파트너 ' : ''}
          {token.label}
        </span>
      ) : null}
      <svg viewBox="0 0 20 20" className={isMe ? 'h-7 w-7 drop-shadow' : 'h-5 w-5'} aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill={fill} stroke={ring} strokeWidth={isMe ? 3.5 : 2.5} />
      </svg>
    </div>
  );
}

function Pitch({
  situation,
  resolved,
  myKit,
  theirKit,
}: {
  situation: MatchSituation;
  resolved: ResolvedSituation | undefined;
  myKit: KitColors | null;
  theirKit: KitColors | null;
}) {
  const ball = ballTarget(situation, resolved);
  const me = situation.tokens.find((t) => t.tag === 'PROTAGONIST')!;
  const myMove = resolved ? { x: (me.x * 2 + ball.x) / 3, y: (me.y * 2 + ball.y) / 3 } : null;
  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-xl bg-emerald-700 shadow-inner" aria-label="하이라이트 피치">
      {/* 피치 라인 */}
      <div className="absolute inset-2 rounded border-2 border-white/40" />
      <div className="absolute inset-y-2 left-1/2 w-0.5 -translate-x-1/2 bg-white/40" />
      <div className="absolute left-1/2 top-1/2 h-[28%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40" />
      <div className="absolute left-2 top-1/2 h-[46%] w-[14%] -translate-y-1/2 border-2 border-l-0 border-white/40" />
      <div className="absolute right-2 top-1/2 h-[46%] w-[14%] -translate-y-1/2 border-2 border-r-0 border-white/40" />
      <div className="absolute left-0 top-1/2 h-[16%] w-2 -translate-y-1/2 bg-white/70" />
      <div className="absolute right-0 top-1/2 h-[16%] w-2 -translate-y-1/2 bg-white/70" />

      {situation.tokens.map((token) => (
        <TokenDot
          key={token.id}
          token={token}
          kit={token.side === me.side ? myKit : theirKit}
          moved={token.tag === 'PROTAGONIST' ? myMove : null}
        />
      ))}
      <div
        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-2 ring-zinc-900 transition-all duration-700 ease-out"
        style={{ left: `${ball.x}%`, top: `${ball.y}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

export function HighlightScreen() {
  const session = useGameStore((s) => s.session);
  const picks = useGameStore((s) => s.highlightPicks);
  const chooseOption = useGameStore((s) => s.chooseOption);
  const finishHighlight = useGameStore((s) => s.finishHighlight);
  const autoHighlight = useGameStore((s) => s.autoHighlight);
  const scene = useMemo(() => (session ? buildHighlightScene(session) : null), [session]);
  const [viewIndex, setViewIndex] = useState(() => Math.min(picks.length, Math.max(0, (scene?.situations.length ?? 1) - 1)));

  if (!session) return null;
  if (!scene) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <Card title="경기 진행">
          <Button variant="primary" onClick={autoHighlight}>경기 결과 보기</Button>
        </Card>
      </div>
    );
  }

  const { briefing, situations } = scene;
  const situation = situations[Math.min(viewIndex, situations.length - 1)];
  const resolved = picks.find((p) => p.situationId === situation.id);
  const isLast = viewIndex >= situations.length - 1;
  const successes = picks.filter((p) => p.success).length;
  const competition =
    BASE_WORLD.competitions[briefing.fixture.competitionId]?.nameKo ?? BASE_WORLD.leagues[briefing.fixture.competitionId]?.nameKo ?? '';
  const myKit = kitColorsFor(BASE_WORLD, briefing.playerTeam.id);
  const theirKit = kitColorsFor(BASE_WORLD, briefing.opponent.id);
  const opponentsTagged = briefing.taggedPlayers.filter((t) => t.side !== briefing.playerTeamSide);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="emerald">하이라이트 · {HIGHLIGHT_KIND_LABELS[briefing.kind]}</Tag>
          <span className="text-xs text-zinc-500">
            {competition} {briefing.fixture.stage}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PlayerToken kit={myKit} size={22} />
            <span className="font-bold text-zinc-900 dark:text-zinc-50">{briefing.playerTeam.name}</span>
          </div>
          <span className="text-sm text-zinc-500">vs</span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-900 dark:text-zinc-50">{briefing.opponent.name}</span>
            <PlayerToken kit={theirKit} size={22} />
          </div>
        </div>
        {opponentsTagged.length ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            상대 팀에 {opponentsTagged.map((t) => `${t.tag === 'RIVAL' ? '숙명의 라이벌' : '옛 파트너'} ${t.name}`).join(', ')}이(가) 있다!
          </p>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-3xl">
        <Pitch situation={situation} resolved={resolved} myKit={myKit} theirKit={theirKit} />
      </div>

      <Card
        title={`상황 ${viewIndex + 1} / ${situations.length} · ${situation.minute}분`}
        actions={<span className="text-xs text-zinc-500">선택 성공 {successes} / {picks.length}</span>}
      >
        <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">{situation.description}</p>
        {resolved ? (
          <div className="flex flex-col gap-3">
            <p className={cx('text-lg font-bold', resolved.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              {RESULT_TEXT[resolved.kind][resolved.success ? 0 : 1]}
            </p>
            <p className="text-xs text-zinc-500">성공 확률 {Math.round(resolved.chance * 100)}%</p>
            {isLast ? (
              <Button variant="primary" onClick={finishHighlight}>
                경기 결과 보기
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setViewIndex((i) => i + 1)}>
                다음 상황
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {situation.options.map((option) => {
              const chance = Math.round(optionSuccessChance(session, option) * 100);
              const tone = chance >= 65 ? 'text-emerald-600 dark:text-emerald-400' : chance >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => chooseOption(situation.id, option.id)}
                  className="flex flex-col items-start gap-1 rounded-lg border border-zinc-200 p-3 text-left transition-colors hover:border-emerald-500 hover:bg-emerald-50 dark:border-zinc-700 dark:hover:bg-emerald-900/20"
                >
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{option.label}</span>
                  <span className="text-[11px] text-zinc-500">{option.keyAttributes.map((k) => ATTRIBUTE_META[k].label).join(' · ')}</span>
                  <span className={cx('text-sm font-bold tabular-nums', tone)}>성공 {chance}%</span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={autoHighlight}>
          AI에게 맡기고 결과 보기
        </Button>
      </div>
    </div>
  );
}
