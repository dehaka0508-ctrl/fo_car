import { createPlayer } from '@/engine/character';
import { calculateOVR } from '@/engine/ovr';
import { createDefaultWorld } from '@/engine/world';
import type { Attributes, PlayerRole, PlayerState, SquadStatus } from '@/types/game';

export const world = createDefaultWorld();

export interface TestPlayerOptions {
  clubId?: string;
  role?: PlayerRole;
  nationality?: string;
  seed?: number;
  /** 모든 능력치에 더하는 값 (성장한 선수 흉내) */
  boost?: number;
  attributes?: Partial<Attributes>;
  squad?: SquadStatus;
  age?: number;
}

export function makePlayer(options: TestPlayerOptions = {}): PlayerState {
  const role = options.role ?? { position: 'ST', playStyle: 'POACHER' };
  const player = createPlayer(
    {
      name: '테스트 선수',
      nationality: options.nationality ?? 'KOR',
      role,
      heightCm: 182,
      weightKg: 76,
      appearance: { hair: 'BLACK', skin: 3, eyes: 'DARK_BROWN' },
      clubId: options.clubId ?? 'arsenal',
    },
    world,
    { seed: options.seed ?? 1, startSeason: 2026 },
  );

  const boost = options.boost ?? 0;
  const attributes = Object.fromEntries(
    Object.entries(player.attributes).map(([key, value]) => [key, Math.min(99, value + boost)]),
  ) as Attributes;
  Object.assign(attributes, options.attributes);

  return {
    ...player,
    attributes,
    ovr: calculateOVR(attributes, role),
    age: options.age ?? player.age,
    squad:
      options.squad ??
      (boost > 0
        ? { level: 'FIRST_TEAM', playingTime: role.position === 'GK' ? 'GK_FIRST' : 'STARTER', standing: 70 }
        : player.squad),
  };
}
