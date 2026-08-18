// 측정 — 스탯창 두 번 읽어 깡공(A)과 룬 외 공증을 가른다.
//
// 이 산수는 오래 DOM 안에 있어서 검사할 수 없었다. 그동안 여기서 나온 사고가 셋이다:
// 초월한 룬을 기준으로 잡으면 값이 어긋났고, 나머지 룬 공증을 착용 목록에서 빼오는 바람에
// 목록이 실제와 다르면 룬 외 공증이 조용히 틀어졌고, 음수가 되면 멀쩡한 측정이 풀렸다.
//
// 실패가 조용한 자리다 — 틀린 룬 외 공증은 에러를 내지 않고 그럴듯한 점수를 만든다.
// 그래서 '정답을 아는 캐릭터'를 만들어 되돌아오는지 본다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveMeasurement, measurementPrecision, artifactsChanged } from '../src/measure.mjs';
import { migrateMeasureToPairs } from '../src/save-migrations.mjs';
import { RUNES } from '../src/runes-data.mjs';

/** 정답을 아는 캐릭터. 스탯창 = A × (1 + (공증룬 + 룬외)/100) */
const A참 = 40000, X참 = 25;
const 스탯창 = (룬) => Math.floor(A참 * (1 + (룬 + X참) / 100));

test('두 번 읽으면 깡공과 룬 외 공증이 그대로 복원된다', () => {
  for (const [r1, r2] of [[47, 31], [47, 0], [62, 47], [30, 14]]) {
    const r = solveMeasurement({ attack: 스탯창(r1), runePercent: r1 }, { attack: 스탯창(r2), runePercent: r2 });
    assert.ok(r.ok, `${r1}% / ${r2}% 조합이 풀리지 않았다: ${r.error}`);
    assert.ok(Math.abs(r.attackA - A참) < 5, `깡공 ${r.attackA} (참 ${A참})`);
    assert.ok(Math.abs(r.nonRunePercent - X참) < 0.05, `룬 외 ${r.nonRunePercent} (참 ${X참})`);
  }
});

/* 착용 목록도 룬 데이터 조회도 안 쓴다는 것이 이 방식의 요점이다. 초월한 룬을 껴도
 * 사용자가 게임에 뜨는 %를 그대로 더하면 되므로 데이터와 어긋날 일이 없다. */
test('초월해서 데이터값과 다른 %를 넣어도 그대로 성립한다', () => {
  const 초월합 = 47 + 5; // 어떤 룬이 데이터보다 5%p 높다
  const r = solveMeasurement({ attack: 스탯창(초월합), runePercent: 초월합 }, { attack: 스탯창(31), runePercent: 31 });
  assert.ok(r.ok);
  assert.ok(Math.abs(r.nonRunePercent - X참) < 0.05, `룬 외 ${r.nonRunePercent}`);
});

test('공증합이 같은 두 읽기는 거절한다 — 0으로 나누는 자리다', () => {
  const r = solveMeasurement({ attack: 60000, runePercent: 40 }, { attack: 58000, runePercent: 40 });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'same-percent');
});

test('공증이 큰 쪽의 공격력이 더 작으면 거절한다 — 두 줄이 뒤바뀐 경우다', () => {
  const r = solveMeasurement({ attack: 50000, runePercent: 47 }, { attack: 60000, runePercent: 31 });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'direction');
});

/* 룬 외 공증이 음수면 물리적으로 불가능하다 — 인챈트가 공증을 깎지는 않는다.
 * 조건부 공증을 합에 더했을 때 실제로 이렇게 된다. */
test('룬 외 공증이 음수로 나오면 거절하고 이유를 말한다', () => {
  const r = solveMeasurement({ attack: 스탯창(47), runePercent: 90 }, { attack: 스탯창(31), runePercent: 74 });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'negative-nonrune');
  assert.match(r.detail, /음수/);
});

test('입력이 덜 찼으면 에러가 아니라 조용히 비운다 — 타이핑 중에 빨간 글씨가 뜨면 안 된다', () => {
  assert.equal(solveMeasurement({ attack: 60000, runePercent: 40 }, { attack: null, runePercent: null }).error, 'incomplete');
});

/* "정확히 재세요" 는 무엇을 하라는 말인지 알 수 없다. 공증 차이를 키우라고 말하려면
 * 얼마나 흔들리는지를 수치로 보여줘야 한다. */
