// 직업 패시브 — 밤의 축복 구간에 겹치는 클래스 버프.
//
// 데이터는 data/jobs/*.json 으로 옮겼다. 이 파일에는 그 데이터를 해석하는 함수만 남는다.
// 수치를 고치려면 여기가 아니라 data/jobs/<직업>.json 을 고치고 `node tools/build-data.mjs` 를 돌려라.
//
// 밤의 축복 스킬 자체는 전 직업 공통이다(공격력 +15%, 15초, 재사용 60초).
// 직업마다 다른 것은 '무엇이 그 스킬을 발동시키는가' 이고, 그 트리거가 그 직업의
// 다른 버프와 같이 켜지면 15초 구간의 값어치가 크게 달라진다.
//
// effects 는 그 구간에만 얹히는 필드별 증분이다. 평상시에도 유지되는 직업 효과는
// alwaysOn 또는 classVariableEffects 로 계산하며 이 표에 중복해서 넣지 않는다.
//
// window 가 15초보다 짧은 버프는 (지속/15) 비율로 깎아 넣었다. 평가기가 ON 구간
// 전체에 같은 빌드를 적용하기 때문이고, 근사라는 것을 각 항목 note 에 적어 둔다.
//
// confidence:
//   'high'   — 툴팁 수치가 명확하고 지속시간이 밤의 축복 구간을 덮는다
//   'medium' — 수치는 있으나 조건·가동률에 해석이 들어갔다
//   'low'    — 간접 경로이거나 상한이 확인되지 않았다
export { CLASS_NIGHT_BLESSING, CLASS_JOB_INPUTS, CLASS_UPTIME_PASSIVES, CLASS_ALWAYS_ON } from './gen/jobs-data.mjs';

import { CLASS_NIGHT_BLESSING, CLASS_JOB_INPUTS, CLASS_UPTIME_PASSIVES, CLASS_ALWAYS_ON } from './gen/jobs-data.mjs';

/**
 * 밤의 축복이 실제로 도는 주기(초).
 *
 * 스킬 쿨은 60초지만 발동은 직업별 트리거가 와야 일어난다. 트리거 간격이 쿨보다 짧아도
 * 딱 나눠떨어지지 않으면 한 박자를 건너뛰게 되어 주기가 길어진다 —
 * 기사는 트리거가 45초마다라 60초 쿨을 45초에 못 맞추고 90초마다 발동한다.
 * 그만큼 밤의 축복 구간의 딜 비중이 줄어들고, 그 구간에만 붙는 룬의 값어치도 낮아진다.
 */
export function nightBlessingCycleSeconds(job, cooldownSeconds) {
  /* 실제로 도는 주기를 직접 적어둔 직업이 있으면 그것이 먼저다.
   * 아래 유도는 "트리거를 자연 간격에 맡긴다" 는 가정인데, 트리거를 당길 수단이 있으면
   * 그 가정이 깨진다 — 댄서는 앵콜·피날레로 템포를 당겨 60초 쿨에 맞출 수 있다.
   * 유도값(75초)과 실제(60초)가 다르면 밤축 구간 비중이 크게 어긋난다. */
  const fixed = CLASS_NIGHT_BLESSING[job]?.cycleSeconds;
  if (fixed > 0) return fixed;
  const iv = CLASS_NIGHT_BLESSING[job]?.triggerIntervalSeconds;
  if (!(iv > 0)) return cooldownSeconds;
  return Math.ceil(cooldownSeconds / iv) * iv;
}

/**
 * 밤의 축복이 기본 지속(15초)보다 얼마나 더 가는가. 늘려주는 스킬이 없으면 0.
 *
 * 댄서의 스포트라이트가 그런 스킬이다. 중요한 것은 **그 연장 구간에는 직업 버프가 없다**는
 * 점이다 — 템포 2단계는 기본 구간과 함께 끝나고, 앵콜 이후에는 다시 안 붙는다.
 * 그래서 평가기가 이 구간을 별도 상태로 센다.
 */
