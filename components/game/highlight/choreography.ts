/**
 * 바둑돌 하이라이트 연출 각본
 *
 * 상황(바둑돌 배치)과 판정 결과로 짧은 애니메이션 타임라인을 만든다. 화면과 무관한 순수 함수라 테스트할 수 있다.
 * - 좌표는 피치 기준 0~100 (주인공 팀은 왼쪽 → 오른쪽 공격, 상대 골문 x=100 · 우리 골문 x=0)
 * - 트랙: 바둑돌·공의 이동 구간들. 구간마다 곡선(arc)과 가감속(ease)을 줄 수 있다.
 * - 효과: 궤적선, 골망 출렁임, 태클·다이빙 표시, 큰 글자 플래시
 */
import type { MatchSituation, MatchToken, ResolvedSituation } from '@/types/game';

export interface Point {
  x: number;
  y: number;
}

export type Ease = 'linear' | 'out' | 'inOut';

export interface Segment {
  from: Point;
  to: Point;
  start: number;
  end: number;
  /** 진행 방향의 수직으로 휘는 정도 (구간 길이 대비, 음수면 반대쪽) */
  arc?: number;
  ease?: Ease;
}

export type EffectKind = 'TRAIL' | 'NET' | 'TACKLE' | 'DIVE' | 'BLOCK' | 'FLASH';

export interface Effect {
  kind: EffectKind;
  /** 시작 시각(ms) */
  at: number;
  duration: number;
  point?: Point;
  /** 궤적선: 이 구간을 따라 그린다 */
  segment?: Segment;
  /** 골망: 어느 쪽 골문인가 */
  goal?: 'THEIRS' | 'OURS';
  text?: string;
  tone?: 'good' | 'bad';
}

export interface Choreography {
  duration: number;
  /** 'ball' 또는 바둑돌 id → 이동 구간 (시간순) */
  tracks: Record<string, Segment[]>;
  effects: Effect[];
}

export const BALL = 'ball';
/** 골망 안쪽 (골라인은 x≈2.7 · 97.3) */
const THEIR_GOAL_X = 98.8;
const OUR_GOAL_X = 1.2;

// ----------------------------------------------------------------------------
// 보간
// ----------------------------------------------------------------------------

function easeValue(ease: Ease | undefined, p: number): number {
  if (ease === 'out') return 1 - (1 - p) ** 3;
  if (ease === 'inOut') return p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
  return p;
}

/** 구간 위의 한 점 (p: 0~1, 가감속 전) */
export function pointOnSegment(segment: Segment, p: number): Point {
  const q = easeValue(segment.ease, Math.min(1, Math.max(0, p)));
  const dx = segment.to.x - segment.from.x;
  const dy = segment.to.y - segment.from.y;
  const bump = (segment.arc ?? 0) * Math.sin(Math.PI * q);
  // 진행 방향의 수직 벡터 (길이 = 구간 길이). 휘어도 피치 밖으로는 나가지 않는다.
  const x = segment.from.x + dx * q - dy * bump;
  const y = segment.from.y + dy * q + dx * bump;
  return { x: Math.min(100, Math.max(0, x)), y: Math.min(99, Math.max(1, y)) };
}

/** 시각 t의 위치. 트랙이 없으면 null (원래 자리) */
export function positionAt(choreo: Choreography, id: string, t: number): Point | null {
  const track = choreo.tracks[id];
  if (!track?.length) return null;
  if (t <= track[0].start) return track[0].from;
  let current = track[0];
  for (const segment of track) {
    if (segment.start <= t) current = segment;
    else break;
  }
  if (t >= current.end) return current.to;
  return pointOnSegment(current, (t - current.start) / (current.end - current.start));
}

/** 궤적선을 그릴 점들 (구간 시작부터 시각 t까지) */
export function trailPoints(segment: Segment, t: number, steps = 16): Point[] {
  const progress = Math.min(1, Math.max(0, (t - segment.start) / (segment.end - segment.start)));
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) points.push(pointOnSegment(segment, (i / steps) * progress));
  return points;
}

