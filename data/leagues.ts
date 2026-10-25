/**
 * 리그 정의 — 샘플
 * - 승강제: 잉글랜드·스페인·한국 1, 2부
 * - 자본 리그: 사우디 프로리그, MLS (명성이 낮아도 재정으로 고연봉 오퍼)
 * 나머지 리그는 같은 형식으로 추가한다. 모든 리그는 추춘제로 통일한다.
 */
import type { LeagueDefinition } from '@/types/game';

const list: LeagueDefinition[] = [
  {
    id: 'ENG_PL', name: 'Premier League', nameKo: '프리미어리그', nation: 'ENG', confederation: 'UEFA', tier: 1,
    strength: 78, intensity: 1.15, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 3,
    lowerLeagueId: 'ENG_CH', domesticCupId: 'ENG_FA_CUP',
    continentalSlots: [
      { competitionId: 'UEFA_CL', fromPosition: 1, toPosition: 4 },
      { competitionId: 'UEFA_EL', fromPosition: 5, toPosition: 5 },
      { competitionId: 'UEFA_ECL', fromPosition: 6, toPosition: 6 },
    ],
  },
  {
    id: 'ENG_CH', name: 'EFL Championship', nameKo: '챔피언십', nation: 'ENG', confederation: 'UEFA', tier: 2,
    strength: 68, intensity: 1.12, roundRobinCycles: 2, promotionSlots: 3, relegationSlots: 0,
    upperLeagueId: 'ENG_PL', domesticCupId: 'ENG_FA_CUP', continentalSlots: [],
  },
  {
    id: 'ESP_LALIGA', name: 'LaLiga', nameKo: '라리가', nation: 'ESP', confederation: 'UEFA', tier: 1,
    strength: 76, intensity: 1.08, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 3,
    lowerLeagueId: 'ESP_L2', domesticCupId: 'ESP_COPA_DEL_REY',
    continentalSlots: [
      { competitionId: 'UEFA_CL', fromPosition: 1, toPosition: 4 },
      { competitionId: 'UEFA_EL', fromPosition: 5, toPosition: 6 },
      { competitionId: 'UEFA_ECL', fromPosition: 7, toPosition: 7 },
    ],
  },
  {
    id: 'ESP_L2', name: 'LaLiga Hypermotion', nameKo: '라리가2', nation: 'ESP', confederation: 'UEFA', tier: 2,
    strength: 64, intensity: 1.0, roundRobinCycles: 2, promotionSlots: 3, relegationSlots: 0,
    upperLeagueId: 'ESP_LALIGA', domesticCupId: 'ESP_COPA_DEL_REY', continentalSlots: [],
  },
  {
    id: 'KOR_K1', name: 'K League 1', nameKo: 'K리그1', nation: 'KOR', confederation: 'AFC', tier: 1,
    strength: 64, intensity: 0.95, roundRobinCycles: 3, promotionSlots: 0, relegationSlots: 1,
    lowerLeagueId: 'KOR_K2', domesticCupId: 'KOR_FA_CUP',
    continentalSlots: [{ competitionId: 'AFC_CL', fromPosition: 1, toPosition: 3 }],
  },
  {
    id: 'KOR_K2', name: 'K League 2', nameKo: 'K리그2', nation: 'KOR', confederation: 'AFC', tier: 2,
    strength: 57, intensity: 0.92, roundRobinCycles: 3, promotionSlots: 1, relegationSlots: 0,
    upperLeagueId: 'KOR_K1', domesticCupId: 'KOR_FA_CUP', continentalSlots: [],
  },
  {
    id: 'KSA_SPL', name: 'Saudi Pro League', nameKo: '사우디 프로리그', nation: 'KSA', confederation: 'AFC', tier: 1,
    strength: 67, intensity: 0.9, roundRobinCycles: 2, promotionSlots: 0, relegationSlots: 0,
    domesticCupId: 'KSA_KINGS_CUP', moneyLeague: true,
    continentalSlots: [{ competitionId: 'AFC_CL', fromPosition: 1, toPosition: 3 }],
  },
  {
    id: 'USA_MLS', name: 'Major League Soccer', nameKo: 'MLS', nation: 'USA', confederation: 'CONCACAF', tier: 1,
    strength: 66, intensity: 0.95, roundRobinCycles: 1, promotionSlots: 0, relegationSlots: 0,
    domesticCupId: 'USA_OPEN_CUP', moneyLeague: true,
    continentalSlots: [{ competitionId: 'CONCACAF_CC', fromPosition: 1, toPosition: 4 }],
  },
];

export const LEAGUES: Record<string, LeagueDefinition> = Object.fromEntries(
  list.map((league) => [league.id, league]),
);
