/**
 * 영혼의 파트너 · 숙명의 라이벌
 *
 * - 한 팀에서 3턴 이상 연속 주전이면 매 턴 일정 확률로 파트너(같은 팀)와 라이벌(다른 팀)이 생긴다.
 * - 파트너와의 합작 골·동반 출전 승률·클린시트, 라이벌과의 턴별 기록 비교·맞대결 전적을 누적한다.
 * - 파트너·라이벌도 나이를 먹고 이적·은퇴한다. 이적한 파트너는 '옛 파트너'로 남아
 *   하이라이트 경기에서 상대 팀 바둑돌로 재회하거나, 그 팀에서 오퍼가 오는 서사로 이어진다.
 */
import { POSITION_META } from '@/data/playstyles';
import type {
  GameState,
  ID,
  NpcPlayer,
  PartnerBondType,
  Position,
  PositionGroup,
  Rival,
  RivalReason,
  SoulPartner,
  TurnResult,
} from '@/types/game';
import { ageNpcOneSeason, createNpc } from './npc';
import { clamp, rngFor, type Rng } from './rng';
import { isRegularRole } from './squad';
import { pushNotice } from './state';
import { clubName, getLeagueClubIds, type SimulationWorld } from './world';

export const NARRATIVE_CONFIG = {
  minStarterTurns: 3,
  partnerChance: 0.3,
  rivalChance: 0.25,
  partnerTransferChance: 0.12,
  rivalTransferChance: 0.1,
  globalStarReputation: 75,
} as const;

const BOND_LABEL: Record<PartnerBondType, string> = {
  STRIKE_DUO: '투톱',
  WING_PAIR: '양 날개',
  STRIKER_PLAYMAKER: '스트라이커-플레이메이커',
  MIDFIELD_DUO: '중원 듀오',
  CENTER_BACK_DUO: '센터백 듀오',
  FLANK_DUO: '측면 콤비',
  KEEPER_DEFENDER: '골키퍼-수비 리더',
};

export function bondLabel(type: PartnerBondType): string {
  return BOND_LABEL[type];
}

function partnerShape(position: Position, rng: Rng): { bond: PartnerBondType; position: Position } {
  switch (position) {
    case 'ST':
      return rng.chance(0.5) ? { bond: 'STRIKE_DUO', position: 'ST' } : { bond: 'STRIKER_PLAYMAKER', position: 'AM' };
    case 'LW':
      return rng.chance(0.6) ? { bond: 'WING_PAIR', position: 'RW' } : { bond: 'FLANK_DUO', position: 'LB' };
    case 'RW':
      return rng.chance(0.6) ? { bond: 'WING_PAIR', position: 'LW' } : { bond: 'FLANK_DUO', position: 'RB' };
    case 'AM':
      return { bond: 'STRIKER_PLAYMAKER', position: 'ST' };
    case 'CM':
      return { bond: 'MIDFIELD_DUO', position: rng.chance(0.5) ? 'CM' : 'DM' };
    case 'DM':
      return { bond: 'MIDFIELD_DUO', position: 'CM' };
    case 'LB':
      return { bond: 'FLANK_DUO', position: 'LW' };
    case 'RB':
      return { bond: 'FLANK_DUO', position: 'RW' };
    case 'CB':
      return { bond: 'CENTER_BACK_DUO', position: 'CB' };
    case 'GK':
      return { bond: 'KEEPER_DEFENDER', position: 'CB' };
  }
}

const GROUP_POSITIONS: Record<PositionGroup, Position[]> = {
  FORWARD: ['ST', 'LW', 'RW'],
  MIDFIELDER: ['AM', 'CM', 'DM'],
  DEFENDER: ['CB', 'LB', 'RB'],
  GOALKEEPER: ['GK'],
};

/** 주인공이 떠나는 팀에 파트너가 남으면 이별 처리 */
export function separatePartnerIfLeaving(state: GameState, world: SimulationWorld, leavingClubId: ID): GameState {
  const partner = state.partner;
  if (!partner || partner.status !== 'ACTIVE') return state;
  const npc = state.npcs[partner.npcId];
  if (!npc || npc.clubId !== leavingClubId) return state;
  const next: GameState = {
    ...state,
    partner: null,
    formerPartners: [...state.formerPartners, { ...partner, status: 'SEPARATED' }],
  };
  return pushNotice(next, {
    kind: 'PARTNER',
    title: '단짝과의 이별',
    body: `${npc.name}과(와)의 ${bondLabel(partner.bondType)}는 여기까지다. ${clubName(world, leavingClubId)}에서 함께한 시간은 기록으로 남는다.`,
  });
}

