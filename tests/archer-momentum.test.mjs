import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFrom } from '../src/build-evaluator.mjs';
import { RUNES } from '../src/runes-data.mjs';
import { uncountedOf } from '../src/rune-uncounted.mjs';

const finalDamage = (names, scenario = 'expected', profile = {}) =>
  buildFrom(RUNES, names, scenario, { job: '궁수', archerTailwindUptimePercent: 0, ...profile }, 'off').build.finalDamage.percent;

test('질주하는 바람 25%를 가동률만큼 추진력으로 환산한다', () => {
  assert.equal(finalDamage([], 'expected', { archerTailwindUptimePercent: 100 }), 12.5);
  assert.equal(finalDamage([], 'expected', { archerTailwindUptimePercent: 40 }), 5);
});

test('룬 외 이동 속도는 추진력 계산에 넣지 않는다', () => {
  assert.equal(finalDamage([], 'expected', { nonRuneMoveSpeedPercent: 20 }), 0);
});

test('숲 길잡이의 상시 10%와 조건부 5%를 시나리오에 맞춰 센다', () => {
  assert.equal(finalDamage(['숲 길잡이'], 'min'), 5);
  assert.equal(finalDamage(['숲 길잡이'], 'max'), 7.5);
});

test('저주 감속은 이동 속도 증가 합계를 깎고 무형이 있으면 사라진다', () => {
  assert.equal(finalDamage(['숲 길잡이', '날 선 적의'], 'min'), 0);
  assert.equal(finalDamage(['숲 길잡이', '날 선 적의', '무형'], 'min'), 5);
});

test('이동 속도 합계가 음수여도 추진력이 최종 대미지 페널티가 되지는 않는다', () => {
  assert.equal(finalDamage(['억눌린 충동']), 0);
});

test('다른 직업은 이동 속도를 최종 대미지로 바꾸지 않는다', () => {
  const base = buildFrom(RUNES, [], 'max', { job: '댄서' }, 'off');
  const withMove = buildFrom(RUNES, ['숲 길잡이'], 'max', { job: '댄서' }, 'off');
  assert.equal(withMove.build.finalDamage.percent, base.build.finalDamage.percent);
});

test('궁수 화면에서는 이동 속도를 더 이상 미계산 유틸로 표시하지 않는다', () => {
  const forest = RUNES.items.find((r) => r.name === '숲 길잡이');
  assert.equal(uncountedOf(forest).filter((u) => /이동 속도/.test(u.text)).length, 2);
  assert.ok(!uncountedOf(forest, { job: '궁수' }).some((u) => /이동 속도/.test(u.text)));
});

test('평가 결과에 추진력 계산 근거를 함께 돌려준다', async () => {
  const { evaluate } = await import('../src/build-evaluator.mjs');
  const ev = evaluate(RUNES, ['숲 길잡이'], 'max', { job: '궁수', archerTailwindUptimePercent: 0 });
  assert.equal(ev.movementSpeedPercent, 15);
  assert.equal(ev.momentumFinalDamagePercent, 7.5);
});
