import { EYE_COLORS, HAIR_COLORS, SKIN_TONES } from '@/data/appearance';
import type { Appearance } from '@/types/game';

interface AvatarProps {
  appearance: Appearance;
  /** 유니폼 색 (소속 구단 대표색) */
  kitColor?: string;
  size?: number;
  label?: string;
}

/** 피부색·머리색·눈동자색을 조합한 선수 아바타 (키·몸무게는 반영하지 않음) */
export function Avatar({ appearance, kitColor = '#52525b', size = 96, label = '선수 아바타' }: AvatarProps) {
  const skin = SKIN_TONES[appearance.skin].color;
  const hair = HAIR_COLORS[appearance.hair].color;
  const eyes = EYE_COLORS[appearance.eyes].color;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
      <circle cx="50" cy="50" r="49" className="fill-zinc-200 dark:fill-zinc-700" />
      <path d="M16 100 Q18 76 50 74 Q82 76 84 100 Z" fill={kitColor} />
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
  /** 상대 팀 바둑돌 색 */
  color?: string;
  label?: string;
  size?: number;
}

/** 하이라이트 경기의 바둑돌. 주인공 돌은 피부색 바탕에 머리색 테두리를 쓴다. */
export function PlayerToken({ appearance, color = '#71717a', label, size = 28 }: TokenProps) {
  const fill = appearance ? SKIN_TONES[appearance.skin].color : color;
  const ring = appearance ? HAIR_COLORS[appearance.hair].color : '#00000033';
  return (
    <span className="inline-flex flex-col items-center gap-1">
      <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
        <circle cx="10" cy="10" r="8.5" fill={fill} stroke={ring} strokeWidth={appearance ? 3 : 1.5} />
      </svg>
      {label ? <span className="max-w-20 truncate text-[11px] text-zinc-600 dark:text-zinc-300">{label}</span> : null}
    </span>
  );
}
