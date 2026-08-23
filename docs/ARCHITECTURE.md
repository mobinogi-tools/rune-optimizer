# 오픈소스 기여 아키텍처 제안 — Mabinogi Mobile Rune Optimizer

> 목표: 직업별 전문가(게이머, JS 비독해자 포함)가 자기 직업 부분을 고칠 수 있게 한다.
> 전제: 서버·DB·번들러·프레임워크·외부 의존성 추가 금지. 런타임 fetch 없이 정적 파일로 동작.

> **정정 (2026-08-09).** 이 문서는 아래에서 "브라우저가 `file://` 로 열어도 돌아야 한다" 를
> 여러 곳의 근거로 삼는데, 그 전제가 틀렸다. 페이지가 `<script type="module">` 을 쓰고
> 브라우저는 `file://` 에서 모듈을 CORS 로 막는다 — 직접 열면 빈 화면이 된다.
> 개발은 `npm run dev`(의존성 없는 Node 정적 서버)로 한다.
>
> 그 전제에서 나온 **결정 자체는 그대로 둔다.** `data/*.json` 을 `src/gen/*.mjs` 로 생성해
> 커밋하는 이유가 "`file://` 에서 fetch 가 안 되니까" 에서 **"빌드 단계 없이 정적 파일만
> 얹어도 돌아가게"** 로 바뀔 뿐이고, 결론은 같다. 아래 본문은 당시 기록이라 고치지 않았다.
> 오늘 기준 기여자 0명 — 지금 필요한 최소만 만들고, 나머지는 명시적으로 미룬다.

---

## 1. 현재 구조의 기여 장벽 진단

세 기여 유형이 각각 어디서 막히는지, 실제 파일·줄 번호로 짚는다.

### (1) 순수 데이터 수정 — "댄서 2템포는 25초가 아니라 23초다"

이 "값 하나"가 실제로는 **세 곳에 세 가지 형태로** 존재한다.

| 위치 | 형태 | 내용 |
|---|---|---|
| `src/class-passives.mjs:31` | JS 상수 | `triggerIntervalSeconds: 25` |
| `src/default-profile.mjs:49` | **파생값의 하드코딩** | `nightBlessingCycleSeconds: 75` (= ceil(60/25)×25 를 손으로 계산해 적은 것) |
| `src/rune-app.mjs:57` | 한국어 산문 | FIELD_HINTS: "댄서는 2템포가 약 25초 간격이라 … 75초, 기사는 … 90초입니다" |

25→23 으로 고치면 주기는 69초가 되는데(ceil(60/23)×23), 세 곳을 다 아는 사람만 옳게 고칠 수 있다. 한 곳만 고치면 **모순된 상태로 조용히 배포된다** — 어떤 테스트도 이 세 곳의 일관성을 검사하지 않는다(`tests/calculator.test.mjs` 는 calculator.mjs 8개 케이스뿐, evaluator·passives·conditionals 테스트 0개).

추가 장벽:

- **근거가 주석이다.** `src/class-passives.mjs:27-30` 의 실측 기록("2템포가 22.5~27.4초 간격(평균 24.8초)")은 (a) 스크립트가 읽을 수 없고, (b) `tools/build-dist.sh:41` 의 `strip-comments.mjs` 가 배포본에서 지우고, (c) 기여자가 "내 실측은 어디에 적나"를 알 수 없다. `confidence` 필드는 이미 데이터인데(`CLASS_NIGHT_BLESSING` high 7 / medium 8 / low 6) 그 근거는 데이터가 아니다.
- **JS 파일이라는 것 자체.** `rune-conditionals.mjs`(821줄) 는 사실상 데이터 테이블이지만, `Object.freeze`, 문자열 이어붙이기(602-603줄), 주석과 데이터의 혼재 때문에 JS 를 모르는 사람이 안전하게 편집할 수 없다.
- **오타가 조용히 죽는다.** `build-evaluator.mjs:113-116` 의 `add(target, path, value)` 는 임의 문자열 키를 그대로 누적하고, `buildFrom()`(291-342줄)은 `d('finalDamage.percent')` 처럼 **고정된 경로 문자열만** 골라 읽는다. `'finalDamge.percent'` 라고 적으면 deltas 에 쌓이기만 하고 아무도 읽지 않아, 에러 없이 계산에서 빠진다. 데이터 기여에서 가장 흔할 실수가 가장 감지 안 되는 실수다.

### (2) 모델 확장 요청 — 세 하위 유형별로

**(2a) "이 패시브도 넣어야 해요"** — 가장 덜 막힌 경우다. `CLASS_ALWAYS_ON`(`class-passives.mjs:222-246`)에 항목 하나 추가하면 되고, `classAlwaysOnEffects()` 가 합산해 준다. 문제는 (1)과 같다: JS 파일이고, effects 키 오타 검증이 없고, 근거를 적을 자리가 없다.

**(2b) "이건 개인마다 달라서 입력칸이 필요해요"** — 검술사 '집중'이 이 유형의 현재 구현이고, 비용이 얼마나 드는지 보여주는 표본이다. 한 직업 패시브 하나를 "사용자 입력 가동률"로 만들기 위해 건드린 곳:

1. `class-passives.mjs:182-209` — `CLASS_UPTIME_PASSIVE` 정의 (label, hint, defaultUptimePercent, effects)
2. `build-evaluator.mjs:82` — `PROFILE_TEMPLATE.classPassiveUptimePercent` 필드 신설
3. `build-evaluator.mjs:190-195` — 소비 로직 (가동률 곱, 밤축 확정발동 처리)
4. `rune-app.mjs:587-588` — 힌트 특례: `key === 'classPassiveUptimePercent' ? uptimePassive(state.job)?.hint : …`
5. `rune-app.mjs:602-607` — '직업 특성' 그룹에 칸을 **하드코딩으로** 끼워 넣기
6. `rune-app.mjs:1448` — 직업 변경 시 기본값 리셋
7. `default-profile.mjs:47` — DEFAULT_PROFILE 초기값

**4개 파일 7군데**이고, 그중 UI 쪽 3곳은 `classPassiveUptimePercent` 라는 키 이름이 문자열로 박혀 있다. 구조적 한계: **직업당 입력칸 1개, 키 이름 고정, 그룹 고정**. "우리 직업은 가동률 입력이 두 개 필요하다"(예: 악사의 크레센도 가동률 + 무드 소모율)는 지금 구조로는 UI 코드를 새로 짜야 한다. 실제로 악사는 그 한계 때문에 `class-passives.mjs:77` 에서 `30 × 10/15 = 20` 을 **미리 깎아서 상수로** 박아 두었다 — 개인차가 있는 값이 사용자 손이 닿지 않는 곳에 있다.

**(2c) "이 가동률은 계산으로 정해져요"** — 파생 계산식은 이미 좋은 패턴의 싹이 있다: `RUNE_CONDITIONALS` 의 `expectedFrom: 'erosion' | 'stacks' | 'streak' | 'hitTrigger' | 'castCycle'` 이 이름으로 수식을 참조하고, 수식 본체(`erosionExpected`, `streakStackExpected` 등)는 코드에 있다. 문제는 **디스패치가 평가기 한복판의 3항 연산자 사슬**(`build-evaluator.mjs:251-268`)이라는 것. 새 계산식 하나를 추가하려면 수식 함수 작성 + 이 사슬 편집이 필요한데, 이 사슬은 시나리오 분기·override 우선순위·게이트 로직과 얽혀 있어 평가기 전체를 이해해야 안전하게 고칠 수 있다.

### (3) UI만 고치고 싶은 사람

- `runes.css`(28K) 만 만지는 순수 스타일 기여는 이미 안전하다. 문제는 그 다음 단계다.
- `rune-app.mjs` 는 1,489줄에 **상태·저장·렌더링·이벤트뿐 아니라 계산 로직이 섞여 있다**:
  - 힐클라이밍 최적화기(`climb`/`bestInsertion`/`greedyFill`/`optimize`, 413-559줄)는 순수 탐색 알고리즘인데 UI 파일 안에 있다. 레이아웃을 고치다 추천 순위를 깨뜨릴 수 있는 구조다.
  - `runeDetailHtml`(832-910줄)은 `resolveRuneEffects` 를 min/expected 두 번 호출해 차분으로 기대값을 역산하는 모델 해석 로직을 품고 있다.
  - `uncountedOf`(926-962줄)는 게임 설명 텍스트를 정규식으로 분류하는 데이터 파싱 로직이다.
  - `FIELD_LABEL`(912-924줄), `FIELD_HINTS`(55-65줄), `COMBAT_GROUPS`(71-98줄)는 모델 지식(어떤 필드가 존재하고 무슨 뜻인지)이 UI 파일에 산다.
- UI 기여자가 지켜야 할 경계("여기서부터는 계산")가 문서로도 코드 구조로도 존재하지 않고, DOM 없는 테스트 환경(node:test, 의존성 0)이라 UI 실수를 잡아줄 테스트도 없다.

---

## 2. 목표 구조

### 원칙

1. **편집 대상은 `data/` 의 JSON, 런타임은 생성된 ESM.** 브라우저가 `file://` 로 열려도 돌아야 해서 JSON 을 fetch 하지 않고 ESM 모듈로 낸다(`tools/build-data.mjs`). 생성물(`src/gen/`)은 커밋한다 — clone 해서 `runes.html` 을 바로 열면 돌아야 하기 때문이다. 런타임 fetch 는 도입하지 않는다.
2. **직업 파일이 기여의 단위다.** 직업 전문가는 `data/jobs/자기직업.json` 하나만 소유한다. 21개 파일이면 PR 충돌도 직업 간에 없다.
3. **근거(evidence)는 필드다.** 주석은 이주 시점에 evidence 로 옮기고, 이후 근거 없는 항목은 테스트가 거부한다.
4. **수식은 코드, 데이터는 수식을 이름으로 참조.** 수식을 데이터에 넣지 않는다(eval 금지).

### 파일 배치

