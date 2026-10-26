/**
 * 국가 인접성 — 이적·임대 지역성 가중치용
 *
 * 국경을 맞대거나 축구 시장이 밀접한 나라끼리 묶는다 (예: 잉글랜드–스코틀랜드, 스페인–포르투갈,
 * 걸프 국가들, 북아프리카). 한쪽만 적어도 양방향으로 처리된다.
 */
import type { NationCode } from '@/types/game';

const ADJACENT: Record<string, readonly string[]> = {
  // 유럽
  ENG: ['SCO', 'FRA', 'NED', 'BEL'],
  SCO: ['ENG'],
  ESP: ['POR', 'FRA'],
  POR: ['ESP'],
  FRA: ['BEL', 'SUI', 'GER', 'ITA'],
  ITA: ['SUI', 'AUT', 'CRO'],
  GER: ['NED', 'BEL', 'SUI', 'AUT', 'CZE', 'POL', 'DEN'],
  NED: ['BEL'],
  SUI: ['AUT'],
  AUT: ['CZE', 'HUN', 'CRO'],
  CZE: ['POL', 'HUN'],
  POL: ['UKR'],
  HUN: ['CRO', 'SRB', 'UKR'],
  CRO: ['SRB'],
  SRB: ['GRE'],
  GRE: ['TUR'],
  DEN: ['NOR', 'SWE'],
  NOR: ['SWE'],
  // 아시아 · 오세아니아
  KOR: ['JPN', 'CHN'],
  JPN: ['CHN'],
  CHN: ['THA'],
  THA: ['AUS'],
  AUS: ['NZL'],
  KSA: ['QAT', 'UAE', 'IRN'],
  QAT: ['UAE', 'IRN'],
  UAE: ['IRN'],
  IRN: ['UZB'],
  // 아메리카
  USA: ['CAN', 'MEX'],
  MEX: ['PAN', 'CRC', 'JAM'],
  BRA: ['ARG', 'URU', 'PAR', 'COL'],
  ARG: ['CHI', 'URU', 'PAR'],
  CHI: ['PER'],
  COL: ['ECU', 'PER'],
  // 아프리카
  EGY: ['MAR', 'ALG', 'TUN'],
  MAR: ['ALG', 'TUN'],
  ALG: ['TUN'],
  NGA: ['GHA', 'CMR', 'CIV'],
  SEN: ['CIV'],
};

const NEIGHBORS: Record<string, Set<string>> = {};
for (const [a, list] of Object.entries(ADJACENT)) {
  for (const b of list) {
    (NEIGHBORS[a] ??= new Set()).add(b);
    (NEIGHBORS[b] ??= new Set()).add(a);
  }
}

export function areNeighbors(a: NationCode, b: NationCode): boolean {
  return NEIGHBORS[a]?.has(b) ?? false;
}
