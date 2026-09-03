import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUNES } from '../src/runes-data.mjs';
import { buildFrom, evaluate, resolveRuneEffects } from '../src/build-evaluator.mjs';
import { sampleProfile } from './sample-profile.mjs';

test('화염술사 이그나이트 치명타 대미지 10%를 모든 세트의 기저에 넣는다', () => {
  const fire = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({ job: '화염술사' }));
  const other = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({ job: '마법사' }));

  assert.equal(fire.deltas['critical.criticalDamagePercent'], 10);
  assert.equal(other.deltas['critical.criticalDamagePercent'] ?? 0, 0);
});

test('화염술사 3단계는 스킬 위력과 평시 가동률을 반영하고 각성 구간에는 확정된다', () => {
  const profile = sampleProfile({ job: '화염술사', skillPower: 5000, fireStage3UptimePercent: 50 });
  const off = resolveRuneEffects(RUNES, [], 'expected', profile, 'off');
  const on = resolveRuneEffects(RUNES, [], 'expected', profile, 'on');
  assert.equal(off.deltas['finalDamage.percent'], 17.5);
  assert.equal(on.deltas['finalDamage.percent'], 35);
});

test('힐러는 상시 최종 대미지와 소생 평균 중첩을 따로 센다', () => {
  const effects = resolveRuneEffects(RUNES, [], 'expected',
    sampleProfile({ job: '힐러', healerReviveAverageStacks: 40 }));
  assert.equal(effects.deltas['finalDamage.percent'], 20);
  assert.equal(effects.deltas['damageIncrease.itemMainDamagePercent'], 60);
});

test('격투가는 백 스텝과 연계 공격을 각 딜 비중만큼 특정 스킬 피증으로 센다', () => {
  const effects = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '격투가', fighterBackStepSkillSharePercent: 40, fighterLinkedSkillSharePercent: 80,
  }));
  assert.equal(effects.deltas['damageIncrease.specificSkillDamagePercent'], 24);
});

test('파티 시너지와 적 받는 대미지 증가는 각각 가동률을 적용해 별도 항에 넣는다', () => {
  const { build } = buildFrom(RUNES, [], 'expected', sampleProfile({
    partySynergyDamagePercent: 20, partySynergyUptimePercent: 50,
    targetReceivedDamagePercent: 10, targetReceivedDamageUptimePercent: 40,
  }));
  assert.equal(build.damageIncrease.synergyDamagePercent, 10);
  assert.equal(build.damageIncrease.receivedDamagePercent, 4);
});

test('전격술사 과충전은 일반 주피증이 아니라 스킬 피해로 계산한다', () => {
  const effects = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '전격술사', electricOverchargeAverageStacks: 12,
  }));
  assert.equal(effects.deltas['damageIncrease.skillDamagePercent'], 120);
  assert.equal(effects.deltas['damageIncrease.itemMainDamagePercent'] ?? 0, 0);
});

test('댄서 클로즈드 포지션은 기본 10%에 단일 대상일 때만 15%를 더한다', () => {
  const multi = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '댄서', dancerSingleTarget: false, dancerTempoUptimePercent: 0,
  }));
  const single = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '댄서', dancerSingleTarget: true, dancerTempoUptimePercent: 0,
  }));
  assert.equal(multi.deltas['finalDamage.percent'], 10);
  assert.equal(single.deltas['finalDamage.percent'], 25);
});

test('궁수 약점 공격 비중은 약점 관통 최종 대미지 30%를 가중한다', () => {
  const effects = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '궁수', archerWeakPointAttackSharePercent: 40,
  }));
  assert.equal(effects.deltas['finalDamage.percent'], 12);
});

test('직업별 가동형 최종 대미지와 공통 시즌 레벨을 서로 더한다', () => {
  const priest = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '사제', priestSanctificationSkillSharePercent: 100,
    priestSanctificationAverageHolyPowerCost: 25, deepeningDarknessLevel: 100,
  }));
  const monk = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '수도사', monkGuidanceMantraUptimePercent: 50,
  }));
  const dark = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '암흑술사', darkMageProphecyUptimePercent: 40,
  }));
  const musician = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '악사', musicianCadenzaFinalDamageAverageStacks: 2,
  }));
  assert.equal(priest.deltas['finalDamage.percent'], 35); // 상시 5 + 신성력 20 + 시즌 10
  assert.equal(monk.deltas['finalDamage.percent'], 5);
  assert.equal(dark.deltas['finalDamage.percent'], 6);
  assert.equal(musician.deltas['finalDamage.percent'], 10);
});

