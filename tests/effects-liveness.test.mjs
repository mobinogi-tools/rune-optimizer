// effects 경로 생존성 테스트.
//
// 화이트리스트(data/effect-fields.json)는 "이 경로를 써도 된다"는 약속이다.
// 그런데 화이트리스트에 있어도 평가기가 그 경로를 안 읽으면 값은 조용히 버려진다 —
// 오타와 증상이 똑같고, 오히려 더 오래 안 들킨다(오타는 언젠가 눈에 띄지만
// "배선이 빠진 경로" 는 아무도 의심하지 않는다).
//
// 그래서 문서상 유효가 아니라 **실제로 점수를 움직이는지** 를 단언한다.
// 각 경로에 값을 넣고 점수가 달라지지 않으면 그 경로는 죽은 것이다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/build-evaluator.mjs';
import { sampleProfile } from './sample-profile.mjs';
import { EFFECT_PATHS, EFFECT_FIELDS } from '../src/gen/effect-fields.mjs';
import {
  ARTIFACTS, artifactMax, overColorLimit, attackBearingSlots, ARTIFACT_SLOTS, sumArtifacts,
  artifactRequirementMet,
} from '../src/artifacts-data.mjs';
import { PROFILE_TEMPLATE } from '../src/build-evaluator.mjs';

// 룬 하나짜리 합성 데이터. alwaysOnExtra 가 임의 경로를 deltas 로 흘려보내는 통로다
// (resolveRuneEffects 가 Object.entries 로 그대로 add 한다).
const probeData = (extra) => ({
  items: [{
    name: '테스트 룬', slot: '무기', grade: '전설', desc: '',
    alwaysOnAttackPercent: 0, alwaysOnDamagePercent: 0,
    alwaysOnExtra: extra, conditionalRaw: [], uncountedEffects: [],
  }],
});

// 모든 항이 0이면 곱셈 구조상 변화가 안 보이는 경로가 생긴다(예: 무방비 피해는
// 무방비를 가정해야 살아나고, 콤보 피해는 콤보 비중이 있어야 한다). 각 항이 깨어 있는
// 프로필로 잰다. 발동률만 주고 isRapid/isHeavy/isArea 는 주지 않는다 —
// 그 파생은 buildFrom 이 하므로, 여기서 안 줘도 살아 있어야 정상이다.
// DEFAULT_PROFILE 은 이제 빈 양식이라 여기 쓰면 발동률이 0 이 되고, 연타·강타 강화가
// D 항에 아예 안 들어가 그 경로들이 '죽은 것' 으로 잡힌다. 직업 샘플을 얹어 재야 한다.
const PROFILE = sampleProfile({
  job: '궁수',
  assumeVulnerable: true,
  externalArmorBreak: false,
  areaRatePercent: 50,
  comboTier: 3,
  isUltimate: true,
});

const scoreWith = (extra) => evaluate(probeData(extra), ['테스트 룬'], 'expected', PROFILE).score;

test('기준 점수가 유한한 값이다', () => {
  const base = scoreWith({});
  assert.ok(Number.isFinite(base) && base > 0, `기준 점수가 이상하다: ${base}`);
});

test('화이트리스트의 모든 경로가 실제로 점수를 움직인다', () => {
  const base = scoreWith({});
  const dead = [];
  for (const path of EFFECT_PATHS) {
    if (scoreWith({ [path]: 10 }) === base) dead.push(path);
  }
  assert.deepEqual(dead, [],
    `계산에 배선되지 않은 경로가 있다 — 데이터가 이 경로를 써도 값이 버려진다:\n` +
    dead.map((p) => `  ${p} (${EFFECT_FIELDS[p].label})`).join('\n'));
});

test('화이트리스트에 없는 경로는 점수를 못 움직인다 — 오타가 조용히 죽는다는 증거', () => {
  const base = scoreWith({});
  assert.equal(scoreWith({ 'finalDamge.percent': 10 }), base,
    '오타 경로가 점수를 바꿨다면 이 테스트의 전제가 틀린 것이다');
});

// ── 아티팩트 → 프로필 매핑 누락 ──────────────────────────
//
// 아티팩트의 effects 는 rune-app 이 artifactXxxPercent 라는 이름의 프로필 필드로 옮겨
// 평가기에 넘긴다. 이 매핑은 손으로 관리해서, 아티팩트에 새 경로가 생기면 조용히 빠진다.
// 실제로 '연격'(콤보 피해 2%)이 그렇게 빠져 있었다.

