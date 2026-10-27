'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Avatar, PlayerToken } from '@/components/Avatar';
import { PlayerStage } from '@/components/pixel/PlayerStage';
import { ATTRIBUTE_META } from '@/data/attributes';
import { HAIR_COLORS, SKIN_TONES } from '@/data/appearance';
import { HIGHLIGHT_KIND_LABELS } from '@/data/labels';
import { BASE_WORLD } from '@/engine/career';
import { buildHighlightScene, optionSuccessChance } from '@/engine/highlight';
import { kitColorsFor } from '@/engine/world';
import { useGameStore } from '@/store/gameStore';
import type { KitColors, MatchSituation, MatchToken, ResolvedSituation } from '@/types/game';
import { BALL, buildChoreography, positionAt, trailPoints, type Choreography, type Effect, type Point } from './highlight/choreography';
import { Button, Card, cx, Tag } from './ui';

const RESULT_TEXT: Record<ResolvedSituation['kind'], [string, string]> = {
  SHOT: ['골!!! 그물이 출렁인다!', '아쉽게 막혔다…'],
  SET_PIECE: ['세트피스 골!', '골문을 벗어났다…'],
  KEY_PASS: ['어시스트! 동료가 마무리했다!', '패스가 끊겼다.'],
  DRIBBLE: ['수비를 완벽하게 제쳤다!', '공을 빼앗겼다.'],
  DEFEND: ['완벽한 수비!', '뚫렸다… 실점.'],
  SAVE: ['슈퍼 세이브!', '막지 못했다… 실점.'],
};

/** 피치 SVG 좌표: 가로 150 × 세로 100 (바둑돌 좌표 0~100을 가로로 1.5배) */
const X = (x: number) => x * 1.5;
/** 골라인: 양 끝 여백(0~4, 146~150)에 골망을 그린다 */
const GOAL_LINE_OURS = 4;
const GOAL_LINE_THEIRS = 146;

// ----------------------------------------------------------------------------
// 재생
// ----------------------------------------------------------------------------

function subscribeReducedMotion(callback: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

/** 운영체제의 '동작 줄이기' 설정 */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
}

