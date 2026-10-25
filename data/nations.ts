/**
 * 국가(대표팀) 데이터 — 샘플
 * power는 구단 실력과 같은 스케일 (해당 국가 대표팀 주전의 평균 수준).
 * kitColors: 국가대표 유니폼 (secondary가 있으면 세로 줄무늬).
 */
import type { NationDefinition } from '@/types/game';

const list: NationDefinition[] = [
  // ----- AFC -----
  { code: 'KOR', name: 'South Korea', nameKo: '대한민국', confederation: 'AFC', power: 76, kitColors: { primary: '#C8102E', secondary: null } },
  { code: 'JPN', name: 'Japan', nameKo: '일본', confederation: 'AFC', power: 79, kitColors: { primary: '#0A2A8C', secondary: null } },
  { code: 'AUS', name: 'Australia', nameKo: '호주', confederation: 'AFC', power: 73, kitColors: { primary: '#FFCD00', secondary: null } },
  { code: 'IRN', name: 'Iran', nameKo: '이란', confederation: 'AFC', power: 74, kitColors: { primary: '#FFFFFF', secondary: null } },
  { code: 'KSA', name: 'Saudi Arabia', nameKo: '사우디아라비아', confederation: 'AFC', power: 70, kitColors: { primary: '#006C35', secondary: null } },
  { code: 'QAT', name: 'Qatar', nameKo: '카타르', confederation: 'AFC', power: 68, kitColors: { primary: '#8A1538', secondary: null } },
  { code: 'UAE', name: 'United Arab Emirates', nameKo: '아랍에미리트', confederation: 'AFC', power: 66, kitColors: { primary: '#FFFFFF', secondary: null } },
  { code: 'UZB', name: 'Uzbekistan', nameKo: '우즈베키스탄', confederation: 'AFC', power: 70, kitColors: { primary: '#FFFFFF', secondary: null } },
  { code: 'CHN', name: 'China', nameKo: '중국', confederation: 'AFC', power: 62, kitColors: { primary: '#DE2910', secondary: null } },
  { code: 'THA', name: 'Thailand', nameKo: '태국', confederation: 'AFC', power: 60, kitColors: { primary: '#1A3E8C', secondary: null } },
  // ----- UEFA -----
  { code: 'ESP', name: 'Spain', nameKo: '스페인', confederation: 'UEFA', power: 89, kitColors: { primary: '#C60B1E', secondary: null } },
  { code: 'FRA', name: 'France', nameKo: '프랑스', confederation: 'UEFA', power: 88, kitColors: { primary: '#1F3A93', secondary: null } },
  { code: 'ENG', name: 'England', nameKo: '잉글랜드', confederation: 'UEFA', power: 87, kitColors: { primary: '#FFFFFF', secondary: null } },
  { code: 'POR', name: 'Portugal', nameKo: '포르투갈', confederation: 'UEFA', power: 86, kitColors: { primary: '#C8102E', secondary: null } },
  { code: 'GER', name: 'Germany', nameKo: '독일', confederation: 'UEFA', power: 85, kitColors: { primary: '#FFFFFF', secondary: null } },
  { code: 'NED', name: 'Netherlands', nameKo: '네덜란드', confederation: 'UEFA', power: 84, kitColors: { primary: '#F36C21', secondary: null } },
  { code: 'ITA', name: 'Italy', nameKo: '이탈리아', confederation: 'UEFA', power: 83, kitColors: { primary: '#0066CC', secondary: null } },
  { code: 'BEL', name: 'Belgium', nameKo: '벨기에', confederation: 'UEFA', power: 82, kitColors: { primary: '#E30613', secondary: null } },
  { code: 'CRO', name: 'Croatia', nameKo: '크로아티아', confederation: 'UEFA', power: 81, kitColors: { primary: '#FFFFFF', secondary: '#E30613' } },
  { code: 'SUI', name: 'Switzerland', nameKo: '스위스', confederation: 'UEFA', power: 79, kitColors: { primary: '#D52B1E', secondary: null } },
  { code: 'DEN', name: 'Denmark', nameKo: '덴마크', confederation: 'UEFA', power: 79, kitColors: { primary: '#C8102E', secondary: null } },
  { code: 'AUT', name: 'Austria', nameKo: '오스트리아', confederation: 'UEFA', power: 79, kitColors: { primary: '#ED2939', secondary: null } },
  { code: 'NOR', name: 'Norway', nameKo: '노르웨이', confederation: 'UEFA', power: 79, kitColors: { primary: '#BA0C2F', secondary: null } },
  { code: 'TUR', name: 'Türkiye', nameKo: '튀르키예', confederation: 'UEFA', power: 78, kitColors: { primary: '#E30A17', secondary: null } },
  { code: 'POL', name: 'Poland', nameKo: '폴란드', confederation: 'UEFA', power: 76, kitColors: { primary: '#FFFFFF', secondary: null } },
  { code: 'UKR', name: 'Ukraine', nameKo: '우크라이나', confederation: 'UEFA', power: 76, kitColors: { primary: '#FFD500', secondary: null } },
  { code: 'SWE', name: 'Sweden', nameKo: '스웨덴', confederation: 'UEFA', power: 76, kitColors: { primary: '#FECC00', secondary: null } },
  { code: 'SRB', name: 'Serbia', nameKo: '세르비아', confederation: 'UEFA', power: 76, kitColors: { primary: '#C6363C', secondary: null } },
  { code: 'CZE', name: 'Czechia', nameKo: '체코', confederation: 'UEFA', power: 75, kitColors: { primary: '#D7141A', secondary: null } },
  { code: 'HUN', name: 'Hungary', nameKo: '헝가리', confederation: 'UEFA', power: 75, kitColors: { primary: '#CE2939', secondary: null } },
  { code: 'SCO', name: 'Scotland', nameKo: '스코틀랜드', confederation: 'UEFA', power: 74, kitColors: { primary: '#1C2C5B', secondary: null } },
  { code: 'GRE', name: 'Greece', nameKo: '그리스', confederation: 'UEFA', power: 74, kitColors: { primary: '#0D5EAF', secondary: null } },
  // ----- CONMEBOL -----
  { code: 'ARG', name: 'Argentina', nameKo: '아르헨티나', confederation: 'CONMEBOL', power: 88, kitColors: { primary: '#75AADB', secondary: '#FFFFFF' } },
  { code: 'BRA', name: 'Brazil', nameKo: '브라질', confederation: 'CONMEBOL', power: 86, kitColors: { primary: '#FEDD00', secondary: null } },
  { code: 'URU', name: 'Uruguay', nameKo: '우루과이', confederation: 'CONMEBOL', power: 82, kitColors: { primary: '#5CBFEB', secondary: null } },
  { code: 'COL', name: 'Colombia', nameKo: '콜롬비아', confederation: 'CONMEBOL', power: 81, kitColors: { primary: '#FCD116', secondary: null } },
  { code: 'ECU', name: 'Ecuador', nameKo: '에콰도르', confederation: 'CONMEBOL', power: 79, kitColors: { primary: '#FFD100', secondary: null } },
  { code: 'PAR', name: 'Paraguay', nameKo: '파라과이', confederation: 'CONMEBOL', power: 76, kitColors: { primary: '#D52B1E', secondary: '#FFFFFF' } },
  { code: 'CHI', name: 'Chile', nameKo: '칠레', confederation: 'CONMEBOL', power: 74, kitColors: { primary: '#D52B1E', secondary: null } },
  { code: 'PER', name: 'Peru', nameKo: '페루', confederation: 'CONMEBOL', power: 73, kitColors: { primary: '#FFFFFF', secondary: null } },
  // ----- CONCACAF -----
  { code: 'USA', name: 'United States', nameKo: '미국', confederation: 'CONCACAF', power: 78, kitColors: { primary: '#FFFFFF', secondary: null } },
  { code: 'MEX', name: 'Mexico', nameKo: '멕시코', confederation: 'CONCACAF', power: 78, kitColors: { primary: '#006847', secondary: null } },
  { code: 'CAN', name: 'Canada', nameKo: '캐나다', confederation: 'CONCACAF', power: 76, kitColors: { primary: '#D80621', secondary: null } },
  { code: 'PAN', name: 'Panama', nameKo: '파나마', confederation: 'CONCACAF', power: 71, kitColors: { primary: '#DA121A', secondary: null } },
  { code: 'CRC', name: 'Costa Rica', nameKo: '코스타리카', confederation: 'CONCACAF', power: 70, kitColors: { primary: '#CE1126', secondary: null } },
  { code: 'JAM', name: 'Jamaica', nameKo: '자메이카', confederation: 'CONCACAF', power: 68, kitColors: { primary: '#FED100', secondary: null } },
  // ----- CAF -----
  { code: 'MAR', name: 'Morocco', nameKo: '모로코', confederation: 'CAF', power: 81, kitColors: { primary: '#C1272D', secondary: null } },
  { code: 'SEN', name: 'Senegal', nameKo: '세네갈', confederation: 'CAF', power: 80, kitColors: { primary: '#FFFFFF', secondary: null } },
  { code: 'NGA', name: 'Nigeria', nameKo: '나이지리아', confederation: 'CAF', power: 77, kitColors: { primary: '#008751', secondary: null } },
  { code: 'CIV', name: "Côte d'Ivoire", nameKo: '코트디부아르', confederation: 'CAF', power: 77, kitColors: { primary: '#F77F00', secondary: null } },
  { code: 'EGY', name: 'Egypt', nameKo: '이집트', confederation: 'CAF', power: 76, kitColors: { primary: '#CE1126', secondary: null } },
  { code: 'ALG', name: 'Algeria', nameKo: '알제리', confederation: 'CAF', power: 75, kitColors: { primary: '#FFFFFF', secondary: null } },
  { code: 'CMR', name: 'Cameroon', nameKo: '카메룬', confederation: 'CAF', power: 75, kitColors: { primary: '#007A5E', secondary: null } },
  { code: 'GHA', name: 'Ghana', nameKo: '가나', confederation: 'CAF', power: 74, kitColors: { primary: '#FFFFFF', secondary: null } },
  { code: 'TUN', name: 'Tunisia', nameKo: '튀니지', confederation: 'CAF', power: 73, kitColors: { primary: '#E70013', secondary: null } },
  { code: 'RSA', name: 'South Africa', nameKo: '남아프리카공화국', confederation: 'CAF', power: 72, kitColors: { primary: '#FFB81C', secondary: null } },
  // ----- OFC -----
  { code: 'NZL', name: 'New Zealand', nameKo: '뉴질랜드', confederation: 'OFC', power: 66, kitColors: { primary: '#FFFFFF', secondary: null } },
];

export const NATIONS: Record<string, NationDefinition> = Object.fromEntries(
  list.map((nation) => [nation.code, nation]),
);
