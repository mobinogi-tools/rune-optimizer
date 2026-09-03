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
const PROFILE = sampleProfile({ assumeVulnerable: false, externalArmorBreak: false });
const RUNE_SET = ['거대한 분노', '계시+', '광채+', '눈부신 잔영', '대군주+', '두 갈래 뿔'];

/* 2026-08-21 갱신: 댄서 샘플의 전투 패턴을 실제에 맞게 고쳤다.
 * 초당 타수 2.4→3, 실강타율 88→99, 직업 치확·추확 보정 8→12.
 * 샘플이 곧 이 테스트의 입력이라 점수가 같이 움직인다(+9.8% / +12.4% / +10.1%).
 *
 * 2026-08-22 갱신: min 만 +12.06%. 세트에 든 광채+ 가 「지속 피해가 걸린 적」 게이트를
 * 받으면서, 게이트가 열린 뒤에는 상시가 됐다(긍지·위엄과 같은 모양 — 조건이 맞으면
 * 안 꺼진다). 그래서 '아무것도 안 터진' 하한에도 치명타 피해 15% 가 들어간다.
 * expected·max 는 그대로다 — 댄서 샘플은 전환 룬으로 화상·빙결이 상시라 게이트가 열려
 * 있고, 예전에도 기대값에 최대치가 박혀 있었기 때문이다. 도트를 안 거는 직업에서는
 * 이제 세 시나리오가 모두 0 이 된다(예전에는 상시로 잡혔다).
 *
 * 2026-08-23 갱신: expected 만 +0.55%. 댄서의 스포트라이트가 밤의 축복을 5초 늘리는 것을
 * 넣었다(15 → 20초). 그 5초는 밤의 축복만 켜져 있고 템포 40% 는 없는 **세 번째 상태**라,
 * 공증 +15% 와 밤축 트리거 룬 옵션만큼만 오른다. 이 골든 세트에는 밤축 트리거 룬이 없어서
 * 상승폭이 작다 — 그런 룬을 낀 세트는 2~4% 오른다.
 * min·max 는 한 상태만 보는 시나리오라 그대로다.
 *
 * 2026-08-23 갱신 ②: expected 만 +2.51%. 둘이 같이 움직였다.
 *   · 댄서의 밤의 축복 주기를 75 → 60초로 잡았다. 트리거를 자연 간격(2템포 약 25초)에
 *     맡기면 75초지만, 앵콜·피날레로 템포를 당겨 쿨에 맞출 수 있다.
 *     밤축 구간 비중이 크게 올라 그 구간에 붙는 것이 전부 값이 커진다.
 *   · 기준 전투 시간 기본값을 1분 → 2분으로 바꿨다. 「전투 시작 시 N초」 버프가 묽어지고
 *     시간으로 차오르는 중첩(신기루)은 더 찬다.
 * min·max 는 여전히 한 상태만 보므로 그대로다. */
/* 2026-08-26 갱신: 댄서 클로즈드 포지션의 상시 최종 대미지 10%와 단일 대상 추가 15%를
 * 계산에 넣었다. 이 골든 프로필은 단일 보스 기준이라 세 시나리오 모두 기저 최종 대미지
 * 25%가 추가된다. 밤의 축복 ON 구간에는 템포 40%가 이미 있어 증가율은 상대적으로 작다. */
/* 2026-09-03 갱신: 템포를 밤의 축복 한정 40%로 보던 근사를 없앴다. 평상시 템포
 * 2단계 가동률(기본 60%)과 절묘한 박자감의 상대 증가를 계산해 세 시나리오가 함께 변한다. */
const GOLDEN = {
  min: 7023049.0052,
  expected: 8018112.2195,
  max: 9418307.8986,
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
