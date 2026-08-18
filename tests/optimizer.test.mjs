// 최적 세트 탐색.
//
// 이 탐색은 rune-app.mjs 안에 있어서 테스트가 없었다. "제한 후보 풀 150회를 전수와
// 대조했다" 는 확인이 한 번 손으로 돌고 끝났고, 그 뒤로 룬이 8개 늘고 계열 조건이
// 생기는 동안 아무도 다시 재지 않았다.
//
// 여기서 잡는 것은 "최적인가" 가 아니다 — 언덕오르기는 원래 최적을 보장하지 않는다.
// 잡는 것은 **틀린 답**(불법 세트)과 **구조적으로 못 찾는 조합**이다. 후자는 조용하다:
// 그 룬이 추천에 안 나올 뿐이라 화면 어디에도 신호가 없다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimizeSet, SLOT_ORDER } from '../src/optimizer.mjs';
import { RUNES } from '../src/runes-data.mjs';
import { evaluate, SLOT_CAPACITY } from '../src/build-evaluator.mjs';
import { validateRuneSet, RUNE_FAMILY } from '../src/rune-conditionals.mjs';
import { sampleProfile } from './sample-profile.mjs';

const USABLE = RUNES.items.filter((r) => SLOT_ORDER.includes(r.slot));
const SLOT_OF = Object.fromEntries(USABLE.map((r) => [r.name, r.slot]));
const slotOf = (n) => SLOT_OF[n];
const PROFILE = sampleProfile({ assumeVulnerable: false });
const score = (set) => evaluate(RUNES, set, 'expected', PROFILE).score;
const run = (candidates, equipped = []) => optimizeSet({ candidates, equipped, score, slotOf });
const named = (...names) => names;

test('추천 세트는 언제나 합법이다 — 정원·저주·각성 제약을 지킨다', () => {
  // 후보를 조금씩 다르게 잘라 여러 번 돌린다. 한 번만 돌리면 우연히 통과한다.
  for (let cut = 0; cut < 6; cut++) {
    const candidates = USABLE.filter((_, i) => i % 6 !== cut).map((r) => r.name);
    const best = run(candidates);
    const v = validateRuneSet(best.set);
    assert.ok(v.valid, `불법 세트가 나왔다(${cut}): ${v.reason} — ${best.set.join(', ')}`);
    for (const s of SLOT_ORDER) {
      const n = best.set.filter((x) => slotOf(x) === s).length;
      assert.ok(n <= SLOT_CAPACITY[s], `${s} 정원 초과 ${n}/${SLOT_CAPACITY[s]}`);
    }
    assert.equal(new Set(best.set).size, best.set.length, '같은 룬이 두 번 들어갔다');
    for (const n of best.set) assert.ok(candidates.includes(n), `${n} 은 후보에 없다`);
  }
});

test('돌려준 점수는 그 세트를 실제로 매긴 점수와 같다', () => {
  const best = run(USABLE.map((r) => r.name));
  assert.ok(Math.abs(best.score - score(best.set)) < 1e-6,
    `점수가 세트와 안 맞는다: ${best.score} vs ${score(best.set)}`);
});

test('지금 낀 세트보다 나쁜 것을 추천하지 않는다', () => {
  // 등반은 착용 세트에서 출발하므로 그 아래로 내려갈 수 없어야 한다.
  const equipped = named('죽음', '금 간 봉인', '계승자', '용 사냥꾼', '승전', '쐐기돌', '영원한 밤');
  assert.ok(validateRuneSet(equipped).valid, '테스트가 쓰는 착용 세트부터 불법이다');
  const best = run(USABLE.map((r) => r.name), equipped);
  assert.ok(best.score >= score(equipped) - 1e-6,
    `착용(${score(equipped).toFixed(0)})보다 낮은 것을 추천했다: ${best.score.toFixed(0)}`);
});

/* 여기부터가 이 파일의 이유. 단독으로는 손해라 등반이 절대 안 넣는 룬들이다.
 * 프로브가 죽으면 점수만 조금 낮아지고 아무 에러도 안 난다. */