test('댄서 템포는 기본 20%에 5%와 연타 강화 비례 최대 15%를 상대 증가로 적용한다', () => {
  const base = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '댄서', dancerSingleTarget: false, dancerTempoUptimePercent: 100, rapidEnhance: 0,
  }), 'off');
  const max = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '댄서', dancerSingleTarget: false, dancerTempoUptimePercent: 100, rapidEnhance: 5000,
  }), 'off');
  assert.equal(base.deltas['finalDamage.percent'], 52); // 클로즈드 10 + 21×2
  assert.equal(max.deltas['finalDamage.percent'], 58); // 클로즈드 10 + 24×2
});

test('직업별 전투 숙련 효과는 같은 숙련명이어도 실제 패시브를 따른다', () => {
  const guardian = (job) => resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job, combatMastery: '수호', dancerTempoUptimePercent: 0,
  })).deltas;
  assert.equal(guardian('전사')['break.vulnerabilityDamagePercent'], 3);
  assert.equal(guardian('기사')['enhancement.heavyDamagePercent'], 3);
  assert.equal(guardian('빙결술사')['enhancement.areaDamagePercent'], 3);

  const support = (job) => resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job, combatMastery: '지원', priestEnemyLinkEnabled: false,
  })).deltas;
  assert.equal(support('사제')['enhancement.heavyDamagePercent'], 3);
  assert.equal(support('음유시인')['enhancement.areaDamagePercent'], 3);
  assert.equal(support('힐러')['enhancement.rapidDamagePercent'], 3);
});

test('기타 보정은 공격력·주는 대미지·스킬 피해·최종 대미지 자리를 섞지 않는다', () => {
  const { build } = buildFrom(RUNES, [], 'expected', sampleProfile({
    job: '도적', nonRuneAttackPercent: 0, otherAttackPercent: 7, classMainDamagePercent: 11,
    skillDamagePercent: 13, classFinalDamagePercent: 17,
  }));
  assert.equal(build.attackIncrease.itemAttackPercent, 7);
  assert.equal(build.damageIncrease.itemMainDamagePercent, 11);
  assert.equal(build.damageIncrease.skillDamagePercent, 13);
  assert.equal(build.finalDamage.percent, 17);
});

test('직업 데이터의 시너지와 받피증은 사용자 보정과 중첩하지 않고 큰 값 하나만 쓴다', () => {
  const knight = buildFrom(RUNES, [], 'expected', sampleProfile({
    job: '기사', classPassiveUptimePercent: 100,
    partySynergyDamagePercent: 15,
  }), 'off');
  const longbow = buildFrom(RUNES, [], 'expected', sampleProfile({
    job: '장궁병', targetReceivedDamagePercent: 5,
    nightBlessingEffects: { 'damageIncrease.receivedDamagePercent': 10 },
  }), 'on');
  assert.equal(knight.build.damageIncrease.synergyDamagePercent, 20);
  assert.equal(longbow.build.damageIncrease.receivedDamagePercent, 10);
});

test('기사 지휘관은 상시 10%에서 서약 가동률만큼 20%로 올라간 평균을 쓴다', () => {
  const off = buildFrom(RUNES, [], 'expected', sampleProfile({
    job: '기사', classPassiveUptimePercent: 44,
  }), 'off');
  const on = buildFrom(RUNES, [], 'expected', sampleProfile({
    job: '기사', classPassiveUptimePercent: 44,
  }), 'on');
  assert.equal(off.build.damageIncrease.synergyDamagePercent, 14.4);
  assert.equal(on.build.damageIncrease.synergyDamagePercent, 20);
});

test('빙결술사 흩날리는 서리는 평균 중첩당 자기 주피증 4%로 계산한다', () => {
  const effects = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '빙결술사', iceScatteredFrostAverageStacks: 7.5,
  }));
  assert.equal(effects.deltas['damageIncrease.itemMainDamagePercent'], 30);
});

