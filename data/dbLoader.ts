/**
 * 구단 DB 로더 — 내장 샘플(data/clubs.ts) + 외부 JSON(data/external/)을 합쳐 게임 데이터베이스를 만든다.
 *
 * 외부 JSON을 data/external/ 에 넣고 npm run dev / build / test 를 실행하면
 * (또는 npm run db:sync) 자동으로 색인(data/external/index.ts)이 갱신되어 병합된다.
 * 게임이 실제로 쓰는 인스턴스는 data/database.ts의 DATABASE다.
 * (이 파일은 색인을 직접 불러오지 않는다 — 색인을 만드는 스크립트도 이 파일을 쓰기 때문)
 *
 * 병합 규칙
 * - 외부 DB에 구단이 들어온 리그는 그 리그의 내장 샘플 구단을 통째로 대체한다 (외부 DB가 기준).
 * - 구단이 minClubsPerLeague개 이상인 리그만 활성화된다. 나머지 슬롯(data/leagues.ts)은 대기 상태.
 * - 상·하부 리그 중 한쪽만 활성이면 그 사이 승강은 꺼진다.
 *
 * 정규화 (외부 JSON이 조금씩 달라도 받아 준다)
 * - kitColors.secondary가 ''·'none'·null·primary와 같은 색이면 null (단색 유니폼)
 * - legends가 null·누락이면 내장 레전드(같은 id)로, 그것도 없으면 빈 목록 (헌사에서 레전드 언급 생략)
 * - 필드 별칭: power|strength|rating, prestige|reputation, finance|budget, nameKo|name_ko,
 *   kitColors|colors|kit 또는 primaryColor/secondaryColor 등
 * - 리그는 id·영문명·한글명·별칭(aliases)·{country, tier}·파일 이름 중 하나로 찾는다.
 * 자세한 형식은 data/external/README.md 참고.
 */
import type {
  ClubDefinition,
  ClubLastSeason,
  ClubLegend,
  HistoricRecord,
  ID,
  KitColors,
  LeagueDefinition,
  NationDefinition,
  Position,
  RecordCategory,
} from '@/types/game';
import { CLUBS as SAMPLE_CLUBS } from './clubs';
import { DERBIES } from './derbies';
import { CLUB_LEGENDS, HISTORIC_RECORDS } from './legends';
import { LEAGUE_SLOTS } from './leagues';
import { NATIONS } from './nations';

export interface ExternalDbFile {
  /** data/external/ 기준 상대 경로 */
  path: string;
  data: unknown;
}

export const DB_CONFIG = {
  /** 이 수 이상 구단이 있어야 리그를 활성화한다 */
  minClubsPerLeague: 4,
} as const;

export type LeagueSource = 'EXTERNAL' | 'SAMPLE' | 'EMPTY';

export interface DbReport {
  files: Array<{ path: string; leagues: ID[]; clubs: number }>;
  leagues: Array<{ id: ID; nameKo: string; source: LeagueSource; clubs: number; teamCount: number | null; active: boolean }>;
  /** 정규화로 고친 항목 수 */
  fixes: { emptySecondary: number; missingLegends: number; defaultedStats: number; droppedRivals: number; droppedLegends: number };
  /** 엔진 척도로 환산한 파일 · 더비 목록에서 연결한 수 */
  scaledFiles: string[];
  derbiesLinked: number;
  warnings: string[];
}

export interface GameDatabase {
  /** 활성 리그 (구단이 있는 리그) */
  leagues: Record<ID, LeagueDefinition>;
  /** 전체 리그 슬롯 */
  slots: Record<ID, LeagueDefinition>;
  clubs: Record<ID, ClubDefinition>;
  legends: Record<ID, ClubLegend[]>;
  records: HistoricRecord[];
  /** 활성 리그·구단 구성이 바뀌면 달라지는 값 (세이브 동기화용) */
  signature: string;
  report: DbReport;
}

// ============================================================================
// 기본 유틸
// ============================================================================

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