export function nightBlessingExtendedSeconds(job) {
  return CLASS_NIGHT_BLESSING[job]?.extendedSeconds ?? 0;
}

/* classNightBlessingEffects 는 지웠다. 평가기가 더는 직업 표를 계산에 쓰지 않는다 —
 * 각성 구간의 버프는 최종 데미지 한 자리로 고정하고 사람이 값을 넣는다.
 * 표(CLASS_NIGHT_BLESSING) 자체는 남아 있다. 주기 계산과, 그 직업에 무엇이 적혀 있는지를
 * 입력칸 설명에 보여주는 데 쓴다. */

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
export const jobInputs = (job) => CLASS_JOB_INPUTS[job] ?? [];

export const jobInputDefaults = (job) => Object.fromEntries(
  jobInputs(job).map((input) => [input.key, input.default ?? 0]),
);

export const uptimePassives = (job) => CLASS_UPTIME_PASSIVES[job] ?? [];

// 기존 호출부와 저장값 이주를 위한 단수형 별칭.
export const uptimePassive = (job) => uptimePassives(job)[0] ?? null;

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

/**
 * 스탯 하나로 고정할 수 없고 플레이 입력에 따라 달라지는 직업 효과.
 * 반환값은 다른 직업 효과와 같은 필드 경로를 사용한다.
 */
