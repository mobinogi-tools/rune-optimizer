// 저장된 룬 조정값의 라벨 → id 이행.
//
// 이행이 틀리면 실패가 조용하다. 사용자가 넣어둔 값이 조회에서 빗나가 기본값으로 돌아가는데,
// 화면에는 그냥 기본값이 떠 있어 아무 신호가 없다 — 라벨을 키로 쓰던 원래 버그가 정확히 그랬다.
// 그래서 여기서는 "키가 바뀌었다" 만 보지 않고 **바뀐 키로 계산에 실제로 들어가는지**까지 본다.
//
// load() 는 localStorage 와 DOM 을 타서 node 로 못 부른다. 그래서 이행 로직만 순수 함수로
// 떼어 rune-conditionals.mjs 에 두었고, load() 는 그걸 부르기만 한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateConditionalOverrideKeys, RUNE_CONDITIONALS } from '../src/rune-conditionals.mjs';
import { evaluate } from '../src/build-evaluator.mjs';
import { RUNES } from '../src/runes-data.mjs';
import { sampleProfile } from './sample-profile.mjs';

// 조정 가능한 항목(basis: playstyle)이라 화면에 입력칸이 뜨는 실제 사례를 쓴다.
const RUNE = '거두는 손길';
const ENTRY = RUNE_CONDITIONALS[RUNE][0];

test('라벨로 저장된 조정값이 id 키로 옮겨지고 값이 그대로 남는다', () => {
  const { overrides, changed } = migrateConditionalOverrideKeys({
    [RUNE]: { cond: { [ENTRY.label]: 4 } },
  });
  assert.equal(changed, true);
  assert.deepEqual(overrides[RUNE].cond, { [ENTRY.id]: 4 });
});

test('옮겨진 조정값이 실제로 계산에 들어간다 — 여기가 진짜 확인이다', () => {
  const profile = sampleProfile();
  const score = (runeOverrides) => evaluate(RUNES, [RUNE], 'expected', { ...profile, runeOverrides }).score;

  const saved = { [RUNE]: { cond: { [ENTRY.label]: 0 } } };  // 라벨 키로 저장돼 있던 상태
  const base = score(undefined);
  // 이행하지 않으면 조회가 빗나가 기본 기대값으로 되돌아간다. 이게 고치려던 증상이다.
  assert.equal(score(saved), base, '라벨 키가 그대로 먹히면 이 테스트는 아무것도 검사하지 않는다');
  assert.ok(score(migrateConditionalOverrideKeys(saved).overrides) < base,
    `이행한 조정값(기대값 0%)이 계산에 반영되지 않았다`);
});

test('이미 id 로 저장돼 있으면 건드리지 않는다 — 매번 되쓰지 않게', () => {
  const saved = { [RUNE]: { cond: { [ENTRY.id]: 7 }, utility: 3 } };
  const { overrides, changed } = migrateConditionalOverrideKeys(saved);
  assert.equal(changed, false);
  assert.deepEqual(overrides, saved);
});

test('id 키와 라벨 키가 겹치면 id 쪽이 이긴다 — 이행 후에 넣은 값이 최신이다', () => {
  const { overrides } = migrateConditionalOverrideKeys({
    [RUNE]: { cond: { [ENTRY.id]: 7, [ENTRY.label]: 4 } },
  });
  assert.equal(overrides[RUNE].cond[ENTRY.id], 7);
});

test('짝이 없는 옛 키는 버리지 않는다 — 지우면 되살릴 방법이 없다', () => {
  const { overrides } = migrateConditionalOverrideKeys({
    [RUNE]: { cond: { '없어진 옵션%': 9 } },
  });
  assert.equal(overrides[RUNE].cond['없어진 옵션%'], 9);
});

test('모델에 없는 룬의 조정값도 그대로 둔다', () => {
  const saved = { '이름이 바뀐 룬': { cond: { '피증%': 5 }, utility: 2 } };
  const { overrides, changed } = migrateConditionalOverrideKeys(saved);
  assert.equal(changed, false);
  assert.deepEqual(overrides, saved);
});

test('utility 등 cond 밖의 값은 이행이 건드리지 않는다', () => {
  const { overrides } = migrateConditionalOverrideKeys({
    [RUNE]: { utility: 2.5, cond: { [ENTRY.label]: 4 } },
  });
  assert.equal(overrides[RUNE].utility, 2.5);
});

test('원본 저장분을 훼손하지 않는다 — 이행이 실패해도 옛 값은 남아야 한다', () => {
  const saved = { [RUNE]: { cond: { [ENTRY.label]: 4 } } };
  migrateConditionalOverrideKeys(saved);
  assert.deepEqual(saved, { [RUNE]: { cond: { [ENTRY.label]: 4 } } });
});

test('빈 저장분·없는 저장분에도 터지지 않는다', () => {
  assert.deepEqual(migrateConditionalOverrideKeys({}), { overrides: {}, changed: false });
  assert.deepEqual(migrateConditionalOverrideKeys(undefined), { overrides: {}, changed: false });
});
