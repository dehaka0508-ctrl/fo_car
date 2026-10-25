/**
 * 통산 기록 · 기록 경신 · 구단 레전드
 *
 * - 매 턴 결과를 구단별·리그별·국가대표 통산 기록에 더한다.
 * - 팀/리그/국가대표 역대 기록(실존 레전드 데이터)을 넘어서면 기존 보유자와 비교하는 팝업 알림을 띄운다.
 * - 한 팀에서 대기록을 세운 뒤 이적·은퇴하면 '구단 레전드' 칭호를 주고,
 *   그 팀의 동 포지션 역사적 레전드와 나란히 언급하는 헌사를 남긴다 (데이터가 없으면 언급 생략).
 */
import { POSITION_META } from '@/data/playstyles';
import type {
  CareerStatLine,
  GameState,
  HistoricRecord,
  ID,
  PlayerStatLine,
  RecordCategory,
  TurnResult,
} from '@/types/game';
import { mergeStatLines } from './simulator';
import { pushNotice } from './state';
import { clubName, legendsFor, type SimulationWorld } from './world';

const CATEGORY_LABEL: Record<RecordCategory, { label: string; unit: string }> = {
  GOALS: { label: '최다 득점', unit: '골' },
  ASSISTS: { label: '최다 도움', unit: '도움' },
  APPEARANCES: { label: '최다 출전', unit: '경기' },
  CLEAN_SHEETS: { label: '최다 클린시트', unit: '회' },
  TROPHIES: { label: '최다 우승', unit: '회' },
};

export function emptyCareerLine(season: number): CareerStatLine {
  return { appearances: 0, goals: 0, assists: 0, cleanSheets: 0, trophies: 0, firstSeason: season, lastSeason: season };
}

function addLine(base: CareerStatLine | undefined, line: PlayerStatLine, trophies: number, season: number): CareerStatLine {
  const current = base ?? emptyCareerLine(season);
  return {
    appearances: current.appearances + line.appearances,
    goals: current.goals + line.goals,
    assists: current.assists + line.assists,
    cleanSheets: current.cleanSheets + line.cleanSheets,
    trophies: current.trophies + trophies,
    firstSeason: current.firstSeason,
    lastSeason: season,
  };
}

/** 턴 결과를 선수 통산·구단별·리그별·국가대표 기록에 반영한다. */
export function applyTurnToCareer(state: GameState, result: TurnResult): GameState {
  const { player } = state;
  const career = { ...player.career };
  for (const type of Object.keys(career) as Array<keyof typeof career>) {
    career[type] = mergeStatLines(career[type], result.playerStats[type]);
  }
  const season = result.turn.season;
  const clubLine = mergeStatLines(result.playerStats.LEAGUE, result.playerStats.DOMESTIC_CUP, result.playerStats.CONTINENTAL);
  const clubTrophies = result.trophies.filter((t) => t.teamKind === 'CLUB').length;

  const careerByClub = { ...state.careerByClub };
  if (result.clubId && (clubLine.appearances > 0 || clubTrophies > 0)) {
    careerByClub[result.clubId] = addLine(careerByClub[result.clubId], clubLine, clubTrophies, season);
  }
  const careerByLeague = { ...state.careerByLeague };
  if (result.leagueId && result.playerStats.LEAGUE.appearances > 0) {
    careerByLeague[result.leagueId] = addLine(careerByLeague[result.leagueId], result.playerStats.LEAGUE, 0, season);
  }
  const intl = result.playerStats.INTERNATIONAL;
  const nationalTeam = {
    ...player.nationalTeam,
    caps: player.nationalTeam.caps + intl.appearances,
    goals: player.nationalTeam.goals + intl.goals,
    assists: player.nationalTeam.assists + intl.assists,
    lastCallUp: result.nationalDuty ? result.turn : player.nationalTeam.lastCallUp,
  };
  return { ...state, player: { ...player, career, nationalTeam }, careerByClub, careerByLeague };
}

function currentValue(state: GameState, record: HistoricRecord): number {
  const pick = (line: CareerStatLine | undefined) => {
    if (!line) return 0;
    switch (record.category) {
      case 'GOALS': return line.goals;
      case 'ASSISTS': return line.assists;
      case 'APPEARANCES': return line.appearances;
      case 'CLEAN_SHEETS': return line.cleanSheets;
      case 'TROPHIES': return line.trophies;
    }
  };
  if (record.scope === 'CLUB') return pick(state.careerByClub[record.scopeId]);
  if (record.scope === 'LEAGUE') return pick(state.careerByLeague[record.scopeId]);
  if (record.scopeId !== state.player.profile.nationality) return 0;
  const nt = state.player.nationalTeam;
  return record.category === 'GOALS' ? nt.goals : record.category === 'APPEARANCES' ? nt.caps : record.category === 'ASSISTS' ? nt.assists : 0;
}

function scopeName(world: SimulationWorld, record: HistoricRecord): string {
  if (record.scope === 'CLUB') return clubName(world, record.scopeId);
  if (record.scope === 'LEAGUE') return world.leagues[record.scopeId]?.nameKo ?? record.scopeId;
  return `${world.nations[record.scopeId]?.nameKo ?? record.scopeId} 대표팀`;
}

