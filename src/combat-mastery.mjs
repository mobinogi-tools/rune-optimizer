// 전투 숙련 — 직업마다 하나씩 고정으로 붙는 패시브.
//
// 데이터는 data/masteries.json 으로 옮겼다. 수치를 고치려면 거기를 고치고
// `node tools/build-data.mjs` 를 돌려라.
//
// effects 는 데미지 공식 필드로 바로 들어가는 것만 담는다.
// 방어 효과(받는 피해 감소)·회복량은 공식에 자리가 없어 uncounted 에 문자열로 남긴다.
// 전부 보관하는 이유는, 나중에 필요해지면 거기만 보면 되도록 하기 위해서다.
//
// ⚠ 이 배선(연타/강타/치명타 증가를 룬·아티팩트와 같은 자리에 넣는 것)은 확증하지 못했다.
//   왜 검증이 불가능한지와 그래서 결과가 어떻게 되는지는 data/limits.json 의
//   mastery-wiring 에 있다 — 이용자도 봐야 하는 얘기라 코드 주석에 두지 않는다.
//   여기 한 번 더 적으면 두 벌이 되고, 낡는 쪽은 늘 코드 주석이었다.
//   data/masteries.json 의 confidence 도 medium 이다.
export { COMBAT_MASTERIES } from './gen/masteries-data.mjs';

import { COMBAT_MASTERIES } from './gen/masteries-data.mjs';

export const MASTERY_NAMES = Object.freeze(Object.keys(COMBAT_MASTERIES));

/** 직업 → 전투 숙련. 위 jobs 목록을 뒤집은 것이다. */
export const JOB_MASTERY = Object.freeze(
  Object.fromEntries(
    Object.entries(COMBAT_MASTERIES).flatMap(([m, v]) => v.jobs.map((j) => [j, m])),
  ),
);

/** 전투 숙련이 데미지 공식에 주는 필드별 값. 없거나 모르는 이름이면 빈 객체. */
export function masteryEffects(name, job = null) {
  const mastery = COMBAT_MASTERIES[name];
  return (job && mastery?.jobEffects?.[job]) ?? mastery?.effects ?? {};
}

/** 계산에 안 들어간 항목들 — 화면에 '미계산'으로 보여주기 위한 것. */
export function masteryUncounted(name) {
  return COMBAT_MASTERIES[name]?.uncounted ?? [];
}
