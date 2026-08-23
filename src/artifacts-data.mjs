// 팔라딘 아티팩트 — 고유효과만.
//
// 목록·수치·장착 규칙은 전부 게임 안에 표시되는 것이다.
//
// 규칙:
//   · 최대 5개 장착
//   · 황금색은 1개만 장착 가능. 이 1개도 5개 한도에 포함된다(황금 1 + 나머지 4)
//     황금 6종의 고유효과는 **전부 팔라딘 변신 중에만** 켜진다. 상시 기준 계산에서는 전부 0 이다.
//     게다가 **슬롯 기본 깡공도 안 준다**(아래 GIVES_BASE_ATTACK). 그래서 딜 관점에서 황금 칸은
//     빈 칸과 같다 — 목록에 넣는 이유는 착용 개수와 색깔 제한을 바르게 세기 위해서다.
//   · '유일' 표시가 있는 것은 중복 착용해도 1개만 적용된다. 표시가 없으면 중복 시 효과가 중첩된다.
//     그래서 unique:false 인 것은 같은 아티팩트를 2개 이상 낄 수 있다.
//
// effects 는 데미지 공식에 바로 더해지는 항목만 담는다. 그 외(속도·회복·궁극기 게이지 등)는
// uncounted 에 남겨 화면에서 "계산에 안 들어감"으로 보여준다.
//
// requires 는 게임 내 장착 조건(적색 2개 이상 등)이다. 참고용으로만 보관하고 UI 에는 띄우지 않는다 —
// 조건 충족은 사용자가 판단할 몫이고, '착용한 것으로 간주' 하는 효과들(조화·강인함·지혜·기교·은의 기사)
// 때문에 자동 검증이 오히려 틀리기 쉽다.

// 목록은 data/artifacts.json 으로 옮겼다. 수치를 고치려면 거기를 고치고
// `node tools/build-data.mjs` 를 돌려라. 아래는 그 데이터를 쓰는 규칙과 함수다.
export { ARTIFACTS } from './gen/artifacts-list.mjs';

import { ARTIFACTS } from './gen/artifacts-list.mjs';

export const ARTIFACT_SLOTS = 5;

/**
 * 색깔별 장착 상한. 황금색만 1개고 나머지는 슬롯 한도까지다.
 *
 * 데이터가 아니라 코드에 두는 이유: 이건 아티팩트 하나의 속성이 아니라 게임의 장착 규칙이다.
 * 항목마다 반복해 적으면 6개 중 하나만 빠뜨려도 그 하나로 슬롯을 다 채울 수 있게 된다.
 */
export const COLOR_LIMIT = Object.freeze({ 황금: 1 });

/** 이 아티팩트를 몇 개까지 낄 수 있는가 — 유일 표시와 색깔 제한 중 작은 쪽. */
export const artifactMax = (a) =>
  Math.min(a?.unique ? 1 : ARTIFACT_SLOTS, COLOR_LIMIT[a?.color] ?? ARTIFACT_SLOTS);

/**
 * 색깔 제한을 넘긴 곳. 없으면 빈 배열.
 * 저장분에는 제한을 몰랐던 시절의 조합이 남아 있을 수 있어, 입력만 막고 끝내지 않는다.
 */
export function overColorLimit(counts) {
  const byColor = {};
  for (const [name, n] of Object.entries(counts ?? {})) {
    const a = ARTIFACTS.find((x) => x.name === name);
    if (a) byColor[a.color] = (byColor[a.color] ?? 0) + (n || 0);
  }
  return Object.entries(COLOR_LIMIT)
    .filter(([color, max]) => (byColor[color] ?? 0) > max)
    .map(([color, max]) => ({ color, count: byColor[color], max }));
}

/**
 * 아티팩트 1개당 붙는 깡공(기본 공격력). 고유효과와 별개로, 종류와 무관하게 동일하다.
 *
 * 실측 (2026-08-06, 사용자 캐릭터 · 스탯창 공격력):
 *   · 수호 추가 (공격력% 0, B=1.406):  +187 표시 → 187/1.406 = 깡공 133.0
 *   · 연타 제거 (공격력% 0, B=1.426):  −190 표시 → 190/1.426 = 깡공 133.2
 *   B 가 다른 두 상태에서 같은 값이 나왔으므로 '깡공 고정 + 고유효과 별도' 가 맞다.
 *
 * 교차 검증: 순수(공격력 2%)의 표시 증가 938 = 깡공분 187 + 공증분 751.
 *   공증분이 2% 라면 A+133 = 37,550 → A = 37,417.
 *   룬 교체로 잰 A = 37,447 과 0.08% 차이. 두 경로가 독립적으로 같은 A 를 냈다.
 *
 * 세트 비교에는 영향이 없다 — A 는 비율에서 약분된다.
 * 다만 (1) 빈 칸은 그 자체로 손해이고, (2) 아티팩트를 바꾸면 B 뿐 아니라 A 도 변하므로
 * 재측정이 필요하다.
 */
export const BASE_ATTACK_PER_ARTIFACT = 133;

/**
 * 황금색은 이 기본 깡공을 **안 준다.**
 *
 * 실측 (2026-08-08, 스탯창 3연속 비교 · 다른 조건 동일):
 *   일반 5개          공격력 53,957 · 방어력 21,561 · 추가체력 46,974
 *   조화 빼고 4개     공격력 53,767 · 방어력 21,428 · 추가체력 46,193
 *   조화 대신 영웅    공격력 53,767 · 방어력 21,428 · 추가체력 46,974
 *
 * 황금(영웅)을 낀 것과 그 칸을 비운 것의 공격력·방어력이 자릿수까지 같다.
 * 반면 추가 체력은 일반 5개와 같으니, 슬롯이 비어 있는 것도 아니다 — 체력만 주는 것이다.
 * (조화 제거로 표시 공격력 −190 = 깡공 133 × B 1.426. 기존 실측값 133 이 재확인됐다.)
 *
 * 그래서 딜 관점에서 **황금 칸은 빈 칸과 같다.** 이걸 모르면 '빈 칸 손해' 표시가
 * 황금 낀 사람에게만 조용히 0.36% 낙관적으로 나온다.
 */
export const GIVES_BASE_ATTACK = (a) => a?.color !== '황금';

/** 기본 깡공을 실제로 주는 칸의 수. '빈 칸 손해' 계산의 기준이다. */
export function attackBearingSlots(counts) {
  let n = 0;
  for (const [name, c] of Object.entries(counts ?? {})) {
    if (GIVES_BASE_ATTACK(ARTIFACTS.find((x) => x.name === name))) n += (c || 0);
  }
  return n;
}

/**
 * 선택한 아티팩트들이 주는 필드별 합계.
 * @param {Record<string, number>} counts 아티팩트 이름 → 개수
 */
export function sumArtifacts(counts) {
  const totals = {};
  for (const [name, n] of Object.entries(counts ?? {})) {
    if (!(n > 0)) continue;
    const a = ARTIFACTS.find((x) => x.name === name);
    if (!a?.effects) continue;
    // 유일 효과는 몇 개를 껴도 1개분만 적용된다.
    const mult = a.unique ? 1 : n;
    for (const [k, v] of Object.entries(a.effects)) totals[k] = (totals[k] ?? 0) + v * mult;
  }
  return totals;
}

/** 장착 개수 합계 */
export const artifactTotal = (counts) => Object.values(counts ?? {}).reduce((a, b) => a + (b || 0), 0);

export const artifactByName = (n) => ARTIFACTS.find((a) => a.name === n);
