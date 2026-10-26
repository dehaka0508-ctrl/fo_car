/**
 * 엑셀 구단 DB → data/external/club-db.json
 *
 *   npm run db:import -- <구단DB.xlsx> [--out data/external/club-db.json]
 *
 * '구단 DB' 시트(구단별 행)와 '리그 목록' 시트(리그 기준점)를 읽어,
 * 외부 DB JSON 형식(구단마다 id · name · leagueId · country · tier · hiddenStats · season2526 · kitColors · legends)으로 쓴다.
 * 원래 수치는 그대로 남기고, 게임 엔진 척도로의 환산값은 meta.scale에 적는다 (data/dbLoader.ts가 적용).
 * 이어서 npm run db:sync 를 실행하면 게임에 병합된다 (dev·build·test 때 자동 실행).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, posix, resolve } from 'node:path';
import JSZip from 'jszip';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const outIndex = args.indexOf('--out');
const output = resolve(outIndex >= 0 ? args[outIndex + 1] : 'data/external/club-db.json');
if (!input) {
  console.error('사용법: npm run db:import -- <구단DB.xlsx> [--out data/external/club-db.json]');
  process.exit(1);
}

/**
 * DB 점수(1~100) → 게임 엔진 척도.
 * DB는 실력 폭이 넓어(맨시티 94 · K리그2 평균 52) 그대로 쓰면 강팀이 경기당 4골 이상 넣는다.
 * 실력은 66을 중심으로 0.7배로 좁히고, 명성·재정은 8 낮춘다 (기존 엔진 보정과 리그 평균·최상위 값이 맞도록).
 */
const SCALE = {
  power: { pivot: 66, factor: 0.7 },
  prestige: { offset: -8 },
  finance: { offset: -8 },
};

type Cell = string | number | null;

// ----------------------------------------------------------------------------
// 최소 xlsx 리더 (공유 문자열 · 인라인 문자열 · 숫자 셀). 외부 도구로 만든 파일의 절대 경로도 처리한다.
// ----------------------------------------------------------------------------

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

const TAG = (name: string) => `(?:\\w+:)?${name}`;

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  return m ? decodeXml(m[1]) : null;
}

/** 'AB12' → 27 (0부터) */
function columnIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  return [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
}

function textOf(xml: string): string {
  // <t>…</t> 조각(서식 있는 텍스트 포함)을 이어 붙인다
  const parts = [...xml.matchAll(new RegExp(`<${TAG('t')}\\b[^>]*>([\\s\\S]*?)</${TAG('t')}>`, 'g'))].map((m) => decodeXml(m[1]));
  return parts.join('');
}

