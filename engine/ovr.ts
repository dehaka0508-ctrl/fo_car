/**
 * OVR(오버롤) 산출
 *
 * OVR = 현재 포지션·플레이 스타일이 요구하는 핵심 스탯들의 가중 평균.
 * 팀 승패 계산에 들어가는 유일한 선수 수치다 (engine/simulator.ts 참고).
 */
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN } from '@/data/attributes';
import { getPlayStyle, type AttributeWeights } from '@/data/playstyles';
import type { AttributeKey, Attributes, PlayerRole, PlayStyle, Position } from '@/types/game';
import { PLAYSTYLES_BY_POSITION } from '@/types/game';
import { clamp } from './rng';

/** 가중치 테이블로 능력치의 가중 평균을 구한다. 가중치가 비어 있으면 0. */
export function weightedScore(attributes: Attributes, weights: AttributeWeights): number {
  let sum = 0;
  let total = 0;
  for (const [key, weight] of Object.entries(weights) as Array<[AttributeKey, number]>) {
    if (!weight) continue;
    sum += attributes[key] * weight;
    total += weight;
  }
  return total > 0 ? sum / total : 0;
}

export function calculateOVR(attributes: Attributes, role: PlayerRole): number {
  const weights = getPlayStyle(role.playStyle).ovrWeights;
  return clamp(Math.round(weightedScore(attributes, weights)), ATTRIBUTE_MIN, ATTRIBUTE_MAX);
}

/** 같은 포지션의 모든 플레이 스타일 기준 OVR (스타일 적합도 표시용, 높은 순) */
export function rankPlayStyleFit(
  attributes: Attributes,
  position: Position,
): Array<{ playStyle: PlayStyle; ovr: number }> {
  const styles = PLAYSTYLES_BY_POSITION[position] as readonly PlayStyle[];
  return styles
    .map((playStyle) => ({
      playStyle,
      ovr: clamp(
        Math.round(weightedScore(attributes, getPlayStyle(playStyle).ovrWeights)),
        ATTRIBUTE_MIN,
        ATTRIBUTE_MAX,
      ),
    }))
    .sort((a, b) => b.ovr - a.ovr);
}