test('공증 차이가 작을수록 깡공 오차가 커진다', () => {
  assert.ok(measurementPrecision(1).attackError > measurementPrecision(30).attackError * 10);
  assert.equal(measurementPrecision(2).weak, true);
  assert.equal(measurementPrecision(16).weak, false);
});

// ── 이행 ────────────────────────────────────────────────
const pctOf = (n) => RUNES.items.find((r) => r.name === n)?.alwaysOnAttackPercent ?? 0;

/** 옛 저장분 하나와, 옛 코드가 그 값으로 내놓던 룬 외 공증을 함께 만든다. */
function 옛측정({ equipped, ref, p, current, removedAttack }) {
  const list = [...new Set([...equipped, ref])];
  const r1 = list.reduce((s, n) => s + (n === ref ? p : pctOf(n)), 0);
  const A = (current - removedAttack) / (p / 100);
  const 옛룬외 = (current / A - 1) * 100 - r1;
  return {
    saved: {
      equipped,
      measure: { current, removedRune: ref, removedPercent: p, removedAttack, direction: 'removed',
        nonRunePercent: 옛룬외, attackA: A, committed: true, at: '2026-08-10 00:50' },
    },
    옛룬외, 옛A: A,
  };
}

/* 이행하면서 값이 변하면 사용자는 자기가 잰 값이 틀어졌다고 읽는다.
 * 그래서 "옮겨졌다"가 아니라 **새 식으로 다시 풀어도 같은 값이 나오는지**까지 본다. */
test('옛 측정을 두 쌍으로 옮겨도 깡공과 룬 외 공증이 그대로다', () => {
  const { saved, 옛룬외, 옛A } = 옛측정({
    equipped: ['광채+', '계시+'], ref: '햇살+', p: 16, current: 68800, removedAttack: 62400,
  });
  const { state, changed } = migrateMeasureToPairs(saved, pctOf);
  assert.equal(changed, true);
  assert.equal(state.measure.a.attack, 68800, '사용자가 넣은 공격력을 바꿨다');
  assert.equal(state.measure.b.attack, 62400, '사용자가 넣은 공격력을 바꿨다');
  assert.equal(state.measure.committed, true, '확정 상태를 잃었다');

  const r = solveMeasurement(state.measure.a, state.measure.b);
  assert.ok(r.ok, `이행 결과가 안 풀린다: ${r.error}`);
  assert.ok(Math.abs(r.attackA - 옛A) < 0.5, `깡공이 ${옛A} → ${r.attackA} 로 바뀌었다`);
  assert.ok(Math.abs(r.nonRunePercent - 옛룬외) < 0.001,
    `룬 외 공증이 ${옛룬외} → ${r.nonRunePercent} 로 바뀌었다 — 이행으로 값이 변하면 안 된다`);
});

test('이미 새 모양이면 건드리지 않는다', () => {
  const saved = { measure: { a: { attack: 1, runePercent: 2 }, b: { attack: 3, runePercent: 4 } } };
  assert.equal(migrateMeasureToPairs(saved, pctOf).changed, false);
});

test('반쪽짜리 옛 측정은 새 빈 모양으로 바꾸고 확정을 푼다 — 숫자를 지어내지 않는다', () => {
  const saved = { equipped: [], measure: { current: 60000, removedPercent: null, committed: true } };
  const { state, changed } = migrateMeasureToPairs(saved, pctOf);
  assert.equal(changed, true);
  assert.equal(state.measure.committed, false);
  assert.equal(state.measure.a.attack, null);
});

/* 옛 코드는 기준 룬을 목록에서 고른 경우에만 그 %를 공증합에 더했고, 기본값이던
 * '초월 룬 등 — % 직접 입력' 을 쓰면 빼먹었다. 그러면 그 룬의 공증이 룬 외 공증으로
 * 넘어가 공증룬의 가치가 실제보다 낮게 나온다. 이행은 이걸 바로잡는다. */
test('기준 룬을 이름 없이 적은 옛 측정도 그 룬을 공증합에 넣는다', () => {
  const saved = {
    equipped: [],
    measure: { current: 56000, removedRune: null, removedPercent: 10, removedAttack: 50909,
      direction: 'removed', nonRunePercent: 10, attackA: 50910, committed: true, at: '2026-08-10 00:50' },
  };
  const { state, changed } = migrateMeasureToPairs(saved, pctOf);
  assert.equal(changed, true);
  assert.equal(state.measure.committed, true, '확정 상태를 잃었다 — 다시 재게 만들면 안 된다');
  assert.equal(state.measure.a.runePercent, 10, '뺀 룬의 공증이 합에서 빠졌다');
  assert.equal(state.measure.b.runePercent, 0);

  const r = solveMeasurement(state.measure.a, state.measure.b);
  assert.ok(r.ok, `안 풀린다: ${r.error}`);
  assert.ok(Math.abs(r.nonRunePercent - 0) < 0.05,
    `룬 외 공증이 ${r.nonRunePercent}% 다 — 뺀 룬 10%를 룬 외로 세던 옛 버그가 남아 있다`);
});

