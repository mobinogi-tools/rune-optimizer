import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAttackA,
  calculateAttackB,
  calculateCriticalF,
  calculateDamage,
  calculateEnhancementD,
  calculateExtraHitK,
  calculateBreakG,
  parseSharedBuild,
  stringifySharedBuild,
} from '../src/calculator.mjs';

test('A attack includes weapon emblem before flat weapon stat bonus', () => {
  const build = {
    attack: {
      characterAttack: 1000,
      weaponBaseAttack: 2000,
      engravingAttack: 100,
      weaponSealAttack: 50,
      masteryBonusAttack: 50,
      emblemPercent: 10,
      weaponStatBonusDamage: 300,
      necklaceAttack: 100,
      petAttack: 200,
    },
  };
  assert.equal(calculateAttackA(build), 4020);
});

test('B attack increase floors stat-window attack', () => {
  const result = calculateDamage({
    damageRoll: 1,
    skillCoefficient: 1,
    attack: { characterAttack: 1000 },
    attackIncrease: { itemAttackPercent: 20, skillAttackPercent: 5.5 },
  });
  assert.equal(calculateAttackB(result.normalizedBuild), 1.255);
  assert.equal(result.factors.statAttack, 1255);
});

test('normal/critical/expected critical modes differ predictably', () => {
  const base = { critical: { criticalStat: 1000, criticalDamagePercent: 20 } };
  assert.equal(calculateCriticalF({ critical: { ...base.critical, mode: 'normal' } }), 1);
  assert.ok(Math.abs(calculateCriticalF({ critical: { ...base.critical, mode: 'critical' } }) - 1.92) < 1e-12);
  const expected = calculateCriticalF({ critical: { ...base.critical, mode: 'expected' } });
  assert.ok(expected > 1);
  assert.ok(expected < 1.92);
});

test('damage follows ceil(2 * roll * floor(A*B) * factors * skill coefficient)', () => {
  const result = calculateDamage({
    damageRoll: 1,
    skillCoefficient: 2,
    attack: { characterAttack: 1000 },
    critical: { mode: 'normal' },
    break: {},
  });
  assert.equal(result.total, 4000);
});

test('share format round trips through JSON with nested defaults', () => {
  const shared = stringifySharedBuild({ attack: { characterAttack: 1498 }, defense: { bossDefense: 6410 } });
  const parsed = parseSharedBuild(shared);
  assert.equal(parsed.attack.characterAttack, 1498);
  assert.equal(parsed.defense.bossDefense, 6410);
  assert.equal(parsed.critical.mode, 'expected');
});

test('enhancement rate weights D by occurrence probability', () => {
  const base = { enhancement: { rapidEnhance: 8500, isRapid: true } };
  // 발생률 미지정 = 100%: (1 + 8500/8500) - 1 = 1 → D = 2
  assert.equal(calculateEnhancementD(base), 2);
  // 발생률 50%: 1 + 0.5*1 = 1.5
  assert.equal(calculateEnhancementD({ enhancement: { ...base.enhancement, rapidRatePercent: 50 } }), 1.5);
  // 발생률 0%: 효과 없음
  assert.equal(calculateEnhancementD({ enhancement: { ...base.enhancement, rapidRatePercent: 0 } }), 1);
  // isRapid=false 면 발생률과 무관하게 0 기여
  assert.equal(calculateEnhancementD({ enhancement: { ...base.enhancement, isRapid: false, rapidRatePercent: 100 } }), 1);
});

test('궁극기 강화는 /8750 공식을 궁극기 딜 비중만큼 가중한다', () => {
  const D = (share) => calculateEnhancementD({ enhancement: {
    ultimateEnhance: 8750, isUltimate: share > 0, ultimateRatePercent: share,
  }});
  assert.equal(D(0), 1);
  assert.equal(D(50), 1.5);
  assert.equal(D(100), 2);
  assert.equal(D(150), 2, '궁극기 비중도 항 자체에서 100%로 잘려야 한다');
});

