/**
 * 구단 데이터 — 샘플 (2025/26 시즌 기준 소속, K리그는 2025 시즌 기준)
 *
 * power / prestige / finance 는 유저에게 보이지 않는 히든 수치의 '초기값'이다.
 * - power: 실제 경기 성적에만 관여 (주전 평균 OVR 스케일)
 * - prestige: 이적·재계약 제의 여부, 보장 출전시간에 영향
 * - finance: 제시 연봉 수준 (사우디·MLS 등 자본 리그는 명성 대비 높다)
 * kitColors.secondary 가 null이면 단색, 있으면 1-2-1-2-1 세로 줄무늬 유니폼이다.
 * (가로 줄무늬·하프 유니폼은 대표색 단색으로 근사)
 */
import type { ClubDefinition } from '@/types/game';

type ClubRow = [
  id: string,
  name: string,
  nameKo: string,
  shortName: string,
  power: number,
  prestige: number,
  finance: number,
  primary: string,
  stripe: string | null,
  rivals: string[],
  options?: { nation?: string; promotionEligible?: boolean },
];

function defineLeague(leagueId: string, nation: string, rows: ClubRow[]): ClubDefinition[] {
  return rows.map(([id, name, nameKo, shortName, power, prestige, finance, primary, stripe, rivals, options]) => ({
    id,
    name,
    nameKo,
    shortName,
    nation: options?.nation ?? nation,
    leagueId,
    power,
    prestige,
    finance,
    kitColors: { primary, secondary: stripe },
    rivals,
    ...(options?.promotionEligible === false ? { promotionEligible: false } : {}),
  }));
}

const W = '#FFFFFF';

// ----- 잉글랜드 -----
const premierLeague = defineLeague('ENG_PL', 'ENG', [
  ['arsenal', 'Arsenal', '아스널', 'ARS', 86, 89, 90, '#EF0107', null, ['tottenham', 'chelsea']],
  ['aston-villa', 'Aston Villa', '애스턴 빌라', 'AVL', 80, 74, 78, '#670E36', null, ['wolves', 'birmingham']],
  ['bournemouth', 'AFC Bournemouth', '본머스', 'BOU', 77, 58, 66, '#DA291C', '#000000', ['southampton']],
  ['brentford', 'Brentford', '브렌트퍼드', 'BRE', 76, 58, 66, '#E30613', W, ['fulham', 'qpr']],
  ['brighton', 'Brighton & Hove Albion', '브라이턴', 'BHA', 78, 66, 72, '#0057B8', W, ['crystal-palace']],
  ['burnley', 'Burnley', '번리', 'BUR', 72, 56, 60, '#6C1D45', null, ['blackburn']],
  ['chelsea', 'Chelsea', '첼시', 'CHE', 83, 88, 92, '#034694', null, ['tottenham', 'arsenal', 'fulham']],
  ['crystal-palace', 'Crystal Palace', '크리스탈 팰리스', 'CRY', 78, 64, 68, '#1B458F', '#C4122E', ['brighton']],
  ['everton', 'Everton', '에버턴', 'EVE', 76, 72, 70, '#003399', null, ['liverpool']],
  ['fulham', 'Fulham', '풀럼', 'FUL', 76, 62, 68, W, null, ['chelsea', 'brentford', 'qpr']],
  ['leeds', 'Leeds United', '리즈 유나이티드', 'LEE', 74, 68, 68, W, null, ['man-utd']],
  ['liverpool', 'Liverpool', '리버풀', 'LIV', 86, 92, 92, '#C8102E', null, ['everton', 'man-utd']],
  ['man-city', 'Manchester City', '맨체스터 시티', 'MCI', 86, 91, 96, '#6CABDD', null, ['man-utd']],
  ['man-utd', 'Manchester United', '맨체스터 유나이티드', 'MUN', 80, 91, 92, '#DA291C', null, ['man-city', 'liverpool', 'leeds']],
  ['newcastle', 'Newcastle United', '뉴캐슬 유나이티드', 'NEW', 81, 78, 90, '#241F20', W, ['sunderland']],
  ['nottingham-forest', 'Nottingham Forest', '노팅엄 포레스트', 'NFO', 77, 66, 70, '#DD0000', null, ['derby', 'leicester']],
  ['sunderland', 'Sunderland', '선덜랜드', 'SUN', 73, 62, 66, '#EB172B', W, ['newcastle', 'middlesbrough']],
  ['tottenham', 'Tottenham Hotspur', '토트넘 홋스퍼', 'TOT', 80, 84, 86, W, null, ['arsenal', 'chelsea', 'west-ham']],
  ['west-ham', 'West Ham United', '웨스트햄 유나이티드', 'WHU', 76, 70, 74, '#7A263A', null, ['tottenham', 'millwall']],
  ['wolves', 'Wolverhampton Wanderers', '울버햄튼', 'WOL', 74, 64, 68, '#FDB913', null, ['aston-villa', 'west-brom']],
]);

