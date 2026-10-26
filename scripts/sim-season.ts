/**
 * 밸런스 점검용 시즌 시뮬레이션: npm run sim  (시드 수: SEEDS=100 npm run sim)
 * 시나리오별로 여러 시드의 한 시즌(전반기·후반기·프리시즌) 평균 기록을 출력한다.
 */
import { createPlayer } from '@/engine/character';
import { calculateOVR } from '@/engine/ovr';
import { runDemoSeason } from '@/engine/season-demo';
import { averageRating, competitiveLine, mergeStatLines } from '@/engine/simulator';
import { createDefaultWorld, findClubId } from '@/engine/world';
import type { Attributes, HighlightRecord, PlayerRole, PlayerState } from '@/types/game';

const world = createDefaultWorld();
const SEASON = 2026;
const SEEDS = Number(process.env.SEEDS ?? 40);

/** 구단은 이름으로 찾는다 (내장 샘플 · 외부 DB 어느 쪽이든) */
function club(name: string, nation: string): string {
  const id = findClubId(world.clubs, name, nation);
  if (!id) throw new Error(`구단을 찾지 못했습니다: ${name}`);
  return id;
}

interface Scenario {
  label: string;
  clubId: string;
  role: PlayerRole;
  /** 성장한 선수를 흉내 내기 위해 모든 능력치에 더하는 값 (0이면 16세 그대로) */
  boost: number;
  nationality?: string;
  stamina?: number;
}

const scenarios: Scenario[] = [
  { label: '16세 포처 @ 울산 (생성 직후)', clubId: club('Ulsan', 'KOR'), role: { position: 'ST', playStyle: 'POACHER' }, boost: 0 },
  { label: '성장한 포처(+26) @ 울산', clubId: club('Ulsan', 'KOR'), role: { position: 'ST', playStyle: 'POACHER' }, boost: 26 },
  { label: '월드클래스 포처(+38) @ 맨시티', clubId: club('Manchester City', 'ENG'), role: { position: 'ST', playStyle: 'POACHER' }, boost: 38, nationality: 'ENG' },
  { label: '박투박(+30) @ 아스널, 지구력 95', clubId: club('Arsenal', 'ENG'), role: { position: 'CM', playStyle: 'BOX_TO_BOX' }, boost: 30, nationality: 'ENG', stamina: 95 },
  { label: '박투박(+30) @ 아스널, 지구력 55', clubId: club('Arsenal', 'ENG'), role: { position: 'CM', playStyle: 'BOX_TO_BOX' }, boost: 30, nationality: 'ENG', stamina: 55 },
  { label: '스토퍼(+30) @ 레알 마드리드', clubId: club('Real Madrid', 'ESP'), role: { position: 'CB', playStyle: 'STOPPER' }, boost: 30, nationality: 'ESP' },
  { label: '스위퍼 키퍼(+30) @ 바르셀로나', clubId: club('Barcelona', 'ESP'), role: { position: 'GK', playStyle: 'SWEEPER_KEEPER' }, boost: 30, nationality: 'ESP' },
];

function buildPlayer(scenario: Scenario, seed: number): PlayerState {
  const player = createPlayer(
    {
      name: '테스트',
      nationality: scenario.nationality ?? 'KOR',
      role: scenario.role,
      heightCm: 182,
      weightKg: 76,
      appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' },
      clubId: scenario.clubId,
    },
    world,
    { seed, startSeason: SEASON },
  );
  if (!scenario.boost) return player;

  const attributes = Object.fromEntries(
    Object.entries(player.attributes).map(([key, value]) => [key, Math.min(99, value + scenario.boost)]),
  ) as Attributes;
  if (scenario.stamina) attributes.stamina = scenario.stamina;
  return {
    ...player,
    attributes,
    ovr: calculateOVR(attributes, scenario.role),
    age: 24,
    reputation: 60,
    squad: { level: 'FIRST_TEAM', playingTime: scenario.role.position === 'GK' ? 'GK_FIRST' : 'STARTER', standing: 70 },
  };
}

const fmt = (value: number, digits = 1) => value.toFixed(digits);

