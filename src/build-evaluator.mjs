// 룬 세트 평가기 — "어떤 룬을 껴야 하는가" 에 답하기 위한 모듈.
//
// 핵심: 룬 세트끼리 비교할 때 A(깡공 총합)는 필요 없다.
//   데미지 = 2 × 롤 × floor(A×B) × C·D·E·F·G·H·I·J·K·L × 스킬계수
//   두 세트의 비율에서 A 는 약분된다. 스탯창 공격력이 바뀌어도 룬 순위는 그대로다.
// 필요한 것은 '룬 외 공증%' 뿐이다. (실측: 총 공증 − 룬 공증)
//
// 마찬가지로 스킬계수 · 보스 방어력(I) · 카운터(J) 는 세트와 무관한 공통 배수라
// 비율에는 영향을 주지 않는다. 그래서 허수아비 실측 없이도 순위를 낼 수 있다.

import { calculateDamage } from './calculator.mjs';
import { EFFECT_FIELDS } from './gen/effect-fields.mjs';
import {
  RUNE_CONDITIONALS,
  RUNE_ALWAYS_ON_EXTRA,
  POLLUTION_REDUCTION,
  NIGHT_BLESSING,
  dragonSigilUptime,
  validateRuneSet,
  hitTriggerUptime,
  UTILITY_DAMAGE_EQUIVALENT,
  transcendEmblemUptime,
  erosionExpected,
  erosionWindowUptime,
  streakStackExpected,
  familyCounts,
  distinctFamilies,
  formlessBranch,
  EROSION_RUNES,
} from './rune-conditionals.mjs';
import { masteryEffects } from './combat-mastery.mjs';
import { DUAL_WIELD_JOBS } from './gen/jobs-data.mjs';
import {
  classNightBlessingEffects, uptimePassive, classAlwaysOnEffects, nightBlessingCycleSeconds,
} from './class-passives.mjs';

/** 부위별 장착 가능 개수. */
export const SLOT_CAPACITY = Object.freeze({
  무기: 1,
  방어구: 5, // 투구 / 상의 / 하의 / 장갑 / 신발
  장신구: 3, // 목걸이 1 + 반지 2
  엠블럼: 1,
});

/** 비율 계산에만 쓰는 기준 깡공. 어떤 값이든 순위는 같다(floor 오차만 달라짐). */
const REFERENCE_ATTACK = 100000;

/**
 * 캐릭터 프로필. 스탯창 수치 + 룬으로 설명되지 않는 값들.
 * 스탯창 공격력(A×B)은 여기 없어도 된다 — 비율에서 약분되기 때문.
 */
/**
 * 기대값을 만드는 수식의 이름들. 데이터의 expectedFrom 이 이 중 하나여야 한다.
 *
 * 검증기(tools/validate-data.mjs)가 이 목록을 읽는다. 사슬 옆에 주석으로만 적어두면
 * 사슬을 고칠 때 검증기 쪽을 같이 안 고쳐서, 새 수식이 "모르는 이름" 으로 거부된다.
 * 실제 디스패치는 resolveRuneEffects 안의 3항 사슬이다.
 */
/* 기대값 수식마다 반드시 있어야 하는 파라미터. 이름만 맞고 파라미터가 빠지면
 * undefined 가 식에 들어가 NaN 이 되고, add() 가 NaN 을 버려서 조용히 0 이 된다 —
 * 이름 오타는 즉시 막으면서 파라미터 누락은 통과시키던 비대칭을 없앤다.
 * 검증기가 이 표를 읽는다. 수식을 고치면 여기도 같이 고쳐야 한다. */
export const EXPECTED_FROM_PARAMS = Object.freeze({
  erosion: Object.freeze(['erosionBase']),
  hitTrigger: Object.freeze(['hitTrigger']),
  stacks: Object.freeze(['perStack', 'maxStacks', 'stackDurationSeconds']),
  streak: Object.freeze(['perStack', 'maxStacks', 'streakRate']),
  castCycle: Object.freeze(['perApplication', 'durationSeconds', 'castsRequired']),
  // 세트에 든 계열 룬 수로 값이 정해진다. 시간 가동률이 아니라 **구성**이 정하므로
  // min·expected·max 가 모두 같다 — 조건부지만 확률이 아니다.
  familySteps: Object.freeze(['familyOf', 'steps']),
  // 스탯창 수치에 비례해 값이 정해진다("연타 강화 500마다 2%, 최대 8%").
  // familySteps 와 같은 성격이다 — 확률이 아니라 **입력**이 정하므로 시나리오와 무관하다.
  // 상한은 max 를 그대로 쓴다. cap 을 따로 두면 화면에 뜨는 범위와 어긋날 수 있다.
  statSteps: Object.freeze(['statOf', 'per', 'perStep', 'max']),
  // 침식 사이클 중 '침식 100 미만이거나 오염' 인 시간 비중. 파라미터는 세트가 정한다
  // (침식 룬 수·오염 감소) — 항목 쪽에서 줄 것은 천장뿐이다.
  erosionWindow: Object.freeze(['max']),
});
// 목록을 따로 적으면 표와 어긋난다. 표가 진실이다.
export const EXPECTED_FROM_NAMES = Object.freeze(Object.keys(EXPECTED_FROM_PARAMS));

