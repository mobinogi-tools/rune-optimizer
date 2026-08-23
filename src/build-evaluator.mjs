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
  COOLDOWN_RUNES,
  transcendEmblemUptime,
  erosionExpected,
  erosionWindowUptime,
  streakStackExpected,
  familyCounts,
  distinctFamilies,
  formlessBranch,
  dotsFromRunes,
  roleShares,
  TAUNT_MASTERY,
  killStepValue,
  fightWindowUptime,
  stackRampAverage,
  DOT_TYPES,
  EROSION_RUNES,
} from './rune-conditionals.mjs';
import { masteryEffects } from './combat-mastery.mjs';
import { DUAL_WIELD_JOBS } from './gen/jobs-data.mjs';
import {
  uptimePassive, classAlwaysOnEffects, nightBlessingCycleSeconds, nightBlessingExtendedSeconds,
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
  /* 특정 스킬에만 붙는 효과를, 그 스킬이 내 딜에서 차지하는 비중만큼만 반영한다.
   * 「스킬 자원을 소모하는 스킬로 주는 피해 38%」 같은 것 — 그 스킬이 딜의 40% 면 15.2%.
   * 비중은 사람이 넣는다(직업마다 기본값이 있다). 확률이 아니라 **플레이 방식**이다. */
  skillShare: Object.freeze(['shareField', 'max']),
  /* 「주위에서 적 N명 처치 시」 계단. 확률이 아니라 **어떤 콘텐츠를 도느냐**가 정한다 —
   * 보스만 잡는 판이면 0 이고 잡몹 방을 지나왔으면 꼭대기다. 사람이 캐릭터 화면에서 고른다. */
  killSteps: Object.freeze(['thresholds', 'steps']),
  /* 「전투 시작 시 N초 동안」. 판이 길수록 그 창이 차지하는 비중이 줄어든다. */
  fightWindow: Object.freeze(['windowSeconds', 'max']),
  /* 전투 시간에 따라 차오르는 중첩의 평균. stacks 와 달리 쌓는 행위가 아니라 **시간**이
   * 쌓고, 시작 중첩이 0 이 아닐 수 있다(신기루는 전투 시작 시 5중첩). */
  stackRamp: Object.freeze(['startStacks', 'maxStacks', 'secondsPerStack', 'perStack']),
  /* 파티에서 무엇을 하는가로 갈리는 배타적 갈래(도발 / 치유 / 둘 다 아님).
   * 켜고 끄는 게이트가 아니라 시간 비중이라 수식 자리에 있다 — 둘 다 하는 직업이 있어서다. */
  roleShare: Object.freeze(['role', 'max']),
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
  // 스킬 자원을 소모하는 스킬이 내 딜에서 차지하는 비중(%). 그 직업에만 뜬다.
  resourceSkillSharePercent: 0,
  /* 쿨감 룬(햇살+·공허)이 최종 데미지로 얼마나 값어치가 있는지(%). 세트에 하나라도 있으면
   * 한 번만 붙는다. 기본 0 — 근거 없는 숫자를 기본으로 깔지 않는다. */
  cooldownRuneDamagePercent: 0,

  // 룬 외 공증. 측정으로 채운다(스탯창 두 번 읽기).
  nonRuneAttackPercent: 0,
  /* 룬 외 피증. **입력칸이 없고 늘 0 이다.** 아는 피증 출처는 전부 자기 경로가 따로 있고
   * (헬리오도르·아티팩트·직업 버프·룬), 남는 출처를 아무도 못 댔다. 이름을 댈 수 있는
   * 것이 생기면 그때 rune-app 의 EXTRA_FIELDS 에 칸을 되살려라 — 배선은 여기 그대로다. */
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
  /* 각성(밤의 축복) 15초 구간에 겹치는 직업 버프. { 필드경로: % } 맵이다.
   *
   * **자리를 바꾸지 않는다.** 한때 이걸 최종 데미지 한 칸으로 합치려 했는데 틀린 길이었다 —
   * 전격술사의 피증 100% 를 최종 데미지로 옮기려면 자기 B 값을 알아야 하고, 그건 아무도
   * 못 한다. 실제로 그렇게 바꿨다가 전격술사의 밤축 구간 데미지가 41.5% 날아갔다.
   *
   * 원래 문제는 자리가 여럿인 것이 아니라 **틀렸을 때 고칠 수가 없다는 것**이었다.
   * 예전에는 표 전체에 곱하는 배율 하나뿐이라, 두 칸 중 하나만 고치거나 표에 없는 자리를
   * 더할 방법이 없었다. 그래서 자리는 그대로 두고 **칸마다 사람이 고치게** 한다.
   *
   * 기본값은 직업 표(CLASS_NIGHT_BLESSING)가 준다. 직업을 바꾸면 그 직업 표로 되돌아간다. */
  nightBlessingEffects: Object.freeze({}),
  /* 각성 구간 버프를 계산에 넣을지. 숫자를 하나씩 지웠다 넣었다 하는 것보다,
   * 통째로 끄고 켜는 것이 먼저 필요한 결정이다 — 기본값을 못 믿겠으면 그냥 끄면 된다. */
  useNightBlessingBuff: true,
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

  /* 내가 적에게 상시로 걸고 있는 지속 피해(도트) 종류. { 화상: true, … } 8칸.
   *
   * 직업이 기본값을 준다(댄서는 전환 룬으로 화상·빙결이 상시). 여기에 더해, 세트에
   * 부여 룬이 있으면 그 도트는 자동으로 켜진 것으로 본다 — 룬을 끼고도 체크를 또 해야
   * 한다면 물어볼 필요가 없는 것을 묻는 것이다. 둘은 OR 로 합쳐진다.
   *
   * 예전에는 이 축이 아예 없어서 광채+·암운+ 의 기대값에 최대치를 박아 두었고,
   * 그래서 도트를 하나도 안 거는 직업에서도 상시로 잡혔다. */
  dotTypes: Object.freeze({}),
  /* 아군을 치유하는가. 직업이 기본값을 준다 — 지원 숙련 넷에 기사·악사를 더한 목록이다.
   * 도발은 여기 없다. 전투 숙련(수호)이 그대로 말해주므로 물어볼 필요가 없다. */
  heals: false,
  /* 「주위에서 적 N명 처치 시」 룬들이 보는 처치 수. 콘텐츠가 정하는 값이라 직업 기본값이
   * 없다 — 잡몹 방을 지나 보스를 잡는 것이 흔해서 꼭대기(20)를 기본으로 둔다. */
  killCount: 20,
  /* 한 판을 몇 초로 볼 것인가. 「전투 시작 시 N초」 버프와 시간으로 차오르는 중첩이
   * 여기서 갈린다. 직업이 아니라 콘텐츠가 정한다. */
  fightSeconds: 120,
});