const championship = defineLeague('ENG_CH', 'ENG', [
  ['birmingham', 'Birmingham City', '버밍엄 시티', 'BIR', 71, 60, 72, '#0033A0', null, ['aston-villa', 'west-brom', 'coventry']],
  ['blackburn', 'Blackburn Rovers', '블랙번 로버스', 'BLB', 69, 58, 60, '#009EE0', W, ['burnley', 'preston']],
  ['bristol-city', 'Bristol City', '브리스틀 시티', 'BRC', 69, 52, 58, '#E21A23', null, []],
  ['charlton', 'Charlton Athletic', '찰턴 애슬레틱', 'CHA', 67, 52, 52, '#D4021D', null, ['millwall']],
  ['coventry', 'Coventry City', '코번트리 시티', 'COV', 71, 54, 60, '#77B5E5', null, ['birmingham']],
  ['derby', 'Derby County', '더비 카운티', 'DER', 68, 58, 56, W, null, ['nottingham-forest', 'leicester']],
  ['hull', 'Hull City', '헐 시티', 'HUL', 68, 52, 56, '#F5A12D', '#000000', []],
  ['ipswich', 'Ipswich Town', '입스위치 타운', 'IPS', 72, 58, 64, '#0044A9', null, ['norwich']],
  ['leicester', 'Leicester City', '레스터 시티', 'LEI', 73, 68, 68, '#003090', null, ['nottingham-forest', 'derby']],
  ['middlesbrough', 'Middlesbrough', '미들즈브러', 'MID', 70, 56, 60, '#E20E0E', null, ['sunderland']],
  ['millwall', 'Millwall', '밀월', 'MIL', 68, 50, 54, '#001D5E', null, ['charlton', 'west-ham']],
  ['norwich', 'Norwich City', '노리치 시티', 'NOR', 69, 56, 60, '#FFF200', null, ['ipswich']],
  ['oxford', 'Oxford United', '옥스퍼드 유나이티드', 'OXF', 65, 46, 48, '#FFDD00', null, []],
  ['portsmouth', 'Portsmouth', '포츠머스', 'POR', 66, 54, 52, '#001489', null, ['southampton']],
  ['preston', 'Preston North End', '프레스턴 노스엔드', 'PNE', 67, 50, 52, W, null, ['blackburn']],
  ['qpr', 'Queens Park Rangers', '퀸스 파크 레인저스', 'QPR', 67, 54, 56, '#1D5BA4', null, ['fulham', 'brentford']],
  ['sheffield-utd', 'Sheffield United', '셰필드 유나이티드', 'SHU', 71, 58, 60, '#EE2737', W, ['sheffield-wed']],
  ['sheffield-wed', 'Sheffield Wednesday', '셰필드 웬즈데이', 'SHW', 65, 56, 40, '#4466B0', W, ['sheffield-utd']],
  ['southampton', 'Southampton', '사우샘프턴', 'SOU', 73, 64, 66, '#D71920', W, ['portsmouth', 'bournemouth']],
  ['stoke', 'Stoke City', '스토크 시티', 'STK', 68, 54, 58, '#E03A3E', W, ['west-brom']],
  ['swansea', 'Swansea City', '스완지 시티', 'SWA', 68, 54, 56, W, null, []],
  ['watford', 'Watford', '왓퍼드', 'WAT', 69, 54, 58, '#FBEE23', null, []],
  ['west-brom', 'West Bromwich Albion', '웨스트 브로미치 알비온', 'WBA', 70, 58, 60, '#122F67', W, ['wolves', 'birmingham', 'stoke']],
  ['wrexham', 'Wrexham', '렉섬', 'WRE', 68, 54, 70, '#E10600', null, []],
]);

