/**
 * 구단 데이터 — 샘플 (2025/26 시즌 기준 소속)
 *
 * power / prestige / finance 는 유저에게 보이지 않는 히든 수치의 '초기값'이다.
 * - power: 실제 경기 성적에만 관여 (주전 평균 OVR 스케일)
 * - prestige: 이적·재계약 제의 여부, 보장 출전시간에 영향
 * - finance: 제시 연봉 수준
 * 레전드·역대 기록 데이터는 다음 단계에서 같은 파일 구조로 채운다.
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
  secondary: string,
  rivals: string[],
];

function defineLeague(leagueId: string, nation: string, rows: ClubRow[]): ClubDefinition[] {
  return rows.map(([id, name, nameKo, shortName, power, prestige, finance, primary, secondary, rivals]) => ({
    id,
    name,
    nameKo,
    shortName,
    nation,
    leagueId,
    power,
    prestige,
    finance,
    colors: { primary, secondary },
    rivals,
  }));
}

const premierLeague = defineLeague('ENG_PL', 'ENG', [
  ['arsenal', 'Arsenal', '아스널', 'ARS', 86, 89, 90, '#EF0107', '#FFFFFF', ['tottenham', 'chelsea']],
  ['aston-villa', 'Aston Villa', '애스턴 빌라', 'AVL', 80, 74, 78, '#670E36', '#95BFE5', ['wolves']],
  ['bournemouth', 'AFC Bournemouth', '본머스', 'BOU', 77, 58, 66, '#DA291C', '#000000', []],
  ['brentford', 'Brentford', '브렌트퍼드', 'BRE', 76, 58, 66, '#E30613', '#FFFFFF', ['fulham']],
  ['brighton', 'Brighton & Hove Albion', '브라이턴', 'BHA', 78, 66, 72, '#0057B8', '#FFFFFF', ['crystal-palace']],
  ['burnley', 'Burnley', '번리', 'BUR', 72, 56, 60, '#6C1D45', '#99D6EA', []],
  ['chelsea', 'Chelsea', '첼시', 'CHE', 83, 88, 92, '#034694', '#FFFFFF', ['tottenham', 'arsenal', 'fulham']],
  ['crystal-palace', 'Crystal Palace', '크리스탈 팰리스', 'CRY', 78, 64, 68, '#1B458F', '#C4122E', ['brighton']],
  ['everton', 'Everton', '에버턴', 'EVE', 76, 72, 70, '#003399', '#FFFFFF', ['liverpool']],
  ['fulham', 'Fulham', '풀럼', 'FUL', 76, 62, 68, '#FFFFFF', '#000000', ['chelsea', 'brentford']],
  ['leeds', 'Leeds United', '리즈 유나이티드', 'LEE', 74, 68, 68, '#FFFFFF', '#1D428A', ['man-utd']],
  ['liverpool', 'Liverpool', '리버풀', 'LIV', 86, 92, 92, '#C8102E', '#F6EB61', ['everton', 'man-utd']],
  ['man-city', 'Manchester City', '맨체스터 시티', 'MCI', 86, 91, 96, '#6CABDD', '#1C2C5B', ['man-utd']],
  ['man-utd', 'Manchester United', '맨체스터 유나이티드', 'MUN', 80, 91, 92, '#DA291C', '#FBE122', ['man-city', 'liverpool', 'leeds']],
  ['newcastle', 'Newcastle United', '뉴캐슬 유나이티드', 'NEW', 81, 78, 90, '#241F20', '#FFFFFF', ['sunderland']],
  ['nottingham-forest', 'Nottingham Forest', '노팅엄 포레스트', 'NFO', 77, 66, 70, '#DD0000', '#FFFFFF', []],
  ['sunderland', 'Sunderland', '선덜랜드', 'SUN', 73, 62, 66, '#EB172B', '#FFFFFF', ['newcastle']],
  ['tottenham', 'Tottenham Hotspur', '토트넘 홋스퍼', 'TOT', 80, 84, 86, '#132257', '#FFFFFF', ['arsenal', 'chelsea', 'west-ham']],
  ['west-ham', 'West Ham United', '웨스트햄 유나이티드', 'WHU', 76, 70, 74, '#7A263A', '#1BB1E7', ['tottenham']],
  ['wolves', 'Wolverhampton Wanderers', '울버햄튼', 'WOL', 74, 64, 68, '#FDB913', '#231F20', ['aston-villa']],
]);

const laLiga = defineLeague('ESP_LALIGA', 'ESP', [
  ['real-madrid', 'Real Madrid', '레알 마드리드', 'RMA', 88, 99, 97, '#FFFFFF', '#FEBE10', ['barcelona', 'atletico-madrid']],
  ['barcelona', 'FC Barcelona', 'FC 바르셀로나', 'BAR', 87, 97, 88, '#A50044', '#004D98', ['real-madrid', 'espanyol', 'girona']],
  ['atletico-madrid', 'Atlético de Madrid', '아틀레티코 마드리드', 'ATM', 83, 86, 82, '#CB3524', '#272E61', ['real-madrid']],
  ['athletic-club', 'Athletic Club', '아틀레틱 클루브', 'ATH', 79, 74, 70, '#EE2523', '#FFFFFF', ['real-sociedad']],
  ['villarreal', 'Villarreal', '비야레알', 'VIL', 79, 72, 70, '#FFE667', '#005187', ['valencia']],
  ['real-betis', 'Real Betis', '레알 베티스', 'BET', 78, 72, 68, '#0BB363', '#FFFFFF', ['sevilla']],
  ['real-sociedad', 'Real Sociedad', '레알 소시에다드', 'RSO', 77, 72, 68, '#0067B1', '#FFFFFF', ['athletic-club']],
  ['sevilla', 'Sevilla', '세비야', 'SEV', 75, 78, 66, '#FFFFFF', '#D81920', ['real-betis']],
  ['valencia', 'Valencia', '발렌시아', 'VAL', 75, 76, 64, '#FFFFFF', '#EE3524', ['levante', 'villarreal']],
  ['girona', 'Girona', '지로나', 'GIR', 75, 62, 66, '#CD2534', '#FFFFFF', ['barcelona']],
  ['celta', 'Celta de Vigo', '셀타 비고', 'CEL', 75, 64, 60, '#8AC3EE', '#FFFFFF', []],
  ['osasuna', 'Osasuna', '오사수나', 'OSA', 74, 60, 56, '#D91A21', '#0A346F', []],
  ['rayo-vallecano', 'Rayo Vallecano', '라요 바예카노', 'RAY', 74, 58, 54, '#FFFFFF', '#E53027', []],
  ['mallorca', 'RCD Mallorca', '마요르카', 'MLL', 73, 58, 56, '#E20613', '#000000', []],
  ['getafe', 'Getafe', '헤타페', 'GET', 73, 58, 56, '#005999', '#FFFFFF', []],
  ['espanyol', 'RCD Espanyol', '에스파뇰', 'ESP', 73, 64, 58, '#007FC8', '#FFFFFF', ['barcelona']],
  ['alaves', 'Deportivo Alavés', '알라베스', 'ALA', 72, 58, 54, '#0761AF', '#FFFFFF', []],
  ['levante', 'Levante', '레반테', 'LEV', 71, 58, 52, '#0049A5', '#B4053F', ['valencia']],
  ['elche', 'Elche', '엘체', 'ELC', 71, 56, 52, '#FFFFFF', '#05642C', []],
  ['real-oviedo', 'Real Oviedo', '레알 오비에도', 'OVI', 70, 60, 52, '#0056A4', '#FFFFFF', []],
]);

const kLeague1 = defineLeague('KOR_K1', 'KOR', [
  ['jeonbuk', 'Jeonbuk Hyundai Motors', '전북 현대 모터스', 'JEO', 68, 48, 47, '#00593A', '#FFFFFF', ['ulsan']],
  ['ulsan', 'Ulsan HD', '울산 HD', 'ULS', 67, 47, 46, '#1D4DA1', '#F5A100', ['pohang', 'jeonbuk']],
  ['fc-seoul', 'FC Seoul', 'FC 서울', 'SEO', 66, 46, 45, '#B5002E', '#000000', ['fc-anyang']],
  ['pohang', 'Pohang Steelers', '포항 스틸러스', 'POH', 65, 44, 40, '#D51E2A', '#000000', ['ulsan']],
  ['daejeon', 'Daejeon Hana Citizen', '대전 하나 시티즌', 'DAE', 65, 36, 42, '#3E1A70', '#00A651', []],
  ['gimcheon', 'Gimcheon Sangmu', '김천 상무', 'GIM', 65, 30, 28, '#E50012', '#1C2D6B', []],
  ['gangwon', 'Gangwon FC', '강원 FC', 'GAN', 64, 32, 32, '#F26522', '#003B71', []],
  ['suwon-fc', 'Suwon FC', '수원 FC', 'SFC', 63, 32, 34, '#00438C', '#E60012', []],
  ['gwangju', 'Gwangju FC', '광주 FC', 'GWA', 63, 32, 28, '#FFD400', '#C8102E', []],
  ['jeju', 'Jeju SK', '제주 SK', 'JEJ', 62, 36, 38, '#F37321', '#000000', []],
  ['fc-anyang', 'FC Anyang', 'FC 안양', 'ANY', 62, 30, 30, '#4B2E83', '#FFFFFF', ['fc-seoul']],
  ['daegu', 'Daegu FC', '대구 FC', 'DGU', 61, 34, 30, '#87CEEB', '#00274D', []],
]);

export const CLUBS: Record<string, ClubDefinition> = Object.fromEntries(
  [...premierLeague, ...laLiga, ...kLeague1].map((club) => [club.id, club]),
);