/** 화면에서 고를 수 있는 기준 전투 시간(초). 슬라이더의 눈금이자 검증기의 허용값이다. */
export const FIGHT_SECONDS_CHOICES = Object.freeze([15, 30, 60, 120, 180]);
/** 「적 N명 처치」 눈금. 룬 데이터의 thresholds 와 짝이 맞아야 뜻이 있다. */
export const KILL_COUNT_CHOICES = Object.freeze([0, 5, 10, 20]);

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
  /* 각성 구간에 겹치는 직업 버프. 자리마다 그대로 얹는다 — 여기서 자리를 합치면
   * 공증과 최종 데미지가 같은 것이 되어 계산이 통째로 틀린다. */
  if (nightBlessing === 'on' && (profile.useNightBlessingBuff ?? true)) {
    for (const [path, v] of Object.entries(profile.nightBlessingEffects ?? {})) add(deltas, path, v);
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

  /* 파티에서 무엇을 하고 있는가. 도발은 전투 숙련이 그대로 말해준다. */
  const shares = roleShares({ taunts: profile.combatMastery === TAUNT_MASTERY, heals: !!profile.heals });

  /* 지금 적에게 깔려 있는 도트 = 사람이 켠 것(직업 기본값) ∪ 세트가 스스로 남기는 것. */
  const activeDots = new Set([
    ...Object.entries(profile.dotTypes ?? {}).filter(([, on]) => on).map(([t]) => t),
    ...dotsFromRunes(runeNames),
  ]);

  /* 「이 상황에 얼마나 있느냐」를 사람이 직접 넣는 항목의 배율(0~1).
   *
   * 값(12%)이 아니라 비율(30%)을 받는 이유는, 값을 물으면 천장이 얼마인지 알아야
   * 답할 수 있기 때문이다. 비율은 "마력의 원 위에 얼마나 서 있나" 하나만 물으면 된다.
   *
   * min·max 에는 걸지 않는다 — min 은 '안 터짐'이고 max 는 '이 룬의 천장'이라
   * 사람의 플레이 방식과 무관해야 한다. 다른 조건부와 같은 규칙이다. */
  const rateOf = (name, e) => {
    if (!e.rateAdjustable) return 1;
    const ov = profile.runeOverrides?.[name]?.rate?.[e.id] ??
      profile.runeOverrides?.[baseName(name)]?.rate?.[e.id];
    return Math.min(1, Math.max(0, (Number.isFinite(ov) ? ov : 100) / 100));
  };

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
        /* 지속 피해 게이트. 적힌 종류 중 **하나라도** 깔려 있으면 열린다(툴팁이 나열형이다).
         * 무방비와 같은 성격이라 같은 자리에 둔다 — 조건이 아니면 최대 시나리오에서도
         * 켜질 수 없으므로 항목을 통째로 뺀다. */
        if (e.requiresDot && !e.requiresDot.some((t) => activeDots.has(t))) continue;
        // 치유 게이트. 비늘 덮인 현자처럼 "치유하면 상시, 안 하면 0" 인 룬이 쓴다.
        // 배타적 갈래(사슬로 묶은 법전)는 이쪽이 아니라 roleShare 수식으로 간다.
        if (e.requiresHeal && !profile.heals) continue;
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
  /* 특정 스킬 한정 효과. 천장은 툴팁 값이고, 실제로 들어가는 것은 그 스킬의 딜 비중만큼이다.
   * min 은 0(그 스킬을 안 씀), max 는 천장(전부 그 스킬)이라 시나리오를 탄다. */
  const skillShareValue = (e) =>
    (e.max ?? 0) * Math.min(100, Math.max(0, profile[e.shareField] ?? 0)) / 100;

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
      // 천장은 계열 표가 있으면 그것이(작열), 없으면 max 가 정한다(백금 천칭).
      const ceiling = e.expectedFrom === 'familySteps' ? familyStepValue(e) : (e.max ?? 0);
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
    if (e.expectedFrom === 'skillShare') {
      const v = scenario === 'min' ? (e.min ?? 0)
        : scenario === 'max' ? (e.max ?? 0)
        : Number.isFinite(ov) ? ov
        : skillShareValue(e);
      add(deltas, e.field, v);
      return;
    }
    if (e.expectedFrom === 'erosionWindow') {
      if (erosionCount <= 0) return;
      const v = scenario === 'min' ? (e.min ?? 0)
        : scenario === 'max' ? (e.max ?? 0)
        : Number.isFinite(ov) ? ov
        : (e.max ?? 0) * erosionWindowUptime(pollutionReduction, erosionCount);
      add(deltas, e.field, v);
      return;
    }

    if (scenario === 'min') { add(deltas, e.field, e.min ?? 0); return; }
    if (scenario === 'max') { add(deltas, e.field, e.max ?? 0); return; }
    const value = Number.isFinite(ov) ? ov
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
      : e.expectedFrom === 'killSteps'
        ? killStepValue(e.thresholds, e.steps, profile.killCount ?? 0)
      : e.expectedFrom === 'fightWindow'
        ? (e.max ?? 0) * fightWindowUptime(e.windowSeconds, profile.fightSeconds)
      : e.expectedFrom === 'stackRamp'
        ? e.perStack * stackRampAverage(e, profile.fightSeconds)
      : e.expectedFrom === 'roleShare'
        ? (e.max ?? 0) * (shares[e.role] ?? 0)
      : (e.expected ?? 0);
    add(deltas, e.field, value * rateOf(name, e));
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
/** 이 세트에 쿨감 룬이 하나라도 있는가. 몇 개인지는 묻지 않는다 — 아래 참고. */
export function hasCooldownRune(runeNames) {
  return runeNames.some((n) => COOLDOWN_RUNES[n] || COOLDOWN_RUNES[baseName(n)]);
}

/**
 * 쿨감 룬이 최종 데미지에 얹는 몫(%). **세트에 하나라도 있으면 한 번만** 붙는다.
 *
 * 쿨감은 데미지 공식 밖에서 DPS 를 올린다. 얼마나 올리는지는 룬이 아니라 **그 사람이
 * 어떻게 도는가**가 정하므로, 값을 룬 데이터가 아니라 프로필에 둔다
 * (`cooldownRuneDamagePercent`, 전투 상황 칸). 기본값은 0 이다 — 모르는 값을 기본으로
 * 깔면 남의 숫자인 줄 모르고 믿는다.
 *
 * **개수를 안 세는 이유.** 두 룬의 단위가 다르다 — 햇살+ 는 비율(쿨 회복 속도 15%)이고
 * 공허는 '스킬 8회마다 3초' 라 절대 시간이라 시전 속도에 딸린다. 공통 단위로 바꾸려면
 * 스킬 쿨 분포가 필요한데 직업마다 다르고 이 저장소에 없다. 그래서 둘째 룬의 몫은
 * 0 으로 둔다 — 모르는 것을 0 으로 두는 쪽이 위로 틀리지 않는다.
 * (예전에는 룬마다 곱해서 15%% 둘이 1.15×1.15=1.32 가 됐다. 쿨감은 그렇게 안 겹친다.)
 *
 * 최종 데미지(L항)로 흘리므로 「왜 이 점수인가」 항별 분해에 그대로 보인다.
 */
export function cooldownRuneContribution(runeNames, profile = {}) {
  if (!hasCooldownRune(runeNames)) return 0;
  const v = profile.cooldownRuneDamagePercent;
  return Number.isFinite(v) ? v : 0;
}

/**
 * 룬별 「유틸 보정」의 합(%). 계산에 안 들어가는 효과를 사람이 최종 데미지로 환산한 값이다.
 *
 * 쿨감 룬 둘과 성격이 다르다 — 이쪽은 **룬마다** 다른 효과(이동 속도·회복량·자원 등)를
 * 그 사람이 값으로 매기는 자리라, 룬 수만큼 있는 것이 맞다. 30개 넘는 룬이 대상이다.
 * 대신 **더한다.** 예전에는 룬마다 `(1 + v/100)` 을 곱해서 여럿 끼면 곱으로 불어났다.
 *
 * 쿨감 룬(햇살+·공허)은 여기서 뺀다. 그 둘은 세트 단위 칸(cooldownRuneDamagePercent)이
 * 따로 있어서, 안 빼면 같은 값이 두 번 더해진다.
 */
/**
 * 이 세트가 **데미지 공식 밖에서** 얻는 DPS 몫의 합(%). 쿨감 룬 칸 + 룬별 유틸 보정.
 *
 * **점수에 곱한다. L(최종 데미지) 항에 넣지 않는다.** 한때 L 로 흘렸는데 틀린 자리였다 —
 * L 은 가산 항이라 밤의 축복의 최종 데미지 40% 와 섞이고, 그러면 20% 를 넣어도 실제
 * 기여가 17.8% 가 된다(댄서 기준). 쿨감은 그 구간만이 아니라 판 전체를 빠르게 돌리는
 * 것이라 곱이 맞다. 「공증 30% 와 최종 데미지 30% 는 같은 수가 아니다」 와 같은 자리다.
 *
 * 곱이라서 항별 분해 표에는 안 뜬다. 그래서 화면이 이 값을 따로 한 줄로 보여준다.
 */
export function setUtilityPercent(runeNames, profile = {}) {
  return cooldownRuneContribution(runeNames, profile) + utilityCorrectionPercent(runeNames, profile);
}

export function utilityCorrectionPercent(runeNames, profile = {}) {
  return runeNames.reduce((sum, n) => {
    if (COOLDOWN_RUNES[n] || COOLDOWN_RUNES[baseName(n)]) return sum;
    const ov = profile.runeOverrides?.[n]?.utility ?? profile.runeOverrides?.[baseName(n)]?.utility;
    return sum + (Number.isFinite(ov) ? ov : 0);
  }, 0);
}

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
      /* 특정 스킬에만 붙는 피증. C 항에서 템주피증과 같은 자리에 더해지지만 이름을 따로 둔다 —
       * 값이 이미 '내 딜에서 그 스킬이 차지하는 비중' 으로 깎여 들어온 것이라, 나중에 이 줄을
       * 보는 사람이 템주피증과 같은 뜻으로 읽으면 두 번 깎게 된다. */
      specificSkillDamagePercent: d('damageIncrease.specificSkillDamagePercent'),
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
      // 직업 버프는 위에서 deltas 에 얹었다(배율 적용 포함). 여기서 또 더하지 않는다.
      percent: d('finalDamage.percent'),
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
/**
 * 밤의 축복이 **실제로 도는 주기**(초). 쿨이 아니다 — 트리거가 드문 직업은 쿨보다 길다.
 * 사용자가 직접 잰 값이 있으면 그것이 우선이고, 없으면 직업 표에서 계산한다.
 *
 * **지속보다 짧을 수는 없다.** 주기가 지속보다 짧다는 것은 버프가 안 끊긴다는 뜻이므로
 * 주기 = 지속으로 본다. 이 하한이 없으면 `evaluate` 의 OFF 구간 가중치 `C − D − E` 가
 * 음수가 되고, 음수 × OFF 점수가 빠지면서 점수가 위로 샌다 — 주기 10 이면 expected 가
 * max 를 넘고 1 이면 7.5배가 된다. 에러는 안 나고 밤축 룬만 조용히 과대평가된다.
 *
 * 주기 칸은 사람이 직접 넣는 값이고 입력에 하한이 없어(숫자로 읽어 그대로 담는다)
 * 오타 하나로 닿는다. 그래서 방어를 계산 쪽에 둔다.
 *
 * 화면도 이 값을 써야 한다. 같은 규칙을 패널마다 따로 두면 갈라진다 — 실제로 상세창의
 * 「밤의 축복 주기 · 시간 비중」이 클램프 없는 사본을 쓰고 있어서 비중 150% 를 그렸다.
 */
export function effectiveNightBlessingCycle(profile, job = profile.job) {
  const raw = profile.nightBlessingCycleSeconds > 0
    ? profile.nightBlessingCycleSeconds
    : nightBlessingCycleSeconds(job, NIGHT_BLESSING.cooldownSeconds);
  return Math.max(raw, NIGHT_BLESSING.durationSeconds);
}

export function evaluate(runeData, runeNames, scenario, profile) {
  const validity = validateRuneSet(runeNames);
  const utilityPercent = setUtilityPercent(runeNames, profile);
  const utilityMultiplier = 1 + utilityPercent / 100;
  const one = (nb, p = profile) => {
    const { build, deltas, notes, rates } = buildFrom(runeData, runeNames, scenario, p, nb);
    return { r: calculateDamage(build), deltas, notes, rates };
  };
  if (scenario === 'min') {
    const o = one('off');
    return { score: o.r.raw * utilityMultiplier, factors: o.r.factors, deltas: o.deltas, notes: o.notes, rates: o.rates, runeNames, validity, utilityPercent };
  }
  if (scenario === 'max') {
    const o = one('on');
    return { score: o.r.raw * utilityMultiplier, factors: o.r.factors, deltas: o.deltas, notes: o.notes, rates: o.rates, runeNames, validity, utilityPercent };
  }
  const on = one('on'), off = one('off');
  const { durationSeconds: D } = NIGHT_BLESSING;
  const C = effectiveNightBlessingCycle(profile);

  /* 늘어난 구간은 **세 번째 상태**다.
   *
   * 밤의 축복을 늘려주는 직업 스킬이 있으면(댄서의 스포트라이트) 그 몇 초 동안은
   * 밤의 축복 자체(공증 +15%)와 그것을 트리거로 쓰는 룬 옵션은 켜져 있지만,
   * **직업 버프는 없다** — 템포 2단계는 기본 구간과 함께 끝난다.
   *
   * 이걸 ON 으로 뭉뚱그리면 40% 를 5초 더 주는 셈이 되어 밤축 룬이 과대평가되고,
   * OFF 로 뭉뚱그리면 공증 15% 와 밤축 룬 옵션을 통째로 놓친다. 둘 다 조용히 틀린다.
   *
   * 주기보다 길게 잡히는 일은 없어야 한다 — 음수 구간이 생기면 점수가 거꾸로 샌다. */
  const E = Math.max(0, Math.min(nightBlessingExtendedSeconds(profile.job), Math.max(0, C - D)));
  const extRaw = E > 0 ? one('on', { ...profile, nightBlessingEffects: {} }).r.raw : 0;

  const nbRaw = D * on.r.raw + E * extRaw;
  const score = ((nbRaw + (C - D - E) * off.r.raw) / C) * utilityMultiplier;
  return {
    score,
    factors: off.r.factors,
    factorsNightBlessing: on.r.factors,
    damageShareNightBlessing: nbRaw / (nbRaw + (C - D - E) * off.r.raw),
    nightBlessingSeconds: D + E,
    deltas: off.deltas, notes: off.notes, rates: off.rates, runeNames, validity, utilityPercent,
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

