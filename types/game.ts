/**
 * 축구 커리어 시뮬레이션 — 핵심 데이터 스키마
 *
 * 설계 규칙
 * - 정적 데이터(*Definition)와 세이브에 저장되는 동적 상태(*State)를 분리한다.
 *   정적 데이터는 data/ 에 두고, 시즌마다 변하는 값은 GameState 안에만 둔다.
 * - 능력치는 1~99 정수. 명성·체력·멘탈·입지는 0~100.
 * - 금액 단위는 EUR, 연봉은 연 단위.
 * - 키 목록은 `as const` 배열을 단일 출처로 두고 타입을 파생한다.
 */

// ============================================================================
// 공통
// ============================================================================

export type ID = string;
/** FIFA 3자리 국가 코드 (예: 'KOR', 'ENG') */
export type NationCode = string;

// ============================================================================
// 시간 / 턴
// ============================================================================

/** 연 3턴: 리그 전반기 → 리그 후반기(컵 결승 포함) → 프리시즌(여름 휴식기·국제대회) */
export const TURN_PHASES = ['FIRST_HALF', 'SECOND_HALF', 'PRESEASON'] as const;
export type TurnPhase = (typeof TURN_PHASES)[number];

/**
 * 턴 좌표. season은 시즌 시작 연도(2026 → 2026/27 시즌, 모든 리그 추춘제).
 * PRESEASON 턴은 해당 시즌이 끝난 뒤의 여름(달력상 season + 1년)이다.
 */
export interface TurnPointer {
  season: number;
  phase: TurnPhase;
}

// ============================================================================
// 능력치
// ============================================================================

export const STAT_CATEGORIES = [
  'SHOOTING',
  'PASSING',
  'DRIBBLING',
  'SPEED',
  'DEFENDING',
  'PHYSICAL',
] as const;
export type StatCategory = (typeof STAT_CATEGORIES)[number];

/** 필드 플레이어 18개 세부 스탯 (6대 영역 × 3) */
export const FIELD_STAT_KEYS = [
  // 슈팅
  'finishing', // 결정력
  'shotPower', // 슛 파워
  'offTheBall', // 오프더볼
  // 패스
  'kickAccuracy', // 킥 정확도
  'vision', // 시야
  'setPieces', // 세트피스
  // 드리블
  'technique', // 개인기
  'takeOn', // 돌파
  'pressResistance', // 탈압박
  // 스피드
  'sprintSpeed', // 속력
  'acceleration', // 가속력
  'agility', // 민첩성
  // 수비
  'tackling', // 태클
  'interceptions', // 가로채기
  'defPositioning', // 위치 선정(수비)
  // 피지컬
  'strength', // 몸싸움
  'aerial', // 제공권
  'stamina', // 지구력
] as const;
export type FieldStatKey = (typeof FIELD_STAT_KEYS)[number];

/** 골키퍼 전용 6개 스탯 */
export const GK_STAT_KEYS = [
  'reflexes', // 반사 신경
  'goalKick', // 골킥
  'gkPositioning', // 위치 선정(GK)
  'gkRange', // 수비 범위
  'organization', // 수비 조율
  'distribution', // 볼 배급
] as const;
export type GKStatKey = (typeof GK_STAT_KEYS)[number];

export const ATTRIBUTE_KEYS = [...FIELD_STAT_KEYS, ...GK_STAT_KEYS] as const;
export type AttributeKey = FieldStatKey | GKStatKey;
export type AttributeGroup = StatCategory | 'GOALKEEPING';

/**
 * 모든 선수는 24개 능력치를 전부 가진다.
 * - 필드 선수의 GK 스탯은 낮은 값으로 존재하며 OVR에 반영되지 않는다.
 * - GK의 필드 스탯 중 지구력·몸싸움 등은 체력 소모·체형 변화 계산에만 쓰인다.
 */
export type Attributes = Record<AttributeKey, number>;

// ============================================================================
// 포지션 / 플레이 스타일
// ============================================================================