/** 턴 결과의 파트너 합작 기록·라이벌 맞대결을 누적하고, 주전 연속 기록을 갱신한다. */
export function applyTurnNarrative(state: GameState, result: TurnResult): GameState {
  let next = state;
  if (next.partner && result.partner && result.partner.npcId === next.partner.npcId) {
    const t = next.partner.totals;
    const p = result.partner;
    next = {
      ...next,
      partner: {
        ...next.partner,
        totals: {
          appearancesTogether: t.appearancesTogether + p.appearancesTogether,
          wins: t.wins + p.wins,
          draws: t.draws + p.draws,
          losses: t.losses + p.losses,
          jointGoals: t.jointGoals + p.jointGoals,
          cleanSheetsTogether: t.cleanSheetsTogether + p.cleanSheetsTogether,
        },
      },
    };
  }
  if (next.rival && result.rival?.headToHead.length) {
    const h = { ...next.rival.headToHead };
    for (const meeting of result.rival.headToHead) {
      h.meetings++;
      if (meeting.result === 'WIN') h.wins++;
      else if (meeting.result === 'DRAW') h.draws++;
      else h.losses++;
    }
    next = { ...next, rival: { ...next.rival, headToHead: h } };
  }

  const regular =
    next.player.contract &&
    next.player.squad.level === 'FIRST_TEAM' &&
    isRegularRole(next.player.squad.playingTime) &&
    result.turn.phase !== 'PRESEASON';
  const streak = regular ? next.streaks.starterTurnsAtClub + 1 : result.turn.phase === 'PRESEASON' ? next.streaks.starterTurnsAtClub : 0;
  return { ...next, streaks: { ...next.streaks, starterTurnsAtClub: streak } };
}

export function maybeFormPartner(state: GameState, world: SimulationWorld): GameState {
  const clubId = state.player.contract?.clubId;
  if (!clubId || state.partner || state.streaks.starterTurnsAtClub < NARRATIVE_CONFIG.minStarterTurns) return state;
  const rng = rngFor(state.seed, 'partner', state.turn.season, state.turn.phase);
  if (!rng.chance(NARRATIVE_CONFIG.partnerChance)) return state;

  const shape = partnerShape(state.player.profile.role.position, rng);
  const power = state.clubs[clubId].power;
  const npc = createNpc(
    rng,
    world,
    {
      position: shape.position,
      ovr: power + 2 + rng.normal(0, 2.5),
      age: Math.max(18, state.player.age + rng.int(-3, 3)),
      season: state.turn.season,
      clubId,
      playingTime: rng.chance(0.4) ? 'KEY' : 'STARTER',
    },
    `partner:${state.turn.season}:${state.turn.phase}`,
  );
  const partner: SoulPartner = {
    npcId: npc.id,
    bondType: shape.bond,
    formedAt: state.turn,
    formedClubId: clubId,
    totals: { appearancesTogether: 0, wins: 0, draws: 0, losses: 0, jointGoals: 0, cleanSheetsTogether: 0 },
    status: 'ACTIVE',
  };
  const next: GameState = { ...state, partner, npcs: { ...state.npcs, [npc.id]: npc } };
  return pushNotice(next, {
    kind: 'PARTNER',
    title: '영혼의 파트너 탄생',
    body: `${npc.name}(${POSITION_META[npc.position].label}, ${npc.ovr})과(와)의 호흡이 남다르다. ${clubName(world, clubId)}의 새로운 ${bondLabel(shape.bond)}가 탄생했다!`,
    popup: true,
  });
}

function rivalSource(state: GameState, world: SimulationWorld, rng: Rng): { clubId: ID; reason: RivalReason } | null {
  const clubId = state.player.contract?.clubId;
  if (!clubId) return null;
  const leagueId = world.clubStates[clubId].leagueId;

  if (state.player.reputation >= NARRATIVE_CONFIG.globalStarReputation) {
    const stars = Object.values(world.clubStates).filter((c) => c.leagueId !== leagueId && c.power >= 82);
    if (stars.length) return { clubId: rng.pick(stars).clubId, reason: 'GLOBAL_STAR' };
  }
  const leagueClubs = new Set(getLeagueClubIds(world, leagueId));
  const derbies = world.clubs[clubId].rivals.filter((id) => leagueClubs.has(id));
  if (derbies.length && rng.chance(0.6)) return { clubId: rng.pick(derbies), reason: 'DERBY' };

  const table = state.leagueTable;
  const myPos = table.find((r) => r.clubId === clubId)?.position;
  const near = table.filter((r) => r.clubId !== clubId && (myPos === undefined || Math.abs(r.position - myPos) <= 3));
  if (near.length) return { clubId: rng.pick(near).clubId, reason: 'TITLE_RACE' };
  const others = [...leagueClubs].filter((id) => id !== clubId);
  return others.length ? { clubId: rng.pick(others), reason: 'TITLE_RACE' } : null;
}

