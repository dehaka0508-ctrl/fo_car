/**
 * NPC(경쟁 선수·파트너·라이벌·시상 후보) 이름 생성용 풀 — 한국어 표기
 * 실존 유명 선수와 겹치지 않도록 흔한 이름 조합만 사용한다.
 */

export interface NamePool {
  given: readonly string[];
  family: readonly string[];
  /** 성이 앞에 오는 언어권 */
  familyFirst?: boolean;
  /** 성과 이름 사이 공백 여부 */
  spaced?: boolean;
}

const POOLS = {
  KOREAN: {
    familyFirst: true,
    spaced: false,
    family: ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'],
    given: ['민준', '서준', '도윤', '예준', '시우', '주원', '하준', '지호', '준서', '현우', '건우', '우진', '선우', '민재', '현준', '정우', '승현', '태윤', '동현', '재원', '성민', '진혁', '상훈', '영재'],
  },
  JAPANESE: {
    familyFirst: true,
    spaced: true,
    family: ['사토', '스즈키', '다카하시', '다나카', '이토', '와타나베', '야마모토', '나카무라', '고바야시', '가토', '요시다', '야마다'],
    given: ['하루토', '소타', '유토', '렌', '다이키', '가이토', '리쿠', '쇼', '겐타', '다쿠미', '유키', '고타'],
  },
  ENGLISH: {
    family: ['스미스', '존스', '테일러', '브라운', '윌리엄스', '윌슨', '존슨', '데이비스', '로버트슨', '라이트', '워커', '그린', '홀', '우드', '클라크', '터너', '힐', '무어', '쿠퍼', '워드'],
    given: ['제임스', '잭', '해리', '올리버', '조지', '찰리', '토머스', '대니얼', '루크', '메이슨', '라이언', '조던', '카일', '리스', '코너', '벤', '샘', '루이스', '에런', '칼럼'],
  },
  SPANISH: {
    family: ['가르시아', '로드리게스', '마르티네스', '로페스', '산체스', '페레스', '고메스', '페르난데스', '디아스', '모레노', '무뇨스', '알론소', '로메로', '나바로', '토레스', '루이스', '히메네스', '비달', '카스트로', '오르티스'],
    given: ['알바로', '파블로', '하비에르', '다니엘', '세르히오', '아드리안', '마르코스', '이케르', '우나이', '페드로', '호르헤', '카를로스', '다비드', '미겔', '안토니오', '루벤', '이반', '오스카르', '후안', '마테오'],
  },
  PORTUGUESE: {
    family: ['실바', '산투스', '소자', '올리베이라', '페헤이라', '알메이다', '코스타', '호드리게스', '고메스', '마르칭스', '아라우주', '히베이루', '카르발류', '핀투'],
    given: ['가브리에우', '루카스', '마테우스', '페드루', '주앙', '하파에우', '브루누', '치아구', '이고르', '펠리피', '안드레', '지에구', '길례르미', '헤난'],
  },
  FRENCH: {
    family: ['마르탱', '베르나르', '뒤부아', '토마', '로베르', '리샤르', '프티', '뒤랑', '르루아', '모로', '시몽', '로랑', '디알로', '카마라', '코네', '트라오레'],
    given: ['위고', '뤼카', '테오', '앙투안', '마티스', '라파엘', '바티스트', '쥘', '아드리앵', '니콜라', '알렉상드르', '막심', '무사', '이브라힘'],
  },
  GERMAN: {
    family: ['뮐러', '슈미트', '슈나이더', '피셔', '베버', '마이어', '바그너', '베커', '호프만', '셰퍼', '코흐', '리히터'],
    given: ['루카스', '레온', '펠릭스', '요나스', '니코', '율리안', '팀', '막스', '플로리안', '니클라스', '얀', '파울'],
  },
  ITALIAN: {
    family: ['로시', '루소', '페라리', '에스포지토', '비앙키', '로마노', '콜롬보', '리치', '마리노', '그레코', '브루노', '갈로'],
    given: ['마테오', '로렌초', '알레산드로', '레오나르도', '프란체스코', '안드레아', '페데리코', '니콜로', '다비데', '리카르도'],
  },
  DUTCH: {
    family: ['더용', '얀선', '더프리스', '판덴베르흐', '바커르', '페이서르', '피세르', '스미트', '뮐더르', '보스'],
    given: ['다안', '셈', '레비', '핀', '밀런', '티스', '브람', '루크', '야스퍼', '스테인'],
  },
  ARABIC: {
    family: ['알다우사리', '알샤흐라니', '알카타니', '알하르비', '알오타이비', '알간남', '엘마스리', '벤나세르', '알아미리', '알자흐라니', '벤살라'],
    given: ['무함마드', '압둘라', '살렘', '파이살', '칼리드', '사우드', '야세르', '유세프', '하산', '오마르', '알리', '함단'],
  },
  AMERICAN: {
    family: ['밀러', '데이비스', '앤더슨', '토머스', '잭슨', '화이트', '해리스', '마틴', '톰프슨', '가르시아', '로빈슨', '루이스'],
    given: ['타일러', '브랜든', '크리스천', '조시', '오스틴', '케일럽', '저스틴', '매슈', '디에고', '마일스'],
  },
  CHINESE: {
    familyFirst: true,
    spaced: false,
    family: ['왕', '리', '장', '류', '천', '양', '자오', '황', '저우', '우', '쉬', '쑨'],
    given: ['하오', '웨이', '레이', '양', '판', '제', '쥔', '펑', '신', '밍', '타오', '위'],
  },
  THAI: {
    family: ['수크사완', '차이웡', '분마', '퐁사왓', '시리왓', '랏타나', '촘푸', '캄분'],
    given: ['솜차이', '티라삭', '수파촉', '와차라', '피라폰', '낫타퐁', '아논', '시사왓'],
  },
  WEST_AFRICAN: {
    family: ['디오프', '은디아예', '오코예', '아데예미', '코피', '음벵가', '아베디', '사르', '세크', '바', '오누아추', '아칸지'],
    given: ['이스마일라', '빅터', '오스만', '셰이크', '파페', '에마누엘', '이삭', '사무엘', '케빈', '알리우'],
  },
} satisfies Record<string, NamePool>;