test('용의 문장 쌍을 찾는다 — 하나만으로는 값이 안 나 등반이 못 넣는 조합', () => {
  // 발동 룬(별바라기)과 소비 룬을 둘 다 넣어야 값이 나는 풀을 만든다.
  const candidates = named(
    '별바라기', '잠들지 않는 불', '용 사냥꾼', '바위 칼날',
    '기본기+', '햇살+', '계시+', '해방', '태초',
  ).filter((n) => SLOT_OF[n]);
  const best = run(candidates);
  const dragons = best.set.filter((n) => ['별바라기', '잠들지 않는 불', '용 사냥꾼', '바위 칼날'].includes(n));
  assert.ok(dragons.length >= 2, `용의 문장 룬을 ${dragons.length}개만 골랐다: ${best.set.join(', ')}`);
});

test('계열 시너지를 찾는다 — 작열은 빛 계열이 모여야 값이 난다', () => {
  /* 작열의 치명타 확률은 빛 계열 수에 따라 3/7/12/18% 다. 혼자 끼면 3% 뿐이라
   * 한 번에 하나씩 바꾸는 등반은 절대 안 넣는다. 빛 룬이 이미 여럿 든 세트가 우연히
   * 만들어질 때만 들어가는데, 후보가 좁으면 그런 일이 안 생긴다. */
  const light = USABLE.filter((r) => RUNE_FAMILY[r.name.replace(/\+$/, '')] === '빛')
    .filter((r) => r.slot === '방어구').slice(0, 4).map((r) => r.name);
  const filler = USABLE.filter((r) => !RUNE_FAMILY[r.name.replace(/\+$/, '')])
    .map((r) => r.name);
  const candidates = [...new Set(['작열', ...light, ...filler])];
  const best = run(candidates);
  // 작열이 최선이 아닐 수는 있다. 다만 '작열 + 빛 셋' 을 손으로 만든 세트보다
  // 낮은 점수를 돌려주면 그건 프로브가 그 봉우리를 못 올라갔다는 뜻이다.
  const byHand = ['작열', ...light.slice(0, 4)].slice(0, SLOT_CAPACITY['방어구']);
  if (validateRuneSet(byHand).valid) {
    assert.ok(best.score >= score(byHand) - 1e-6,
      `손으로 짠 빛 세트(${score(byHand).toFixed(0)})보다 낮다: ${best.score.toFixed(0)} — ${best.set.join(', ')}`);
  }
});

test('계열 문턱 룬을 넣을 때 문턱을 같이 채운다 — 황혼 숨결은 용 2개부터 값이 난다', () => {
  // 용 계열이 자기뿐이면 황혼 숨결은 통째로 0 이다. 파트너를 같이 심어야 봉우리에 오른다.
  const dragons = USABLE.filter((r) => RUNE_FAMILY[r.name.replace(/\+$/, '')] === '용')
    .filter((r) => r.slot === '방어구' && r.name !== '황혼 숨결').slice(0, 2).map((r) => r.name);
  const filler = USABLE.filter((r) => !RUNE_FAMILY[r.name.replace(/\+$/, '')] && r.slot === '방어구')
    .map((r) => r.name).slice(0, 3);
  const candidates = [...new Set(['황혼 숨결', ...dragons, ...filler])];
  const byHand = ['황혼 숨결', ...dragons];
  const best = run(candidates);
  assert.ok(best.score >= score(byHand) - 1e-6,
    `손으로 짠 용 세트(${score(byHand).toFixed(0)})보다 낮다: ${best.score.toFixed(0)} — ${best.set.join(', ')}`);
});

test('후보가 부위를 다 못 채워도 터지지 않는다', () => {
  const best = run(named('공허'));
  assert.deepEqual(best.set, ['공허']);
  assert.ok(Number.isFinite(best.score));
  const empty = run([]);
  assert.deepEqual(empty.set, []);
});

test('착용 세트가 불법이어도 합법인 답을 돌려준다', () => {
  // 저장분이 낡아 제약을 어기는 상태로 들어올 수 있다. 거기서 시작해도 답은 합법이어야 한다.
  const candidates = USABLE.map((r) => r.name);
  const illegal = USABLE.filter((r) => r.slot === '방어구').slice(0, 7).map((r) => r.name);
  const best = run(candidates, illegal);
  assert.ok(validateRuneSet(best.set).valid, `불법 착용에서 시작해 불법 답이 나왔다: ${best.set.join(', ')}`);
  for (const s of SLOT_ORDER) {
    assert.ok(best.set.filter((x) => slotOf(x) === s).length <= SLOT_CAPACITY[s], `${s} 정원 초과`);
  }
});
