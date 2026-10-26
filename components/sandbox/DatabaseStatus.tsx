import { DATABASE } from '@/data/database';
import { NATIONS } from '@/data/nations';
import type { Confederation } from '@/types/game';
import { Card, Tag } from '@/components/game/ui';

const CONFEDERATION_LABEL: Record<Confederation, string> = {
  UEFA: '유럽',
  AFC: '아시아 · 오세아니아',
  CONMEBOL: '남미',
  CONCACAF: '북중미',
  CAF: '아프리카',
  OFC: '오세아니아',
};

/** 리그 슬롯 47개의 구단 데이터 현황 (내장 샘플 / 외부 DB / 대기) */
export function DatabaseStatus() {
  const { report, slots } = DATABASE;
  const active = report.leagues.filter((l) => l.active);
  const groups = new Map<Confederation, typeof report.leagues>();
  for (const row of report.leagues) {
    const conf = slots[row.id].confederation;
    groups.set(conf, [...(groups.get(conf) ?? []), row]);
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-10">
      <Card
        title="구단 DB 현황"
        actions={
          <span className="text-xs text-zinc-500">
            활성 리그 {active.length}/{report.leagues.length} · 구단 {Object.keys(DATABASE.clubs).length}개 · 외부 파일 {report.files.length}개
          </span>
        }
      >
        <p className="mb-3 text-xs text-zinc-500">
          data/external/에 리그별 구단 JSON을 넣고 npm run dev(또는 npm run db:sync)를 실행하면 해당 리그가 활성화됩니다. 형식은
          data/external/README.md 참고.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...groups.entries()].map(([conf, rows]) => (
            <div key={conf} className="min-w-0">
              <h3 className="mb-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300">{CONFEDERATION_LABEL[conf]}</h3>
              <ul className="flex flex-col gap-0.5 text-xs">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2">
                    <span className="truncate text-zinc-800 dark:text-zinc-200">
                      {row.nameKo} <span className="text-zinc-400">{NATIONS[slots[row.id].nation]?.nameKo} {slots[row.id].tier}부</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="tabular-nums text-zinc-500">
                        {row.clubs}/{row.teamCount ?? '-'}
                      </span>
                      {row.active ? (
                        <Tag tone={row.source === 'EXTERNAL' ? 'emerald' : 'sky'}>{row.source === 'EXTERNAL' ? '외부 DB' : '샘플'}</Tag>
                      ) : (
                        <Tag>대기</Tag>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {report.warnings.length ? (
          <ul className="mt-3 flex flex-col gap-0.5 text-xs text-amber-700 dark:text-amber-400">
            {report.warnings.map((w) => (
              <li key={w}>⚠ {w}</li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}
