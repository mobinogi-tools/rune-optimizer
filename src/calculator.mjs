export const EMPTY_DAMAGE_BUILD = Object.freeze({
  damageRoll: 1,
  skillCoefficient: 1,
  skillLevel: 0,
  baseSkillCoefficient: 1,
  useSkillLevelScaling: false,
  attack: {
    characterAttack: 0,
    weaponBaseAttack: 0,
    engravingAttack: 0,
    weaponSealAttack: 0,
    masteryBonusAttack: 0,
    weaponStatBonusDamage: 0,
    necklaceAttack: 0,
    necklaceSealAttack: 0,
    petAttack: 0,
    fashionSetAttack: 0,
    flatEnchantAttack: 0,
    runewordFlatAttack: 0,
    paladinJusticeAttack: 0,
    paladinJudgementAttack: 0,
    emblemPercent: 0,
  },
  attackIncrease: {
    itemAttackPercent: 0,
    skillAttackPercent: 0,
    enchantAttackPercent: 0,
    artifactAttackPercent: 0,
  },
  damageIncrease: {
    sweep: 0,
    skillDamagePercent: 0,
    helioPercent: 0,
    specificSkillDamagePercent: 0,
    itemMainDamagePercent: 0,
    crescendoPercent: 0,
    artifactMainDamagePercent: 0,
    synergyDamagePercent: 0,
    armorBreakPercent: 0,
    receivedDamagePercent: 0,
  },
  enhancement: {
    rapidEnhance: 0,
    rapidDamagePercent: 0,
    heavyEnhance: 0,
    heavyDamagePercent: 0,
    areaEnhance: 0,
    areaDamagePercent: 0,
    comboEnhance: 0,
    comboDamagePercent: 0,
    comboTier: 0,
    ultimateEnhance: 0,
    isRapid: false,
    isHeavy: false,
    isArea: false,
    isUltimate: false,
    // 발생률(%). null 이면 100%로 취급한다.
    rapidRatePercent: null,
    heavyRatePercent: null,
    areaRatePercent: null,
    ultimateRatePercent: null,
  },
  gem: { tagDamagePercent: 0 },
  critical: {
    mode: 'expected',
    criticalStat: 0,
    runeCriticalRatePercent: 0,
    characterCriticalRatePercent: 0,
    criticalRateBonusPercent: 0,
    criticalDamagePercent: 0,
    characterCriticalDamagePercent: 0,
  },
  break: {
    // 무방비(브레이크) 상태를 유효하게 볼지. false 면 G = 1 (무방비 관련 옵션이 전부 무효).
    // 기본값 true 는 출처 공식을 그대로 따른 것이다. 실제 무방비 시간 비율은 10% 미만이므로
    // 룬 비교 시에는 켜고/끄고 양쪽을 보는 것이 맞다.
    isVulnerable: true,
    // 전체 전투 중 무방비 상태가 실제로 차지하는 비중. 값을 안 주는 직접 호출은 예전처럼
    // 무방비 한 구간의 대미지를 계산하도록 100%가 기본이다.
    vulnerableUptimePercent: 100,
    breakStat: 0,
    vulnerabilityDamagePercent: 0,
    vulnerabilityBasePercent: 0,
    tagDamagePercent: 0,
    isBreakExploit: false,
  },
  skillDamageMultiplier: { percent: 0 },
  defense: {
    bossDefense: 0,
    defenseReductionPercent: 0,
    defenseIgnorePercent: 0,
  },
  counter: { isCounter: false },
  extraHit: {
    mode: 'expected',
    extraHitStat: 0,
    runeExtraRatePercent: 0,
    // 스탯/룬으로 설명되지 않는 추가타율 보정(직업 특성 등). 실측이 계산식보다 높게 나올 때 쓴다.
    characterExtraRatePercent: 0,
    extraDamagePercent: 0,
    fixedExtraDamagePercent: 0,
  },
  finalDamage: { percent: 0 },
});

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function bool(value) {
  return value === true || value === 'true' || value === 'on' || value === 1 || value === '1';
}