export function classVariableEffects(profile, nightBlessing = 'off') {
  const out = {};
  const add = (path, value) => { out[path] = (out[path] ?? 0) + value; };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

  // 전 직업 공통 시즌 패시브. 레벨 입력을 0으로 두면 계산하지 않는다.
  add('finalDamage.percent', clamp(profile.deepeningDarknessLevel, 0, 150) * 0.1);

  if (profile.job === '화염술사') {
    const normalRate = clamp(profile.fireStage3UptimePercent, 0, 100) / 100;
    // 인페르노 완료로 시작하는 밤의 축복 구간은 버닝 소울 3단계가 확정이다.
    const rate = nightBlessing === 'on' ? 1 : normalRate;
    const focusedFlame = Math.min(20, Math.max(0, Number(profile.skillPower) || 0) / 250);
    add('finalDamage.percent', (15 + focusedFlame) * rate);
  }

  if (profile.job === '힐러') {
    const stacks = clamp(profile.healerReviveAverageStacks, 0, 40);
    add('damageIncrease.itemMainDamagePercent', stacks * 1.5);
  }

  if (profile.job === '격투가') {
    const backStepShare = clamp(profile.fighterBackStepSkillSharePercent, 0, 100) / 100;
    const linkedShare = clamp(profile.fighterLinkedSkillSharePercent, 0, 100) / 100;
    add('damageIncrease.specificSkillDamagePercent', 50 * backStepShare + 5 * linkedShare);
  }

  if (profile.job === '전격술사') {
    add('damageIncrease.skillDamagePercent',
      clamp(profile.electricOverchargeAverageStacks, 0, 22) * 10);
  }

  if (profile.job === '댄서') {
    if (profile.dancerSingleTarget ?? true) add('finalDamage.percent', 15);
    const tempoRate = nightBlessing === 'on'
      ? 1
      : nightBlessing === 'extended'
        ? 0
        : clamp(profile.dancerTempoUptimePercent, 0, 100) / 100;
    const rapid = clamp(profile.rapidEnhance, 0, 5000);
    // 절묘한 박자감은 20%p를 더하는 효과가 아니라 템포 효과 자체를 상대적으로
    // 5% + 최대 15% 키운다. 따라서 최대일 때 1중첩은 20 × 1.2 = 24%다.
    const tempoPerStack = 20 * (1 + 0.05 + 0.15 * rapid / 5000);
    add('finalDamage.percent', 2 * tempoPerStack * tempoRate);
  }

  if (profile.job === '궁수') {
    add('finalDamage.percent',
      30 * clamp(profile.archerWeakPointAttackSharePercent, 0, 100) / 100);
  }

  if (profile.job === '사제') {
    const share = clamp(profile.priestSanctificationSkillSharePercent, 0, 100) / 100;
    const cost = clamp(profile.priestSanctificationAverageHolyPowerCost, 0, 100);
    add('finalDamage.percent', 0.8 * cost * share);
    if (profile.priestEnemyLinkEnabled ?? true) {
      add('damageIncrease.itemMainDamagePercent', 10);
      add('damageIncrease.receivedDamagePercent', 10);
    }
  }

  if (profile.job === '수도사') {
    add('finalDamage.percent',
      10 * clamp(profile.monkGuidanceMantraUptimePercent, 0, 100) / 100);
  }

  if (profile.job === '암흑술사') {
    add('finalDamage.percent',
      15 * clamp(profile.darkMageProphecyUptimePercent, 0, 100) / 100);
  }

  if (profile.job === '악사') {
    add('finalDamage.percent',
      clamp(profile.musicianCadenzaFinalDamageAverageStacks, 0, 3) * 5);
    add('attackIncrease.itemAttackPercent',
      clamp(profile.musicianCrescendoAverageAttackPercent, 0, 30));
  }

  if (profile.job === '기사') {
    // 지휘관은 상시 10%, 기사단의 서약 중 20%다. 중첩 불가(max) 경로에 단순히
    // 20×가동률을 넣으면 44% 가동 시 max(10, 8.8)=10이 되어 증분이 사라진다.
    const rate = nightBlessing === 'on'
      ? 1
      : clamp(profile.classPassiveUptimePercent, 0, 100) / 100;
    add('damageIncrease.synergyDamagePercent', 10 + 10 * rate);
    add('damageIncrease.receivedDamagePercent',
      10 * clamp(profile.knightShatterDebuffActivationPercent, 0, 100) / 100);
  }

  if (profile.job === '빙결술사') {
    add('damageIncrease.itemMainDamagePercent',
      Math.max(0, Number(profile.iceScatteredFrostAverageStacks) || 0) * 4);
    const rate = nightBlessing === 'on'
      ? 1
      : clamp(profile.iceSpikeUptimePercent, 0, 100) / 100;
    add('attackIncrease.itemAttackPercent', 20 * rate);
  }

  if (profile.job === '마법사') {
    add('damageIncrease.skillDamagePercent',
      clamp(profile.mageOverSurgeAverageStacks, 0, 50) * 0.2);
    add('attackIncrease.itemAttackPercent',
      clamp(profile.mageArcanePowerAverageElements, 0, 3) * 3);
  }

  if (profile.job === '장궁병') {
    const ultimateShare = clamp(profile.ultimateSkillSharePercent, 0, 100) / 100;
    add('damageIncrease.specificSkillDamagePercent', 30 * ultimateShare);
    const rate = clamp(profile.longbowSnipingUptimePercent, 0, 100) / 100;
    add('critical.runeCriticalRatePercent', 15 * rate);
    add('enhancement.heavyDamagePercent', 15 * rate);
  }

  if (profile.job === '대검전사') {
    const duration = clamp(profile.greatswordUltimateAttackBuffDurationSeconds, 0, 120);
    const fight = Math.max(1, Number(profile.fightSeconds) || 1);
    add('attackIncrease.itemAttackPercent', 50 * Math.min(1, duration / fight));
  }

  if (profile.job === '석궁사수') {
    const resourceSkillShare = clamp(profile.resourceSkillSharePercent, 0, 100) / 100;
    const drivingForceStacks = clamp(profile.crossbowDrivingForceAverageStacks, 0, 2);
    add('damageIncrease.specificSkillDamagePercent',
      30 * drivingForceStacks * resourceSkillShare);
  }

  return out;
}
