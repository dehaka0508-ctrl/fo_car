/**
 * 배경: 밤 경기장 (도트 그림)
 * 밤하늘 · 조명탑 · 관중석(2층) · LED 광고판 · 잔디 줄무늬. 화면 비율과 상관없이 위쪽에 경기장이, 아래쪽에 잔디가 깔린다.
 * 서버 컴포넌트 (상태 없음). 스타일은 app/globals.css의 .stadium-* 참고.
 */

/** 관중 한 칸 (4px = 도트 1개): 머리 + 상체. [x, y, 상의 색] */
const FANS: Array<[number, number, string]> = [
  [0, 0, '#8f2f35'], [12, 2, '#d9dde4'], [24, 0, '#2f5aa8'], [36, 1, '#8f2f35'], [48, 0, '#d4b84a'], [60, 2, '#2f5aa8'],
  [6, 14, '#d9dde4'], [18, 12, '#8f2f35'], [30, 14, '#2f5aa8'], [42, 13, '#d4b84a'], [54, 12, '#d9dde4'],
];
const SKINS = ['#c99a73', '#8a5a3a', '#e6c3a2', '#5c3b28'];
const TILE = 72;

function CrowdPattern({ id, dim }: { id: string; dim: number }) {
  return (
    <pattern id={id} width={TILE} height={28} patternUnits="userSpaceOnUse">
      {FANS.map(([x, y, shirt], i) => (
        <g key={i} opacity={dim}>
          <rect x={x + 2} y={y} width={4} height={4} fill={SKINS[i % SKINS.length]} />
          <rect x={x} y={y + 4} width={8} height={6} fill={shirt} />
          {/* 손을 든 관중 */}
          {i % 4 === 1 ? <rect x={x + 8} y={y - 2} width={2} height={6} fill={SKINS[i % SKINS.length]} /> : null}
        </g>
      ))}
    </pattern>
  );
}

function FloodlightTower({ side }: { side: 'left' | 'right' }) {
  // 16 × 52 도트를 3배로
  return (
    <svg className={`stadium-tower stadium-tower-${side}`} viewBox="0 0 16 52" width={48} height={156} shapeRendering="crispEdges">
      {/* 조명 패널 */}
      <rect x={1} y={1} width={14} height={9} fill="#2a3346" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3].map((col) => <rect key={`${row}-${col}`} x={2 + col * 3.25} y={2 + row * 2.6} width={2.4} height={1.9} fill="#fff8d6" />),
      )}
      {/* 기둥 (격자) */}
      <rect x={7} y={10} width={2} height={42} fill="#2a3346" />
      <rect x={5} y={10} width={1} height={42} fill="#1c2333" />
      <rect x={10} y={10} width={1} height={42} fill="#1c2333" />
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={5} y={13 + i * 4} width={6} height={1} fill="#1c2333" />
      ))}
    </svg>
  );
}

const STARS: Array<[number, number]> = [
  [12, 10], [60, 34], [104, 8], [150, 52], [196, 20], [236, 44], [280, 6], [322, 30], [370, 14], [412, 48], [452, 22],
];

export function StadiumBackdrop() {
  return (
    <div className="stadium" aria-hidden="true">
      <div className="stadium-sky" />
      <svg className="stadium-stars" width="100%" height="120">
        <defs>
          <pattern id="stars" width={480} height={120} patternUnits="userSpaceOnUse">
            {STARS.map(([x, y], i) => (
              <rect key={i} x={x} y={y} width={i % 3 === 0 ? 3 : 2} height={i % 3 === 0 ? 3 : 2} fill="#dbe7ff" opacity={i % 2 ? 0.5 : 0.8} />
            ))}
          </pattern>
        </defs>
        <rect width="100%" height="120" fill="url(#stars)" />
      </svg>
      <div className="stadium-glow" />
      <FloodlightTower side="left" />
      <FloodlightTower side="right" />

      <svg className="stadium-stands" width="100%" height="176" shapeRendering="crispEdges">
        <defs>
          <CrowdPattern id="crowd-upper" dim={0.55} />
          <CrowdPattern id="crowd-lower" dim={0.8} />
        </defs>
        {/* 지붕 */}
        <rect y={0} width="100%" height={10} fill="#0d1322" />
        <rect y={10} width="100%" height={2} fill="#34405a" />
        {/* 2층 관중석 */}
        <rect y={12} width="100%" height={72} fill="#141c2e" />
        <rect y={12} width="100%" height={72} fill="url(#crowd-upper)" />
        {/* 2층 난간 · 1층 */}
        <rect y={84} width="100%" height={6} fill="#22304a" />
        <rect y={90} width="100%" height={2} fill="#5d6d8c" />
        <rect y={92} width="100%" height={84} fill="#1a2440" />
        <rect y={96} width="100%" height={80} fill="url(#crowd-lower)" />
      </svg>

      <div className="stadium-boards">
        <div className="stadium-marquee">
          {[0, 1].map((copy) => (
            <span key={copy}>
              FOOTBALL CAREER ★ 16세 유망주에서 레전드까지 ★ KICK OFF ★ 발롱도르를 향해 ★ GOAL! ★ 47개 리그 801개 구단 ★&nbsp;
            </span>
          ))}
        </div>
      </div>
      <div className="stadium-pitch">
        <div className="stadium-pitch-lines" />
      </div>
      <div className="stadium-shade" />
    </div>
  );
}
