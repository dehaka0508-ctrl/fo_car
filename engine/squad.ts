/**
 * 팀 내 입지 → 출전 등급
 *
 * 입지 점수(0~100)는 매 턴 평점·OVR 차이·경쟁 선수로 변동하고, 출전 등급은 입지 점수로 정해진다.
 * 계약서의 보장 출전시간 아래로는 떨어지지 않는다. B팀·유스 선수는 입지와 OVR이 충분하면 1군으로 올라간다.
 */
import type { Contract, PlayingTime, SquadLevel, SquadStatus } from '@/types/game';
import { clamp } from './rng';

/** 출전 등급 순서 (앞이 높음) */
export const FIELD_ORDER: readonly PlayingTime[] = ['KEY', 'STARTER', 'ROTATION', 'BACKUP', 'RESERVE'];
export const GK_ORDER: readonly PlayingTime[] = ['GK_FIRST', 'GK_SECOND', 'GK_THIRD'];

export function playingTimeRank(playingTime: PlayingTime): number {
  const field = FIELD_ORDER.indexOf(playingTime);
  if (field >= 0) return field;
  return [0, 2, 4][GK_ORDER.indexOf(playingTime)];
}

export function isBetterOrEqual(a: PlayingTime, b: PlayingTime): boolean {
  return playingTimeRank(a) <= playingTimeRank(b);
}

export function isRegularRole(playingTime: PlayingTime): boolean {
  return playingTime === 'KEY' || playingTime === 'STARTER' || playingTime === 'GK_FIRST';
}

export function roleFromStanding(standing: number, isGoalkeeper: boolean): PlayingTime {
  if (isGoalkeeper) return standing >= 60 ? 'GK_FIRST' : standing >= 35 ? 'GK_SECOND' : 'GK_THIRD';
  if (standing >= 80) return 'KEY';
  if (standing >= 62) return 'STARTER';
  if (standing >= 45) return 'ROTATION';
  if (standing >= 28) return 'BACKUP';
  return 'RESERVE';
}

/** 새 계약의 보장 출전시간으로 시작 입지를 만든다. */
export function squadForContract(playingTime: PlayingTime, age: number): SquadStatus {
  const standing: Record<PlayingTime, number> = {
    KEY: 85, STARTER: 70, ROTATION: 54, BACKUP: 38, RESERVE: 25, GK_FIRST: 72, GK_SECOND: 45, GK_THIRD: 25,
  };
  const level: SquadLevel = playingTime === 'RESERVE' ? (age <= 18 ? 'YOUTH' : 'RESERVE') : 'FIRST_TEAM';
  return { level, playingTime, standing: standing[playingTime] };
}

export interface SquadUpdate {
  squad: SquadStatus;
  /** 등급 변동 알림 (없으면 null) */
  change: 'PROMOTED_TO_FIRST_TEAM' | 'DEMOTED_TO_RESERVE' | 'ROLE_UP' | 'ROLE_DOWN' | null;
}

/**
 * 턴 결과의 입지 변화를 반영한다.
 * @param competitorGap 내 OVR − 가장 강한 경쟁 선수 OVR (경쟁자가 없으면 0)
 */
export function updateSquadStatus(params: {
  squad: SquadStatus;
  standingDelta: number;
  competitorGap: number;
  ovr: number;
  clubPower: number;
  age: number;
  isGoalkeeper: boolean;
  contract: Contract | null;
}): SquadUpdate {
  const { squad, ovr, clubPower, age, isGoalkeeper, contract } = params;
  const competition = clamp(params.competitorGap * 0.4, -4, 4);
  let standing = Math.round(clamp(squad.standing + params.standingDelta + competition, 0, 100));
  const floor = contract?.playingTime;

  // B팀·유스 → 1군 승격
  if (squad.level !== 'FIRST_TEAM') {
    const ready = standing >= 55 && ovr >= clubPower - 6;
    if (ready) {
      return {
        squad: { level: 'FIRST_TEAM', playingTime: isGoalkeeper ? 'GK_SECOND' : 'BACKUP', standing: 38 },
        change: 'PROMOTED_TO_FIRST_TEAM',
      };
    }
    // 유스는 19세가 되면 B팀으로 올라간다
    const level: SquadLevel = squad.level === 'YOUTH' && age >= 19 ? 'RESERVE' : squad.level;
    return { squad: { level, playingTime: squad.playingTime, standing }, change: null };
  }

  // 1군에서 크게 밀린 어린 선수는 B팀으로
  if (standing < 15 && ovr < clubPower - 8 && age <= 21 && !(floor && isRegularRole(floor))) {
    return {
      squad: { level: 'RESERVE', playingTime: isGoalkeeper ? 'GK_THIRD' : 'RESERVE', standing: 40 },
      change: 'DEMOTED_TO_RESERVE',
    };
  }

  let playingTime = roleFromStanding(standing, isGoalkeeper);
  if (!isGoalkeeper && playingTime === 'RESERVE') playingTime = 'BACKUP';
  if (floor && !isBetterOrEqual(playingTime, floor) && floor !== 'RESERVE') {
    playingTime = floor;
    standing = Math.max(standing, 30);
  }
  const before = playingTimeRank(squad.playingTime);
  const after = playingTimeRank(playingTime);
  return {
    squad: { level: 'FIRST_TEAM', playingTime, standing },
    change: after < before ? 'ROLE_UP' : after > before ? 'ROLE_DOWN' : null,
  };
}
