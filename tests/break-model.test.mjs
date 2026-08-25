import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateBreakG } from '../src/calculator.mjs';
import {
  periodicWindowSeconds, breakCount, vulnerableUptime, resolveRuneEffects, buildFrom,
} from '../src/build-evaluator.mjs';
import { RUNES } from '../src/runes-data.mjs';
import { sampleProfile } from './sample-profile.mjs';

test('첫 브레이크는 주기가 지난 뒤 시작하고 전투 끝의 꼬리를 자른다', () => {
  assert.equal(periodicWindowSeconds(120, 60, 10), 10);
  assert.equal(periodicWindowSeconds(65, 60, 10), 5);
  assert.equal(breakCount({ fightSeconds: 120, breakCycleSeconds: 60 }), 2);
  assert.equal(vulnerableUptime({ fightSeconds: 120, breakCycleSeconds: 60,
    vulnerableDurationSeconds: 10 }), 1 / 12);
});

test('지속이 주기보다 길면 겹친 무방비 시간을 두 번 세지 않는다', () => {
  assert.equal(periodicWindowSeconds(35, 10, 15), 25);
});

test('G항은 무방비 시간만큼 평균하고 브레이크 익스텐드는 가산부를 1.5배 한다', () => {
  const normal = calculateBreakG({ break: {
    isVulnerable: true, vulnerableUptimePercent: 25,
    vulnerabilityBasePercent: 20, tagDamagePercent: 20,
  } });
  const extended = calculateBreakG({ break: {
    isVulnerable: true, vulnerableUptimePercent: 25,
    vulnerabilityBasePercent: 20, tagDamagePercent: 20, isBreakExploit: true,
  } });
  assert.equal(normal, 1.1);
  assert.equal(extended, 1.15);
});

test('칼바람은 브레이크 스킬 딜 비중과 평균 쿨타임을 각각 계산한다', () => {
  const profile = sampleProfile({ assumeVulnerable: true, breakSkillSharePercent: 40,
    breakSkillCooldownSeconds: 14 });
  const { deltas } = resolveRuneEffects(RUNES, ['칼바람'], 'expected', profile, 'off');
  assert.equal(deltas['damageIncrease.specificSkillDamagePercent'], 11.6);
  assert.equal(deltas['critical.criticalDamagePercent'], 5);
});

test('서광은 브레이크 익스텐드 직업에서만 브레이크 시작 구간만큼 켜진다', () => {
  const common = { assumeVulnerable: true, fightSeconds: 120, breakCycleSeconds: 60 };
  const dancer = resolveRuneEffects(RUNES, ['서광'], 'expected',
    sampleProfile({ ...common, job: '댄서' }), 'off').deltas;
  const warrior = resolveRuneEffects(RUNES, ['서광'], 'expected',
    sampleProfile({ ...common, job: '전사' }), 'off').deltas;
  assert.equal(dancer['damageIncrease.itemMainDamagePercent'] ?? 0, 0);
  assert.ok(Math.abs(warrior['damageIncrease.itemMainDamagePercent'] - 20 / 12) < 1e-12);
});

test('외부 방어구 파괴가 있으면 룬의 같은 효과와 중복되지 않는다', () => {
  const common = { assumeVulnerable: true, fightSeconds: 120, breakCycleSeconds: 60 };
  const on = buildFrom(RUNES, ['등대지기'], 'expected',
    sampleProfile({ ...common, externalArmorBreak: true }), 'off').build;
  const off = buildFrom(RUNES, ['등대지기'], 'expected',
    sampleProfile({ ...common, externalArmorBreak: false }), 'off').build;
  assert.equal(on.damageIncrease.armorBreakPercent, 10);
  assert.ok(Math.abs(off.damageIncrease.armorBreakPercent - 10 / 12) < 1e-12);
});
