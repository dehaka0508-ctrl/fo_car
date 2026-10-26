/**
 * 리그 정의 — 기획서의 전체 대상 리그 47개 (모두 추춘제로 통일)
 *
 * - 유럽 5대 리그 1·2부 (잉글랜드·스페인·독일·이탈리아·프랑스)
 * - 유럽 기타 16개국 1부
 * - 아시아·오세아니아: 한국 1·2부 + 중국·일본·사우디·이란·카타르·UAE·태국·호주 1부
 * - 아메리카 7개국 1부, 아프리카 4개국 1부
 *
 * 여기 정의는 '슬롯'이다. 구단 데이터(data/clubs.ts 샘플 또는 data/external/의 외부 DB)가
 * 들어온 리그만 게임에서 활성화된다 (data/dbLoader.ts). teamCount는 정규 참가 구단 수,
 * aliases는 외부 DB가 리그를 가리킬 때 받아 주는 다른 표기다.
 */
import type { ContinentalSlot, LeagueDefinition } from '@/types/game';

const UCL = 'UEFA_CL';
const UEL = 'UEFA_EL';
const UECL = 'UEFA_ECL';

function slots(...rows: Array<[string, number, number]>): ContinentalSlot[] {
  return rows.map(([competitionId, fromPosition, toPosition]) => ({ competitionId, fromPosition, toPosition }));
}

/** 유럽 중소 리그 공통 진출권: 1위 UCL, 2위 UEL, 3위 UECL */
const EURO_SMALL = slots([UCL, 1, 1], [UEL, 2, 2], [UECL, 3, 3]);
const EURO_MINOR = slots([UCL, 1, 1], [UECL, 2, 3]);

