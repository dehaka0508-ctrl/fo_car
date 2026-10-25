/**
 * NPC 선수 생성 · 성장/노화
 * 경쟁 선수, 영혼의 파트너, 숙명의 라이벌, 시상 후보가 모두 이 모듈로 만들어진다.
 */
import { formatName, namePoolFor } from '@/data/names';
import type {
  Appearance,
  EyeColor,
  HairColor,
  ID,
  NpcPlayer,
  PlayingTime,
  PlayStyle,
  Position,
  SkinTone,
} from '@/types/game';
import { PLAYSTYLES_BY_POSITION } from '@/types/game';
import { clamp, hashSeed, type Rng } from './rng';
import type { SimulationWorld } from './world';

export function generateName(rng: Rng, nationality: string): string {
  const pool = namePoolFor(nationality);
  return formatName(pool, rng.pick(pool.given), rng.pick(pool.family));
}

/** 구단 국적 선수 55%, 나머지는 실력 있는 국가일수록 자주 뽑힌다. */
export function pickNationality(rng: Rng, world: SimulationWorld, homeNation: string | null): string {
  if (homeNation && world.nations[homeNation] && rng.chance(0.55)) return homeNation;
  const nations = Object.values(world.nations);
  const weights = nations.map((n) => Math.exp((n.power - 70) / 6));
  return nations[rng.weightedIndex(weights)].code;
}

const SKIN_BY_REGION: Record<string, readonly SkinTone[]> = {
  AFC: [3, 4, 4, 5],
  UEFA: [2, 4, 5, 5, 5],
  CONMEBOL: [2, 3, 3, 4, 5],
  CONCACAF: [1, 2, 3, 4, 5],
  CAF: [1, 1, 2, 3],
  OFC: [3, 4, 5],
};

export function randomAppearance(rng: Rng, world: SimulationWorld, nationality: string): Appearance {
  const confederation = world.nations[nationality]?.confederation ?? 'UEFA';
  const skin = rng.pick(SKIN_BY_REGION[confederation] ?? [3]);
  const hair: HairColor = skin <= 2 || confederation === 'AFC' ? 'BLACK' : rng.pick(['BLACK', 'BROWN', 'BROWN', 'BLONDE', 'RED'] as const);
  const eyes: EyeColor =
    skin <= 3 ? rng.pick(['DARK_BROWN', 'BROWN'] as const) : rng.pick(['BROWN', 'HAZEL', 'GREEN', 'BLUE', 'GRAY'] as const);
  return { hair, skin, eyes };
}

export interface NpcSpec {
  position: Position;
  ovr: number;
  age: number;
  season: number;
  clubId: ID | null;
  playingTime: PlayingTime;
  nationality?: string;
  reputation?: number;
  playStyle?: PlayStyle;
}

export function createNpc(rng: Rng, world: SimulationWorld, spec: NpcSpec, salt: string): NpcPlayer {
  const homeNation = spec.clubId ? (world.clubs[spec.clubId]?.nation ?? null) : null;
  const nationality = spec.nationality ?? pickNationality(rng, world, homeNation);
  const styles = PLAYSTYLES_BY_POSITION[spec.position] as readonly PlayStyle[];
  return {
    id: `npc-${hashSeed(salt, rng.next())}`,
    name: generateName(rng, nationality),
    nationality,
    birthYear: spec.season - spec.age,
    position: spec.position,
    playStyle: spec.playStyle ?? rng.pick(styles),
    ovr: Math.round(clamp(spec.ovr, 40, 95)),
    reputation: Math.round(clamp(spec.reputation ?? (spec.ovr - 55) * 2, 0, 100)),
    clubId: spec.clubId,
    playingTime: spec.playingTime,
    appearance: randomAppearance(rng, world, nationality),
  };
}

export function npcAge(npc: NpcPlayer, season: number): number {
  return season - npc.birthYear;
}

/** NPC의 1년 성장·노화. 은퇴 여부도 함께 정한다. */
export function ageNpcOneSeason(rng: Rng, npc: NpcPlayer, newSeason: number): NpcPlayer {
  const age = npcAge(npc, newSeason);
  const isGK = npc.position === 'GK';
  const shifted = isGK ? age - 3 : age;
  const trend =
    shifted <= 21 ? 3 : shifted <= 24 ? 1.5 : shifted <= 28 ? 0.3 : shifted <= 30 ? -0.6 : shifted <= 32 ? -1.6 : -2.6;
  const ovr = Math.round(clamp(npc.ovr + trend + rng.normal(0, 1.2), 40, 95));
  const retireChance = shifted >= 38 ? 1 : shifted >= 36 ? 0.6 : shifted >= 34 ? 0.25 : 0;
  return {
    ...npc,
    ovr,
    reputation: Math.round(clamp(npc.reputation + (ovr - npc.ovr) * 2, 0, 100)),
    retired: npc.retired || rng.chance(retireChance),
  };
}