// ----- 스페인 -----
const laLiga = defineLeague('ESP_LALIGA', 'ESP', [
  ['real-madrid', 'Real Madrid', '레알 마드리드', 'RMA', 88, 99, 97, W, null, ['barcelona', 'atletico-madrid']],
  ['barcelona', 'FC Barcelona', 'FC 바르셀로나', 'BAR', 87, 97, 88, '#A50044', '#004D98', ['real-madrid', 'espanyol', 'girona']],
  ['atletico-madrid', 'Atlético de Madrid', '아틀레티코 마드리드', 'ATM', 83, 86, 82, '#CB3524', W, ['real-madrid']],
  ['athletic-club', 'Athletic Club', '아틀레틱 클루브', 'ATH', 79, 74, 70, '#EE2523', W, ['real-sociedad']],
  ['villarreal', 'Villarreal', '비야레알', 'VIL', 79, 72, 70, '#FFE667', null, ['valencia']],
  ['real-betis', 'Real Betis', '레알 베티스', 'BET', 78, 72, 68, '#0BB363', W, ['sevilla']],
  ['real-sociedad', 'Real Sociedad', '레알 소시에다드', 'RSO', 77, 72, 68, '#0067B1', W, ['athletic-club']],
  ['sevilla', 'Sevilla', '세비야', 'SEV', 75, 78, 66, W, null, ['real-betis']],
  ['valencia', 'Valencia', '발렌시아', 'VAL', 75, 76, 64, W, null, ['levante', 'villarreal']],
  ['girona', 'Girona', '지로나', 'GIR', 75, 62, 66, '#CD2534', W, ['barcelona']],
  ['celta', 'Celta de Vigo', '셀타 비고', 'CEL', 75, 64, 60, '#8AC3EE', null, ['deportivo']],
  ['osasuna', 'Osasuna', '오사수나', 'OSA', 74, 60, 56, '#D91A21', null, []],
  ['rayo-vallecano', 'Rayo Vallecano', '라요 바예카노', 'RAY', 74, 58, 54, W, null, []],
  ['mallorca', 'RCD Mallorca', '마요르카', 'MLL', 73, 58, 56, '#E20613', null, []],
  ['getafe', 'Getafe', '헤타페', 'GET', 73, 58, 56, '#005999', null, ['leganes']],
  ['espanyol', 'RCD Espanyol', '에스파뇰', 'ESP', 73, 64, 58, '#007FC8', W, ['barcelona']],
  ['alaves', 'Deportivo Alavés', '알라베스', 'ALA', 72, 58, 54, '#0761AF', W, []],
  ['levante', 'Levante', '레반테', 'LEV', 71, 58, 52, '#0049A5', '#B4053F', ['valencia']],
  ['elche', 'Elche', '엘체', 'ELC', 71, 56, 52, W, null, []],
  ['real-oviedo', 'Real Oviedo', '레알 오비에도', 'OVI', 70, 60, 52, '#0056A4', null, ['sporting-gijon']],
]);

const laLiga2 = defineLeague('ESP_L2', 'ESP', [
  ['albacete', 'Albacete', '알바세테', 'ALB', 64, 46, 40, W, null, []],
  ['almeria', 'UD Almería', '알메리아', 'ALM', 68, 52, 60, '#EE1119', W, []],
  ['burgos', 'Burgos CF', '부르고스', 'BUR', 64, 42, 38, W, null, []],
  ['cadiz', 'Cádiz CF', '카디스', 'CAD', 66, 52, 46, '#FFE500', null, []],
  ['castellon', 'CD Castellón', '카스테욘', 'CAS', 64, 44, 42, '#000000', W, []],
  ['ceuta', 'AD Ceuta', '세우타', 'CEU', 61, 38, 32, W, null, []],
  ['cordoba', 'Córdoba CF', '코르도바', 'COR', 63, 46, 38, '#007A33', W, []],
  ['cultural-leonesa', 'Cultural Leonesa', '쿨투랄 레오네사', 'CUL', 61, 40, 34, W, null, []],
  ['deportivo', 'Deportivo de La Coruña', '데포르티보 라코루냐', 'DEP', 67, 62, 52, '#1B5DAA', W, ['celta']],
  ['eibar', 'SD Eibar', '에이바르', 'EIB', 65, 48, 44, '#004B9B', '#A50034', []],
  ['granada', 'Granada CF', '그라나다', 'GRA', 67, 54, 50, '#C8102E', null, []],
  ['huesca', 'SD Huesca', '우에스카', 'HUE', 63, 44, 40, '#003DA5', '#A71930', []],
  ['las-palmas', 'UD Las Palmas', '라스팔마스', 'LPA', 67, 54, 52, '#FFE600', null, []],
  ['leganes', 'CD Leganés', '레가네스', 'LEG', 66, 48, 46, '#004FA3', W, ['getafe']],
  ['malaga', 'Málaga CF', '말라가', 'MAL', 65, 56, 46, '#5FA8DC', W, []],
  ['mirandes', 'CD Mirandés', '미란데스', 'MIR', 62, 40, 36, '#C8102E', null, []],
  ['racing', 'Racing de Santander', '라싱 산탄데르', 'RAC', 66, 54, 46, W, null, []],
  ['real-sociedad-b', 'Real Sociedad B', '레알 소시에다드 B', 'RSB', 60, 36, 40, '#0067B1', W, [], { promotionEligible: false }],
  ['valladolid', 'Real Valladolid', '레알 바야돌리드', 'VLL', 67, 56, 52, '#5E2C82', W, []],
  ['zaragoza', 'Real Zaragoza', '레알 사라고사', 'ZAR', 64, 56, 44, W, null, []],
  ['sporting-gijon', 'Sporting de Gijón', '스포르팅 히혼', 'SPG', 65, 54, 46, '#E20E17', W, ['real-oviedo']],
  ['andorra', 'FC Andorra', 'FC 안도라', 'AND', 62, 40, 50, '#F2C500', null, []],
]);

