import { describe, expect, it } from 'vitest';
import { buildAutoHighlightOutcome, buildHighlightScene, getHighlightBriefing } from '@/engine/highlight';
import {
  advanceTurn,
  choiceSuccessChance,
  chooseHighlight,
  competitiveLine,
  conditionDrain,
  createTurnSession,
  effectiveTeamPower,
  finalizeTurn,
  mentalCoefficient,
  resolveHighlight,
  simulateTurn,
  summarizeSeasonRatings,
  type TurnInput,
} from '@/engine/simulator';
import type { NpcPlayer, PlayerState, TurnPhase } from '@/types/game';
import { makePlayer, world } from './helpers';

const input = (player: PlayerState, phase: TurnPhase = 'FIRST_HALF', seed = 1, extra: Partial<TurnInput> = {}): TurnInput => ({
  seed,
  turn: { season: 2026, phase },
  player,
  world,
  ...extra,
});

const star = (options: Parameters<typeof makePlayer>[0] = {}) => makePlayer({ boost: 34, ...options });

describe('코어 수식', () => {
  it('멘탈 계수: 0 → 0.9, 50 → 1.0, 100 → 1.1', () => {
    expect(mentalCoefficient(0)).toBeCloseTo(0.9);
    expect(mentalCoefficient(50)).toBeCloseTo(1.0);
    expect(mentalCoefficient(100)).toBeCloseTo(1.1);
  });

  it('팀 실력: 멘탈과 OVR이 높을수록, 많이 뛸수록 오른다', () => {
    expect(effectiveTeamPower(80, 85, 80, 1, false)).toBeGreaterThan(effectiveTeamPower(80, 85, 30, 1, false));
    expect(effectiveTeamPower(80, 90, 50, 1, false)).toBeGreaterThan(effectiveTeamPower(80, 70, 50, 1, false));
    expect(effectiveTeamPower(80, 90, 50, 1, false)).toBeGreaterThan(effectiveTeamPower(80, 90, 50, 0.3, false));
    expect(effectiveTeamPower(80, 90, 50, 0, false)).toBe(80);
  });

  it('체력 소모: 지구력이 높을수록, 키퍼일수록 적다', () => {
    const base = { minutes: 90, leagueIntensity: 1.15, competitionType: 'LEAGUE' as const };
    const b2b = { ...base, position: 'CM' as const, playStyle: 'BOX_TO_BOX' as const };
    expect(conditionDrain({ ...b2b, stamina: 95 })).toBeLessThan(conditionDrain({ ...b2b, stamina: 50 }));
    expect(conditionDrain({ ...base, position: 'GK', playStyle: 'CLASSIC_GOALKEEPER', stamina: 50 })).toBeLessThan(
      conditionDrain({ ...b2b, stamina: 50 }),
    );
  });

  it('선택지 성공률: 능력치·멘탈이 높을수록 높고 5~95% 안에 있다', () => {
    const attrs = makePlayer({ boost: 30 }).attributes;
    const high = choiceSuccessChance(attrs, ['finishing'], 60, 90);
    const low = choiceSuccessChance(attrs, ['finishing'], 60, 10);
    expect(high).toBeGreaterThan(low);
    expect(choiceSuccessChance(attrs, ['finishing'], 0, 100)).toBeLessThanOrEqual(0.95);
    expect(choiceSuccessChance(attrs, ['finishing'], 99, 0)).toBeGreaterThanOrEqual(0.05);
  });
});

