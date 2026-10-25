/**
 * 대회 정의 · 토너먼트 형식 · 국제대회 캘린더
 * 리그 대회는 data/leagues.ts의 리그 id를 그대로 대회 id로 쓴다.
 */
import type {
  CompetitionDefinition,
  Confederation,
  InternationalTournamentId,
  TurnPhase,
} from '@/types/game';

const list: CompetitionDefinition[] = [
  // ----- 국내 컵 -----
  { id: 'ENG_FA_CUP', name: 'FA Cup', nameKo: 'FA컵', type: 'DOMESTIC_CUP', format: 'KNOCKOUT', nation: 'ENG', prestige: 70 },
  { id: 'ESP_COPA_DEL_REY', name: 'Copa del Rey', nameKo: '코파 델 레이', type: 'DOMESTIC_CUP', format: 'KNOCKOUT', nation: 'ESP', prestige: 66 },
  { id: 'KOR_FA_CUP', name: 'Korea Cup', nameKo: '코리아컵', type: 'DOMESTIC_CUP', format: 'KNOCKOUT', nation: 'KOR', prestige: 40 },
  // ----- 대륙 클럽 대항전 -----
  { id: 'UEFA_CL', name: 'UEFA Champions League', nameKo: 'UEFA 챔피언스리그', type: 'CONTINENTAL', format: 'GROUP_KNOCKOUT', confederation: 'UEFA', prestige: 100 },
  { id: 'UEFA_EL', name: 'UEFA Europa League', nameKo: 'UEFA 유로파리그', type: 'CONTINENTAL', format: 'GROUP_KNOCKOUT', confederation: 'UEFA', prestige: 72 },
  { id: 'UEFA_ECL', name: 'UEFA Conference League', nameKo: 'UEFA 컨퍼런스리그', type: 'CONTINENTAL', format: 'GROUP_KNOCKOUT', confederation: 'UEFA', prestige: 55 },
  { id: 'AFC_CL', name: 'AFC Champions League Elite', nameKo: 'AFC 챔피언스리그 엘리트', type: 'CONTINENTAL', format: 'GROUP_KNOCKOUT', confederation: 'AFC', prestige: 55 },
  { id: 'CONMEBOL_LIB', name: 'Copa Libertadores', nameKo: '코파 리베르타도레스', type: 'CONTINENTAL', format: 'GROUP_KNOCKOUT', confederation: 'CONMEBOL', prestige: 70 },
  { id: 'CONCACAF_CC', name: 'CONCACAF Champions Cup', nameKo: 'CONCACAF 챔피언스컵', type: 'CONTINENTAL', format: 'GROUP_KNOCKOUT', confederation: 'CONCACAF', prestige: 48 },
  { id: 'CAF_CL', name: 'CAF Champions League', nameKo: 'CAF 챔피언스리그', type: 'CONTINENTAL', format: 'GROUP_KNOCKOUT', confederation: 'CAF', prestige: 50 },
  // ----- 기타 -----
  { id: 'CLUB_FRIENDLY', name: 'Club Friendly', nameKo: '프리시즌 친선경기', type: 'FRIENDLY', format: 'FRIENDLY', prestige: 5 },
  { id: 'RESERVE_LEAGUE', name: 'Reserve / Youth League', nameKo: 'B팀·유스 리그', type: 'RESERVE', format: 'LEAGUE', prestige: 5 },
  // ----- 국가대표 -----
  { id: 'WORLD_CUP', name: 'FIFA World Cup', nameKo: 'FIFA 월드컵', type: 'INTERNATIONAL', format: 'GROUP_KNOCKOUT', prestige: 100 },
  { id: 'EURO', name: 'UEFA European Championship', nameKo: '유로', type: 'INTERNATIONAL', format: 'GROUP_KNOCKOUT', confederation: 'UEFA', prestige: 85 },
  { id: 'COPA_AMERICA', name: 'Copa América', nameKo: '코파 아메리카', type: 'INTERNATIONAL', format: 'GROUP_KNOCKOUT', confederation: 'CONMEBOL', prestige: 80 },
  { id: 'ASIAN_CUP', name: 'AFC Asian Cup', nameKo: 'AFC 아시안컵', type: 'INTERNATIONAL', format: 'GROUP_KNOCKOUT', confederation: 'AFC', prestige: 60 },
  { id: 'AFCON', name: 'Africa Cup of Nations', nameKo: '아프리카 네이션스컵', type: 'INTERNATIONAL', format: 'GROUP_KNOCKOUT', confederation: 'CAF', prestige: 62 },
  { id: 'GOLD_CUP', name: 'CONCACAF Gold Cup', nameKo: '골드컵', type: 'INTERNATIONAL', format: 'GROUP_KNOCKOUT', confederation: 'CONCACAF', prestige: 50 },
  { id: 'NATIONS_LEAGUE', name: 'UEFA Nations League Finals', nameKo: 'UEFA 네이션스리그 파이널', type: 'INTERNATIONAL', format: 'KNOCKOUT', confederation: 'UEFA', prestige: 50 },
  { id: 'OLYMPICS', name: 'Olympic Football Tournament', nameKo: '올림픽 축구', type: 'INTERNATIONAL', format: 'GROUP_KNOCKOUT', prestige: 45 },
];