// 경로 → 프로필 필드. 여기 없으면 그 아티팩트 효과는 계산에 못 들어간다.
const ARTIFACT_FIELD = {
  'damageIncrease.itemMainDamagePercent': 'artifactDamagePercent',
  'critical.runeCriticalRatePercent': 'artifactCriticalRatePercent',
  'extraHit.runeExtraRatePercent': 'artifactExtraRatePercent',
  'enhancement.rapidDamagePercent': 'artifactRapidDamagePercent',
  'enhancement.heavyDamagePercent': 'artifactHeavyDamagePercent',
  'enhancement.areaDamagePercent': 'artifactAreaDamagePercent',
  'enhancement.comboDamagePercent': 'artifactComboDamagePercent',
  'break.vulnerabilityDamagePercent': 'artifactVulnerabilityPercent',
};
// 의도적으로 매핑하지 않는 것 — 측정(룬 외 공증)에 이미 포함돼 있어 또 넣으면 이중 계산이다.
const COVERED_BY_MEASUREMENT = new Set(['attackIncrease.itemAttackPercent']);

test('아티팩트가 쓰는 모든 경로가 프로필 필드로 이어져 있다', () => {
  const used = new Set(ARTIFACTS.flatMap((a) => Object.keys(a.effects ?? {})));
  const unmapped = [...used].filter((p) => !ARTIFACT_FIELD[p] && !COVERED_BY_MEASUREMENT.has(p));
  assert.deepEqual(unmapped, [],
    `아티팩트가 선언하는데 프로필로 옮겨지지 않는 경로 — 그 효과는 계산에서 버려진다:\n  ${unmapped.join('\n  ')}`);
});

test('매핑이 가리키는 프로필 필드가 실제로 존재한다', () => {
  const missing = Object.values(ARTIFACT_FIELD).filter((f) => !(f in PROFILE_TEMPLATE));
  assert.deepEqual(missing, [], `PROFILE_TEMPLATE 에 없는 필드: ${missing.join(', ')}`);
});

// ── 아티팩트 장착 규칙 ────────────────────────────────────
// 황금은 1개 제한인데, 이걸 코드가 모르면 황금 하나로 슬롯 5개를 채울 수 있다.
// 화면에서만 막으면 저장분을 손으로 고치거나 옛 저장분이 남았을 때 그대로 통과한다.
test('황금은 1개까지만 낄 수 있다', () => {
  const gold = ARTIFACTS.filter((a) => a.color === '황금');
  assert.ok(gold.length >= 2, '황금이 2개 미만이면 이 테스트가 아무것도 검사하지 않는다');
  for (const a of gold) assert.equal(artifactMax(a), 1, `${a.name} 의 상한이 1이 아니다`);
});

test('색깔 제한 초과를 집어낸다 — 화면 경고의 근거다', () => {
  const gold = ARTIFACTS.filter((a) => a.color === '황금');
  assert.deepEqual(overColorLimit({ [gold[0].name]: 1 }), [], '1개는 정상인데 걸렸다');
  const over = overColorLimit({ [gold[0].name]: 1, [gold[1].name]: 1 });
  assert.equal(over.length, 1, '황금 2개가 안 잡혔다');
  assert.equal(over[0].color, '황금');
  assert.equal(over[0].count, 2);
});

test('마력은 무색 2개 조건을 만족할 때 캐스팅·차지 딜 비중으로 계산된다', () => {
  const magic = ARTIFACTS.find((a) => a.name === '마력');
  assert.ok(magic?.skillTypeBonuses?.length, '마력의 스킬 한정 효과가 구조화되지 않았다');
  assert.equal(artifactRequirementMet(magic, { 마력: 1 }), false, '무색 1개인데 조건이 열렸다');
  assert.equal(sumArtifacts({ 마력: 1 }, { castingChargeSkillSharePercent: 100 })
    ['damageIncrease.specificSkillDamagePercent'] ?? 0, 0);

  const active = { 마력: 1, 순수: 1 };
  assert.equal(artifactRequirementMet(magic, active), true);
  assert.equal(sumArtifacts(active, { castingChargeSkillSharePercent: 50 })
    ['damageIncrease.specificSkillDamagePercent'], 1.5);
  assert.equal(sumArtifacts({ 마력: 2 }, { castingChargeSkillSharePercent: 100 })
    ['damageIncrease.specificSkillDamagePercent'], 6, '중첩 가능 2개면 3%가 두 번 들어가야 한다');
});