// ----- 대한민국 -----
const kLeague1 = defineLeague('KOR_K1', 'KOR', [
  ['jeonbuk', 'Jeonbuk Hyundai Motors', '전북 현대 모터스', 'JEO', 68, 48, 47, '#00593A', null, ['ulsan']],
  ['ulsan', 'Ulsan HD', '울산 HD', 'ULS', 67, 47, 46, '#1D4DA1', null, ['pohang', 'jeonbuk']],
  ['fc-seoul', 'FC Seoul', 'FC 서울', 'SEO', 66, 46, 45, '#B5002E', '#000000', ['fc-anyang', 'suwon-samsung']],
  ['pohang', 'Pohang Steelers', '포항 스틸러스', 'POH', 65, 44, 40, '#D51E2A', '#000000', ['ulsan']],
  ['daejeon', 'Daejeon Hana Citizen', '대전 하나 시티즌', 'DAE', 65, 36, 42, '#3E1A70', null, []],
  ['gimcheon', 'Gimcheon Sangmu', '김천 상무', 'GIM', 65, 30, 28, '#E50012', null, []],
  ['gangwon', 'Gangwon FC', '강원 FC', 'GAN', 64, 32, 32, '#F26522', null, []],
  ['suwon-fc', 'Suwon FC', '수원 FC', 'SFC', 63, 32, 34, '#00438C', null, ['suwon-samsung']],
  ['gwangju', 'Gwangju FC', '광주 FC', 'GWA', 63, 32, 28, '#FFD400', null, []],
  ['jeju', 'Jeju SK', '제주 SK', 'JEJ', 62, 36, 38, '#F37321', null, []],
  ['fc-anyang', 'FC Anyang', 'FC 안양', 'ANY', 62, 30, 30, '#4B2E83', null, ['fc-seoul']],
  ['daegu', 'Daegu FC', '대구 FC', 'DGU', 61, 34, 30, '#87CEEB', null, []],
]);

const kLeague2 = defineLeague('KOR_K2', 'KOR', [
  ['suwon-samsung', 'Suwon Samsung Bluewings', '수원 삼성 블루윙즈', 'SSB', 62, 44, 42, '#1A3D8F', null, ['fc-seoul', 'suwon-fc']],
  ['incheon', 'Incheon United', '인천 유나이티드', 'INC', 62, 34, 32, '#005BAC', '#000000', []],
  ['busan', 'Busan IPark', '부산 아이파크', 'BUS', 60, 36, 34, '#D7002D', null, []],
  ['seoul-eland', 'Seoul E-Land', '서울 이랜드', 'SEL', 60, 26, 32, '#1E2B5C', null, []],
  ['jeonnam', 'Jeonnam Dragons', '전남 드래곤즈', 'JNM', 59, 32, 30, '#FFD200', null, []],
  ['bucheon', 'Bucheon FC 1995', '부천 FC 1995', 'BUC', 58, 24, 24, '#C8102E', null, []],
  ['seongnam', 'Seongnam FC', '성남 FC', 'SNG', 58, 34, 28, '#111111', null, []],
  ['gimpo', 'Gimpo FC', '김포 FC', 'GMP', 57, 18, 20, '#1C6B3A', null, []],
  ['chungnam-asan', 'Chungnam Asan', '충남 아산', 'CNA', 58, 18, 22, '#004B87', null, []],
  ['hwaseong', 'Hwaseong FC', '화성 FC', 'HWA', 54, 12, 18, '#F37021', null, []],
  ['ansan', 'Ansan Greeners', '안산 그리너스', 'ANS', 54, 16, 18, '#00A651', null, []],
  ['gyeongnam', 'Gyeongnam FC', '경남 FC', 'GYN', 57, 30, 24, '#E2001A', null, []],
  ['cheongju', 'Chungbuk Cheongju', '충북 청주', 'CHJ', 55, 14, 18, '#003B7A', null, []],
  ['cheonan', 'Cheonan City', '천안 시티', 'CHN', 54, 14, 18, '#3DA8E0', null, []],
]);