/* 조건부 항목의 trigger 로 쓸 수 있는 이름. 지금까지 아무 검사도 없어서, 오타난 트리거는
 * 에러 없이 아래 min/max 사슬로 떨어져 '상시 효과' 처럼 계산됐다. 검증기가 이 목록을 읽는다. */
export const TRIGGER_NAMES = Object.freeze(['dragonSigil', 'nightBlessing', 'basicAttack']);

/** hitTrigger 객체가 요구하는 키. cooldownSeconds 는 기본값이 있어 선택이다. */
export const HIT_TRIGGER_PARAMS = Object.freeze(['hitsRequired', 'durationSeconds']);

/* stacks 수식에서 '무엇으로 쌓는가'. 생략하면 타격이고, 'skillCasts' 면 스킬 시전이다.
 * 모르는 이름은 에러가 아니라 **타격으로 폴백**해서 그럴듯하게 틀린 값을 낸다.
 * 그래서 검증기가 이 목록으로 막는다 — 목록은 여기 하나뿐이어야 한다. */
export const RATE_BY_SKILL_CASTS = 'skillCasts';
export const RATE_FIELD_NAMES = Object.freeze([RATE_BY_SKILL_CASTS]);

export const PROFILE_TEMPLATE = Object.freeze({
  // 스탯창 수치
  rapidEnhance: 0, heavyEnhance: 0, areaEnhance: 0, comboEnhance: 0, ultimateEnhance: 0,
  criticalStat: 0, breakStat: 0, extraHitStat: 0,
  skillPower: 0, // 스킬 위력 (공식의 '스윕')
  // 대미지 공식에는 안 들어간다. 새 룬이 이 수치에 비례해 값을 주므로 받아둔다.
  fastSkill: 0,
  // 기본 공격(평타)을 섞는가. 평타를 해야 붙는 효과(작열)의 스위치다.
  usesBasicAttack: false,

  // 룬 외 출처 (인챈트 / 아티팩트 / 팔라딘 등)
  nonRuneAttackPercent: 0,
  nonRuneDamagePercent: 0,

  // C(피증)의 별도 가산항. 룬 피증(템주피증)과 다른 자리에 들어가지만 효과는 같은 가산이다.
  // 기저가 커질수록 추가 피증 1%p 의 상대 가치가 떨어진다.
  helioPercent: 0, // 헬리오도르
  artifactDamagePercent: 0, // 아티팩트 주피증
  skillDamagePercent: 0, // 스킬 피해% (스윕과 곱해지는 자리)

  // 아티팩트가 주는 확률/피해 옵션. 룬과 같은 가산 그룹에 들어간다.
  artifactCriticalRatePercent: 0,
  artifactExtraRatePercent: 0,
  artifactRapidDamagePercent: 0,
  artifactHeavyDamagePercent: 0,
  artifactAreaDamagePercent: 0,
  artifactComboDamagePercent: 0,
  artifactAttackPercent: 0,
  artifactVulnerabilityPercent: 0,

  // 전투 숙련(직업 고정 패시브). 이름만 담고, 수치는 combat-mastery.mjs 에서 꺼내 쓴다.
  // 룬 중 '전투 숙련: OO 보유 시' 조건을 가진 것들(긍지·위엄)의 게이트이기도 하다.
  combatMastery: null,
  // 직업 이름. 밤의 축복 구간에 겹치는 직업 버프를 찾는 데 쓴다.
  job: null,
  nightBlessingClassBonusPercent: 0,
  // 밤의 축복이 실제로 도는 주기(초). 직업 표를 덮어쓴다. 직접 재본 사람이 넣는 값.
  nightBlessingCycleSeconds: null,
  // 유지형 직업 패시브의 가동률(검술사 집중 등). 해당 패시브가 없는 직업이면 무시된다.
  classPassiveUptimePercent: 100,

  // 직업 특성 등 스탯으로 설명되지 않는 보정
  characterCriticalRatePercent: 0,
  characterCriticalDamagePercent: 0,
  characterExtraRatePercent: 0,

  // 전투 패턴
  hitsPerSecond: 2,
  // 초당 스킬 시전 수. 타격 수와 다르다 — 스킬 하나가 여러 번 때리기 때문.
  // '스킬 사용 시' 로 쌓이는 스택(공세+ 등)의 기대 중첩을 정한다.
  skillCastsPerSecond: 1,
  isRapid: true, rapidRatePercent: 100,
  isHeavy: false, heavyRatePercent: 100,
  isArea: false, areaRatePercent: 100,
  isUltimate: false,
  comboTier: 0,

  // 무방비(브레이크) 상태를 유효하게 볼지. 무방비 피해% 옵션의 가치가 여기서 갈린다.
  assumeVulnerable: false,

});