```
data/                          ← 기여자가 편집하는 유일한 영역 (JSON)
  jobs/
    댄서.json  검술사.json  … (21개)
  masteries.json               ← 전투 숙련 7종 (combat-mastery.mjs 의 데이터부)
  rune-conditionals.json       ← RUNE_CONDITIONALS + 계열 상수 (36K 손데이터)
  effect-fields.json           ← effects 경로 화이트리스트 + 한국어 라벨 (핵심, 아래)
  artifacts.json               ← artifacts-data.mjs 의 데이터부

src/
  gen/                         ← 생성물. 커밋한다(빌드 없이 clone→열기 가능하게).
    jobs-data.mjs  masteries-data.mjs  rune-conditionals-data.mjs
    effect-fields.mjs  artifacts-data.mjs  runes-data.mjs
  calculator.mjs               ← 불변 (A~L 공식)
  formulas.mjs                 ← 수식 레지스트리 (rune-conditionals.mjs 의 함수부 이동)
  build-evaluator.mjs          ← gen 데이터를 읽는 순수 평가기
  optimizer.mjs                ← (단계 1) rune-app 에서 추출한 탐색기
  rune-app.mjs                 ← UI 전용으로 수렴

tools/
  build-data.mjs               ← data/*.json → src/gen/*.mjs (build-web-data.mjs 흡수·확장)
  validate-data.mjs            ← 손수 짠 스키마 검증기 (의존성 0, §5)

tests/
  calculator.test.mjs          ← 기존
  data.test.mjs                ← 스키마·evidence·화이트리스트 (§5)
  effects-liveness.test.mjs    ← 경로 생존성 (§5)
  gen-freshness.test.mjs       ← 생성물이 data/ 와 일치하는지
```

`tools/build-dist.sh` 는 그대로 동작한다 — import 재귀 추적이 `src/gen/` 도 따라간다. 생성기는 브라우저 번들에서 `evidence` 필드를 떨궈 용량을 아낄 수 있다(주석 제거의 데이터판 — 단 원본 `data/` 에는 항상 남는다).

### 직업 파일 스키마 (실제 예시)

`data/jobs/댄서.json` — 현재 `class-passives.mjs` + `default-profile.mjs` 의 댄서 몫을 전부 흡수:

```json
{
  "job": "댄서",
  "mastery": "쾌속",
  "nightBlessing": {
    "trigger": "강화 효과: 템포 2단계를 얻을 시",
    "triggerIntervalSeconds": 25,
    "effects": { "finalDamage.percent": 40 },
    "confidence": "high",
    "note": "템포 2중첩 = 최종 데미지 +40%. 지속 15초로 밤의 축복과 완전히 동기된다.",
    "evidence": [
      { "type": "measured", "date": "2026-08-07",
        "note": "2템포 간격 실측 22.5~27.4초, 평균 24.8초. 쿨에 맞추려고 2템포를 늦추는 선택은 없다 — 2템포 구간이 곧 딜 구간." }
    ]
  },
  "uptimePassives": [],
  "alwaysOn": [],
  "inputs": [],
  "samples": {
    "stats": { "rapidEnhance": 6300, "heavyEnhance": 2100, "areaEnhance": 1600,
               "comboEnhance": 2100, "ultimateEnhance": 2000, "criticalStat": 10500,
               "breakStat": 2600, "extraHitStat": 3900, "skillPower": 3000 },
    "combat": { "hitsPerSecond": 2.4, "skillCastsPerSecond": 1, "rapidRatePercent": 99,
                "heavyRatePercent": 88, "areaRatePercent": 0,
                "characterCriticalRatePercent": 8, "characterExtraRatePercent": 8 }
  }
}
```

`data/jobs/검술사.json` — 사용자 입력 선언(`inputs`)과 그것을 소비하는 패시브:

```json
{
  "job": "검술사",
  "mastery": "위협",
  "nightBlessing": {
    "trigger": "간파, 간파가 변화한 스킬 사용 시",
    "effects": { "attackIncrease.itemAttackPercent": 30 },
    "confidence": "medium",
    "note": "선수필승(공격력 +30%, 15초)은 일섬 사용 시 조건 없이 발동한다. …",
  },
  "inputs": [
    { "key": "focusUptime", "label": "집중 가동률 %", "group": "직업 특성",
      "default": 100, "min": 0, "max": 100,
      "hint": "집중 상태에서 치확 +40%, 치피 +30%. 방치하면 50% 근처, 숙련되면 100%." }
  ],
  "uptimePassives": [
    { "id": "focus", "name": "집중",
      "effects": { "critical.runeCriticalRatePercent": 40, "critical.criticalDamagePercent": 30 },
      "uptimePercentFrom": "focusUptime",
      "nightBlessingGuarantees": true,
      "confidence": "high",
  ],
  "alwaysOn": [
    { "id": "sharp-eye", "name": "날카로운 눈",
      "effects": { "critical.criticalDamagePercent": 30 },
      "confidence": "medium",
      "note": "치명타율이 높으면 사실상 상시라 최대치로 둔다.",
  ],
  "samples": null
}
```