export const COMPETITIONS: Record<string, CompetitionDefinition> = Object.fromEntries(
  list.map((competition) => [competition.id, competition]),
);

// ---------------------------------------------------------------------------
// 클럽 토너먼트 형식
// ---------------------------------------------------------------------------

export interface KnockoutRound {
  stage: string;
  phase: TurnPhase;
  final?: boolean;
}

/** 국내 컵: 전반기 2라운드, 후반기 8강~결승 (단판) */
export const DOMESTIC_CUP_ROUNDS: readonly KnockoutRound[] = [
  { stage: '3라운드', phase: 'FIRST_HALF' },
  { stage: '16강', phase: 'FIRST_HALF' },
  { stage: '8강', phase: 'SECOND_HALF' },
  { stage: '4강', phase: 'SECOND_HALF' },
  { stage: '결승', phase: 'SECOND_HALF', final: true },
];

/** 대륙 대회: 전반기 조별리그(4팀 더블 라운드로빈), 후반기 단판 토너먼트 */
export const CONTINENTAL_FORMAT = {
  groupSize: 4,
  groupCycles: 2,
  advancePerGroup: 2,
  knockout: [
    { stage: '16강', phase: 'SECOND_HALF' },
    { stage: '8강', phase: 'SECOND_HALF' },
    { stage: '4강', phase: 'SECOND_HALF' },
    { stage: '결승', phase: 'SECOND_HALF', final: true },
  ] as readonly KnockoutRound[],
} as const;

// ---------------------------------------------------------------------------
// 국제대회 캘린더 (프리시즌 턴 = 시즌 종료 후 여름, 달력상 season + 1년)
// ---------------------------------------------------------------------------

export interface InternationalTournamentDefinition {
  id: InternationalTournamentId;
  /** 참가 대륙. 'GLOBAL'은 전 세계 */
  confederations: readonly Confederation[] | 'GLOBAL';
  /** 달력 연도 % every === offset 인 해 여름에 개최 */
  every: number;
  offset: number;
  hasGroupStage: boolean;
  /** 조 3위 통과 확률 (확장 대회의 성적 좋은 3위 통과 근사) */
  thirdPlaceAdvanceChance: number;
  knockoutStages: readonly string[];
  /** 같은 해 여러 대회가 겹치면 높은 쪽에 차출 */
  priority: number;
  /** 이 수준 이상 국가만 참가 (네이션스리그 파이널 진출 근사) */
  minNationPower?: number;
  /** 올림픽 U-23 */
  ageLimit?: number;
  /** 연령 제한 초과 와일드카드 인원 */
  wildcards?: number;
  /** 연령 제한 팀의 실력 보정 */
  teamPowerOffset?: number;
}

export const INTERNATIONAL_TOURNAMENTS: readonly InternationalTournamentDefinition[] = [
  { id: 'WORLD_CUP', confederations: 'GLOBAL', every: 4, offset: 2, hasGroupStage: true, thirdPlaceAdvanceChance: 0.67, knockoutStages: ['32강', '16강', '8강', '4강', '결승'], priority: 100 },
  { id: 'EURO', confederations: ['UEFA'], every: 4, offset: 0, hasGroupStage: true, thirdPlaceAdvanceChance: 0.67, knockoutStages: ['16강', '8강', '4강', '결승'], priority: 80 },
  { id: 'COPA_AMERICA', confederations: ['CONMEBOL'], every: 4, offset: 0, hasGroupStage: true, thirdPlaceAdvanceChance: 0, knockoutStages: ['8강', '4강', '결승'], priority: 80 },
  { id: 'ASIAN_CUP', confederations: ['AFC'], every: 4, offset: 3, hasGroupStage: true, thirdPlaceAdvanceChance: 0.67, knockoutStages: ['16강', '8강', '4강', '결승'], priority: 80 },
  { id: 'AFCON', confederations: ['CAF'], every: 2, offset: 1, hasGroupStage: true, thirdPlaceAdvanceChance: 0.67, knockoutStages: ['16강', '8강', '4강', '결승'], priority: 80 },
  { id: 'GOLD_CUP', confederations: ['CONCACAF'], every: 2, offset: 1, hasGroupStage: true, thirdPlaceAdvanceChance: 0, knockoutStages: ['8강', '4강', '결승'], priority: 70 },
  { id: 'OLYMPICS', confederations: 'GLOBAL', every: 4, offset: 0, hasGroupStage: true, thirdPlaceAdvanceChance: 0, knockoutStages: ['8강', '4강', '결승'], priority: 40, ageLimit: 23, wildcards: 3, teamPowerOffset: -7 },
  { id: 'NATIONS_LEAGUE', confederations: ['UEFA'], every: 2, offset: 1, hasGroupStage: false, thirdPlaceAdvanceChance: 0, knockoutStages: ['4강', '결승'], priority: 30, minNationPower: 83 },
];