test('사제 적 링커 옵션은 켜면 자기 주피증 10%, 끄면 0이다', () => {
  const on = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '사제', priestEnemyLinkEnabled: true,
  }));
  const off = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '사제', priestEnemyLinkEnabled: false,
  }));
  assert.equal(on.deltas['damageIncrease.itemMainDamagePercent'], 10);
  assert.equal(on.deltas['damageIncrease.receivedDamagePercent'], 10);
  assert.equal(off.deltas['damageIncrease.itemMainDamagePercent'] ?? 0, 0);
  assert.equal(off.deltas['damageIncrease.receivedDamagePercent'] ?? 0, 0);
});

test('사제 성전은 세 스킬의 딜 비중과 평균 신성력 소모를 함께 반영한다', () => {
  const effects = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '사제', priestEnemyLinkEnabled: false, deepeningDarknessLevel: 0,
    priestSanctificationSkillSharePercent: 40,
    priestSanctificationAverageHolyPowerCost: 25,
  }));
  assert.equal(effects.deltas['finalDamage.percent'], 13); // 직업 상시5 + 25×0.8×40%
});

test('장궁병 궁극기 스킬 피해 30%는 궁극기 딜 비중만큼 계산한다', () => {
  const effects = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '장궁병', ultimateSkillSharePercent: 35,
  }));
  assert.equal(effects.deltas['damageIncrease.specificSkillDamagePercent'], 10.5);
});

test('장궁병 저격 자세와 쉘 브레이커를 밤의 축복 밖에서도 계산한다', () => {
  const effects = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '장궁병', longbowSnipingUptimePercent: 50,
  }), 'off');
  assert.equal(effects.deltas['critical.runeCriticalRatePercent'], 7.5);
  assert.equal(effects.deltas['enhancement.heavyDamagePercent'], 7.5);
  assert.equal(effects.deltas['damageIncrease.receivedDamagePercent'], 10);
});

test('석궁사수 드라이빙 포스는 평균 중첩과 스킬 자원 소모 딜 비중을 함께 반영한다', () => {
  const normal = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '석궁사수', resourceSkillSharePercent: 60,
    crossbowDrivingForceAverageStacks: 2,
  }), 'off');
  const awakening = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '석궁사수', resourceSkillSharePercent: 60,
    crossbowDrivingForceAverageStacks: 2,
  }), 'on');
  assert.equal(normal.deltas['damageIncrease.specificSkillDamagePercent'], 36);
  assert.equal(awakening.deltas['damageIncrease.specificSkillDamagePercent'], 36,
    '각성 구간의 옛 16% 근사를 중복해서 더하면 안 된다');
});

test('깊어지는 어둠과 직업 옵션 기본값이 맞다', async () => {
  const { DEFAULT_PROFILE } = await import('../src/default-profile.mjs');
  const { jobInputDefaults } = await import('../src/class-passives.mjs');
  const { BASIC_ATTACK_JOBS, JOB_DOTS } = await import('../src/gen/jobs-data.mjs');
  assert.equal(DEFAULT_PROFILE.deepeningDarknessLevel, 62);
  assert.equal(jobInputDefaults('댄서').dancerSingleTarget, true);
  assert.equal(jobInputDefaults('사제').priestEnemyLinkEnabled, true);
  assert.equal(jobInputDefaults('석궁사수').crossbowDrivingForceAverageStacks, 2);
  assert.equal(jobInputDefaults('장궁병').longbowSnipingUptimePercent, 100);
  assert.equal(jobInputDefaults('마법사').mageArcanePowerAverageElements, 3);
  assert.equal(jobInputDefaults('악사').musicianCadenzaFinalDamageAverageStacks, 3);
  assert.deepEqual(BASIC_ATTACK_JOBS.filter((job) => ['궁수', '도적', '듀얼블레이드'].includes(job)).sort(),
    ['궁수', '도적', '듀얼블레이드'].sort());
  assert.ok(JOB_DOTS['장궁병'].includes('상처'));
  assert.ok(JOB_DOTS['마법사'].includes('감전'));
  assert.ok(JOB_DOTS['전격술사'].includes('감전'));
});