// ── 아티팩트 경고 ──────────────────────────────────────
/* 아티팩트가 진짜로 바뀌면 A 와 B 가 동시에 움직여 측정이 못 쓰게 되므로 경고가 필요하다.
 * 그런데 앱은 "내가 폼을 채운 것" 과 "게임에서 바뀐 것" 을 구분할 수 없다. 측정이 ① 단계라
 * 재고 나서 아티팩트를 입력하는 것이 자연스러운 순서인데, 그걸 변경으로 읽으면 아무것도
 * 안 바꾼 사람에게 "다시 측정해 주세요" 가 뜬다 — 실제로 그렇게 떴다. */
test('측정할 때 아티팩트를 아직 안 넣었으면 나중에 넣어도 경고하지 않는다', () => {
  assert.equal(artifactsChanged('', 'ruin:3,tide:1'), false);
});

test('옛 저장분처럼 서명 자체가 없으면 판단하지 않는다', () => {
  assert.equal(artifactsChanged(undefined, 'ruin:3'), false);
  assert.equal(artifactsChanged(null, 'ruin:3'), false);
});

test('측정할 때 넣어둔 것이 실제로 달라지면 경고한다 — 이게 진짜 경고다', () => {
  assert.equal(artifactsChanged('ruin:3', 'ruin:4'), true);
  assert.equal(artifactsChanged('ruin:3', ''), true);
});

test('같으면 경고하지 않는다', () => {
  assert.equal(artifactsChanged('ruin:3,tide:1', 'ruin:3,tide:1'), false);
});

// ── 계열 세기 ──────────────────────────────────────────
/* 새 룬들이 이 수를 조건으로 쓴다 — "용 계열 2개 이상", "빛 계열 수에 따라",
 * "빛·어둠·용을 각각 2개 이상", "서로 다른 계열 1종마다". 세는 것이 틀리면 전부 틀린다. */
test('세트의 계열 수를 센다 — 계열 없는 룬은 어디에도 안 세어진다', async () => {
  const { familyCounts, distinctFamilies } = await import('../src/rune-conditionals.mjs');
  assert.deepEqual(familyCounts(['별바라기', '잠들지 않는 불', '공허', '광채+']), { 빛: 1, 어둠: 1, 용: 2 });
  // 기본기+·가라앉은 왕국은 계열이 없다(표에 없다)
  assert.deepEqual(familyCounts(['기본기+', '가라앉은 왕국']), { 빛: 0, 어둠: 0, 용: 0 });
  assert.equal(distinctFamilies(['별바라기', '잠들지 않는 불']), 1);
  assert.equal(distinctFamilies(['별바라기', '공허', '광채+']), 3);
});

test('강화 표기(+)가 붙어도 같은 룬으로 센다', async () => {
  const { familyCounts } = await import('../src/rune-conditionals.mjs');
  // 데이터에는 '광채+' 로 들어 있다. 표기가 달라도 계열이 사라지면 안 된다.
  assert.equal(familyCounts(['광채+']).빛, 1);
  assert.equal(familyCounts(['광채']).빛, 1);
});

/* 계열로 정해지는 값은 시간 가동률이 아니라 세트 구성이 정한다. 그래서 min·max 시나리오에도
 * 그대로 붙어야 한다 — 룬을 바꾸지 않는 한 '안 터질' 수가 없다. 다른 조건부와 이 점이 다르다. */
