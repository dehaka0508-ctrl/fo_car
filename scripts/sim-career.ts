/**
 * 풀 커리어 자동 진행 점검: npm run sim:career
 *   CAREERS=12 npm run sim:career        시나리오별 커리어 수 (기본 8)
 *   ONLY=poacher,stopper npm run sim:career   일부 시나리오만
 *   DETAIL=0 npm run sim:career          개별 커리어·시즌별 기록 생략 (요약만)
 *
 * AI 매니저가 16세부터 은퇴까지 진행한 커리어들을 시나리오별로 요약하고,
 * 마지막에 포지션별 발롱도르 분포를 보여 준다.
 */
import { POSITION_META } from '@/data/playstyles';
import { simulateCareer } from '@/engine/autoplay';
import { BASE_WORLD } from '@/engine/career';
import { findClubId } from '@/engine/world';
import type { CharacterInput } from '@/engine/character';
import { careerTotals } from '@/engine/records';
import { averageRating, mergeStatLines } from '@/engine/simulator';
import { formatMoney } from '@/engine/state';
import type { GameState, PlayerRole, PositionGroup } from '@/types/game';

const CAREERS = Number(process.env.CAREERS ?? 8);
const ONLY = process.env.ONLY?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
const DETAIL = process.env.DETAIL !== '0';

/** 구단은 이름으로 찾는다 (내장 샘플 · 외부 DB 어느 쪽이든) */
function club(name: string, nation: string): string {
  const id = findClubId(BASE_WORLD.clubs, name, nation);
  if (!id) throw new Error(`구단을 찾지 못했습니다: ${name}`);
  return id;
}

interface Archetype {
  key: string;
  label: string;
  role: PlayerRole;
  clubId: string;
  nationality: string;
  heightCm: number;
  weightKg: number;
}

const archetypes: Archetype[] = [
  { key: 'poacher', label: '포처 · 울산', role: { position: 'ST', playStyle: 'POACHER' }, clubId: club('Ulsan', 'KOR'), nationality: 'KOR', heightCm: 182, weightKg: 76 },
  { key: 'target', label: '타겟맨 · 에버턴', role: { position: 'ST', playStyle: 'TARGET_MAN' }, clubId: club('Everton', 'ENG'), nationality: 'ENG', heightCm: 192, weightKg: 88 },
  { key: 'inside', label: '인사이드 포워드 · 맨시티', role: { position: 'LW', playStyle: 'INSIDE_FORWARD' }, clubId: club('Manchester City', 'ENG'), nationality: 'ENG', heightCm: 176, weightKg: 70 },
  { key: 'shadow', label: '쉐도우 스트라이커 · 레알 소시에다드', role: { position: 'AM', playStyle: 'SHADOW_STRIKER' }, clubId: club('Real Sociedad', 'ESP'), nationality: 'ESP', heightCm: 178, weightKg: 72 },
  { key: 'playmaker', label: '플레이메이커 · 바르셀로나', role: { position: 'AM', playStyle: 'PLAYMAKER' }, clubId: club('Barcelona', 'ESP'), nationality: 'ESP', heightCm: 174, weightKg: 68 },
  { key: 'b2b', label: '박스 투 박스 · 수원 삼성(2부)', role: { position: 'CM', playStyle: 'BOX_TO_BOX' }, clubId: club('Suwon Samsung', 'KOR'), nationality: 'KOR', heightCm: 180, weightKg: 74 },
  { key: 'dlp', label: '딥 라잉 플레이메이커 · 레알 마드리드', role: { position: 'CM', playStyle: 'DEEP_LYING_PLAYMAKER' }, clubId: club('Real Madrid', 'ESP'), nationality: 'ESP', heightCm: 177, weightKg: 70 },
  { key: 'stopper', label: '스토퍼 · 아틀레티코', role: { position: 'CB', playStyle: 'STOPPER' }, clubId: club('Atletico Madrid', 'ESP'), nationality: 'ESP', heightCm: 190, weightKg: 84 },
  { key: 'keeper', label: '스위퍼 키퍼 · 전북', role: { position: 'GK', playStyle: 'SWEEPER_KEEPER' }, clubId: club('Jeonbuk', 'KOR'), nationality: 'KOR', heightCm: 191, weightKg: 85 },
  { key: 'keeper-eu', label: '클래식 골키퍼 · 레알 마드리드', role: { position: 'GK', playStyle: 'CLASSIC_GOALKEEPER' }, clubId: club('Real Madrid', 'ESP'), nationality: 'ESP', heightCm: 192, weightKg: 86 },
];