test('마법사 오버 서지는 평균 중첩당 스킬 피해 0.2%, 최대 50중첩이다', () => {
  const normal = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '마법사', mageOverSurgeAverageStacks: 32,
  }));
  const capped = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '마법사', mageOverSurgeAverageStacks: 80,
  }));
  assert.equal(normal.deltas['damageIncrease.skillDamagePercent'], 6.4);
  assert.equal(capped.deltas['damageIncrease.skillDamagePercent'], 10);
});

test('확정 가능한 직업 버프·디버프는 각성 구간에 한정하지 않는다', () => {
  const mage = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '마법사', mageArcanePowerAverageElements: 3,
  }), 'off').deltas;
  assert.equal(mage['attackIncrease.itemAttackPercent'], 9);

  const monk = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({ job: '수도사' }), 'off').deltas;
  assert.equal(monk['attackIncrease.itemAttackPercent'], 10);
  assert.equal(monk['damageIncrease.skillDamagePercent'], 15);

  const bard = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({ job: '음유시인' }), 'off').deltas;
  assert.equal(bard['critical.runeCriticalRatePercent'], 9);
  assert.equal(bard['extraHit.runeExtraRatePercent'], 9);

  const warrior = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({ job: '전사' }), 'off').deltas;
  assert.equal(warrior['damageIncrease.synergyDamagePercent'], 10);
});

test('대검전사 궁극기 버프는 전투 중 총 지속시간만큼 평균한다', () => {
  const effects = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '대검전사', fightSeconds: 100, greatswordUltimateAttackBuffDurationSeconds: 10,
  })).deltas;
  assert.equal(effects['attackIncrease.itemAttackPercent'], 5);
});

test('기사 파쇄는 지속시간 대신 발동률로 받피증을 계산한다', () => {
  const effects = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '기사', knightShatterDebuffActivationPercent: 60,
  })).deltas;
  assert.equal(effects['damageIncrease.receivedDamagePercent'], 6);
});

test('악사 입력은 카덴차 평균 중첩 수와 크레센도 평균 공증을 뜻한다', () => {
  const effects = resolveRuneEffects(RUNES, [], 'expected', sampleProfile({
    job: '악사', musicianCadenzaFinalDamageAverageStacks: 3,
    musicianCrescendoAverageAttackPercent: 20,
  })).deltas;
  assert.equal(effects['finalDamage.percent'], 15);
  assert.equal(effects['attackIncrease.itemAttackPercent'], 20);
  assert.equal(effects['damageIncrease.receivedDamagePercent'], 10);
});

test('빙결술사 아이스 스파이크는 평상시 가동률과 각성 확정을 나눠 계산한다', () => {
  const p = sampleProfile({ job: '빙결술사', iceSpikeUptimePercent: 75 });
  assert.equal(resolveRuneEffects(RUNES, [], 'expected', p, 'off').deltas['attackIncrease.itemAttackPercent'], 15);
  assert.equal(resolveRuneEffects(RUNES, [], 'expected', p, 'on').deltas['attackIncrease.itemAttackPercent'], 20);
});

test('화염술사 고피증·오팔 기준에서는 계승자와 승전의 한계 효율이 낮아진다', () => {
  const profile = sampleProfile({
    job: '화염술사', classMainDamagePercent: 150,
    fireStage3UptimePercent: 50, fastSkill: 2000,
  });
  // 오팔 성배를 포함한 빛2·어둠2·용2 합법 세트. 방어구 한 칸을 비워 후보 하나를 더한다.
  const base = ['오팔 성배', '끓는 피', '공허', '돌 심장', '눈부신 잔영', '빛바랜 별'];
  const baseScore = evaluateScore(base, profile);
  const heirGain = evaluateScore([...base, '계승자'], profile) / baseScore - 1;
  const victoryGain = evaluateScore([...base, '승전'], profile) / baseScore - 1;

  assert.ok(heirGain < 0.10, `계승자 한계 효율 ${(heirGain * 100).toFixed(2)}%`);
  assert.ok(victoryGain < 0.17, `승전 한계 효율 ${(victoryGain * 100).toFixed(2)}%`);
});

function evaluateScore(runes, profile) {
  // 테스트에서는 추천 탐색이 아니라 같은 세팅에 룬 하나를 더했을 때의 한계 효율만 본다.
  return evaluate(RUNES, runes, 'expected', profile).score;
}
