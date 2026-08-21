// 고정 입력 → 고정 점수.
//
// 목적은 "이 점수가 옳다" 가 아니라 **"모르는 새에 바뀌지 않는다"** 이다.
// 화면만 고치려던 PR 이 추천 순위를 바꿔놓는 일을 여기서 잡는다.
// (계산 모듈은 UI 를 import 하지 않으므로, UI diff 만 있는 PR 에서 이게 깨지면 경계를 넘은 것이다.)
//
// 데이터를 고치면 이 값은 당연히 바뀐다. 그때는 아래 숫자를 갱신하는 것이 정상이고,
// 그 갱신이 PR diff 에 남아 "이 변경이 결과를 얼마나 움직였는지" 가 눈에 보이게 된다.
// 값만 슬쩍 맞추지 말고, 왜 바뀌었는지 PR 에 적을 것.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/build-evaluator.mjs';
import { RUNES } from '../src/runes-data.mjs';
import { sampleProfile } from './sample-profile.mjs';

// DEFAULT_PROFILE 은 이제 빈 양식(전부 0)이라 여기 쓰면 0 투성이 입력을 굳히게 된다.
const PROFILE = sampleProfile({ assumeVulnerable: false });
const RUNE_SET = ['거대한 분노', '계시+', '광채+', '눈부신 잔영', '대군주+', '두 갈래 뿔'];

/* 2026-08-21 갱신: 댄서 샘플의 전투 패턴을 실제에 맞게 고쳤다.
 * 초당 타수 2.4→3, 실강타율 88→99, 직업 치확·추확 보정 8→12.
 * 샘플이 곧 이 테스트의 입력이라 점수가 같이 움직인다(+9.8% / +12.4% / +10.1%). */
const GOLDEN = {
  min: 4074777.5331,
  expected: 5502343.3198,
  max: 7621752.0567,
};

for (const [scenario, expected] of Object.entries(GOLDEN)) {
  test(`${scenario} 시나리오 점수가 그대로다`, () => {
    const actual = evaluate(RUNES, RUNE_SET, scenario, PROFILE).score;
    assert.equal(Number(actual.toFixed(4)), expected,
      `점수가 ${expected} → ${actual.toFixed(4)} 로 바뀌었다 (${((actual / expected - 1) * 100).toFixed(2)}%).\n` +
      `데이터를 고쳤다면 이 숫자를 갱신하고 PR 에 이유를 적을 것. 화면만 고쳤다면 경계를 넘은 것이다.`);
  });
}

test('세트 순위는 점수 순이다', () => {
  const scores = ['min', 'expected', 'max'].map((s) => evaluate(RUNES, RUNE_SET, s, PROFILE).score);
  // 밤의 축복 ON/OFF 를 가중평균한 expected 는 항상 min 과 max 사이에 있어야 한다.
  assert.ok(scores[0] < scores[1] && scores[1] < scores[2],
    `min < expected < max 가 깨졌다: ${scores.join(' / ')}`);
});
