import { describe, expect, it } from 'vitest';
import {
  bodyModifiers,
  determineInitialSquadStatus,
  generateInitialAttributes,
} from '@/engine/character';
import { calculateOVR, rankPlayStyleFit } from '@/engine/ovr';
import {
  ATTRIBUTE_KEYS,
  PLAYSTYLES_BY_POSITION,
  POSITIONS,
  type Attributes,
  type PlayerRole,
  type PlayStyle,
} from '@/types/game';

const flat = (value: number): Attributes =>
  Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, value])) as Attributes;

const allRoles = (): PlayerRole[] =>
  POSITIONS.flatMap((position) =>
    (PLAYSTYLES_BY_POSITION[position] as readonly PlayStyle[]).map(
      (playStyle) => ({ position, playStyle }) as PlayerRole,
    ),
  );

describe('OVR', () => {
  it('모든 능력치가 같으면 어떤 스타일이든 OVR도 같다', () => {
    for (const role of allRoles()) expect(calculateOVR(flat(63), role)).toBe(63);
  });

  it('결정력·오프더볼이 높으면 타겟맨보다 포처 OVR이 높다', () => {
    const attrs = { ...flat(50), finishing: 90, offTheBall: 90 };
    const poacher = calculateOVR(attrs, { position: 'ST', playStyle: 'POACHER' });
    const targetMan = calculateOVR(attrs, { position: 'ST', playStyle: 'TARGET_MAN' });
    expect(poacher).toBeGreaterThan(targetMan);
  });

  it('GK OVR은 필드 스탯을 무시한다', () => {
    const attrs = { ...flat(99), reflexes: 40, goalKick: 40, gkPositioning: 40, gkRange: 40, organization: 40, distribution: 40 };
    expect(calculateOVR(attrs, { position: 'GK', playStyle: 'CLASSIC_GOALKEEPER' })).toBe(40);
  });

  it('스타일 적합도는 높은 순으로 정렬된다', () => {
    const fits = rankPlayStyleFit({ ...flat(50), vision: 85, kickAccuracy: 85 }, 'CM');
    expect(fits[0].playStyle).toBe('DEEP_LYING_PLAYMAKER');
    expect(fits.map((f) => f.ovr)).toEqual([...fits.map((f) => f.ovr)].sort((a, b) => b - a));
  });
});

describe('캐릭터 생성', () => {
  it('같은 시드면 같은 능력치, 다른 시드면 다른 능력치', () => {
    const role: PlayerRole = { position: 'CM', playStyle: 'MEZZALA' };
    expect(generateInitialAttributes(role, 180, 75, 7)).toEqual(generateInitialAttributes(role, 180, 75, 7));
    expect(generateInitialAttributes(role, 180, 75, 7)).not.toEqual(generateInitialAttributes(role, 180, 75, 8));
  });

  it('16세 초기 OVR은 모든 포지션·스타일에서 비슷한 범위다', () => {
    for (const role of allRoles()) {
      const ovr = calculateOVR(generateInitialAttributes(role, 182, 76, 3), role);
      expect(ovr).toBeGreaterThanOrEqual(42);
      expect(ovr).toBeLessThanOrEqual(62);
    }
  });

  it('키가 크고 무거우면 제공권·몸싸움↑ 민첩성·가속력↓', () => {
    const role: PlayerRole = { position: 'CB', playStyle: 'STOPPER' };
    const big = generateInitialAttributes(role, 196, 92, 11);
    const small = generateInitialAttributes(role, 170, 62, 11);
    expect(big.aerial).toBeGreaterThan(small.aerial);
    expect(big.strength).toBeGreaterThan(small.strength);
    expect(big.agility).toBeLessThan(small.agility);
    expect(big.acceleration).toBeLessThan(small.acceleration);
  });

  it('표준 체격은 보정이 거의 없다', () => {
    const mods = bodyModifiers(180, 72.9); // BMI 22.5
    for (const value of Object.values(mods)) expect(Math.abs(value ?? 0)).toBeLessThan(0.1);
  });

  it('시작 입지: OVR과 팀 실력 차이로 1군/B팀/유스가 정해진다', () => {
    expect(determineInitialSquadStatus(60, 55, false)).toMatchObject({ level: 'FIRST_TEAM', playingTime: 'STARTER' });
    expect(determineInitialSquadStatus(53, 55, false)).toMatchObject({ level: 'FIRST_TEAM', playingTime: 'BACKUP' });
    expect(determineInitialSquadStatus(55, 62, false)).toMatchObject({ level: 'RESERVE', playingTime: 'RESERVE' });
    expect(determineInitialSquadStatus(52, 86, false)).toMatchObject({ level: 'YOUTH', playingTime: 'RESERVE' });
    expect(determineInitialSquadStatus(56, 55, true)).toMatchObject({ level: 'FIRST_TEAM', playingTime: 'GK_FIRST' });
  });
});