async function readWorkbook(path: string): Promise<Record<string, Cell[][]>> {
  const zip = await JSZip.loadAsync(readFileSync(path));
  const read = async (name: string) => (await zip.file(name.replace(/^\//, ''))?.async('string')) ?? '';
  const workbook = await read('xl/workbook.xml');
  const rels = await read('xl/_rels/workbook.xml.rels');
  const target = new Map<string, string>();
  for (const m of rels.matchAll(new RegExp(`<${TAG('Relationship')}\\b([^>]*)/?>`, 'g'))) {
    const id = attr(m[1], 'Id');
    const t = attr(m[1], 'Target');
    if (id && t) target.set(id, t.startsWith('/') ? t.slice(1) : posix.join('xl', t));
  }
  const shared = [...(await read('xl/sharedStrings.xml')).matchAll(new RegExp(`<${TAG('si')}\\b[^>]*>([\\s\\S]*?)</${TAG('si')}>`, 'g'))].map((m) => textOf(m[1]));

  const sheets: Record<string, Cell[][]> = {};
  for (const m of workbook.matchAll(new RegExp(`<${TAG('sheet')}\\b([^>]*)/?>`, 'g'))) {
    const name = attr(m[1], 'name');
    const rid = /\br:id="([^"]*)"/.exec(m[1])?.[1];
    const file = rid ? target.get(rid) : undefined;
    if (!name || !file) continue;
    const xml = await read(file);
    const rows: Cell[][] = [];
    for (const row of xml.matchAll(new RegExp(`<${TAG('row')}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${TAG('row')}>)`, 'g'))) {
      const rowIndex = Number(attr(row[1], 'r') ?? rows.length + 1) - 1;
      const cells: Cell[] = [];
      for (const c of (row[2] ?? '').matchAll(new RegExp(`<${TAG('c')}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${TAG('c')}>)`, 'g'))) {
        const ref = attr(c[1], 'r');
        const type = attr(c[1], 't');
        const body = c[2] ?? '';
        const raw = new RegExp(`<${TAG('v')}\\b[^>]*>([\\s\\S]*?)</${TAG('v')}>`).exec(body)?.[1];
        let value: Cell = null;
        if (type === 's' && raw !== undefined) value = shared[Number(raw)] ?? null;
        else if (type === 'inlineStr') value = textOf(body);
        else if (type === 'str' || type === 'e') value = raw !== undefined ? decodeXml(raw) : null;
        else if (type === 'b') value = raw === '1' ? 1 : 0;
        else if (raw !== undefined) value = raw.trim() === '' ? null : Number(raw);
        if (typeof value === 'string') value = value.trim() === '' ? null : value.trim();
        cells[ref ? columnIndex(ref) : cells.length] = value;
      }
      rows[rowIndex] = cells;
    }
    sheets[name] = rows;
  }
  return sheets;
}

/** 첫 열이 headerKey인 행을 머리글로 삼아, 첫 열이 비거나 stopKeys가 나올 때까지 행을 읽는다 */
function readTable(rows: Cell[][], headerKey: string, stopKeys: string[] = []): Array<Record<string, Cell>> {
  const start = rows.findIndex((r) => r?.[0] === headerKey);
  if (start < 0) return [];
  const header = rows[start].map((v) => (v === null || v === undefined ? '' : String(v).trim()));
  const out: Array<Record<string, Cell>> = [];
  for (const row of rows.slice(start + 1)) {
    const first = row?.[0];
    if (first === null || first === undefined || stopKeys.includes(String(first))) break;
    out.push(Object.fromEntries(header.map((key, i) => [key, row[i] ?? null])));
  }
  return out;
}

const num = (v: Cell) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
const str = (v: Cell) => (v === null || v === undefined ? null : String(v));

function record(name: Cell, value: Cell) {
  const n = str(name);
  return n ? { name: n, value: num(value) } : null;
}

async function main() {
  const sheets = await readWorkbook(resolve(input!));
  const names = Object.keys(sheets);
  const clubSheet = sheets['구단 DB'] ?? sheets[names[0]];
  const leagueSheet = sheets['리그 목록'] ?? [];
  const firstText = (row: Cell[] | undefined) => row?.find((v) => typeof v === 'string') ?? null;
  const titleRow = firstText(clubSheet[1]);
  const noteRow = firstText(clubSheet[2]);

  const clubRows = readTable(clubSheet, '구단명');
  const leagueRows = readTable(leagueSheet, '리그 ID', ['전체']);
  if (!clubRows.length) throw new Error("'구단명' 머리글이 있는 시트를 찾지 못했습니다.");

  const clubs = clubRows.map((r) => {
    const iconic = Object.fromEntries(
      (['FW', 'MF', 'DF', 'GK'] as const).map((pos) => [pos, str(r[`상징 ${pos}`])]).filter(([, v]) => v),
    );
    const topScorer = record(r['최다 득점자'], r['통산 득점']);
    const topAssister = record(r['최다 도움자'], r['통산 도움']);
    const mostApps = record(r['최다 출전자'], r['통산 출전']);
    const hasLegends = topScorer || topAssister || mostApps || Object.keys(iconic).length;
    return {
      id: str(r['구단 ID']),
      name: str(r['구단명']),
      nameEn: str(r['원문 구단명']),
      leagueId: str(r['리그 ID']),
      country: str(r['국가']),
      tier: num(r['부']),
      hiddenStats: { power: num(r['실력']), prestige: num(r['명성']), finance: num(r['재정']) },
      season2526: {
        leagueRank: num(r['직전 순위']),
        previousLeagueId: str(r['직전 소속 리그']),
        domesticCup: str(r['자국컵']),
        continentalCup: str(r['직전 대륙컵']),
        continentalQualified: str(r['다음 대륙컵']),
      },
      kitColors: { primary: str(r['제1색']), secondary: str(r['줄무늬 제2색']) ?? '' },
      legends: hasLegends ? { topScorer, topAssister, mostApps, iconicPlayers: iconic } : null,
    };
  });

  const leagueInfo = leagueRows.map((r) => ({
    leagueId: str(r['리그 ID']),
    name: str(r['리그명']),
    country: str(r['리그 국가']),
    tier: num(r['부']),
    clubCount: num(r['등록 구단 수']),
    season: str(r['참가 시즌']),
    baseline: { power: num(r['실력 기준점']), prestige: num(r['명성 기준점']), finance: num(r['재정 기준점']) },
  }));

  const json = {
    meta: {
      title: titleRow ?? '구단 데이터베이스',
      note: noteRow ?? null,
      source: basename(input!),
      generatedAt: new Date().toISOString().slice(0, 10),
      scale: SCALE,
    },
    leagueInfo,
    clubs,
  };
  mkdirSync(dirname(output), { recursive: true });
  // 구단은 한 줄에 하나씩 (파일 크기와 변경 내역을 읽기 쉽게)
  const text = [
    '{',
    ` "meta": ${JSON.stringify(json.meta)},`,
    ' "leagueInfo": [',
    json.leagueInfo.map((l) => `  ${JSON.stringify(l)}`).join(',\n'),
    ' ],',
    ' "clubs": [',
    json.clubs.map((c) => `  ${JSON.stringify(c)}`).join(',\n'),
    ' ]',
    '}',
  ].join('\n');
  writeFileSync(output, text + '\n');
  const missingColor = clubs.filter((c) => !c.kitColors.primary).length;
  console.log(`[db:import] ${clubs.length}개 구단 · ${leagueInfo.length}개 리그 → ${output}`);
  console.log(`  2색 줄무늬 ${clubs.filter((c) => c.kitColors.secondary).length}개 · 레전드 정보 ${clubs.filter((c) => c.legends).length}개 · 제1색 없음 ${missingColor}개`);
  console.log('  이어서 npm run db:sync 로 병합 결과를 확인하세요.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