const list: LeagueDefinition[] = [
  // ===== 유럽 5대 리그 =====
  {
    id: 'ENG_PL', name: 'Premier League', nameKo: '프리미어리그', nation: 'ENG', confederation: 'UEFA', tier: 1,
    strength: 78, intensity: 1.15, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 3, teamCount: 20,
    lowerLeagueId: 'ENG_CH', domesticCupId: 'ENG_FA_CUP',
    continentalSlots: slots([UCL, 1, 4], [UEL, 5, 5], [UECL, 6, 6]),
    aliases: ['EPL', 'ENG1', 'English Premier League'],
  },
  {
    id: 'ENG_CH', name: 'EFL Championship', nameKo: '챔피언십', nation: 'ENG', confederation: 'UEFA', tier: 2,
    strength: 68, intensity: 1.12, roundRobinCycles: 2, promotionSlots: 3, relegationSlots: 0, teamCount: 24,
    upperLeagueId: 'ENG_PL', domesticCupId: 'ENG_FA_CUP', continentalSlots: [],
    aliases: ['Championship', 'ENG2', 'EFL Championship'],
  },
  {
    id: 'ESP_LALIGA', name: 'LaLiga', nameKo: '라리가', nation: 'ESP', confederation: 'UEFA', tier: 1,
    strength: 76, intensity: 1.08, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 3, teamCount: 20,
    lowerLeagueId: 'ESP_L2', domesticCupId: 'ESP_COPA_DEL_REY',
    continentalSlots: slots([UCL, 1, 4], [UEL, 5, 6], [UECL, 7, 7]),
    aliases: ['La Liga', 'ESP1', 'LaLiga EA Sports', 'Primera Division'],
  },
  {
    id: 'ESP_L2', name: 'LaLiga Hypermotion', nameKo: '라리가2', nation: 'ESP', confederation: 'UEFA', tier: 2,
    strength: 64, intensity: 1.0, roundRobinCycles: 2, promotionSlots: 3, relegationSlots: 0, teamCount: 22,
    upperLeagueId: 'ESP_LALIGA', domesticCupId: 'ESP_COPA_DEL_REY', continentalSlots: [],
    aliases: ['LaLiga 2', 'ESP2', 'Segunda Division', 'LaLiga Hypermotion'],
  },
  {
    id: 'GER_BL1', name: 'Bundesliga', nameKo: '분데스리가', nation: 'GER', confederation: 'UEFA', tier: 1,
    strength: 76, intensity: 1.1, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 2, teamCount: 18,
    lowerLeagueId: 'GER_BL2', domesticCupId: 'GER_DFB_POKAL',
    continentalSlots: slots([UCL, 1, 4], [UEL, 5, 5], [UECL, 6, 6]),
    aliases: ['GER1', 'Bundesliga 1', '1. Bundesliga'],
  },
  {
    id: 'GER_BL2', name: '2. Bundesliga', nameKo: '2. 분데스리가', nation: 'GER', confederation: 'UEFA', tier: 2,
    strength: 64, intensity: 1.05, roundRobinCycles: 2, promotionSlots: 2, relegationSlots: 0, teamCount: 18,
    upperLeagueId: 'GER_BL1', domesticCupId: 'GER_DFB_POKAL', continentalSlots: [],
    aliases: ['GER2', 'Bundesliga 2', '2 Bundesliga'],
  },
  {
    id: 'ITA_SA', name: 'Serie A', nameKo: '세리에 A', nation: 'ITA', confederation: 'UEFA', tier: 1,
    strength: 75, intensity: 1.0, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 3, teamCount: 20,
    lowerLeagueId: 'ITA_SB', domesticCupId: 'ITA_COPPA',
    continentalSlots: slots([UCL, 1, 4], [UEL, 5, 6], [UECL, 7, 7]),
    aliases: ['ITA1', 'Serie A TIM', 'Serie A Enilive'],
  },
  {
    id: 'ITA_SB', name: 'Serie B', nameKo: '세리에 B', nation: 'ITA', confederation: 'UEFA', tier: 2,
    strength: 62, intensity: 0.98, roundRobinCycles: 2, promotionSlots: 3, relegationSlots: 0, teamCount: 20,
    upperLeagueId: 'ITA_SA', domesticCupId: 'ITA_COPPA', continentalSlots: [],
    aliases: ['ITA2', 'Serie BKT'],
  },
  {
    id: 'FRA_L1', name: 'Ligue 1', nameKo: '리그 1', nation: 'FRA', confederation: 'UEFA', tier: 1,
    strength: 73, intensity: 1.05, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 2, teamCount: 18,
    lowerLeagueId: 'FRA_L2', domesticCupId: 'FRA_COUPE',
    continentalSlots: slots([UCL, 1, 3], [UEL, 4, 4], [UECL, 5, 5]),
    aliases: ['FRA1', 'Ligue 1 McDonalds', 'French Ligue 1'],
  },
  {
    id: 'FRA_L2', name: 'Ligue 2', nameKo: '리그 2', nation: 'FRA', confederation: 'UEFA', tier: 2,
    strength: 61, intensity: 0.98, roundRobinCycles: 2, promotionSlots: 2, relegationSlots: 0, teamCount: 18,
    upperLeagueId: 'FRA_L1', domesticCupId: 'FRA_COUPE', continentalSlots: [],
    aliases: ['FRA2', 'Ligue 2 BKT'],
  },

  // ===== 유럽 기타 16개국 1부 =====
  {
    id: 'POR_LP', name: 'Liga Portugal', nameKo: '리가 포르투갈', nation: 'POR', confederation: 'UEFA', tier: 1,
    strength: 67, intensity: 1.0, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 18,
    domesticCupId: 'POR_TACA', continentalSlots: slots([UCL, 1, 2], [UEL, 3, 3], [UECL, 4, 4]),
    aliases: ['POR1', 'Primeira Liga', 'Liga Portugal Betclic'],
  },
  {
    id: 'SCO_PREM', name: 'Scottish Premiership', nameKo: '스코티시 프리미어십', nation: 'SCO', confederation: 'UEFA', tier: 1,
    strength: 59, intensity: 1.0, roundRobinCycles: 3, promotionSlots: 0, relegationSlots: 0, teamCount: 12,
    domesticCupId: 'SCO_CUP', continentalSlots: EURO_SMALL,
    aliases: ['SCO1', 'Premiership', 'SPFL Premiership'],
  },
  {
    id: 'BEL_PRO', name: 'Belgian Pro League', nameKo: '벨기에 프로리그', nation: 'BEL', confederation: 'UEFA', tier: 1,
    strength: 64, intensity: 1.0, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 18,
    domesticCupId: 'BEL_CUP', continentalSlots: slots([UCL, 1, 1], [UEL, 2, 2], [UECL, 3, 4]),
    aliases: ['BEL1', 'Jupiler Pro League', 'Pro League'],
  },
  {
    id: 'NED_ERE', name: 'Eredivisie', nameKo: '에레디비시', nation: 'NED', confederation: 'UEFA', tier: 1,
    strength: 67, intensity: 1.0, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 18,
    domesticCupId: 'NED_KNVB', continentalSlots: slots([UCL, 1, 2], [UEL, 3, 3], [UECL, 4, 4]),
    aliases: ['NED1', 'Dutch Eredivisie'],
  },
  {
    id: 'SUI_SL', name: 'Swiss Super League', nameKo: '스위스 슈퍼리그', nation: 'SUI', confederation: 'UEFA', tier: 1,
    strength: 60, intensity: 0.98, roundRobinCycles: 3, promotionSlots: 0, relegationSlots: 0, teamCount: 12,
    domesticCupId: 'SUI_CUP', continentalSlots: EURO_SMALL,
    aliases: ['SUI1', 'Super League', 'Credit Suisse Super League'],
  },
  {
    id: 'TUR_SL', name: 'Süper Lig', nameKo: '쉬페르리그', nation: 'TUR', confederation: 'UEFA', tier: 1,
    strength: 65, intensity: 1.0, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 18,
    domesticCupId: 'TUR_CUP', continentalSlots: slots([UCL, 1, 2], [UEL, 3, 3], [UECL, 4, 4]),
    aliases: ['TUR1', 'Super Lig', 'Trendyol Super Lig'],
  },
  {
    id: 'CZE_FL', name: 'Czech First League', nameKo: '체코 1부 리그', nation: 'CZE', confederation: 'UEFA', tier: 1,
    strength: 59, intensity: 0.97, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 16,
    domesticCupId: 'CZE_CUP', continentalSlots: EURO_SMALL,
    aliases: ['CZE1', 'Fortuna Liga', 'Chance Liga'],
  },
  {
    id: 'POL_EKS', name: 'Ekstraklasa', nameKo: '엑스트라클라사', nation: 'POL', confederation: 'UEFA', tier: 1,
    strength: 58, intensity: 0.97, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 18,
    domesticCupId: 'POL_CUP', continentalSlots: EURO_MINOR,
    aliases: ['POL1', 'PKO Ekstraklasa'],
  },
  {
    id: 'GRE_SL', name: 'Super League Greece', nameKo: '그리스 슈퍼리그', nation: 'GRE', confederation: 'UEFA', tier: 1,
    strength: 60, intensity: 0.97, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 14,
    domesticCupId: 'GRE_CUP', continentalSlots: EURO_SMALL,
    aliases: ['GRE1', 'Super League 1', 'Stoiximan Super League'],
  },
  {
    id: 'NOR_ELI', name: 'Eliteserien', nameKo: '엘리테세리엔', nation: 'NOR', confederation: 'UEFA', tier: 1,
    strength: 58, intensity: 0.95, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 16,
    domesticCupId: 'NOR_CUP', continentalSlots: EURO_MINOR,
    aliases: ['NOR1', 'Norwegian Eliteserien'],
  },
  {
    id: 'DEN_SL', name: 'Danish Superliga', nameKo: '덴마크 수페르리가', nation: 'DEN', confederation: 'UEFA', tier: 1,
    strength: 60, intensity: 0.97, roundRobinCycles: 3, promotionSlots: 0, relegationSlots: 0, teamCount: 12,
    domesticCupId: 'DEN_CUP', continentalSlots: EURO_SMALL,
    aliases: ['DEN1', 'Superliga', '3F Superliga'],
  },
  {
    id: 'AUT_BL', name: 'Austrian Bundesliga', nameKo: '오스트리아 분데스리가', nation: 'AUT', confederation: 'UEFA', tier: 1,
    strength: 60, intensity: 0.98, roundRobinCycles: 3, promotionSlots: 0, relegationSlots: 0, teamCount: 12,
    domesticCupId: 'AUT_CUP', continentalSlots: EURO_SMALL,
    aliases: ['AUT1', 'Admiral Bundesliga'],
  },
  {
    id: 'HUN_NB1', name: 'Nemzeti Bajnokság I', nameKo: '헝가리 NB I', nation: 'HUN', confederation: 'UEFA', tier: 1,
    strength: 55, intensity: 0.95, roundRobinCycles: 3, promotionSlots: 0, relegationSlots: 0, teamCount: 12,
    domesticCupId: 'HUN_CUP', continentalSlots: EURO_MINOR,
    aliases: ['HUN1', 'NB I', 'OTP Bank Liga'],
  },
  {
    id: 'CRO_HNL', name: 'HNL', nameKo: '크로아티아 HNL', nation: 'CRO', confederation: 'UEFA', tier: 1,
    strength: 57, intensity: 0.95, roundRobinCycles: 4, promotionSlots: 0, relegationSlots: 0, teamCount: 10,
    domesticCupId: 'CRO_CUP', continentalSlots: EURO_MINOR,
    aliases: ['CRO1', 'SuperSport HNL', 'Prva HNL'],
  },
  {
    id: 'SWE_ALL', name: 'Allsvenskan', nameKo: '알스벤스칸', nation: 'SWE', confederation: 'UEFA', tier: 1,
    strength: 57, intensity: 0.95, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 16,
    domesticCupId: 'SWE_CUP', continentalSlots: EURO_MINOR,
    aliases: ['SWE1', 'Swedish Allsvenskan'],
  },
  {
    id: 'UKR_UPL', name: 'Ukrainian Premier League', nameKo: '우크라이나 프리미어리그', nation: 'UKR', confederation: 'UEFA', tier: 1,
    strength: 59, intensity: 0.97, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 16,
    domesticCupId: 'UKR_CUP', continentalSlots: EURO_SMALL,
    aliases: ['UKR1', 'UPL', 'Ukrainian Premier Liha'],
  },

  // ===== 아시아 · 오세아니아 =====
  {
    id: 'KOR_K1', name: 'K League 1', nameKo: 'K리그1', nation: 'KOR', confederation: 'AFC', tier: 1,
    strength: 64, intensity: 0.95, roundRobinCycles: 3, promotionSlots: 0, relegationSlots: 1, teamCount: 12,
    lowerLeagueId: 'KOR_K2', domesticCupId: 'KOR_FA_CUP',
    continentalSlots: slots(['AFC_CL', 1, 3]),
    aliases: ['KOR1', 'K League', 'K리그1'],
  },
  {
    id: 'KOR_K2', name: 'K League 2', nameKo: 'K리그2', nation: 'KOR', confederation: 'AFC', tier: 2,
    strength: 57, intensity: 0.92, roundRobinCycles: 2, promotionSlots: 1, relegationSlots: 0, teamCount: 17,
    upperLeagueId: 'KOR_K1', domesticCupId: 'KOR_FA_CUP', continentalSlots: [],
    aliases: ['KOR2', 'K리그2'],
  },
  {
    id: 'JPN_J1', name: 'J1 League', nameKo: 'J1리그', nation: 'JPN', confederation: 'AFC', tier: 1,
    strength: 65, intensity: 0.97, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 20,
    domesticCupId: 'JPN_EMPEROR', continentalSlots: slots(['AFC_CL', 1, 3]),
    aliases: ['JPN1', 'J.League', 'J1', 'Meiji Yasuda J1 League'],
  },
  {
    id: 'CHN_CSL', name: 'Chinese Super League', nameKo: '중국 슈퍼리그', nation: 'CHN', confederation: 'AFC', tier: 1,
    strength: 60, intensity: 0.92, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 16,
    domesticCupId: 'CHN_FA_CUP', continentalSlots: slots(['AFC_CL', 1, 2]),
    aliases: ['CHN1', 'CSL', 'Super League (China)'],
  },
  {
    id: 'KSA_SPL', name: 'Saudi Pro League', nameKo: '사우디 프로리그', nation: 'KSA', confederation: 'AFC', tier: 1,
    strength: 67, intensity: 0.9, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 18,
    domesticCupId: 'KSA_KINGS_CUP', moneyLeague: true, continentalSlots: slots(['AFC_CL', 1, 3]),
    aliases: ['KSA1', 'SPL', 'Roshn Saudi League'],
  },
  {
    id: 'IRN_PGPL', name: 'Persian Gulf Pro League', nameKo: '페르시안 걸프 프로리그', nation: 'IRN', confederation: 'AFC', tier: 1,
    strength: 57, intensity: 0.92, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 18,
    domesticCupId: 'IRN_HAZFI', continentalSlots: slots(['AFC_CL', 1, 2]),
    aliases: ['IRN1', 'Iran Pro League', 'Persian Gulf Pro League'],
  },
  {
    id: 'QAT_QSL', name: 'Qatar Stars League', nameKo: '카타르 스타스리그', nation: 'QAT', confederation: 'AFC', tier: 1,
    strength: 58, intensity: 0.88, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 12,
    domesticCupId: 'QAT_EMIR_CUP', moneyLeague: true, continentalSlots: slots(['AFC_CL', 1, 2]),
    aliases: ['QAT1', 'QSL', 'Expo Stars League'],
  },
  {
    id: 'UAE_PL', name: 'UAE Pro League', nameKo: 'UAE 프로리그', nation: 'UAE', confederation: 'AFC', tier: 1,
    strength: 58, intensity: 0.88, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 14,
    domesticCupId: 'UAE_PRESIDENTS_CUP', moneyLeague: true, continentalSlots: slots(['AFC_CL', 1, 2]),
    aliases: ['UAE1', 'ADNOC Pro League', 'Arabian Gulf League'],
  },
  {
    id: 'THA_T1', name: 'Thai League 1', nameKo: '타이 리그 1', nation: 'THA', confederation: 'AFC', tier: 1,
    strength: 53, intensity: 0.9, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 16,
    domesticCupId: 'THA_FA_CUP', continentalSlots: slots(['AFC_CL', 1, 1]),
    aliases: ['THA1', 'Thai League', 'T1'],
  },
  {
    id: 'AUS_AL', name: 'A-League Men', nameKo: 'A리그', nation: 'AUS', confederation: 'AFC', tier: 1,
    strength: 56, intensity: 0.93, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 12,
    domesticCupId: 'AUS_CUP', continentalSlots: slots(['AFC_CL', 1, 1]),
    aliases: ['AUS1', 'A-League', 'Isuzu UTE A-League'],
  },

  // ===== 아메리카 =====
  {
    id: 'USA_MLS', name: 'Major League Soccer', nameKo: 'MLS', nation: 'USA', confederation: 'CONCACAF', tier: 1,
    strength: 66, intensity: 0.95, roundRobinCycles: 1, promotionSlots: 0, relegationSlots: 0, teamCount: 30,
    domesticCupId: 'USA_OPEN_CUP', moneyLeague: true, continentalSlots: slots(['CONCACAF_CC', 1, 4]),
    aliases: ['USA1', 'MLS'],
  },
  {
    id: 'CAN_CPL', name: 'Canadian Premier League', nameKo: '캐나다 프리미어리그', nation: 'CAN', confederation: 'CONCACAF', tier: 1,
    strength: 50, intensity: 0.9, roundRobinCycles: 4, promotionSlots: 0, relegationSlots: 0, teamCount: 8,
    domesticCupId: 'CAN_CHAMPIONSHIP', continentalSlots: slots(['CONCACAF_CC', 1, 1]),
    aliases: ['CAN1', 'CPL'],
  },
  {
    id: 'MEX_LMX', name: 'Liga MX', nameKo: '리가 MX', nation: 'MEX', confederation: 'CONCACAF', tier: 1,
    strength: 65, intensity: 0.97, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 18,
    domesticCupId: 'MEX_COPA', continentalSlots: slots(['CONCACAF_CC', 1, 4]),
    aliases: ['MEX1', 'Liga BBVA MX'],
  },
  {
    id: 'BRA_SA', name: 'Brasileirão Série A', nameKo: '브라질레이랑', nation: 'BRA', confederation: 'CONMEBOL', tier: 1,
    strength: 68, intensity: 1.0, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 20,
    domesticCupId: 'BRA_COPA', continentalSlots: slots(['CONMEBOL_LIB', 1, 6]),
    aliases: ['BRA1', 'Serie A (Brazil)', 'Brasileirao', 'Campeonato Brasileiro Série A'],
  },
  {
    id: 'ARG_LPF', name: 'Liga Profesional', nameKo: '아르헨티나 리가 프로페시오날', nation: 'ARG', confederation: 'CONMEBOL', tier: 1,
    strength: 63, intensity: 0.98, roundRobinCycles: 1, promotionSlots: 0, relegationSlots: 0, teamCount: 30,
    domesticCupId: 'ARG_COPA', continentalSlots: slots(['CONMEBOL_LIB', 1, 5]),
    aliases: ['ARG1', 'Liga Profesional de Fútbol', 'Primera Division (Argentina)'],
  },
  {
    id: 'CHI_PRI', name: 'Chilean Primera División', nameKo: '칠레 프리메라', nation: 'CHI', confederation: 'CONMEBOL', tier: 1,
    strength: 55, intensity: 0.93, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 16,
    domesticCupId: 'CHI_COPA', continentalSlots: slots(['CONMEBOL_LIB', 1, 3]),
    aliases: ['CHI1', 'Primera Division (Chile)', 'Liga de Primera'],
  },
  {
    id: 'COL_PRI', name: 'Categoría Primera A', nameKo: '콜롬비아 프리메라 A', nation: 'COL', confederation: 'CONMEBOL', tier: 1,
    strength: 57, intensity: 0.93, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 20,
    domesticCupId: 'COL_COPA', continentalSlots: slots(['CONMEBOL_LIB', 1, 3]),
    aliases: ['COL1', 'Liga BetPlay', 'Primera A'],
  },

  // ===== 아프리카 =====
  {
    id: 'EGY_PL', name: 'Egyptian Premier League', nameKo: '이집트 프리미어리그', nation: 'EGY', confederation: 'CAF', tier: 1,
    strength: 56, intensity: 0.92, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 20,
    domesticCupId: 'EGY_CUP', continentalSlots: slots(['CAF_CL', 1, 2]),
    aliases: ['EGY1', 'Egyptian Premier League'],
  },
  {
    id: 'MAR_BOT', name: 'Botola Pro', nameKo: '보톨라 프로', nation: 'MAR', confederation: 'CAF', tier: 1,
    strength: 56, intensity: 0.92, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 16,
    domesticCupId: 'MAR_THRONE_CUP', continentalSlots: slots(['CAF_CL', 1, 2]),
    aliases: ['MAR1', 'Botola', 'Botola Pro Inwi'],
  },
  {
    id: 'ALG_L1', name: 'Ligue Professionnelle 1', nameKo: '알제리 리그 1', nation: 'ALG', confederation: 'CAF', tier: 1,
    strength: 54, intensity: 0.92, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 16,
    domesticCupId: 'ALG_CUP', continentalSlots: slots(['CAF_CL', 1, 2]),
    aliases: ['ALG1', 'Ligue 1 Mobilis'],
  },
  {
    id: 'RSA_PSL', name: 'Betway Premiership', nameKo: '남아공 프리미어십', nation: 'RSA', confederation: 'CAF', tier: 1,
    strength: 55, intensity: 0.92, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0, teamCount: 16,
    domesticCupId: 'RSA_NEDBANK_CUP', continentalSlots: slots(['CAF_CL', 1, 2]),
    aliases: ['RSA1', 'PSL', 'DStv Premiership', 'South African Premiership'],
  },
];

/** 전체 리그 슬롯 (구단 데이터 유무와 무관) */
export const LEAGUE_SLOTS: Record<string, LeagueDefinition> = Object.fromEntries(list.map((league) => [league.id, league]));
