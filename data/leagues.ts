/**
 * 리그 정의 — 샘플 (EPL, 라리가, K리그1)
 * 나머지 리그(5대 리그 2부, 유럽·아시아·아메리카·아프리카 1부)는 같은 형식으로 추가한다.
 * 모든 리그는 추춘제로 통일한다.
 */
import type { LeagueDefinition } from '@/types/game';

const list: LeagueDefinition[] = [
  {
    id: 'ENG_PL',
    name: 'Premier League',
    nameKo: '프리미어리그',
    nation: 'ENG',
    confederation: 'UEFA',
    tier: 1,
    strength: 78,
    intensity: 1.15,
    roundRobinCycles: 2,
    promotionSlots: 0,
    relegationSlots: 3,
    domesticCupId: 'ENG_FA_CUP',
    continentalSlots: [
      { competitionId: 'UEFA_CL', fromPosition: 1, toPosition: 4 },
      { competitionId: 'UEFA_EL', fromPosition: 5, toPosition: 5 },
      { competitionId: 'UEFA_ECL', fromPosition: 6, toPosition: 6 },
    ],
  },
  {
    id: 'ESP_LALIGA',
    name: 'LaLiga',
    nameKo: '라리가',
    nation: 'ESP',
    confederation: 'UEFA',
    tier: 1,
    strength: 76,
    intensity: 1.08,
    roundRobinCycles: 2,
    promotionSlots: 0,
    relegationSlots: 3,
    domesticCupId: 'ESP_COPA_DEL_REY',
    continentalSlots: [
      { competitionId: 'UEFA_CL', fromPosition: 1, toPosition: 4 },
      { competitionId: 'UEFA_EL', fromPosition: 5, toPosition: 6 },
      { competitionId: 'UEFA_ECL', fromPosition: 7, toPosition: 7 },
    ],
  },
  {
    id: 'KOR_K1',
    name: 'K League 1',
    nameKo: 'K리그1',
    nation: 'KOR',
    confederation: 'AFC',
    tier: 1,
    strength: 64,
    intensity: 0.95,
    roundRobinCycles: 3,
    promotionSlots: 0,
    relegationSlots: 1,
    domesticCupId: 'KOR_FA_CUP',
    continentalSlots: [{ competitionId: 'AFC_CL', fromPosition: 1, toPosition: 3 }],
  },
];

export const LEAGUES: Record<string, LeagueDefinition> = Object.fromEntries(
  list.map((league) => [league.id, league]),
);
