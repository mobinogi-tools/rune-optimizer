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

test('스킬 자원 비중은 전투 상황에 있다 — 전투 패턴이 아니라', () => {
  const sit = html.slice(html.indexOf('id="situation-group"'));
  const end = sit.indexOf('</section>');
  assert.ok(sit.slice(0, end).includes('data-profile="resourceSkillSharePercent"'),
    '스킬 자원 비중 칸이 전투 상황 안에 없다');
  assert.ok(!app.includes("extra.push(['resourceSkillSharePercent'"),
    '전투 패턴에도 아직 그리고 있다 — 같은 값의 칸이 둘이 된다');
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

/* 칩 수는 **반환값**으로 받아야 한다.
 *
 * renderSetList 는 패널마다 불린다 — 현재 세팅은 swaps 없이(칩 0개), 실험군은 swaps 와 함께.
 * 칩 수를 함수 속성 같은 공용 자리에 남기면 나중에 부른 쪽이 앞 값을 덮어서, 실험군에
 * 칩이 있는데도 안내가 "한 칸만 바꿔서 나아지는 자리가 없습니다" 로 뜬다. 틀린 말을
 * 조용히 하는 자리라 못박아 둔다. */
test('칩 수는 renderSetList 의 반환값으로 받는다', () => {
  assert.match(app, /function renderSetList\([^)]*\)\s*\{[\s\S]*?\n  return chipCount;\n\}/,
    'renderSetList 가 칩 수를 반환하지 않는다');
  assert.match(app, /const chipCount = renderSetList\(/, '실험군이 반환값을 안 받는다');
  assert.doesNotMatch(app, /renderSetList\.chipCount/,
    '칩 수를 함수 속성에 남기고 있다 — 패널 둘이 같은 자리를 쓰면 덮어쓴다');
});

/* 「후보 추천」을 켰을 때만 안내가 뜬다. 꺼져 있을 때도 남아 있으면
 * 칩이 없는 이유를 설명하는 문장이 칩과 무관하게 떠 있게 된다. */
test('칩 안내는 후보 추천을 켰을 때만 뜨고, ④ 로 보낸다', () => {
  assert.ok(htmlIds.has('swaps-note'), '#swaps-note 자리가 HTML 에 없다');
  const i = app.indexOf("document.querySelector('#swaps-note')");
  assert.ok(i > 0, '앱이 #swaps-note 를 안 쓴다');
  const block = app.slice(i, i + 1400);
  assert.match(block, /if \(state\.showSwaps\)/, '켜짐 여부로 안 가른다');
  assert.match(block, /noteEl\.hidden = true/, '꺼졌을 때 감추지 않는다');
  assert.match(block, /④ 추천 세팅/, '④ 로 보내지 않는다 — 이 안내의 용건이 그것이다');
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