test('황금의 고유효과는 전부 상시 계산에서 빠져 있다 — 변신 중에만 켜지기 때문', () => {
  // 하나라도 effects 가 붙으면 "변신 가동률과 무관하게 항상 들어간다"는 뜻이 된다.
  // 가동률 모델이 생기기 전까지는 여기 걸려야 맞다.
  for (const a of ARTIFACTS.filter((x) => x.color === '황금')) {
    assert.ok(!a.effects,
      `${a.name} 에 effects 가 붙었다. 변신 가동률을 모델에 넣은 게 아니라면 상시로 계산된다`);
    assert.ok(a.conditional || a.uncounted,
      `${a.name} 이 왜 0 인지 화면이 설명할 수 없다 — conditional 이나 uncounted 가 필요하다`);
  }
});

// 황금 칸은 기본 깡공을 안 준다(실측). 이걸 모르면 '빈 칸 손해' 표시가 황금 낀 사람에게만
// 낙관적으로 나오고, 화면에는 아무 신호가 없다.
test('황금 칸은 깡공을 주는 칸으로 세지 않는다', () => {
  const gold = ARTIFACTS.find((a) => a.color === '황금');
  const normal = ARTIFACTS.find((a) => a.color !== '황금' && a.color !== '은색');
  assert.equal(attackBearingSlots({ [gold.name]: 1 }), 0, '황금이 깡공 칸으로 세어졌다');
  assert.equal(attackBearingSlots({ [normal.name]: 1 }), 1);
  // 황금 1 + 일반 4 는 개수로는 만석이지만 깡공은 4칸분이다.
  const four = ARTIFACTS.filter((a) => a.color !== '황금' && a.color !== '은색').slice(0, 4);
  const set = Object.fromEntries(four.map((a) => [a.name, 1]));
  assert.equal(attackBearingSlots({ ...set, [gold.name]: 1 }), 4,
    '만석이어도 황금이 있으면 깡공 칸은 하나 모자라야 한다');
  assert.ok(ARTIFACT_SLOTS - attackBearingSlots({ ...set, [gold.name]: 1 }) === 1,
    '손해로 세어질 칸이 1개여야 한다');
});

/* 중첩불가 경로 — 같은 효과를 주는 룬을 여러 개 껴도 안 쌓인다.
 *
 * 그냥 더하면 방어구 파괴가 20%, 30% 가 되어 **오류 없이 과대평가된다.**
 * 화면에도 아무 신호가 없고 순위만 조용히 틀어진다. 그래서 합이 아니라 최대값인지를
 * 못박는다. 어느 경로가 그런지는 data/effect-fields.json 의 stack 이 정한다. */
test('stack: max 인 경로는 더하지 않고 가장 큰 값만 쓴다', () => {
  const maxPaths = EFFECT_PATHS.filter((p) => EFFECT_FIELDS[p].stack === 'max');
  assert.ok(maxPaths.length > 0, 'stack: max 경로가 하나도 없다 — 이 테스트가 아무것도 안 지키고 있다');

  for (const path of maxPaths) {
    const one = evaluate(probeData({ [path]: 10 }), ['테스트 룬'], 'expected', PROFILE);
    const two = evaluate(
      { items: [
        { ...probeData({ [path]: 10 }).items[0], name: '테스트 룬' },
        { ...probeData({ [path]: 10 }).items[0], name: '테스트 룬2' },
      ] },
      ['테스트 룬', '테스트 룬2'], 'expected', PROFILE,
    );
    assert.equal(two.deltas[path], one.deltas[path],
      `${path} 가 두 룬에서 쌓였다 (${one.deltas[path]} → ${two.deltas[path]}). 합산되면 과대평가된다.`);
  }
});

test('stack 이 없는 경로는 그대로 더해진다 — max 가 전부에 걸리면 안 된다', () => {
  const path = 'attackIncrease.itemAttackPercent';
  assert.notEqual(EFFECT_FIELDS[path].stack, 'max', '이 테스트는 합산 경로로 재야 의미가 있다');
  const two = evaluate(
    { items: [
      { ...probeData({ [path]: 10 }).items[0], name: '테스트 룬' },
      { ...probeData({ [path]: 10 }).items[0], name: '테스트 룬2' },
    ] },
    ['테스트 룬', '테스트 룬2'], 'expected', PROFILE,
  );
  assert.equal(two.deltas[path], 20, '합산 경로가 max 로 잘못 처리되고 있다');
});
