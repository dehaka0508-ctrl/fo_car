import { ATTRIBUTE_META } from '@/data/attributes';
import type { TurnDevelopmentReport } from '@/types/game';
import { Card, cx } from './ui';

export function TurnGrowth({ report, compact = false }: { report?: TurnDevelopmentReport; compact?: boolean }) {
  if (!report) return null;
  const changes = compact ? report.changes.slice(0, 4) : report.changes;
  const points = report.changes.reduce((sum, change) => sum + change.after - change.before, 0);
  const seasonalChanges = compact ? report.seasonalChanges?.slice(0, 4) : report.seasonalChanges;
  const content = <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs text-zinc-400">OVR</p><p className={cx('font-semibold tabular-nums text-zinc-50', compact ? 'text-xl' : 'text-3xl')}>{report.ovrBefore} <span className="text-zinc-500">→</span> <span className={report.ovrAfter < report.ovrBefore ? 'text-rose-300' : 'text-emerald-300'}>{report.ovrAfter}</span><span className="ml-2 text-sm text-emerald-300">{report.ovrAfter > report.ovrBefore ? `+${report.ovrAfter - report.ovrBefore}` : ''}</span></p></div>
    </div>
    {changes.length ? <>
      <p className="mt-3 text-xs text-zinc-300">{report.changes.length}개 능력치 성장 · 총 +{points}</p>
      <ul className={cx('mt-3 grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3')}>{changes.map((change) => <li key={change.key} className="rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-xs"><span className="font-medium text-zinc-200">{ATTRIBUTE_META[change.key].label}</span><span className="tabular-nums text-emerald-300">{change.before} → {change.after} (+{change.after - change.before})</span></div>
      </li>)}</ul>
      {compact && report.changes.length > changes.length ? <p className="mt-2 text-[11px] text-zinc-400">외 {report.changes.length - changes.length}개</p> : null}
    </> : <p className="mt-3 text-xs leading-relaxed text-zinc-400">{report.status === 'AT_POTENTIAL' ? '성장 한도 도달' : report.status === 'AGE_LIMIT' ? '능력치 변화 없음' : '성장치 누적 중'}</p>}
    {seasonalChanges?.length ? <div className="mt-4 border-t border-zinc-800 pt-4"><h4 className="text-sm font-semibold text-zinc-200">시즌 변화</h4><ul className="mt-2 grid gap-2 sm:grid-cols-2">{seasonalChanges.map((change) => <li key={change.key} className="flex justify-between gap-2 text-xs"><span className="text-zinc-300">{ATTRIBUTE_META[change.key].label}</span><span className={cx('tabular-nums', change.after > change.before ? 'text-emerald-300' : 'text-rose-300')}>{change.before} → {change.after}</span></li>)}</ul></div> : null}
  </>;
  return compact ? <div className="rounded-xl border border-emerald-400/20 bg-zinc-950/50 p-3"><h3 className="mb-3 text-sm font-semibold text-zinc-100">성장</h3>{content}</div> : <Card title="성장">{content}</Card>;
}