export type NamePoolId = keyof typeof POOLS;

const NATION_POOL: Record<string, NamePoolId> = {
  KOR: 'KOREAN',
  JPN: 'JAPANESE',
  ENG: 'ENGLISH', SCO: 'ENGLISH', AUS: 'ENGLISH', NZL: 'ENGLISH', WAL: 'ENGLISH', IRL: 'ENGLISH',
  USA: 'AMERICAN', CAN: 'AMERICAN', JAM: 'AMERICAN',
  ESP: 'SPANISH', ARG: 'SPANISH', MEX: 'SPANISH', COL: 'SPANISH', URU: 'SPANISH', CHI: 'SPANISH', PER: 'SPANISH', ECU: 'SPANISH', PAR: 'SPANISH', CRC: 'SPANISH', PAN: 'SPANISH',
  BRA: 'PORTUGUESE', POR: 'PORTUGUESE',
  FRA: 'FRENCH', BEL: 'FRENCH', SUI: 'FRENCH', CIV: 'WEST_AFRICAN', SEN: 'WEST_AFRICAN', CMR: 'WEST_AFRICAN', NGA: 'WEST_AFRICAN', GHA: 'WEST_AFRICAN',
  GER: 'GERMAN', AUT: 'GERMAN', DEN: 'GERMAN', NOR: 'GERMAN', SWE: 'GERMAN', POL: 'GERMAN', CZE: 'GERMAN', HUN: 'GERMAN', UKR: 'GERMAN', SRB: 'GERMAN', CRO: 'GERMAN',
  ITA: 'ITALIAN', GRE: 'ITALIAN', TUR: 'ITALIAN',
  NED: 'DUTCH',
  KSA: 'ARABIC', QAT: 'ARABIC', UAE: 'ARABIC', IRN: 'ARABIC', EGY: 'ARABIC', MAR: 'ARABIC', ALG: 'ARABIC', TUN: 'ARABIC', UZB: 'ARABIC',
  CHN: 'CHINESE', THA: 'THAI', RSA: 'ENGLISH',
};

export function namePoolFor(nationality: string): NamePool {
  return POOLS[NATION_POOL[nationality] ?? 'ENGLISH'];
}

export function formatName(pool: NamePool, given: string, family: string): string {
  if (pool.familyFirst) return pool.spaced ? `${family} ${given}` : `${family}${given}`;
  return `${given} ${family}`;
}