// ----------------------------------------------------------------------------
// 각본 작성
// ----------------------------------------------------------------------------

class Director {
  tracks: Record<string, Segment[]> = {};
  effects: Effect[] = [];
  private last: Record<string, Point> = {};

  constructor(tokens: MatchToken[], ball: Point) {
    for (const token of tokens) this.last[token.id] = { x: token.x, y: token.y };
    this.last[BALL] = ball;
  }

  at(id: string): Point {
    return this.last[id];
  }

  move(id: string, to: Point, start: number, end: number, options: { arc?: number; ease?: Ease } = {}): Segment {
    const segment: Segment = { from: this.last[id], to, start, end, ease: options.ease ?? 'inOut', arc: options.arc };
    (this.tracks[id] ??= []).push(segment);
    this.last[id] = to;
    return segment;
  }

  effect(effect: Effect) {
    this.effects.push(effect);
  }

  build(): Choreography {
    const ends = [
      ...Object.values(this.tracks).flatMap((list) => list.map((s) => s.end)),
      ...this.effects.map((e) => e.at + e.duration),
    ];
    return { duration: Math.max(600, ...ends), tracks: this.tracks, effects: this.effects };
  }
}

/** 상황 id로 정하는 결정론적 변주 (-1 ~ 1) */
function variation(id: string, salt: number): number {
  let h = salt * 2654435761;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2246822519) >>> 0;
  return ((h % 2001) / 1000) - 1;
}

const clampY = (y: number) => Math.min(94, Math.max(6, y));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function nearest(tokens: MatchToken[], from: Point, filter: (t: MatchToken) => boolean): MatchToken | undefined {
  return tokens.filter(filter).sort((a, b) => distance(a, from) - distance(b, from))[0];
}

/**
 * 판정 결과에 맞는 연출 각본.
 * 선택지의 종류(resolved.kind)가 상황 종류와 다를 수 있다 (예: 슈팅 상황에서 동료에게 패스).
 */
