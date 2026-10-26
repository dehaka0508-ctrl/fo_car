/**
 * 세이브 ↔ 구단 DB 동기화
 *
 * 외부 DB(data/external/)를 넣거나 고치면 활성 리그·구단 구성이 바뀐다.
 * 이전에 만든 세이브를 계속 플레이할 수 있도록:
 * - 새로 생긴 구단은 시작 상태로 추가하고, 사라진 구단은 제거한다.
 * - 구단이 활성 리그 밖에 남아 있으면 DB 기준 리그로 돌려놓는다.
 * - 주인공의 소속 구단이 사라졌으면 FA가 되고 알림을 남긴다.
 * - 사라진 구단의 오퍼는 지우고, 그 구단에 있던 NPC는 무소속으로 둔다.
 * - 단, 내장 샘플 구단이 외부 DB의 같은 구단으로 바뀐 경우(id만 달라짐)는 이름으로 찾아 id를 옮긴다.
 */
import { CLUBS as SAMPLE_CLUBS } from '@/data/clubs';
import type { GameState, ID } from '@/types/game';
import { pushNotice } from './state';
import { findClubId, type SimulationWorld } from './world';

/** 세이브에만 있는 구단 id → 새 DB의 같은 구단 id (내장 샘플의 이름·국가로 찾는다) */
export function migratedClubIds(state: GameState, world: SimulationWorld): Record<ID, ID> {
  const map: Record<ID, ID> = {};
  const taken = new Set(Object.keys(state.clubs).filter((id) => world.clubs[id]));
  for (const id of Object.keys(state.clubs)) {
    const old = SAMPLE_CLUBS[id];
    if (world.clubs[id] || !old) continue;
    const target = findClubId(world.clubs, old.name, old.nation) ?? findClubId(world.clubs, old.nameKo, old.nation);
    if (!target || taken.has(target) || world.clubs[target].nation !== old.nation) continue;
    map[id] = target;
    taken.add(target);
  }
  return map;
}

/** 세이브 전체에서 구단 id(키·값)를 바꾼다. 구단 id는 소문자라 다른 문자열(대문자 코드·한글 이름)과 겹치지 않는다 */
function renameClubIds(state: GameState, map: Record<ID, ID>): GameState {
  const ids = Object.keys(map);
  if (!ids.length) return state;
  const pattern = new RegExp(`"(${ids.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})"`, 'g');
  return JSON.parse(JSON.stringify(state).replace(pattern, (_, id: string) => JSON.stringify(map[id]))) as GameState;
}

export function syncSaveWithDatabase(state: GameState, world: SimulationWorld, signature: string): GameState {
  if (state.dbSignature === signature) return state;

  const renames = migratedClubIds(state, world);
  state = renameClubIds(state, renames);
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
  const moved = Object.keys(renames).length;
  if (moved) {
    next = pushNotice(next, {
      kind: 'CONTRACT',
      title: '구단 데이터 갱신',
      body: `구단 DB가 ${Object.keys(world.leagues).length}개 리그 ${Object.keys(world.clubs).length}개 구단으로 바뀌었다. 기존 구단 ${moved}곳을 새 데이터로 옮겼다.`,
    });
  }
  return next;
}
