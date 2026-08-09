// 모든 룬이 최소 한 번은 평가되는지.
//
// 여기서 잡으려는 것은 **특정 룬을 껴야만 지나가는 코드 경로** 다. 골든 점수 테스트는 룬 6개짜리
// 고정 세트 하나만 보므로, 그 세트에 안 들어가는 룬의 분기는 아무도 안 밟는다.
//
// 실제로 그렇게 새어 나갔다: data/ 이주 때 rune-conditionals.mjs 가 `export *` 로 데이터를
// 재수출하면서 EROSION_RUNES 를 지역 import 목록에 안 넣었다. `export *` 는 재수출일 뿐 그 파일
// 안에 이름을 만들지 않으므로, 무형이 낀 세트를 평가하는 순간 ReferenceError 로 터졌다.
// 그런데 무형은 골든 세트에 없어서 테스트 55개가 전부 통과했고, 화면에서는 예외가 renderResults
// 중간에서 나는 바람에 **'최적 세트' 블록만 통째로 안 그려졌다** — 에러 메시지 없이.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/build-evaluator.mjs';
import { formlessBranch } from '../src/rune-conditionals.mjs';
import { RUNES } from '../src/runes-data.mjs';
import { EROSION_RUNES, CURSE_RUNES, DRAGON_SIGIL, RUNE_CONDITIONALS } from '../src/gen/rune-conditionals-data.mjs';
import { sampleProfile } from './sample-profile.mjs';

const PROFILE = sampleProfile();
const SCENARIOS = ['min', 'expected', 'max'];

// 무형은 세트 조성으로 효과가 갈리는 유일한 룬이라, 이 룬이 낀 세트만 formlessBranch 를 탄다.
const FORMLESS = '무형';

test('formlessBranch 가 네 분기를 전부 돌려준다 — erosion 이 터지던 자리다', () => {
  assert.equal(formlessBranch([FORMLESS, CURSE_RUNES[0]]), 'curse');
  assert.equal(formlessBranch([FORMLESS, EROSION_RUNES[0]]), 'erosion');
  assert.equal(formlessBranch([FORMLESS, DRAGON_SIGIL.enablers[0]]), 'dragon');
  assert.equal(formlessBranch([FORMLESS]), 'none');
});

test('우선순위는 저주 > 침식 > 용의 문장 이다', () => {
  assert.equal(formlessBranch([FORMLESS, CURSE_RUNES[0], EROSION_RUNES[0], DRAGON_SIGIL.enablers[0]]), 'curse');
  assert.equal(formlessBranch([FORMLESS, EROSION_RUNES[0], DRAGON_SIGIL.enablers[0]]), 'erosion');
});

// 이게 그물이다. 룬 하나하나를 실제로 평가해 봐야, 그 룬만 밟는 경로가 살아 있는지 알 수 있다.
// 점수가 얼마인지는 보지 않는다 — 그건 골든 테스트의 몫이고, 여기는 "터지지 않는가" 만 본다.
for (const scenario of SCENARIOS) {
  test(`${scenario}: 모든 룬을 단독으로 평가해도 터지지 않는다`, () => {
    for (const r of RUNES.items) {
      const score = evaluate(RUNES, [r.name], scenario, PROFILE).score;
      assert.ok(Number.isFinite(score), `${r.name} 의 점수가 유한하지 않다: ${score}`);
    }
  });

  // 단독 평가는 '세트를 봐야 결정되는' 항목(분기·requires·침식 개수)을 못 밟는다.
  // 무형을 같이 끼워 formlessBranch 를 강제로 태운다.
  test(`${scenario}: 무형과 함께 껴도 모든 룬이 평가된다 — 세트 의존 분기까지`, () => {
    for (const r of RUNES.items) {
      if (r.name === FORMLESS) continue;
      const score = evaluate(RUNES, [FORMLESS, r.name], scenario, PROFILE).score;
      assert.ok(Number.isFinite(score), `무형 + ${r.name} 의 점수가 유한하지 않다: ${score}`);
    }
  });
}

/* 같은 효과가 '계산에 반영' 과 '계산에 안 들어간 것' 양쪽에 뜨면 안 된다.
 *
 * 방어구 파괴를 모델에 넣었는데 runes-data 의 uncountedEffects 에 옛 분류가 남아 있어서,
 * 룬 상세에 "방어구 파괴% 10%" 와 "받는 피해 10% 증가 (조건부·미계산)" 이 같이 떴다.
 * 읽는 사람은 반영된 건지 아닌지 알 수 없다.
 *
 * '받는 피해' 라는 이름이 두 뜻을 겸하는 것이 원인이다 — 적이 받는 피해(방어구 파괴)와
 * 내가 받는 피해(무형의 생존 페널티)가 같은 stat 이름을 쓴다. 앞의 것만 잡는다. */
test('방어구 파괴를 모델링한 룬은 그것을 미계산으로도 표시하지 않는다', () => {
  const offenders = [];
  for (const [name, entries] of Object.entries(RUNE_CONDITIONALS)) {
    if (!entries.some((e) => e.field === 'damageIncrease.armorBreakPercent')) continue;
    const rune = RUNES.items.find((r) => r.name === name);
    if (!rune) continue;
    const dup = (rune.uncountedEffects ?? []).filter(
      (e) => /받는 피해|받는 대미지/.test(e.stat ?? '') && e.direction === '증가');
    if (dup.length) offenders.push(`${name}: ${JSON.stringify(dup)}`);
  }
  assert.deepEqual(offenders, [],
    '계산에 넣은 방어구 파괴가 미계산 항목으로도 남아 있다 — 상세 창에 같은 효과가 두 번 뜬다:\n' +
    offenders.map((o) => `  ${o}`).join('\n'));
});

test('내가 받는 피해는 여전히 미계산이다 — 위 검사가 너무 넓으면 안 된다', () => {
  const formless = RUNES.items.find((r) => r.name === '무형');
  const mine = (formless.uncountedEffects ?? []).filter((e) => /받는 피해/.test(e.stat ?? ''));
  assert.equal(mine.length, 1,
    '무형의 "받는 피해 30% 증가"(내가 더 맞는 페널티)까지 지워졌다. 방어구 파괴와 뜻이 다르다.');
});