// ----- 자본 리그: 사우디아라비아 -----
const saudiProLeague = defineLeague('KSA_SPL', 'KSA', [
  ['al-hilal', 'Al Hilal', '알힐랄', 'HIL', 77, 58, 95, '#1A5DAB', null, ['al-nassr', 'al-shabab']],
  ['al-nassr', 'Al Nassr', '알나스르', 'NAS', 76, 56, 94, '#FFD700', null, ['al-hilal']],
  ['al-ittihad', 'Al Ittihad', '알이티하드', 'ITT', 76, 54, 92, '#FFD200', '#000000', ['al-ahli']],
  ['al-ahli', 'Al Ahli', '알아흘리', 'AHL', 75, 52, 92, '#009245', null, ['al-ittihad']],
  ['al-qadsiah', 'Al Qadsiah', '알카디시야', 'QAD', 72, 36, 90, '#E31B23', null, ['al-ettifaq']],
  ['al-ettifaq', 'Al Ettifaq', '알이티파크', 'ETT', 70, 38, 82, '#007A3D', null, ['al-qadsiah']],
  ['al-shabab', 'Al Shabab', '알샤바브', 'SHB', 70, 40, 80, W, null, ['al-hilal']],
  ['al-taawoun', 'Al Taawoun', '알타아운', 'TAA', 68, 30, 70, '#F7D117', null, []],
  ['al-fateh', 'Al Fateh', '알파테흐', 'FAT', 66, 30, 66, '#005BAA', null, []],
  ['al-khaleej', 'Al Khaleej', '알칼리즈', 'KHA', 66, 24, 66, '#78BE20', null, []],
  ['al-riyadh', 'Al Riyadh', '알리야드', 'RIY', 64, 22, 64, '#D50032', null, []],
  ['al-fayha', 'Al Fayha', '알파이하', 'FAY', 65, 24, 64, '#F58220', null, []],
  ['al-kholood', 'Al Kholood', '알홀루드', 'KHO', 63, 18, 62, '#FFCC00', null, []],
  ['al-okhdood', 'Al Okhdood', '알오크두드', 'OKH', 63, 18, 60, '#1E5AA8', null, []],
  ['damac', 'Damac', '다막', 'DAM', 64, 22, 62, '#C8102E', null, []],
  ['al-hazem', 'Al Hazem', '알하젬', 'HAZ', 62, 18, 58, '#F2C200', null, []],
  ['al-najma', 'Al Najma', '알나즈마', 'NAJ', 61, 14, 58, '#2C9F45', null, []],
  ['neom', 'NEOM SC', '네옴 SC', 'NEO', 66, 14, 92, '#111111', null, []],
]);

