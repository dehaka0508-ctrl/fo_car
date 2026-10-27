import type { AttributeKey, EventCategory, EventEffect, GameEventDefinition } from '@/types/game';

const mental = (delta: number): EventEffect => ({ kind: 'MENTAL', delta });
const condition = (delta: number): EventEffect => ({ kind: 'CONDITION', delta });
const reputation = (delta: number): EventEffect => ({ kind: 'REPUTATION', delta });
const standing = (delta: number): EventEffect => ({ kind: 'STANDING', delta });
const money = (delta: number): EventEffect => ({ kind: 'MONEY', delta });
const skill = (key: AttributeKey): EventEffect => ({ kind: 'ATTRIBUTE', key, delta: 1 });
type Answer = [label: string, effects: EventEffect[]];
type Gate = Pick<GameEventDefinition, 'minAge' | 'maxAge' | 'requires' | 'maxOccurrences' | 'phases'>;
function story(category: EventCategory, id: string, title: string, body: string, answers: Answer[], gate: Partial<Gate> = {}): GameEventDefinition {
  return { id, category, title, body, phases: ['FIRST_HALF', 'SECOND_HALF', 'PRESEASON'], weight: 1, cooldownTurns: 6, maxOccurrences: 3, ...gate,
    choices: answers.map(([label, effects], index) => ({ id: `choice-${index + 1}`, label, effects })) };
}
const youth = { maxAge: 19 };
const rising = { minAge: 20, maxAge: 26 };
const veteran = { minAge: 30, maxAge: 35 };
const known = { requires: { minReputation: 25 } };
const star = { requires: { minReputation: 60, minOVR: 75 } };
const partner = { requires: { partner: true } };
const rival = { requires: { rival: true } };

