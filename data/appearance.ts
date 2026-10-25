/** 아바타·바둑돌 렌더링용 외형 팔레트 */
import type { EyeColor, HairColor, SkinTone } from '@/types/game';

export const SKIN_TONES: Record<SkinTone, { label: string; color: string }> = {
  1: { label: '어두운 갈색', color: '#4A2C1D' },
  2: { label: '갈색', color: '#7B4B2A' },
  3: { label: '황갈색', color: '#B07A4E' },
  4: { label: '밝은 황색', color: '#D9A57B' },
  5: { label: '밝은 색', color: '#F3D2B6' },
};

export const HAIR_COLORS: Record<HairColor, { label: string; color: string }> = {
  BLACK: { label: '흑발', color: '#1B1B1B' },
  BROWN: { label: '갈색', color: '#5A3A22' },
  RED: { label: '적발', color: '#A63A1E' },
  BLONDE: { label: '금발', color: '#E3C16F' },
};

export const EYE_COLORS: Record<EyeColor, { label: string; color: string }> = {
  DARK_BROWN: { label: '흑갈색', color: '#3B2416' },
  BROWN: { label: '갈색', color: '#6B4226' },
  HAZEL: { label: '헤이즐', color: '#8E7239' },
  GREEN: { label: '녹색', color: '#4C7A3D' },
  BLUE: { label: '파란색', color: '#3C78B5' },
  GRAY: { label: '회색', color: '#7D8A96' },
};