function summarize(state: GameState) {
  const totals = careerTotals(state);
  const peak = state.history.reduce((best, s) => (s.ovrEnd > best.ovr ? { ovr: s.ovrEnd, age: s.age + 1 } : best), { ovr: 0, age: 0 });
  const ballon = state.awards.filter((a) => a.type === 'BALLON_DOR');
  const clubs = state.player.clubHistory
    .map((s) => BASE_WORLD.clubs[s.clubId])
    .filter((c, i, arr) => c && arr.findIndex((x) => x?.id === c.id) === i)
    .map((c) => `${c!.nameKo}(${c!.nation})`);
  const seasons = state.history.map((s) => ({
    league: s.stats.LEAGUE.goals,
    club: mergeStatLines(s.stats.LEAGUE, s.stats.DOMESTIC_CUP, s.stats.CONTINENTAL).goals,
    ovr: Math.max(s.ovrStart, s.ovrEnd),
  }));
  return {
    retiredAt: state.player.age,
    seasons: state.history.length,
    peak,
    totals,
    trophies: state.trophies.length,
    ballonWins: ballon.filter((a) => a.rank === 1).length,
    podiums: ballon.filter((a) => a.rank <= 3).length,
    bestBallon: ballon.length ? Math.min(...ballon.map((a) => a.rank)) : null,
    otherAwards: state.awards.filter((a) => a.type !== 'BALLON_DOR' && a.rank === 1).length,
    records: state.recordBreaks.length,
    legends: state.legends.length,
    caps: state.player.nationalTeam.caps,
    money: state.player.money,
    clubs,
    maxLeagueGoals: Math.max(0, ...seasons.map((s) => s.league)),
    maxClubGoals: Math.max(0, ...seasons.map((s) => s.club)),
    /** OVR 88 이상 시즌의 리그 득점 */
    eliteLeagueGoals: seasons.filter((s) => s.ovr >= 88).map((s) => s.league),
  };
}

const range = (values: number[]) => {
  if (!values.length) return '-';
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return `${sorted[0]}~${sorted.at(-1)} (중앙값 ${median})`;
};

const ballonByGroup: Record<PositionGroup, { careers: number; winners: number; wins: number; podiumCareers: number }> = {
  FORWARD: { careers: 0, winners: 0, wins: 0, podiumCareers: 0 },
  MIDFIELDER: { careers: 0, winners: 0, wins: 0, podiumCareers: 0 },
  DEFENDER: { careers: 0, winners: 0, wins: 0, podiumCareers: 0 },
  GOALKEEPER: { careers: 0, winners: 0, wins: 0, podiumCareers: 0 },
};