/** 112개의 서로 다른 상황. 문구뿐 아니라 선택·효과·해금 조건도 개별 작성한다. */
export const EXPANDED_EVENTS: GameEventDefinition[] = [
  // 생활·가족 16종
  story('FAMILY', 'life-first-dorm', '첫 기숙사 생활', '기숙사 입소 첫날, 낯선 방에서 집 생각이 난다.', [['룸메이트에게 먼저 말을 건다', [mental(3), standing(1)]], ['가족과 통화하며 마음을 다잡는다', [mental(4)]]], { ...youth, maxOccurrences: 1 }),
  story('FAMILY', 'life-school-exam', '시험과 원정 일정', '원정 출발일과 학교 시험이 겹쳤다. 담당 교사가 보충 시험을 제안했다.', [['공부할 시간을 미리 확보한다', [mental(2), condition(-3)]], ['구단 교육 담당자에게 도움을 청한다', [standing(1), mental(1)]]], youth),
  story('FAMILY', 'life-first-pay', '첫 월급의 쓰임', '가족이 첫 월급을 받은 {name}을 축하했다.', [['가족에게 작은 선물을 보낸다', [money(-2000), mental(5)]], ['앞으로의 생활을 위해 저축한다', [mental(2)]]], { maxAge: 21, requires: { minMoney: 2000 }, maxOccurrences: 1 }),
  story('FAMILY', 'life-missed-birthday', '동생의 생일', '동생의 생일에 원정 경기가 잡혔다. 가족 단체방에 케이크 사진이 올라왔다.', [['영상 통화로 축하한다', [mental(3)]], ['직접 쓴 편지를 미리 보낸다', [mental(4), condition(-1)]]]),
  story('FAMILY', 'life-family-stands', '관중석의 가족', '오랜만에 가족이 홈구장에 온다. 선수석 근처 좌석을 구할 수 있다고 한다.', [['경기 뒤 함께 식사한다', [mental(4), condition(-2)]], ['따뜻하게 맞고 회복 일정은 지킨다', [mental(2), condition(2)]]]),
  story('FAMILY', 'life-old-coach', '처음 공을 가르친 선생님', '어린 시절 코치가 낡은 단체 사진을 보내며 응원했다.', [['감사 인사를 담아 답장을 쓴다', [mental(4)]], ['다음 휴가에 찾아뵙겠다고 약속한다', [mental(2), reputation(1)]]], { minAge: 20 }),
  story('FAMILY', 'life-language', '새로운 언어', '라커룸 농담을 알아듣지 못해 어색한 침묵이 흘렀다.', [['동료에게 표현을 배운다', [standing(2), mental(1)]], ['수업을 알아보고 공부한다', [mental(3), condition(-2)]]], rising),
  story('FAMILY', 'life-cooking', '집밥 연습', '영양사가 간단한 회복식 조리법을 알려줬다. 주방에서 직접 해볼까?', [['동료와 함께 요리한다', [condition(3), standing(1)]], ['식단 담당자에게 나에게 맞게 조정받는다', [condition(5)]]]),
  story('FAMILY', 'life-neighbor', '이웃의 부탁', '아파트 이웃이 주말 어린이 축구 모임에 잠깐 들러 달라고 부탁했다.', [['기본기를 알려준다', [reputation(1), mental(2), condition(-2)]], ['훈련용 공을 보내 응원한다', [mental(2)]]]),
  story('FAMILY', 'life-private-photo', '가족사진 공개', '가족이 함께 찍은 사진을 올려도 되는지 물었다. 팬들의 관심이 커진 시기다.', [['가족과 공개 범위를 정한다', [mental(3)]], ['이번 사진은 가족끼리 간직한다', [mental(2), condition(1)]]], known),
  story('FAMILY', 'life-moving-home', '훈련장 가까운 집', '통근 시간을 줄일 수 있는 집이 나왔다. 이사에는 며칠의 정리가 필요하다.', [['휴식일에 짐을 정리한다', [condition(4), mental(-1)]], ['당장은 익숙한 집에 머문다', [mental(3)]]], { minAge: 22 }),
  story('FAMILY', 'life-childhood-friend', '친구의 고민', '오랜 친구가 새로운 진로를 고민하며 {name}에게 이야기를 털어놓았다.', [['시간을 내어 이야기를 듣는다', [mental(4), condition(-2)]], ['응원 편지와 조언을 보낸다', [mental(2)]]]),
  story('FAMILY', 'life-parent-holiday', '부모님의 첫 휴가', '부모님이 오랜 일을 잠시 내려놓고 여행을 떠나겠다고 한다.', [['여행 계획을 함께 짠다', [mental(5)]], ['휴가가 겹치는 날만 합류한다', [mental(3), condition(2)]]], { minAge: 24, maxOccurrences: 1 }),
  story('FAMILY', 'life-hometown-mural', '고향 벽화', '고향 청소년센터가 {name}의 모습을 벽화로 그리고 싶다고 연락했다.', [['청소년들과 직접 만나 이야기를 나눈다', [reputation(2), mental(3), condition(-3)]], ['응원 문구를 보내준다', [reputation(1), mental(1)]]], { requires: { minReputation: 40 }, maxOccurrences: 1 }),
  story('FAMILY', 'life-balance', '가족과의 저녁 약속', '훈련이 길어져 약속한 저녁 시간에 늦을 것 같다.', [['미리 연락하고 함께 시간을 다시 정한다', [mental(3)]], ['추가 훈련을 줄이고 약속을 지킨다', [condition(3), mental(2)]]], { minAge: 23 }),
  story('FAMILY', 'life-memory-box', '오래된 축구화 상자', '짐을 정리하던 중 첫 축구화와 유소년 시절 경기표를 발견했다.', [['추억을 기록으로 남긴다', [mental(5)]], ['어린 후배에게 시작 이야기를 들려준다', [mental(2), standing(2)]]], { minAge: 29, maxOccurrences: 1 }),

  // 훈련·실력 16종
  story('TRAINING_METHOD', 'practice-wall-pass', '벽 패스의 기본', '코치가 짧은 패스에서도 디딤발 방향이 흔들린다고 짚었다.', [['느리게 반복하며 자세를 교정한다', [skill('kickAccuracy'), condition(-4)]], ['영상으로 동작부터 확인한다', [mental(2), condition(1)]]], { requires: { maxOVR: 59 } }),
  story('TRAINING_METHOD', 'practice-first-touch', '첫 터치 과제', '압박이 오기 전에 공을 멀리 놓치는 장면이 반복됐다.', [['압박 속 볼 받기 훈련을 한다', [skill('technique'), condition(-5)]], ['훈련량을 줄이고 좋은 장면을 분석한다', [mental(3)]]], { requires: { maxOVR: 64 } }),
  story('TRAINING_METHOD', 'practice-scan', '공을 받기 전의 시선', '분석관이 공이 오기 전에 주변을 확인하는 횟수를 기록해 왔다.', [['고개를 드는 습관부터 만든다', [skill('vision'), condition(-3)]], ['동료와 서로 신호를 정한다', [standing(2), mental(1)]]]),
  story('TRAINING_METHOD', 'practice-free-kick', '프리킥의 벽', '연습장 프리킥에서 공이 자꾸 수비벽에 걸린다.', [['도움닫기 각도를 바꿔 본다', [skill('setPieces'), condition(-4)]], ['담당 키커에게 조언을 청한다', [standing(1), mental(2)]]]),
  story('TRAINING_METHOD', 'practice-sleep', '수면 기록표', '피지컬 코치가 훈련 다음 날의 피로가 수면 시간과 연결된다고 설명했다.', [['취침 시간을 일정하게 맞춘다', [condition(6)]], ['낮잠과 회복 루틴을 시험한다', [condition(3), mental(2)]]]),
  story('TRAINING_METHOD', 'practice-header', '낙하지점 읽기', '높은 공을 기다리다 상대에게 먼저 자리를 빼앗기는 장면이 나왔다.', [['도약보다 위치를 먼저 잡는 연습을 한다', [skill('offTheBall'), condition(-3)]], ['수비 동료와 경합 장면을 돌려본다', [mental(2), standing(1)]]]),
  story('TRAINING_METHOD', 'practice-press-trap', '압박을 역이용하기', '상대가 두 명씩 붙기 시작했다. 코치는 빈 공간을 이용하자고 한다.', [['원터치 탈출 훈련을 한다', [skill('pressResistance'), condition(-4)]], ['동료와 패스 탈출 경로를 정한다', [standing(3)]]], { requires: { minOVR: 65 } }),
  story('TRAINING_METHOD', 'practice-finishing-angle', '좁은 각도의 마무리', '골키퍼 코치가 어려운 각도에서 슈팅하는 특별 훈련을 제안했다.', [['먼 쪽 골대와 가까운 쪽을 번갈아 노린다', [skill('finishing'), condition(-5)]], ['성공한 장면의 발목 각도를 분석한다', [mental(3)]]], { requires: { minOVR: 60 } }),
  story('TRAINING_METHOD', 'practice-interception', '패스 길을 지우는 한 걸음', '코치가 상대의 패스 전에 움직이면 경합을 줄일 수 있다고 설명했다.', [['상대 시선과 디딤발을 읽는다', [skill('interceptions'), condition(-3)]], ['수비 라인과 움직임을 맞춘다', [standing(2), mental(1)]]]),
  story('TRAINING_METHOD', 'practice-elite-detail', '정상급 선수의 작은 차이', '개인 분석관이 발 위치 하나로 패스 속도가 달라지는 자료를 가져왔다.', [['세밀한 동작 수정에 시간을 쓴다', [skill('kickAccuracy'), condition(-4)]], ['익숙한 폼을 지키고 회복한다', [condition(5), mental(1)]]], { requires: { minOVR: 80 } }),
  story('TRAINING_METHOD', 'practice-two-tempos', '두 가지 경기 템포', '강한 압박과 낮은 수비 블록을 번갈아 상대하는 연습이 잡혔다.', [['상대에 따라 공을 놓는 시간을 바꾼다', [skill('vision'), condition(-4)]], ['한 가지 장점을 확실히 다듬는다', [mental(3), standing(1)]]], { requires: { minOVR: 70 } }),
  story('TRAINING_METHOD', 'practice-breathing', '긴장과 호흡', '중요한 경기만 앞두면 어깨에 힘이 들어간다. 코치가 호흡법을 알려준다.', [['경기 전 호흡 루틴을 만든다', [mental(6)]], ['짧은 스트레칭으로 몸을 푼다', [condition(4), mental(1)]]]),
  story('TRAINING_METHOD', 'practice-keeper-feet', '골키퍼의 발밑', '골키퍼 훈련에서 압박을 피해 정확히 배급하는 과제가 주어졌다.', [['짧은 배급부터 정교하게 다듬는다', [skill('distribution'), condition(-4)]], ['동료 수비수와 위치를 맞춘다', [standing(2), mental(1)]]], { requires: { hasClub: true, positions: ['GK'] }, maxOccurrences: 2 }),
  story('TRAINING_METHOD', 'practice-rain-ball', '젖은 공의 궤적', '비가 내린 연습장에서 공이 예상보다 빠르게 튀었다.', [['바운드에 반응하는 훈련을 한다', [mental(2), condition(-2)]], ['실내에서 전술 영상을 본다', [condition(3), mental(1)]]]),
  story('TRAINING_METHOD', 'practice-self-review', '내 경기의 해설자', '분석관이 자신의 플레이를 직접 설명하며 영상을 보라고 권했다.', [['실수와 의도를 모두 말해 본다', [mental(4), skill('vision')]], ['잘된 장면부터 정리한다', [mental(3), condition(1)]]], { minAge: 21 }),
  story('TRAINING_METHOD', 'practice-personal-routine', '나만의 준비 루틴', '경기 시작 직전 무엇부터 해야 편안한지 찾을 때가 됐다.', [['워밍업 순서를 고정한다', [condition(3), mental(3)]], ['상대에 맞게 준비를 바꾼다', [mental(4)]]], { maxAge: 23 }),

  // 구단·주전 경쟁 16종
  story('TEAM', 'club-ball-duty', '공 정리 당번', '막내 선수들에게 훈련 뒤 장비 정리 순서가 돌아왔다.', [['동료와 나눠 빠르게 마친다', [standing(2), mental(1)]], ['선배의 준비 방식도 배워 본다', [standing(1), condition(-1), mental(2)]]], youth),
  story('TEAM', 'club-first-senior-session', '처음 밟는 1군 훈련장', '1군 훈련 인원이 모자라 {name}에게 하루 합류 기회가 왔다.', [['기본 플레이를 확실하게 보여준다', [standing(4), condition(-4)]], ['선배의 움직임을 가까이에서 배운다', [skill('offTheBall'), mental(2)]]], { maxAge: 21, requires: { maxOVR: 64 }, maxOccurrences: 1 }),
  story('TEAM', 'club-bench-notes', '벤치에서 보는 경기', '출전 기회가 적어도 전술을 관찰할 수 있다. 코치가 간단한 기록을 부탁했다.', [['상대의 빈 공간을 적는다', [skill('vision'), standing(1)]], ['교체 준비와 몸 관리에 집중한다', [condition(4), mental(2)]]], { requires: { maxOVR: 69 } }),
  story('TEAM', 'club-training-captain', '연습경기 주장', '코치가 연습경기 한 팀의 주장을 맡아 보라고 했다.', [['수비와 공격 간격을 크게 외친다', [standing(3), mental(2)]], ['말보다 성실한 플레이로 이끈다', [standing(2), condition(-2)]]], { minAge: 20 }),
  story('TEAM', 'club-new-teammate', '새로 온 동료의 자리', '새 동료가 식당에서 혼자 앉아 있다. {name}의 옆자리가 비어 있다.', [['함께 앉아 구단 생활을 알려준다', [standing(3), mental(2)]], ['포지션 동료에게 소개해 준다', [standing(2)]]]),
  story('TEAM', 'club-set-piece-role', '세트피스 두 번째 선택', '주전 키커가 쉬는 날에는 {name}이 세트피스를 맡을 수 있다고 한다.', [['추가 연습에 참여한다', [skill('setPieces'), standing(2), condition(-4)]], ['연계 움직임을 맡겠다고 제안한다', [standing(2), mental(1)]]], { requires: { minOVR: 65, firstTeam: true } }),
  story('TEAM', 'club-tactical-vote', '전술 회의의 한마디', '감독이 선수들에게 최근 경기에서 불편했던 점을 묻는다.', [['경험한 문제를 구체적으로 말한다', [standing(3), mental(2)]], ['동료 의견을 모아 전달한다', [standing(2), mental(1)]]], { requires: { firstTeam: true } }),
  story('TEAM', 'club-fan-letter-box', '라커룸의 편지함', '구단 직원이 선수 앞으로 온 손편지들을 한 상자 가져왔다.', [['몇 통을 골라 직접 답장한다', [reputation(1), mental(4)]], ['동료들과 함께 감사 영상을 찍는다', [reputation(2), condition(-2)]]], known),
  story('TEAM', 'club-young-challenger', '같은 자리의 신예', '유소년팀에서 올라온 선수가 {name}의 자리에 도전하고 있다.', [['건전한 경쟁을 제안한다', [standing(2), mental(2)]], ['훈련 강도를 조금 올린다', [standing(3), condition(-5)]]], { minAge: 24, requires: { firstTeam: true } }),
  story('TEAM', 'club-captains-council', '주장단 회의 초대', '주장이 선수단 생활 규칙에 대한 의견을 듣고 싶다고 한다.', [['회복 시간 보장을 제안한다', [condition(3), standing(2)]], ['신인 적응 프로그램을 제안한다', [standing(4), mental(1)]]], { minAge: 26, requires: { firstTeam: true, minReputation: 30 } }),
  story('TEAM', 'club-bus-seat', '원정 버스의 빈자리', '평소 함께 앉던 동료가 결장했다. 낯선 동료가 옆에 앉았다.', [['서로의 축구 이야기를 나눈다', [mental(3), standing(1)]], ['함께 상대 경기 영상을 본다', [standing(2)]]]),
  story('TEAM', 'club-supporter-banner', '내 이름이 적힌 현수막', '서포터석에 {name}의 이름을 넣은 현수막이 처음 걸렸다.', [['경기 뒤 감사 인사를 전한다', [reputation(2), mental(4)]], ['좋은 경기로 답하겠다고 마음먹는다', [mental(5)]]], { requires: { minReputation: 20 }, maxOccurrences: 1 }),
  story('TEAM', 'club-stadium-tour', '새 구장 사전 답사', '구단이 새 홈구장의 잔디와 시설을 미리 확인할 기회를 줬다.', [['동료와 동선을 살펴본다', [mental(2), standing(1)]], ['잔디 감각에 익숙해진다', [condition(-2), mental(3)]]], { requires: { firstTeam: true } }),
  story('TEAM', 'club-tunnel-speech', '터널에서의 짧은 말', '연패로 팀의 분위기가 가라앉았다. 선수들이 {name}을 바라본다.', [['각자의 역할에 집중하자고 말한다', [standing(4), mental(2)]], ['옆 동료부터 격려한다', [standing(2), mental(3)]]], { requires: { minOVR: 75, minReputation: 35 } }),
  story('TEAM', 'club-record-shirt', '구단 기록 기념 유니폼', '구단이 오랜 활약에 감사하며 특별 유니폼을 준비했다고 한다.', [['장비 담당자와 직원들에게 공을 돌린다', [standing(3), reputation(2)]], ['가족과 동료를 기념 촬영에 초대한다', [mental(5), reputation(1)]]], { minAge: 28, requires: { minReputation: 50 }, maxOccurrences: 1 }),
  story('TEAM', 'club-recovery-room', '회복실의 자리 양보', '회복 장비가 모자란 날, 어린 동료가 머뭇거리고 있다.', [['순서를 바꿔 주고 스트레칭을 한다', [standing(3), mental(1)]], ['직원에게 일정을 나눠 달라고 부탁한다', [condition(3), standing(1)]]]),

  // 언론·명성 16종
  story('MEDIA', 'press-local-column', '지역 신문의 첫 기사', '지역 기자가 아직 알려지지 않은 {name}의 성장 이야기를 쓰고 싶다고 한다.', [['짧은 인터뷰에 응한다', [reputation(2), mental(2)]], ['지금은 경기 준비에 집중한다', [condition(3)]]], { requires: { maxReputation: 19 }, maxOccurrences: 1 }),
  story('MEDIA', 'press-school-paper', '학교 신문 인터뷰', '학교 후배들이 축구선수의 하루를 주제로 질문을 보내왔다.', [['공부와 운동을 함께한 경험을 나눈다', [mental(3), reputation(1)]], ['훈련장 사진과 짧은 답변을 보낸다', [reputation(1)]]], { maxAge: 21, maxOccurrences: 1 }),
  story('MEDIA', 'press-breakthrough', '주목받는 신예', '이번 주 신예 선수 소개에 {name}의 이름이 올랐다.', [['도움을 준 코치와 동료를 언급한다', [reputation(2), standing(2)]], ['아직 배울 것이 많다고 답한다', [mental(3), reputation(1)]]], { maxAge: 22, requires: { minOVR: 60 }, maxOccurrences: 1 }),
  story('MEDIA', 'press-tactical-praise', '분석가의 칭찬', '방송 분석가가 공이 없을 때의 움직임을 자세히 칭찬했다.', [['칭찬받은 장면을 다시 분석한다', [mental(3), skill('offTheBall')]], ['함께 움직인 동료들에게 고마움을 전한다', [standing(3), mental(2)]]], { requires: { minOVR: 70 } }),
  story('MEDIA', 'press-mixed-zone', '믹스트존의 난처한 질문', '기자가 동료의 실수를 직접 평가해 달라고 요구했다.', [['팀 전체가 함께 책임진다고 답한다', [standing(3), reputation(1)]], ['전술적인 이야기만 짧게 한다', [mental(2)]]], known),
  story('MEDIA', 'press-viral-clip', '짧은 영상의 긴 여파', '훈련 중 장난친 짧은 영상이 맥락 없이 퍼졌다.', [['전체 상황을 차분히 설명한다', [reputation(1), mental(-2)]], ['구단 홍보팀과 대응을 정리한다', [standing(2), mental(1)]]], { requires: { minReputation: 30 } }),
  story('MEDIA', 'press-signature-celebration', '나만의 세리머니', '팬들이 {name}만의 세리머니를 만들어 달라는 아이디어를 보내왔다.', [['팬 제안을 참고해 간단히 정한다', [reputation(2), mental(2)]], ['자연스러운 기쁨을 그대로 보여준다', [mental(3)]]], { requires: { minReputation: 20 }, maxOccurrences: 1 }),
  story('MEDIA', 'press-national-feature', '전국 방송의 집중 조명', '스포츠 프로그램이 {name}의 일주일을 따라가는 특집을 제안했다.', [['촬영 시간을 제한하고 참여한다', [reputation(3), money(25000), condition(-4)]], ['시즌이 끝난 뒤로 미룬다', [condition(4), mental(2)]]], { requires: { minReputation: 45, minOVR: 70 }, maxOccurrences: 2 }),
  story('MEDIA', 'press-world-eleven', '세계 베스트 후보 토론', '해외 방송에서 {name}이 세계 베스트 후보로 거론됐다.', [['팀의 목표가 먼저라고 답한다', [standing(3), mental(3)]], ['최고를 목표로 한다고 말한다', [reputation(3), mental(1)]]], { requires: { minOVR: 85, minReputation: 70 } }),
  story('MEDIA', 'press-cover', '잡지 표지 제안', '축구 전문지가 {name}을 표지 인물로 선정하고 촬영을 요청했다.', [['휴식일 오전에 짧게 촬영한다', [reputation(2), money(18000), condition(-3)]], ['사진 대신 전술 인터뷰를 제안한다', [reputation(1), mental(3)]]], known),
  story('MEDIA', 'press-charity-mic', '자선행사의 마이크', '자선행사에서 준비하지 못한 짧은 연설을 부탁받았다.', [['어린 시절 도움받은 이야기를 한다', [reputation(2), mental(3)]], ['현장의 봉사자들을 소개한다', [reputation(1), mental(4)]]], { requires: { minReputation: 35 } }),
  story('MEDIA', 'press-false-quote', '내가 하지 않은 말', '인터뷰 기사가 실제 발언과 다르게 제목을 달았다.', [['원문을 공개하고 정정을 요청한다', [mental(2), reputation(1)]], ['다음 인터뷰에서 뜻을 분명히 한다', [mental(3)]]], { requires: { minReputation: 20 } }),
  story('MEDIA', 'press-decline-label', '벌써 한물갔다는 평가', '전성기가 지났다는 칼럼이 실렸다. 동료들은 신경 쓰지 말라고 한다.', [['최근 좋은 장면을 모아 자신감을 찾는다', [mental(5)]], ['새 역할에 적응하는 과정을 설명한다', [reputation(1), standing(2)]]], { minAge: 30, requires: { minReputation: 30 } }),
  story('MEDIA', 'press-long-interview', '한 시간의 축구 이야기', '긴 인터뷰에서 경기 너머의 축구 철학을 이야기할 기회가 왔다.', [['판단과 경험의 중요성을 이야기한다', [mental(3), reputation(2)]], ['함께한 동료들의 이야기를 꺼낸다', [standing(2), reputation(1)]]], { minAge: 27, requires: { minOVR: 75 } }),
  story('MEDIA', 'press-fan-language', '먼 나라 팬의 편지', '아직 가본 적 없는 나라에서 {name}의 경기를 보고 응원한다는 편지가 왔다.', [['그 나라 말로 짧은 감사를 전한다', [reputation(2), mental(3)]], ['사인과 구단 소식을 보내준다', [reputation(1), mental(2)]]], { requires: { minReputation: 55 } }),
  story('MEDIA', 'press-star-expectation', '모든 경기의 주인공', '언론이 매 경기 결정적인 활약을 요구한다. 작은 부진도 큰 기사로 난다.', [['팀 안에서 부담을 나눈다', [mental(4), standing(2)]], ['외부 소식을 줄이고 내 루틴을 지킨다', [mental(3), condition(3)]]], star),

  // 스폰서·돈·사회 활동 16종
  story('SPONSORSHIP', 'brand-local-boots', '지역 용품점의 응원', '작은 축구 용품점이 신예 선수에게 연습용 장비를 지원하고 싶다고 한다.', [['지역 아이들과 함께 방문한다', [money(3000), reputation(1), condition(-2)]], ['필요한 장비만 정중히 받는다', [money(2000), mental(1)]]], { requires: { maxReputation: 24 } }),
  story('SPONSORSHIP', 'brand-academy-poster', '아카데미 모집 포스터', '옛 아카데미가 후배 모집 포스터에 사진을 써도 되는지 물었다.', [['후배들에게 응원 문구를 더한다', [reputation(1), mental(4)]], ['개인 사진 대신 팀 사진을 제안한다', [standing(1), mental(2)]]], { maxAge: 23, maxOccurrences: 1 }),
  story('SPONSORSHIP', 'brand-boot-test', '신형 축구화 테스트', '새 축구화의 착화감을 평가하는 비공개 테스트에 초대됐다.', [['훈련에서 시험하고 자세히 피드백한다', [money(7000), condition(-3)]], ['익숙한 장비를 유지한다', [condition(3), mental(1)]]], { requires: { minOVR: 65 } }),
  story('SPONSORSHIP', 'brand-signature', '이름을 건 축구화', '브랜드가 {name}의 이름을 단 모델을 제안했다. 설계 회의도 필요하다.', [['성능 검토에 직접 참여한다', [money(90000), reputation(3), condition(-5)]], ['이름 사용보다 팀 지원을 요청한다', [standing(4), reputation(2)]]], { requires: { minReputation: 65, minOVR: 80 }, maxOccurrences: 1 }),
  story('SPONSORSHIP', 'brand-watch', '시계 광고의 선택', '스폰서 촬영일이 중요한 경기 다음 날로 잡혔다.', [['촬영일 변경을 조건으로 수락한다', [money(30000), reputation(1)]], ['이번에는 회복을 우선한다', [condition(6)]]], known),
  story('SPONSORSHIP', 'brand-nutrition', '영양 제품 감수', '스폰서가 선수용 제품 설명에 의견을 달아 달라고 했다.', [['구단 영양사와 함께 검토한다', [money(10000), condition(3)]], ['전문가의 이름으로 안내하도록 권한다', [mental(2), reputation(1)]]], { minAge: 21 }),
  story('SPONSORSHIP', 'brand-stream', '게임 방송 초대', '축구 게임 방송에서 실제 전술을 설명해 달라는 제안이 왔다.', [['짧게 출연해 전술을 풀이한다', [money(12000), reputation(2), condition(-3)]], ['녹화한 설명 영상만 제공한다', [money(5000), reputation(1)]]], { requires: { minReputation: 20 } }),
  story('SPONSORSHIP', 'brand-community-pitch', '동네 운동장 보수', '고향의 작은 운동장 조명을 고치기 위한 모금이 시작됐다.', [['후원하고 준공식에 참석한다', [money(-10000), reputation(3), mental(4)]], ['모금 소식을 팬들에게 알린다', [reputation(1), mental(2)]]], { requires: { minMoney: 10000, minReputation: 15 }, maxOccurrences: 1 }),
  story('SPONSORSHIP', 'brand-clever-contract', '초상권 계약 검토', '계약서에 예상보다 넓은 사진 사용 범위가 적혀 있다.', [['대리인에게 범위를 줄이도록 요청한다', [money(15000), mental(3)]], ['이번 계약은 보류한다', [mental(4)]]], { requires: { minReputation: 35 } }),
  story('SPONSORSHIP', 'brand-global-tour', '세계 브랜드 투어', '여러 나라를 도는 홍보 일정이 들어왔다. 이동 부담이 상당하다.', [['방문 도시를 줄여 참여한다', [money(120000), reputation(3), condition(-8)]], ['한 도시의 행사만 맡는다', [money(40000), reputation(1), condition(-2)]]], { ...star, phases: ['SECOND_HALF'] }),
  story('SPONSORSHIP', 'brand-signed-auction', '사인 유니폼 경매', '구단 자선 경매에 개인 유니폼과 짧은 메시지를 내놓을 수 있다.', [['가장 의미 있던 경기의 유니폼을 낸다', [reputation(2), mental(4)]], ['동료들과 공동 경매를 연다', [reputation(1), standing(2)]]], known),
  story('SPONSORSHIP', 'brand-small-business', '친구의 가게 홍보', '친구가 새로 연 가게를 한 번 소개해 달라고 부탁했다.', [['직접 방문한 경험만 솔직히 소개한다', [mental(3), reputation(1)]], ['사적으로 응원하고 광고는 사양한다', [mental(2), condition(1)]]], { minAge: 22 }),
  story('SPONSORSHIP', 'brand-recovery-campaign', '회복의 중요성 캠페인', '쉬는 것도 훈련이라는 캠페인의 얼굴을 맡아 달라는 요청이 왔다.', [['내 회복 일정을 함께 공개한다', [money(20000), reputation(2), condition(2)]], ['구단 메디컬팀을 중심으로 소개한다', [standing(2), reputation(1)]]], { minAge: 28, requires: { minReputation: 25 } }),
  story('SPONSORSHIP', 'brand-legacy-foundation', '장학 재단의 첫걸음', '오랫동안 생각했던 유소년 장학 사업을 시작할 여건이 됐다.', [['교육 전문가와 작은 규모로 시작한다', [money(-50000), reputation(4), mental(5)]], ['기존 재단을 후원하며 준비한다', [money(-20000), reputation(2), mental(3)]]], { minAge: 28, requires: { minReputation: 60, minMoney: 50000 }, maxOccurrences: 1 }),
  story('SPONSORSHIP', 'brand-captain-shoot', '주장과 신인의 공동 광고', '브랜드가 경험 많은 선수와 신인이 함께 나오는 광고를 준비했다.', [['신인의 분량도 충분히 요청한다', [money(20000), standing(3)]], ['촬영을 짧게 끝내고 함께 회복한다', [money(15000), condition(3)]]], { minAge: 27, requires: { firstTeam: true } }),
  story('SPONSORSHIP', 'brand-last-collection', '커리어 기념 컬렉션', '장비 브랜드가 지금까지 사용한 모델을 모아 전시하고 싶다고 한다.', [['변화한 플레이 스타일을 설명한다', [money(35000), reputation(2), mental(3)]], ['유소년 장비 지원 행사로 바꿔 제안한다', [reputation(3), standing(1)]]], { minAge: 31, requires: { minReputation: 50 }, maxOccurrences: 1 }),

  // 파트너·라이벌 16종
  story('PARTNER', 'bond-secret-signal', '둘만 아는 신호', '{partner}가 수비 뒤로 뛰기 전 사용할 짧은 신호를 정하자고 했다.', [['시선과 손짓을 함께 맞춘다', [skill('vision'), standing(1)]], ['연습경기에서 자연스럽게 맞춘다', [mental(3), condition(-2)]]], partner),
  story('PARTNER', 'bond-mistake', '파트너의 실수', '{partner}가 자신의 실수로 경기를 놓쳤다며 훈련 뒤에도 고개를 들지 못한다.', [['함께 경기 영상을 보고 원인을 나눈다', [mental(4), standing(1)]], ['축구 이야기 없이 산책한다', [mental(5), condition(2)]]], partner),
  story('PARTNER', 'bond-family-meal', '파트너 가족의 초대', '{partner}의 가족이 집에서 함께 저녁을 먹자고 초대했다.', [['감사의 선물을 들고 찾아간다', [mental(5)]], ['회복식을 가져가 함께 나눈다', [mental(3), condition(3)]]], partner),
  story('PARTNER', 'bond-role-switch', '서로의 자리', '{partner}가 훈련에서 역할을 바꿔 보면 서로를 더 잘 이해할 것이라고 한다.', [['상대의 시선으로 움직여 본다', [skill('offTheBall'), condition(-3)]], ['각자의 어려운 장면을 설명해 준다', [mental(3), standing(2)]]], partner),
  story('PARTNER', 'bond-milestone', '함께 만든 기록', '중계진이 {name}과 {partner}의 꾸준한 호흡을 따로 소개했다.', [['스태프와 동료들에게도 감사를 전한다', [reputation(2), standing(2)]], ['둘만의 기념사진을 남긴다', [mental(5)]]], { requires: { partner: true, minReputation: 25 }, maxOccurrences: 2 }),
  story('PARTNER', 'bond-recovery', '먼저 쉬라는 권유', '{partner}가 피곤해 보인다며 오늘 추가 연습은 자신에게 맡기라고 한다.', [['고맙게 받아들이고 회복한다', [condition(7), mental(2)]], ['짧은 패스 훈련만 함께한다', [mental(3), condition(1)]]], partner),
  story('PARTNER', 'bond-mentoring', '함께 가르치는 후배', '어린 동료가 {name}과 {partner}의 연계 움직임을 배우고 싶어 한다.', [['역할을 나눠 직접 보여준다', [standing(3), mental(2), condition(-2)]], ['연계 영상을 만들어 공유한다', [standing(2), mental(2)]]], { minAge: 25, requires: { partner: true } }),
  story('PARTNER', 'bond-future', '서로 다른 커리어 계획', '{partner}는 새로운 리그에 관심이 있다며 솔직한 의견을 물었다.', [['장단점을 함께 적어 본다', [mental(4)]], ['서로의 목표를 존중하자고 말한다', [mental(3), standing(1)]]], { minAge: 23, requires: { partner: true } }),
  story('RIVAL', 'duel-handshake', '경기 뒤의 악수', '{rival}이 치열한 경기 뒤 먼저 악수를 청했다.', [['좋은 경쟁이었다고 답한다', [mental(4), reputation(1)]], ['다음에는 이기겠다고 웃으며 말한다', [mental(3), standing(1)]]], rival),
  story('RIVAL', 'duel-film', '라이벌의 새로운 무기', '{rival}이 최근 새로운 움직임으로 좋은 평가를 받고 있다.', [['강점을 분석하고 내 대응을 준비한다', [skill('defPositioning'), mental(1)]], ['비교를 멈추고 내 장점에 집중한다', [mental(4)]]], rival),
  story('RIVAL', 'duel-fan-comparison', '팬들의 끝없는 비교', '팬들이 {name}과 {rival}의 수치를 나란히 올리며 논쟁하고 있다.', [['좋은 경쟁이 성장에 도움이 된다고 답한다', [reputation(1), mental(3)]], ['관련 알림을 잠시 끈다', [mental(5)]]], rival),
  story('RIVAL', 'duel-charity-game', '같은 편이 된 라이벌', '자선경기에서 {rival}과 한 팀으로 뛰게 됐다.', [['서로의 장점을 살리는 연계를 시도한다', [reputation(2), mental(2), condition(-3)]], ['후배들에게 기회를 만들어 준다', [reputation(1), standing(2)]]], { requires: { rival: true }, phases: ['SECOND_HALF', 'PRESEASON'] }),
  story('RIVAL', 'duel-award-table', '시상식의 같은 테이블', '시상식 좌석이 {rival}의 바로 옆으로 배정됐다.', [['서로의 좋은 경기를 이야기한다', [mental(3), reputation(1)]], ['축구 밖의 이야기를 나눈다', [mental(4)]]], { requires: { rival: true, minReputation: 45 } }),
  story('RIVAL', 'duel-form-slump', '주춤하는 라이벌', '{rival}이 부진하자 기자가 지금이 격차를 벌릴 기회냐고 물었다.', [['상대도 다시 올라올 선수라고 답한다', [reputation(2), mental(2)]], ['우리 팀 경기만 이야기한다', [standing(2), mental(1)]]], rival),
  story('RIVAL', 'duel-training-method', '다른 방식의 노력', '특집 영상에서 {rival}의 독특한 훈련법을 보게 됐다.', [['코치와 내게 맞는 부분을 검토한다', [mental(2), skill('technique')]], ['현재 훈련을 더 꾸준히 지킨다', [mental(3), condition(2)]]], rival),
  story('RIVAL', 'duel-last-generation', '함께 보낸 시대', '오래된 맞대결 사진에 {rival}이 짧은 응원 메시지를 남겼다.', [['서로의 커리어를 존중한다고 답한다', [mental(5), reputation(1)]], ['다음 맞대결도 기대한다고 적는다', [mental(4), standing(1)]]], { minAge: 30, requires: { rival: true }, maxOccurrences: 1 }),

  // 커리어 단계·베테랑 16종
  story('TEAM', 'career-youth-selection', '유소년 대표 연습 초대', '지역 유소년 선발팀이 합동 훈련을 제안했다. 새로운 경쟁자를 만날 기회다.', [['다른 선수들의 장점을 배워 온다', [mental(3), skill('technique')]], ['소속팀 일정과 맞춰 짧게 참가한다', [standing(2), condition(-2)]]], { maxAge: 18, requires: { minOVR: 55 }, maxOccurrences: 1 }),
  story('TEAM', 'career-early-prodigy', '또래보다 빠른 성장', '코치가 또래보다 빠르게 성장했다며 급하게 모든 것을 떠맡지 말라고 조언했다.', [['기본 루틴을 차분하게 지킨다', [mental(5), condition(3)]], ['한 단계 높은 전술 수업을 듣는다', [skill('vision'), mental(2)]]], { maxAge: 19, requires: { minOVR: 65 }, maxOccurrences: 1 }),
  story('TEAM', 'career-late-bloom', '늦게 찾아온 기회', '코치는 최근의 실력이 눈에 띄게 좋아졌다며 아직 늦지 않았다고 말했다.', [['기회를 준 코치에게 준비된 모습을 보인다', [standing(4), mental(3)]], ['급하게 강도를 올리지 않고 몸을 관리한다', [condition(5), mental(2)]]], { minAge: 24, maxAge: 29, requires: { minOVR: 68, maxReputation: 29 }, maxOccurrences: 1 }),
  story('TEAM', 'career-main-man', '공격의 기준점', '전술 회의에서 감독이 팀의 공 흐름을 {name} 중심으로 설명했다.', [['동료의 움직임까지 책임 있게 조율한다', [standing(4), mental(2)]], ['부담을 나눌 대안을 함께 준비한다', [standing(2), skill('vision')]]], { requires: { minOVR: 80, firstTeam: true }, maxOccurrences: 2 }),
  story('MEDIA', 'career-prime-question', '전성기를 묻는 질문', '기자가 지금이 최고의 시기냐고 물었다. 스스로도 경기가 잘 보이는 시기다.', [['매 경기를 소중히 여기겠다고 답한다', [mental(4), reputation(1)]], ['팀의 목표를 이루고 평가받겠다고 한다', [standing(3), reputation(1)]]], { minAge: 25, maxAge: 29, requires: { minOVR: 80 } }),
  story('TEAM', 'career-new-generation', '나를 보고 자란 선수', '막 입단한 신인이 어릴 때 {name}의 유니폼을 입고 뛰었다고 말했다.', [['훈련과 생활의 조언을 나눈다', [standing(3), mental(4)]], ['처음 마음을 떠올리며 함께 훈련한다', [mental(5), condition(-2)]]], { minAge: 28, requires: { minReputation: 40 }, maxOccurrences: 2 }),
  story('TRAINING_METHOD', 'career-positioning-age', '한 걸음 먼저 서기', '피지컬 코치가 많이 뛰기보다 먼저 좋은 자리를 잡는 방법을 권했다.', [['상대의 다음 움직임을 읽는 훈련을 한다', [skill('defPositioning'), mental(2)]], ['기존 움직임을 유지하며 회복을 늘린다', [condition(6)]]], veteran),
  story('TRAINING_METHOD', 'career-pass-tempo', '경험으로 조절하는 템포', '예전보다 질주가 힘들지만 공을 언제 놓아야 하는지는 더 잘 보인다.', [['패스 타이밍을 세밀하게 다듬는다', [skill('kickAccuracy'), mental(2)]], ['짧은 훈련으로 감각을 유지한다', [condition(4), mental(2)]]], veteran),
  story('TEAM', 'career-mentor-request', '후배의 일대일 상담', '출전 경쟁으로 힘들어하는 후배가 {name}에게 조언을 구했다.', [['내가 겪었던 시행착오를 솔직히 이야기한다', [standing(4), mental(3)]], ['코치와 직접 대화할 자리를 만들어 준다', [standing(3), mental(1)]]], { minAge: 29 }),
  story('TEAM', 'career-load-plan', '베테랑의 훈련 일정', '구단이 경기 사이 훈련량을 줄이는 개인 일정을 제시했다.', [['휴식과 전술 수업을 함께 배치한다', [condition(7), mental(2)]], ['훈련은 짧게 하고 팀 미팅에는 참여한다', [condition(5), standing(2)]]], veteran),
  story('TRAINING_METHOD', 'career-set-piece-master', '경험을 살린 킥', '동료들이 몸의 부담이 적은 세트피스를 더 맡아 달라고 제안했다.', [['킥의 궤적과 타이밍을 다듬는다', [skill('setPieces'), condition(-2)]], ['후배 키커와 역할을 나눈다', [standing(3), condition(3)]]], { minAge: 30, requires: { minOVR: 65 } }),
  story('MEDIA', 'career-coach-future', '지도자라는 다음 길', '협회가 선수 생활과 병행할 수 있는 기초 지도자 수업을 소개했다.', [['전술 수업부터 들어 본다', [skill('vision'), mental(3)]], ['지금은 선수 생활에 더 집중한다', [mental(4), condition(2)]]], { minAge: 31, maxOccurrences: 1 }),
  story('TEAM', 'career-dressing-room-voice', '경험자의 목소리', '팀이 어려운 상황을 맞자 감독이 라커룸의 중심을 잡아 달라고 부탁했다.', [['어린 선수들과 대화할 시간을 만든다', [standing(5), mental(2)]], ['훈련에서 흔들리지 않는 모습을 보인다', [standing(3), condition(-2)]]], { minAge: 30, requires: { minReputation: 30 } }),
  story('MEDIA', 'career-anniversary', '데뷔 기념일', '구단이 프로 데뷔 기념일에 지난 경기 사진을 모아 공개했다.', [['지금도 함께하는 직원들에게 인사한다', [mental(5), standing(2)]], ['첫 경기의 마음을 짧게 글로 남긴다', [mental(4), reputation(1)]]], { minAge: 32, maxOccurrences: 1 }),
  story('TEAM', 'career-final-role', '줄어든 시간, 필요한 역할', '감독이 출전 시간을 줄이더라도 중요한 순간에는 경험이 필요하다고 말했다.', [['경기 흐름을 읽고 교체 출전을 준비한다', [mental(4), standing(3)]], ['후배가 선발을 준비하도록 돕는다', [standing(4), condition(4)]]], { minAge: 33 }),
  story('FAMILY', 'career-what-remains', '오래 뛰는 이유', '가족이 이제 무엇을 위해 더 뛰고 싶은지 조심스럽게 물었다.', [['아직 팀에 도움이 되는 즐거움을 이야기한다', [mental(6)]], ['선수 이후의 삶도 함께 준비한다', [mental(4), condition(3)]]], { minAge: 34, maxOccurrences: 1 }),
];