const MILESTONES: Partial<Record<RecordCategory, number[]>> = {
  GOALS: [50, 100, 200, 300],
  APPEARANCES: [100, 200, 300, 400, 500],
  ASSISTS: [50, 100, 150],
  CLEAN_SHEETS: [50, 100, 150],
};

/** 역대 기록 경신과 구단 통산 이정표를 확인한다. 이전 값과 비교해 이번에 넘어선 것만 알린다. */
export function checkRecordBreaks(state: GameState, world: SimulationWorld, before: GameState): GameState {
  let next = state;
  for (const record of world.records) {
    const already = next.recordBreaks.some(
      (b) => b.scope === record.scope && b.scopeId === record.scopeId && b.category === record.category,
    );
    if (already) continue;
    const value = currentValue(next, record);
    if (value <= record.value) continue;
    const { label, unit } = CATEGORY_LABEL[record.category];
    const where = scopeName(world, record);
    next = {
      ...next,
      recordBreaks: [
        ...next.recordBreaks,
        {
          scope: record.scope,
          scopeId: record.scopeId,
          category: record.category,
          previousHolder: record.holderName,
          previousValue: record.value,
          newValue: value,
          turn: state.turn,
        },
      ],
    };
    next = pushNotice(next, {
      kind: 'RECORD',
      title: `신기록! ${where} 역대 ${label}`,
      body: `${state.player.profile.name}이(가) ${record.holderName}의 ${record.value}${unit}을(를) 넘어 ${value}${unit}으로 ${where} 역대 ${label} 기록을 새로 썼다!`,
      popup: true,
    });
  }

  // 구단 통산 이정표
  for (const [clubId, line] of Object.entries(next.careerByClub)) {
    const prev = before.careerByClub[clubId];
    for (const [category, marks] of Object.entries(MILESTONES) as Array<[RecordCategory, number[]]>) {
      const key = category === 'GOALS' ? 'goals' : category === 'ASSISTS' ? 'assists' : category === 'APPEARANCES' ? 'appearances' : 'cleanSheets';
      const now = line[key];
      const was = prev?.[key] ?? 0;
      const passed = marks.filter((m) => was < m && now >= m);
      for (const mark of passed) {
        next = pushNotice(next, {
          kind: 'RECORD',
          title: `${clubName(world, clubId)} 통산 ${mark}${CATEGORY_LABEL[category].unit}`,
          body: `${clubName(world, clubId)} 소속으로 통산 ${mark}${CATEGORY_LABEL[category].unit} 고지를 밟았다.`,
        });
      }
    }
  }
  return next;
}

/** 레전드 기준: 오래 뛰며 큰 기록을 남겼거나, 구단 역대 기록을 깼거나 */
export function isLegendWorthy(state: GameState, clubId: ID): boolean {
  const line = state.careerByClub[clubId];
  if (!line) return false;
  const brokeClubRecord = state.recordBreaks.some((b) => b.scope === 'CLUB' && b.scopeId === clubId);
  if (brokeClubRecord) return true;
  if (line.appearances >= 300) return true;
  return (
    line.appearances >= 150 &&
    (line.goals >= 80 || line.assists >= 60 || line.cleanSheets >= 60 || line.trophies >= 3)
  );
}

/** 이적·은퇴로 팀을 떠날 때 레전드 헌액 여부를 판정한다. */
export function evaluateDeparture(
  state: GameState,
  world: SimulationWorld,
  clubId: ID,
  reason: 'TRANSFER' | 'RETIREMENT',
): GameState {
  if (state.legends.some((l) => l.clubId === clubId) || !isLegendWorthy(state, clubId)) return state;
  const line = state.careerByClub[clubId];
  const position = state.player.profile.role.position;
  const group = POSITION_META[position].group;
  const legends = legendsFor(world, clubId);
  const compared = [
    ...legends.filter((l) => l.position === position),
    ...legends.filter((l) => l.position !== position && POSITION_META[l.position].group === group),
  ]
    .slice(0, 2)
    .map((l) => l.name);
  const club = clubName(world, clubId);
  const name = state.player.profile.name;
  const record = `${line.firstSeason}–${line.lastSeason} · ${line.appearances}경기 ${line.goals}골 ${line.assists}도움${line.trophies ? ` · 우승 ${line.trophies}회` : ''}`;
  const farewell = reason === 'RETIREMENT' ? '은퇴와 함께' : '팀을 떠나며';
  const tribute = compared.length
    ? `${name}이(가) ${farewell} ${club}의 레전드로 헌액되었다. 팬들은 이제 ${name}을(를) ${compared.join(', ')}와(과) 나란히 ${club} 역사상 최고의 ${POSITION_META[position].label}로 기억할 것이다. (${record})`
    : `${name}이(가) ${farewell} ${club}의 레전드로 헌액되었다. (${record})`;

  const next: GameState = {
    ...state,
    legends: [...state.legends, { clubId, turn: state.turn, reason, comparedWith: compared, tribute }],
  };
  return pushNotice(next, { kind: 'LEGEND', title: `${club} 레전드 헌액`, body: tribute, popup: true });
}

/** 공식전 통산 (리그·국내컵·대륙컵·국가대표) */
export function careerTotals(state: GameState): PlayerStatLine {
  const c = state.player.career;
  return mergeStatLines(c.LEAGUE, c.DOMESTIC_CUP, c.CONTINENTAL, c.INTERNATIONAL);
}
