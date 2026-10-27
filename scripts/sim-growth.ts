/**
 * 성장 곡선 점검: npm run sim:growth   (CAREERS=10 시나리오별 커리어 수)
 *
 * AI 대리 플레이 커리어에서 숨은 포텐셜(필드 80~100, GK 80~100)에 언제 닿는지 본다.
 * 필드는 18개 능력치 단순 평균, GK는 OVR로 도달 여부를 검사한다.
 */
import { autoInterTurn } from '@/engine/autoplay';
import { potentialProgress } from '@/engine/growth';
import { BASE_WORLD, createCareer, playTurnAuto } from '@/engine/career';
import { findClubId } from '@/engine/world';
import type { PlayerRole } from '@/types/game';

const CAREERS = Number(process.env.CAREERS ?? 10);
const SEED0 = Number(process.env.SEED0 ?? 1);
const club = (name: string, nation: string) => findClubId(BASE_WORLD.clubs, name, nation)!;
const scenarios: Array<{ label: string; role: PlayerRole; clubId: string; nationality: string }> = [
  { label: '포처 · 울산', role: { position: 'ST', playStyle: 'POACHER' }, clubId: club('Ulsan', 'KOR'), nationality: 'KOR' },
  { label: '플레이메이커 · 바르셀로나', role: { position: 'AM', playStyle: 'PLAYMAKER' }, clubId: club('Barcelona', 'ESP'), nationality: 'ESP' },
  { label: '스토퍼 · 아틀레티코', role: { position: 'CB', playStyle: 'STOPPER' }, clubId: club('Atletico Madrid', 'ESP'), nationality: 'ESP' },
  { label: '스위퍼 키퍼 · 전북', role: { position: 'GK', playStyle: 'SWEEPER_KEEPER' }, clubId: club('Jeonbuk', 'KOR'), nationality: 'KOR' },
];

const median = (xs: number[]) => (xs.length ? (Math.round([...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] * 10) / 10) : '-');
const rows: Array<{ potential: number; reachAge: number | null; peak: number; peakAge: number; at: Record<number, number> }> = [];

for (const s of scenarios) {
  console.log(`\n■ ${s.label}`);
  for (let seed = SEED0; seed < SEED0 + CAREERS; seed++) {
    let state = createCareer(
      { name: '테스트', nationality: s.nationality, role: s.role, heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' }, clubId: s.clubId },
      { seed },
    );
    const potential = state.player.potential;
    const at: Record<number, number> = {};
    let reachAge: number | null = null;
    let peak = 0;
    let peakAge = 0;
    for (let turn = 0; turn < 90 && state.stage === 'READY'; turn++) {
      state = { ...autoInterTurn(state), ceremonies: [] };
      if (state.stage !== 'READY') break;
      state = playTurnAuto(state);
      const age = state.player.age;
      const progress = potentialProgress(state.player);
      at[age] = Math.round(progress * 10) / 10;
      if (progress > peak) { peak = progress; peakAge = age; }
      if (reachAge === null && progress >= potential - 1) reachAge = age;
    }
    rows.push({ potential, reachAge, peak, peakAge, at });
    console.log(
      `  #${seed} 포텐셜 ${potential} · 도달 ${reachAge ?? '-'}세 · 최고 ${peak.toFixed(1)}(${peakAge}세) · ${s.role.position === 'GK' ? 'OVR' : '18능력치 평균'} 20세 ${at[20] ?? '-'} / 23세 ${at[23] ?? '-'} / 26세 ${at[26] ?? '-'} / 29세 ${at[29] ?? '-'} / 32세 ${at[32] ?? '-'}`,
    );
  }
}

console.log('\n■ 포텐셜 구간별');
for (const [lo, hi] of [[60, 69], [70, 79], [80, 89], [90, 100]]) {
  const band = rows.filter((r) => r.potential >= lo && r.potential <= hi);
  if (!band.length) continue;
  const reached = band.filter((r) => r.reachAge !== null);
  console.log(
    `  ${lo}~${hi}: ${band.length}명 · 도달 ${reached.length}명 (나이 중앙값 ${median(reached.map((r) => r.reachAge!))}) · ` +
      `최고 성장값 − 포텐셜 중앙값 ${median(band.map((r) => r.peak - r.potential))} · 최고 나이 중앙값 ${median(band.map((r) => r.peakAge))}`,
  );
}
const reached = rows.filter((r) => r.reachAge !== null).map((r) => r.reachAge!);
console.log(`  전체 도달 ${reached.length}/${rows.length} · 도달 나이 분포: ${[...reached].sort((a, b) => a - b).join(' ')}`);
