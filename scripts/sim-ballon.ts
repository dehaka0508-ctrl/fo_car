/**
 * 발롱도르 점수 보정 확인: npm run sim:ballon
 * 기준 시즌마다 점수 구성과 1위·포디움 확률, 중앙 순위를 목표와 함께 출력한다.
 */
import { createDefaultWorld } from '@/engine/world';
import { BALLON_REFERENCES, rankDistribution, type BallonTarget } from './ballon-references';

const world = createDefaultWorld();
const pct = (v: number) => `${Math.round(v * 100)}%`;
const targetText = (t: BallonTarget) =>
  [
    t.win ? `1위 ${pct(t.win[0])}~${pct(t.win[1])}` : null,
    t.podium ? `포디움 ${pct(t.podium[0])}~${pct(t.podium[1])}` : null,
    t.medianRank ? `중앙 ${t.medianRank[0]}~${t.medianRank[1]}위` : null,
  ]
    .filter(Boolean)
    .join(', ');

for (const ref of BALLON_REFERENCES) {
  const d = rankDistribution(world, ref.season);
  const b = d.breakdown;
  console.log(
    `${ref.label.padEnd(24)} ${String(b.total).padStart(6)}점 ` +
      `[성과 ${b.performance} · 국대 ${b.international} · 우승 ${b.teamSuccess} · 압도 ${b.dominance}/${b.legacy} · 명성 ${b.reputation}] ` +
      `→ 1위 ${pct(d.win)} · 포디움 ${pct(d.podium)} · 중앙 ${d.medianRank}위   (목표: ${targetText(ref.target)})`,
  );
}