describe('턴 시뮬레이션', () => {
  it('같은 입력이면 항상 같은 결과 (재현성)', () => {
    const player = star();
    expect(simulateTurn(input(player)).result).toEqual(simulateTurn(input(player)).result);
  });

  it('세션은 JSON으로 저장했다가 이어서 진행해도 결과가 같다', () => {
    const player = star();
    const direct = simulateTurn(input(player)).result;
    let session = advanceTurn(createTurnSession(input(player)));
    session = JSON.parse(JSON.stringify(session));
    if (session.status === 'AWAITING_HIGHLIGHT') session = advanceTurn(resolveHighlight(session, null));
    expect(finalizeTurn(JSON.parse(JSON.stringify(session)))).toEqual(direct);
  });

  it('기록 정합성: 출전·시간·골이 팀 경기 범위를 넘지 않는다', () => {
    const { result } = simulateTurn(input(star()));
    for (const match of result.matches) {
      if (!match.player) continue;
      const teamGoals = match.playerTeamSide === 'HOME' ? match.score.home : match.score.away;
      expect(match.player.goals).toBeLessThanOrEqual(teamGoals);
      expect(match.player.minutes).toBeGreaterThan(0);
      expect(match.player.minutes).toBeLessThanOrEqual(90);
      expect(match.player.rating).toBeGreaterThanOrEqual(3);
      expect(match.player.rating).toBeLessThanOrEqual(10);
    }
    const line = competitiveLine(result.playerStats);
    expect(line.appearances).toBeLessThanOrEqual(result.matches.length);
    expect(line.starts).toBeLessThanOrEqual(line.appearances);
  });

  it('리그 순위표: 전 구단 포함, 승점 = 3승 + 무', () => {
    const { result } = simulateTurn(input(star()));
    expect(result.leagueTable).toHaveLength(20);
    for (const row of result.leagueTable) {
      expect(row.played).toBe(19);
      expect(row.points).toBe(row.wins * 3 + row.draws);
    }
  });

  it('후반기 순위표는 전반기 기록을 이어받아 시즌 38경기가 된다', () => {
    const player = star();
    const first = simulateTurn(input(player)).result;
    const second = simulateTurn(
      input(player, 'SECOND_HALF', 1, { progress: first.progress, leagueTable: first.leagueTable }),
    ).result;
    for (const row of second.leagueTable) expect(row.played).toBe(38);
    const ratings = summarizeSeasonRatings(first, second);
    expect(ratings.season).not.toBeNull();
    expect(ratings.firstHalf).not.toBeNull();
  });
});

describe('능력치-결과 분리 원칙', () => {
  // 포처 OVR 가중치는 결정력 6 : 오프더볼 6 → 두 값을 맞바꿔도 OVR은 같다.
  // 득점 프로필은 결정력 6 : 오프더볼 4 → 개인 득점 능력은 달라진다.
  const finisher = star({ attributes: { finishing: 92, offTheBall: 60 } });
  const mover = star({ attributes: { finishing: 60, offTheBall: 92 } });

  it('OVR·멘탈·지구력이 같으면 팀 결과는 완전히 같다', () => {
    const sameOvrMover = { ...mover, ovr: finisher.ovr };
    for (const seed of [1, 2, 3]) {
      const a = simulateTurn(input(finisher, 'FIRST_HALF', seed)).result;
      const b = simulateTurn(input(sameOvrMover, 'FIRST_HALF', seed)).result;
      expect(a.matches.map((m) => m.score)).toEqual(b.matches.map((m) => m.score));
      expect(a.leagueTable).toEqual(b.leagueTable);
    }
  });

  it('세부 능력치 분배가 다르면 개인 기록은 달라진다', () => {
    let finisherGoals = 0;
    let moverGoals = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      finisherGoals += competitiveLine(simulateTurn(input(finisher, 'FIRST_HALF', seed)).result.playerStats).goals;
      moverGoals += competitiveLine(simulateTurn(input(mover, 'FIRST_HALF', seed)).result.playerStats).goals;
    }
    expect(finisherGoals).toBeGreaterThan(moverGoals);
  });
});

describe('체력과 출전', () => {
  it('지구력이 높은 박투박은 같은 조건에서 더 많이 뛴다', () => {
    const role = { position: 'CM', playStyle: 'BOX_TO_BOX' } as const;
    const tireless = star({ role, attributes: { stamina: 95 } });
    const fragile = star({ role, attributes: { stamina: 45 } });
    let tirelessMinutes = 0;
    let fragileMinutes = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      tirelessMinutes += competitiveLine(simulateTurn(input(tireless, 'FIRST_HALF', seed)).result.playerStats).minutes;
      fragileMinutes += competitiveLine(simulateTurn(input(fragile, 'FIRST_HALF', seed)).result.playerStats).minutes;
    }
    expect(tirelessMinutes).toBeGreaterThan(fragileMinutes);
  });

  it('턴 시작 체력이 낮으면 출전이 줄어든다', () => {
    const fresh = star();
    const tired = { ...fresh, condition: 15 };
    const freshApps = competitiveLine(simulateTurn(input(fresh)).result.playerStats).minutes;
    const tiredApps = competitiveLine(simulateTurn(input(tired)).result.playerStats).minutes;
    expect(freshApps).toBeGreaterThan(tiredApps);
  });
});