test('계열 조건은 세트 구성이 정한다 — 시나리오와 무관하게 같은 값이다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const p = sampleProfile({ assumeVulnerable: false });
  const 나머지 = ['광채+', '공허', '별바라기']; // 빛·어둠·용 셋 다
  const atk = (set, sc) => resolveRuneEffects(RUNES, set, sc, p, 'off').deltas['attackIncrease.itemAttackPercent'] ?? 0;
  // 다른 룬의 조건부는 시나리오마다 다르므로, 쐐기돌을 넣기 전후 차이로만 본다.
  // 쐐기돌은 계열 몫 15% 에 치명타 비례분 4%(상한)가 더 붙는다. 둘 다 시나리오를 안 탄다.
  for (const sc of ['min', 'expected', 'max']) {
    assert.equal(atk(['쐐기돌', ...나머지], sc) - atk(나머지, sc), 19,
      `${sc} 시나리오에서 쐐기돌 몫이 19% 가 아니다 — 구성과 스탯이 정하는 값은 시나리오를 안 탄다`);
  }
  // 스탯 비례분을 떼어내 계열 몫만 남겨 본다. 둘이 같은 필드에 더해지므로 이렇게 갈라야 한다.
  const 스탯없음 = sampleProfile({ assumeVulnerable: false, criticalStat: 0 });
  const atk0 = (set) => resolveRuneEffects(RUNES, set, 'expected', 스탯없음, 'off')
    .deltas['attackIncrease.itemAttackPercent'] ?? 0;
  assert.equal(atk0(['쐐기돌', ...나머지]) - atk0(나머지), 15, '치명타가 0인데 스탯 비례분이 붙었다');
});

test('계열 단계표가 개수대로 오르고 천장에서 멈춘다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const p = sampleProfile({ assumeVulnerable: false });
  const crit = (set) => resolveRuneEffects(RUNES, set, 'expected', p, 'off').deltas['critical.runeCriticalRatePercent'] ?? 0;
  // 작열은 빛 계열이고 자기 자신도 센다 — 혼자 끼면 1개다.
  const 빛 = ['광채+', '계시+', '승전', '서광'];
  const 값 = [0, 1, 2, 3, 4].map((k) => crit(['작열', ...빛.slice(0, k)]) - crit(빛.slice(0, k)));
  assert.deepEqual(값, [3, 7, 12, 18, 18], '3/7/12/18 이고 5개째부터는 천장에서 멈춰야 한다');
});

test('문턱을 못 넘으면 0 이다 — 황혼 숨결은 혼자서는 안 켜진다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const p = sampleProfile({ assumeVulnerable: false });
  const atk = (set) => resolveRuneEffects(RUNES, set, 'expected', p, 'off').deltas['attackIncrease.itemAttackPercent'] ?? 0;
  assert.equal(atk(['황혼 숨결']) - atk([]), 0, '용 계열이 자기뿐인데 켜졌다');
  // 켜지면 기본 10% + 스킬 위력 비례 4%(샘플 3000 이면 상한). 게이트는 둘 다에 걸린다.
  assert.equal(atk(['황혼 숨결', '별바라기']) - atk(['별바라기']), 14, '용 계열 2개인데 안 켜졌다');
});

/* 스탯 비례분("연타 강화 500마다 2%, 최대 8%").
 * 확률이 아니라 입력이 정하므로 시나리오를 안 타고, 스탯을 안 넣으면 0 이다.
 * '500마다' 는 내림이다 — 반올림하면 상한 아래에서 노는 룬의 값이 실제로 달라진다. */
test('스탯 비례분은 500 단위로 내림하고 상한에서 멈춘다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const dmg = (rapid) => {
    const p = sampleProfile({ assumeVulnerable: false, rapidEnhance: rapid });
    const of = (set) => resolveRuneEffects(RUNES, set, 'expected', p, 'off')
      .deltas['damageIncrease.itemMainDamagePercent'] ?? 0;
    return of(['삼키는 모래']) - of([]);
  };
  // 삼키는 모래는 상시 피증이 0 이라 차이가 곧 스탯 비례분이다. 500마다 2%, 최대 8%.
  assert.equal(dmg(0), 0, '스탯을 안 넣었는데 값이 붙었다');
  assert.equal(dmg(499), 0, '499 는 아직 한 단도 아니다');
  assert.equal(dmg(999), 2, '999 를 두 단으로 셌다 — 내림이 아니라 반올림이다');
  assert.equal(dmg(2000), 8, '2000 이면 정확히 상한이다');
  assert.equal(dmg(6300), 8, '상한을 넘겨 올라갔다');
});

/* 계열 게이트를 못 넘으면 스탯이 아무리 높아도 0 이다. 오팔 성배는 '각각 2개 이상' 이라
 * 문턱이 제일 높다 — 자기 자신이 빛이라 빛만 하나 덜 필요하다. */