`data/effect-fields.json` — **화이트리스트이자 라벨 사전**. 지금 `rune-app.mjs:912-924` 의 `FIELD_LABEL` 과 "평가기가 실제로 배선한 경로 집합"(암묵지)을 하나로 합친 것:

```json
{
  "attackIncrease.itemAttackPercent":     { "label": "공증" },
  "damageIncrease.itemMainDamagePercent": { "label": "피증" },
  "damageIncrease.skillDamagePercent":    { "label": "스킬 피해" },
  "critical.runeCriticalRatePercent":     { "label": "치명타 확률" },
  "critical.criticalDamagePercent":       { "label": "치명타 피해" },
  "extraHit.runeExtraRatePercent":        { "label": "추가타 확률" },
  "extraHit.extraDamagePercent":          { "label": "추가타 피해" },
  "enhancement.rapidDamagePercent":       { "label": "연타 피해" },
  "enhancement.heavyDamagePercent":       { "label": "강타 피해" },
  "enhancement.areaDamagePercent":        { "label": "광역 피해" },
  "enhancement.comboDamagePercent":       { "label": "콤보 피해" },
  "break.vulnerabilityDamagePercent":     { "label": "무방비 피해" },
  "finalDamage.percent":                  { "label": "최종 데미지" }
}
```

이 파일에 있는 경로만 어떤 `effects` 에서든 쓸 수 있다. 새 경로가 필요하면 이 파일 + `buildFrom()` 배선 + (필요시) calculator 를 같이 고쳐야 하고, 그건 **모델 관리자 작업**으로 명시한다(§3-끝).

`data/rune-conditionals.json` — 구조는 현 `RUNE_CONDITIONALS` 그대로, 두 가지만 바꾼다:

```json
{
  "거대한 분노": [
    { "id": "streak", "field": "damageIncrease.skillDamagePercent", "label": "스킬 피해%",
      "min": 0, "expected": null, "max": 12,
      "expectedFrom": "streak", "perStack": 3, "maxStacks": 4, "streakRate": "heavyRatePercent",
      "basis": "derived",
      "note": "강타 적중마다 +3%, 최대 4중첩. 강타가 아닌 공격이 들어오면 즉시 0.",
      "evidence": [ { "type": "tooltip", "date": "2026-08-05" } ] }
  ]
}
```

바뀐 것: ① `evidence` 필수화, ② `id` 필드 추가 — 현재 사용자 override 가 `profile.runeOverrides[룬].cond[e.label]` 처럼 **한국어 라벨을 키로** 쓰고 있어서(`build-evaluator.mjs:201-202`, `rune-app.mjs:892`), 라벨 문구를 다듬는 순수 UI 기여가 사용자의 저장된 조정값을 깨뜨린다. `id` 를 안정 키로 삼고 label 은 표시 전용으로 강등한다(localStorage 이행은 §6 단계 1).

### 생성 파이프라인

```
data/*.json ──▶ tools/validate-data.mjs (실패 시 중단)
            ──▶ tools/build-data.mjs ──▶ src/gen/*.mjs (커밋)
npm test = 검증 + 계산 테스트 + 생성물 신선도 검사
npm run build = 기존 build-dist.sh (변경 없음)
```

`class-passives.mjs`·`combat-mastery.mjs` 는 삭제되지 않는다 — **함수부만 남고**(`nightBlessingCycleSeconds`, `classAlwaysOnEffects` 등) 데이터는 `src/gen/` 에서 import 한다. 기존 import 경로가 유지되므로 `rune-app.mjs` 는 이 단계에서 거의 안 바뀐다.

---

## 3. 확장점 설계 — 세 요청 유형이 각각 어느 파일로 완결되는가

### (2a) "이 패시브도 넣어야 해요" → **파일 1개**

`data/jobs/전사.json` 의 `alwaysOn` 배열에 항목 추가. effects 키는 `effect-fields.json` 화이트리스트가 검증하고, evidence 없으면 테스트가 떨어진다. UI 는 손대지 않는다 — 상시 패시브는 원래 화면에 칸이 없고 계산에만 들어간다.

### (2b) "개인마다 달라서 입력칸이 필요해요" → **파일 1개** (핵심 확장점)

**메커니즘**: 직업 파일의 `inputs` 선언 하나가 다섯 가지를 동시에 해결한다 — 필드 정의(key), 라벨(label), 도움말(hint), 기본값(default), 계산 연결(`uptimePercentFrom` 등 참조).

런타임 배선(1회성 구현, 이후 불변):

- **상태**: `state.jobInputs = { [job]: { [key]: value } }`. 직업별로 분리 저장해 직업을 바꿔도 값이 안 섞인다. 직업 선택 시 선언된 default 로 초기화(`rune-app.mjs:1448` 의 특례 코드를 일반화).
- **렌더**: `renderFields()` 가 `COMBAT_GROUPS` 를 그릴 때 현재 직업의 `inputs` 를 `group` 이름으로 매칭해 끼워 넣는다. `rune-app.mjs:602-607` 의 `classPassiveUptimePercent` 하드코딩이 이 일반 루프로 대체된다. 매칭되는 그룹이 없으면 '직업 특성' 뒤에 새 그룹을 만든다.
- **소비**: `buildFrom()` 이전에 평가기가 `uptimePassives[].uptimePercentFrom` 을 `profile.jobInputs` 에서 해석한다(`build-evaluator.mjs:190-195` 의 현행 로직을 키 참조형으로 일반화).

