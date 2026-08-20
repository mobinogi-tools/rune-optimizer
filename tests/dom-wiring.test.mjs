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
