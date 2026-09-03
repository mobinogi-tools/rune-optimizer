// 화면 배선.
//
// rune-app.mjs 는 DOM 모듈이라 단위 테스트가 안 붙는다. 그런데 이 파일이 하는 일의
// 절반은 "HTML 의 어느 자리에 무엇을 그린다" 이고, **그 자리 이름이 틀리면 조용히 아무
// 일도 안 일어난다.** querySelector 는 없는 id 에 null 을 돌려주고, 거기에 innerHTML 을
// 쓰면 그때야 터지는데 — 하필 그 코드가 try 로 감싸여 있으면 그것도 안 보인다.
//
// 실제로 화면 구조를 4단으로 바꾸면서 id 를 열 개 넘게 갈았다. 그때 하나만 빠뜨려도
// 그 칸이 통째로 비어 나가고, 테스트는 전부 통과한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('runes.html', 'utf8');
const app = readFileSync('src/rune-app.mjs', 'utf8');
const css = readFileSync('runes.css', 'utf8');

const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
const queried = new Set([...app.matchAll(/querySelector\(\s*'#([A-Za-z0-9_-]+)'/g)].map((m) => m[1]));

/* JS 가 스스로 그려 넣는 것들. HTML 에는 없는 것이 맞다.
 * 새로 추가할 때는 여기 적어야 한다 — 오타를 이 목록에 적어 통과시키는 것이
 * 가능하긴 하지만, 적는 순간 사람이 한 번은 보게 된다. */
const CREATED_BY_JS = new Set([
  'apply-best', // 최적 세트 안의 '전체 착용' 버튼
  'fix-equip', // 규칙 위반 안내 안의 '바꾸기' 버튼
]);

test('JS 가 찾는 요소가 HTML 에 전부 있다 — 없으면 그 칸이 조용히 비어 나간다', () => {
  const missing = [...queried].filter((id) => !htmlIds.has(id) && !CREATED_BY_JS.has(id));
  assert.deepEqual(missing, [],
    `HTML 에 없는 id 를 찾고 있다: ${missing.join(', ')} — 이름을 바꿨다면 양쪽을 같이 고쳐야 한다`);
});

test('JS 가 만들어 넣는다고 적어둔 id 는 실제로 JS 안에 있다', () => {
  // 목록만 남고 코드가 사라지면 다음 사람이 "이건 왜 예외지" 를 못 푼다.
  for (const id of CREATED_BY_JS) {
    assert.ok(app.includes(`id="${id}"`), `${id} 를 만드는 코드가 rune-app.mjs 에 없다`);
  }
});

test('id 가 HTML 안에서 겹치지 않는다 — 겹치면 둘째부터는 영영 안 그려진다', () => {
  const all = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const dup = all.filter((v, i) => all.indexOf(v) !== i);
  assert.deepEqual([...new Set(dup)], [], `중복된 id: ${[...new Set(dup)].join(', ')}`);
});

/* 화면 골격 자체를 못박는다. 네 층으로 나눈 것이 이 화면의 뼈대이고,
 * 한 층이 사라지면 나머지가 다 딸려 어긋난다. */
test('네 층이 모두 있다 — 측정 · 캐릭터 · 세트 비교 · 추천', () => {
  for (const [id, what] of [
    ['measure-section', '① 측정'],
    ['char-panel', '② 캐릭터'],
    ['compare-layout', '③ 세트 비교'],
    ['panel-current', '③ 왼쪽 — 현재 세팅'],
    ['panel-trial', '③ 오른쪽 — 실험군'],
    ['panel-rec', '④ 추천'],
    ['cand-modal', '후보 룬 팝업'],
  ]) {
    assert.ok(htmlIds.has(id), `${what}(#${id}) 이 없다`);
  }
});

test('궁수는 사이클 미반영 경고를 보이고 다른 직업에서는 숨긴다', () => {
  assert.ok(htmlIds.has('job-model-warning'), '직업별 모델 경고 자리가 없다');
  assert.match(app, /modelWarning\.hidden = state\.job !== '궁수'/,
    '궁수 외 직업에서도 경고가 보이거나 궁수에게도 숨겨진다');
  assert.match(app, /다발사격 충전과 애로우 리볼버 재사용 대기 시간/,
    '무엇이 미반영인지 경고가 밝히지 않는다');
});

test('궁수는 룬과 질주하는 바람 이속을 추진력으로 바꾸고 나머지 룬 외 이속은 받지 않는다', () => {
  assert.doesNotMatch(app, /전투 중 룬 외 이동 속도 증가 합계 %/,
    '제거한 룬 외 이동 속도 입력이 남아 있다');
  assert.doesNotMatch(app, /extra\.push\(\['nonRuneMoveSpeedPercent'/,
    '궁수 직업 특성에 숨은 룬 외 이동 속도 입력이 남아 있다');
  assert.match(app, /룬과 질주하는 바람의 이동 속도 증감은 추진력 피해로 바꾸지만/,
    '룬·직업 이동 속도는 반영된다는 설명이 없다');
  assert.match(app, /장신구·파티 버프 등 나머지 이동 속도는 반영하지 않습니다/,
    '무엇이 계산 밖인지 궁수 경고가 밝히지 않는다');
});

test('룬 목록은 후보 팝업 안에 있다 — 본문에 있으면 90줄이 다른 것을 다 밀어낸다', () => {
  const modal = html.slice(html.indexOf('<dialog id="cand-modal"'));
  const end = modal.indexOf('</dialog>');
  assert.ok(modal.slice(0, end).includes('id="rune-groups"'),
    '룬 목록(#rune-groups)이 후보 팝업 밖에 있다');
});

/* 상세창은 자기가 어느 세트에서 열렸는지 알아야 한다.
 * 모르면 실험군에서 룬을 눌러 바꿔도 현재 세팅이 바뀐다 — 실제로 그렇게 났고,
 * 화면만 보고는 알 수 없었다(왼쪽이 조용히 달라져 있다). */
test('세트 목록의 룬 버튼은 어느 세트 것인지 새겨서 그린다', () => {
  assert.match(app, /function renderSetList\(host, names, \{ origin = 'equipped'[^)]*\} = \{\}\)/,
    'renderSetList 가 출신(origin)을 안 받는다');
  assert.match(app, /data-detail="\$\{n\}" data-set="\$\{origin\}"/,
    '세트 목록의 룬 버튼에 data-set 이 없다');
  assert.match(app, /renderSetList\([^)]*, \{ origin: 'trial' \}\)/,
    '실험군 목록이 origin 을 안 넘긴다');
  assert.match(app, /detailOrigin = dbtn\.dataset\.set === 'trial' \? 'trial' : 'equipped'/,
    '상세창을 열 때 출신을 안 잡는다');
});

test('상세창의 착용 조작은 출신 세트를 만진다 — 현재를 직접 건드리지 않는다', () => {
  const block = app.slice(app.indexOf("const b = e.target.closest('[data-equip-act]')"));
  const body = block.slice(0, block.indexOf('\n});'));
  assert.ok(!/state\.equipped\s*=/.test(body),
    '상세창 조작이 state.equipped 에 직접 쓰고 있다 — writeOriginSet 을 거쳐야 한다');
  assert.ok(body.includes('writeOriginSet('), '출신 세트에 쓰는 경로가 없다');
});

test('추천 시작 세트도 후보 목록으로 거른다 — 제외한 착용 룬이 추천에 남지 않는다', () => {
  const start = app.indexOf('function optimize()');
  const body = app.slice(start, app.indexOf('\n}', start) + 2);
  assert.ok(body.includes('const candidates = effectiveCandidates()'),
    '실제 후보 목록을 한 번 확정하지 않는다');
  assert.match(body, /equipped:[\s\S]*\.filter\(\(n\) => candidateSet\.has\(n\)\)/,
    '현재 착용 세트를 후보 목록으로 거르지 않는다 — 후보에서 뺀 룬이 탐색 씨앗에 남는다');
});

test('목표 추가타율은 최종 추가타율로 추천 우선순위만 바꾼다', () => {
  assert.match(app, /\['targetExtraRatePercent', '목표 추가타율 %'\]/,
    '목표 추가타율 입력칸이 없다');
  assert.match(app, /targetExtraRate > 0 \? \(set\) =>[\s\S]*assessment\(set\)\.rates\.extraRate \* 100/,
    '스탯과 룬을 합친 최종 추가타율을 추천 우선순위에 쓰지 않는다');
  assert.match(app, /extraRate >= targetExtraRate \? \[1, 0\] : \[0, extraRate\]/,
    '목표 달성 뒤에도 추가타율을 대미지보다 계속 우선한다');
  assert.match(app, /: undefined,\n\s*slotOf/,
    '목표 0에서도 추가타율 우선순위가 켜진다');
});

test('바꿀 룬은 고른 룬과 다르게 표시한다', () => {
  // 초안에 남아 있어 초록으로 칠해지면 "이미 골랐다" 로 읽혀 뭘 눌러야 할지 알 수 없다.
  assert.match(app, /const replacing = equipState\.replace === r\.name;/, '바꿀 룬을 따로 가리지 않는다');
  assert.match(app, /const on = !replacing && draft\.includes\(r\.name\)/, '바꿀 룬이 고른 것으로 칠해진다');
});

/* <dialog> 가 닫혀 있을 때 안 보이는 것은 브라우저 기본 규칙
 *   dialog:not([open]) { display: none }
 * 하나에 기대고 있다. 이 규칙은 특이도가 낮아서 `#어떤모달 { display: flex }` 한 줄이면
 * 덮인다. 그러면 **닫힌 팝업이 본문 맨 아래에 통째로 그려진다** — 실제로 그렇게 났고,
 * 스크롤을 끝까지 내려보기 전에는 아무도 모른다. */
test('팝업의 display 는 [open] 에만 건다 — 안 그러면 닫힌 팝업이 본문에 그려진다', () => {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ''); // 주석 제거: 설명문에 든 예시가 걸리지 않게
  const dialogIds = [...readFileSync('runes.html', 'utf8').matchAll(/<dialog id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(dialogIds.length, '팝업이 하나도 없다 — 검사가 헛돌고 있다');
  const bad = [];
  for (const [, selector, body] of bare.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const sel = selector.trim();
    if (!/display\s*:/.test(body)) continue;
    for (const id of dialogIds) {
      // 팝업 자신을 가리키는 규칙만 본다(자손 선택자는 열렸을 때만 그려지므로 무해하다).
      const targetsSelf = new RegExp(`#${id}(?![\\w-])\\s*(\\[open\\])?\\s*$`).test(sel);
      if (targetsSelf && !sel.includes('[open]')) bad.push(`${sel} { ${body.trim()} }`);
    }
  }
  assert.deepEqual(bad, [], `팝업 자신에 display 를 무조건 걸고 있다:\n${bad.join('\n')}`);
});

/* ── 전투 상황 칸 ────────────────────────────────────────
 * 이 세 칸은 JS 가 통째로 그리고 JS 가 읽는다(data-* 속성으로만 만난다). id 검사가
 * 못 잡는 자리라 따로 못박는다 — 속성 이름을 한쪽만 바꾸면 눌러도 아무 일이 안 일어나고,
 * 화면은 멀쩡해 보인다. 4단 개편 때 같은 모양으로 세 번 겪었다. */
test('전투 상황 세 칸이 HTML 에 있다', () => {
  for (const [id, what] of [
    ['situation-group', '전투 상황 묶음'],
    ['dot-checks', '지속 피해 체크박스'],
    ['kill-count', '처치한 잡몹 수'],
    ['fight-seconds', '기준 전투 시간'],
  ]) assert.ok(htmlIds.has(id), `${what}(#${id}) 이 없다`);
});

test('전투 상황이 그리는 data-* 를 읽는 쪽이 있다', () => {
  // 눈금 버튼은 속성 이름을 인자로 받아 그린다(`'data-kill'`). 그래서 `data-kill=` 이
  // 아니라 이름만 찾는다 — 그리는 쪽과 읽는 쪽이 둘 다 있는지가 요점이다.
  for (const attr of ['dot', 'kill', 'fight']) {
    assert.ok(app.includes(`data-${attr}`), `data-${attr} 를 그리는 쪽이 없다`);
    assert.ok(app.includes(`dataset.${attr}`), `data-${attr} 를 읽는 쪽이 없다 — 눌러도 아무 일이 안 일어난다`);
  }
});

test('착용이 바뀌면 전투 상황도 다시 그린다 — 룬이 켠 도트의 잠금 표시가 낡는다', () => {
  assert.match(app, /function renderAll\(\)[^\n]*renderSituation\(\)/,
    'renderAll 이 renderSituation 을 안 부른다');
});

test('발동율 칸은 조정 칸과 다른 자리에 저장한다', () => {
  // 한 자리에 섞으면 값(cond)과 비율(rate)이 서로를 덮어쓴다 — 12 를 넣었는데 12% 로 읽힌다.
  assert.match(app, /const bucket = ovKind === 'rate' \? 'rate' : 'cond'/,
    '발동율과 기대값이 같은 자리에 저장되고 있다');
});

test('전투 상황 칸의 CSS 클래스가 스타일시트에 있다', () => {
  for (const cls of ['.situation', '.situation-row', '.dot-check', '.step-choice', '.step']) {
    assert.ok(css.includes(cls), `${cls} 스타일이 없다 — 칸이 그려지긴 하는데 모양이 없다`);
  }
});

test('숫자 입력 중에는 무거운 추천 계산을 매 자리마다 다시 하지 않는다', () => {
  assert.match(app, /const INPUT_SETTLE_DELAY_MS = 1000;/,
    '숫자 입력 뒤 저장과 추천 계산을 1초 동안 미루지 않는다');
  assert.match(app, /function scheduleInputSave\(\)[\s\S]*clearTimeout\(pendingInputSave\)[\s\S]*setTimeout/,
    '연속 입력의 localStorage 저장을 한 번으로 합치는 디바운스가 없다');
  assert.match(app, /addEventListener\('pagehide',[\s\S]*pendingInputSave[\s\S]*save\(\)/,
    '화면을 벗어날 때 아직 대기 중인 입력값을 저장하지 않는다');
  assert.match(app, /function scheduleResultRender\(\)[\s\S]*clearTimeout\(pendingResultRender\)[\s\S]*setTimeout/,
    '연속 입력을 한 번으로 합치는 디바운스가 없다');

  const profile = app.slice(app.indexOf('if (key) {'), app.indexOf("if (e.target.name === 'helio')"));
  assert.ok(profile.includes('scheduleInputSave()'),
    '일반 스탯 입력이 여전히 매 자리마다 localStorage 에 동기 저장된다');
  assert.ok(!profile.includes('save()'),
    '일반 스탯 입력 한 자리마다 localStorage 에 동기 저장한다');
  assert.ok(profile.includes('scheduleResultRender()'),
    '일반 스탯 입력이 여전히 즉시 추천 계산을 부른다');
  assert.ok(!profile.includes('renderResults()'),
    '일반 스탯 입력 한 자리마다 전체 추천을 다시 계산한다');

  const measure = app.slice(app.indexOf('function onMeasureInput'), app.indexOf("querySelector('#measure-section').addEventListener"));
  assert.ok(measure.includes("e?.type === 'change'"),
    '측정값 입력을 마친 change 에서 결과를 즉시 확정하지 않는다');
  assert.ok(measure.includes('scheduleResultRender()'),
    '측정 숫자 입력도 여전히 매 자리마다 전체 추천을 다시 계산한다');
});

/* ── 측정과 안 재는 것 사이를 오가기 ──────────────────────
 * 예전에는 한 번 확정하면 안 재는 화면으로 돌아갈 길이 없었다 — 되돌아 나오는 버튼이
 * 미확정일 때만 떴기 때문이다. 그리고 그 버튼 이름이 「측정 취소」라, 안 재고 쓰는 것이
 * 선택이 아니라 하던 일을 무르는 것처럼 읽혔다. 지금 이름은 「기본값 쓰기」다 —
 * 요약 줄의 「기본값 사용 중」과 같은 말이라야 두 자리가 같은 상태를 가리키는 것이 보인다. */
test('안 재는 쪽으로 나가는 버튼이 확정 여부와 무관하게 뜬다', () => {
  const line = app.split('\n').find((l) => l.includes("querySelector('#measure-none').hidden"));
  assert.ok(line, '#measure-none 의 표시 조건이 없다');
  assert.ok(!/committed/.test(line),
    '나가는 버튼이 committed 에 걸려 있다 — 한 번 재면 돌아갈 길이 사라진다');
});

test('안 재기로 넘어가도 잰 값을 버리지 않는다', () => {
  const block = app.slice(app.indexOf("querySelector('#measure-none').addEventListener"));
  const body = block.slice(0, block.indexOf('\n});'));
  assert.ok(!/committed\s*=/.test(body),
    '나가면서 committed 를 지우고 있다 — 되돌아오면 처음부터 다시 재야 한다');
  assert.ok(body.includes('prevMode'), '어느 방식으로 재고 있었는지를 안 기억한다');
});

test('안 재는 화면은 잰 값이 남아 있다는 것을 알린다', () => {
  assert.ok(htmlIds.has('nm-kept'), '#nm-kept 가 없다');
  assert.ok(app.includes("querySelector('#nm-kept')"), '#nm-kept 를 채우는 코드가 없다');
});

test('특정 스킬 딜 비중 입력은 내가 가진 룬 바로 위에 모여 있다', () => {
  const shareStart = html.indexOf('id="skill-share-group"');
  const ownedStart = html.indexOf('<div class="head-with-action char-runes">');
  assert.ok(shareStart >= 0, '특정 스킬 딜 비중 묶음이 없다');
  assert.ok(shareStart < ownedStart, '특정 스킬 딜 비중이 내가 가진 룬보다 아래에 있다');
  const shareGroup = html.slice(shareStart, ownedStart);
  for (const key of ['resourceSkillSharePercent', 'slot3SkillSharePercent',
    'channelingSkillSharePercent', 'castingChargeSkillSharePercent',
    'ultimateSkillSharePercent', 'breakSkillSharePercent', 'breakSkillCooldownSeconds']) {
    assert.ok(shareGroup.includes(`data-profile="${key}"`), `${key} 입력이 묶음 안에 없다`);
  }
  assert.ok(!app.includes("extra.push(['resourceSkillSharePercent'"),
    '전투 패턴에도 아직 그리고 있다 — 같은 값의 칸이 둘이 된다');
});

test('특정 스킬과 브레이크 입력은 넓은 화면에서 전투 패턴처럼 세 열을 맞춘다', () => {
  assert.match(css, /\.skill-share-inputs\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
    '특정 스킬 입력이 같은 폭의 세 열이 아니다');
  assert.match(css, /\.break-inputs\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
    '브레이크 입력이 같은 폭의 세 열이 아니다');
  assert.match(css, /\.skill-share-inputs label\s*\{[\s\S]*?grid-template-rows:\s*auto auto/,
    '특정 스킬 라벨과 입력이 전투 패턴처럼 위아래로 놓이지 않는다');
  assert.match(css, /\.char-runes\s*\{\s*margin-top:\s*0/,
    '내가 가진 룬 앞에 중복 위 여백이 남아 있다');
});

test('브레이크 시간축과 외부 방어구 파괴 입력이 전투 상황에 있다', () => {
  for (const key of ['breakCycleSeconds', 'vulnerableDurationSeconds', 'breakTagDamagePercent']) {
    assert.ok(html.includes(`data-profile="${key}"`), `${key} 입력이 없다`);
  }
  assert.ok(htmlIds.has('external-armor-break'), '외부 방어구 파괴 스위치가 없다');
  assert.ok(htmlIds.has('break-count'), '브레이크 횟수 표시가 없다');
  assert.ok(!htmlIds.has('assume-vulnerable'), '옛 무방비 on/off 스위치가 남아 있다');
});

test('무방비 공격 태그 입력은 뜻과 기본 가정을 설명한다', () => {
  assert.match(html, /무방비 중 공격 태그 보너스 평균/);
  assert.match(html, /블로우는 강타·연타 각 10%, 화상·감전 각 5%/);
  assert.match(html, /기본 20%는 강타·연타가 대부분 발동한다고 가정/);
  assert.doesNotMatch(html, />태그 피해 증가 효과 합계 </);
});

test('무방비 공격 태그의 설명 버튼은 라벨 바로 옆에 붙는다', () => {
  assert.match(html, /<span class="break-input-label">무방비 중 공격 태그 보너스 평균[\s\S]*class="hint-toggle"/,
    '긴 라벨과 설명 버튼이 한 묶음이 아니다');
  assert.match(css, /\.break-input-label\s*\{[^}]*display:\s*inline-flex[^}]*white-space:\s*nowrap/,
    '긴 라벨과 설명 버튼이 서로 다른 줄로 갈라질 수 있다');
});

test('스킬 한정 비중은 서로 겹칠 수 있고 기본 공격 비중은 없다', () => {
  assert.ok(html.includes('합계가 100%를 넘어도 됩니다'), '비중이 겹칠 수 있다는 설명이 없다');
  assert.ok(!html.includes('data-profile="basicAttackSkillSharePercent"'));
  assert.ok(html.includes('data-profile="breakSkillSharePercent"'));
});

test('궁극기 스탯과 마력 아티팩트는 새 딜 비중 입력에 연결된다', () => {
  assert.match(app, /ultimateEnhance:[^\n]*궁극기\/8750[^\n]*궁극기 딜 비중/,
    '궁극기 스탯 힌트가 아직 미계산이라고 하거나 비중 연결을 설명하지 않는다');
  assert.ok(app.includes('artifactSpecificSkillDamagePercent'), '마력의 가중 피해를 평가기로 넘기지 않는다');
  assert.ok(app.includes('artifactRequirementMet(a, counts)'), '마력의 색 조건을 화면이 구분하지 않는다');
});

test('룬 고정은 현재에서 조작하고 실험군·추천에도 표시된다', () => {
  assert.ok(app.includes("origin === 'equipped'"), '현재 세팅 전용 고정 UI가 없다');
  assert.ok(app.includes('data-lock-rune'), '고정 버튼이 없다');
  const lockButton = app.indexOf('class="rune-lock');
  const runeName = app.indexOf('class="rname inline', lockButton);
  assert.ok(lockButton < runeName, '고정 버튼이 룬 이름 왼쪽에 있지 않다');
  assert.ok(!html.includes('속도·쿨감 등 계산 밖 효과는 고정해도'), '폭을 어긋나게 하던 긴 고정 안내가 남아 있다');
  assert.match(app, /origin === 'equipped'[\s\S]*state\.lockedRunes\.includes\(n\)[\s\S]*rune-lock on/, '실험군에 고정 표시가 없다');
  assert.match(app, /list\.map[\s\S]*state\.lockedRunes\.includes\(n\)[\s\S]*rune-lock on/, '추천 세팅에 고정 표시가 없다');
  assert.match(app, /locked:\s*state\.lockedRunes/, '고정 목록을 탐색기에 넘기지 않는다');
  assert.match(app, /state\.lockedRunes\s*=\s*state\.lockedRunes\.filter\(\(n\) => next\.includes\(n\)\)/,
    '현재 세팅에서 빠진 룬의 고정을 자동 해제하지 않는다');
});

/* 첫 그림이 곧 기본 상태여야 한다.
 *
 * JS 는 모듈이라 HTML 파싱이 끝난 뒤에 돈다. 그래서 HTML 이 켜 둔 것이 한 번은 그려지고,
 * 그것이 최종 상태와 다르면 **화면이 눈에 띄게 바뀐다.** 실제로 그랬다 — 큰 측정 폼이
 * 먼저 뜨고 JS 가 닫으면서 기본값 블록이 나타났다. */
test('측정 칸은 안 재는 쪽으로 그려져 있다 — 그게 기본값이다', () => {
  const sec = html.slice(html.indexOf('id="measure-section"'), html.indexOf('id="char-panel"'));
  const attrs = (id) => {
    const m = sec.match(new RegExp(`id="${id}"([^>]*)>`));
    assert.ok(m, `#${id} 이 측정 칸 안에 없다`);
    return m[1];
  };
  assert.ok(!/\bhidden\b/.test(attrs('no-measure')),
    '#no-measure 가 hidden 으로 시작한다 — 열자마자 측정 폼이 먼저 보인다');
  assert.ok(/\bhidden\b/.test(attrs('measure-body')),
    '#measure-body 가 켜진 채로 시작한다 — JS 가 닫을 때까지 큰 폼이 그려진다');
  assert.ok(!/\bhidden\b/.test(attrs('measure-start')),
    '기본 상태의 유일한 버튼(#measure-start)이 hidden 으로 시작한다');
});

/* ── 룬 옆의 교체 후보 ────────────────────────────────────
 * 실험군에만 붙는다. 현재 세팅을 바꾸는 문은 ③ 의 「현재 세팅에 반영」 하나뿐인데,
 * 왼쪽에도 붙이면 같은 화면에서 두 가지 다른 일이 일어난다. */
test('교체 후보는 실험군에만 붙는다', () => {
  assert.match(app, /swaps: state\.showSwaps \? betterSwaps\(set, p, t\.score\) : null/,
    '실험군이 교체 후보를 안 넘긴다');
  // 현재 세팅 목록은 swaps 없이 그린다.
  assert.match(app, /renderSetList\(document\.querySelector\('#cur-runes'\), cur\);/,
    '현재 세팅 목록에 교체 후보가 붙었다');
});

/* 룬마다 후보를 재는 값이 만만치 않다(후보 전체면 200회 넘는 평가). 늘 켜두면 스탯 칸을
 * 칠 때마다 그 값을 내므로, 눌러야 뜨게 한다. */
test('후보 추천은 눌러야 뜬다', () => {
  assert.ok(htmlIds.has('toggle-swaps'), '#toggle-swaps 버튼이 없다');
  assert.match(app, /state\.showSwaps = !state\.showSwaps/, '토글이 상태를 안 바꾼다');
  assert.match(app, /showSwaps: false/, '기본이 켜짐이면 렌더가 늘 무거워진다');
});

test('빈 칸에도 넣을 후보를 낸다', () => {
  assert.match(app, /bySlot\[sl\] = top3\(rows\)/, '빈 칸용 후보를 안 만든다');
  // 빈 칸이 둘 이상이면 첫 칸에만. 아니면 같은 칩이 방어구에서 세 번 뜬다.
  assert.match(app, /worn\.length === i \? \(swaps\?\.bySlot\?\.\[sl\] \?\? \[\]\) : \[\]/,
    '빈 칸마다 같은 후보를 되풀이한다');
});

test('교체 후보를 누르면 실험군만 바뀐다', () => {
  const block = app.slice(app.indexOf("querySelector('#trial-runes').addEventListener"));
  const body = block.slice(0, block.indexOf('\n});'));
  assert.ok(body.includes('state.trial ='), '실험군을 안 바꾼다');
  assert.ok(!/state\.equipped\s*=/.test(body), '현재 세팅을 직접 건드리고 있다');
});

test('나빠지는 후보는 안 보여준다', () => {
  // 이 비교가 사라지면 목록이 "무엇을 눌러야 하나" 가 아니라 "무엇이 있나" 가 된다.
  assert.match(app, /return s > baseScore \* 1\.00005 \? s \/ baseScore - 1 : null;/,
    '점수가 오르는 것만 담는 검사가 없다');
});

/* ④ 의 「부위별 교체 추천」은 걷어냈다. 실험군 안에서 같은 일을 하는데 **기준이 달라서**
 * (이쪽은 현재 세팅, 저쪽은 실험군) 같은 룬에 다른 숫자가 두 자리에 떴다. */
test('부위별 교체 추천은 남아 있지 않다', () => {
  assert.ok(!html.includes('slot-recs'), 'HTML 에 #slot-recs 가 남아 있다');
  assert.ok(!app.includes('slot-recs'), 'JS 가 아직 #slot-recs 를 찾는다');
});

test('후보 추천 토글은 꺼졌을 때도 옆 버튼과 같은 모양이다', () => {
  // class 에서 accent 만 떼면 브라우저 기본 회색 버튼이 되어 그것만 다른 종류로 읽힌다.
  assert.match(app, /tg\.classList\.toggle\('quiet', !state\.showSwaps\)/,
    '꺼진 상태에 줄 모양이 없다');
  assert.ok(css.includes('button.quiet'), 'quiet 스타일이 없다');
});

test('좁은 화면의 교체 후보는 룬 이름 아래 줄로 내려간다', () => {
  assert.match(css,
    /@media \(max-width: 560px\)\s*\{[\s\S]*?\.setslot li\s*\{\s*flex-wrap:\s*wrap;\s*\}[\s\S]*?\.setslot \.swaps\s*\{\s*flex:\s*0 0 100%;\s*\}/,
    '후보 칩이 룬 이름과 같은 줄에서 폭을 다투면 이름과 계열 칩이 잘린다');
});

/* 보정한 항목은 더 이상 미계산이 아니다. 이 규칙이 한쪽 패널에만 있어서, 공허의 쿨감을
 * 보정해도 실험군에서는 여전히 「미계산」으로 떴다 — 같은 룬이 왼쪽에서는 보정됨,
 * 오른쪽에서는 미계산이었다. 같은 함수를 쓰게 해서 갈라질 자리를 없앤다. */
test('보정/미계산 가르는 규칙은 한 곳에만 있다', () => {
  const calls = app.match(/splitCorrected\(/g) ?? [];
  assert.ok(calls.length >= 3, `splitCorrected 정의 + 두 패널에서 쓰여야 한다 (지금 ${calls.length}곳)`);
  // 옛 인라인 판별이 남아 있으면 또 갈라진다.
  const inline = app.match(/state\.overrides\[r\.rune\]\?\.utility/g) ?? [];
  assert.equal(inline.length, 1, '보정 여부를 판별하는 자리가 둘 이상이다');
});

test('실험군도 보정 항목을 따로 낸다', () => {
  const block = app.slice(app.indexOf("const warnEl = document.querySelector('#trial-warnings')"));
  const body = block.slice(0, block.indexOf('\n}\n'));
  assert.ok(body.includes('보정 항목'), '실험군에 보정 항목 제목이 없다');
  // 문구는 appliedText 한 곳에서 나온다. 패널마다 따로 쓰면 한쪽만 고쳐져 갈라진다 —
  // 실제로 쿨감 보정을 세트 단위로 옮길 때 문구가 세 곳에 복사돼 있었다.
  assert.ok(body.includes('appliedText('), '실험군이 보정한 값을 안 적는다');
  assert.equal((app.match(/function appliedText\(/g) ?? []).length, 1, 'appliedText 정의가 하나가 아니다');
  assert.doesNotMatch(app, /→ 최종 데미지 \$\{r\.applied[\s\S]{0,40}보정함<\/span>`\)/,
    '보정 문구가 appliedText 밖에 또 있다');
});

test('계열 조건을 못 채운 일부 효과를 세 세팅의 미계산 항목 근처에 표시한다', () => {
  assert.ok(app.includes("kind: '조건 불충분'"), '조건 불충분 행을 만들지 않는다');
  assert.ok(app.includes('효과만 0%로 계산합니다. 다른 효과는 그대로 계산합니다.'),
    '룬 전체가 꺼지는 것이 아니라 일부 효과만 꺼진다고 설명하지 않는다');
  assert.match(app, /w\.innerHTML =[\s\S]*조건 불충분[\s\S]*미계산 항목/,
    '현재 세팅에서 조건 불충분이 미계산 항목 근처에 없다');
  assert.match(app, /recW\.innerHTML =[\s\S]*추천 세트의 조건 불충분[\s\S]*추천 세트에서 새로 생기는 미계산 항목/,
    '추천 세팅에서 조건 불충분이 미계산 항목 근처에 없다');
  const trial = app.slice(app.indexOf("const warnEl = document.querySelector('#trial-warnings')"));
  assert.match(trial, /조건 불충분[\s\S]*미계산 항목/,
    '실험군에서 조건 불충분이 미계산 항목 근처에 없다');
});

test('외부 버전은 기본으로 짧게 보이고 클릭하면 내부 빌드와 함께 표시한다', () => {
  assert.ok(html.includes('id="app-version"') && html.includes('class="version-toggle"'),
    '버전 표시가 클릭 가능한 토글이 아니다');
  assert.ok(app.includes("const RELEASE_VERSION = 'v0.3.0';"), '외부 릴리스 버전이 없다');
  assert.ok(app.includes('`${RELEASE_VERSION} · ${APP_VERSION}`'), '펼친 버전에 내부 빌드가 없다');
  assert.ok(app.includes("localStorage.getItem(VERSION_DETAILS_KEY) === '1'"),
    '버전 펼침 상태를 불러오지 않는다');
  assert.ok(app.includes("localStorage.setItem(VERSION_DETAILS_KEY, showBuildVersion ? '1' : '0')"),
    '버전 펼침 상태를 저장하지 않는다');
  assert.ok(app.includes('k !== STORAGE_KEY && k !== VERSION_DETAILS_KEY'),
    '예전 저장 키를 정리할 때 버전 펼침 상태도 함께 지운다');
  assert.ok(app.includes("setAttribute('aria-expanded', String(showBuildVersion))"),
    '버전 토글 상태를 접근성 속성에 반영하지 않는다');
});

/* 두 패널을 오가는 버튼의 화살표는 **레이아웃이 정한다.**
 *
 * 넓은 화면에서는 현재(왼쪽) / 실험군(오른쪽)이라 ← →, 980px 아래에서는 위아래로 쌓이므로
 * ↑ ↓ 다. 글리프를 HTML 에 박아두면 쌓인 화면에서 화살표가 거짓말이 되는데, 그 사실이
 * 어디에도 안 드러난다 — 모바일에서만 틀리고 에러도 없다.
 *
 * 그래서 글리프를 레이아웃 규칙 옆(CSS)에 두었고, 여기서 그 약속을 못박는다. */
test('세팅 이동 버튼의 화살표는 CSS 가 갖고, 레이아웃과 같이 돈다', () => {
  // HTML 에는 빈 자리만 있어야 한다. 글자를 박으면 미디어 쿼리가 못 바꾼다.
  const spans = [...html.matchAll(/<span class="dir"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1].trim());
  assert.ok(spans.length >= 2, `방향 표시 자리가 ${spans.length}개다 — 버튼 둘에 있어야 한다`);
  assert.deepEqual(spans, spans.map(() => ''), `화살표가 HTML 에 박혀 있다: ${JSON.stringify(spans)}`);

  // 넓은 화면 기본값
  assert.match(css, /#promote-trial \.dir::before\s*\{\s*content:\s*"←"/, '반영 버튼의 기본 화살표(←)가 없다');
  assert.match(css, /#reset-trial \.dir::before\s*\{\s*content:\s*"→"/, '가져오기 버튼의 기본 화살표(→)가 없다');

  // 쌓이는 화면에서는 같은 미디어 쿼리 안에서 위아래로 바뀌어야 한다.
  const stacked = css.slice(css.indexOf('@media (max-width: 980px)'));
  const block = stacked.slice(0, stacked.indexOf('\n}'));
  assert.match(block, /\.cmp-cols\s*\{\s*grid-template-columns:\s*1fr/, '이 테스트가 보는 미디어 쿼리가 바뀌었다');
  assert.match(block, /#promote-trial \.dir::before\s*\{\s*content:\s*"↑"/,
    '패널이 위아래로 쌓이는데 반영 버튼 화살표가 ← 그대로다');
  assert.match(block, /#reset-trial \.dir::before\s*\{\s*content:\s*"↓"/,
    '패널이 위아래로 쌓이는데 가져오기 버튼 화살표가 → 그대로다');
});

test('후보 추천의 긴 칩 안내는 화면에서 제거했다', () => {
  assert.ok(!htmlIds.has('swaps-note'), '#swaps-note 빈자리가 남아 있다');
  assert.ok(!app.includes("document.querySelector('#swaps-note')"), '삭제한 칩 안내를 앱이 아직 쓴다');
  assert.ok(!app.includes('칩이 안 붙은 자리는'), '긴 칩 안내 문구가 남아 있다');
});

test('고정 룬에는 교체 추천을 붙이지도 적용하지도 않는다', () => {
  assert.match(app, /for \(const n of set\)[\s\S]*?if \(state\.lockedRunes\.includes\(n\)\) continue;/,
    '고정 룬의 교체 후보 계산을 건너뛰지 않는다');
  assert.match(app, /if \(swapOut && state\.lockedRunes\.includes\(swapOut\)\) return;/,
    '남아 있는 오래된 교체 버튼으로 고정 룬을 바꿀 수 있다');
});

test('교체 후보 툴팁은 상세창의 계산 반영 내용을 재사용한다', () => {
  assert.match(app, /function shortRuneTooltip\(name\)[\s\S]*?runeDetailHtml\(rune\)[\s\S]*?계산에 반영/,
    '상세창의 「계산에 반영」을 후보 툴팁 원천으로 쓰지 않는다');
  assert.match(app, /title="\$\{shortRuneTooltip\(r\.to\)\}"/,
    '교체 칩이 계산 반영 툴팁을 쓰지 않는다');
  const tooltip = app.slice(app.indexOf('function shortRuneTooltip'), app.indexOf('function renderSetList'));
  assert.doesNotMatch(tooltip, /rune\.desc/,
    '게임 설명 첫 줄을 별도 요약으로 다시 쓰면 상세창과 설명이 갈라진다');
  assert.doesNotMatch(tooltip, /`계산에 반영\\n/,
    '툴팁 제목이 실제 계산 내용을 한 줄 아래로 밀고 있다');
  assert.match(tooltip, /rows\.map\(\(s\) => `• \$\{s\}`\)\.join\('\\n'\)/,
    '툴팁이 계산 내용을 곧바로 글머리표로 보여주지 않는다');
  assert.doesNotMatch(app, /를 \$\{r\.to\} 로 바꿉니다|를 빈 칸에 넣습니다/,
    '예전 교체 동작 툴팁이 남아 있다');
});

/* 「룬 외 피증」 칸은 일부러 비워 둔 자리다. 예전에 EXTRA_FIELDS 가 아무 설명 없이 빈
 * 배열이었고, 그걸 본 사람이 "계산에 물려 있는데 칸이 없다" 며 되살렸다. 이유가 코드에
 * 적혀 있어야 같은 일이 또 안 난다. */
test('EXTRA_FIELDS 는 비어 있고, 왜 비었는지가 적혀 있다', () => {
  assert.match(app, /const EXTRA_FIELDS = \[\];/, 'EXTRA_FIELDS 에 칸이 생겼다 — 출처를 댈 수 있는지 먼저 확인할 것');
  const i = app.indexOf('const EXTRA_FIELDS');
  const why = app.slice(Math.max(0, i - 1200), i);
  assert.match(why, /채우지 마라|비어 있는 것이 맞다/, '왜 비었는지가 안 적혀 있다');
  assert.doesNotMatch(app, /data-profile="nonRuneDamagePercent"/, '룬 외 피증 입력칸이 HTML 로 새어 있다');
});