**끝까지 따라가는 시나리오 — 악사 전문가의 실제 요청**:

> "크레센도 공증은 소모한 무드에 비례해요. 지금 20%로 박혀 있는데(원래 30%를 10/15초로 깎은 값), 무드 관리를 얼마나 하느냐에 따라 15~30% 사이입니다. 사용자가 조절하게 해주세요."

현재 이 값은 `class-passives.mjs:77` 에 `'attackIncrease.itemAttackPercent': 20` 으로 박혀 있고, 근거는 79줄 note 뿐이다. 새 구조에서 전문가(또는 전문가의 제보를 받은 관리자)가 하는 일:

`data/jobs/악사.json` 을 이렇게 고친다:

```json
{
  "job": "악사",
  "mastery": "쾌속",
  "inputs": [
    { "key": "crescendoAttackPercent", "label": "크레센도 실효 공증 %", "group": "직업 특성",
      "default": 20, "min": 0, "max": 30,
      "hint": "크레센도 최대 공격력 +30%(10초). 밤의 축복 15초 중 10초만 덮어 기본 20. 무드가 부족하면 더 낮습니다." }
  ],
  "nightBlessing": {
    "trigger": "기교: 크레센도 스킬 사용 시",
    "effects": {},
    "effectsFromInputs": { "attackIncrease.itemAttackPercent": "crescendoAttackPercent" },
    "confidence": "low",
    "evidence": [
      { "type": "community", "date": "2026-08-20", "note": "악사 유저 제보: 무드 소모량에 비례, 최대치 가정은 과대평가" }
    ]
  }
}
```

이후 자동으로 일어나는 일: `npm test` 가 (a) `crescendoAttackPercent` 참조가 `inputs` 에 선언돼 있는지, (b) effects 경로가 화이트리스트에 있는지, (c) evidence 가 있는지 검사 → `node tools/build-data.mjs` 가 `src/gen/jobs-data.mjs` 재생성 → 악사를 선택한 사용자의 '직업 특성' 그룹에 "크레센도 실효 공증 %" 칸이 도움말과 함께 나타나고, 그 값이 밤의 축복 ON 구간 계산에 들어간다. **건드린 파일: `data/jobs/악사.json` 1개. UI 코드 0줄, 평가기 0줄.**

### (2c) "이 가동률은 계산으로 정해져요" → **파일 2개 + 테스트**

파생 계산식은 데이터만으로 못 끝난다 — 수식은 코드다. 대신 **평가기를 안 건드리게** 만든다:

1. `src/formulas.mjs` 에 수식 함수를 추가하고 레지스트리에 등록:

```js
export const EXPECTED_FROM = {
  erosion: (e, ctx) => erosionExpected(e.erosionBase, ctx.pollutionReduction, ctx.erosionCount),
  stacks: (e, ctx) => e.perStack * Math.min(e.maxStacks, ctx.rateOf(e.rateField) * e.stackDurationSeconds),
  streak: (e, ctx) => e.perStack * streakStackExpected(ctx.profile[e.streakRate] / 100, e.maxStacks),
  hitTrigger: (e, ctx) => (e.max ?? 0) * hitTriggerUptime(e.hitTrigger, ctx.profile.hitsPerSecond),
  castCycle: (e, ctx) => e.perApplication * Math.min(1, e.durationSeconds * ctx.profile.skillCastsPerSecond / e.castsRequired),
  // ← 새 수식은 여기 한 줄 + 아래 함수 하나
};
```

2. `build-evaluator.mjs:251-268` 의 3항 사슬은 `EXPECTED_FROM[e.expectedFrom](e, ctx)` 단일 호출로 바뀐다(1회성 리팩터링). 이후 새 수식 추가는 평가기 diff 0.
3. `data/rune-conditionals.json` 또는 직업 파일에서 `"expectedFrom": "새이름"` 으로 참조. 검증기가 "레지스트리에 없는 expectedFrom" 을 거부하므로 이름 오타도 죽지 않는다.
4. `tests/` 에 수식 단위 테스트 — AGENTS.md 원칙("실측 표본이 생기면 테스트 먼저") 그대로.

**건드리는 것: `src/formulas.mjs`, 데이터 파일 1개, 테스트 1개.** 평가기·UI 불변.

### 경로(effects 자리) 자체가 없는 경우 — 명시적 한계

"궁극기 강화가 전체 딜에서 궁극기 비중만큼 반영돼야 해요" 같은 요청은 위 셋 어디에도 안 들어간다. calculator 의 항 구조가 바뀌는 일이고, `effect-fields.json` + `buildFrom()` + `calculator.mjs` + 테스트를 관리자가 함께 고쳐야 한다. CONTRIBUTING 에 "이건 이슈로 제안하는 유형이지 PR 유형이 아니다"라고 적는다. 확장점을 넓히는 것보다 **경계를 정직하게 긋는 것**이 여기서는 맞다.