export function maybeFormRival(state: GameState, world: SimulationWorld): GameState {
  if (state.rival || state.streaks.starterTurnsAtClub < NARRATIVE_CONFIG.minStarterTurns) return state;
  const rng = rngFor(state.seed, 'rival', state.turn.season, state.turn.phase);
  if (!rng.chance(NARRATIVE_CONFIG.rivalChance)) return state;
  const source = rivalSource(state, world, rng);
  if (!source) return state;

  const group = POSITION_META[state.player.profile.role.position].group;
  const npc = createNpc(
    rng,
    world,
    {
      position: rng.pick(GROUP_POSITIONS[group]),
      ovr: state.player.ovr + rng.normal(1, 2.5),
      age: Math.max(17, state.player.age + rng.int(-2, 2)),
      season: state.turn.season,
      clubId: source.clubId,
      playingTime: 'KEY',
      reputation: clamp(state.player.reputation + rng.normal(0, 8), 5, 100),
    },
    `rival:${state.turn.season}:${state.turn.phase}`,
  );
  const rival: Rival = {
    npcId: npc.id,
    reason: source.reason,
    category: group,
    formedAt: state.turn,
    headToHead: { meetings: 0, wins: 0, draws: 0, losses: 0 },
  };
  const why =
    source.reason === 'DERBY' ? '더비 상대' : source.reason === 'GLOBAL_STAR' ? '발롱도르를 다투는 세계적 스타' : '순위 경쟁 팀의 간판';
  const next: GameState = { ...state, rival, npcs: { ...state.npcs, [npc.id]: npc } };
  return pushNotice(next, {
    kind: 'RIVAL',
    title: '숙명의 라이벌 등장',
    body: `${clubName(world, source.clubId)}의 ${npc.name}(${POSITION_META[npc.position].label}, ${npc.ovr}) — ${why}. 이제부터 매 턴 기록을 비교한다.`,
    popup: true,
  });
}

function pickNewClub(world: SimulationWorld, npc: NpcPlayer, rng: Rng): ID | null {
  const candidates = Object.values(world.clubStates).filter((c) => c.clubId !== npc.clubId && Math.abs(c.power - npc.ovr) <= 4);
  return candidates.length ? rng.pick(candidates).clubId : null;
}

/** 시즌 종료: 파트너·라이벌·옛 파트너의 성장·노화·이적·은퇴 */
export function evolveNarrative(state: GameState, world: SimulationWorld, newSeason: number): GameState {
  const rng = rngFor(state.seed, 'narrative-evolve', newSeason);
  let next = state;
  const npcs = { ...state.npcs };
  const tracked = [state.partner?.npcId, state.rival?.npcId, ...state.formerPartners.map((p) => p.npcId)].filter(Boolean) as ID[];
  for (const id of new Set(tracked)) {
    if (npcs[id]) npcs[id] = ageNpcOneSeason(rng, npcs[id], newSeason);
  }
  next = { ...next, npcs };

  if (next.partner) {
    const npc = npcs[next.partner.npcId];
    if (!npc || npc.retired) {
      next = pushNotice(
        { ...next, formerPartners: [...next.formerPartners, { ...next.partner, status: 'SEPARATED' }], partner: null },
        { kind: 'PARTNER', title: '단짝의 은퇴', body: `${npc?.name ?? '단짝'}이(가) 현역 은퇴를 선언했다.` },
      );
    } else if (rng.chance(NARRATIVE_CONFIG.partnerTransferChance)) {
      const destination = pickNewClub(world, npc, rng);
      if (destination) {
        npcs[npc.id] = { ...npc, clubId: destination };
        next = pushNotice(
          { ...next, npcs, formerPartners: [...next.formerPartners, { ...next.partner, status: 'SEPARATED' }], partner: null },
          {
            kind: 'PARTNER',
            title: '단짝의 이적',
            body: `${npc.name}이(가) ${clubName(world, destination)}(으)로 이적했다. 언젠가 적으로 만날지도 모른다.`,
            popup: true,
          },
        );
      }
    }
  }

  if (next.rival) {
    const npc = next.npcs[next.rival.npcId];
    if (!npc || npc.retired) {
      next = pushNotice({ ...next, rival: null }, { kind: 'RIVAL', title: '라이벌의 은퇴', body: `${npc?.name ?? '라이벌'}이(가) 은퇴했다. 한 시대가 저문다.` });
    } else if (rng.chance(NARRATIVE_CONFIG.rivalTransferChance)) {
      const destination = pickNewClub(world, npc, rng);
      if (destination) {
        next = pushNotice(
          { ...next, npcs: { ...next.npcs, [npc.id]: { ...npc, clubId: destination } } },
          { kind: 'RIVAL', title: '라이벌의 이적', body: `라이벌 ${npc.name}이(가) ${clubName(world, destination)}(으)로 이적했다.` },
        );
      }
    }
  }
  // 은퇴한 옛 파트너는 목록에서 정리
  return {
    ...next,
    formerPartners: next.formerPartners.filter((p) => next.npcs[p.npcId] && !next.npcs[p.npcId].retired).slice(-5),
  };
}