describe('하이라이트 경기 선정', () => {
  it('같은 턴은 재현 가능하고, 더비에서도 직접 선택 횟수는 무작위 0~2회다', () => {
    const counts = new Set<number>();
    for (let seed = 1; seed <= 30; seed++) {
      const planned = createTurnSession(input(star(), 'FIRST_HALF', seed));
      expect(planned.highlight).toEqual(chooseHighlight(planned));
      const paused = advanceTurn(planned);
      const scene = buildHighlightScene(paused);
      counts.add(scene?.situations.length ?? 0);
      if (!scene) { expect(paused.status).toBe('COMPLETE'); continue; }
      expect(scene.situations.length).toBeLessThanOrEqual(2);
      expect(scene.briefing.fixture.isDerby).toBe(true);
      const auto = simulateTurn(input(star(), 'FIRST_HALF', seed)).result;
      expect(auto.matches.find((match) => match.isHighlight)?.player?.minutes).toBeGreaterThan(0);
    }
    expect([...counts].sort()).toEqual([0, 1, 2]);
  });

  it('일반 리그 경기와 친선경기를 빅매치로 대체하지 않는다', () => {
    for (let seed = 1; seed <= 15; seed++) {
      expect(simulateTurn(input(star({ clubId: 'bournemouth' }), 'FIRST_HALF', seed)).result.highlight).toBeNull();
      const result = simulateTurn(input(star({ nationality: 'KOR' }), 'PRESEASON', seed)).result;
      if (result.highlight) {
        const fixture = createTurnSession(input(star({ nationality: 'KOR' }), 'PRESEASON', seed)).fixtures.find((f) => f.id === result.highlight!.fixtureId)!;
        expect(fixture.competitionType).not.toBe('FRIENDLY');
        expect(fixture.isFinal || fixture.isDerby).toBe(true);
      }
    }
  });

  it('컵은 실제 출전한 결승만 후보이며 일반 강팀전은 제외한다', () => {
    let finals = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const progress = [{ competitionId: 'ESP_COPA_DEL_REY', status: 'ACTIVE' as const, stageReached: '16강' }, { competitionId: 'UEFA_CL', status: 'ACTIVE' as const, stageReached: '조별리그 통과' }];
      const planned = createTurnSession(input(star({ clubId: 'real-madrid', boost: 40 }), 'SECOND_HALF', seed, { progress }));
      const fixture = planned.fixtures.find((f) => f.id === planned.highlight?.fixtureId);
      if (fixture && (planned.highlight!.kind === 'CONTINENTAL_FINAL' || planned.highlight!.kind === 'DOMESTIC_CUP_FINAL')) {
        finals++;
        expect(fixture.isFinal).toBe(true);
        const result = simulateTurn(input(star({ clubId: 'real-madrid', boost: 40 }), 'SECOND_HALF', seed, { progress })).result;
        expect(result.matches.find((m) => m.isHighlight)?.player?.minutes).toBeGreaterThan(0);
      }
    }
    expect(finals).toBeGreaterThan(0);
  });

  it('리그 우승이 확정되는 출전 경기를 잡고 이미 확정된 뒤에는 제외한다', () => {
    const session = createTurnSession(input(star(), 'SECOND_HALF', 9));
    const fixture = session.fixtures.find((f) => f.competitionType === 'LEAGUE' && f.playerTeamSide)!;
    const my = fixture.playerTeamSide === 'HOME' ? fixture.home : fixture.away;
    const other = fixture.playerTeamSide === 'HOME' ? fixture.away : fixture.home;
    my.power = 200; other.power = 1;
    session.fixtures = [{ ...fixture, id: 'title-final-day', isDerby: false, requires: undefined }];
    const row = (clubId: string, points: number) => ({ clubId, position: 1, points, played: 37, wins: 20, draws: 5, losses: 12, goalsFor: 60, goalsAgainst: 30 });
    session.carryTable = [row(my.id, 60), row(other.id, 59)];
    let title = null;
    for (let seed = 1; seed <= 20 && !title; seed++) { session.seed = seed; title = chooseHighlight(session); }
    expect(title?.kind).toBe('TITLE_DECIDER');
    session.carryTable = [row(my.id, 90), row(other.id, 30)];
    expect(chooseHighlight(session)).toBeNull();
  });

  it('미출전·탈락 경기에는 하이라이트를 만들지 않는다', () => {
    const player = { ...star(), contract: null };
    expect(createTurnSession(input(player, 'FIRST_HALF', 9)).highlight).toBeNull();
    const session = createTurnSession(input(star(), 'FIRST_HALF', 9));
    session.fixtures = session.fixtures.filter((f) => f.playerTeamSide).map((f) => ({ ...f, isDerby: true, requires: { kind: 'WIN' as const, fixtureId: 'never-played' } }));
    expect(chooseHighlight(session)).toBeNull();
  });

  it('B팀·유스는 실제 출전하는 리저브 더비만 선택 대상으로 삼는다', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const youth = makePlayer({ clubId: 'ulsan' });
      const result = simulateTurn(input(youth, 'FIRST_HALF', seed)).result;
      expect(result.playerStats.LEAGUE.appearances).toBe(0);
      expect(result.playerStats.RESERVE.appearances).toBeGreaterThan(0);
      if (result.highlight) expect(result.highlight.kind).toBe('RESERVE_DERBY');
    }
  });
});