---

## 4. UI-only 기여 경로

### 경계선 정의

UI 기여자가 자유롭게 만져도 되는 것과, 읽기 전용 인터페이스:

| 만져도 됨 | 읽기 전용 계약 (안정 인터페이스) |
|---|---|
| `runes.html`, `runes.css` | `evaluate(RUNES, names, scenario, profile)` 의 반환 shape (score, factors, deltas, notes, validity…) |
| `rune-app.mjs` 의 render·이벤트 코드 | `resolveRuneEffects()` 반환 shape |
| 라벨·힌트 문구 (`effect-fields.json` 의 label, 직업 파일의 hint) | `src/gen/*.mjs` 데이터 모듈 (읽기만) |
| | `src/formulas.mjs`, `build-evaluator.mjs`, `calculator.mjs`, `optimizer.mjs` |

### 이를 실제로 지키게 하는 장치 (점진, 재작성 아님)

1. **지금**: 계산 모듈은 UI 를 import 하지 않으므로, **골든 스코어 테스트**(고정 프로필 + 고정 룬 세트 → 점수 스냅샷, `tests/`)가 "UI PR 이 순위를 못 바꾼다"를 보장한다. UI 쪽 diff 만 있는 PR 에서 이 테스트가 깨지면 경계 침범이다. DOM 테스트는 의존성 없이는 불가능하므로 시도하지 않는다 — 경계 밖(계산)을 고정하는 것으로 갈음한다.
2. **단계 1**: `climb`/`bestInsertion`/`greedyFill`/`optimize`(`rune-app.mjs:413-559`)를 `src/optimizer.mjs` 로 추출. 현재 `score()` 클로저가 `state` 를 물고 있으므로 `scoreFn` 을 인자로 주입하는 기계적 변환이다. 이러면 rune-app 에 남는 계산 로직은 사실상 0이 되고, 최적화기도 테스트 가능해진다.
3. **단계 1**: `runeDetailHtml` 의 기대값 역산(832-856줄)과 `uncountedOf`(926-962줄)를 `src/rune-presenter.mjs` 같은 "모델→표시용 변환" 모듈로 빼면 rune-app 은 문자열 조립과 이벤트만 남는다. 급하지 않다 — 골든 테스트가 있으면 위험은 이미 낮다.
4. 문구 수정은 데이터 기여로 흡수된다: 라벨·힌트가 `data/` 로 이동했으므로 "더 친절한 도움말" PR 은 JSON 편집이다.

---

## 5. 검증 전략

**의존성 0 유지** — ajv·JSON Schema 대신 손수 짠 검증기 + node:test. 검증할 스키마가 4종뿐이라 범용 검증기가 필요 없다.

### `tools/validate-data.mjs` (~150줄)가 검사하는 것

1. **effects 키 화이트리스트**: 모든 `effects`, `effectsFromInputs`, `conditionalRaw` 의 키 ∈ `effect-fields.json`. `'finalDamge.percent'` 는 여기서 즉사한다. `artifacts.json` 과 `src/runes-data.mjs` 도 같은 사전을 참조시켜 사전을 단일 진실로 만든다(`tests/runes-data-paths.test.mjs`).
3. **confidence enum** + 구조 검사(min ≤ max, 필수 키, 미지의 키 거부 — 오타 난 *속성 이름*도 잡기 위해 unknown-key 는 에러).
4. **참조 무결성**: `expectedFrom`/`uptimeFrom` ∈ `formulas.mjs` 레지스트리, `uptimePercentFrom`·`effectsFromInputs` 값 ∈ 그 직업의 `inputs[].key`, `mastery` ∈ masteries.json, 조건부 `id` 는 룬 내 유일.

### 테스트로 강제 (`npm test` 에 편입, CI 는 GitHub Actions 10줄)

- `tests/data.test.mjs`: 위 검증기를 실행. 실패 메시지는 "어느 파일 어느 항목 어느 키"까지 한국어로.
- `tests/effects-liveness.test.mjs` — **화이트리스트보다 강한 검사**: 화이트리스트의 각 경로에 대해, 기준 프로필로 `evaluate()` 한 점수와 그 경로에만 +10 을 준 점수를 비교해 **달라짐을 단언**한다. 이것이 잡는 것: (a) 화이트리스트에는 있는데 `buildFrom()` 이 배선을 안 한 죽은 경로(예: calculator 에는 있는 `extraHit.fixedExtraDamagePercent` 가 평가기에 배선 안 된 상태로 화이트리스트에 들어가는 사고), (b) 리팩터링으로 배선이 끊기는 회귀. 화이트리스트가 "문서상 유효"가 아니라 "실제로 살아 있음"을 뜻하게 된다.
- `tests/gen-freshness.test.mjs`: `build-data.mjs` 를 임시 디렉터리로 실행해 커밋된 `src/gen/` 과 diff. `src/gen/` 을 직접 고친 PR, 재생성을 잊은 PR 모두 여기서 걸린다.
- 골든 스코어 테스트(§4): 데이터 수정 PR 에서 점수가 바뀌는 건 정상이므로, 이 테스트는 "바뀌었으면 스냅샷 갱신 커밋이 같이 있어야 한다" 규칙으로 운용한다 — 순위 변화가 PR diff 에 가시화되는 부수효과가 있다.
- **help-wanted 자동 생성**: `tools/build-data.mjs` 가 confidence medium/low 항목(현재 14개)을 모아 `HELP-WANTED.md` 를 함께 생성한다. "이 직업 전문가를 찾습니다" 목록이 데이터에서 늘 최신으로 나온다 — 모집 문서를 손으로 관리하지 않는다.