function percent(value) {
  return numberOrZero(value) / 100;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function deepMerge(base, input = {}) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object') {
      out[key] = deepMerge(base[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function mergeDamageBuild(input = {}) {
  return deepMerge(EMPTY_DAMAGE_BUILD, input);
}

export function scaledSkillCoefficient(build) {
  if (!bool(build.useSkillLevelScaling)) return numberOrZero(build.skillCoefficient || 1);
  const level = Math.max(0, numberOrZero(build.skillLevel));
  const thresholdBonus = [2, 10, 15, 20, 30].filter((threshold) => level >= threshold).length;
  return numberOrZero(build.baseSkillCoefficient || 1) * (1 + 0.03 * level + 0.02 * thresholdBonus);
}

export function calculateAttackA(input) {
  const build = mergeDamageBuild(input);
  const a = build.attack;
  const weaponTotal = (
    numberOrZero(a.weaponBaseAttack) +
    numberOrZero(a.engravingAttack) +
    numberOrZero(a.weaponSealAttack) +
    numberOrZero(a.masteryBonusAttack)
  ) * (1 + percent(a.emblemPercent)) + numberOrZero(a.weaponStatBonusDamage);

  const necklaceTotal = numberOrZero(a.necklaceAttack) + numberOrZero(a.necklaceSealAttack);

  return weaponTotal + necklaceTotal +
    numberOrZero(a.characterAttack) +
    numberOrZero(a.petAttack) +
    numberOrZero(a.fashionSetAttack) +
    numberOrZero(a.flatEnchantAttack) +
    numberOrZero(a.runewordFlatAttack) +
    numberOrZero(a.paladinJusticeAttack) +
    numberOrZero(a.paladinJudgementAttack);
}

export function calculateAttackB(input) {
  const b = mergeDamageBuild(input).attackIncrease;
  return 1 + percent(b.itemAttackPercent) + percent(b.skillAttackPercent) + percent(b.enchantAttackPercent) + percent(b.artifactAttackPercent);
}

// sweep = 스탯창의 "스킬 위력" 수치. (출처 공식이 '스윕'으로 줄여 표기한 것)
export function calculateDamageC(input) {
  const c = mergeDamageBuild(input).damageIncrease;
  const main = (1 + numberOrZero(c.sweep) / 8500) * (1 + percent(c.skillDamagePercent)) +
    percent(c.helioPercent) + percent(c.specificSkillDamagePercent) + percent(c.itemMainDamagePercent) +
    percent(c.crescendoPercent) + percent(c.artifactMainDamagePercent) + percent(c.synergyDamagePercent);
  const received = 1 + percent(c.armorBreakPercent) + percent(c.receivedDamagePercent);
  return main * received;
}

// 연타/강타/광역은 매 타 발생하지 않을 수 있다. *RatePercent 로 발생률을 주면 기대값으로 가중한다.
//
// 이 셋은 '판정' 이고, 각 판정의 피해를 키우는 스탯이 따로 있다. 연타·강타는 판정 이름과
// 스탯 이름이 같지만 광역만 다르다 — 판정 이름은 '멀티히트'(동시 2명 이상 적중 시 발동),
// 그 피해를 키우는 스탯이 '광역 강화' 다. 그래서 areaRatePercent 는 멀티히트가 뜨는 비율이고
// areaEnhance/areaDamagePercent 는 광역 쪽 수치다. (공식 가이드 '데미지 판정' 문서 기준)
// 값을 주지 않으면 100%(항상 발생)로 취급하므로 기존 동작은 그대로다.
//
// **세 발동률은 서로 독립이고, 합이 100%를 넘어도 정상이다.** 한 타격이 연타이면서 동시에
// 강타일 수 있기 때문이다(사용자 확인, 2026-08-08). 실제 세팅에서 연타 99% + 강타 88% 처럼
// 합이 187%가 나오는 것은 오류가 아니다.
//
// 그러니 합을 100%로 정규화하거나 서로 배타로 만들지 마라. 얼핏 "확률의 합이 1을 넘는다"는
// 버그처럼 보이지만, 그렇게 고치면 강화 수치의 기여가 통째로 줄어들어 모든 추천이 조용히
// 바뀐다. 골든 점수가 깨지는 것으로만 드러나고, 왜 깨졌는지는 안 보인다.
// (tests/calculator.test.mjs 가 이 성질을 못박고 있다.)
function enhancementWeight(isOn, ratePercent) {
  if (!bool(isOn)) return 0;
  if (ratePercent === undefined || ratePercent === null || ratePercent === '') return 1;
  return clamp(numberOrZero(ratePercent) / 100, 0, 1);
}

export function calculateEnhancementD(input) {
  const e = mergeDamageBuild(input).enhancement;
  const rapid = enhancementWeight(e.isRapid, e.rapidRatePercent) *
    ((1 + numberOrZero(e.rapidEnhance) / 8500) * (1 + percent(e.rapidDamagePercent)) - 1);
  const heavy = enhancementWeight(e.isHeavy, e.heavyRatePercent) *
    ((1 + numberOrZero(e.heavyEnhance) / 8500) * (1 + percent(e.heavyDamagePercent)) - 1);
  const area = enhancementWeight(e.isArea, e.areaRatePercent) *
    ((1 + numberOrZero(e.areaEnhance) / 8500) * (1 + percent(e.areaDamagePercent)) - 1);
  const comboWeight = clamp(numberOrZero(e.comboTier), 0, 4) / 4;
  const combo = comboWeight * ((1 + numberOrZero(e.comboEnhance) / 17500) * (1 + percent(e.comboDamagePercent)) - 1);
  const ultimate = enhancementWeight(e.isUltimate, e.ultimateRatePercent) *
    numberOrZero(e.ultimateEnhance) / 8750;
  return 1 + rapid + heavy + area + combo + ultimate;
}

export function calculateCriticalF(input) {
  const c = mergeDamageBuild(input).critical;
  if (c.mode === 'normal') return 1;
  const criticalMultiplier = (1.4 + numberOrZero(c.criticalStat) / 5000) *
    (1 + percent(c.criticalDamagePercent) + percent(c.characterCriticalDamagePercent));
  if (c.mode === 'critical') return criticalMultiplier;
  const criticalRate = clamp(
    0.5 - 1 / (2 + numberOrZero(c.criticalStat) / 1000) +
    percent(c.runeCriticalRatePercent) + percent(c.characterCriticalRatePercent) + percent(c.criticalRateBonusPercent),
    0,
    1,
  );
  return 1 + criticalRate * (criticalMultiplier - 1);
}

export function calculateBreakG(input) {
  const g = mergeDamageBuild(input).break;
  if (!bool(g.isVulnerable)) return 1;
  const base = (1 + numberOrZero(g.breakStat) / 5250) * (1 + percent(g.vulnerabilityDamagePercent));
  const vulnerabilityBonus = percent(g.vulnerabilityBasePercent) + percent(g.tagDamagePercent);
  // 브레이크 익스텐드는 기본 무방비 20%와 태그 대미지 증가 합만 1.5배로 만든다.
  const exploitMultiplier = bool(g.isBreakExploit) ? 1.5 : 1;
  const vulnerable = base + vulnerabilityBonus * exploitMultiplier;
  const uptime = clamp(percent(g.vulnerableUptimePercent), 0, 1);
  return 1 + uptime * (vulnerable - 1);
}

export function calculateDefenseI(input) {
  const d = mergeDamageBuild(input).defense;
  const reduction = clamp(percent(d.defenseReductionPercent) + percent(d.defenseIgnorePercent), 0, 1);
  return 1 / (1 + numberOrZero(d.bossDefense) * (1 - reduction) / 14828);
}

export function calculateExtraHitK(input) {
  const k = mergeDamageBuild(input).extraHit;
  if (k.mode === 'damage') return 1;
  // 캐릭터 추가타확률% 는 룬추확% 와 같은 괄호 안에서 가산한다.
  // (치명타 공식에서 캐릭크확증% 가 룬치확% 와 같은 가산 그룹에 있는 것과 동일한 구조)
  const extraRate = (1 + numberOrZero(k.extraHitStat) / 13000) *
    (1 + percent(k.runeExtraRatePercent) + percent(k.characterExtraRatePercent)) - 1;
  const extraRatePart = extraRate * (1 + percent(k.extraDamagePercent));
  return 1 + extraRatePart + percent(k.fixedExtraDamagePercent);
}

export function calculateDamage(input) {
  const build = mergeDamageBuild(input);
  const A = calculateAttackA(build);
  const B = calculateAttackB(build);
  const statAttack = Math.floor(A * B);
  const C = calculateDamageC(build);
  const D = calculateEnhancementD(build);
  const E = 1 + percent(build.gem.tagDamagePercent);
  const F = calculateCriticalF(build);
  const G = calculateBreakG(build);
  const H = 1 + percent(build.skillDamageMultiplier.percent);
  const I = calculateDefenseI(build);
  const J = bool(build.counter.isCounter) ? 1.1 : 1;
  const K = calculateExtraHitK(build);
  // 마도저항은 일부러 뺐다. 잊은 것이 아니다.
  //
  // 원문(26.07.19 업뎃)에 L항으로 들어가 있고 식은 이렇다:
  //   미달: 0.5 ^ (부족값 / 1000)
  //   초과: 1 + 0.4 × (1 - 0.5 ^ (초과값 / 10000))
  // 미달이 크면 1000마다 반토막이라 절대 대미지에는 아주 큰 항이다.
  //
  // 그런데 이 도구는 **룬 조합의 순위**를 매긴다. 룬·아티팩트·직업 데이터 어디에도
  // 마도저항을 주는 항목이 없어(전수 확인), 어떤 조합을 껴도 이 값은 안 변한다.
  // 모든 후보에 똑같이 곱해지는 상수는 비율에서 약분되므로 순위를 바꾸지 못한다.
  //
  // 넣으려면 '보스별 요구 마도저항'과 '내 마도저항' 두 입력이 필요한데, 콘텐츠마다 다르고
  // 원문도 적용 범위(마법 공격 전용인지, 어느 직업인지)를 안 적어놨다. 순위를 안 바꾸는
  // 항에 근거 없는 입력 두 칸을 늘리는 것은 손해다. 마도저항을 주는 룬이 생기면 그때
  // 얘기가 달라진다 — 그때는 상수가 아니게 되므로 반드시 넣어야 한다.
  const L = 1 + percent(build.finalDamage.percent);
  const skillCoefficient = scaledSkillCoefficient(build);
  const damageRoll = clamp(numberOrZero(build.damageRoll || 1), 0.95, 1.05);
  const raw = 2 * damageRoll * statAttack * C * D * E * F * G * H * I * J * K * L * skillCoefficient;
  return {
    total: Math.ceil(raw),
    raw,
    factors: { A, B, statAttack, C, D, E, F, G, H, I, J, K, L, skillCoefficient, damageRoll },
    normalizedBuild: build,
  };
}

export function parseSharedBuild(text) {
  return mergeDamageBuild(JSON.parse(text));
}

export function stringifySharedBuild(build) {
  return JSON.stringify(mergeDamageBuild(build), null, 2);
}