export function buildChoreography(situation: MatchSituation, resolved: ResolvedSituation): Choreography {
  const { tokens } = situation;
  const me = tokens.find((t) => t.tag === 'PROTAGONIST')!;
  const mySide = me.side;
  const mates = tokens.filter((t) => t.side === mySide && t.id !== me.id);
  const opponents = tokens.filter((t) => t.side !== mySide);
  const d = new Director(tokens, situation.ball);
  const v = variation(situation.id, 1);
  const goalY = 50 + v * 4.5;
  // 상대 골키퍼 = 상대 골문(x=100)에 가장 가까운 상대 (공격 상황에서만)
  const deepest = [...opponents].sort((a, b) => b.x - a.x)[0];
  const theirKeeper = deepest && deepest.x >= 88 ? deepest : undefined;
  const ourKeeper = mates.find((t) => t.x <= 10);
  const ok = resolved.success;

  /** 상대 골문을 향한 슈팅: 성공이면 골망, 실패면 키퍼 선방 후 튕겨 나감 */
  const shotOnGoal = (shooter: string, start: number, options: { arc?: number; duration?: number } = {}) => {
    const flight = options.duration ?? 420;
    const target = { x: THEIR_GOAL_X, y: clampY(goalY) };
    if (ok) {
      const seg = d.move(BALL, target, start, start + flight, { arc: options.arc ?? 0.04, ease: 'out' });
      d.effect({ kind: 'TRAIL', at: start, duration: flight + 500, segment: seg });
      if (theirKeeper) {
        // 반대쪽으로 몸을 날렸지만 닿지 않는다
        d.move(theirKeeper.id, { x: 96, y: clampY(goalY - Math.sign(v || 1) * 9) }, start + 80, start + flight - 40, { ease: 'out' });
        d.effect({ kind: 'DIVE', at: start + 80, duration: flight, point: { x: 96, y: clampY(goalY - Math.sign(v || 1) * 9) } });
      }
      d.effect({ kind: 'NET', at: start + flight, duration: 900, goal: 'THEIRS', point: target });
      d.effect({ kind: 'FLASH', at: start + flight + 60, duration: 1100, text: 'GOAL!', tone: 'good' });
    } else {
      const save = { x: 95.5, y: clampY(goalY + v * 2) };
      if (theirKeeper) d.move(theirKeeper.id, save, start + 60, start + flight - 60, { ease: 'out' });
      const seg = d.move(BALL, save, start, start + flight, { arc: options.arc ?? 0.04, ease: 'out' });
      d.effect({ kind: 'TRAIL', at: start, duration: flight + 400, segment: seg });
      d.effect({ kind: 'DIVE', at: start + 60, duration: flight, point: save });
      d.move(BALL, { x: 90, y: clampY(save.y + (save.y > 50 ? 30 : -30)) }, start + flight, start + flight + 380, { ease: 'out', arc: 0.15 });
      d.effect({ kind: 'BLOCK', at: start + flight, duration: 600, point: save, text: '선방', tone: 'bad' });
    }
    return start + flight + (ok ? 0 : 380);
  };

  switch (resolved.kind) {
    case 'SHOT': {
      // 한 걸음 치고 들어가 슈팅
      const step = { x: Math.min(90, me.x + 3), y: me.y };
      d.move(me.id, step, 0, 260, { ease: 'out' });
      d.move(BALL, { x: step.x + 1.5, y: step.y }, 0, 260, { ease: 'out' });
      shotOnGoal(BALL, 300, { arc: v * 0.08 });
      break;
    }
    case 'SET_PIECE': {
      // 감아 차는 프리킥: 크게 휘는 궤적
      const wall = nearest(opponents, me, () => true);
      if (wall) d.effect({ kind: 'BLOCK', at: 0, duration: 400, point: wall, text: '수비벽' });
      d.move(me.id, { x: me.x + 2, y: me.y }, 120, 320, { ease: 'out' });
      if (ok) shotOnGoal(BALL, 340, { arc: 0.22 * (v >= 0 ? 1 : -1), duration: 700 });
      else {
        // 크로스바를 넘기거나 골대 옆으로
        const wide = { x: 100, y: clampY(goalY + (v >= 0 ? 16 : -16)) };
        const seg = d.move(BALL, wide, 340, 1000, { arc: 0.2 * (v >= 0 ? 1 : -1), ease: 'out' });
        d.effect({ kind: 'TRAIL', at: 340, duration: 1000, segment: seg });
        d.effect({ kind: 'BLOCK', at: 1000, duration: 600, point: wide, text: '빗나감', tone: 'bad' });
      }
      break;
    }
    case 'KEY_PASS': {
      // 가장 앞선 동료(파트너 우선)에게 패스 → 동료가 마무리
      const receiver =
        mates.find((t) => t.tag === 'PARTNER' && t.x > me.x - 15) ??
        [...mates].filter((t) => t.x > 10).sort((a, b) => b.x - a.x)[0] ??
        mates[0];
      const run = { x: Math.min(90, receiver.x + 7), y: clampY(receiver.y + (50 - receiver.y) * 0.35) };
      d.move(receiver.id, run, 0, 620, { ease: 'inOut' });
      if (ok) {
        const pass = d.move(BALL, run, 120, 620, { arc: 0.12 * (run.y > me.y ? -1 : 1), ease: 'out' });
        d.effect({ kind: 'TRAIL', at: 120, duration: 1100, segment: pass });
        d.move(receiver.id, { x: run.x + 2, y: run.y }, 640, 760, { ease: 'out' });
        shotOnGoal(BALL, 760, { arc: v * 0.06, duration: 380 });
      } else {
        // 패스 길목에서 가로채기
        const mid = { x: (me.x + run.x) / 2, y: (me.y + run.y) / 2 };
        const interceptor = nearest(opponents, mid, (t) => t.x < 92) ?? opponents[0];
        d.move(interceptor.id, mid, 120, 480, { ease: 'out' });
        const pass = d.move(BALL, mid, 120, 480, { ease: 'out' });
        d.effect({ kind: 'TRAIL', at: 120, duration: 800, segment: pass });
        d.effect({ kind: 'BLOCK', at: 480, duration: 700, point: mid, text: '차단', tone: 'bad' });
        d.move(BALL, { x: Math.max(20, mid.x - 26), y: clampY(mid.y + v * 18) }, 500, 950, { ease: 'out', arc: 0.1 });
        d.move(interceptor.id, { x: mid.x - 8, y: mid.y }, 500, 950, { ease: 'inOut' });
      }
      break;
    }
    case 'DRIBBLE': {
      // 앞을 막고 선 수비수 (등 뒤의 상대는 제외)
      const defender = nearest(opponents, me, (t) => t.x >= me.x - 1 && t.x < 92) ?? nearest(opponents, me, () => true)!;
      const side = me.y <= defender.y ? -1 : 1;
      if (ok) {
        // 수비수를 끼고 돌아 나간다 (수비수는 헛발 태클)
        const around = { x: defender.x + 1, y: clampY(defender.y + side * 9) };
        const beyond = { x: Math.min(92, defender.x + 11), y: clampY(defender.y + side * 4) };
        d.move(me.id, around, 0, 420, { ease: 'inOut', arc: 0.15 * -side });
        d.move(me.id, beyond, 420, 760, { ease: 'out' });
        d.move(BALL, { x: around.x + 2, y: around.y }, 0, 420, { ease: 'inOut', arc: 0.15 * -side });
        d.move(BALL, { x: beyond.x + 2, y: beyond.y }, 420, 760, { ease: 'out' });
        d.move(defender.id, { x: defender.x - 3, y: clampY(defender.y - side * 3) }, 260, 520, { ease: 'out' });
        d.effect({ kind: 'TACKLE', at: 260, duration: 600, point: { x: defender.x - 2, y: defender.y }, tone: 'good' });
        d.effect({ kind: 'FLASH', at: 640, duration: 900, text: '돌파!', tone: 'good' });
      } else {
        // 슬라이딩 태클에 공을 빼앗긴다
        const contact = { x: (me.x + defender.x) / 2 + 1, y: (me.y + defender.y) / 2 };
        d.move(me.id, { x: contact.x - 1.5, y: contact.y }, 0, 380, { ease: 'inOut' });
        d.move(BALL, contact, 0, 380, { ease: 'inOut' });
        d.move(defender.id, { x: contact.x + 1, y: contact.y }, 180, 420, { ease: 'out' });
        d.effect({ kind: 'TACKLE', at: 300, duration: 700, point: contact, tone: 'bad' });
        d.move(BALL, { x: Math.max(15, contact.x - 18), y: clampY(contact.y + side * -16) }, 430, 850, { ease: 'out', arc: 0.12 });
        d.move(me.id, { x: contact.x - 3, y: contact.y + 1.5 }, 430, 700, { ease: 'out' });
        d.effect({ kind: 'BLOCK', at: 430, duration: 700, point: contact, text: '빼앗김', tone: 'bad' });
      }
      break;
    }
    case 'DEFEND': {
      // 공을 가진 상대 공격수가 우리 골문으로 돌진
      const attacker = nearest(opponents, situation.ball, () => true) ?? opponents[0];
      const lane = { x: Math.max(14, attacker.x - 9), y: clampY(attacker.y + (me.y - attacker.y) * 0.4) };
      d.move(attacker.id, lane, 0, 520, { ease: 'inOut' });
      d.move(BALL, { x: lane.x - 1.5, y: lane.y }, 0, 520, { ease: 'inOut' });
      if (ok) {
        d.move(me.id, { x: lane.x - 1, y: lane.y }, 120, 520, { ease: 'out' });
        d.effect({ kind: 'TACKLE', at: 440, duration: 700, point: lane, tone: 'good' });
        const clear = { x: Math.min(70, lane.x + 28), y: clampY(lane.y + v * 22) };
        const seg = d.move(BALL, clear, 540, 980, { ease: 'out', arc: 0.12 });
        d.effect({ kind: 'TRAIL', at: 540, duration: 800, segment: seg });
        d.effect({ kind: 'FLASH', at: 600, duration: 900, text: '차단!', tone: 'good' });
      } else {
        // 헛태클 → 공격수가 빠져나가 마무리
        d.move(me.id, { x: lane.x + 2, y: clampY(lane.y + 5) }, 120, 480, { ease: 'out' });
        d.effect({ kind: 'TACKLE', at: 420, duration: 500, point: { x: lane.x + 2, y: lane.y + 5 }, tone: 'bad' });
        const shotFrom = { x: Math.max(10, lane.x - 6), y: clampY(lane.y + (50 - lane.y) * 0.4) };
        d.move(attacker.id, shotFrom, 520, 760, { ease: 'out' });
        d.move(BALL, { x: shotFrom.x - 1.5, y: shotFrom.y }, 520, 760, { ease: 'out' });
        if (ourKeeper) d.move(ourKeeper.id, { x: 4, y: clampY(goalY + (v >= 0 ? 10 : -10)) }, 800, 1080, { ease: 'out' });
        const target = { x: OUR_GOAL_X, y: clampY(goalY) };
        const seg = d.move(BALL, target, 800, 1120, { ease: 'out', arc: v * 0.05 });
        d.effect({ kind: 'TRAIL', at: 800, duration: 700, segment: seg });
        d.effect({ kind: 'NET', at: 1120, duration: 900, goal: 'OURS', point: target });
        d.effect({ kind: 'FLASH', at: 1180, duration: 1000, text: '실점…', tone: 'bad' });
      }
      break;
    }
    case 'SAVE': {
      // 상대 슈터의 슈팅 → 주인공(골키퍼)의 다이빙
      const shooter = nearest(opponents, situation.ball, () => true) ?? opponents[0];
      d.move(shooter.id, { x: shooter.x - 2, y: shooter.y }, 0, 240, { ease: 'out' });
      const target = { x: OUR_GOAL_X, y: clampY(goalY + v * 2) };
      if (ok) {
        const save = { x: Math.max(3, me.x - 1), y: clampY(target.y) };
        const seg = d.move(BALL, save, 260, 640, { ease: 'out', arc: v * 0.05 });
        d.move(me.id, save, 300, 620, { ease: 'out' });
        d.effect({ kind: 'TRAIL', at: 260, duration: 900, segment: seg });
        d.effect({ kind: 'DIVE', at: 300, duration: 700, point: save, tone: 'good' });
        d.move(BALL, { x: 12, y: clampY(save.y + (save.y > 50 ? 32 : -32)) }, 640, 1000, { ease: 'out', arc: 0.15 });
        d.effect({ kind: 'FLASH', at: 680, duration: 1000, text: '슈퍼 세이브!', tone: 'good' });
      } else {
        const wrong = { x: Math.max(3, me.x - 1), y: clampY(target.y + (v >= 0 ? -12 : 12)) };
        d.move(me.id, wrong, 300, 620, { ease: 'out' });
        d.effect({ kind: 'DIVE', at: 300, duration: 700, point: wrong, tone: 'bad' });
        const seg = d.move(BALL, target, 260, 680, { ease: 'out', arc: v * 0.05 });
        d.effect({ kind: 'TRAIL', at: 260, duration: 900, segment: seg });
        d.effect({ kind: 'NET', at: 680, duration: 900, goal: 'OURS', point: target });
        d.effect({ kind: 'FLASH', at: 740, duration: 1000, text: '실점…', tone: 'bad' });
      }
      break;
    }
  }
  return d.build();
}