---

## 6. 단계별 이행 계획

### 단계 0 — 지금, 공개 전 (예상 2~3일)

| 작업 | 비용 | 얻는 것 |
|---|---|---|
| `data/` 추출: jobs 21개·masteries·rune-conditionals·artifacts·effect-fields, 주석→evidence 이주 | 1일 (기계적, 이주 스크립트 가능) | JS 비독해자가 편집 가능한 표면. 댄서 25초 문제의 3중 중복 해소(`default-profile.mjs:49` 의 75 하드코딩 삭제 — 직업 변경 시 `nightBlessingCycleSeconds()` 파생으로 일원화, `rune-app.mjs:57` 힌트에서 직업별 수치 제거) |
| `tools/build-data.mjs` + gen 커밋 | 반나절 | 기존 file:// 패턴 유지, build-dist 무변경 |
| `validate-data.mjs` + data/liveness/freshness/골든 테스트 | 1일 | 오타 즉사, evidence 강제, "그럴듯한 PR 이 조용히 틀리는" 경로 차단 |
| CONTRIBUTING.md (기여 유형 3종의 레시피, §3·§4 경계) + HELP-WANTED 생성 | 2~3시간 | 전문가 모집의 착지점 |
| GitHub Actions (npm test) | 1시간 | 의존성 0이라 셋업이 곧 끝 |

이 단계에서 **하지 않는 것**: `inputs[]` 일반화(현행 `classPassiveUptimePercent` 단일 슬롯을 데이터 선언으로 옮기되 UI 배선은 그대로), rune-app 분할, id 이행. 기여자 0명 상태에서 UI 일반화는 검증 상대가 없다.

### 단계 1 — 기여자(또는 구체적 요청)가 1명이라도 생기면

| 작업 | 트리거 | 비용 |
|---|---|---|
| `inputs[]` + `effectsFromInputs`/`uptimePercentFrom` 일반화 (§3-2b) | 입력칸이 필요한 첫 직업 제보 | 반나절~1일. rune-app 의 특례 3곳(587, 602, 1448)을 일반 루프로 |
| `EXPECTED_FROM` 레지스트리 리팩터링 (§3-2c) | 첫 파생 계산식 제보 | 2~3시간 |
| optimizer.mjs 추출 + 프레젠터 분리 (§4) | 첫 UI 기여자 | 반나절~1일 |
| ~~조건부 `id` 도입 + localStorage override 키 이행~~ **완료** | 라벨 문구를 고치는 첫 PR | SCHEMA_VERSION 을 올리지 않고 `migrateConditionalOverrideKeys()`(rune-conditionals.mjs)로 라벨→id 1회 변환. 이행 로직을 순수 함수로 뺀 이유는 `load()` 가 DOM·localStorage 를 타서 테스트할 수 없기 때문 |
| PR 템플릿·이슈 템플릿(직업 제보 양식: 수치·출처·날짜를 evidence 형태로 받는 폼) | 이슈가 오기 시작하면 | 1~2시간 |
| CODEOWNERS (직업 파일 → 검증된 전문가) | 직업당 반복 기여자 등장 | 즉시 |

### 아마 영원히 필요 없는 것 (명시적 비채택)

- **번들러·프레임워크·TypeScript 툴체인** — 제약이자 신념. 검증은 런타임 테스트로 충분.
- **ajv 등 JSON Schema 라이브러리** — 스키마 4종에 범용 엔진은 과하다.
- **수식 DSL / 데이터 내 표현식 문자열** — eval 이거나 미니 인터프리터다. 수식은 코드+테스트가 맞다.
- **완전 데이터 주도 UI(폼 DSL, 조건부 표시, 커스텀 위젯 선언)** — 선언 가능한 것은 "그룹에 붙는 숫자 입력칸 + 라벨 + 힌트 + 기본값 + min/max" **한 가지 모양뿐**이라고 못 박는다. 지금까지 필요했던 동적 UI 가 정확히 이 모양 하나였다(집중 가동률). 그 이상은 UI 코드 기여다.
- **런타임 JSON fetch + 서비스워커** — file:// 포기 없이는 불가, 포기할 이유 없음.
- **rune-app 전면 재작성 / 컴포넌트화** — 1,489줄은 크지만 동작하고, DOM 테스트가 없는 상태의 재작성은 회귀 제조기다. §4 의 추출만 한다.

