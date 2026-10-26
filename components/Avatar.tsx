import { useId } from 'react';
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES } from '@/data/appearance';
import type { Appearance, KitColors } from '@/types/game';

const DEFAULT_KIT: KitColors = { primary: '#52525b', secondary: null };
const JERSEY_PATH = 'M16 100 Q18 76 50 74 Q82 76 84 100 Z';

export type AvatarOutfit = 'KIT' | 'TUXEDO';
export type AvatarTrophy = 'BALLON_DOR' | 'FIFA_BEST';

interface AvatarProps {
  appearance: Appearance;
  /** 유니폼 (소속팀 또는 국가대표). secondary가 있으면 1-2-1-2-1 세로 줄무늬 */
  kit?: KitColors | null;
  /** 시상식에서는 턱시도 */
  outfit?: AvatarOutfit;
  /** 손에 든 트로피 */
  trophy?: AvatarTrophy | null;
  size?: number;
  label?: string;
}

/** 시상식 정장: 검은 재킷 · 새틴 라펠 · 흰 셔츠 · 나비넥타이 */
function Tuxedo() {
  return (
    <g>
      <path d={JERSEY_PATH} fill="#111827" stroke="#00000044" strokeWidth="0.6" />
      <path d="M41 73 L59 73 L50 97 Z" fill="#f9fafb" />
      <path d="M41 73 L50 97 L45 100 L35 78 Z" fill="#1f2937" />
      <path d="M59 73 L50 97 L55 100 L65 78 Z" fill="#1f2937" />
      <circle cx="50" cy="85" r="0.8" fill="#111827" />
      <circle cx="50" cy="90" r="0.8" fill="#111827" />
      <path d="M43.5 72.5 L50 75.5 L43.5 78.5 Z" fill="#0b0b0f" />
      <path d="M56.5 72.5 L50 75.5 L56.5 78.5 Z" fill="#0b0b0f" />
      <circle cx="50" cy="75.5" r="1.5" fill="#0b0b0f" />
      <path d="M33 86 l5 -1.5 l0.6 2 z" fill="#f9fafb" opacity="0.9" />
    </g>
  );
}

/** 트로피를 두 손으로 받쳐 든다 */
function Trophy({ kind, skin, gradientId }: { kind: AvatarTrophy; skin: string; gradientId: string }) {
  return (
    <g>
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff7c2" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
      </defs>
      {kind === 'BALLON_DOR' ? (
        <g>
          <rect x="65" y="90" width="14" height="6" rx="1" fill="#1f2937" />
          <rect x="67" y="88.5" width="10" height="2" fill="#b45309" />
          <circle cx="72" cy="79" r="10" fill={`url(#${gradientId})`} stroke="#92400e" strokeWidth="0.5" />
          <path d="M64 75 Q72 79 80 75 M63 81 Q72 86 81 81 M72 69 Q68 79 72 89 M72 69 Q77 79 72 89" fill="none" stroke="#92400e" strokeWidth="0.45" opacity="0.7" />
          <circle cx="68.5" cy="74.5" r="2" fill="#ffffff" opacity="0.55" />
        </g>
      ) : (
        <g>
          <path d="M66 97 L78 97 L76.5 93 L67.5 93 Z" fill="#1f2937" />
          <path d="M69.5 93 L74.5 93 L73.6 86 L70.4 86 Z" fill={`url(#${gradientId})`} />
          <path d="M70.4 86 Q63 80 66 72 Q68 66 72 64 Q76 66 78 72 Q81 80 73.6 86 Z" fill={`url(#${gradientId})`} stroke="#92400e" strokeWidth="0.4" />
          <path d="M68 74 Q72 70 76 74 Q73 79 72 84" fill="none" stroke="#92400e" strokeWidth="0.45" opacity="0.6" />
          <circle cx="69.5" cy="70" r="1.6" fill="#ffffff" opacity="0.5" />
        </g>
      )}
      <ellipse cx="62.5" cy="84" rx="3.2" ry="2.6" fill={skin} stroke="#00000022" strokeWidth="0.4" />
      <ellipse cx="81.5" cy="84" rx="3.2" ry="2.6" fill={skin} stroke="#00000022" strokeWidth="0.4" />
    </g>
  );
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

/**
 * 피부색·머리색·눈동자색을 조합한 선수 아바타 (키·몸무게는 반영하지 않음)
 * - 평소: 소속팀 유니폼 / 국가대표 경기: 국가대표 유니폼 (kit)
 * - 발롱도르·FIFA 시상식: 턱시도 + 트로피 (outfit, trophy)
 */
export function Avatar({ appearance, kit, outfit = 'KIT', trophy = null, size = 96, label = '선수 아바타' }: AvatarProps) {
  const clipId = useId().replace(/:/g, '');
  const skin = SKIN_TONES[appearance.skin].color;
  const hair = HAIR_COLORS[appearance.hair].color;
  const eyes = EYE_COLORS[appearance.eyes].color;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
      <circle cx="50" cy="50" r="49" className="fill-zinc-200 dark:fill-zinc-700" />
      {outfit === 'TUXEDO' ? <Tuxedo /> : <Jersey kit={kit ?? DEFAULT_KIT} clipId={`jersey-${clipId}`} />}
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
      <path
        d={trophy ? 'M43 56.5 Q50 62 57 56.5' : 'M44 57 Q50 60.5 56 57'}
        stroke="#00000055"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      {trophy ? <Trophy kind={trophy} skin={skin} gradientId={`gold-${clipId}`} /> : null}
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
