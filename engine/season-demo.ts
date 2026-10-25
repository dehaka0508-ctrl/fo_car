/**
 * 임시 시즌 러너 (프로토타입 샌드박스 · 밸런스 점검용)
 *
 * 턴 사이 페이즈(훈련·사건·상점·이적·노화)가 구현되기 전까지
 * 한 시즌의 3턴을 이어서 돌린다. 턴 사이에는 휴식으로 체력만 회복시킨다.
 */
import type { HighlightOutcome, PlayerState, SeasonRatingSummary, TurnPhase, TurnResult } from '@/types/game';
import { buildAutoHighlightOutcome } from './highlight';
import { simulateTurn, summarizeSeasonRatings, type TurnSession } from './simulator';
import type { SimulationWorld } from './world';

export interface DemoSeasonOptions {
  seed: number;
  season: number;
  /** 턴 사이 휴식 회복량 */
  betweenTurnRecovery?: number;
  highlightResolver?: (session: TurnSession) => HighlightOutcome | null;
}

export interface DemoSeasonResult {
  turns: TurnResult[];
  seasonRatings: SeasonRatingSummary;
  player: PlayerState;
}

const PHASES: readonly TurnPhase[] = ['FIRST_HALF', 'SECOND_HALF', 'PRESEASON'];

export function runDemoSeason(
  initial: PlayerState,
  world: SimulationWorld,
  options: DemoSeasonOptions,
): DemoSeasonResult {
  const recovery = options.betweenTurnRecovery ?? 20;
  const resolver = options.highlightResolver ?? buildAutoHighlightOutcome;
  let player = initial;
  let progress: TurnResult['progress'] = [];
  let leagueTable: TurnResult['leagueTable'] = [];
  const turns: TurnResult[] = [];

  for (const phase of PHASES) {
    const { result } = simulateTurn(
      { seed: options.seed, turn: { season: options.season, phase }, player, world, progress, leagueTable },
      { highlightResolver: resolver },
    );
    turns.push(result);
    progress = result.progress;
    leagueTable = result.leagueTable;
    player = {
      ...player,
      condition: Math.min(100, result.condition.end + recovery),
      mental: result.mental.end,
      reputation: Math.max(0, Math.min(100, player.reputation + result.reputationDelta)),
      squad: { ...player.squad, standing: Math.max(0, Math.min(100, player.squad.standing + result.standingDelta)) },
    };
  }

  return { turns, seasonRatings: summarizeSeasonRatings(turns[0], turns[1]), player };
}