---

## 7. 버리는 선택지와 이유

| 대안 | 버린 이유 |
|---|---|
| **YAML 데이터** (주석 가능, 게이머 친화적) | 파서 의존성 필요. 주석의 역할은 evidence·note 필드가 대신한다 — 오히려 "주석은 스크립트가 못 읽는다"는 원래 문제로의 회귀다. |
| **JS 파일을 그대로 편집 표면으로** (지금처럼, 문서만 보강) | `Object.freeze`·문자열 결합·import 를 아는 사람만 편집 가능. 검증기도 JS 를 실행해야 해서 "부분적으로 깨진 데이터" 리포트가 어렵다. JSON 은 파싱 실패 지점을 줄 단위로 짚는다. |
| **거대한 단일 data.json** | 직업 전문가 둘이 동시에 PR 을 내면 충돌. 파일 = 소유권 = 리뷰 단위 라는 등식이 깨진다. |
| **TypeScript / JSDoc `@ts-check` 로 effects 키 타입화** | 툴체인 도입이거나(전자), 강제력이 편집기 안에만 있음(후자). liveness 테스트는 CI 에서 강제되고 "배선됐지만 죽은 경로"까지 잡는다. 다만 JSDoc 타입 주석은 공짜라서 보조로 넣는 것은 반대 안 함. |
| **effects 경로 대신 추상 스탯 이름**("critRate" 등)을 데이터에 쓰고 매핑 레이어 추가 | 지금 경로들은 `calculator.mjs` 의 A~L 구조를 그대로 드러내서, 어느 괄호에 가산되는지가 경로에서 읽힌다(예: `critical.runeCriticalRatePercent` vs `characterCriticalRatePercent` 는 같은 괄호·다른 출처). 추상화하면 이 정밀함을 매핑 문서로 다시 설명해야 한다. 이름이 못생긴 것은 라벨 사전이 해결한다. |
| **evidence 를 별도 파일(측정 로그 DB)로 분리** | 값과 근거가 떨어지면 근거가 안 늙는다(값은 고쳤는데 근거는 옛것). 항목 옆에 붙어 있어야 diff 리뷰에서 "값 바꿈 + 근거 추가"가 한눈에 보인다. |
| **웹 기반 데이터 편집기 제작** (JSON 조차 어려운 기여자용) | 만들 가치가 있을 수 있으나 지금은 사용자 0·기여자 0. 이슈 템플릿(폼)으로 제보받아 관리자가 옮기는 경로가 같은 문제를 공짜로 푼다. 단계 2 이후 재검토. |
| **모든 조건부 룬 데이터의 직업 파일 병합** ("직업이 기여 단위니까") | 룬은 직업 소속이 아니다(전 직업 공용). 룬 데이터와 직업 데이터는 축이 다르므로 파일도 다르게 간다. |

---

## 이 설계에서 가장 불확실한 것 3가지

1. **"JSON 이면 게이머가 기여할 수 있다"는 가설 자체.** 따옴표·쉼표·중괄호는 JS 보다 낫지만 여전히 장벽이다. 실제 병목은 파일 형식이 아니라 "게임 지식 → 모델 항목으로의 번역"(어느 effects 경로인지, 가동률을 어떻게 잡는지)일 수 있고, 그렇다면 진짜 기여 표면은 data/ 가 아니라 **이슈 템플릿 + 관리자의 번역 노동**이다. 이 설계는 그 경우에도 손해는 아니지만(관리자 자신의 편집·검증이 쉬워짐), "전문가가 직접 PR" 그림은 안 나올 수 있다.
2. **effects 화이트리스트가 안전망이 아니라 병목이 될 가능성.** 지금 배선된 ~13개 경로는 댄서(+검술사·기사 일부) 관점에서 필요했던 것들이다. 21개 직업 전문가가 실제로 들고 올 요청의 다수가 "새 경로가 필요한" 유형(스킬 종류 한정 피해, 도트, 궁극기 비중 등 — `combat-mastery.mjs:10-12` 와 `uncountedEffects` 가 이미 그 목록이다)이라면, 기여마다 관리자의 calculator·evaluator 작업이 낀다. 그 비율이 얼마일지 지금은 알 수 없다.
3. **밤의 축복 ON/OFF 2상태 모델이 직업 선언과 계속 맞을지.** 현재 확장점(inputs, effectsFromInputs, uptimePercentFrom)은 전부 "ON 구간에 상수/입력값을 얹는다"는 현행 평가기 구조(`evaluate()` 의 on/off 가중평균, `build-evaluator.mjs:354-389`) 위에 서 있다. "우리 직업은 버프 창이 세 개가 서로 어긋나게 돈다" 같은 요청이 오면 선언형으로 못 받고 평가기 구조가 바뀌어야 한다. 그때 이 스키마의 어디까지가 살아남을지는 지금 설계로 보장 못 한다 — 그래서 스키마 버전 필드를 직업 파일에 두는 것 정도만 해 두고, 다상태 일반화는 일부러 설계하지 않았다.
