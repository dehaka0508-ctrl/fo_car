# 외부 구단 DB (`data/external/`)

이 폴더에 리그별 구단 JSON을 넣으면 게임 데이터에 자동으로 합쳐집니다.

- `npm run dev` · `npm run build` · `npm test` · `npm run sim*`를 실행하면 색인(`index.ts`)이 자동으로 갱신됩니다.
  직접 갱신하고 결과 보고서를 보려면 `npm run db:sync`를 실행하세요.
- `_`나 `.`으로 시작하는 파일·폴더(예: `_examples/`)는 읽지 않습니다.
- 외부 DB에 구단이 들어온 리그는 그 리그의 내장 샘플 구단(`data/clubs.ts`)을 **통째로 대체**합니다.
- 구단이 4개 이상인 리그만 활성화됩니다. 리그 슬롯 47개는 `data/leagues.ts`에 정의되어 있습니다.
- 세이브는 지워지지 않습니다. 구단 구성이 바뀌면 불러올 때 맞춰지고, 소속 구단이 사라졌으면 FA가 됩니다.

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
