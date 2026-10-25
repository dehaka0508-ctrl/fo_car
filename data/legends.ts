/**
 * 실존 레전드 · 역대 기록 — 샘플
 *
 * - CLUB_LEGENDS: 레전드 헌액 헌사에서 동 포지션 레전드와 나란히 언급할 때 사용
 * - HISTORIC_RECORDS: 기록 경신 팝업에서 기존 보유자와 비교할 때 사용
 * 현역 선수가 계속 갱신 중인 기록은 넣지 않았다 (데이터 시점에 따라 틀려지므로).
 * 데이터가 없는 구단은 헌사의 레전드 언급과 구단 기록 비교를 생략한다.
 */
import type { ClubLegend, HistoricRecord } from '@/types/game';

export const CLUB_LEGENDS: Record<string, ClubLegend[]> = {
  arsenal: [
    { name: '티에리 앙리', position: 'ST', nationality: 'FRA', era: '1999–2007' },
    { name: '데니스 베르흐캄프', position: 'AM', nationality: 'NED', era: '1995–2006' },
    { name: '파트리크 비에이라', position: 'CM', nationality: 'FRA', era: '1996–2005' },
    { name: '토니 애덤스', position: 'CB', nationality: 'ENG', era: '1983–2002' },
    { name: '데이비드 시먼', position: 'GK', nationality: 'ENG', era: '1990–2003' },
  ],
  liverpool: [
    { name: '스티븐 제라드', position: 'CM', nationality: 'ENG', era: '1998–2015' },
    { name: '이언 러시', position: 'ST', era: '1980–1996' },
    { name: '케니 달글리시', position: 'AM', nationality: 'SCO', era: '1977–1990' },
    { name: '존 반스', position: 'LW', nationality: 'ENG', era: '1987–1997' },
    { name: '제이미 캐러거', position: 'CB', nationality: 'ENG', era: '1996–2013' },
    { name: '레이 클레멘스', position: 'GK', nationality: 'ENG', era: '1967–1981' },
  ],
  'man-utd': [
    { name: '라이언 긱스', position: 'LW', era: '1990–2014' },
    { name: '데이비드 베컴', position: 'RW', nationality: 'ENG', era: '1992–2003' },
    { name: '웨인 루니', position: 'ST', nationality: 'ENG', era: '2004–2017' },
    { name: '에리크 칸토나', position: 'AM', nationality: 'FRA', era: '1992–1997' },
    { name: '폴 스콜스', position: 'CM', nationality: 'ENG', era: '1993–2013' },
    { name: '게리 네빌', position: 'RB', nationality: 'ENG', era: '1992–2011' },
    { name: '리오 퍼디낸드', position: 'CB', nationality: 'ENG', era: '2002–2014' },
    { name: '페테르 슈마이켈', position: 'GK', nationality: 'DEN', era: '1991–1999' },
  ],
  'man-city': [
    { name: '세르히오 아구에로', position: 'ST', nationality: 'ARG', era: '2011–2021' },
    { name: '다비드 실바', position: 'AM', nationality: 'ESP', era: '2010–2020' },
    { name: '케빈 더브라위너', position: 'CM', nationality: 'BEL', era: '2015–2025' },
    { name: '페르난지뉴', position: 'DM', nationality: 'BRA', era: '2013–2022' },
    { name: '뱅상 콩파니', position: 'CB', nationality: 'BEL', era: '2008–2019' },
  ],
  chelsea: [
    { name: '디디에 드로그바', position: 'ST', nationality: 'CIV', era: '2004–2012' },
    { name: '잔프랑코 졸라', position: 'AM', nationality: 'ITA', era: '1996–2003' },
    { name: '프랭크 램퍼드', position: 'CM', nationality: 'ENG', era: '2001–2014' },
    { name: '애슐리 콜', position: 'LB', nationality: 'ENG', era: '2006–2014' },
    { name: '존 테리', position: 'CB', nationality: 'ENG', era: '1998–2017' },
    { name: '페트르 체흐', position: 'GK', nationality: 'CZE', era: '2004–2015' },
  ],
  tottenham: [
    { name: '해리 케인', position: 'ST', nationality: 'ENG', era: '2009–2023' },
    { name: '지미 그리브스', position: 'ST', nationality: 'ENG', era: '1961–1970' },
    { name: '손흥민', position: 'LW', nationality: 'KOR', era: '2015–2025' },
    { name: '글렌 호들', position: 'AM', nationality: 'ENG', era: '1975–1987' },
    { name: '레들리 킹', position: 'CB', nationality: 'ENG', era: '1998–2012' },
  ],
  newcastle: [
    { name: '앨런 시어러', position: 'ST', nationality: 'ENG', era: '1996–2006' },
    { name: '재키 밀번', position: 'ST', nationality: 'ENG', era: '1943–1957' },
  ],
  everton: [
    { name: '딕시 딘', position: 'ST', nationality: 'ENG', era: '1925–1937' },
    { name: '네빌 사우솔', position: 'GK', era: '1981–1997' },
  ],
  'west-ham': [
    { name: '바비 무어', position: 'CB', nationality: 'ENG', era: '1958–1974' },
    { name: '빌리 본즈', position: 'CM', nationality: 'ENG', era: '1967–1988' },
    { name: '마크 노블', position: 'CM', nationality: 'ENG', era: '2004–2022' },
  ],
  leeds: [{ name: '빌리 브렘너', position: 'CM', nationality: 'SCO', era: '1959–1976' }],
  'real-madrid': [
    { name: '알프레도 디 스테파노', position: 'ST', era: '1953–1964' },
    { name: '라울 곤살레스', position: 'ST', nationality: 'ESP', era: '1994–2010' },
    { name: '크리스티아누 호날두', position: 'LW', nationality: 'POR', era: '2009–2018' },
    { name: '지네딘 지단', position: 'AM', nationality: 'FRA', era: '2001–2006' },
    { name: '루카 모드리치', position: 'CM', nationality: 'CRO', era: '2012–2025' },
    { name: '호베르투 카를루스', position: 'LB', nationality: 'BRA', era: '1996–2007' },
    { name: '세르히오 라모스', position: 'CB', nationality: 'ESP', era: '2005–2021' },
    { name: '이케르 카시야스', position: 'GK', nationality: 'ESP', era: '1999–2015' },
  ],
  barcelona: [
    { name: '리오넬 메시', position: 'RW', nationality: 'ARG', era: '2004–2021' },
    { name: '요한 크루이프', position: 'AM', nationality: 'NED', era: '1973–1978' },
    { name: '사비 에르난데스', position: 'CM', nationality: 'ESP', era: '1998–2015' },
    { name: '안드레스 이니에스타', position: 'CM', nationality: 'ESP', era: '2002–2018' },
    { name: '세르히오 부스케츠', position: 'DM', nationality: 'ESP', era: '2008–2023' },
    { name: '다니 아우베스', position: 'RB', nationality: 'BRA', era: '2008–2016' },
    { name: '카를레스 푸욜', position: 'CB', nationality: 'ESP', era: '1999–2014' },
  ],
  'atletico-madrid': [
    { name: '루이스 아라고네스', position: 'ST', nationality: 'ESP', era: '1964–1974' },
    { name: '페르난도 토레스', position: 'ST', nationality: 'ESP', era: '2001–2007, 2015–2018' },
  ],
  'athletic-club': [
    { name: '텔모 사라', position: 'ST', nationality: 'ESP', era: '1940–1955' },
    { name: '호세 앙헬 이리바르', position: 'GK', nationality: 'ESP', era: '1962–1980' },
  ],
  valencia: [
    { name: '마리오 켐페스', position: 'ST', nationality: 'ARG', era: '1976–1981' },
    { name: '다비드 비야', position: 'ST', nationality: 'ESP', era: '2005–2010' },
    { name: '다비드 알벨다', position: 'DM', nationality: 'ESP', era: '1997–2013' },
  ],
  sevilla: [{ name: '헤수스 나바스', position: 'RB', nationality: 'ESP', era: '2003–2013, 2017–2024' }],
  villarreal: [
    { name: '후안 로만 리켈메', position: 'AM', nationality: 'ARG', era: '2003–2007' },
    { name: '마르코스 세나', position: 'DM', nationality: 'ESP', era: '2002–2013' },
  ],
  'real-sociedad': [{ name: '루이스 아르코나다', position: 'GK', nationality: 'ESP', era: '1974–1989' }],
  jeonbuk: [{ name: '이동국', position: 'ST', nationality: 'KOR', era: '2009–2020' }],
  pohang: [
    { name: '황선홍', position: 'ST', nationality: 'KOR', era: '1993–1998' },
    { name: '홍명보', position: 'CB', nationality: 'KOR', era: '1992–1997' },
  ],
  'fc-seoul': [{ name: '데얀 다먀노비치', position: 'ST', era: '2008–2013, 2016–2017' }],
  'suwon-samsung': [
    { name: '염기훈', position: 'LW', nationality: 'KOR', era: '2010–2023' },
    { name: '서정원', position: 'RW', nationality: 'KOR', era: '1999–2004' },
  ],
  'al-hilal': [{ name: '사미 알자베르', position: 'ST', nationality: 'KSA', era: '1988–2008' }],
  'al-nassr': [{ name: '마지드 압둘라', position: 'ST', nationality: 'KSA', era: '1977–1998' }],
  'la-galaxy': [
    { name: '랜던 도너번', position: 'AM', nationality: 'USA', era: '2005–2016' },
    { name: '데이비드 베컴', position: 'CM', nationality: 'ENG', era: '2007–2012' },
  ],
};

