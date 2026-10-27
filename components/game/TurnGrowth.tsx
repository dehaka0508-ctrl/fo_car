import { ATTRIBUTE_META } from '@/data/attributes';
import type { TurnDevelopmentReport } from '@/types/game';
import { Card, cx, Tag } from './ui';

export function TurnGrowth({ report, isGoalkeeper = false, compact = false }: { report?: TurnDevelopmentReport; isGoalkeeper?: boolean; compact?: boolean }) {
  if (!report) return null;
  const changes = compact ? report.changes.slice(0, 4) : report.changes;
  const points = report.changes.reduce((sum, change) => sum + change.after - change.before, 0);
  const content = <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs text-zinc-400">이번 턴 OVR</p><p className={cx('font-semibold tabular-nums text-zinc-50', compact ? 'text-xl' : 'text-3xl')}>{report.ovrBefore} <span className="text-zinc-500">→</span> <span className="text-emerald-300">{report.ovrAfter}</span><span className="ml-2 text-sm text-emerald-300">{report.ovrAfter > report.ovrBefore ? `+${report.ovrAfter - report.ovrBefore}` : ''}</span></p></div>
      {!isGoalkeeper ? <div className="text-right"><p className="text-xs text-zinc-400">18개 능력치 평균</p><p className="text-sm font-semibold tabular-nums text-zinc-100">{report.averageBefore.toFixed(2)} → <span className="text-emerald-300">{report.averageAfter.toFixed(2)}</span></p></div> : null}
    </div>
    {changes.length ? <>
      <p className="mt-3 text-xs text-zinc-300">{report.changes.length}개 능력치 성장 · 총 +{points}</p>
      <ul className={cx('mt-3 grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3')}>{changes.map((change) => <li key={change.key} className="rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-xs"><span className="font-medium text-zinc-200">{ATTRIBUTE_META[change.key].label}</span><span className="tabular-nums text-emerald-300">{change.before} → {change.after} (+{change.after - change.before})</span></div>
        {!compact ? <p className="mt-1 text-[11px] text-zinc-400">경기 경험 +{change.experience} · 자연 성장 +{change.natural}</p> : null}
      </li>)}</ul>
      {compact && report.changes.length > changes.length ? <p className="mt-2 text-[11px] text-zinc-400">외 {report.changes.length - changes.length}개 · 전체 내역은 턴 결과에서 확인</p> : null}
    </> : <p className="mt-3 text-xs leading-relaxed text-zinc-400">{report.status === 'AT_POTENTIAL' ? '현재 성장 한도에 도달했습니다.' : report.status === 'AGE_LIMIT' ? '성장기가 지나 이번 턴에는 정수 능력치 상승이 없습니다.' : '이번 턴의 작은 성장치를 누적했습니다. 다음 턴 성장에 이어집니다.'}</p>}
    {!compact ? <div className="mt-4 flex flex-wrap gap-2"><Tag>출전 {report.minutes}분</Tag><Tag>평점 {report.rating === null ? '-' : report.rating.toFixed(2)}</Tag><Tag>평균 컨디션 {report.condition}</Tag><span className="text-xs leading-6 text-zinc-400">경기 경험과 자연 성장이 턴 종료 즉시 반영됐습니다.</span></div> : null}
  </>;
  return compact ? <div className="rounded-xl border border-emerald-400/20 bg-zinc-950/50 p-3"><h3 className="mb-3 text-sm font-semibold text-zinc-100">이번 턴 성장</h3>{content}</div> : <Card title="이번 턴 성장" actions={<Tag tone="emerald">즉시 반영</Tag>}>{content}</Card>;
}