function pick(raw: Raw, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = raw[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function text(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function numeric(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** 비교용 키: 소문자 · 악센트 제거 · 영숫자/한글만 (NFKD로 분해된 한글은 NFC로 다시 조합) */
export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[^a-z0-9가-힣]/g, '');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function fileStem(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.json$/i, '');
}

function hash(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

// ============================================================================
// 필드 정규화
// ============================================================================

const NO_COLOR = new Set(['', 'none', 'null', 'nil', '-', 'n/a', 'na', 'transparent', '없음']);

/** 색 하나: 빈 값은 null, 'fff'·'#fff' 같은 hex는 '#FFFFFF'로 */
export function normalizeColor(v: unknown): string | null {
  const raw = typeof v === 'string' ? v.trim() : '';
  if (NO_COLOR.has(raw.toLowerCase())) return null;
  const hex = raw.replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) return `#${hex.split('').map((c) => c + c).join('').toUpperCase()}`;
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex.toUpperCase()}`;
  return raw; // CSS 색 이름 등은 그대로
}

/**
 * 유니폼 색. secondary가 비었거나('') primary와 같으면 null → 단색으로 그린다.
 * { kitColors: { primary, secondary } } · { colors: [p, s] } · { primaryColor, secondaryColor } 등을 받는다.
 */
export function normalizeKitColors(raw: Raw): { kit: KitColors; emptySecondary: boolean; missingPrimary: boolean } {
  let primary: unknown;
  let secondary: unknown;
  const source = pick(raw, 'kitColors', 'kit_colors', 'kit', 'colors', 'colours');
  if (Array.isArray(source)) {
    [primary, secondary] = source;
  } else if (isObject(source)) {
    primary = pick(source, 'primary', 'main', 'home', 'color1', 'first');
    secondary = source.secondary ?? source.stripe ?? source.accent ?? source.color2 ?? source.second;
  }
  primary ??= pick(raw, 'primaryColor', 'primary_color', 'color', 'colour');
  secondary ??= raw.secondaryColor ?? raw.secondary_color;

  const p = normalizeColor(primary);
  const s = normalizeColor(secondary);
  const emptySecondary = typeof secondary === 'string' && secondary.trim() === '';
  return {
    kit: { primary: p ?? '#9CA3AF', secondary: s && p && s.toUpperCase() !== p.toUpperCase() ? s : null },
    emptySecondary,
    missingPrimary: p === null,
  };
}

const POSITION_ALIASES: Record<string, Position> = {
  gk: 'GK', goalkeeper: 'GK', keeper: 'GK', 골키퍼: 'GK',
  cb: 'CB', df: 'CB', d: 'CB', def: 'CB', defender: 'CB', centreback: 'CB', centerback: 'CB', sw: 'CB', sweeper: 'CB', 수비수: 'CB', 센터백: 'CB',
  lb: 'LB', lwb: 'LB', leftback: 'LB', 왼쪽풀백: 'LB',
  rb: 'RB', rwb: 'RB', rightback: 'RB', 오른쪽풀백: 'RB', 풀백: 'RB',
  dm: 'DM', cdm: 'DM', defensivemidfielder: 'DM', 수비형미드필더: 'DM',
  cm: 'CM', mf: 'CM', m: 'CM', mid: 'CM', midfielder: 'CM', centralmidfielder: 'CM', 미드필더: 'CM', 중앙미드필더: 'CM',
  am: 'AM', cam: 'AM', ss: 'AM', attackingmidfielder: 'AM', 공격형미드필더: 'AM',
  lw: 'LW', lm: 'LW', leftwinger: 'LW', 왼쪽윙어: 'LW',
  rw: 'RW', rm: 'RW', rightwinger: 'RW', winger: 'RW', 오른쪽윙어: 'RW', 윙어: 'RW',
  st: 'ST', cf: 'ST', fw: 'ST', f: 'ST', fwd: 'ST', forward: 'ST', striker: 'ST', 공격수: 'ST', 스트라이커: 'ST',
};

export function normalizePosition(v: unknown): Position | null {
  const raw = text(v);
  if (!raw) return null;
  return POSITION_ALIASES[normalizeKey(raw)] ?? null;
}

function nationCode(v: unknown, nations: Record<string, NationDefinition>): string | null {
  const raw = text(v);
  if (!raw) return null;
  if (nations[raw.toUpperCase()]) return raw.toUpperCase();
  const key = normalizeKey(raw);
  const found = Object.values(nations).find((n) => normalizeKey(n.name) === key || normalizeKey(n.nameKo) === key);
  return found?.code ?? null;
}

/** 레전드 목록. null·누락은 null(→ 내장 레전드 또는 생략), 이름·포지션이 없는 항목은 버린다. */
export function normalizeLegends(
  v: unknown,
  nations: Record<string, NationDefinition>,
): { legends: ClubLegend[] | null; dropped: number } {
  if (!Array.isArray(v)) return { legends: null, dropped: 0 };
  let dropped = 0;
  const legends: ClubLegend[] = [];
  for (const item of v) {
    if (!isObject(item)) {
      dropped++;
      continue;
    }
    const name = text(pick(item, 'nameKo', 'name_ko', 'koreanName', 'name'));
    const position = normalizePosition(pick(item, 'position', 'pos', 'role'));
    if (!name || !position) {
      dropped++;
      continue;
    }
    const nationality = nationCode(pick(item, 'nationality', 'nation', 'country'), nations);
    const tribute = text(pick(item, 'tribute', 'note', 'description'));
    legends.push({
      name,
      position,
      era: text(pick(item, 'era', 'years', 'period', 'seasons')) ?? '',
      ...(nationality ? { nationality } : {}),
      ...(tribute ? { tribute } : {}),
    });
  }
  return { legends, dropped };
}

const RECORD_ALIASES: Record<string, RecordCategory> = {
  goals: 'GOALS', goal: 'GOALS', 득점: 'GOALS', 최다득점: 'GOALS', 골: 'GOALS',
  assists: 'ASSISTS', assist: 'ASSISTS', 도움: 'ASSISTS', 최다도움: 'ASSISTS',
  appearances: 'APPEARANCES', apps: 'APPEARANCES', caps: 'APPEARANCES', 출전: 'APPEARANCES', 최다출전: 'APPEARANCES',
  cleansheets: 'CLEAN_SHEETS', cleansheet: 'CLEAN_SHEETS', 클린시트: 'CLEAN_SHEETS',
  trophies: 'TROPHIES', titles: 'TROPHIES', 우승: 'TROPHIES', 최다우승: 'TROPHIES',
};

function normalizeRecords(v: unknown, clubId: ID): HistoricRecord[] {
  if (!Array.isArray(v)) return [];
  const out: HistoricRecord[] = [];
  for (const item of v) {
    if (!isObject(item)) continue;
    const categoryRaw = text(pick(item, 'category', 'type', 'stat'));
    const category = categoryRaw ? (RECORD_ALIASES[normalizeKey(categoryRaw)] ?? (categoryRaw.toUpperCase() as RecordCategory)) : null;
    const holderName = text(pick(item, 'holderName', 'holder', 'name', 'player'));
    const value = numeric(pick(item, 'value', 'count', 'total'));
    if (!category || !Object.values(RECORD_ALIASES).includes(category) || !holderName || value === null) continue;
    out.push({ scope: 'CLUB', scopeId: clubId, category, holderName, value });
  }
  return out;
}

// ============================================================================
// 리그 찾기
// ============================================================================

function leagueKeys(league: LeagueDefinition): string[] {
  return [league.id, league.name, league.nameKo, ...(league.aliases ?? [])].map(normalizeKey);
}

/** id·이름·별칭·{country, tier}·파일 이름으로 리그 슬롯을 찾는다 */
export function resolveLeague(
  ref: unknown,
  stem: string,
  slots: Record<ID, LeagueDefinition>,
  nations: Record<string, NationDefinition>,
): LeagueDefinition | null {
  const byKey = (value: unknown): LeagueDefinition | null => {
    const raw = text(value);
    if (!raw) return null;
    if (slots[raw]) return slots[raw];
    // 'eng_1' · 'KOR-2' 형식: 국가 코드 + 부
    const coded = /^([a-z]{3})[_-]?(\d)$/i.exec(raw);
    if (coded) {
      const found = Object.values(slots).find((l) => l.nation === coded[1].toUpperCase() && l.tier === Number(coded[2]));
      if (found) return found;
    }
    const key = normalizeKey(raw);
    if (!key) return null;
    return Object.values(slots).find((l) => leagueKeys(l).includes(key)) ?? null;
  };
  if (isObject(ref)) {
    const direct = byKey(pick(ref, 'id', 'leagueId', 'league_id', 'code')) ?? byKey(pick(ref, 'name', 'nameKo', 'name_ko'));
    if (direct) return direct;
    const nation = nationCode(pick(ref, 'nation', 'country', 'countryCode'), nations);
    const tier = numeric(pick(ref, 'tier', 'division', 'level')) ?? 1;
    const byNation = nation ? Object.values(slots).find((l) => l.nation === nation && l.tier === tier) : undefined;
    if (byNation) return byNation;
  } else {
    const direct = byKey(ref);
    if (direct) return direct;
  }
  return byKey(stem);
}

/** 외부 파일이 리그 정의 일부를 덮어쓸 수 있는 항목 */
function leagueOverrides(ref: unknown): Partial<LeagueDefinition> {
  if (!isObject(ref)) return {};
  const out: Partial<LeagueDefinition> = {};
  const strength = numeric(ref.strength);
  const intensity = numeric(ref.intensity);
  const cycles = numeric(ref.roundRobinCycles);
  if (strength !== null && strength >= 30 && strength <= 95) out.strength = Math.round(strength);
  if (intensity !== null && intensity >= 0.6 && intensity <= 1.4) out.intensity = intensity;
  if (cycles !== null && cycles >= 1 && cycles <= 4) out.roundRobinCycles = Math.round(cycles);
  return out;
}

// ============================================================================
// 파일 해석
// ============================================================================

interface LeagueBlock {
  ref: unknown;
  clubs: Raw[];
}

/** 구단 행에 적힌 리그: leagueId에 국가·부(country, tier)가 함께 있으면 둘 다 담아 찾기 쉽게 한다 */
function clubLeagueRef(club: Raw): unknown {
  const id = pick(club, 'leagueId', 'league', 'league_id', 'competition');
  const country = pick(club, 'leagueCountry', 'country', 'nation');
  const tier = pick(club, 'tier', 'division', 'level');
  if (id === undefined && country === undefined) return null;
  if (isObject(id)) return id;
  return country !== undefined || tier !== undefined ? { id, country, tier } : id;
}

/** 파일의 meta.scale: 외부 DB 점수를 엔진 척도로 바꾸는 규칙 */
export interface DbScale {
  power?: { pivot: number; factor: number };
  prestige?: { offset?: number; factor?: number; pivot?: number };
  finance?: { offset?: number; factor?: number; pivot?: number };
}

function scaleOf(data: unknown): DbScale | null {
  if (!isObject(data) || !isObject(data.meta) || !isObject(data.meta.scale)) return null;
  return data.meta.scale as DbScale;
}

function applyScale(value: number, rule: { pivot?: number; factor?: number; offset?: number } | undefined): number {
  if (!rule) return value;
  const pivot = rule.pivot ?? 0;
  return pivot + (value - pivot) * (rule.factor ?? 1) + (rule.offset ?? 0);
}

/** 파일 하나를 '리그 블록' 목록으로 펼친다. 여러 형태를 받는다. */
function blocksOf(data: unknown): LeagueBlock[] {
  // [ {club, league?}, ... ]
  if (Array.isArray(data)) {
    const groups = new Map<string, LeagueBlock>();
    for (const club of data.filter(isObject)) {
      const ref = clubLeagueRef(club);
      const key = JSON.stringify(ref);
      if (!groups.has(key)) groups.set(key, { ref, clubs: [] });
      groups.get(key)!.clubs.push(club);
    }
    return [...groups.values()];
  }
  if (!isObject(data)) return [];
  // { leagues: [ { league..., clubs: [...] } ] }
  if (Array.isArray(data.leagues)) {
    return data.leagues.filter(isObject).flatMap((league) =>
      Array.isArray(league.clubs) ? [{ ref: pick(league, 'league', 'leagueId') ?? league, clubs: league.clubs.filter(isObject) }] : [],
    );
  }
  // { league: ..., clubs: [...] } — 구단마다 leagueId가 있으면 그것을 따른다
  if (Array.isArray(data.clubs) || Array.isArray(data.teams)) {
    const clubs = ((data.clubs ?? data.teams) as unknown[]).filter(isObject);
    const fileRef = pick(data, 'league', 'leagueId', 'league_id', 'competition') ?? (data.country || data.nation ? data : null);
    const groups = new Map<string, LeagueBlock>();
    for (const club of clubs) {
      const ref = clubLeagueRef(club) ?? fileRef;
      const key = JSON.stringify(ref);
      if (!groups.has(key)) groups.set(key, { ref, clubs: [] });
      groups.get(key)!.clubs.push(club);
    }
    return [...groups.values()];
  }
  // { ITA_SA: [...], ITA_SB: [...] }
  const entries = Object.entries(data);
  if (entries.length && entries.every(([, v]) => Array.isArray(v))) {
    return entries.map(([ref, clubs]) => ({ ref, clubs: (clubs as unknown[]).filter(isObject) }));
  }
  return [];
}

interface ParsedClub {
  club: ClubDefinition;
  rivalRefs: string[];
  records: HistoricRecord[];
}

const HANGUL = /[가-힣]/;
const ABBR_STOP = new Set(['fc', 'cf', 'afc', 'sc', 'ac', 'as', 'ss', 'ssc', 'us', 'cd', 'ud', 'rcd', 'sd', 'club', 'de', 'del', 'la', 'le', 'the', 'sv', 'fk', 'sk', 'nk', 'if', 'bk', 'ik', 'cp', 'sa', 'ca']);

/** 영문명으로 3글자 약칭: 'Manchester City' → MCI, 'Paris Saint-Germain' → PSG, 'Arsenal' → ARS */
export function abbreviate(name: string): string {
  const words = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const core = words.filter((w) => !ABBR_STOP.has(w.toLowerCase()) && !/^\d+$/.test(w));
  const use = core.length ? core : words;
  if (!use.length) return '';
  if (use.length >= 3) return use.slice(0, 3).map((w) => w[0]).join('').toUpperCase();
  if (use.length === 2) return (use[0][0] + use[1].slice(0, 2)).toUpperCase();
  return use[0].slice(0, 3).toUpperCase();
}

/** 외부 DB 레전드 객체({ iconicPlayers, topScorer, ... })의 포지션 표기 */
const ICONIC_POSITION: Record<string, Position> = { FW: 'ST', MF: 'CM', DF: 'CB', GK: 'GK' };

/** 다음 시즌 대륙 대회 표기 → 대회 id (게임에 없는 2부 대회는 null) */
const CONTINENTAL_CODE: Record<string, ID | null> = {
  UCL: 'UEFA_CL', UEL: 'UEFA_EL', UECL: 'UEFA_ECL', ACL: 'AFC_CL', ACLE: 'AFC_CL', LIB: 'CONMEBOL_LIB',
  CCC: 'CONCACAF_CC', CAFCL: 'CAF_CL', ACL2: null, SUD: null, CAFCC: null, NONE: null,
};

function parseContinental(v: unknown): ID | null | undefined {
  const raw = text(v);
  if (raw === null) return undefined;
  const key = raw.toUpperCase().replace(/[^A-Z0-9_]/g, '');
  if (key in CONTINENTAL_CODE) return CONTINENTAL_CODE[key];
  if (['UEFA_CL', 'UEFA_EL', 'UEFA_ECL', 'AFC_CL', 'CONMEBOL_LIB', 'CONCACAF_CC', 'CAF_CL'].includes(key)) return key;
  return undefined;
}

function parseLastSeason(
  raw: Raw,
  league: LeagueDefinition,
  slots: Record<ID, LeagueDefinition>,
  nations: Record<string, NationDefinition>,
): ClubLastSeason | undefined {
  const source = isObject(raw.season2526) ? raw.season2526 : isObject(raw.lastSeason) ? raw.lastSeason : null;
  if (!source) return undefined;
  const leagueRank = numeric(pick(source, 'leagueRank', 'rank', 'position'));
  const previous = text(pick(source, 'previousLeagueId', 'previousLeague', 'fromLeague'));
  let movement: ClubLastSeason['movement'] = null;
  if (previous) {
    const prev = resolveLeague(previous, '', slots, nations);
    if (prev && prev.id !== league.id) movement = prev.tier < league.tier ? 'DOWN' : prev.tier > league.tier ? 'UP' : null;
    // 데이터에 없는 리그(하부 리그 등)에서 왔으면 승격으로 본다
    if (!prev) movement = 'UP';
  }
  const continental = parseContinental(pick(source, 'continentalQualified', 'continental', 'nextContinental'));
  return { leagueRank: leagueRank !== null ? Math.round(leagueRank) : null, movement, ...(continental !== undefined ? { continental } : {}) };
}

function parseClub(
  raw: Raw,
  league: LeagueDefinition,
  index: number,
  nations: Record<string, NationDefinition>,
  report: DbReport,
  where: string,
  scale: DbScale | null,
  slots: Record<ID, LeagueDefinition>,
): ParsedClub | null {
  const nameRaw = text(pick(raw, 'name', 'fullName', 'clubName'));
  const nameEnRaw = text(pick(raw, 'nameEn', 'name_en', 'englishName', 'originalName'));
  const nameKoRaw = text(pick(raw, 'nameKo', 'name_ko', 'koreanName', 'nameKR', 'name_kr', 'korName'));
  // name이 한글이면 한글명으로, 영문명은 nameEn에서
  const nameKo = nameKoRaw ?? (nameRaw && HANGUL.test(nameRaw) ? nameRaw : null);
  const english = nameEnRaw ?? (nameRaw && !HANGUL.test(nameRaw) ? nameRaw : null);
  if (!nameKo && !english) {
    report.warnings.push(`${where}: ${index + 1}번째 구단에 이름이 없어 건너뜀`);
    return null;
  }
  const displayName = english ?? nameKo!;
  const id = text(pick(raw, 'id', 'clubId', 'club_id', 'slug', 'key')) ?? (slugify(displayName) || `${league.id.toLowerCase()}-${index + 1}`);
  const shortName = (text(pick(raw, 'shortName', 'short_name', 'short', 'abbr', 'abbreviation', 'code', 'tla')) ?? (abbreviate(displayName) || id.slice(0, 3))).toUpperCase().slice(0, 4);

  // 리그 국가에 독립 대표팀·리그가 없는 구단(모나코·안도라·웨일스 등)은 리그 국가로 본다
  const nationRaw = pick(raw, 'nation', 'nationCode', 'nationality', 'country');
  const nation = nationCode(nationRaw, nations) ?? league.nation;

  const hidden = isObject(raw.hiddenStats) ? raw.hiddenStats : isObject(raw.hidden) ? raw.hidden : isObject(raw.stats) ? raw.stats : raw;
  const stat = (keys: string[], fallback: number, rule?: { pivot?: number; factor?: number; offset?: number }) => {
    const value = numeric(pick(hidden, ...keys));
    if (value === null) {
      report.fixes.defaultedStats++;
      return fallback;
    }
    return Math.round(Math.min(99, Math.max(1, applyScale(value, rule))));
  };
  const power = stat(['power', 'strength', 'rating', 'overall', 'teamPower', 'skill', '실력'], league.strength, scale?.power);
  const prestige = stat(['prestige', 'reputation', 'fame', 'popularity', '명성'], Math.max(10, league.strength - 12), scale?.prestige);
  const finance = stat(['finance', 'budget', 'wealth', 'money', 'finances', '재정'], Math.max(10, league.strength - 12), scale?.finance);

  const kit = normalizeKitColors(raw);
  if (kit.emptySecondary) report.fixes.emptySecondary++;
  if (kit.missingPrimary) report.warnings.push(`${where}: ${displayName}의 유니폼 색이 없어 회색으로 처리`);

  const legendsRaw = pick(raw, 'legends', 'clubLegends', 'club_legends');
  let legends: ClubLegend[] | null;
  const legendRecords: HistoricRecord[] = [];
  if (isObject(legendsRaw)) {
    // { topScorer, topAssister, mostApps, iconicPlayers: { FW, MF, DF, GK } }
    const iconic = isObject(legendsRaw.iconicPlayers) ? legendsRaw.iconicPlayers : {};
    legends = Object.entries(iconic)
      .map(([pos, name]) => ({ pos: normalizePosition(pos) ?? ICONIC_POSITION[pos.toUpperCase()], name: text(name) }))
      .filter((l): l is { pos: Position; name: string } => Boolean(l.pos && l.name))
      .map((l) => ({ name: l.name, position: l.pos, era: '' }));
    const records: Array<[string, RecordCategory]> = [['topScorer', 'GOALS'], ['topAssister', 'ASSISTS'], ['mostApps', 'APPEARANCES'], ['mostCleanSheets', 'CLEAN_SHEETS']];
    for (const [key, category] of records) {
      const entry = legendsRaw[key];
      const holderName = isObject(entry) ? text(entry.name) : null;
      const value = isObject(entry) ? numeric(entry.value) : null;
      if (holderName && value !== null) legendRecords.push({ scope: 'CLUB', scopeId: id, category, holderName, value });
    }
    if (!legends.length) legends = null;
  } else {
    const normalized = normalizeLegends(legendsRaw, nations);
    legends = normalized.legends;
    report.fixes.droppedLegends += normalized.dropped;
  }
  if (legends === null) report.fixes.missingLegends++;

  const rivalsRaw = pick(raw, 'rivals', 'rivalIds', 'derbies', 'rival');
  const rivalRefs = (Array.isArray(rivalsRaw) ? rivalsRaw : rivalsRaw !== undefined ? [rivalsRaw] : []).map(text).filter((r): r is string => Boolean(r));

  const reserve = raw.promotionEligible === false || raw.isReserveTeam === true || raw.bTeam === true || raw.reserve === true;
  const club: ClubDefinition = {
    id,
    name: displayName,
    nameKo: nameKo ?? displayName,
    shortName,
    nation,
    leagueId: league.id,
    power,
    prestige,
    finance,
    kitColors: kit.kit,
    rivals: [],
    ...(reserve ? { promotionEligible: false } : {}),
    ...(legends && legends.length ? { legends } : {}),
  };
  const lastSeason = parseLastSeason(raw, league, slots, nations);
  if (lastSeason) club.lastSeason = lastSeason;
  return { club, rivalRefs, records: [...normalizeRecords(pick(raw, 'records', 'clubRecords'), id), ...legendRecords] };
}

// ============================================================================
// 데이터베이스 구성
// ============================================================================

export interface BuildDatabaseInput {
  files: readonly ExternalDbFile[];
  sampleClubs?: Record<ID, ClubDefinition>;
  slots?: Record<ID, LeagueDefinition>;
  legends?: Record<ID, ClubLegend[]>;
  records?: HistoricRecord[];
  nations?: Record<string, NationDefinition>;
  minClubsPerLeague?: number;
  derbies?: ReadonlyArray<readonly [string, string, string]>;
}

export function buildDatabase(input: BuildDatabaseInput): GameDatabase {
  const slots = input.slots ?? LEAGUE_SLOTS;
  const nations = input.nations ?? NATIONS;
  const sampleClubs = input.sampleClubs ?? SAMPLE_CLUBS;
  const minClubs = input.minClubsPerLeague ?? DB_CONFIG.minClubsPerLeague;
  const report: DbReport = {
    files: [],
    leagues: [],
    fixes: { emptySecondary: 0, missingLegends: 0, defaultedStats: 0, droppedRivals: 0, droppedLegends: 0 },
    scaledFiles: [],
    derbiesLinked: 0,
    warnings: [],
  };

  // 1) 외부 파일 해석 → 리그별 구단
  const external = new Map<ID, Map<ID, ParsedClub>>();
  const overrides: Record<ID, Partial<LeagueDefinition>> = {};
  for (const file of input.files) {
    const stem = fileStem(file.path);
    const blocks = blocksOf(file.data);
    const scale = scaleOf(file.data);
    if (scale) report.scaledFiles.push(file.path);
    const fileLeagues: ID[] = [];
    let fileClubs = 0;
    if (!blocks.length) report.warnings.push(`${file.path}: 구단 목록을 찾지 못함 (형식은 data/external/README.md 참고)`);
    for (const block of blocks) {
      const league = resolveLeague(block.ref, stem, slots, nations);
      if (!league) {
        report.warnings.push(`${file.path}: 리그 '${typeof block.ref === 'string' ? block.ref : JSON.stringify(block.ref) ?? stem}'를 찾지 못해 ${block.clubs.length}개 구단을 건너뜀`);
        continue;
      }
      Object.assign((overrides[league.id] ??= {}), leagueOverrides(block.ref));
      const bucket = external.get(league.id) ?? new Map<ID, ParsedClub>();
      block.clubs.forEach((raw, i) => {
        const parsed = parseClub(raw, league, i, nations, report, `${file.path} · ${league.nameKo}`, scale, slots);
        if (!parsed) return;
        if (bucket.has(parsed.club.id)) report.warnings.push(`${file.path}: 구단 id '${parsed.club.id}'가 중복되어 뒤의 것을 씀`);
        bucket.set(parsed.club.id, parsed);
        fileClubs++;
      });
      external.set(league.id, bucket);
      if (!fileLeagues.includes(league.id)) fileLeagues.push(league.id);
    }
    report.files.push({ path: file.path, leagues: fileLeagues, clubs: fileClubs });
  }

  // 2) 리그별 구단 구성: 외부 DB가 있으면 대체, 없으면 내장 샘플
  const parsedById = new Map<ID, ParsedClub>();
  const byLeague = new Map<ID, ClubDefinition[]>();
  const externalIds = new Set<ID>();
  for (const [leagueId, bucket] of external) {
    for (const parsed of bucket.values()) {
      if (externalIds.has(parsed.club.id)) {
        report.warnings.push(`구단 id '${parsed.club.id}'가 여러 리그에 있어 ${leagueId}의 것을 건너뜀`);
        continue;
      }
      externalIds.add(parsed.club.id);
      parsedById.set(parsed.club.id, parsed);
      byLeague.set(leagueId, [...(byLeague.get(leagueId) ?? []), parsed.club]);
    }
  }
  for (const club of Object.values(sampleClubs)) {
    if (external.has(club.leagueId) || externalIds.has(club.id) || !slots[club.leagueId]) continue;
    byLeague.set(club.leagueId, [...(byLeague.get(club.leagueId) ?? []), club]);
  }

  // 3) 활성 리그
  const active = new Set<ID>();
  for (const slot of Object.values(slots)) {
    const members = byLeague.get(slot.id) ?? [];
    const source: LeagueSource = external.has(slot.id) ? 'EXTERNAL' : members.length ? 'SAMPLE' : 'EMPTY';
    const isActive = members.length >= minClubs;
    if (isActive) active.add(slot.id);
    else if (members.length) report.warnings.push(`${slot.nameKo}: 구단이 ${members.length}개뿐이라 비활성 (최소 ${minClubs}개)`);
    if (isActive && source === 'EXTERNAL' && slot.teamCount && members.length !== slot.teamCount) {
      report.warnings.push(`${slot.nameKo}: 구단 ${members.length}개 (기본 슬롯 ${slot.teamCount}개와 다름, 그대로 사용)`);
    }
    report.leagues.push({ id: slot.id, nameKo: slot.nameKo, source, clubs: members.length, teamCount: slot.teamCount ?? null, active: isActive });
  }

  const clubs: Record<ID, ClubDefinition> = {};
  for (const leagueId of active) for (const club of byLeague.get(leagueId) ?? []) clubs[club.id] = club;

  // 4) 더비 상대: id 또는 이름으로 찾고, 없는 구단은 버린다
  const lookup = new Map<string, ID>();
  for (const club of Object.values(clubs)) {
    for (const key of [club.id, club.name, club.nameKo, club.shortName]) {
      const normalized = normalizeKey(key);
      if (normalized && !lookup.has(normalized)) lookup.set(normalized, club.id);
    }
  }
  for (const club of Object.values(clubs)) {
    const parsed = parsedById.get(club.id);
    const refs = parsed ? parsed.rivalRefs : club.rivals;
    const rivals: ID[] = [];
    for (const ref of refs) {
      const id = clubs[ref] ? ref : lookup.get(normalizeKey(ref) || '\u0000');
      if (id && id !== club.id && !rivals.includes(id)) rivals.push(id);
      else if (!id) report.fixes.droppedRivals++;
    }
    clubs[club.id] = { ...club, rivals };
  }

  // 4-2) 더비 목록(data/derbies.ts): 외부 DB에 더비 정보가 없어도 유명 더비를 잇는다
  const byName = new Map<string, ClubDefinition[]>();
  for (const club of Object.values(clubs)) {
    for (const key of new Set([normalizeKey(club.name), normalizeKey(club.nameKo)])) {
      if (key) byName.set(key, [...(byName.get(key) ?? []), club]);
    }
  }
  const findIn = (nation: string, name: string) =>
    (byName.get(normalizeKey(name)) ?? []).find((c) => c.nation === nation || slots[c.leagueId]?.nation === nation);
  for (const [nation, a, b] of input.derbies ?? DERBIES) {
    const ca = findIn(nation, a);
    const cb = findIn(nation, b);
    if (!ca || !cb || ca.id === cb.id) continue;
    if (!clubs[ca.id].rivals.includes(cb.id)) clubs[ca.id] = { ...clubs[ca.id], rivals: [...clubs[ca.id].rivals, cb.id] };
    if (!clubs[cb.id].rivals.includes(ca.id)) clubs[cb.id] = { ...clubs[cb.id], rivals: [...clubs[cb.id].rivals, ca.id] };
    report.derbiesLinked++;
  }

  // 5) 레전드 · 기록: 외부 구단의 것이 내장 데이터보다 우선
  const legends: Record<ID, ClubLegend[]> = { ...(input.legends ?? CLUB_LEGENDS) };
  for (const club of Object.values(clubs)) if (club.legends?.length) legends[club.id] = club.legends;
  const externalRecords = [...parsedById.values()].filter((p) => clubs[p.club.id]).flatMap((p) => p.records);
  const recordKey = (r: HistoricRecord) => `${r.scope}:${r.scopeId}:${r.category}`;
  const overridden = new Set(externalRecords.map(recordKey));
  const records = [...(input.records ?? HISTORIC_RECORDS).filter((r) => !overridden.has(recordKey(r))), ...externalRecords];

  // 6) 활성 리그 정의: 덮어쓰기 적용 + 승강 연결 정리
  const leagues: Record<ID, LeagueDefinition> = {};
  for (const id of active) {
    // 외부 DB 리그의 수준 = 소속 구단 실력 평균 (명시적으로 덮어쓰지 않았다면)
    const members = Object.values(clubs).filter((c) => c.leagueId === id);
    const strength = external.has(id) && members.length ? Math.round(members.reduce((sum, c) => sum + c.power, 0) / members.length) : slots[id].strength;
    leagues[id] = { ...slots[id], strength, ...overrides[id] };
  }
  for (const league of Object.values(leagues)) {
    if (league.lowerLeagueId && !leagues[league.lowerLeagueId]) {
      leagues[league.id] = { ...leagues[league.id], lowerLeagueId: undefined, relegationSlots: 0 };
    }
    if (league.upperLeagueId && !leagues[league.upperLeagueId]) {
      leagues[league.id] = { ...leagues[league.id], upperLeagueId: undefined, promotionSlots: 0 };
    }
  }

  const signature = hash(
    Object.keys(leagues).sort().join(',') + '|' + Object.values(clubs).map((c) => `${c.id}@${c.leagueId}`).sort().join(','),
  );
  return { leagues, slots, clubs, legends, records, signature, report };
}

