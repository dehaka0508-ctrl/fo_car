/**
 * 외부 구단 DB 색인 갱신: npm run db:sync
 * (npm run dev / build / test / sim* 전에 자동으로 실행된다)
 *
 * data/external/ 아래의 *.json을 찾아 data/external/index.ts를 다시 쓰고,
 * 병합 결과(활성 리그, 정규화한 항목, 경고)를 출력한다.
 * '_' 또는 '.'으로 시작하는 파일·폴더(예: _examples/)는 건너뛴다.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { buildDatabase, type ExternalDbFile } from '@/data/dbLoader';

const ROOT = join(process.cwd(), 'data', 'external');
const INDEX = join(ROOT, 'index.ts');
const quiet = process.argv.includes('--quiet');

function findJson(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...findJson(full));
    else if (name.toLowerCase().endsWith('.json')) out.push(full);
  }
  return out;
}

const paths = findJson(ROOT).map((full) => relative(ROOT, full).split('\\').join('/'));
const files: ExternalDbFile[] = [];
const broken: string[] = [];
for (const path of paths) {
  try {
    files.push({ path, data: JSON.parse(readFileSync(join(ROOT, path), 'utf8')) });
  } catch (error) {
    broken.push(`${path}: JSON을 읽지 못함 (${(error as Error).message})`);
  }
}
const valid = files.map((f) => f.path);

const lines = [
  '// 자동 생성 파일 — 직접 고치지 마세요. data/external/에 JSON을 넣고 npm run db:sync (dev·build·test 때 자동 실행)',
  "import type { ExternalDbFile } from '../dbLoader';",
  ...valid.map((path, i) => `import f${i} from './${path}';`),
  '',
  'export const EXTERNAL_DB_FILES: ExternalDbFile[] = [',
  ...valid.map((path, i) => `  { path: '${path}', data: f${i} as unknown },`),
  '];',
  '',
];
const next = lines.join('\n');
let current = '';
try {
  current = readFileSync(INDEX, 'utf8');
} catch {
  /* 처음 생성 */
}
if (current !== next) writeFileSync(INDEX, next);

const db = buildDatabase({ files });
const active = db.report.leagues.filter((l) => l.active);
console.log(
  `[db:sync] 외부 파일 ${valid.length}개 · 활성 리그 ${active.length}/${db.report.leagues.length}개 ` +
    `(외부 ${active.filter((l) => l.source === 'EXTERNAL').length} · 샘플 ${active.filter((l) => l.source === 'SAMPLE').length}) · 구단 ${Object.keys(db.clubs).length}개` +
    (current !== next ? ' · 색인 갱신' : ''),
);
if (!quiet) {
  for (const file of db.report.files) console.log(`  - ${file.path}: ${file.clubs}개 구단 → ${file.leagues.join(', ') || '(리그 없음)'}`);
  const f = db.report.fixes;
  if (valid.length) {
    console.log(
      `  정규화: 빈 secondary → null ${f.emptySecondary}건 · legends 없음/null ${f.missingLegends}건 · ` +
        `히든 수치 기본값 ${f.defaultedStats}건 · 모르는 더비 상대 제외 ${f.droppedRivals}건 · 불완전한 레전드 제외 ${f.droppedLegends}건`,
    );
    console.log(`  척도 환산 파일: ${db.report.scaledFiles.join(', ') || '없음'} · 더비 목록 연결 ${db.report.derbiesLinked}쌍`);
  }
}
for (const warning of [...broken, ...db.report.warnings]) console.log(`  ⚠ ${warning}`);
if (broken.length) process.exitCode = 1;
