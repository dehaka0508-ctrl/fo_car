/** 작은 도트 아이콘 (격자 문자 → rect) */
const BALL = [
  '..oooooo..',
  '.owwwwwwo.',
  'owwbbwwwwo',
  'owbbbwwbwo',
  'owwbwwbbbo',
  'owwwwwwbwo',
  'obwwbbwwwo',
  'obwbbbwwwo',
  '.owwbwwwo.',
  '..oooooo..',
];
const COLORS: Record<string, string> = { o: '#0e0f14', w: '#f4f7fb', b: '#1f2433' };

export function PixelBall({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 10 10" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className}>
      {BALL.flatMap((row, y) =>
        row.split('').map((ch, x) => (COLORS[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={COLORS[ch]} /> : null)),
      )}
    </svg>
  );
}

const TROPHY = [
  'oooooooooo',
  'oGggggggdo',
  'ogoGgggdgo',
  'oooGgggdoo',
  '..oGggdo..',
  '...oGdo...',
  '....gd....',
  '...oood...',
  '..onnnno..',
  '..oooooo..',
];
const TROPHY_COLORS: Record<string, string> = { o: '#0e0f14', g: '#f5b82e', G: '#fff1a8', d: '#b7791f', n: '#3a2f52' };

export function PixelTrophy({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 10 10" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className={className}>
      {TROPHY.flatMap((row, y) =>
        row.split('').map((ch, x) => (TROPHY_COLORS[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={TROPHY_COLORS[ch]} /> : null)),
      )}
    </svg>
  );
}
