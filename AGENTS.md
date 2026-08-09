# Agent Notes

코딩 에이전트로 이 저장소를 고칠 때 먼저 읽을 것. 사람이 읽을 안내는
[CONTRIBUTING.md](CONTRIBUTING.md), 설계 배경은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**무엇을 어디에 둘지 막히면 [docs/PLACEMENT.md](docs/PLACEMENT.md).** 새 룬·새 수치·새 수식이
각각 어느 파일로 가는지, 무엇을 파생시키고 무엇을 손으로 적는지가 거기 있다.

## 제약

- **의존성 0개.** 번들러·npm 패키지를 추가하지 마라. `npm install` 없이 clone 하면 바로
  개발이 되어야 한다.
- **런타임 fetch 를 도입하지 마라.** 데이터는 생성된 ESM(`src/gen/`)으로 커밋한다. 그래서
  빌드 단계 없이 정적 파일만 얹어도 돌아간다. (`file://` 로 직접 여는 것은 안 된다 —
  페이지가 ES 모듈을 쓰고 브라우저가 `file://` 에서 모듈을 막는다. `npm run dev` 를 쓴다.)
- **한 PR 에 한 가지.** `data/` 수정과 `src/` 수정은 따로 낸다. 섞이면 "수치가 바뀐 건지
  계산이 바뀐 건지" 를 리뷰에서 가릴 수 없다.

## 검증 (매번 전부)

```bash
node tools/build-data.mjs     # data/ 를 고쳤다면 필수. 생성물 src/gen/ 까지 커밋한다
node tools/validate-data.mjs
npm test
npm run build
```

## 조용히 깨지는 것들

에러 없이 **틀린 결과**가 나오는 자리다. 실수해도 아무 신호가 없다.

- **골든 점수(`tests/golden-score.test.mjs`)가 바뀌면 계산이 바뀐 것이다.** 데이터를
  의도적으로 고친 게 아닌데 움직였다면 뭔가 잘못한 것이다. 값만 맞춰서 통과시키지 마라.
- **`effects` / `field` 경로는 `data/effect-fields.json` 에 있는 것만.** 없는 경로는
  에러 없이 계산에서 빠진다.
- **`expectedFrom` 은 `build-evaluator.mjs` 의 `EXPECTED_FROM_NAMES` 에 있는 것만.**
  모르는 이름은 조용히 0 이 된다.
- **`SCHEMA_VERSION`(`src/rune-app.mjs`)을 올리지 마라.** 사용자의 측정값과 장비 설정이
  전부 날아간다. 저장 구조가 바뀌면 `load()` 에서 1회 이행한다.
- **`src/gen/` 은 생성물이다.** `data/` 를 고치고 빌드해라 (`tests/gen-freshness.test.mjs`).
- **`export *` 는 재수출일 뿐 그 파일 안에 이름을 만들지 않는다.** 재수출한 모듈의 값을
  그 파일 함수에서 쓰려면 `import {}` 로 따로 받아야 한다. 안 그러면 그 함수를 실제로
  타는 경로에서만 `ReferenceError` 로 터진다 — 실제로 그렇게 새어 나간 적이 있다.
- **`evidence` 를 지어내지 마라.** 틀린 수치는 언젠가 발견되지만 가짜 근거는 검증된 것처럼
  보여서 더 나쁘다. 모르면 `confidence` 를 낮추고 비워 둬라.
- **한계를 문서에 직접 쓰지 마라.** 자리는 둘뿐이다 — 항목 하나가 빠지는 것은 그 데이터
  옆의 `uncounted`, 도구 전체에 걸리는 것은 `data/limits.json`. `LIMITS.md` 와
  `limits.html` 은 거기서 나오고 `README.md` 는 링크만 갖는다. 좋은 뜻으로 README 나
  코드 주석에 한 번 더 적으면 두 벌이 되고, 낡는 쪽은 늘 이용자가 보는 쪽이었다.

## 수치 제보 페이지 (`/report`)

이 저장소에서 **유일하게 서버가 필요한 부분**이다. 추천기 본체는 정적 파일만으로 돈다.

- **`functions/` 를 `dist/` 에 복사하지 마라.** Cloudflare 가 프로젝트 루트에서 따로 읽어
  워커로 묶는다. 정적 루트에 넣으면 서버 코드가 그대로 공개된다.
- **제보자가 쓴 글자를 `innerHTML` 로 넣지 마라.** `createElement` + `textContent` 만 쓴다
  (`src/report-app.mjs`). 아무나 쓸 수 있는 칸이고, 주소를 링크로 만들면 이 목록이 곧
  스팸 통로가 된다. 주소는 글자로만 보여야 한다.
- **검증 규칙은 `src/report-shared.mjs` 한 곳에만 둔다.** 서버와 화면이 같은 파일을 쓴다.
  두 곳에 쓰면 갈라지고, 갈라지면 화면은 통과시켰는데 서버가 거절한다.
- **길이 검사는 정규화 뒤에 한다.** 앞에 두면 폭 없는 문자로 글자수를 채워 상한을 우회한다.
- **`schema.sql` 의 상태 목록과 `STATUSES` 는 같아야 한다.** 한쪽만 고치면 새 상태를 쓰는
  순간 DB 의 `CHECK` 가 거절하고 관리자 도구만 실패한다 (`tests/report-api.test.mjs` 가 잡는다).
- **`SELECT *` 를 쓰지 마라.** `ip_hash` 가 그대로 응답에 실린다.
- **제보를 지우지 말고 숨겨라**(`hidden = 1`). 지우면 왜 사라졌는지 기록이 없다.
- **`load()` 실패를 "0건" 으로 보여주지 마라.** 사람들은 아무도 제보를 안 한 줄 알고 나간다.
- 제보 페이지의 저장 키(`mabinogi-rune-reports-mine-v1`)는 추천기 저장분과 별개다.
  섞으면 사용자의 측정값이 날아간다.

## 테스트를 쓸 때

**"통과한다" 만 확인하는 테스트를 쓰지 마라.** 이 저장소의 테스트는 고치려던 증상 자체를
못박는다 — 검증기 테스트는 일부러 망가뜨린 데이터로 검증기가 정말 잡는지 보고, 이행
테스트는 이행 전에는 조회가 빗나간다는 것까지 단언한다.

## 데이터와 코드의 경계

`data/` 에 수식을 넣지 마라. 데이터 안의 표현식은 결국 `eval` 이거나 미니 인터프리터다.
새 수식이 필요하면 `build-evaluator.mjs` 에 이름 붙은 함수로 넣고 `EXPECTED_FROM_PARAMS` 에
**이름과 필수 파라미터를 함께** 등록한다(`EXPECTED_FROM_NAMES` 는 그 키에서 파생된다).
파라미터를 빠뜨리면 데이터에서 누락돼도 검증을 통과하고 기대값이 NaN 을 거쳐 조용히 0 이 된다.

**수식의 파라미터는 게임이 정한 것이라 데이터에 둔다.** "쿨 4초·지속 10초" 는 데이터고
그걸로 가동률을 구하는 식이 코드다. 자세한 경계는 [docs/PLACEMENT.md](docs/PLACEMENT.md).
