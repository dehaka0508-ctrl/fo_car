import { HAIR_COLORS, SKIN_TONES } from '@/data/appearance';
import type { Appearance, KitColors } from '@/types/game';
import { buildSprite, SPRITE_HEIGHT, SPRITE_WIDTH, type SpriteOutfit, type SpriteTrophy } from './pixel/sprite';

export type AvatarOutfit = SpriteOutfit;
export type AvatarTrophy = SpriteTrophy;

interface AvatarProps {
  appearance: Appearance;
  /** 유니폼 (소속팀 또는 국가대표). secondary가 있으면 세로 줄무늬 */
  kit?: KitColors | null;
  /** 시상식에서는 턱시도 */
  outfit?: AvatarOutfit;
  /** 손에 든 트로피 */
  trophy?: AvatarTrophy | null;
  /** 높이(px). 도트가 고르게 보이도록 25px 단위로 맞춘다 */
  size?: number;
  label?: string;
  /** 제자리에서 통통 튀는 대기 동작 */
  idle?: boolean;
  className?: string;
}

/**
 * 8비트 SD 도트 선수 (전신). 피부·머리·눈동자 색과 유니폼 색(kitColors)을 입힌다.
 * - 평소: 소속팀 유니폼 / 국가대표 경기: 국가대표 유니폼 (kit)
 * - 발롱도르·FIFA 시상식: 턱시도 + 트로피 (outfit, trophy)
 */
export function Avatar({ appearance, kit, outfit = 'KIT', trophy = null, size = 100, label = '선수 아바타', idle = false, className }: AvatarProps) {
  const scale = Math.max(1, Math.round(size / SPRITE_HEIGHT));
  const rects = buildSprite({ appearance, kit, outfit, trophy });
  return (
    <svg
      viewBox={`0 0 ${SPRITE_WIDTH} ${SPRITE_HEIGHT}`}
      width={SPRITE_WIDTH * scale}
      height={SPRITE_HEIGHT * scale}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className={[idle ? 'pixel-idle' : '', 'shrink-0', className ?? ''].join(' ')}
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}

interface TokenProps {
  appearance?: Appearance;
  /** 팀 바둑돌 색 (유니폼 대표색) */
  kit?: KitColors | null;
  label?: string;
  size?: number;
}

/** 하이라이트 경기의 바둑돌. 주인공 돌은 피부색 바탕에 머리색 테두리, 나머지는 팀 유니폼 색 */
export function PlayerToken({ appearance, kit, label, size = 28 }: TokenProps) {
  const fill = appearance ? SKIN_TONES[appearance.skin].color : (kit?.primary ?? '#71717a');
  const ring = appearance ? HAIR_COLORS[appearance.hair].color : (kit?.secondary ?? '#00000044');
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
        <circle cx="10" cy="10" r="8.5" fill={fill} stroke={ring} strokeWidth={appearance ? 3 : 2} />
      </svg>
      {label ? <span className="max-w-20 truncate text-[11px] text-zinc-600 dark:text-zinc-300">{label}</span> : null}
    </span>
  );
}