describe('우승 기록', () => {
  it('결승에서 이기면 트로피, 지면 없음', () => {
    let wonFinals = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const progress = [{ competitionId: 'ESP_COPA_DEL_REY', status: 'ACTIVE' as const, stageReached: '16강' }];
      const { result } = simulateTurn(input(star({ clubId: 'real-madrid', boost: 40 }), 'SECOND_HALF', seed, { progress }));
      const final = result.matches.find((m) => m.competitionType === 'DOMESTIC_CUP' && m.stage === '결승');
      const hasTrophy = result.trophies.some((t) => t.competitionId === 'ESP_COPA_DEL_REY');
      const won = Boolean(final && final.score.winner === final.playerTeamSide);
      expect(hasTrophy).toBe(won);
      if (won) wonFinals++;
    }
    expect(wonFinals).toBeGreaterThan(0);
  });

  it('유스·B팀 선수에게는 1군 트로피를 기록하지 않는다', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const youth = makePlayer({ clubId: 'jeonbuk' });
      const { result } = simulateTurn(input(youth, 'SECOND_HALF', seed, { progress: [{ competitionId: 'KOR_FA_CUP', status: 'ACTIVE', stageReached: '16강' }] }));
      expect(result.trophies.filter((t) => t.teamKind === 'CLUB')).toHaveLength(0);
    }
  });
});

