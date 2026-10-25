import { useId } from 'react';
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES } from '@/data/appearance';
import type { Appearance, KitColors } from '@/types/game';

const DEFAULT_KIT: KitColors = { primary: '#52525b', secondary: null };
const JERSEY_PATH = 'M16 100 Q18 76 50 74 Q82 76 84 100 Z';

interface AvatarProps {
  appearance: Appearance;
  /** 소속팀 유니폼. secondary가 있으면 1-2-1-2-1 세로 줄무늬 */
  kit?: KitColors | null;
  size?: number;
  label?: string;
}

/** 줄무늬 유니폼: 몸통 폭을 5등분해 primary · secondary · primary · secondary · primary */
function Jersey({ kit, clipId }: { kit: KitColors; clipId: string }) {
  if (!kit.secondary) return <path d={JERSEY_PATH} fill={kit.primary} stroke="#00000022" strokeWidth="0.6" />;
  const bands = [kit.primary, kit.secondary, kit.primary, kit.secondary, kit.primary];
  const left = 16;
  const width = (84 - 16) / bands.length;
  return (
    <g>
      <clipPath id={clipId}>
        <path d={JERSEY_PATH} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        {bands.map((color, i) => (
          <rect key={i} x={left + i * width} y={70} width={width + 0.2} height={32} fill={color} />
        ))}
      </g>
      <path d={JERSEY_PATH} fill="none" stroke="#00000022" strokeWidth="0.6" />
    </g>
  );
}

/** 피부색·머리색·눈동자색을 조합한 선수 아바타 (키·몸무게는 반영하지 않음) */
export function Avatar({ appearance, kit, size = 96, label = '선수 아바타' }: AvatarProps) {
  const clipId = useId().replace(/:/g, '');
  const skin = SKIN_TONES[appearance.skin].color;
  const hair = HAIR_COLORS[appearance.hair].color;
  const eyes = EYE_COLORS[appearance.eyes].color;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
      <circle cx="50" cy="50" r="49" className="fill-zinc-200 dark:fill-zinc-700" />
      <Jersey kit={kit ?? DEFAULT_KIT} clipId={`jersey-${clipId}`} />
      <rect x="43" y="60" width="14" height="16" rx="4" fill={skin} />
      <ellipse cx="50" cy="45" rx="19" ry="22" fill={skin} />
      <ellipse cx="31" cy="47" rx="3" ry="5" fill={skin} />
      <ellipse cx="69" cy="47" rx="3" ry="5" fill={skin} />
      <path d="M30 44 Q28 18 50 18 Q72 18 70 44 Q68 30 58 28 Q50 34 38 29 Q32 32 30 44 Z" fill={hair} />
      <circle cx="42" cy="47" r="3.2" fill="#fff" />
      <circle cx="58" cy="47" r="3.2" fill="#fff" />
      <circle cx="42" cy="47.4" r="2" fill={eyes} />
      <circle cx="58" cy="47.4" r="2" fill={eyes} />
      <path d="M38 41 L46 40.5 M54 40.5 L62 41" stroke={hair} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M44 57 Q50 60.5 56 57" stroke="#00000055" strokeWidth="1.6" fill="none" strokeLinecap="round" />
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
