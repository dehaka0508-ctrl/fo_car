'use client';

import { useMemo, useState } from 'react';
import { BASE_WORLD } from '@/engine/career';
import { buildCareerSummary, formatCareerText } from '@/engine/careerSummary';
import type { GameState } from '@/types/game';
import { Button, Card, cx, Tag } from './ui';

/** 클립보드 복사 (권한이 없거나 http면 textarea 방식으로 대신한다) */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 방식으로 재시도 */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** 커뮤니티 공유용 커리어 요약: 시즌별 기록 + 텍스트 복사 */
export function CareerShareCard({ game, defaultOpen = false }: { game: GameState; defaultOpen?: boolean }) {
  const summary = useMemo(() => buildCareerSummary(game, BASE_WORLD), [game]);
  const text = useMemo(() => formatCareerText(summary), [summary]);
  const [open, setOpen] = useState(defaultOpen);
  const [showText, setShowText] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);

  const copy = async () => {
    const ok = await copyText(text);
    setCopied(ok ? 'ok' : 'fail');
    if (!ok) setShowText(true);
    window.setTimeout(() => setCopied(null), 2500);
  };

  return (
    <Card
      title="커리어 요약 · 공유"
      actions={
        <div className="flex items-center gap-2">
          {copied === 'ok' ? <span className="text-xs text-emerald-600 dark:text-emerald-400">복사됨 ✓</span> : null}
          {copied === 'fail' ? <span className="text-xs text-rose-600 dark:text-rose-400">복사 실패 — 아래 텍스트를 직접 선택하세요</span> : null}
          <Button variant="primary" className="text-xs" onClick={copy}>
            클립보드에 텍스트 복사
          </Button>
        </div>
      }
    >
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        <span className="font-semibold">{summary.name}</span> · {summary.nationality} · {summary.role} · {summary.span} · {summary.status}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        <Tag tone="emerald">
          {summary.isGoalkeeper ? `${summary.totals.apps}경기 CS ${summary.totals.cleanSheets}` : `${summary.totals.apps}경기 ${summary.totals.goals}골 ${summary.totals.assists}도움`}
        </Tag>
        <Tag>우승 {summary.trophyCount}회</Tag>
        {summary.ballonWins ? <Tag tone="amber">발롱도르 {summary.ballonWins}회</Tag> : summary.bestBallon ? <Tag>발롱도르 최고 {summary.bestBallon}위</Tag> : null}
        {summary.legends.map((club) => (
          <Tag key={club} tone="violet">
            👑 {club}
          </Tag>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="text-xs" onClick={() => setOpen((v) => !v)}>
          {open ? '시즌별 요약 접기' : '커리어 요약 보기'}
        </Button>
        <Button variant="ghost" className="text-xs" onClick={() => setShowText((v) => !v)}>
          {showText ? '텍스트 숨기기' : '복사될 텍스트 미리보기'}
        </Button>
      </div>

      {open ? (
        <ol className="mt-3 flex flex-col divide-y divide-zinc-100 text-xs dark:divide-zinc-800">
          {summary.seasons.map((row) => (
            <li key={`${row.season}-${row.inProgress}`} className="grid grid-cols-1 gap-1 py-1.5 sm:grid-cols-[7.5rem_minmax(0,11rem)_minmax(0,1fr)]">
              <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                {row.label} · {row.age}세{row.inProgress ? ' ⏳' : ''}
              </span>
              <span className="truncate text-zinc-700 dark:text-zinc-300">
                {row.club}
                {row.note ? <span className="text-zinc-400"> ({row.note})</span> : null}
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-zinc-600 dark:text-zinc-400">
                <span className="tabular-nums">
                  {row.apps > 0
                    ? summary.isGoalkeeper
                      ? `${row.apps}경기 CS ${row.cleanSheets}`
                      : `${row.apps}경기 ${row.goals}골 ${row.assists}도움`
                    : row.reserveApps > 0
                      ? `B팀 ${row.reserveApps}경기`
                      : '출전 없음'}
                  {row.rating !== null ? ` · ${row.rating.toFixed(2)}` : ''}
                </span>
                {row.trophies.map((t, i) => (
                  <span key={`t${i}`} className="text-amber-700 dark:text-amber-400">
                    🏆{t}
                  </span>
                ))}
                {row.awards.map((a) => (
                  <span key={a} className={cx(a.endsWith('위') ? 'text-zinc-500' : 'text-emerald-700 dark:text-emerald-400')}>
                    🏅{a}
                  </span>
                ))}
              </span>
            </li>
          ))}
          {!summary.seasons.length ? <li className="py-2 text-zinc-500">첫 시즌이 끝나면 요약이 쌓입니다.</li> : null}
        </ol>
      ) : null}

      {showText ? (
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          {text}
        </pre>
      ) : null}
    </Card>
  );
}