test('character extra-hit bonus is added inside the rune-rate parenthesis', () => {
  const base = { extraHit: { extraHitStat: 13000 } };            // (1+1)*(1+0)-1 = 1.0
  assert.equal(calculateExtraHitK(base), 2);
  // 캐릭터 보정은 룬추확%와 같은 괄호 안: (1+1)*(1+0.08)-1 = 1.16
  assert.ok(Math.abs(calculateExtraHitK({
    extraHit: { ...base.extraHit, characterExtraRatePercent: 8 },
  }) - 2.16) < 1e-12);
  // 룬추확%와 캐릭터 보정은 서로 가산: (1+1)*(1+0.10+0.08)-1 = 1.36
  assert.ok(Math.abs(calculateExtraHitK({
    extraHit: { ...base.extraHit, runeExtraRatePercent: 10, characterExtraRatePercent: 8 },
  }) - 2.36) < 1e-12);
  // 추가타 피해%는 확률 전체에 곱해진다: 1.16 * 1.5 = 1.74
  assert.ok(Math.abs(calculateExtraHitK({
    extraHit: { ...base.extraHit, characterExtraRatePercent: 8, extraDamagePercent: 50 },
  }) - 2.74) < 1e-12);
});

test('isVulnerable=false collapses the break factor to 1', () => {
  const g = { break: { breakStat: 2600, vulnerabilityDamagePercent: 31 } };
  assert.ok(calculateBreakG({ break: { ...g.break, isVulnerable: true } }) > 1.9);
  assert.equal(calculateBreakG({ break: { ...g.break, isVulnerable: false } }), 1);
  // 기본값은 출처 공식대로 유효 취급
  assert.ok(calculateBreakG(g) > 1.9);
});

// ── 발동률은 서로 독립이다 ────────────────────────────────
// 한 타격이 연타이면서 동시에 강타일 수 있다(사용자 확인, 2026-08-08). 그래서 세 발동률의
// 합은 100%를 넘을 수 있고, 그게 정상이다.
//
// 이 테스트가 있는 이유: "확률의 합이 1을 넘는다" 는 얼핏 버그로 보여서, 합을 정규화하거나
// 서로 배타로 만드는 '수정'이 들어오기 쉽다. 그러면 강화 기여가 통째로 줄어 모든 추천이
// 조용히 바뀌는데, 골든 점수가 깨지는 것으로만 드러나고 원인은 안 보인다.
test('세 발동률은 합이 100%를 넘어도 각자 전액 기여한다 — 정규화하면 안 된다', () => {
  const D = (over) => calculateEnhancementD({ enhancement: {
    rapidEnhance: 8500, heavyEnhance: 8500, areaEnhance: 8500,
    isRapid: true, isHeavy: true, isArea: true, ...over,
  }});
  // 강화 8500 = 각 항이 정확히 1.0 을 더한다. 셋 다 100%면 D = 1 + 1 + 1 + 1 = 4.
  assert.equal(D({ rapidRatePercent: 100, heavyRatePercent: 100, areaRatePercent: 100 }), 4,
    '합 300% 를 100% 로 눌렀다면 이 값이 2 로 나온다');
  // 합이 187% 인 실제 세팅 모양도 각자 제 몫만큼 들어간다.
  assert.equal(
    Number(D({ rapidRatePercent: 99, heavyRatePercent: 88, areaRatePercent: 0 }).toFixed(4)),
    Number((1 + 0.99 + 0.88).toFixed(4)));
});

test('발동률은 항별로만 잘린다 — 0~100% 밖의 값은 그 항에서 막힌다', () => {
  const D = (rate) => calculateEnhancementD({ enhancement: {
    rapidEnhance: 8500, isRapid: true, rapidRatePercent: rate,
  }});
  assert.equal(D(150), 2, '항 하나가 100% 를 넘으면 그 항에서 잘려야 한다');
  assert.equal(D(-10), 1, '음수 발동률은 0 으로 잘려야 한다');
});
