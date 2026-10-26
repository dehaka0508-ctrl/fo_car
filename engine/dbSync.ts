/**
 * 세이브 ↔ 구단 DB 동기화
 *
 * 외부 DB(data/external/)를 넣거나 고치면 활성 리그·구단 구성이 바뀐다.
 * 이전에 만든 세이브를 계속 플레이할 수 있도록:
 * - 새로 생긴 구단은 시작 상태로 추가하고, 사라진 구단은 제거한다.
 * - 구단이 활성 리그 밖에 남아 있으면 DB 기준 리그로 돌려놓는다.
 * - 주인공의 소속 구단이 사라졌으면 FA가 되고 알림을 남긴다.
 * - 사라진 구단의 오퍼는 지우고, 그 구단에 있던 NPC는 무소속으로 둔다.
 */
import type { GameState } from '@/types/game';
import { pushNotice } from './state';
import type { SimulationWorld } from './world';

export function syncSaveWithDatabase(state: GameState, world: SimulationWorld, signature: string): GameState {
  if (state.dbSignature === signature) return state;

  const clubs = { ...state.clubs };
  for (const id of Object.keys(clubs)) {
    if (!world.clubs[id]) delete clubs[id];
    else if (!world.leagues[clubs[id].leagueId]) clubs[id] = { ...clubs[id], leagueId: world.clubStates[id].leagueId };
  }
  for (const [id, initial] of Object.entries(world.clubStates)) {
    if (!clubs[id]) clubs[id] = structuredClone(initial);
  }

  const exists = (id: string | null | undefined) => Boolean(id && clubs[id]);
  let next: GameState = {
    ...state,
    dbSignature: signature,
    clubs,
    offers: state.offers.filter((o) => exists(o.clubId)),
    npcs: Object.fromEntries(
      Object.entries(state.npcs).map(([id, npc]) => [id, npc.clubId && !exists(npc.clubId) ? { ...npc, clubId: null } : npc]),
    ),
    leagueTable: state.leagueTable.every((row) => exists(row.clubId)) ? state.leagueTable : [],
  };

  const { player } = next;
  const lostContract = player.contract && !exists(player.contract.clubId);
  const lostParent = player.parentContract && !exists(player.parentContract.clubId);
  if (lostContract || lostParent) {
    const former = player.contract?.clubId ?? player.parentContract?.clubId ?? '';
    // 임대 구단만 사라졌으면 원소속 구단으로 복귀, 둘 다 없으면 FA
    const contract = lostContract ? (player.parentContract && !lostParent ? player.parentContract : null) : player.contract;
    const parentContract = lostContract || lostParent ? null : player.parentContract;
    const clubHistory = player.clubHistory.map((spell) =>
      spell.toSeason === null && !exists(spell.clubId) ? { ...spell, toSeason: next.turn.season } : spell,
    );
    next = {
      ...next,
      player: { ...player, contract, parentContract, clubHistory },
      progress: contract ? next.progress : [],
      leagueTable: contract ? next.leagueTable : [],
    };
    next = pushNotice(next, {
      kind: 'CONTRACT',
      title: '구단 데이터 변경',
      body: contract
        ? `구단 DB가 바뀌어 ${former} 계약이 정리됐다. 원소속 구단으로 돌아간다.`
        : `구단 DB가 바뀌어 소속 구단(${former})이 사라졌다. FA 신분으로 새 팀을 찾자.`,
      popup: true,
    });
  }
  return next;
}
