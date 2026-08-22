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
  assert.match(app, /function renderSetList\(host, names, \{ origin = 'equipped' \} = \{\}\)/,
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

/* ── 측정과 안 재는 것 사이를 오가기 ──────────────────────
 * 예전에는 한 번 확정하면 안 재는 화면으로 돌아갈 길이 없었다 — 되돌아 나오는 버튼이
 * 미확정일 때만 떴기 때문이다. 그리고 그 버튼 이름이 「측정 취소」라, 안 재고 쓰는 것이
 * 선택이 아니라 하던 일을 무르는 것처럼 읽혔다. */
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

test('스킬 자원 비중은 전투 상황에 있다 — 전투 패턴이 아니라', () => {
  const sit = html.slice(html.indexOf('id="situation-group"'));
  const end = sit.indexOf('</section>');
  assert.ok(sit.slice(0, end).includes('data-profile="resourceSkillSharePercent"'),
    '스킬 자원 비중 칸이 전투 상황 안에 없다');
  assert.ok(!app.includes("extra.push(['resourceSkillSharePercent'"),
    '전투 패턴에도 아직 그리고 있다 — 같은 값의 칸이 둘이 된다');
});
