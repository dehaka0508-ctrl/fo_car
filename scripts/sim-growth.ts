/**
 * 성장 곡선 점검: npm run sim:growth   (CAREERS=10 시나리오별 커리어 수)
 *
 * AI 대리 플레이 커리어에서 숨은 포텐셜(80~100)에 언제 닿는지 본다.
 * 목표: 보통 26~29세에 포텐셜(±1)에 닿고, 피지컬은 일찍 · 기술/멘탈은 늦게까지 오른다.
 */
import { simulateCareer } from '@/engine/autoplay';
import { BASE_WORLD } from '@/engine/career';
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

const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : NaN);
const rows: Array<{ potential: number; reachAge: number | null; peak: number; peakAge: number; at: Record<number, number> }> = [];

for (const s of scenarios) {
  console.log(`\n■ ${s.label}`);
  for (let seed = SEED0; seed < SEED0 + CAREERS; seed++) {
    const state = simulateCareer(
      { name: '테스트', nationality: s.nationality, role: s.role, heightCm: 182, weightKg: 76, appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' }, clubId: s.clubId },
      seed,
    );
    const potential = state.player.potential;
    const at: Record<number, number> = {};
    let reachAge: number | null = null;
    let peak = 0;
    let peakAge = 0;
    for (const h of state.history) {
      const age = h.age + 1;
      at[age] = h.ovrEnd;
      if (h.ovrEnd > peak) {
        peak = h.ovrEnd;
        peakAge = age;
      }
      if (reachAge === null && h.ovrEnd >= potential - 1) reachAge = age;
    }
    rows.push({ potential, reachAge, peak, peakAge, at });
    console.log(
      `  #${seed} 포텐셜 ${potential} · 도달 ${reachAge ?? '-'}세 · 최고 ${peak}(${peakAge}세) · OVR 20세 ${at[20] ?? '-'} / 23세 ${at[23] ?? '-'} / 26세 ${at[26] ?? '-'} / 29세 ${at[29] ?? '-'} / 32세 ${at[32] ?? '-'}`,
    );
  }
}

console.log('\n■ 포텐셜 구간별');
for (const [lo, hi] of [[80, 86], [87, 93], [94, 100]]) {
  const band = rows.filter((r) => r.potential >= lo && r.potential <= hi);
  if (!band.length) continue;
  const reached = band.filter((r) => r.reachAge !== null);
  console.log(
    `  ${lo}~${hi}: ${band.length}명 · 도달 ${reached.length}명 (나이 중앙값 ${median(reached.map((r) => r.reachAge!))}) · ` +
      `최고 OVR − 포텐셜 중앙값 ${median(band.map((r) => r.peak - r.potential))} · 최고 나이 중앙값 ${median(band.map((r) => r.peakAge))}`,
  );
}
const reached = rows.filter((r) => r.reachAge !== null).map((r) => r.reachAge!);
console.log(`  전체 도달 ${reached.length}/${rows.length} · 도달 나이 분포: ${[...reached].sort((a, b) => a - b).join(' ')}`);
