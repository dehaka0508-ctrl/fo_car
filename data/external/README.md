# 외부 구단 DB (`data/external/`)

이 폴더에 리그별 구단 JSON을 넣으면 게임 데이터에 자동으로 합쳐집니다.

- `npm run dev` · `npm run build` · `npm test` · `npm run sim*`를 실행하면 색인(`index.ts`)이 자동으로 갱신됩니다.
  직접 갱신하고 결과 보고서를 보려면 `npm run db:sync`를 실행하세요.
- `_`나 `.`으로 시작하는 파일·폴더(예: `_examples/`)는 읽지 않습니다.
- 외부 DB에 구단이 들어온 리그는 그 리그의 내장 샘플 구단(`data/clubs.ts`)을 **통째로 대체**합니다.
- 구단이 4개 이상인 리그만 활성화됩니다. 리그 슬롯 47개는 `data/leagues.ts`에 정의되어 있습니다.
- 세이브는 지워지지 않습니다. 구단 구성이 바뀌면 불러올 때 맞춰지고, 소속 구단이 사라졌으면 FA가 됩니다.

## 현재 들어 있는 DB: `club-db.json` (47개 리그 · 801개 구단)

엑셀 구단 DB(`구단 DB` 시트 · `리그 목록` 시트)에서 만든 파일입니다. 엑셀을 고쳤다면 다시 변환하세요.

```bash
npm run db:import -- 구단DB.xlsx      # → data/external/club-db.json (구단마다 한 줄)
npm run db:sync                      # 병합 보고서 확인 (dev·build·test 때 자동 실행)
```

엑셀 열 → JSON 필드:

| 엑셀 열 | JSON | 게임에서 |
| --- | --- | --- |
| 구단 ID · 구단명 · 원문 구단명 | `id` · `name`(한글) · `nameEn` | 구단 id · 한글명 · 영문명 (약칭은 영문명 머리글자) |
| 리그 ID · 국가 · 부 | `leagueId`(`eng_1`) · `country` · `tier` | 리그 슬롯 (`국가 코드_부` → `ENG_PL`) |
| 실력 · 명성 · 재정 | `hiddenStats` | 히든 수치 (아래 척도 환산) |
| 직전 순위 · 직전 소속 리그 · 다음 대륙컵 | `season2526` | 첫 시즌 리그 순서(강등팀 → 잔류팀 순위순 → 승격팀) · 대륙 대회 진출 |
| 제1색 · 줄무늬 제2색 | `kitColors` | 유니폼 (제2색이 있으면 세로 줄무늬) |
| 최다 득점자/도움/출전 · 상징 FW/MF/DF/GK | `legends` | 구단 기록 보유자 · 포지션 레전드 |

- **척도 환산** (`meta.scale`): 엑셀 수치는 폭이 넓어(맨시티 94 · K리그2 평균 52) 그대로 쓰면 강팀이 경기당 4골 넘게 넣습니다.
  로더가 실력은 `66 + 0.7 × (값 − 66)`, 명성·재정은 `값 − 8`로 바꿔 씁니다. 파일의 원래 값은 그대로 둡니다.
- 외부 리그의 수준(`strength`)은 소속 구단 실력(환산 후) 평균으로 정합니다.
- 다음 대륙컵 `UCL`/`UEL`/`UECL`/`ACL`/`LIB`/`CCC`/`CAFCL`은 게임의 대륙 대회로, `ACL2`·`SUD`·`CAFCC`·`NONE`은 진출 없음으로 봅니다.
- 더비는 `data/derbies.ts`(국가별 영문 구단명 쌍 252개)에서 이름으로 이어 줍니다.

## 파일 형식

가장 기본 형태 (예시: `_examples/ITA_SA.example.json`):