for (const scenario of scenarios) {
  const sum = { apps: 0, matches: 0, goals: 0, assists: 0, cs: 0, rating: 0, rated: 0, reserveApps: 0, reserveGoals: 0, position: 0, condition: 0, reputation: 0, trophies: 0 };
  let sample: PlayerState | null = null;

  for (let seed = 1; seed <= SEEDS; seed++) {
    const player = buildPlayer(scenario, seed);
    sample ??= player;
    const { turns } = runDemoSeason(player, world, { seed, season: SEASON });
    const [first, second] = turns;
    const line = mergeStatLines(competitiveLine(first.playerStats), competitiveLine(second.playerStats));
    sum.apps += line.appearances;
    sum.matches += [first, second].reduce(
      (n, t) => n + t.matches.filter((m) => m.competitionType !== 'RESERVE').length,
      0,
    );
    sum.goals += line.goals;
    sum.assists += line.assists;
    sum.cs += line.cleanSheets;
    sum.rating += line.ratingSum;
    sum.rated += line.appearances;
    sum.reserveApps += first.playerStats.RESERVE.appearances + second.playerStats.RESERVE.appearances;
    sum.reserveGoals += first.playerStats.RESERVE.goals + second.playerStats.RESERVE.goals;
    sum.position += second.leagueTable.find((row) => row.clubId === scenario.clubId)?.position ?? 0;
    sum.condition += (first.condition.end + second.condition.end) / 2;
    sum.reputation += turns.reduce((n, t) => n + t.reputationDelta, 0);
    sum.trophies += turns.reduce((n, t) => n + t.trophies.length, 0);
  }

  const n = SEEDS;
  console.log(`\n■ ${scenario.label} — OVR ${sample?.ovr}, 지구력 ${sample?.attributes.stamina}, ${sample?.squad.level}/${sample?.squad.playingTime}`);
  if (sum.reserveApps) console.log(`  B팀·유스 ${fmt(sum.reserveApps / n)}경기 ${fmt(sum.reserveGoals / n)}골`);
  console.log(
    `  공식전 ${fmt(sum.apps / n)}/${fmt(sum.matches / n)}경기 · ${fmt(sum.goals / n)}골 ${fmt(sum.assists / n)}도움 ` +
      `CS ${fmt(sum.cs / n)} · 평점 ${sum.rated ? fmt(sum.rating / sum.rated, 2) : '-'} · 리그 ${fmt(sum.position / n)}위 · ` +
      `턴 종료 체력 ${fmt(sum.condition / n, 0)} · 명성 ${sum.reputation >= 0 ? '+' : ''}${fmt(sum.reputation / n)} · ` +
      `우승 ${fmt(sum.trophies / n, 2)}개`,
  );
}

// 단일 시즌 상세 예시
const detailScenario = scenarios[2];
const detail = runDemoSeason(buildPlayer(detailScenario, 7), world, { seed: 7, season: SEASON });
const ourScore = (h: HighlightRecord) => {
  const [us, them] = h.playerTeamSide === 'HOME' ? [h.score.home, h.score.away] : [h.score.away, h.score.home];
  return `${us}-${them}${h.score.penalties ? '(승부차기)' : ''}`;
};
console.log(`\n■ 상세 예시 (시드 7): ${detailScenario.label}`);
for (const turn of detail.turns) {
  const line = competitiveLine(turn.playerStats);
  const h = turn.highlight;
  console.log(
    `  [${turn.turn.phase}] 공식전 ${line.appearances}경기 ${line.goals}골 ${line.assists}도움 평점 ${averageRating(line) ?? '-'}` +
      ` · 친선 ${turn.playerStats.FRIENDLY.appearances} · 체력 ${turn.condition.start}→${turn.condition.end}` +
      ` · 하이라이트 ${h ? `${h.kind} vs ${h.opponent.name} ${ourScore(h)} (성공 ${h.successes}/${h.successes + h.failures})` : '-'}` +
      ` · ${turn.progress.map((p) => `${p.competitionId}:${p.status}(${p.stageReached})`).join(', ')}`,
  );
}
console.log('  시즌 평점:', detail.seasonRatings);
