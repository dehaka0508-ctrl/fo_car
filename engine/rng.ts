/**
 * 시드 기반 결정론적 난수.
 *
 * 경기마다 (게임 시드, 경기 id, 용도)로 독립된 난수 스트림을 만든다.
 * - 같은 세이브에서 같은 선택을 하면 항상 같은 결과가 나온다 (재현성).
 * - 팀 스코어 / 개인 기록 / 출전 판정이 서로 다른 스트림을 쓰므로,
 *   개인 기록 계산이 팀 결과를 바꾸지 않는다 (능력치-결과 분리 원칙).
 */

export interface Rng {
  /** [0, 1) */
  next(): number;
  float(min: number, max: number): number;
  /** [min, max] 정수 */
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  normal(mean?: number, sd?: number): number;
  poisson(lambda: number): number;
  pick<T>(items: readonly T[]): T;
  /** 가중치 배열에서 인덱스 하나를 뽑는다 */
  weightedIndex(weights: readonly number[]): number;
  shuffle<T>(items: readonly T[]): T[];
}

/** 문자열·숫자 조합을 32비트 시드로 해시 (FNV-1a + murmur3 finalizer) */
export function hashSeed(...parts: Array<string | number>): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x1f; // 구분자: ('ab','c')와 ('a','bc')를 다르게
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32 기반 난수 생성기 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const normal = (mean = 0, sd = 1): number => {
    // Box-Muller
    const u = Math.max(next(), Number.EPSILON);
    const v = next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const poisson = (lambda: number): number => {
    if (lambda <= 0) return 0;
    if (lambda > 30) return Math.max(0, Math.round(normal(lambda, Math.sqrt(lambda))));
    // Knuth
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= next();
    } while (p > limit);
    return k - 1;
  };

  const weightedIndex = (weights: readonly number[]): number => {
    const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
    if (total <= 0) return Math.floor(next() * weights.length);
    let roll = next() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= Math.max(0, weights[i]);
      if (roll < 0) return i;
    }
    return weights.length - 1;
  };

  return {
    next,
    float: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (probability) => next() < probability,
    normal,
    poisson,
    pick: (items) => items[Math.floor(next() * items.length)],
    weightedIndex,
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}

/** 여러 키로부터 독립 스트림을 만든다: rngFor(seed, fixtureId, 'score') */
export function rngFor(...parts: Array<string | number>): Rng {
  return createRng(hashSeed(...parts));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