function get(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
/* 같은 효과를 주는 룬을 여러 개 껴도 안 쌓이는 것이 있다 — 방어구 파괴가 그렇다.
 * 셋이 각각 10% 를 주지만 둘을 껴도 10% 다. 그냥 더하면 20% 가 되어 조용히 과대평가된다.
 *
 * 어느 경로가 그런지는 코드가 아니라 data/effect-fields.json 이 `stack` 으로 밝힌다.
 * 게임이 15% 짜리 방어구 파괴를 내놓아도 데이터만 고치면 되고, 새로 생기는 '중첩불가'
 * 효과도 코드를 안 건드린다. */
function add(target, path, value) {
  if (!path || !value) return;
  if (EFFECT_FIELDS[path]?.stack === 'max') {
    target[path] = Math.max(target[path] ?? 0, value);
    return;
  }
  target[path] = (target[path] ?? 0) + value;
}
const baseName = (n) => n.replace(/\+$/, '');

/** 룬 이름으로 데이터를 찾는다. '+' 유무를 모두 허용한다. */
export function findRune(runeData, name) {
  return runeData.items.find((i) => i.name === name) ??
    runeData.items.find((i) => baseName(i.name) === baseName(name));
}

/** 현재 룬 세트의 치명타율 / 추가타율. 초월 엠블럼 가동률 계산에 필요하다. */
function triggerRates(profile, deltas) {
  const crit = Math.min(1, Math.max(0,
    0.5 - 1 / (2 + profile.criticalStat / 1000) +
    ((deltas['critical.runeCriticalRatePercent'] ?? 0) + profile.artifactCriticalRatePercent) / 100 +
    profile.characterCriticalRatePercent / 100));
  const extra = (1 + profile.extraHitStat / 13000) *
    (1 + ((deltas['extraHit.runeExtraRatePercent'] ?? 0) + profile.artifactExtraRatePercent +
      profile.characterExtraRatePercent) / 100) - 1;
  return { critRate: crit, extraRate: Math.max(0, extra) };
}

/**
 * 룬 세트가 만들어내는 필드별 증분을 합산한다.
 * @param {object} runeData src/runes-data.mjs 의 RUNES
 * @param {string[]} runeNames
 * @param {'min'|'expected'|'max'} scenario
 * @param {object} profile
 */
export function resolveRuneEffects(runeData, runeNames, scenario, profile, nightBlessing = 'off') {
  const deltas = {};
  const notes = [];

  // 1) 상시 효과
  for (const name of runeNames) {
    const rune = findRune(runeData, name);
    if (!rune) { notes.push(`미발견 룬: ${name}`); continue; }
    // 초월은 모델에 넣지 않는다 — 모든 룬을 초월 0 기준으로 놓고 비교한다.
    // 일부 룬만 실측값으로 올리면 그 룬만 유리해져 비교가 공평하지 않다.
    // 초월은 측정 단계(기준 룬의 실제 공증%)에서만 쓴다.
    add(deltas, 'attackIncrease.itemAttackPercent', rune.alwaysOnAttackPercent);
    add(deltas, 'damageIncrease.itemMainDamagePercent', rune.alwaysOnDamagePercent);

    // 공증/피증 외 상시 스탯(치명타 피해%, 연타 피해% 등). 생성 파이프라인이 넣어준다.
    if (rune.alwaysOnExtra) for (const [path, v] of Object.entries(rune.alwaysOnExtra)) add(deltas, path, v);
    // 손으로 보정할 것이 있으면 덮어쓰기 대신 추가로 얹는다.
    const manual = RUNE_ALWAYS_ON_EXTRA[rune.name] ?? RUNE_ALWAYS_ON_EXTRA[baseName(rune.name)];
    if (manual) for (const [path, v] of Object.entries(manual)) add(deltas, path, v);

    // 조건부 효과가 있는데 RUNE_CONDITIONALS 에 모델링돼 있지 않으면 과소평가된다. 알린다.
    const modeled = RUNE_CONDITIONALS[rune.name] ?? RUNE_CONDITIONALS[baseName(rune.name)];
    if (rune.conditionalRaw && !modeled) {
      const detail = Object.entries(rune.conditionalRaw).map(([f, v]) => `${f}=${v}%`).join(', ');
      notes.push(`조건부 미모델링(과소평가): ${rune.name} — ${detail}`);
    }
    if (rune.skillTypeBonuses) {
      notes.push(`스킬타입 한정 보너스 미반영: ${rune.name} — ` +
        rune.skillTypeBonuses.map((b) => `${b.stat} ${b.value}%`).join(', '));
    }
  }

  // 전투 숙련·직업 패시브도 상시 효과와 같은 가산 그룹이다.
  // 반드시 여기서 넣어야 한다 — 아래 triggerRates() 가 치명타율·추가타율을 확정하는데,
  // 그보다 늦게 더하면 초월 엠블럼 가동률과 화면의 확률 표시가 이 몫을 놓친다.
  for (const [path, v] of Object.entries(masteryEffects(profile.combatMastery))) add(deltas, path, v);
  // 직업 상시 패시브(검술사 날카로운 눈·연계 검술+ 등).
  for (const [path, v] of Object.entries(classAlwaysOnEffects(profile.job))) add(deltas, path, v);
  // 밤의 축복 구간에만 겹치는 직업 버프. 직업마다 들어가는 자리가 달라 필드별 맵으로 받는다.
  if (nightBlessing === 'on') {
    for (const [path, v] of Object.entries(classNightBlessingEffects(profile.job))) add(deltas, path, v);
  }
  // 유지형 직업 패시브(검술사 집중 등). 평소에는 가동률만큼만, 밤의 축복이 확정 발동시키는
  // 직업이면 그 구간에서는 가동률과 무관하게 100% 로 본다.
  const upPassive = uptimePassive(profile.job);
  if (upPassive) {
    const rate = Math.min(1, Math.max(0, (profile.classPassiveUptimePercent ?? 100) / 100));
    const applied = nightBlessing === 'on' && upPassive.nightBlessingGuarantees ? 1 : rate;
    for (const [path, v] of Object.entries(upPassive.effects)) add(deltas, path, v * applied);
  }

  // 조건부 효과를 두 번에 나눠 적용한다.
  // 가동률이 확률에서 계산되는 항목(초월 엠블럼)은 치명타율·추가타율이 확정된 뒤에 넣어야 하는데,
  // 그 확률 자체가 다른 조건부 효과(얼음 발톱의 추가타 확률 등)에 영향을 받기 때문이다.
  // 조정값은 항목의 id 로 찾는다. 라벨로 찾던 시절에는 문구를 다듬는 순수 UI 수정이
  // 사용자의 저장된 조정값을 조회에서 빗나가게 만들어, 아무 경고 없이 기본값으로 되돌렸다.
  const ovOf = (name, e) =>
    profile.runeOverrides?.[name]?.cond?.[e.id] ??
    profile.runeOverrides?.[baseName(name)]?.cond?.[e.id];

  const eachConditional = (fn) => {
    for (const name of runeNames) {
      const entries = RUNE_CONDITIONALS[name] ?? RUNE_CONDITIONALS[baseName(name)];
      if (!entries) continue;
      for (const e of entries) {
        if (!e.field) continue;
        if (e.requires && !e.requires.every((r) => runeNames.some((n) => baseName(n) === r))) continue;
        // 계열 게이트. "빛·어둠·용을 모두"(각 1개 이상), "각각 2개 이상" 같은 조건이다.
        // requires 와 달리 특정 룬이 아니라 **몇 개 있느냐**를 본다. 자기 자신도 센다.
        if (e.requiresFamily && !familyGateOpen(e.requiresFamily)) continue;
        // 무기 조건(두 영웅). 양손에 같은 무기를 드는 직업에서만 켜진다.
        if (e.requiresDualWield && !DUAL_WIELD_JOBS.includes(profile.job)) continue;
        // 전투 숙련 게이트. 숙련이 다르면 최대 시나리오에서도 절대 발동하지 않으므로
        // 여기서 통째로 빼는 것이 맞다(0을 더하는 것과 결과는 같지만 의도가 분명하다).
        if (e.requiresMastery && profile.combatMastery !== e.requiresMastery) continue;
        // 무방비 게이트. 브레이크를 유효하게 보지 않으면 이 효과들은 켜질 일이 없다.
        if (e.requiresVulnerable && !profile.assumeVulnerable) continue;
        // 세트 조성으로 갈리는 분기(무형). 해당 분기가 아니면 이 항목은 없는 것과 같다.
        if (e.branch && formlessBranch(runeNames) !== e.branch) continue;
        fn(e, name);
      }
    }
  };

  /* 계열(빛·어둠·용)로 정해지는 값.
   *
   * 시간 가동률이 아니라 **세트 구성**이 정하므로 min·expected·max 가 모두 같다 —
   * 조건부 자리에 있지만 확률이 아니다. 룬을 바꾸지 않는 한 안 흔들린다.
   *
   * `familyOf` 가 '계열수' 면 서로 다른 계열의 가짓수(쐐기돌), 아니면 그 계열의 룬 수다.
   * `steps` 는 1개일 때부터의 값이고, 넘치면 마지막 값에서 멈춘다.
   * 예) 작열 [3,7,12,18] — 빛 계열이 1·2·3·4개일 때. 5개면 그대로 18.
   *
   * 자기 자신도 센다. "장착한 빛 계열 룬의 수" 에 자신이 빠질 이유가 없다(툴팁 그대로).
   */
  const familyStepValue = (e) => {
    const n = e.familyOf === '계열수'
      ? distinctFamilies(runeNames)
      : (familyCounts(runeNames)[e.familyOf] ?? 0);
    if (n <= 0) return 0;
    return e.steps[Math.min(n, e.steps.length) - 1];
  };

  /* 계열 게이트. { "빛": 2, "어둠": 2, "용": 2 } 는 "각각 2개 이상" 이다. */
  const counts = familyCounts(runeNames);
  const familyGateOpen = (req) => Object.entries(req).every(([f, n]) => (counts[f] ?? 0) >= n);

  /* 스탯창 수치에 비례하는 값. "연타 강화 500마다 2% (최대 8%)".
   *
   * '500마다' 는 내림이다 — 499 는 0 이고 999 도 1단이다. 상한에 걸리는 룬이 많아
   * 대개 티가 안 나지만, 오팔 성배(빠른 스킬 1.5%씩 최대 6%)처럼 상한 아래에서 노는
   * 것도 있어서 반올림하면 실제로 값이 달라진다.
   *
   * **스탯을 안 넣으면 0 이다.** 그래서 이 항목들에는 note 로 무엇에 비례하는지 적어둔다 —
   * 스탯창이 비어 있으면 이 룬들이 조용히 약하게 보인다.
   */
  const statStepValue = (e) => {
    const stat = profile[e.statOf] ?? 0;
    if (!(stat > 0)) return 0;
    return Math.min(e.max ?? 0, Math.floor(stat / e.per) * e.perStep);
  };

  /* 시나리오와 무관한 값들(계열 구성·스탯 비례)을 한자리에서 처리한다.
   * min('아무것도 안 터짐')에도 그대로 붙는다 — 세트를 짜고 스탯을 넣는 순간
   * 정해지는 값이라 '안 터질' 수가 없다. 처리했으면 true 를 돌려준다. */
  const applyScenarioFree = (e) => {
    if (e.expectedFrom === 'familySteps') { add(deltas, e.field, familyStepValue(e)); return true; }
    if (e.expectedFrom === 'statSteps') { add(deltas, e.field, statStepValue(e)); return true; }
    return false;
  };

  // 오염 감소 룬이 있으면 침식 계열 기대값이 올라간다. 세트 전체를 보고 결정한다.
  const erosionCount = runeNames.filter((n) => EROSION_RUNES.includes(baseName(n))).length;
  const pollutionReduction = runeNames.reduce(
    (sum, n) => sum + (POLLUTION_REDUCTION[n] ?? POLLUTION_REDUCTION[baseName(n)] ?? 0), 0);

  // 2) 가동률이 고정된 조건부 효과
  eachConditional((e, name) => {
    if (e.uptimeFrom) return;
    // 사용자가 이 룬의 기대값을 직접 지정했으면 그 값을 우선한다.
    const ov = ovOf(name, e);
    // 밤의 축복 트리거 효과는 ON 구간에서만, 그리고 전액 적용된다.
    if (e.trigger === 'dragonSigil') {
      // min 은 '아무것도 발동하지 않은 상태'라 다른 조건부와 같이 0이어야 한다.
      if (scenario === 'min') { add(deltas, e.field, e.min ?? 0); return; }
      const up = dragonSigilUptime(runeNames);
      // max 는 '이 룬이 낼 수 있는 천장'이라 사용자 조정값을 따르지 않는다.
      // 다른 조건부는 모두 그렇게 동작하는데 여기만 조정값에 끌려가고 있었다.
      // 단, 발동 룬이 없으면 천장도 0이다 — 용의 문장이 켜질 수 없기 때문.
      if (scenario === 'max') { add(deltas, e.field, up > 0 ? (e.max ?? 0) : 0); return; }
      add(deltas, e.field, Number.isFinite(ov) ? ov : (e.max ?? 0) * up);
      return;
    }
    if (e.trigger === 'nightBlessing') {
      if (nightBlessing === 'on') add(deltas, e.field, e.max ?? 0);
      return;
    }
    /* 기본 공격이 있어야 붙는 버프(작열).
     *
     * 예전에는 "기본 공격은 자동으로 계속 나가므로 상시" 로 봤는데 그게 틀렸다 —
     * 대부분의 직업은 기본 공격을 **안 하려고** 한다. 스킬로 채우는 것이 이득이라서다.
     * 상시로 두면 이 룬이 모두에게 과대평가되고, 계열 시너지 탐색이 그걸 증폭한다.
     *
     * 그래서 기본값은 0 이고, 기본 공격을 섞는 빌드는 룬 상세에서 직접 올린다.
     * 천장은 계열 수가 정하므로(빛 1~4개에 3/7/12/18%) 사용자 값도 거기서 자른다 —
     * 빛이 하나뿐인데 18 을 적어도 실제로는 3% 를 넘을 수 없다. */
    if (e.trigger === 'basicAttack') {
      const ceiling = familyStepValue(e);
      if (scenario === 'min') return;
      if (scenario === 'max') { add(deltas, e.field, ceiling); return; }
      // 사용자가 이 룬에 직접 값을 넣었으면 그것이 우선한다 — 다른 조건부와 같은 규칙이다.
      if (Number.isFinite(ov)) { add(deltas, e.field, Math.min(ceiling, ov)); return; }
      // 평타를 섞는다면 10초짜리 버프는 사실상 끊기지 않는다. 안 섞으면 아예 안 붙는다.
      if (profile.usesBasicAttack) add(deltas, e.field, ceiling);
      return;
    }
    if (applyScenarioFree(e)) return;
    /* 침식 사이클의 특정 구간에서만 켜지는 효과(삼키는 모래). 침식 룬이 세트에 없으면
     * 사이클 자체가 없으므로 max 시나리오에서도 0 이다 — 용의 문장과 같은 이유로
     * 여기서 따로 막는다. 사슬에 맡기면 '천장 = e.max' 라 있지도 않은 값이 붙는다. */
    if (e.expectedFrom === 'erosionWindow') {
      if (erosionCount <= 0) return;
      const v = scenario === 'min' ? (e.min ?? 0)
        : scenario === 'max' ? (e.max ?? 0)
        : Number.isFinite(ov) ? ov
        : (e.max ?? 0) * erosionWindowUptime(pollutionReduction, erosionCount);
      add(deltas, e.field, v);
      return;
    }

    const value = scenario === 'min' ? (e.min ?? 0)
      : scenario === 'max' ? (e.max ?? 0)
      : Number.isFinite(ov) ? ov
      // ⚠ 여기 사슬에 이름을 추가하면 EXPECTED_FROM_NAMES 에도 넣어야 한다.
      //   모르는 이름은 맨 아래 (e.expected ?? 0) 으로 조용히 떨어지고, derived 항목은
      //   expected 가 null 이라 그대로 0 이 된다 — 오타가 아무 신호 없이 옵션을 꺼버린다.
      : e.expectedFrom === 'erosion' ? erosionExpected(e.erosionBase, pollutionReduction, erosionCount)
      : e.expectedFrom === 'hitTrigger'
        ? (e.max ?? 0) * hitTriggerUptime(e.hitTrigger, profile.hitsPerSecond)
      : e.expectedFrom === 'stacks'
        // 스택을 쌓는 행위가 '타격'인지 '스킬 시전'인지는 룬마다 다르다. 기본은 타격.
        ? e.perStack * Math.min(e.maxStacks,
          (e.rateField === RATE_BY_SKILL_CASTS ? (profile.skillCastsPerSecond ?? 0) : profile.hitsPerSecond)
          * e.stackDurationSeconds)
      : e.expectedFrom === 'streak'
        ? e.perStack * streakStackExpected((profile[e.streakRate] ?? 0) / 100, e.maxStacks)
      // 'N회 시전마다 M초' 형태(추적자의 자기 디버프). 걸려 있는 시간 비중만큼 반영한다.
      : e.expectedFrom === 'castCycle'
        ? e.perApplication * Math.min(1,
          e.durationSeconds * (profile.skillCastsPerSecond ?? 0) / e.castsRequired)
      : (e.expected ?? 0);
    add(deltas, e.field, value);
  });

  // 3) 확정된 확률로 가동률을 계산하는 조건부 효과
  const rates = triggerRates(profile, deltas);
  eachConditional((e) => {
    if (!e.uptimeFrom) return;
    if (applyScenarioFree(e)) return;

    const value = scenario === 'min' ? (e.min ?? 0)
      : scenario === 'max' ? (e.max ?? 0)
      : (e.max ?? 0) * transcendEmblemUptime(rates[e.uptimeFrom], profile.hitsPerSecond);
    add(deltas, e.field, value);
  });

  return { deltas, notes, rates };
}

/** 프로필 + 룬 세트 → calculator.mjs 가 받는 빌드 객체. */
export function buildFrom(runeData, runeNames, scenario, profile, nightBlessing = 'off') {
  const p = { ...PROFILE_TEMPLATE, ...profile };
  const { deltas, notes, rates } = resolveRuneEffects(runeData, runeNames, scenario, p, nightBlessing);
  const nb = nightBlessing === 'on';
  const d = (path) => deltas[path] ?? 0;
  const build = {
    attack: { characterAttack: REFERENCE_ATTACK },
    attackIncrease: {
      // 아티팩트 공격력%는 더하지 않는다. 스탯창 공격력에 이미 반영돼 있어
      // 측정으로 역산한 nonRuneAttackPercent 안에 들어 있고, 또 더하면 이중 계산이 된다.
      // (피증·치확·추확 등 다른 아티팩트 효과는 스탯창에 안 잡히므로 따로 더한다.)
      itemAttackPercent: p.nonRuneAttackPercent +
        d('attackIncrease.itemAttackPercent') + (nb ? NIGHT_BLESSING.baseAttackPercent : 0),
    },
    damageIncrease: {
      sweep: p.skillPower,
      skillDamagePercent: p.skillDamagePercent + d('damageIncrease.skillDamagePercent'),
      helioPercent: p.helioPercent,
      artifactMainDamagePercent: p.artifactDamagePercent,
      itemMainDamagePercent: p.nonRuneDamagePercent + d('damageIncrease.itemMainDamagePercent'),
      // 적에게 거는 약화(방어구 파괴). 계산기에서는 받피증 괄호에 들어간다 —
      // 공증·피증과 곱해지는 별개 항이라 여기 값이 작아도 효과는 작지 않다.
      armorBreakPercent: d('damageIncrease.armorBreakPercent'),
    },
    enhancement: {
      rapidEnhance: p.rapidEnhance, heavyEnhance: p.heavyEnhance, areaEnhance: p.areaEnhance,
      comboEnhance: p.comboEnhance, ultimateEnhance: p.ultimateEnhance, comboTier: p.comboTier,
      // 연타·강타·멀티히트는 발동률 하나로만 켜고 끈다. 별도 on/off 플래그를 두면
      // 발동률 99% 인데 플래그가 꺼져 있어 0 이 되는 식으로 어긋난다.
      // 파생을 여기서 하는 이유: 예전에는 rune-app 안에 있어서, UI 밖에서 evaluate() 를
      // 부르면 플래그가 undefined 로 들어가 강타·광역 항이 통째로 0 이 됐다.
      isRapid: (p.rapidRatePercent ?? 0) > 0, rapidRatePercent: p.rapidRatePercent,
      rapidDamagePercent: p.artifactRapidDamagePercent + d('enhancement.rapidDamagePercent'),
      isHeavy: (p.heavyRatePercent ?? 0) > 0, heavyRatePercent: p.heavyRatePercent,
      heavyDamagePercent: p.artifactHeavyDamagePercent + d('enhancement.heavyDamagePercent'),
      isArea: (p.areaRatePercent ?? 0) > 0, areaRatePercent: p.areaRatePercent,
      areaDamagePercent: p.artifactAreaDamagePercent + d('enhancement.areaDamagePercent'),
      // 콤보는 배선이 빠져 있었다 — 아티팩트 '연격' 의 콤보 피해 2% 가 선언만 되고
      // 계산에 들어가지 않았다. 콤보 비중(comboTier)이 0 이면 어차피 0 이라 안 보였다.
      comboDamagePercent: p.artifactComboDamagePercent + d('enhancement.comboDamagePercent'),
      isUltimate: p.isUltimate,
    },
    critical: {
      mode: 'expected', criticalStat: p.criticalStat,
      characterCriticalRatePercent: p.characterCriticalRatePercent,
      characterCriticalDamagePercent: p.characterCriticalDamagePercent,
      runeCriticalRatePercent: p.artifactCriticalRatePercent + d('critical.runeCriticalRatePercent'),
      criticalDamagePercent: d('critical.criticalDamagePercent'),
    },
    break: {
      isVulnerable: p.assumeVulnerable,
      breakStat: p.breakStat,
      vulnerabilityDamagePercent: p.artifactVulnerabilityPercent + d('break.vulnerabilityDamagePercent'),
    },
    extraHit: {
      mode: 'expected', extraHitStat: p.extraHitStat,
      characterExtraRatePercent: p.characterExtraRatePercent,
      runeExtraRatePercent: p.artifactExtraRatePercent + d('extraHit.runeExtraRatePercent'),
      extraDamagePercent: d('extraHit.extraDamagePercent'),
    },
    finalDamage: {
      // 직업 버프는 위에서 deltas 에 얹었다. 여기 남은 것은 사용자가 직접 넣는 보정뿐.
      percent: d('finalDamage.percent') + (nb ? (p.nightBlessingClassBonusPercent ?? 0) : 0),
    },
    defense: { bossDefense: 0 }, // 세트 비교에는 영향 없음 (공통 배수)
    skillCoefficient: 1,
  };
  return { build, deltas, notes, rates };
}

/**
 * 룬 세트 하나를 평가한다.
 *
 * scenario='expected' 는 밤의 축복 ON/OFF 두 상태를 각각 계산해 시간으로 가중평균한다.
 * 단순히 가동률 25%를 곱하지 않는 이유는, ON 구간이 공격력 +15% 와 최종 데미지 +40% 를
 * 달고 있어 타당 데미지가 훨씬 크기 때문이다. 그래서 ON 구간에서만 붙는 룬 옵션은
 * 시간 비중(25%)보다 큰 값어치를 가진다.
 */
export function evaluate(runeData, runeNames, scenario, profile) {
  const validity = validateRuneSet(runeNames);
  // 쿨감/속도처럼 데미지 공식 밖에서 DPS 를 올리는 효과. 타당 데미지가 아니라 DPS 배수라 점수에 곱한다.
  const utilityMultiplier = runeNames.reduce((m, n) => {
    const ov = profile.runeOverrides?.[n]?.utility;
    const v = Number.isFinite(ov) ? ov : (UTILITY_DAMAGE_EQUIVALENT[n] ?? UTILITY_DAMAGE_EQUIVALENT[baseName(n)])?.percent ?? 0;
    return m * (1 + v / 100);
  }, 1);
  const one = (nb) => {
    const { build, deltas, notes, rates } = buildFrom(runeData, runeNames, scenario, profile, nb);
    return { r: calculateDamage(build), deltas, notes, rates };
  };
  if (scenario === 'min') {
    const o = one('off');
    return { score: o.r.raw * utilityMultiplier, factors: o.r.factors, deltas: o.deltas, notes: o.notes, rates: o.rates, runeNames, validity, utilityMultiplier };
  }
  if (scenario === 'max') {
    const o = one('on');
    return { score: o.r.raw * utilityMultiplier, factors: o.r.factors, deltas: o.deltas, notes: o.notes, rates: o.rates, runeNames, validity, utilityMultiplier };
  }
  const on = one('on'), off = one('off');
  const { durationSeconds: D } = NIGHT_BLESSING;
  // 쿨이 아니라 '실제로 도는 주기' 로 나눈다. 트리거가 드문 직업은 이 값이 쿨보다 길다.
  // 사용자가 직접 잰 주기가 있으면 그것이 우선이다. 없으면 직업 표에서 계산한다.
  const C = profile.nightBlessingCycleSeconds > 0
    ? profile.nightBlessingCycleSeconds
    : nightBlessingCycleSeconds(profile.job, NIGHT_BLESSING.cooldownSeconds);
  const score = ((D * on.r.raw + (C - D) * off.r.raw) / C) * utilityMultiplier;
  return {
    score,
    factors: off.r.factors,
    factorsNightBlessing: on.r.factors,
    damageShareNightBlessing: (D * on.r.raw) / (D * on.r.raw + (C - D) * off.r.raw),
    deltas: off.deltas, notes: off.notes, rates: off.rates, runeNames, validity, utilityMultiplier,
  };
}

/** 여러 세트를 평가해 점수순으로 정렬한다. baseline 대비 배율도 함께 준다. */
export function compareRuneSets(runeData, sets, scenario, profile, baselineNames) {
  const baseline = baselineNames ? evaluate(runeData, baselineNames, scenario, profile).score : null;
  return sets
    .map((s) => {
      const names = Array.isArray(s) ? s : s.runes;
      const r = evaluate(runeData, names, scenario, profile);
      return { label: Array.isArray(s) ? names.join(' + ') : s.label, ...r, ratio: baseline ? r.score / baseline : null };
    })
    .sort((a, b) => b.score - a.score);
}

function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...rest] = arr;
  return [...combinations(rest, k - 1).map((c) => [head, ...c]), ...combinations(rest, k)];
}