for (const archetype of archetypes.filter((a) => !ONLY || ONLY.includes(a.key))) {
  console.log(`\n■ ${archetype.label}`);
  const rows: Array<ReturnType<typeof summarize>> = [];
  for (let seed = 1; seed <= CAREERS; seed++) {
    const input: CharacterInput = {
      name: '테스트',
      nationality: archetype.nationality,
      role: archetype.role,
      heightCm: archetype.heightCm,
      weightKg: archetype.weightKg,
      appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' },
      clubId: archetype.clubId,
    };
    const state = simulateCareer(input, seed);
    const s = summarize(state);
    rows.push(s);
    if (DETAIL) {
      console.log(
        `  #${seed} ${s.retiredAt}세 은퇴(${s.seasons}시즌) · 최고 OVR ${s.peak.ovr}(${s.peak.age}세) · ` +
          `${s.totals.appearances}경기 ${s.totals.goals}골 ${s.totals.assists}도움 CS ${s.totals.cleanSheets} · A매치 ${s.caps} · ` +
          `시즌 최다 리그 ${s.maxLeagueGoals}골/공식전 ${s.maxClubGoals}골 · 우승 ${s.trophies} · ` +
          `발롱 ${s.ballonWins}회(최고 ${s.bestBallon ?? '-'}위) · 기타상 ${s.otherAwards} · 레전드 ${s.legends} · ` +
          `${formatMoney(s.money)} · ${s.clubs.join('→')}`,
      );
    }
  }

  const group = POSITION_META[archetype.role.position].group;
  const stat = ballonByGroup[group];
  stat.careers += rows.length;
  stat.winners += rows.filter((r) => r.ballonWins > 0).length;
  stat.wins += rows.reduce((n, r) => n + r.ballonWins, 0);
  stat.podiumCareers += rows.filter((r) => r.podiums > 0).length;

  console.log(
    `  └ 요약: 최고 OVR ${range(rows.map((r) => r.peak.ovr))} · 통산 골 ${range(rows.map((r) => r.totals.goals))} · ` +
      `도움 ${range(rows.map((r) => r.totals.assists))} · CS ${range(rows.map((r) => r.totals.cleanSheets))}`,
  );
  console.log(
    `     시즌 최다 리그 골 ${range(rows.map((r) => r.maxLeagueGoals))} · 시즌 최다 공식전 골 ${range(rows.map((r) => r.maxClubGoals))} · ` +
      `OVR 88+ 시즌 리그 골 ${range(rows.flatMap((r) => r.eliteLeagueGoals))}`,
  );
  console.log(
    `     발롱도르: 수상자 ${rows.filter((r) => r.ballonWins > 0).length}/${rows.length}명 (총 ${rows.reduce((n, r) => n + r.ballonWins, 0)}회) · ` +
      `포디움 경험 ${rows.filter((r) => r.podiums > 0).length}명 · 최고 순위 ${rows.map((r) => r.bestBallon ?? '-').join(',')}`,
  );
}

console.log('\n■ 포지션별 발롱도르 분포');
for (const [group, s] of Object.entries(ballonByGroup)) {
  if (!s.careers) continue;
  console.log(`  ${group.padEnd(10)} 커리어 ${s.careers} · 수상자 ${s.winners}명 (총 ${s.wins}회) · 포디움 경험 ${s.podiumCareers}명`);
}

if (DETAIL && (!ONLY || ONLY.includes('poacher'))) {
  const detail = simulateCareer(
    { name: '김유망', nationality: 'KOR', role: { position: 'ST', playStyle: 'POACHER' }, heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' }, clubId: club('Ulsan', 'KOR') },
    3,
  );
  console.log('\n■ 시즌별 기록 (포처 · 울산 · 시드 3)');
  for (const season of detail.history) {
    const club = mergeStatLines(season.stats.LEAGUE, season.stats.DOMESTIC_CUP, season.stats.CONTINENTAL);
    console.log(
      `  ${season.season} ${season.age}세 ${BASE_WORLD.clubs[season.clubId ?? '']?.shortName ?? 'FA'} OVR ${season.ovrStart}→${season.ovrEnd} · ` +
        `리그 ${season.stats.LEAGUE.goals}골 · 공식전 ${club.appearances}경기 ${club.goals}골 ${club.assists}도움 평점 ${averageRating(club) ?? '-'} · ` +
        `국대 ${season.stats.INTERNATIONAL.appearances} · ${season.leaguePosition ?? '-'}위 · 우승 ${season.trophies.length} · ` +
        `상 ${season.awards.map((a) => `${a.type}${a.rank > 1 ? `(${a.rank}위)` : ''}`).join(',')}`,
    );
  }
}
