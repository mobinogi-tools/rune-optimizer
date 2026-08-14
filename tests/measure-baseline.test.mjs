// 룬 외 공증의 기준선 — 측정 시점의 착용 목록.
//
// 룬 외 공증은 `총 공증 − 그때 낀 룬` 이다. 예전에는 그 뺄셈을 **착용을 건드릴 때마다**
// 다시 했다. 그래서 룬을 하나 끼울 때마다 룬 외 공증이 그만큼 깎였고 — 인챈트·아티팩트가
// 주는 공증이 룬을 낀다고 줄 리가 없는데도 — 결국 음수가 되어 멀쩡한 측정이 풀렸다.
// 같은 원인으로 부위별 교체 추천이 약속한 상승폭이 적용하는 순간 사라졌다.
//
// 여기서 잡는 것은 두 가지다: 기준선이 바뀌면 결과가 실제로 달라진다는 것(그러니 아무 값이나
// 쓰면 안 된다는 것), 그리고 이행이 기존 사용자의 값을 안 건드린다는 것.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrateMeasureBaseline } from '../src/save-migrations.mjs';
import { evaluate } from '../src/build-evaluator.mjs';
import { RUNES } from '../src/runes-data.mjs';
import { sampleProfile } from './sample-profile.mjs';

/* 기준선이 결과를 얼마나 움직이는지부터 못박는다. 이게 작으면 위 버그도 사소한 것이고,
 * 크면 기준선을 고정하는 일이 중요한 것이다. 실제로 크다. */
test('룬 외 공증이 달라지면 같은 룬 교체의 이득이 달라진다', () => {
  const A = ['광채+', '계시+', '눈부신 잔영', '두 갈래 뿔'];
  const B = ['광채+', '계시+', '눈부신 잔영', '억눌린 충동'];
  const gain = (nonRune) => {
    const p = sampleProfile({ assumeVulnerable: false, nonRuneAttackPercent: nonRune });
    return evaluate(RUNES, B, 'expected', p).score / evaluate(RUNES, A, 'expected', p).score - 1;
  };
  const 낮음 = gain(0), 높음 = gain(200);
  assert.ok(낮음 > 높음 + 0.03,
    `룬 외 공증이 커질수록 룬 교체 이득이 작아져야 한다 (0%: ${(낮음 * 100).toFixed(2)}%, 200%: ${(높음 * 100).toFixed(2)}%)`);
});

/* 이행으로 값이 변하면 사용자는 자기가 잰 값이 틀어졌다고 읽는다. 옛 동작이 어차피
 * '지금 착용'으로 계산했으므로, 그걸 그대로 옮기면 화면 숫자가 안 움직인다. */
test('옛 저장분의 기준선을 지금 착용으로 채운다 — 화면 값이 안 바뀌는 유일한 선택이다', () => {
  const saved = { equipped: ['광채+', '계시+'], measure: { committed: true, nonRunePercent: 25 } };
  const { state, changed } = migrateMeasureBaseline(saved);
  assert.equal(changed, true);
  assert.deepEqual(state.measure.equippedAtMeasure, ['광채+', '계시+']);
  assert.equal(state.measure.nonRunePercent, 25, '이행이 측정값 자체를 건드렸다');
});

test('이미 기준선이 있으면 덮어쓰지 않는다 — 덮으면 그게 곧 재측정이다', () => {
  const saved = {
    equipped: ['광채+', '계시+', '두 갈래 뿔'],
    measure: { committed: true, equippedAtMeasure: ['광채+'] },
  };
  const { state, changed } = migrateMeasureBaseline(saved);
  assert.equal(changed, false);
  assert.deepEqual(state.measure.equippedAtMeasure, ['광채+']);
});

test('확정 안 한 측정에는 기준선을 만들지 않는다 — 아직 측정이 아니다', () => {
  const saved = { equipped: ['광채+'], measure: { committed: false } };
  const { state, changed } = migrateMeasureBaseline(saved);
  assert.equal(changed, false);
  assert.equal(state.measure.equippedAtMeasure, undefined);
});

test('착용이 비어 있어도 기준선은 만들어진다 — 빈 목록도 사실이다', () => {
  const { state, changed } = migrateMeasureBaseline({ measure: { committed: true } });
  assert.equal(changed, true);
  assert.deepEqual(state.measure.equippedAtMeasure, []);
});

/* 확정 뒤에는 착용을 바꿔도 기준선이 안 흔들려야 한다. computeMeasure 는 DOM 을 타서
 * node 로 못 부르므로, 그 판단이 measuredEquipped() 한 곳을 거치는지를 소스로 확인한다.
 * 여기가 뚫리면 증상이 조용하다 — 점수가 그럴듯하게 틀릴 뿐 에러가 없다. */
test('룬 외 공증을 구할 때 지금 착용을 직접 읽지 않는다', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('src/rune-app.mjs', 'utf8');
  assert.match(src, /const eq = measuredEquipped\(\);/,
    'computeMeasure 가 measuredEquipped() 를 안 거친다 — 착용을 바꿀 때마다 기준선이 움직인다');
  assert.match(src, /state\.measure\.equippedAtMeasure = \[\.\.\.state\.equipped\]/,
    '측정을 확정할 때 그 시점 착용 목록을 안 남긴다 — 남기지 않으면 고정할 기준이 없다');
});