test('계열 게이트를 못 넘으면 스탯 비례분도 0 이다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const p = sampleProfile({ assumeVulnerable: false });
  const cd = (set) => resolveRuneEffects(RUNES, set, 'expected', p, 'off')
    .deltas['critical.criticalDamagePercent'] ?? 0;
  const 어둠둘 = ['공허', '잿빛 장막'];
  const 용둘 = ['별바라기', '잠들지 않는 불'];
  // 오팔 성배의 스킬 스택(치피 5%)은 계열 게이트를 안 탄다. 게이트가 닫히면 그것만 남는다.
  assert.equal(cd(['오팔 성배', ...어둠둘, ...용둘]) - cd([...어둠둘, ...용둘]), 5, '빛이 자기뿐인데 켜졌다');
  // 빛을 하나 더 채우면 열린다. 빠른 스킬 1800 → 3단 × 1.5% = 4.5% (상한 6% 아래). 5 + 4.5.
  const 빛하나 = ['광채+'];
  assert.equal(cd(['오팔 성배', ...빛하나, ...어둠둘, ...용둘]) - cd([...빛하나, ...어둠둘, ...용둘]), 9.5,
    '빛·어둠·용이 각각 2개인데 안 켜졌다');
});

/* 침식 사이클의 특정 구간에서만 켜지는 효과(삼키는 모래).
 * 침식 룬이 없으면 사이클 자체가 없다 — max 시나리오에서도 0 이어야 한다.
 * 여기가 조용히 틀리면 "천장은 17%" 라며 있지도 않은 값을 붙인다. */
test('침식 창 효과는 침식 룬이 있어야 켜진다 — max 시나리오에서도', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const p = sampleProfile({ assumeVulnerable: false });
  const rapid = (set, sc) => resolveRuneEffects(RUNES, set, sc, p, 'off')
    .deltas['enhancement.rapidDamagePercent'] ?? 0;
  // 직업 패시브도 연타 피해를 주므로 룬을 넣기 전후 차이로만 본다.
  // 삼키는 모래의 상시 연타 피해 10% 는 침식과 무관하게 붙는다. 그 위에 얹히는 몫이 관심사다.
  const 몫 = (set, sc) => rapid(['삼키는 모래', ...set], sc) - rapid(set, sc);
  for (const sc of ['min', 'expected', 'max']) {
    assert.equal(몫([], sc), 10, `${sc}: 침식 룬이 없는데 침식 창 몫이 붙었다`);
  }
  assert.equal(몫(['잿빛 장막'], 'max'), 27, '침식 룬이 있는데 천장이 안 열렸다');
  const ex = 몫(['잿빛 장막'], 'expected') - 10;
  assert.ok(ex > 0 && ex < 17, `기대값이 0~17 사이여야 하는데 ${ex}`);
});

/* 침식 룬을 더 끼면 카운터가 빨리 차서 조건 구간(오염)의 비중이 커진다.
 * erosionExpected 는 반대로 개당 효율이 **떨어지는데**, 방향이 다른 것이 정상이다. */
test('침식 창 비중은 침식 룬이 많을수록 커진다', async () => {
  const { erosionWindowUptime } = await import('../src/rune-conditionals.mjs');
  assert.equal(erosionWindowUptime(0, 0), 0, '침식 룬이 없으면 0 이다');
  const [a, b, c] = [1, 2, 3].map((n) => erosionWindowUptime(0, n));
  assert.ok(a < b && b < c, `개수가 늘면 커져야 한다: ${a} ${b} ${c}`);
  // 1개: (100/5 + 15) / (300/5 + 15) = 35/75
  assert.ok(Math.abs(a - 35 / 75) < 1e-9, `1개일 때 ${a}`);
});

/* 두 영웅은 직업 조건을 탄다. 지금은 전 직업이 가능으로 열려 있지만,
 * 게이트가 실제로 직업을 보는지는 지금 확인해 둬야 나중에 목록을 줄일 때 믿을 수 있다. */
test('두 영웅은 dualWield 직업에서만 켜진다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const { DUAL_WIELD_JOBS } = await import('../src/gen/jobs-data.mjs');
  const dmg = (job) => resolveRuneEffects(RUNES, ['두 영웅'], 'expected',
    sampleProfile({ assumeVulnerable: false, job }), 'off')
    .deltas['damageIncrease.itemMainDamagePercent'] ?? 0;
  assert.ok(DUAL_WIELD_JOBS.includes('듀얼블레이드'), '툴팁이 명시한 직업이 목록에 없다');
  assert.equal(dmg('듀얼블레이드'), 22);
  assert.equal(dmg('그런직업없음'), 0, '목록에 없는 직업인데 켜졌다');
});
