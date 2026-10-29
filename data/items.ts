/**
 * 상점 아이템
 *
 * 밸런스 철칙
 * - 아이템은 세부 능력치 단 1개만 올린다.
 * - 실제 상승량 = min(baseBoost × 나이 보정, 같은 능력치 훈련 1회 기대 상승량) — 훈련을 넘지 못한다.
 * - 30대 초반부터는 상승 대신 다음 시즌 노화 하락을 baseBoost만큼 막아 준다 (engine/shop.ts).
 * - 같은 아이템도 다음 턴에 다시 살 수 있으며, 턴 사이에 1개만 구매할 수 있다.
 */
import type { ShopItemDefinition } from '@/types/game';

export const SHOP_ITEMS: ShopItemDefinition[] = [
  // ----- 장비 -----
  { id: 'boots-strike', name: '슈팅 감각 축구화', description: '발등에 맞는 감각이 남다르다.', category: 'EQUIPMENT', price: 8_000, attribute: 'finishing', baseBoost: 1 },
  { id: 'boots-control', name: '컨트롤 축구화', description: '볼 터치가 부드러워진다.', category: 'EQUIPMENT', price: 12_000, attribute: 'technique', baseBoost: 1 },
  { id: 'shin-guards', name: '맞춤형 정강이 보호대', description: '과감한 태클에 자신감이 붙는다.', category: 'EQUIPMENT', price: 9_000, attribute: 'tackling', baseBoost: 1 },
  { id: 'gk-gloves', name: '프로 골키퍼 장갑', description: '손끝 반응이 빨라진다.', category: 'EQUIPMENT', price: 10_000, attribute: 'reflexes', baseBoost: 1 },
  { id: 'sprint-spikes', name: '스프린트 훈련화', description: '첫 발 스타트 훈련 전용.', category: 'EQUIPMENT', price: 15_000, attribute: 'acceleration', baseBoost: 1 },
  { id: 'gps-vest', name: 'GPS 퍼포먼스 조끼', description: '활동량을 데이터로 관리한다.', category: 'EQUIPMENT', price: 40_000, attribute: 'stamina', baseBoost: 1 },
  { id: 'heading-rig', name: '헤딩 트레이닝 장비', description: '타점 높이를 반복 훈련한다.', category: 'EQUIPMENT', price: 60_000, attribute: 'aerial', baseBoost: 1 },
  { id: 'ball-machine', name: '자동 볼 머신', description: '프리킥을 하루 수백 번 연습한다.', category: 'EQUIPMENT', price: 120_000, attribute: 'setPieces', baseBoost: 2 },
  // ----- 패션 -----
  { id: 'sneaker-collection', name: '한정판 스니커즈 컬렉션', description: '발걸음이 가벼워진 기분.', category: 'FASHION', price: 40_000, attribute: 'agility', baseBoost: 1 },
  { id: 'designer-suit', name: '명품 맞춤 정장', description: '어떤 압박에도 여유를 잃지 않는다.', category: 'FASHION', price: 80_000, attribute: 'pressResistance', baseBoost: 1 },
  { id: 'luxury-watch', name: '명품 시계', description: '정밀함이 몸에 밴다.', category: 'FASHION', price: 250_000, attribute: 'kickAccuracy', baseBoost: 2 },
  // ----- 집 -----
  { id: 'apartment', name: '훈련장 근처 아파트', description: '출퇴근 피로가 사라진다.', category: 'HOUSE', price: 600_000, attribute: 'stamina', baseBoost: 1 },
  { id: 'altitude-room', name: '저산소 트레이닝 룸', description: '집에서 고지대 훈련을 한다.', category: 'HOUSE', price: 1_200_000, attribute: 'sprintSpeed', baseBoost: 2 },
  { id: 'house-gym', name: '홈짐이 있는 단독주택', description: '언제든 웨이트를 할 수 있다.', category: 'HOUSE', price: 2_500_000, attribute: 'strength', baseBoost: 2 },
  { id: 'recovery-villa', name: '개인 회복 센터가 있는 빌라', description: '크라이오·수중 치료 시설 완비.', category: 'HOUSE', price: 4_000_000, attribute: 'agility', baseBoost: 2 },
  { id: 'mansion', name: '수영장 딸린 저택', description: '매일 아침 수영으로 몸을 푼다.', category: 'HOUSE', price: 8_000_000, attribute: 'stamina', baseBoost: 2 },
  // ----- 차 -----
  { id: 'hatchback', name: '첫 차 (해치백)', description: '여유가 생기니 움직임도 여유롭다.', category: 'SUPERCAR', price: 25_000, attribute: 'offTheBall', baseBoost: 1 },
  { id: 'premium-suv', name: '프리미엄 SUV', description: '든든한 차처럼 수비 위치를 지킨다.', category: 'SUPERCAR', price: 90_000, attribute: 'defPositioning', baseBoost: 1 },
  { id: 'sports-car', name: '스포츠카', description: '가속 페달을 밟는 감각이 남다르다.', category: 'SUPERCAR', price: 350_000, attribute: 'acceleration', baseBoost: 2 },
  { id: 'hypercar', name: '하이퍼카', description: '도로 위의 드리블러.', category: 'SUPERCAR', price: 3_000_000, attribute: 'takeOn', baseBoost: 2 },
  // ----- 웰니스 -----
  { id: 'yoga-lessons', name: '요가 개인 레슨', description: '유연성과 균형감을 기른다.', category: 'WELLNESS', price: 20_000, attribute: 'agility', baseBoost: 1 },
  { id: 'analyst', name: '개인 경기 분석가', description: '경기 영상을 함께 복기한다.', category: 'WELLNESS', price: 70_000, attribute: 'vision', baseBoost: 1 },
  { id: 'kicking-coach', name: '킥 전문 코치', description: '골키퍼 롱킥·배급을 다듬는다.', category: 'WELLNESS', price: 80_000, attribute: 'distribution', baseBoost: 1 },
  { id: 'private-chef', name: '전속 셰프', description: '체중과 근육량을 정확히 관리한다.', category: 'WELLNESS', price: 200_000, attribute: 'strength', baseBoost: 1 },
  { id: 'gk-coach', name: '개인 골키퍼 코치', description: '포지셔닝을 1:1로 교정한다.', category: 'WELLNESS', price: 300_000, attribute: 'gkPositioning', baseBoost: 2 },
  { id: 'mental-coach', name: '개인 멘탈 코치', description: '결정적인 순간의 침착함.', category: 'WELLNESS', price: 500_000, attribute: 'finishing', baseBoost: 2 },
  { id: 'defense-mentor', name: '전설적 수비수 멘토링', description: '은퇴한 레전드에게 수비를 배운다.', category: 'WELLNESS', price: 400_000, attribute: 'interceptions', baseBoost: 2 },
];

export const SHOP_ITEM_MAP: Record<string, ShopItemDefinition> = Object.fromEntries(
  SHOP_ITEMS.map((item) => [item.id, item]),
);