export const POSITIONS = ['ST', 'LW', 'RW', 'AM', 'CM', 'DM', 'LB', 'RB', 'CB', 'GK'] as const;
export type Position = (typeof POSITIONS)[number];
export type PositionGroup = 'FORWARD' | 'MIDFIELDER' | 'DEFENDER' | 'GOALKEEPER';

export const PLAYSTYLES_BY_POSITION = {
  ST: ['TARGET_MAN', 'ADVANCED_FORWARD', 'POACHER', 'FALSE_NINE'],
  LW: ['CLASSIC_WINGER', 'INSIDE_FORWARD', 'INVERTED_WINGER'],
  RW: ['CLASSIC_WINGER', 'INSIDE_FORWARD', 'INVERTED_WINGER'],
  AM: ['SHADOW_STRIKER', 'PLAYMAKER', 'RAUMDEUTER'],
  CM: ['MEZZALA', 'DEEP_LYING_PLAYMAKER', 'BOX_TO_BOX'],
  DM: ['HOLDING_MIDFIELDER', 'BALL_WINNING_MIDFIELDER', 'HALF_BACK'],
  LB: ['WING_BACK', 'FULL_BACK', 'INVERTED_WING_BACK'],
  RB: ['WING_BACK', 'FULL_BACK', 'INVERTED_WING_BACK'],
  CB: ['STOPPER', 'COVER', 'BALL_PLAYING_DEFENDER', 'WIDE_CENTER_BACK'],
  GK: ['CLASSIC_GOALKEEPER', 'SWEEPER_KEEPER'],
} as const satisfies Record<Position, readonly string[]>;

export type PlayStyleOf<P extends Position> = (typeof PLAYSTYLES_BY_POSITION)[P][number];
export type PlayStyle = PlayStyleOf<Position>;

/** 포지션과 플레이 스타일의 유효한 조합만 허용하는 타입 */
export type PlayerRole = {
  [P in Position]: { position: P; playStyle: PlayStyleOf<P> };
}[Position];

// ============================================================================
// 외형 (아바타)
// ============================================================================

export type HairColor = 'BLACK' | 'BROWN' | 'RED' | 'BLONDE';
/** 1(가장 어두움, 흑) ~ 5(가장 밝음, 백) */
export type SkinTone = 1 | 2 | 3 | 4 | 5;
export type EyeColor = 'DARK_BROWN' | 'BROWN' | 'HAZEL' | 'GREEN' | 'BLUE' | 'GRAY';

/** 키·몸무게는 아바타에 반영하지 않는다. */
export interface Appearance {
  hair: HairColor;
  skin: SkinTone;
  eyes: EyeColor;
}

// ============================================================================
// 팀 내 입지 / 계약
// ============================================================================

/** 필드 플레이어 출전시간 등급. RESERVE = B팀·유스 */
export type FieldPlayingTime = 'KEY' | 'STARTER' | 'ROTATION' | 'BACKUP' | 'RESERVE';
/** 골키퍼 출전시간 등급 */
export type GKPlayingTime = 'GK_FIRST' | 'GK_SECOND' | 'GK_THIRD';
export type PlayingTime = FieldPlayingTime | GKPlayingTime;

export type SquadLevel = 'FIRST_TEAM' | 'RESERVE' | 'YOUTH';

export interface SquadStatus {
  level: SquadLevel;
  playingTime: PlayingTime;
  /** 팀 내 입지 점수(0~100). 평점·프리시즌 활약으로 변동하며 출전 등급의 근거가 된다. */
  standing: number;
}

export type ContractType = 'PERMANENT' | 'LOAN';

/** 오퍼·역제의에서 주고받는 계약 조건 */
export interface ContractTerms {
  years: number;
  /** 연봉 (EUR/년) */
  wage: number;
  /** 보장 출전시간 */
  playingTime: PlayingTime;
}