/**
 * 보유 룬 중 최적 조합을 부위 제한에 맞춰 완전탐색한다.
 * @param {string[]} owned 보유 룬 이름
 * @param {object} opts.fixed 고정할 룬(무조건 착용). 예: 스킬 변형 장신구
 * @param {number} opts.top 반환 개수
 */
export function optimize(runeData, owned, scenario, profile, opts = {}) {
  const { fixed = [], top = 10, maxCombos = 500000 } = opts;
  const fixedSet = new Set(fixed.map(baseName));
  const bySlot = { 무기: [], 방어구: [], 장신구: [], 엠블럼: [] };
  for (const name of owned) {
    if (fixedSet.has(baseName(name))) continue;
    const rune = findRune(runeData, name);
    if (!rune) continue;
    if (bySlot[rune.slot]) bySlot[rune.slot].push(rune.name);
  }
  const fixedBySlot = {};
  for (const name of fixed) {
    const rune = findRune(runeData, name);
    if (rune) fixedBySlot[rune.slot] = (fixedBySlot[rune.slot] ?? 0) + 1;
  }

  const slots = Object.keys(SLOT_CAPACITY);
  const perSlot = slots.map((s) => {
    const remaining = Math.max(0, SLOT_CAPACITY[s] - (fixedBySlot[s] ?? 0));
    return combinations(bySlot[s], Math.min(remaining, bySlot[s].length));
  });

  const total = perSlot.reduce((n, c) => n * Math.max(1, c.length), 1);
  if (total > maxCombos) {
    throw new Error(`조합 수 ${total} 가 상한 ${maxCombos} 초과. 후보를 줄이거나 maxCombos 를 올려라.`);
  }

  const results = [];
  const walk = (i, acc) => {
    if (i === slots.length) {
      const names = [...fixed, ...acc];
      // 장착 규칙(용의 문장 2개, 각성 1개, 저주 1개)을 어기는 조합은 후보에서 뺀다.
      if (!validateRuneSet(names).valid) return;
      results.push({ names, score: evaluate(runeData, names, scenario, profile).score });
      return;
    }
    const choices = perSlot[i].length ? perSlot[i] : [[]];
    for (const c of choices) walk(i + 1, [...acc, ...c]);
  };
  walk(0, []);

  results.sort((a, b) => b.score - a.score);
  return { evaluated: results.length, top: results.slice(0, top) };
}