/** 각본을 0ms부터 끝까지 재생한다. 끝나면 onDone. */
function usePlayback(choreo: Choreography | null, skip: boolean, onDone: () => void): number {
  const reduced = useReducedMotion();
  const [t, setT] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  const instant = reduced || skip;

  useEffect(() => {
    if (!choreo) return;
    if (instant) {
      const id = requestAnimationFrame(() => done.current());
      return () => cancelAnimationFrame(id);
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      setT(Math.min(elapsed, choreo.duration));
      if (elapsed < choreo.duration) frame = requestAnimationFrame(tick);
      else done.current();
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [choreo, instant]);

  if (!choreo) return 0;
  return instant ? choreo.duration : t;
}

/** 효과의 진행도 0~1 (아직이면 null) */
function progress(effect: Effect, t: number): number | null {
  if (t < effect.at || t > effect.at + effect.duration) return null;
  return (t - effect.at) / effect.duration;
}

// ----------------------------------------------------------------------------
// 피치
// ----------------------------------------------------------------------------

function TokenDot({ token, kit, at }: { token: MatchToken; kit: KitColors | null; at: Point }) {
  const isMe = token.tag === 'PROTAGONIST';
  const fill = isMe && token.appearance ? SKIN_TONES[token.appearance.skin].color : (kit?.primary ?? '#a1a1aa');
  const ring = isMe && token.appearance ? HAIR_COLORS[token.appearance.hair].color : (kit?.secondary ?? '#18181b88');
  const badge =
    token.tag === 'RIVAL' ? 'bg-rose-600' : token.tag === 'FORMER_PARTNER' ? 'bg-violet-600' : token.tag === 'PARTNER' ? 'bg-amber-500' : 'bg-zinc-900/70';
  return (
    <div
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${at.x}%`, top: `${at.y}%`, zIndex: isMe ? 3 : 2 }}
    >
      {token.label ? (
        <span className={cx('font-pixel mb-0.5 max-w-24 truncate px-1 text-[11px] leading-4 text-white shadow-[1px_1px_0_0_#05080f]', isMe ? 'bg-emerald-600' : badge)}>
          {token.tag === 'RIVAL' ? '라이벌 ' : token.tag === 'FORMER_PARTNER' ? '옛 파트너 ' : ''}
          {token.label}
        </span>
      ) : null}
      <svg viewBox="0 0 22 22" className={isMe ? 'h-8 w-8 drop-shadow' : 'h-6 w-6'} aria-hidden="true">
        {/* 잔디와 비슷한 색 유니폼도 보이도록 흰 테두리 */}
        <circle cx="11" cy="11" r="9.6" fill="none" stroke="#ffffff" strokeOpacity={0.9} strokeWidth={1.2} />
        <circle cx="11" cy="11" r="7.6" fill={fill} stroke={ring} strokeWidth={isMe ? 3.2 : 2.2} />
      </svg>
    </div>
  );
}

/** 골라인(x=4 / 146) 바깥 여백에 그리는 골망. 공이 들어가면 바깥으로 부풀었다 돌아온다. */
function Net({ side, bulge }: { side: 'THEIRS' | 'OURS'; bulge: number }) {
  const line = side === 'THEIRS' ? GOAL_LINE_THEIRS : GOAL_LINE_OURS;
  const dir = side === 'THEIRS' ? 1 : -1;
  const depth = 2.6 + bulge * 1.3;
  const back = line + dir * depth;
  const rows = [43, 45.8, 48.6, 51.4, 54.2, 57];
  const cols = [0.33, 0.66];
  return (
    <g fill="none">
      <rect x={Math.min(line, back)} y={43} width={depth} height={14} fill="#ffffff" fillOpacity={0.12 + bulge * 0.2} />
      <g stroke="#ffffff" strokeOpacity={0.7} strokeWidth={0.22}>
        {rows.map((y) => {
          const wobble = bulge * Math.sin(((y - 43) / 14) * Math.PI) * 1.1;
          return <line key={y} x1={line} y1={y} x2={back + dir * wobble} y2={y} />;
        })}
        {cols.map((c) => {
          const x = line + dir * depth * c;
          return <line key={c} x1={x} y1={43} x2={x + dir * bulge * c} y2={57} />;
        })}
      </g>
      <path d={`M${line} 43 L${back} 43 L${back} 57 L${line} 57`} stroke="#ffffff" strokeWidth={0.7} />
    </g>
  );
}

function Pitch({
  situation,
  choreo,
  t,
  myKit,
  theirKit,
}: {
  situation: MatchSituation;
  choreo: Choreography | null;
  t: number;
  myKit: KitColors | null;
  theirKit: KitColors | null;
}) {
  const me = situation.tokens.find((tok) => tok.tag === 'PROTAGONIST')!;
  const effects = choreo?.effects ?? [];
  const active = effects.map((effect) => ({ effect, p: progress(effect, t) })).filter((e) => e.p !== null) as Array<{ effect: Effect; p: number }>;
  const ball = (choreo && positionAt(choreo, BALL, t)) ?? situation.ball;
  const netBulge = (goal: 'THEIRS' | 'OURS') => {
    const net = active.find((a) => a.effect.kind === 'NET' && a.effect.goal === goal);
    return net ? Math.sin(Math.min(1, net.p * 2.2) * Math.PI) * (1 - net.p * 0.5) : 0;
  };
  const shake = active.find((a) => a.effect.kind === 'NET');
  const shakeX = shake ? Math.sin(t / 22) * 4 * Math.max(0, 1 - shake.p * 2.5) : 0;

  return (
    <div
      className="px-inset relative m-[2px] aspect-[3/2] overflow-hidden bg-[#1b6c35]"
      style={{ transform: shakeX ? `translateX(${shakeX}px)` : undefined }}
      aria-label="하이라이트 피치"
    >
      <svg viewBox="0 0 150 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {/* 잔디 무늬 */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <rect key={i} x={i * 15} y={0} width={15} height={100} fill={i % 2 ? '#1b6c35' : '#1f7a3c'} />
        ))}
        {/* 라인 */}
        <g stroke="#e8f2e4" strokeOpacity={0.7} strokeWidth={0.6} fill="none">
          <rect x={GOAL_LINE_OURS} y={2} width={GOAL_LINE_THEIRS - GOAL_LINE_OURS} height={96} />
          <line x1={75} y1={2} x2={75} y2={98} />
          <ellipse cx={75} cy={50} rx={11} ry={14} />
          <circle cx={75} cy={50} r={0.6} fill="#ffffff" />
          <rect x={GOAL_LINE_OURS} y={27} width={20} height={46} />
          <rect x={GOAL_LINE_THEIRS - 20} y={27} width={20} height={46} />
          <rect x={GOAL_LINE_OURS} y={40} width={7} height={20} />
          <rect x={GOAL_LINE_THEIRS - 7} y={40} width={7} height={20} />
        </g>
        <Net side="THEIRS" bulge={netBulge('THEIRS')} />
        <Net side="OURS" bulge={netBulge('OURS')} />

        {/* 궤적 */}
        {active
          .filter((a) => a.effect.kind === 'TRAIL' && a.effect.segment)
          .map((a, i) => {
            const points = trailPoints(a.effect.segment!, t);
            const fade = a.p > 0.7 ? (1 - a.p) / 0.3 : 1;
            return (
              <polyline
                key={`trail-${i}`}
                points={points.map((p) => `${X(p.x)},${p.y}`).join(' ')}
                fill="none"
                stroke="#fef9c3"
                strokeOpacity={0.85 * fade}
                strokeWidth={0.7}
                strokeDasharray="2 1.4"
                strokeLinecap="round"
              />
            );
          })}

        {/* 태클 · 다이빙 · 골망 충격 */}
        {active.map(({ effect, p }, i) => {
          if (!effect.point) return null;
          const cx = X(effect.point.x);
          const cy = effect.point.y;
          const color = effect.tone === 'bad' ? '#fb7185' : '#fde047';
          if (effect.kind === 'TACKLE') {
            const r = 2 + p * 5;
            return (
              <g key={`fx-${i}`} opacity={1 - p} stroke={color} strokeWidth={0.8} strokeLinecap="round">
                {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                  const a = (deg * Math.PI) / 180;
                  return <line key={deg} x1={cx + Math.cos(a) * r * 0.45} y1={cy + Math.sin(a) * r * 0.45} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} />;
                })}
              </g>
            );
          }
          if (effect.kind === 'DIVE') {
            return (
              <g key={`fx-${i}`} opacity={1 - p} stroke="#ffffff" strokeWidth={0.6} fill="none" strokeLinecap="round">
                {[0, 1, 2].map((k) => (
                  <path key={k} d={`M${cx - 4 - k * 2} ${cy - 3 + k * 3} q -3 1.5 -5 0`} />
                ))}
              </g>
            );
          }
          if (effect.kind === 'NET') {
            return <circle key={`fx-${i}`} cx={cx} cy={cy} r={1 + p * 9} fill="none" stroke="#ffffff" strokeOpacity={1 - p} strokeWidth={0.8} />;
          }
          return null;
        })}
      </svg>

      {situation.tokens.map((token) => {
        const at = (choreo && positionAt(choreo, token.id, t)) ?? token;
        return (
          <TokenDot key={token.id} token={token} kit={token.side === me.side ? myKit : theirKit} at={at} />
        );
      })}
      <div
        className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow ring-2 ring-zinc-900"
        style={{ left: `${ball.x}%`, top: `${ball.y}%`, zIndex: 4 }}
        aria-hidden="true"
      />

      {/* 짧은 판정 글씨 · 큰 플래시 */}
      {active
        .filter((a) => a.effect.kind === 'BLOCK' && a.effect.text && a.effect.point)
        .map(({ effect, p }, i) => (
          <span
            key={`label-${i}`}
            className={cx(
              'font-pixel pointer-events-none absolute -translate-x-1/2 px-1 text-[11px] font-bold text-white shadow-[2px_2px_0_0_#05080f]',
              effect.tone === 'bad' ? 'bg-rose-600' : 'bg-zinc-900',
            )}
            style={{ left: `${effect.point!.x}%`, top: `${effect.point!.y - 9 - p * 4}%`, opacity: 1 - p * p, zIndex: 5 }}
          >
            {effect.text}
          </span>
        ))}
      {active
        .filter((a) => a.effect.kind === 'FLASH')
        .map(({ effect, p }, i) => {
          const scale = 0.6 + 0.6 * Math.min(1, p / 0.15) - 0.15 * Math.min(1, Math.max(0, (p - 0.15) / 0.35));
          const opacity = p < 0.08 ? p / 0.08 : p > 0.75 ? (1 - p) / 0.25 : 1;
          return (
            <div key={`flash-${i}`} className="pointer-events-none absolute inset-0 flex items-center justify-center" style={{ zIndex: 6 }}>
              <span
                className={cx(
                  'font-pixel text-5xl font-bold sm:text-7xl',
                  effect.tone === 'bad' ? 'text-rose-300' : 'text-amber-300',
                )}
                style={{ transform: `scale(${scale})`, opacity }}
              >
                {effect.text}
              </span>
            </div>
          );
        })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// 화면
// ----------------------------------------------------------------------------

/** 한 상황: 선택 → 연출 재생 → 결과 */
function SituationView({
  situation,
  resolved,
  myKit,
  theirKit,
  children,
}: {
  situation: MatchSituation;
  resolved: ResolvedSituation | undefined;
  myKit: KitColors | null;
  theirKit: KitColors | null;
  children: (state: { done: boolean; skip: () => void }) => ReactNode;
}) {
  const choreo = useMemo(() => (resolved ? buildChoreography(situation, resolved) : null), [situation, resolved]);
  const [done, setDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const t = usePlayback(choreo, skipped, () => setDone(true));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-3">
      {/* PC 16:9: 피치는 남은 높이에 맞춰 3:2로 / 휴대폰 세로: 피치 위, 선택지 아래 */}
      <div className="flex shrink-0 items-center justify-center lg:min-h-0 lg:shrink">
        <div className="w-full lg:max-w-[calc((100dvh-150px)*1.5)]">
          <Pitch situation={situation} choreo={choreo} t={t} myKit={myKit} theirKit={theirKit} />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto lg:gap-3">{children({ done: !resolved || done, skip: () => setSkipped(true) })}</div>
    </div>
  );
}

export function HighlightScreen() {
  const session = useGameStore((s) => s.session);
  const picks = useGameStore((s) => s.highlightPicks);
  const appearance = useGameStore((s) => s.game?.player.profile.appearance);
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
  // 국가대표 경기면 국가대표 유니폼, 아니면 소속팀 유니폼
  const myKit = kitColorsFor(BASE_WORLD, briefing.playerTeam.id);
  const theirKit = kitColorsFor(BASE_WORLD, briefing.opponent.id);
  const isNational = briefing.playerTeam.id.startsWith('nation:');
  const opponentsTagged = briefing.taggedPlayers.filter((t) => t.side !== briefing.playerTeamSide);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[1680px] flex-col gap-2 px-2 py-2 lg:gap-3 lg:px-3 lg:py-3">
      <header className="px-panel m-[3px] flex flex-col gap-1.5 px-3 py-2 lg:gap-2 lg:px-4 lg:py-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Tag tone="emerald">하이라이트 · {HIGHLIGHT_KIND_LABELS[briefing.kind]}</Tag>
          {isNational ? <Tag tone="sky">국가대표</Tag> : null}
          <span className="text-xs text-zinc-400">
            {competition} {briefing.fixture.stage}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <PlayerToken kit={myKit} size={22} />
            <span className="truncate text-sm font-bold text-zinc-50">{briefing.playerTeam.name}</span>
          </div>
          <span className="px-inset font-pixel m-[2px] px-3 py-1.5 text-xs text-amber-300">VS</span>
          <div className="flex min-w-0 items-center justify-end gap-3">
            <span className="truncate text-right text-sm font-bold text-zinc-50">{briefing.opponent.name}</span>
            <PlayerToken kit={theirKit} size={22} />
          </div>
        </div>
        {opponentsTagged.length ? (
          <p className="text-center text-xs text-rose-300">
            상대 팀에 {opponentsTagged.map((t) => `${t.tag === 'RIVAL' ? '숙명의 라이벌' : '옛 파트너'} ${t.name}`).join(', ')}이(가) 있다!
          </p>
        ) : null}
      </header>

      <SituationView key={situation.id} situation={situation} resolved={resolved} myKit={myKit} theirKit={theirKit}>
        {({ done, skip }) => (
          <>
            {appearance ? (
              <PlayerStage className="hidden lg:flex">
                <Avatar appearance={appearance} kit={myKit} size={86} idle label={`${briefing.protagonist.name} (경기 유니폼)`} />
              </PlayerStage>
            ) : null}
            <Card
            title={`상황 ${viewIndex + 1} / ${situations.length} · ${situation.minute}분`}
            actions={<span className="text-xs text-zinc-500">선택 성공 {successes} / {picks.length}</span>}
          >
            <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">{situation.description}</p>
            {resolved && !done ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-zinc-500">플레이가 이어지는 중…</p>
                <Button variant="ghost" className="text-xs" onClick={skip}>
                  연출 건너뛰기
                </Button>
              </div>
            ) : resolved ? (
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
              <div className="grid gap-2">
                {situation.options.map((option) => {
                  const chance = Math.round(optionSuccessChance(session, option) * 100);
                  const tone = chance >= 65 ? 'text-emerald-600 dark:text-emerald-400' : chance >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => chooseOption(situation.id, option.id)}
                      className="px-btn m-[2px] flex flex-col items-start gap-1.5 bg-zinc-800 p-3 text-left hover:bg-zinc-700"
                    >
                      <span className="text-xs font-bold text-zinc-50">{option.label}</span>
                      <span className="font-sans text-[11px] text-zinc-400">{option.keyAttributes.map((k) => ATTRIBUTE_META[k].label).join(' · ')}</span>
                      <span className={cx('text-xs font-bold tabular-nums', tone)}>성공 {chance}%</span>
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
          </>
        )}
      </SituationView>
    </div>
  );
}