export interface Contract {
  clubId: ID;
  type: ContractType;
  /** 임대일 때 원소속 구단 */
  parentClubId?: ID;
  startSeason: number;
  /** 계약 마지막 시즌(포함) */
  endSeason: number;
  wage: number;
  playingTime: PlayingTime;
  /** 이 계약으로 발생한 이적료 (기록용) */
  transferFee: number;
}

// ============================================================================
// 이적 / 오퍼 / 경쟁 선수
// ============================================================================

export type OfferType = 'TRANSFER' | 'LOAN' | 'RENEWAL';
export type OfferSource = 'AUTO' | 'PLAYER_REQUEST';
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

/** 오퍼 팀에서 포지션이 겹치는 경쟁 선수 미리보기 */
export interface SquadCompetitor {
  id: ID;
  name: string;
  nationality: NationCode;
  age: number;
  position: Position;
  ovr: number;
  playingTime: PlayingTime;
}

/** 구단 간 이적료 합의는 끝난 상태로, 선수 개인 협상 단계의 오퍼다. */
export interface TransferOffer {
  id: ID;
  type: OfferType;
  source: OfferSource;
  clubId: ID;
  terms: ContractTerms;
  /** 팀 내 입지가 높을수록 이적료도 높게 기록된다. 재계약은 0. */
  transferFee: number;
  competitors: SquadCompetitor[];
  /** 영혼의 파트너가 뛰고 있는 팀의 오퍼라면 파트너 NPC id */
  partnerNpcId?: ID;
  createdAt: TurnPointer;
  status: OfferStatus;
}

/** 턴당 능동 협상 한도 */
export interface NegotiationQuota {
  /** 이번 턴에 사용한 타 구단 역제의 횟수 (최대 3) */
  counterOffersUsed: number;
  /** 이번 턴에 현 소속팀 재계약 역제의를 했는지 */
  renewalRequested: boolean;
}

// ============================================================================
// NPC / 영혼의 파트너 / 숙명의 라이벌
// ============================================================================

/** 시즌을 넘어 추적되는 NPC 선수 (경쟁자·파트너·라이벌) */
export interface NpcPlayer {
  id: ID;
  name: string;
  nationality: NationCode;
  birthYear: number;
  position: Position;
  playStyle?: PlayStyle;
  ovr: number;
  reputation: number;
  clubId: ID | null;
  playingTime: PlayingTime;
  appearance?: Appearance;
  retired?: boolean;
}

export type PartnerBondType =
  | 'STRIKE_DUO' // 투톱
  | 'WING_PAIR' // 양 윙어
  | 'STRIKER_PLAYMAKER' // ST + AM
  | 'MIDFIELD_DUO' // 중원 듀오
  | 'CENTER_BACK_DUO' // 센터백 듀오
  | 'FLANK_DUO' // 풀백 + 윙어
  | 'KEEPER_DEFENDER'; // GK + 센터백

export interface PartnerTotals {
  appearancesTogether: number;
  wins: number;
  draws: number;
  losses: number;
  /** 서로 골·도움을 주고받은 합작 골 */
  jointGoals: number;
  cleanSheetsTogether: number;
}

export interface SoulPartner {
  npcId: ID;
  bondType: PartnerBondType;
  formedAt: TurnPointer;
  formedClubId: ID;
  totals: PartnerTotals;
  /** SEPARATED: 파트너 또는 주인공이 이적해 다른 팀에서 뛰는 중 */
  status: 'ACTIVE' | 'SEPARATED';
}

export type RivalReason = 'DERBY' | 'TITLE_RACE' | 'GLOBAL_STAR';

