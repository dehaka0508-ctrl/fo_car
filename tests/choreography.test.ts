import { describe, expect, it } from 'vitest';
import { BALL, buildChoreography, pointOnSegment, positionAt } from '@/components/game/highlight/choreography';
import type { MatchSituation, MatchToken, ResolvedSituation, SituationKind } from '@/types/game';

function situation(kind: SituationKind, id = 's1', meY = 50): MatchSituation {
  const attacking = kind !== 'DEFEND' && kind !== 'SAVE';
  const me = attacking ? { x: 74, y: meY } : kind === 'SAVE' ? { x: 6, y: 50 } : { x: 24, y: meY };
  const tokens: MatchToken[] = [{ id: 'me', side: 'HOME', x: me.x, y: me.y, tag: 'PROTAGONIST' }];
  const mates = attacking ? [[me.x - 12, me.y - 18], [me.x - 6, me.y + 20], [me.x + 8, me.y - 26]] : [[me.x + 14, me.y - 16], [me.x + 10, me.y + 18], [3, 50]];
  // engine/highlight.ts처럼 바둑돌은 피치 안(3~97)에 둔다
  const inside = (v: number) => Math.min(97, Math.max(3, v));
  mates.forEach(([x, y], i) => tokens.push({ id: `mate-${i}`, side: 'HOME', x: inside(x), y: inside(y) }));
  const opps = attacking ? [[me.x + 8, me.y - 6], [me.x + 12, me.y + 10], [me.x + 16, me.y - 18], [me.x - 4, me.y + 6], [96, 50]] : kind === 'SAVE' ? [[me.x + 10, me.y - 4], [me.x + 18, me.y + 14]] : [[me.x + 6, me.y - 4], [me.x + 14, me.y + 12]];
  opps.forEach(([x, y], i) => tokens.push({ id: `opp-${i}`, side: 'AWAY', x: inside(x), y: inside(y) }));
  return { id, minute: 30, description: '', tokens, ball: attacking ? { x: me.x + 2, y: me.y } : { x: me.x + 6, y: me.y - 2 }, options: [] };
}

const resolved = (kind: SituationKind, success: boolean): ResolvedSituation => ({ situationId: 's1', kind, success, chance: 0.5 });
const finalBall = (s: MatchSituation, r: ResolvedSituation) => {
  const c = buildChoreography(s, r);
  return { c, ball: positionAt(c, BALL, c.duration)! };
};

describe('바둑돌 하이라이트 연출 각본', () => {
  it('슈팅 성공: 공이 골문으로 빨려 들어가고 골망이 출렁인다', () => {
    const { c, ball } = finalBall(situation('SHOT'), resolved('SHOT', true));
    expect(ball.x).toBeGreaterThan(98);
    expect(ball.y).toBeGreaterThan(43);
    expect(ball.y).toBeLessThan(57);
    expect(c.effects.some((e) => e.kind === 'NET' && e.goal === 'THEIRS')).toBe(true);
    expect(c.effects.find((e) => e.kind === 'FLASH')?.text).toBe('GOAL!');
  });

  it('슈팅 실패: 키퍼가 몸을 날려 쳐내고 골망은 그대로', () => {
    const { c, ball } = finalBall(situation('SHOT'), resolved('SHOT', false));
    expect(ball.x).toBeLessThan(98);
    expect(c.effects.some((e) => e.kind === 'NET')).toBe(false);
    expect(c.effects.some((e) => e.kind === 'DIVE')).toBe(true);
    expect(c.tracks['opp-4']).toBeDefined(); // 키퍼가 움직인다
  });

  it('키패스 성공: 패스 궤적 → 동료의 마무리까지 두 개의 궤적선', () => {
    const { c, ball } = finalBall(situation('KEY_PASS'), resolved('KEY_PASS', true));
    expect(c.effects.filter((e) => e.kind === 'TRAIL')).toHaveLength(2);
    expect(ball.x).toBeGreaterThan(98);
    expect(c.tracks['mate-2']?.length).toBeGreaterThan(0);
  });

  it('키패스 실패: 상대가 패스 길목에서 끊는다', () => {
    const { c } = finalBall(situation('KEY_PASS'), resolved('KEY_PASS', false));
    expect(c.effects.find((e) => e.kind === 'BLOCK')?.text).toBe('차단');
    expect(c.effects.some((e) => e.kind === 'NET')).toBe(false);
  });

  it('드리블 성공은 수비수를 지나치고, 실패는 태클에 공을 빼앗긴다', () => {
    const s = situation('DRIBBLE');
    const win = buildChoreography(s, resolved('DRIBBLE', true));
    expect(positionAt(win, 'me', win.duration)!.x).toBeGreaterThan(s.tokens.find((t) => t.id === 'opp-0')!.x);
    const lose = buildChoreography(s, resolved('DRIBBLE', false));
    expect(lose.effects.some((e) => e.kind === 'TACKLE' && e.tone === 'bad')).toBe(true);
    expect(positionAt(lose, BALL, lose.duration)!.x).toBeLessThan(s.ball.x);
  });

  it('수비·선방 실패는 우리 골망, 성공은 공을 걷어 낸다', () => {
    for (const kind of ['DEFEND', 'SAVE'] as const) {
      const fail = buildChoreography(situation(kind), resolved(kind, false));
      expect(fail.effects.some((e) => e.kind === 'NET' && e.goal === 'OURS')).toBe(true);
      expect(positionAt(fail, BALL, fail.duration)!.x).toBeLessThan(2);
      const ok = buildChoreography(situation(kind), resolved(kind, true));
      expect(ok.effects.some((e) => e.kind === 'NET')).toBe(false);
      expect(positionAt(ok, BALL, ok.duration)!.x).toBeGreaterThan(5);
    }
  });

  it('모든 각본은 1~3초 안에 끝나고 피치 밖으로 나가지 않는다', () => {
    const kinds: SituationKind[] = ['SHOT', 'KEY_PASS', 'DRIBBLE', 'SET_PIECE', 'DEFEND', 'SAVE'];
    for (const kind of kinds) {
      for (const success of [true, false]) {
        for (const [i, y] of [12, 35, 50, 68, 88].entries()) {
          const s = situation(kind, `case-${i}`, y);
          const c = buildChoreography(s, resolved(kind, success));
          expect(c.duration).toBeGreaterThanOrEqual(600);
          expect(c.duration).toBeLessThanOrEqual(3000);
          for (const id of Object.keys(c.tracks)) {
            for (let t = 0; t <= c.duration; t += 50) {
              const p = positionAt(c, id, t)!;
              expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
              expect(p.x).toBeGreaterThanOrEqual(-1);
              expect(p.x).toBeLessThanOrEqual(101);
              expect(p.y).toBeGreaterThanOrEqual(0);
              expect(p.y).toBeLessThanOrEqual(100);
            }
          }
        }
      }
    }
  });

  it('곡선 구간은 시작·끝을 지나고 가운데에서 휜다', () => {
    const seg = { from: { x: 0, y: 50 }, to: { x: 40, y: 50 }, start: 0, end: 100, arc: 0.2, ease: 'linear' as const };
    expect(pointOnSegment(seg, 0)).toEqual({ x: 0, y: 50 });
    expect(pointOnSegment(seg, 1).x).toBeCloseTo(40);
    expect(Math.abs(pointOnSegment(seg, 0.5).y - 50)).toBeCloseTo(8);
  });
});
