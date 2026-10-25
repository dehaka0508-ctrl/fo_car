/**
 * 국가(대표팀) 데이터 — 샘플
 * power는 구단 실력과 같은 스케일 (해당 국가 대표팀 주전의 평균 수준).
 */
import type { NationDefinition } from '@/types/game';

const list: NationDefinition[] = [
  // ----- AFC -----
  { code: 'KOR', name: 'South Korea', nameKo: '대한민국', confederation: 'AFC', power: 76 },
  { code: 'JPN', name: 'Japan', nameKo: '일본', confederation: 'AFC', power: 79 },
  { code: 'AUS', name: 'Australia', nameKo: '호주', confederation: 'AFC', power: 73 },
  { code: 'IRN', name: 'Iran', nameKo: '이란', confederation: 'AFC', power: 74 },
  { code: 'KSA', name: 'Saudi Arabia', nameKo: '사우디아라비아', confederation: 'AFC', power: 70 },
  { code: 'QAT', name: 'Qatar', nameKo: '카타르', confederation: 'AFC', power: 68 },
  { code: 'UAE', name: 'United Arab Emirates', nameKo: '아랍에미리트', confederation: 'AFC', power: 66 },
  { code: 'UZB', name: 'Uzbekistan', nameKo: '우즈베키스탄', confederation: 'AFC', power: 70 },
  { code: 'CHN', name: 'China', nameKo: '중국', confederation: 'AFC', power: 62 },
  { code: 'THA', name: 'Thailand', nameKo: '태국', confederation: 'AFC', power: 60 },
  // ----- UEFA -----
  { code: 'ESP', name: 'Spain', nameKo: '스페인', confederation: 'UEFA', power: 89 },
  { code: 'FRA', name: 'France', nameKo: '프랑스', confederation: 'UEFA', power: 88 },
  { code: 'ENG', name: 'England', nameKo: '잉글랜드', confederation: 'UEFA', power: 87 },
  { code: 'POR', name: 'Portugal', nameKo: '포르투갈', confederation: 'UEFA', power: 86 },
  { code: 'GER', name: 'Germany', nameKo: '독일', confederation: 'UEFA', power: 85 },
  { code: 'NED', name: 'Netherlands', nameKo: '네덜란드', confederation: 'UEFA', power: 84 },
  { code: 'ITA', name: 'Italy', nameKo: '이탈리아', confederation: 'UEFA', power: 83 },
  { code: 'BEL', name: 'Belgium', nameKo: '벨기에', confederation: 'UEFA', power: 82 },
  { code: 'CRO', name: 'Croatia', nameKo: '크로아티아', confederation: 'UEFA', power: 81 },
  { code: 'SUI', name: 'Switzerland', nameKo: '스위스', confederation: 'UEFA', power: 79 },
  { code: 'DEN', name: 'Denmark', nameKo: '덴마크', confederation: 'UEFA', power: 79 },
  { code: 'AUT', name: 'Austria', nameKo: '오스트리아', confederation: 'UEFA', power: 79 },
  { code: 'NOR', name: 'Norway', nameKo: '노르웨이', confederation: 'UEFA', power: 79 },
  { code: 'TUR', name: 'Türkiye', nameKo: '튀르키예', confederation: 'UEFA', power: 78 },
  { code: 'POL', name: 'Poland', nameKo: '폴란드', confederation: 'UEFA', power: 76 },
  { code: 'UKR', name: 'Ukraine', nameKo: '우크라이나', confederation: 'UEFA', power: 76 },
  { code: 'SWE', name: 'Sweden', nameKo: '스웨덴', confederation: 'UEFA', power: 76 },
  { code: 'SRB', name: 'Serbia', nameKo: '세르비아', confederation: 'UEFA', power: 76 },
  { code: 'CZE', name: 'Czechia', nameKo: '체코', confederation: 'UEFA', power: 75 },
  { code: 'HUN', name: 'Hungary', nameKo: '헝가리', confederation: 'UEFA', power: 75 },
  { code: 'SCO', name: 'Scotland', nameKo: '스코틀랜드', confederation: 'UEFA', power: 74 },
  { code: 'GRE', name: 'Greece', nameKo: '그리스', confederation: 'UEFA', power: 74 },
  // ----- CONMEBOL -----
  { code: 'ARG', name: 'Argentina', nameKo: '아르헨티나', confederation: 'CONMEBOL', power: 88 },
  { code: 'BRA', name: 'Brazil', nameKo: '브라질', confederation: 'CONMEBOL', power: 86 },
  { code: 'URU', name: 'Uruguay', nameKo: '우루과이', confederation: 'CONMEBOL', power: 82 },
  { code: 'COL', name: 'Colombia', nameKo: '콜롬비아', confederation: 'CONMEBOL', power: 81 },
  { code: 'ECU', name: 'Ecuador', nameKo: '에콰도르', confederation: 'CONMEBOL', power: 79 },
  { code: 'PAR', name: 'Paraguay', nameKo: '파라과이', confederation: 'CONMEBOL', power: 76 },
  { code: 'CHI', name: 'Chile', nameKo: '칠레', confederation: 'CONMEBOL', power: 74 },
  { code: 'PER', name: 'Peru', nameKo: '페루', confederation: 'CONMEBOL', power: 73 },
  // ----- CONCACAF -----
  { code: 'USA', name: 'United States', nameKo: '미국', confederation: 'CONCACAF', power: 78 },
  { code: 'MEX', name: 'Mexico', nameKo: '멕시코', confederation: 'CONCACAF', power: 78 },
  { code: 'CAN', name: 'Canada', nameKo: '캐나다', confederation: 'CONCACAF', power: 76 },
  { code: 'PAN', name: 'Panama', nameKo: '파나마', confederation: 'CONCACAF', power: 71 },
  { code: 'CRC', name: 'Costa Rica', nameKo: '코스타리카', confederation: 'CONCACAF', power: 70 },
  { code: 'JAM', name: 'Jamaica', nameKo: '자메이카', confederation: 'CONCACAF', power: 68 },
  // ----- CAF -----
  { code: 'MAR', name: 'Morocco', nameKo: '모로코', confederation: 'CAF', power: 81 },
  { code: 'SEN', name: 'Senegal', nameKo: '세네갈', confederation: 'CAF', power: 80 },
  { code: 'NGA', name: 'Nigeria', nameKo: '나이지리아', confederation: 'CAF', power: 77 },
  { code: 'CIV', name: "Côte d'Ivoire", nameKo: '코트디부아르', confederation: 'CAF', power: 77 },
  { code: 'EGY', name: 'Egypt', nameKo: '이집트', confederation: 'CAF', power: 76 },
  { code: 'ALG', name: 'Algeria', nameKo: '알제리', confederation: 'CAF', power: 75 },
  { code: 'CMR', name: 'Cameroon', nameKo: '카메룬', confederation: 'CAF', power: 75 },
  { code: 'GHA', name: 'Ghana', nameKo: '가나', confederation: 'CAF', power: 74 },
  { code: 'TUN', name: 'Tunisia', nameKo: '튀니지', confederation: 'CAF', power: 73 },
  { code: 'RSA', name: 'South Africa', nameKo: '남아프리카공화국', confederation: 'CAF', power: 72 },
  // ----- OFC -----
  { code: 'NZL', name: 'New Zealand', nameKo: '뉴질랜드', confederation: 'OFC', power: 66 },
];

export const NATIONS: Record<string, NationDefinition> = Object.fromEntries(
  list.map((nation) => [nation.code, nation]),
);
