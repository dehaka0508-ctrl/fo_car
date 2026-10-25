/**
 * 풀 커리어 자동 진행 점검: npm run sim:career  (CAREERS=10 npm run sim:career)
 * AI 매니저가 16세부터 은퇴까지 진행한 커리어들의 요약과, 한 커리어의 시즌별 기록을 출력한다.
 */
import { simulateCareer } from '@/engine/autoplay';
import { BASE_WORLD } from '@/engine/career';
import type { CharacterInput } from '@/engine/character';
import { careerTotals } from '@/engine/records';
import { averageRating, mergeStatLines } from '@/engine/simulator';
import { formatMoney } from '@/engine/state';
import type { GameState, PlayerRole } from '@/types/game';

const CAREERS = Number(process.env.CAREERS ?? 6);

const archetypes: Array<{ label: string; role: PlayerRole; clubId: string; nationality: string; heightCm: number; weightKg: number }> = [
  { label: '포처 · 울산', role: { position: 'ST', playStyle: 'POACHER' }, clubId: 'ulsan', nationality: 'KOR', heightCm: 182, weightKg: 76 },
  { label: '인사이드 포워드 · 맨시티', role: { position: 'LW', playStyle: 'INSIDE_FORWARD' }, clubId: 'man-city', nationality: 'ENG', heightCm: 176, weightKg: 70 },
  { label: '박스 투 박스 · 수원 삼성(2부)', role: { position: 'CM', playStyle: 'BOX_TO_BOX' }, clubId: 'suwon-samsung', nationality: 'KOR', heightCm: 180, weightKg: 74 },
  { label: '스토퍼 · 아틀레티코', role: { position: 'CB', playStyle: 'STOPPER' }, clubId: 'atletico-madrid', nationality: 'ESP', heightCm: 190, weightKg: 84 },
  { label: '스위퍼 키퍼 · 전북', role: { position: 'GK', playStyle: 'SWEEPER_KEEPER' }, clubId: 'jeonbuk', nationality: 'KOR', heightCm: 191, weightKg: 85 },
];

function summarize(state: GameState) {
  const totals = careerTotals(state);
  const peak = state.history.reduce((best, s) => (s.ovrEnd > best.ovr ? { ovr: s.ovrEnd, age: s.age + 1 } : best), { ovr: 0, age: 0 });
  const ballon = state.awards.filter((a) => a.type === 'BALLON_DOR');
  const clubs = [...new Set(state.player.clubHistory.map((s) => BASE_WORLD.clubs[s.clubId]?.shortName ?? s.clubId))];
  return {
    retiredAt: state.player.age,
    seasons: state.history.length,
    peak,
    totals,
    trophies: state.trophies.length,
    ballonWins: ballon.filter((a) => a.rank === 1).length,
    bestBallon: ballon.length ? Math.min(...ballon.map((a) => a.rank)) : null,
    otherAwards: state.awards.filter((a) => a.type !== 'BALLON_DOR' && a.rank === 1).length,
    records: state.recordBreaks.length,
    legends: state.legends.length,
    caps: state.player.nationalTeam.caps,
    money: state.player.money,
    clubs,
  };
}

for (const archetype of archetypes) {
  console.log(`\n■ ${archetype.label}`);
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
    console.log(
      `  #${seed} ${state.stage} ${s.retiredAt}세 은퇴(${s.seasons}시즌) · 최고 OVR ${s.peak.ovr}(${s.peak.age}세) · ` +
        `${s.totals.appearances}경기 ${s.totals.goals}골 ${s.totals.assists}도움 CS ${s.totals.cleanSheets} · A매치 ${s.caps} · ` +
        `우승 ${s.trophies} · 발롱 ${s.ballonWins}회(최고 ${s.bestBallon ?? '-'}위) · 기타상 ${s.otherAwards} · 신기록 ${s.records} · 레전드 ${s.legends} · ` +
        `${formatMoney(s.money)} · ${s.clubs.join('→')}`,
    );
  }
}

// 한 커리어의 시즌별 기록
const detail = simulateCareer(
  { name: '김유망', nationality: 'KOR', role: { position: 'ST', playStyle: 'POACHER' }, heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' }, clubId: 'ulsan' },
  3,
);
console.log('\n■ 시즌별 기록 (포처 · 울산 · 시드 3)');
for (const season of detail.history) {
  const club = mergeStatLines(season.stats.LEAGUE, season.stats.DOMESTIC_CUP, season.stats.CONTINENTAL);
  console.log(
    `  ${season.season} ${season.age}세 ${BASE_WORLD.clubs[season.clubId ?? '']?.shortName ?? 'FA'} OVR ${season.ovrStart}→${season.ovrEnd} · ` +
      `${club.appearances}경기 ${club.goals}골 ${club.assists}도움 평점 ${averageRating(club) ?? '-'} · B팀 ${season.stats.RESERVE.appearances} · ` +
      `국대 ${season.stats.INTERNATIONAL.appearances} · ${season.leaguePosition ?? '-'}위 · 우승 ${season.trophies.length} · ` +
      `상 ${season.awards.map((a) => `${a.type}${a.rank > 1 ? `(${a.rank}위)` : ''}`).join(',')}`,
  );
}
console.log('  알림 예시:', detail.notices.slice(0, 8).map((n) => n.title).join(' | '));