/** 주인공 관점의 맞대결 전적 */
export interface HeadToHead {
  meetings: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface Rival {
  npcId: ID;
  reason: RivalReason;
  category: PositionGroup;
  formedAt: TurnPointer;
  headToHead: HeadToHead;
}

// ============================================================================
// 세계 정적 데이터 (data/)
// ============================================================================

export type Confederation = 'UEFA' | 'AFC' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'OFC';

export interface NationDefinition {
  code: NationCode;
  name: string;
  nameKo: string;
  confederation: Confederation;
  /** 국가대표팀 실력 (구단 실력과 같은 스케일) */
  power: number;
}

/** 리그 순위 구간별 대륙 대회 진출권 */
export interface ContinentalSlot {
  competitionId: ID;
  fromPosition: number;
  toPosition: number;
}

export interface LeagueDefinition {
  id: ID;
  name: string;
  nameKo: string;
  nation: NationCode;
  confederation: Confederation;
  tier: 1 | 2;
  /** 리그 수준 (소속 구단 실력의 대략적 평균) */
  strength: number;
  /** 체력 소모 계수. 리그가 격렬할수록 크다 (1.0 = 기준) */
  intensity: number;
  /** 라운드로빈 반복 횟수 (2 = 홈·원정 1회씩) */
  roundRobinCycles: number;
  promotionSlots: number;
  relegationSlots: number;
  upperLeagueId?: ID;
  lowerLeagueId?: ID;
  domesticCupId: ID;
  continentalSlots: ContinentalSlot[];
  /** 자본 리그: 명성이 낮아도 재정으로 고연봉 오퍼를 보낸다 (사우디, MLS 등) */
  moneyLeague?: boolean;
}

export interface ClubLegend {
  name: string;
  position: Position;
  nationality?: NationCode;
  era: string;
  tribute?: string;
}

export type RecordScope = 'CLUB' | 'LEAGUE' | 'NATIONAL_TEAM';
export type RecordCategory = 'GOALS' | 'ASSISTS' | 'APPEARANCES' | 'CLEAN_SHEETS' | 'TROPHIES';

/** 실존 레전드의 역대 기록 (기록 경신 팝업용) */
export interface HistoricRecord {
  scope: RecordScope;
  scopeId: ID;
  category: RecordCategory;
  holderName: string;
  value: number;
}

export interface ClubDefinition {
  id: ID;
  name: string;
  nameKo: string;
  shortName: string;
  nation: NationCode;
  /** 게임 시작 시 소속 리그 (이후 승강은 ClubState.leagueId) */
  leagueId: ID;
  /** 초기 히든 수치 */
  power: number;
  prestige: number;
  finance: number;
  colors: { primary: string; secondary: string };
  /** 더비 상대 구단 */
  rivals: ID[];
  legends?: ClubLegend[];
}

// ============================================================================
// 대회
// ============================================================================

export type CompetitionType =
  | 'LEAGUE'
  | 'DOMESTIC_CUP'
  | 'CONTINENTAL'
  | 'INTERNATIONAL'
  | 'FRIENDLY'
  | 'RESERVE';

export const COMPETITION_TYPES: readonly CompetitionType[] = [
  'LEAGUE',
  'DOMESTIC_CUP',
  'CONTINENTAL',
  'INTERNATIONAL',
  'FRIENDLY',
  'RESERVE',
];

export type CompetitionFormat = 'LEAGUE' | 'KNOCKOUT' | 'GROUP_KNOCKOUT' | 'FRIENDLY';

export interface CompetitionDefinition {
  id: ID;
  name: string;
  nameKo: string;
  type: CompetitionType;
  format: CompetitionFormat;
  confederation?: Confederation;
  nation?: NationCode;
  /** 대회 위상 (명성 보상·발롱도르 가중치) */
  prestige: number;
}

export type InternationalTournamentId =
  | 'WORLD_CUP'
  | 'EURO'
  | 'COPA_AMERICA'
  | 'ASIAN_CUP'
  | 'AFCON'
  | 'GOLD_CUP'
  | 'NATIONS_LEAGUE'
  | 'OLYMPICS';

/** 턴을 넘어 이어지는 대회 진행 상황 (전반기 → 후반기) */
export interface CompetitionProgress {
  competitionId: ID;
  status: 'ACTIVE' | 'ELIMINATED' | 'CHAMPION';
  stageReached: string;
}

// ============================================================================
// 경기
// ============================================================================

export interface TeamRef {
  id: ID;
  name: string;
  /** 경기 시점의 실력 (히든 수치, UI 비노출) */
  power: number;
  kind: 'CLUB' | 'NATION' | 'GENERIC';
}

export type MatchImportance = 'LOW' | 'NORMAL' | 'HIGH' | 'FINAL';
export type TeamSide = 'HOME' | 'AWAY';

/** 주인공이 어느 스쿼드로 뛰는 경기인지 */
export type SquadContext = 'FIRST' | 'RESERVE' | 'NATIONAL';

/** 토너먼트 대진 성립 조건 */
export type FixtureRequirement =
  | { kind: 'WIN'; fixtureId: ID }
  | { kind: 'GROUP_ADVANCE'; groupId: ID };

export interface Fixture {
  id: ID;
  competitionId: ID;
  competitionType: CompetitionType;
  /** 표시용 라운드명 (예: '12라운드', '8강', '결승') */
  stage: string;
  /** 턴 시작일 기준 경과 일수 (정렬·체력 회복 계산용) */
  day: number;
  home: TeamRef;
  away: TeamRef;
  /** 중립 경기장 (결승·국제대회) */
  neutral: boolean;
  /** 주인공 소속팀(또는 대표팀)의 경기면 그 진영, 아니면 null */
  playerTeamSide: TeamSide | null;
  squad: SquadContext | null;
  knockout: boolean;
  isFinal: boolean;
  isDerby: boolean;
  importance: MatchImportance;
  requires?: FixtureRequirement;
}

export interface MatchScore {
  home: number;
  away: number;
  /** 승부차기 (녹아웃에서 연장까지 무승부일 때) */
  penalties?: { home: number; away: number };
  winner: TeamSide | 'DRAW';
}

export interface PlayerMatchLine {
  started: boolean;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  saves: number;
  rating: number;
  conditionAfter: number;
}

export interface MatchLog {
  fixtureId: ID;
  competitionId: ID;
  competitionType: CompetitionType;
  stage: string;
  day: number;
  home: TeamRef;
  away: TeamRef;
  score: MatchScore;
  playerTeamSide: TeamSide;
  /** 주인공 미출전이면 null */
  player: PlayerMatchLine | null;
  partnerJointGoals: number;
  isHighlight: boolean;
}

// ============================================================================
// 기록 집계
// ============================================================================

export interface PlayerStatLine {
  appearances: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  saves: number;
  /** 평균 평점 = ratingSum / appearances */
  ratingSum: number;
}

export interface TeamRecord {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface StandingRow extends TeamRecord {
  clubId: ID;
  points: number;
  position: number;
}

// ============================================================================
// 하이라이트 경기 (바둑돌 매치)
// ============================================================================

export type HighlightKind =
  | 'DERBY'
  | 'BIG_MATCH' // 더비 상대가 없을 때의 빅매치
  | 'DOMESTIC_CUP_FINAL'
  | 'CONTINENTAL_FINAL'
  | 'INTERNATIONAL'
  | 'PRESEASON_FRIENDLY'
  | 'RESERVE_DERBY';

export type TokenTag = 'PROTAGONIST' | 'PARTNER' | 'RIVAL' | 'FORMER_PARTNER';

/** 피치 위의 바둑돌. 좌표는 0~100 정규화 */
export interface MatchToken {
  id: ID;
  side: TeamSide;
  x: number;
  y: number;
  tag?: TokenTag;
  /** 라이벌·옛 파트너 등 이름을 직접 표시할 때 */
  label?: string;
  /** 주인공 바둑돌은 피부색·머리색을 반영 */
  appearance?: Appearance;
}

export type SituationKind = 'SHOT' | 'KEY_PASS' | 'DRIBBLE' | 'SET_PIECE' | 'DEFEND' | 'SAVE';

export interface SituationOption {
  id: ID;
  label: string;
  kind: SituationKind;
  /** 성공률 계산에 쓰이는 세부 능력치 */
  keyAttributes: AttributeKey[];
  /** 0~100. 상대 수준·경기 비중에 비례 */
  difficulty: number;
}

export interface MatchSituation {
  id: ID;
  minute: number;
  description: string;
  tokens: MatchToken[];
  options: SituationOption[];
}

export interface ResolvedSituation {
  situationId: ID;
  kind: SituationKind;
  success: boolean;
  /** 판정 당시 성공 확률 (리플레이·UI 표시용) */
  chance: number;
}

/** 바둑돌 매치에서 플레이어가 내린 선택들의 판정 결과 */
export interface HighlightOutcome {
  fixtureId: ID;
  resolved: ResolvedSituation[];
}

export interface HighlightRecord {
  fixtureId: ID;
  kind: HighlightKind;
  opponent: TeamRef;
  successes: number;
  failures: number;
  score: MatchScore;
  playerTeamSide: TeamSide;
  playerLine: PlayerMatchLine | null;
}

// ============================================================================
// 턴 결과 / 시즌 기록
// ============================================================================

export interface TurnRatingSummary {
  /** 공식 경기(리그·국내컵·대륙컵·국가대표) 평균 */
  overall: number | null;
  league: number | null;
  /** 컵 대회(국내컵 + 대륙컵) 평균 */
  cups: number | null;
  international: number | null;
  friendly: number | null;
  reserve: number | null;
}

export interface PartnerTurnStats extends PartnerTotals {
  npcId: ID;
}

export interface RivalTurnLine {
  appearances: number;
  goals: number;
  assists: number;
  cleanSheets: number;
  averageRating: number | null;
}

export interface RivalComparison {
  npcId: ID;
  player: RivalTurnLine;
  rival: RivalTurnLine;
  /** 이번 턴 맞대결 결과 (주인공 관점) */
  headToHead: Array<{ fixtureId: ID; result: 'WIN' | 'DRAW' | 'LOSS' }>;
}

export interface TrophyWin {
  competitionId: ID;
  season: number;
  teamId: ID;
  teamKind: 'CLUB' | 'NATION';
}

export interface TurnResult {
  turn: TurnPointer;
  clubId: ID | null;
  leagueId: ID | null;
  matches: MatchLog[];
  playerStats: Record<CompetitionType, PlayerStatLine>;
  teamStats: Partial<Record<CompetitionType, TeamRecord>>;
  /** 소속 리그 순위표 (후반기는 시즌 누적) */
  leagueTable: StandingRow[];
  progress: CompetitionProgress[];
  ratings: TurnRatingSummary;
  condition: { start: number; end: number };
  mental: { start: number; end: number };
  highlight: HighlightRecord | null;
  partner: PartnerTurnStats | null;
  rival: RivalComparison | null;
  trophies: TrophyWin[];
  /** 이번 여름 국가대표 차출 여부 (프리시즌 휴식 → 체력 100 조건) */
  nationalDuty: boolean;
  reputationDelta: number;
  standingDelta: number;
}

export interface SeasonRatingSummary {
  firstHalf: number | null;
  secondHalf: number | null;
  season: number | null;
  /** 컵 대회(국내+대륙) 평균 */
  cups: number | null;
  domesticCup: number | null;
  continental: number | null;
}

export type AwardType =
  | 'BALLON_DOR'
  | 'FIFA_BEST'
  | 'WORLD_BEST_XI'
  | 'CONTINENTAL_POTY'
  | 'NATIONAL_POTY'
  | 'LEAGUE_BEST_XI'
  | 'LEAGUE_TOP_SCORER'
  | 'LEAGUE_TOP_ASSISTS'
  | 'LEAGUE_MVP';

export interface AwardWin {
  type: AwardType;
  season: number;
  /** 1 = 수상. 발롱도르 등 순위형 시상은 2위 이하도 기록 */
  rank: number;
  /** 리그·대륙·국가 등 시상 범위 */
  scopeId?: ID;
}

export interface SeasonRecord {
  season: number;
  clubId: ID | null;
  leagueId: ID | null;
  age: number;
  ovrStart: number;
  ovrEnd: number;
  stats: Record<CompetitionType, PlayerStatLine>;
  ratings: SeasonRatingSummary;
  leaguePosition: number | null;
  trophies: TrophyWin[];
  awards: AwardWin[];
}

export interface RecordBreak {
  scope: RecordScope;
  scopeId: ID;
  category: RecordCategory;
  previousHolder: string;
  previousValue: number;
  newValue: number;
  turn: TurnPointer;
}

export interface LegendInduction {
  clubId: ID;
  turn: TurnPointer;
  reason: 'TRANSFER' | 'RETIREMENT';
  /** 나란히 언급되는 동 포지션 역사적 레전드 */
  comparedWith: string[];
  tribute: string;
}

// ============================================================================
// 턴 사이 사건
// ============================================================================

export type EventCategory =
  | 'FAMILY'
  | 'MEDIA'
  | 'TRAINING_METHOD'
  | 'SPONSORSHIP'
  | 'VACATION'
  | 'TEAM'
  | 'PARTNER'
  | 'RIVAL';

export type GameFlag =
  /** 프리시즌 휴가 계획에서 '휴식' 선택 */
  | 'PRESEASON_REST';

export type EventEffect =
  | { kind: 'MENTAL'; delta: number }
  | { kind: 'CONDITION'; delta: number }
  | { kind: 'ATTRIBUTE'; key: AttributeKey; delta: number }
  | { kind: 'CATEGORY'; category: StatCategory; delta: number }
  | { kind: 'REPUTATION'; delta: number }
  | { kind: 'MONEY'; delta: number }
  | { kind: 'STANDING'; delta: number }
  | { kind: 'GROWTH_FOCUS'; category: StatCategory; multiplier: number; turns: number }
  | { kind: 'FLAG'; flag: GameFlag; value: boolean };

export interface EventChoice {
  id: ID;
  label: string;
  effects: EventEffect[];
  /** 지정 시 확률 판정. 실패하면 failureEffects 적용 */
  successChance?: number;
  failureEffects?: EventEffect[];
}

export interface GameEventDefinition {
  id: ID;
  category: EventCategory;
  title: string;
  body: string;
  /** 이 턴이 끝난 직후에만 발생 */
  phases: TurnPhase[];
  weight: number;
  minAge?: number;
  maxAge?: number;
  choices: EventChoice[];
}

export interface PendingEvent {
  instanceId: ID;
  definitionId: ID;
  turn: TurnPointer;
}

// ============================================================================
// 훈련 / 상점
// ============================================================================

export type TrainingIntensity = 'LIGHT' | 'NORMAL' | 'INTENSE';

export type TrainingPlan =
  /** 큰 카테고리 1개(세부 3개 전체) 소폭 상승 */
  | { kind: 'CATEGORY'; category: StatCategory; intensity: TrainingIntensity }
  /** 세부 능력치 2~3개 동시 상승 */
  | { kind: 'FOCUSED'; attributes: AttributeKey[]; intensity: TrainingIntensity }
  /** 몸무게↑ 몸싸움·제공권↑ / 가속력·민첩성↓ */
  | { kind: 'BULK_UP'; intensity: TrainingIntensity }
  /** 몸무게↓ 가속력·민첩성↑ / 몸싸움·제공권↓ */
  | { kind: 'CUT'; intensity: TrainingIntensity }
  | { kind: 'REST' };

/** 사건으로 얻는 일정 기간 육성 방향 보너스 */
export interface GrowthFocus {
  category: StatCategory;
  multiplier: number;
  remainingTurns: number;
}

export type ItemCategory = 'EQUIPMENT' | 'FASHION' | 'HOUSE' | 'SUPERCAR' | 'WELLNESS';

/**
 * 밸런스 철칙: 아이템은 세부 능력치 단 1개만, 훈련 1회 상승량 이하로 올린다.
 * 상승량은 나이에 반비례하며 30대 초중반부터는 노화 하락 방어로 전환된다.
 */
export interface ShopItemDefinition {
  id: ID;
  name: string;
  category: ItemCategory;
  price: number;
  attribute: AttributeKey;
  baseBoost: number;
}

export interface OwnedItem {
  itemId: ID;
  purchasedAt: TurnPointer;
}

// ============================================================================
// 주인공
// ============================================================================

/** 캐릭터 생성 시 고정되는 정보 */
export interface PlayerProfile {
  id: ID;
  name: string;
  nationality: NationCode;
  birthYear: number;
  /** 키는 16세에 성장이 끝난 것으로 취급 (고정) */
  heightCm: number;
  appearance: Appearance;
  role: PlayerRole;
  startSeason: number;
}

export interface NationalTeamStatus {
  caps: number;
  goals: number;
  lastCallUp: TurnPointer | null;
}

export interface ClubSpell {
  clubId: ID;
  type: ContractType;
  fromSeason: number;
  toSeason: number | null;
}

export interface PlayerState {
  profile: PlayerProfile;
  age: number;
  /** 벌크업/감량으로 변동 */
  weightKg: number;
  attributes: Attributes;
  /** 현재 포지션·스타일 기준 OVR (캐시) */
  ovr: number;
  reputation: number;
  /** 체력(컨디션) 0~100: 매 턴 실제 출전 경기 수를 결정 */
  condition: number;
  /** 멘탈 0~100: 선택지 성공률·개인 성적·팀 성적 보정 계수 */
  mental: number;
  money: number;
  /** null = FA */
  contract: Contract | null;
  squad: SquadStatus;
  nationalTeam: NationalTeamStatus;
  growthFocus: GrowthFocus | null;
  inventory: OwnedItem[];
  career: Record<CompetitionType, PlayerStatLine>;
  clubHistory: ClubSpell[];
  retired: boolean;
}

// ============================================================================
// 구단 동적 상태 / 게임 상태 (세이브 단위)
// ============================================================================

/** 유저에게 보이지 않는 구단 히든 수치. 시즌마다 동적으로 갱신된다. */
export interface ClubState {
  clubId: ID;
  /** 현재 소속 리그 (승강 반영) */
  leagueId: ID;
  power: number;
  prestige: number;
  finance: number;
  /** 이번 시즌 출전하는 대륙 대회 */
  continentalCompetitionId: ID | null;
  lastLeaguePosition: number | null;
  /** 주인공과 포지션이 겹치는 추적 NPC (경쟁 선수 생태계) */
  squadNpcIds: ID[];
}

export type GameStage = 'CREATION' | 'BETWEEN_TURNS' | 'IN_TURN' | 'RETIRED';

export interface GameState {
  saveVersion: number;
  seed: number;
  turn: TurnPointer;
  stage: GameStage;
  player: PlayerState;
  clubs: Record<ID, ClubState>;
  npcs: Record<ID, NpcPlayer>;
  partner: SoulPartner | null;
  formerPartners: SoulPartner[];
  rival: Rival | null;
  offers: TransferOffer[];
  negotiation: NegotiationQuota;
  pendingEvents: PendingEvent[];
  /** 턴 사이 상점 구매는 1회 */
  shopPurchasedThisTurn: boolean;
  flags: Partial<Record<GameFlag, boolean>>;
  /** 다음 턴으로 이월되는 대회 진행 상황 */
  progress: CompetitionProgress[];
  /** 진행 중인 시즌의 리그 순위표 (전반기 → 후반기 누적) */
  leagueTable: StandingRow[];
  history: {
    /** 최근 턴 원본 (용량 관리를 위해 일부만 보관) */
    recentTurns: TurnResult[];
    seasons: SeasonRecord[];
  };
  awards: AwardWin[];
  trophies: TrophyWin[];
  recordBreaks: RecordBreak[];
  legends: LegendInduction[];
}
