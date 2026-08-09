// 직업 패시브 — 밤의 축복 구간에 겹치는 클래스 버프.
//
// 데이터는 data/jobs/*.json 으로 옮겼다. 이 파일에는 그 데이터를 해석하는 함수만 남는다.
// 수치를 고치려면 여기가 아니라 data/jobs/<직업>.json 을 고치고 `node tools/build-data.mjs` 를 돌려라.
//
// 밤의 축복 스킬 자체는 전 직업 공통이다(공격력 +15%, 15초, 재사용 60초).
// 직업마다 다른 것은 '무엇이 그 스킬을 발동시키는가' 이고, 그 트리거가 그 직업의
// 다른 버프와 같이 켜지면 15초 구간의 값어치가 크게 달라진다.
//
// effects 는 그 구간에만 얹히는 필드별 증분이다. 값을 하나(최종 데미지)로 뭉뚱그리면
// 직업마다 들어가는 자리가 달라 틀린다 — 기사는 공증·치확·추확·피증 네 군데로 흩어지고
// 빙결술사는 공증, 전사는 피증이다.
//
// window 가 15초보다 짧은 버프는 (지속/15) 비율로 깎아 넣었다. 평가기가 ON 구간
// 전체에 같은 빌드를 적용하기 때문이고, 근사라는 것을 각 항목 note 에 적어 둔다.
//
// confidence:
//   'high'   — 툴팁 수치가 명확하고 지속시간이 밤의 축복 구간을 덮는다
//   'medium' — 수치는 있으나 조건·가동률에 해석이 들어갔다
//   'low'    — 간접 경로이거나 상한이 확인되지 않았다
export { CLASS_NIGHT_BLESSING, CLASS_UPTIME_PASSIVE, CLASS_ALWAYS_ON } from './gen/jobs-data.mjs';

import { CLASS_NIGHT_BLESSING, CLASS_UPTIME_PASSIVE, CLASS_ALWAYS_ON } from './gen/jobs-data.mjs';

/**
 * 밤의 축복이 실제로 도는 주기(초).
 *
 * 스킬 쿨은 60초지만 발동은 직업별 트리거가 와야 일어난다. 트리거 간격이 쿨보다 짧아도
 * 딱 나눠떨어지지 않으면 한 박자를 건너뛰게 되어 주기가 길어진다 —
 * 기사는 트리거가 45초마다라 60초 쿨을 45초에 못 맞추고 90초마다 발동한다.
 * 그만큼 밤의 축복 구간의 딜 비중이 줄어들고, 그 구간에만 붙는 룬의 값어치도 낮아진다.
 */
export function nightBlessingCycleSeconds(job, cooldownSeconds) {
  const iv = CLASS_NIGHT_BLESSING[job]?.triggerIntervalSeconds;
  if (!(iv > 0)) return cooldownSeconds;
  return Math.ceil(cooldownSeconds / iv) * iv;
}

/** 밤의 축복 구간에 얹히는 직업별 증분. 모르는 직업이면 빈 객체. */
export function classNightBlessingEffects(job) {
  return CLASS_NIGHT_BLESSING[job]?.effects ?? {};
}

/**
 * 유지형 직업 패시브 — 실력으로 가동률을 끌어올릴 수 있는 것들.
 *
 * 검술사 집중이 대표다. 집중력이 1초에 5씩 차고 집중 상태에서 1초에 5씩 빠져서
 * 방치하면 가동률이 50% 근처지만, 잘 하는 사람은 100% 로 유지한다.
 * 그래서 고정값이 아니라 사용자가 넣는 가동률로 받는다.
 *
 * nightBlessingGuarantees 가 true 면 밤의 축복 트리거가 이 패시브를 확정 발동시킨다.
 * 그 경우 ON 구간에서는 가동률과 무관하게 100% 로 보고, 모자란 몫만 그 구간에 더한다.
 */
export const uptimePassive = (job) => CLASS_UPTIME_PASSIVE[job] ?? null;

/**
 * 직업 상시 패시브의 필드별 합계.
 *
 * 룬 순위 자체는 거의 안 바꾼다(모든 세트에 똑같이 붙어 비율에서 약분된다). 다만 기저를
 * 키워 같은 계열 옵션의 한계 가치를 낮추고, 절대 점수를 맞게 만든다.
 *
 * 스킬 종류 한정 효과(비검 피해, 특정 스킬 대미지)는 이 공식에 자리가 없어 넣지 않는다.
 */
export function classAlwaysOnEffects(job) {
  const out = {};
  for (const p of CLASS_ALWAYS_ON[job] ?? []) {
    for (const [k, v] of Object.entries(p.effects)) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}