```json
{
  "league": "ITA_SA",
  "clubs": [
    {
      "id": "inter",
      "name": "Inter",
      "nameKo": "인테르",
      "shortName": "INT",
      "power": 86,
      "prestige": 88,
      "finance": 84,
      "kitColors": { "primary": "#0068A8", "secondary": "#000000" },
      "rivals": ["milan", "juventus"],
      "legends": [{ "name": "하비에르 사네티", "position": "RB", "nationality": "ARG", "era": "1995–2014" }],
      "records": [{ "category": "APPEARANCES", "holder": "하비에르 사네티", "value": 858 }]
    }
  ]
}
```

다음 형태도 받습니다.

- 구단 배열만 있는 파일: `[{ "name": ..., "league": "ITA_SA", ... }]` (구단마다 `league`, 없으면 파일 이름으로 리그를 찾음)
- 여러 리그를 담은 파일: `{ "leagues": [{ "league": "ITA_SA", "clubs": [...] }, ...] }`
- 리그 id를 키로 쓴 파일: `{ "ITA_SA": [...], "ITA_SB": [...] }`

### 리그 찾기

`league`에는 다음 중 무엇을 써도 됩니다: 리그 id(`ITA_SA`), 영문명(`Serie A`), 한글명(`세리에 A`),
별칭(`ITA1` 등, `data/leagues.ts`의 `aliases`), 또는 `{ "country": "Italy", "tier": 1 }`.
모두 없으면 파일 이름(`ITA_SA.json`)으로 찾습니다. 리그 객체에 `strength`·`intensity`·`roundRobinCycles`를 넣으면 리그 수치를 덮어씁니다.

### 구단 필드

| 필드 | 필수 | 설명 · 받아 주는 다른 이름 |
| --- | --- | --- |
| `name` | ✔ (`nameKo`만 있어도 됨) | 영문명 · `nameEn`, `fullName` |
| `nameKo` | | 한글명 · `name_ko`, `koreanName` (없으면 `name`) |
| `id` | | 영문 소문자 id (없으면 이름으로 생성). 더비·기록이 이 id로 연결됨 |
| `shortName` | | 3~4자 약칭 · `short`, `abbr`, `tla` |
| `nation` | | 국가 코드(`ITA`) 또는 국가명. 없으면 리그 국가 |
| `power` · `prestige` · `finance` | | 히든 수치 1~99 · `strength`/`rating`, `reputation`, `budget`. `hidden: {...}` 안에 둬도 됨. 없으면 리그 수준 기준값 |
| `kitColors` | | `{ "primary": "#RRGGBB", "secondary": "#RRGGBB" \| "" \| null }` · `colors: [p, s]` · `primaryColor`/`secondaryColor` |
| `rivals` | | 더비 상대 id 또는 이름 목록. 모르는 구단은 무시 |
| `legends` | | `[{ name, position, nationality?, era?, tribute? }]` · `null`/누락 가능 |
| `records` | | `[{ category, holder, value }]` · category: `GOALS`, `ASSISTS`, `APPEARANCES`, `CLEAN_SHEETS`, `TROPHIES` |
| `promotionEligible` | | `false`면 승격 불가 (B팀) · `isReserveTeam: true`도 가능 |

### 자동 정규화

- `kitColors.secondary`가 `""`·`"none"`·`null`이거나 `primary`와 같으면 → `null` (단색 유니폼). 값이 있으면 1-2-1-2-1 세로 줄무늬.
- `"fff"`·`"#fff"` 같은 hex는 `"#FFFFFF"`로 맞춥니다.
- `legends`가 `null`이거나 없으면 → 같은 id의 내장 레전드를 쓰고, 그것도 없으면 레전드 헌사에서 동 포지션 레전드 언급을 생략합니다.
  이름이나 포지션이 없는 레전드 항목은 버립니다. 포지션은 `GK`, `CB`/`DF`, `LB`, `RB`, `DM`, `CM`/`MF`, `AM`, `LW`, `RW`, `ST`/`FW`(한글 표기도 일부 가능).
- 히든 수치는 1~99로 자릅니다.

`npm run db:sync` 결과에 고친 항목 수와 경고(모르는 리그·국가, 구단 수 부족 등)가 나옵니다.