const club = (scopeId: string, category: HistoricRecord['category'], holderName: string, value: number): HistoricRecord => ({
  scope: 'CLUB',
  scopeId,
  category,
  holderName,
  value,
});
const league = (scopeId: string, category: HistoricRecord['category'], holderName: string, value: number): HistoricRecord => ({
  scope: 'LEAGUE',
  scopeId,
  category,
  holderName,
  value,
});
const national = (scopeId: string, category: HistoricRecord['category'], holderName: string, value: number): HistoricRecord => ({
  scope: 'NATIONAL_TEAM',
  scopeId,
  category,
  holderName,
  value,
});

/** 공식전 통산 기준 (국가대표는 A매치) */
export const HISTORIC_RECORDS: HistoricRecord[] = [
  // ----- 구단 최다 득점 -----
  club('arsenal', 'GOALS', '티에리 앙리', 228),
  club('liverpool', 'GOALS', '이언 러시', 346),
  club('man-utd', 'GOALS', '웨인 루니', 253),
  club('man-city', 'GOALS', '세르히오 아구에로', 260),
  club('chelsea', 'GOALS', '프랭크 램퍼드', 211),
  club('tottenham', 'GOALS', '해리 케인', 280),
  club('newcastle', 'GOALS', '앨런 시어러', 206),
  club('everton', 'GOALS', '딕시 딘', 383),
  club('aston-villa', 'GOALS', '빌리 워커', 244),
  club('west-ham', 'GOALS', '빅 왓슨', 326),
  club('real-madrid', 'GOALS', '크리스티아누 호날두', 450),
  club('barcelona', 'GOALS', '리오넬 메시', 672),
  club('athletic-club', 'GOALS', '텔모 사라', 335),
  // ----- 구단 최다 출전 -----
  club('arsenal', 'APPEARANCES', '데이비드 오리어리', 722),
  club('liverpool', 'APPEARANCES', '이언 캘러헌', 857),
  club('man-utd', 'APPEARANCES', '라이언 긱스', 963),
  club('man-city', 'APPEARANCES', '앨런 오크스', 680),
  club('chelsea', 'APPEARANCES', '론 해리스', 795),
  club('tottenham', 'APPEARANCES', '스티브 페리먼', 854),
  club('newcastle', 'APPEARANCES', '지미 로런스', 496),
  club('everton', 'APPEARANCES', '네빌 사우솔', 751),
  club('aston-villa', 'APPEARANCES', '찰리 에이트컨', 660),
  club('west-ham', 'APPEARANCES', '빌리 본즈', 799),
  club('real-madrid', 'APPEARANCES', '라울 곤살레스', 741),
  club('barcelona', 'APPEARANCES', '리오넬 메시', 778),
  club('athletic-club', 'APPEARANCES', '호세 앙헬 이리바르', 614),
  // ----- 리그 통산 -----
  league('ENG_PL', 'GOALS', '앨런 시어러', 260),
  league('ENG_PL', 'ASSISTS', '라이언 긱스', 162),
  league('ENG_PL', 'CLEAN_SHEETS', '페트르 체흐', 202),
  league('ESP_LALIGA', 'GOALS', '리오넬 메시', 474),
  league('ESP_LALIGA', 'APPEARANCES', '안도니 수비사레타', 622),
  league('KOR_K1', 'GOALS', '이동국', 228),
  league('KOR_K1', 'APPEARANCES', '김병지', 706),
  league('KOR_K1', 'ASSISTS', '염기훈', 110),
  league('KOR_K1', 'CLEAN_SHEETS', '김병지', 229),
  // ----- 국가대표 통산 -----
  national('KOR', 'GOALS', '차범근', 58),
  national('ENG', 'APPEARANCES', '피터 실턴', 125),
  national('ESP', 'GOALS', '다비드 비야', 59),
  national('ESP', 'APPEARANCES', '세르히오 라모스', 180),
  national('FRA', 'GOALS', '올리비에 지루', 57),
  national('FRA', 'APPEARANCES', '위고 요리스', 145),
  national('GER', 'GOALS', '미로슬라프 클로제', 71),
  national('GER', 'APPEARANCES', '로타어 마테우스', 150),
  national('ITA', 'GOALS', '루이지 리바', 35),
  national('ITA', 'APPEARANCES', '잔루이지 부폰', 176),
  national('NED', 'APPEARANCES', '베슬리 스네이더르', 134),
  national('JPN', 'APPEARANCES', '엔도 야스히토', 152),
  national('BRA', 'APPEARANCES', '카푸', 142),
];