// ----- 자본 리그: 미국(MLS) -----
const mls = defineLeague('USA_MLS', 'USA', [
  ['inter-miami', 'Inter Miami CF', '인터 마이애미', 'MIA', 72, 60, 88, '#F7B5CD', null, ['orlando']],
  ['lafc', 'Los Angeles FC', 'LAFC', 'LAF', 71, 52, 84, '#000000', null, ['la-galaxy']],
  ['la-galaxy', 'LA Galaxy', 'LA 갤럭시', 'LAG', 69, 56, 82, W, null, ['lafc']],
  ['columbus', 'Columbus Crew', '콜럼버스 크루', 'CLB', 70, 44, 72, '#FEDD00', null, ['cincinnati']],
  ['cincinnati', 'FC Cincinnati', 'FC 신시내티', 'CIN', 70, 40, 74, '#003087', null, ['columbus']],
  ['philadelphia', 'Philadelphia Union', '필라델피아 유니언', 'PHI', 70, 42, 70, '#071B2C', null, ['ny-red-bulls']],
  ['seattle', 'Seattle Sounders', '시애틀 사운더스', 'SEA', 69, 50, 78, '#5D9741', null, ['portland', 'vancouver']],
  ['nycfc', 'New York City FC', '뉴욕 시티 FC', 'NYC', 68, 44, 78, '#6CACE4', null, ['ny-red-bulls']],
  ['ny-red-bulls', 'New York Red Bulls', '뉴욕 레드불스', 'RBN', 67, 42, 72, W, null, ['nycfc', 'philadelphia']],
  ['orlando', 'Orlando City', '올랜도 시티', 'ORL', 68, 40, 72, '#633492', null, ['inter-miami']],
  ['atlanta', 'Atlanta United', '애틀랜타 유나이티드', 'ATL', 67, 46, 80, '#80000A', '#000000', ['charlotte', 'nashville']],
  ['nashville', 'Nashville SC', '내슈빌 SC', 'NSH', 68, 36, 70, '#ECE83A', null, ['atlanta']],
  ['charlotte', 'Charlotte FC', '샬럿 FC', 'CLT', 67, 34, 74, '#1A85C8', null, ['atlanta']],
  ['vancouver', 'Vancouver Whitecaps', '밴쿠버 화이트캡스', 'VAN', 69, 40, 68, '#00245E', null, ['seattle', 'portland', 'toronto'], { nation: 'CAN' }],
  ['portland', 'Portland Timbers', '포틀랜드 팀버스', 'POR', 67, 42, 70, '#00482B', null, ['seattle', 'vancouver']],
  ['minnesota', 'Minnesota United', '미네소타 유나이티드', 'MIN', 67, 34, 66, '#585958', null, []],
  ['san-diego', 'San Diego FC', '샌디에이고 FC', 'SDF', 68, 30, 76, '#002244', null, ['lafc']],
  ['austin', 'Austin FC', '오스틴 FC', 'ATX', 66, 34, 72, '#00B140', null, ['houston', 'dallas']],
  ['houston', 'Houston Dynamo', '휴스턴 다이너모', 'HOU', 66, 34, 64, '#FF6B00', null, ['austin', 'dallas']],
  ['dallas', 'FC Dallas', 'FC 댈러스', 'DAL', 65, 36, 64, '#E81F3E', null, ['austin', 'houston']],
  ['real-salt-lake', 'Real Salt Lake', '레알 솔트레이크', 'RSL', 66, 36, 64, '#B30838', null, ['colorado']],
  ['colorado', 'Colorado Rapids', '콜로라도 래피즈', 'COL', 65, 32, 62, '#960A2C', null, ['real-salt-lake']],
  ['sporting-kc', 'Sporting Kansas City', '스포팅 캔자스시티', 'SKC', 64, 38, 62, '#A7C6ED', null, ['st-louis']],
  ['st-louis', 'St. Louis City SC', '세인트루이스 시티', 'STL', 64, 30, 70, '#DD004D', null, ['sporting-kc']],
  ['chicago', 'Chicago Fire', '시카고 파이어', 'CHI', 65, 38, 70, '#AF2626', null, []],
  ['new-england', 'New England Revolution', '뉴잉글랜드 레볼루션', 'NE', 64, 38, 64, '#0A2240', null, []],
  ['dc-united', 'D.C. United', 'DC 유나이티드', 'DCU', 63, 40, 64, '#111111', null, []],
  ['toronto', 'Toronto FC', '토론토 FC', 'TOR', 64, 40, 74, '#B81137', null, ['montreal', 'vancouver'], { nation: 'CAN' }],
  ['montreal', 'CF Montréal', 'CF 몽레알', 'MTL', 63, 34, 62, '#000000', '#0033A1', ['toronto'], { nation: 'CAN' }],
  ['san-jose', 'San Jose Earthquakes', '새너제이 어스퀘이크스', 'SJ', 64, 34, 62, '#0D4C92', null, []],
]);

export const CLUBS: Record<string, ClubDefinition> = Object.fromEntries(
  [...premierLeague, ...championship, ...laLiga, ...laLiga2, ...kLeague1, ...kLeague2, ...saudiProLeague, ...mls].map(
    (club) => [club.id, club],
  ),
);