describe('하이라이트 선택지 반영', () => {
  it('슈팅 선택지 성공은 주인공 골로, 수비 실패는 실점으로 이어진다', () => {
    const player = star();
    const paused = advanceTurn(createTurnSession(input(player, 'FIRST_HALF', 9)));
    expect(paused.status).toBe('AWAITING_HIGHLIGHT');
    const fixtureId = paused.highlight!.fixtureId;

    const allGoals = advanceTurn(
      resolveHighlight(paused, {
        fixtureId,
        resolved: [1, 2, 3].map((i) => ({ situationId: `s${i}`, kind: 'SHOT' as const, success: true, chance: 0.5 })),
      }),
    );
    const line = allGoals.logs.find((l) => l.isHighlight)!;
    expect(line.player!.goals).toBeGreaterThanOrEqual(3);

    const leaky = advanceTurn(
      resolveHighlight(paused, {
        fixtureId,
        resolved: [1, 2].map((i) => ({ situationId: `d${i}`, kind: 'DEFEND' as const, success: false, chance: 0.5 })),
      }),
    );
    const leakyLog = leaky.logs.find((l) => l.isHighlight)!;
    const conceded = leakyLog.playerTeamSide === 'HOME' ? leakyLog.score.away : leakyLog.score.home;
    expect(conceded).toBeGreaterThanOrEqual(2);
  });

  it('브리핑에 라이벌·옛 파트너 이름이 상대 바둑돌로 표시된다', () => {
    const rivalNpc: NpcPlayer = {
      id: 'npc-rival', name: '라이벌 공격수', nationality: 'ENG', birthYear: 2008, position: 'ST',
      ovr: 85, reputation: 60, clubId: 'tottenham', playingTime: 'STARTER',
    };
    const formerPartner: NpcPlayer = { ...rivalNpc, id: 'npc-old', name: '옛 파트너', position: 'AM', clubId: 'chelsea' };
    const session = advanceTurn(
      createTurnSession(
        input(star({ clubId: 'arsenal' }), 'FIRST_HALF', 9, {
          rival: {
            rival: { npcId: rivalNpc.id, reason: 'DERBY', category: 'FORWARD', formedAt: { season: 2026, phase: 'FIRST_HALF' }, headToHead: { meetings: 0, wins: 0, draws: 0, losses: 0 } },
            npc: rivalNpc,
          },
          formerPartners: [formerPartner],
        }),
      ),
    );
    const briefing = getHighlightBriefing(session)!;
    const opponentClub = briefing.opponent.id;
    const tagged = briefing.taggedPlayers.filter((p) => p.tag !== 'PROTAGONIST');
    if (opponentClub === 'tottenham') expect(tagged).toContainEqual(expect.objectContaining({ name: '라이벌 공격수', tag: 'RIVAL' }));
    if (opponentClub === 'chelsea') expect(tagged).toContainEqual(expect.objectContaining({ name: '옛 파트너', tag: 'FORMER_PARTNER' }));
    expect(buildAutoHighlightOutcome(session)?.resolved.length).toBeGreaterThan(0);
  });
});

describe('파트너 · 라이벌', () => {
  const partnerNpc: NpcPlayer = {
    id: 'npc-partner', name: '단짝 플레이메이커', nationality: 'ESP', birthYear: 2008, position: 'AM',
    playStyle: 'PLAYMAKER', ovr: 86, reputation: 60, clubId: 'arsenal', playingTime: 'KEY',
  };
  const partner = {
    npcId: partnerNpc.id, bondType: 'STRIKER_PLAYMAKER' as const, formedAt: { season: 2026, phase: 'FIRST_HALF' as const },
    formedClubId: 'arsenal', status: 'ACTIVE' as const,
    totals: { appearancesTogether: 0, wins: 0, draws: 0, losses: 0, jointGoals: 0, cleanSheetsTogether: 0 },
  };

  it('같은 팀 파트너와의 동반 출전·합작 골이 집계된다', () => {
    let joint = 0;
    for (const seed of [1, 2, 3]) {
      const { result } = simulateTurn(input(star(), 'FIRST_HALF', seed, { partner: { partner, npc: partnerNpc } }));
      expect(result.partner?.appearancesTogether).toBeGreaterThan(10);
      joint += result.partner!.jointGoals;
    }
    expect(joint).toBeGreaterThan(0);
  });

  it('파트너가 다른 팀이면 집계하지 않는다', () => {
    const moved = { ...partnerNpc, clubId: 'chelsea' };
    const { result } = simulateTurn(input(star(), 'FIRST_HALF', 1, { partner: { partner, npc: moved } }));
    expect(result.partner).toBeNull();
  });

  it('라이벌과 이번 턴 기록을 나란히 비교하고 맞대결을 기록한다', () => {
    const rivalNpc: NpcPlayer = { ...partnerNpc, id: 'npc-rival', name: '라이벌', position: 'ST', clubId: 'tottenham', playingTime: 'STARTER' };
    const { result } = simulateTurn(
      input(star(), 'FIRST_HALF', 1, {
        rival: {
          rival: { npcId: rivalNpc.id, reason: 'DERBY', category: 'FORWARD', formedAt: { season: 2026, phase: 'FIRST_HALF' }, headToHead: { meetings: 0, wins: 0, draws: 0, losses: 0 } },
          npc: rivalNpc,
        },
      }),
    );
    expect(result.rival?.rival.appearances).toBeGreaterThan(0);
    expect(result.rival?.headToHead.length).toBeGreaterThanOrEqual(1);
  });
});
