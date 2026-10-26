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

/** 파일 하나를 '리그 블록' 목록으로 펼친다. 여러 형태를 받는다. */
function blocksOf(data: unknown): LeagueBlock[] {
  // [ {club, league?}, ... ]
  if (Array.isArray(data)) {
    const groups = new Map<string, LeagueBlock>();
    for (const club of data.filter(isObject)) {
      const ref = pick(club, 'leagueId', 'league', 'league_id', 'competition') ?? null;
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
  // { league: ..., clubs: [...] }
  if (Array.isArray(data.clubs) || Array.isArray(data.teams)) {
    const clubs = ((data.clubs ?? data.teams) as unknown[]).filter(isObject);
    const ref = pick(data, 'league', 'leagueId', 'league_id', 'competition') ?? (data.country || data.nation ? data : null);
    return [{ ref, clubs }];
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

function parseClub(
  raw: Raw,
  league: LeagueDefinition,
  index: number,
  nations: Record<string, NationDefinition>,
  report: DbReport,
  where: string,
): ParsedClub | null {
  const name = text(pick(raw, 'name', 'nameEn', 'name_en', 'englishName', 'fullName'));
  const nameKo = text(pick(raw, 'nameKo', 'name_ko', 'koreanName', 'nameKR', 'name_kr', 'korName'));
  if (!name && !nameKo) {
    report.warnings.push(`${where}: ${index + 1}번째 구단에 이름이 없어 건너뜀`);
    return null;
  }
  const displayName = name ?? nameKo!;
  const id = text(pick(raw, 'id', 'clubId', 'club_id', 'slug', 'key')) ?? (slugify(displayName) || `${league.id.toLowerCase()}-${index + 1}`);
  const ascii = displayName.normalize('NFKD').replace(/[^A-Za-z]/g, '');
  const shortName = (text(pick(raw, 'shortName', 'short_name', 'short', 'abbr', 'abbreviation', 'code', 'tla')) ?? (ascii.slice(0, 3) || id.slice(0, 3))).toUpperCase().slice(0, 4);

  const nationRaw = pick(raw, 'nation', 'country', 'nationCode', 'nationality');
  const nation = nationCode(nationRaw, nations) ?? league.nation;
  if (nationRaw !== undefined && !nationCode(nationRaw, nations)) report.warnings.push(`${where}: ${displayName}의 국가 '${String(nationRaw)}'를 몰라 ${league.nation}로 처리`);

  const hidden = isObject(raw.hidden) ? raw.hidden : isObject(raw.stats) ? raw.stats : raw;
  const stat = (keys: string[], fallback: number) => {
    const value = numeric(pick(hidden, ...keys));
    if (value === null) {
      report.fixes.defaultedStats++;
      return fallback;
    }
    return Math.round(Math.min(99, Math.max(1, value)));
  };
  const power = stat(['power', 'strength', 'rating', 'overall', 'teamPower', 'skill', '실력'], league.strength);
  const prestige = stat(['prestige', 'reputation', 'fame', 'popularity', '명성'], Math.max(10, league.strength - 12));
  const finance = stat(['finance', 'budget', 'wealth', 'money', 'finances', '재정'], Math.max(10, league.strength - 12));

  const kit = normalizeKitColors(raw);
  if (kit.emptySecondary) report.fixes.emptySecondary++;
  if (kit.missingPrimary) report.warnings.push(`${where}: ${displayName}의 유니폼 색이 없어 회색으로 처리`);

  const legendsRaw = pick(raw, 'legends', 'clubLegends', 'club_legends');
  const { legends, dropped } = normalizeLegends(legendsRaw, nations);
  if (legends === null) report.fixes.missingLegends++;
  report.fixes.droppedLegends += dropped;

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
  return { club, rivalRefs, records: normalizeRecords(pick(raw, 'records', 'clubRecords'), id) };
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
    warnings: [],
  };

  // 1) 외부 파일 해석 → 리그별 구단
  const external = new Map<ID, Map<ID, ParsedClub>>();
  const overrides: Record<ID, Partial<LeagueDefinition>> = {};
  for (const file of input.files) {
    const stem = fileStem(file.path);
    const blocks = blocksOf(file.data);
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
        const parsed = parseClub(raw, league, i, nations, report, `${file.path} · ${league.nameKo}`);
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

  // 5) 레전드 · 기록: 외부 구단의 것이 내장 데이터보다 우선
  const legends: Record<ID, ClubLegend[]> = { ...(input.legends ?? CLUB_LEGENDS) };
  for (const club of Object.values(clubs)) if (club.legends?.length) legends[club.id] = club.legends;
  const externalRecords = [...parsedById.values()].filter((p) => clubs[p.club.id]).flatMap((p) => p.records);
  const recordKey = (r: HistoricRecord) => `${r.scope}:${r.scopeId}:${r.category}`;
  const overridden = new Set(externalRecords.map(recordKey));
  const records = [...(input.records ?? HISTORIC_RECORDS).filter((r) => !overridden.has(recordKey(r))), ...externalRecords];

  // 6) 활성 리그 정의: 덮어쓰기 적용 + 승강 연결 정리
  const leagues: Record<ID, LeagueDefinition> = {};
  for (const id of active) leagues[id] = { ...slots[id], ...overrides[id] };
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

