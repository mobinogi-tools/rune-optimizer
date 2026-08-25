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
import { solveMeasurement, measurementPrecision, artifactsChanged, singleRunePair } from '../src/measure.mjs';
import {
  migrateMeasureToPairs, settleMeasureMode, migrateNightBlessingScale, pruneNightBlessingEffects,
} from '../src/save-migrations.mjs';
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

test('오팔 성배의 2·2·2가 모자라면 꺼진 효과와 현재 계열 수를 돌려준다', async () => {
  const { unmetFamilyConditions } = await import('../src/rune-conditionals.mjs');
  const set = ['오팔 성배', '금 간 봉인', '거두는 손길', '교차하는 사슬', '해방', '바위 칼날', '계승자'];
  const [row] = unmetFamilyConditions(set);
  assert.equal(row.rune, '오팔 성배');
  assert.equal(row.label, '치명타 피해%(빠른 스킬 비례)');
  assert.deepEqual(row.required, { 빛: 2, 어둠: 2, 용: 2 });
  assert.deepEqual(row.current, { 빛: 1, 어둠: 4, 용: 2 });
  assert.deepEqual(unmetFamilyConditions([...set, '승전']), []);
});

test('계열 단계표가 개수대로 오르고 천장에서 멈춘다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const p = sampleProfile({ assumeVulnerable: false });
  // 작열의 값은 '기본 공격을 섞는다' 를 가정해야 나오므로 천장(max)에서 본다.
  const crit = (set, sc = 'max') => resolveRuneEffects(RUNES, set, sc, p, 'off').deltas['critical.runeCriticalRatePercent'] ?? 0;
  // 작열은 빛 계열이고 자기 자신도 센다 — 혼자 끼면 1개다.
  const 빛 = ['광채+', '계시+', '승전', '서광'];
  const 값 = [0, 1, 2, 3, 4].map((k) => crit(['작열', ...빛.slice(0, k)]) - crit(빛.slice(0, k)));
  assert.deepEqual(값, [3, 7, 12, 18, 18], '3/7/12/18 이고 5개째부터는 천장에서 멈춰야 한다');
});

/* 작열은 기본 공격을 해야 붙는다. 대부분의 직업은 기본 공격을 안 하려고 하므로 기본값이 0 이다.
 * 예전에는 "기본 공격은 자동으로 나가니까 상시" 로 보고 있었고, 그 상태로 계열 시너지 탐색이
 * 이 룬을 추천 상단으로 밀어 올렸다. 되돌아가면 여기서 걸려야 한다. */
test('기본 공격 트리거는 기본값이 0 이고, 넣은 값은 계열 천장에서 잘린다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const crit = (set, sc, over) => resolveRuneEffects(RUNES, set, sc,
    sampleProfile({ assumeVulnerable: false, ...(over ? { runeOverrides: over } : {}) }), 'off')
    .deltas['critical.runeCriticalRatePercent'] ?? 0;
  const 빛셋 = ['광채+', '계시+', '승전'];
  const 몫 = (sc, over) => crit(['작열', ...빛셋], sc, over) - crit(빛셋, sc, over);
  assert.equal(몫('expected'), 0, '기본 공격을 가정하지 않았는데 값이 붙었다');
  assert.equal(몫('min'), 0);
  assert.equal(몫('max'), 18, '빛 4개(자신 포함)면 천장은 18% 다');
  // 캐릭터의 '평타를 섞는다' 를 켜면 천장까지 들어간다. 10초 버프는 평타를 섞으면 안 끊긴다.
  const 평타 = (set, sc = 'expected') => resolveRuneEffects(RUNES, set, sc,
    sampleProfile({ assumeVulnerable: false, usesBasicAttack: true }), 'off')
    .deltas['critical.runeCriticalRatePercent'] ?? 0;
  assert.equal(평타(['작열', ...빛셋]) - 평타(빛셋), 18, '평타를 켰는데 안 붙었다');
  assert.equal(평타(['작열']) - 평타([]), 3, '빛이 자기뿐이면 3% 다');
  // 사용자가 직접 올리면 그만큼 들어간다.
  const ov = { 작열: { cond: { 'crit-rate-by-light': 9 } } };
  assert.equal(몫('expected', ov), 9, '직접 넣은 가정이 계산에 안 들어갔다');
  // 다만 계열 천장을 넘길 수는 없다. 빛이 작열 하나뿐이면 3% 가 한계다.
  assert.equal(crit(['작열'], 'expected', ov) - crit([], 'expected', ov), 3,
    '빛이 하나뿐인데 9% 가 그대로 들어갔다 — 천장에서 잘려야 한다');
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

// ── 침식 룬 목록이 낡지 않았는가 ────────────────────────
//
// EROSION_RUNES 는 세 곳이 쓴다 — 삼키는 모래의 게이트, 침식 룬 자신의 기대값(사이클이
// 몇 개로 도는가), 무형의 분기. 목록이 낡으면 전부 조용히 틀린다. 특히 삼키는 모래는
// 새 침식 룬 옆에서 17% 가 통째로 0 이 되는데, 화면에는 "값이 없다" 로만 보인다.
//
// 부여 룬 목록이 실제로 그렇게 낡아 있었다(황혼 숨결·전환+ 가 빠져 광채+ 가 안 켜졌다).
// 같은 모양의 목록이므로 같은 그물을 친다.

/** "1초마다 침식 수치가 5 증가한다" 에서 초당 증가량을 꺼낸다. 부여하지 않는 룬은 null. */
const 침식부여량 = (desc) => {
  const m = /침식 수치가\s*(\d+(?:\.\d+)?)\s*증가/.exec(desc ?? '');
  return m ? Number(m[1]) : null;
};

test('룬 설명이 침식을 부여한다고 말하면 EROSION_RUNES 에 있어야 한다', async () => {
  const { EROSION_RUNES } = await import('../src/gen/rune-conditionals-data.mjs');
  const missing = RUNES.items
    .filter((r) => 침식부여량(r.desc) !== null)
    .map((r) => r.name)
    .filter((n) => !EROSION_RUNES.includes(n) && !EROSION_RUNES.includes(n.replace(/\+$/, '')));
  assert.deepEqual(missing, [],
    `설명은 침식을 부여한다는데 EROSION_RUNES 에 없다 — 이 룬만 껴서는 삼키는 모래의 17% 가 0 이다:\n${missing.join('\n')}`);
});

test('EROSION_RUNES 의 룬은 실제로 침식을 부여하고, 부여량이 모델과 같다', async () => {
  const { EROSION_RUNES, EROSION_SYSTEM } = await import('../src/gen/rune-conditionals-data.mjs');
  for (const name of EROSION_RUNES) {
    const r = RUNES.items.find((x) => x.name === name || x.name.replace(/\+$/, '') === name);
    assert.ok(r, `${name} 이 runes-data 에 없다`);
    const rate = 침식부여량(r.desc);
    assert.ok(rate !== null, `${name} 의 설명에 침식을 부여한다는 말이 없다 — 목록이 게임과 어긋났다`);
    // 사이클 계산은 룬 개수만 세고 개당 증가량은 상수로 본다. 다른 속도로 부여하는 룬이
    // 들어오면 그 가정이 깨지므로, 세는 것으로는 못 풀고 수식을 고쳐야 한다.
    assert.equal(rate, EROSION_SYSTEM.ratePerRunePerSecond,
      `${name} 은 초당 ${rate} 씩 부여하는데 모델은 ${EROSION_SYSTEM.ratePerRunePerSecond} 로 센다 — 개수만 세는 계산이 깨진다`);
  }
});

/* 침식을 '언급만' 하는 룬은 부여 룬이 아니다. 무형은 조건으로 쓰고, 삼키는 모래는
 * 침식 수치를 읽기만 한다. 이 둘이 목록에 들어가면 사이클이 실제보다 빨리 도는 것으로
 * 잡혀 침식 룬의 기대값이 통째로 낮아지고, 삼키는 모래가 자기 혼자서도 켜진다. */
test('침식을 언급만 하는 룬은 부여 룬이 아니다', async () => {
  const { EROSION_RUNES } = await import('../src/gen/rune-conditionals-data.mjs');
  for (const name of ['무형', '삼키는 모래']) {
    const r = RUNES.items.find((x) => x.name === name);
    assert.ok(r.desc.includes('침식'), `${name} 의 설명에 침식이 없다 — 이 테스트의 전제가 낡았다`);
    assert.ok(!EROSION_RUNES.includes(name), `${name} 은 침식을 부여하지 않는다`);
  }
});

/* 두 영웅은 직업 조건을 탄다 — 툴팁이 명시한 세 직업뿐이다.
 * 목록이 늘거나 줄면 여기가 먼저 깨져야 한다. 조용히 바뀌면 다른 직업에서 22% 가
 * 있지도 않은 채로 추천에 얹힌다. */
test('두 영웅은 dualWield 직업에서만 켜진다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const { DUAL_WIELD_JOBS } = await import('../src/gen/jobs-data.mjs');
  const dmg = (job) => resolveRuneEffects(RUNES, ['두 영웅'], 'expected',
    sampleProfile({ assumeVulnerable: false, job }), 'off')
    .deltas['damageIncrease.itemMainDamagePercent'] ?? 0;
  assert.deepEqual([...DUAL_WIELD_JOBS].sort(), ['격투가', '댄서', '듀얼블레이드'],
    '툴팁이 적은 세 직업과 다르다');
  for (const job of DUAL_WIELD_JOBS) assert.equal(dmg(job), 22, `${job} 에서 안 켜졌다`);
  assert.equal(dmg('마법사'), 0, '양손에 같은 무기를 못 드는 직업인데 켜졌다');
});

/* 백금 천칭은 평타를 쳐야 피증이 붙는다. 작열과 달리 계열 표가 없어 천장이 max 에서 온다 —
 * 트리거 처리가 계열 표에만 매여 있으면 여기서 조용히 0 이 된다. */
test('평타 트리거는 계열 표가 없어도 천장이 붙는다 — 백금 천칭', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const dmg = (on, sc = 'expected') => {
    const p = sampleProfile({ assumeVulnerable: false, usesBasicAttack: on });
    const of = (set) => resolveRuneEffects(RUNES, set, sc, p, 'off')
      .deltas['damageIncrease.itemMainDamagePercent'] ?? 0;
    return of(['백금 천칭']) - of([]);
  };
  assert.equal(dmg(false), 0, '평타를 안 쓰는데 붙었다');
  // 21% × 1.5 — 다른 한 줄이 스킬만 쓰면 켜지므로 평타를 섞는 순간 두 효과가 모두 활성화된다.
  assert.equal(dmg(true), 31.5, '평타를 켰는데 1.5배 조항이 안 들어갔다');
  assert.equal(dmg(false, 'max'), 31.5, 'max 는 스위치와 무관한 천장이어야 한다');
  assert.equal(dmg(true, 'min'), 0, 'min 은 아무것도 안 터진 상태다');
});

/* 밤의 축복 구간에 겹치는 직업 버프는 사람이 낮춰 볼 수 있어야 한다.
 * 댄서의 최종뎀 +40% 는 실측 근거가 붙어 있지만 툴팁에 없는 값이라, 의심스러울 때
 * 0 으로 두고 결과가 얼마나 흔들리는지 보는 길이 있어야 한다. */
/* 각성 구간 버프는 **자리마다 그대로** 얹힌다.
 *
 * 한때 이걸 최종 데미지 한 칸으로 합치려 했는데 틀린 길이었다 — 전격술사의 피증 100% 를
 * 최종 데미지로 옮기려면 자기 B 값을 알아야 하고, 그건 아무도 못 한다. 실제로 그렇게
 * 바꿨더니 전격술사의 밤축 구간 데미지가 41.5% 날아갔다. 자리를 합치는 것을 여기서 막는다. */
test('각성 구간 버프는 ON 구간에만, 자리마다 그대로 붙는다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const set = ['광채+', '금 간 봉인', '계승자', '승전', '쐐기돌', '무너진 경계', '영원한 밤'];
  const d = (eff, nb) => resolveRuneEffects(RUNES, set, 'expected',
    sampleProfile({ assumeVulnerable: false, job: '댄서', nightBlessingEffects: eff }), nb).deltas;
  assert.equal(d({ 'finalDamage.percent': 40 }, 'off')['finalDamage.percent'] ?? 0, 0, 'OFF 구간에는 안 붙는다');
  assert.equal(d({ 'finalDamage.percent': 40 }, 'on')['finalDamage.percent'], 40);
  assert.equal(d({ 'finalDamage.percent': 20 }, 'on')['finalDamage.percent'], 20);
  assert.equal(d({}, 'on')['finalDamage.percent'] ?? 0, 0);
});

test('피증 자리는 피증으로 간다 — 최종 데미지로 옮기지 않는다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  // 룬(광채+)도 피증 20% 를 주므로 차분으로 본다 — 얹힌 몫만 확인하면 된다.
  const at = (eff) => resolveRuneEffects(RUNES, ['광채+'], 'expected',
    sampleProfile({ job: '전격술사', nightBlessingEffects: eff }), 'on').deltas;
  const off = at({});
  const on = at({ 'damageIncrease.itemMainDamagePercent': 100 });
  assert.equal((on['damageIncrease.itemMainDamagePercent'] ?? 0) - (off['damageIncrease.itemMainDamagePercent'] ?? 0),
    100, '피증이 안 붙었다');
  assert.equal(on['finalDamage.percent'] ?? 0, 0, '피증이 최종 데미지로 새고 있다');
});

test('직업 표는 프로필을 거쳐야만 계산에 들어간다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  // 사람이 전부 0 으로 지웠으면 표에 뭐가 적혀 있든 안 붙어야 한다.
  const d = resolveRuneEffects(RUNES, ['광채+'], 'expected',
    sampleProfile({ job: '검술사', nightBlessingEffects: {} }), 'on').deltas;
  assert.equal(d['attackIncrease.itemAttackPercent'] ?? 0, 0, '표가 프로필을 건너뛰고 새고 있다');
});

/* 같은 뜻의 칸이 둘이면 언젠가 이중으로 더해진다. 예전의 가산 필드는 지웠다. */
test('밤의 축복 직업 버프를 더하는 자리는 하나뿐이다', async () => {
  const { readFileSync } = await import('node:fs');
  // 주석은 걷어내고 본다 — 왜 지웠는지 적어둔 설명문이 자기 자신에게 걸리면 안 된다.
  const src = readFileSync('src/build-evaluator.mjs', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.ok(!src.includes('nightBlessingClassBonusPercent'),
    '죽은 가산 필드가 되살아났다 — 직업 표와 이중으로 더해진다');
});

/* 간이 측정 — 룬 하나만 바꿔 재는 쪽. 물어보는 것은 세 가지뿐이다. */
test('간이 측정은 깡공을 정확히 낸다 — 나머지 공증은 차분에서 약분된다', () => {
  // 정답: 깡공 40,000. 공증합 120 → 40000×2.45 = 98,000 / 공증합 100 → 40000×2.25 = 90,000
  const 뺐다 = singleRunePair({ attackNow: 98000, attackAfter: 90000, runePercent: 20, direction: 'removed' });
  const r1 = solveMeasurement(뺐다.a, 뺐다.b);
  assert.ok(r1.ok, JSON.stringify(r1));
  assert.equal(Math.round(r1.attackA), 40000, '깡공은 나머지 공증을 몰라도 맞아야 한다');
  // 같은 상황을 '넣었다' 로 적어도 같다.
  const 넣었다 = singleRunePair({ attackNow: 90000, attackAfter: 98000, runePercent: 20, direction: 'added' });
  const r2 = solveMeasurement(넣었다.a, 넣었다.b);
  assert.equal(Math.round(r2.attackA), 40000, '넣었다 쪽 깡공이 다르다');
  assert.ok(Math.abs(r1.nonRunePercent - r2.nonRunePercent) < 1e-9, '두 방향의 룬 외 공증이 다르다');
});

/* 이 모드가 틀리는 자리를 못박아 둔다. 감추면 나중에 "왜 숫자가 이상하지" 가 된다.
 * 다른 공증 룬(100%p 중 20%p 만 잰 경우)이 룬 외 공증에 그대로 섞인다. */
test('간이 측정의 룬 외 공증에는 나머지 공증 룬이 섞인다 — 알고 쓰는 값이다', () => {
  const pair = singleRunePair({ attackNow: 98000, attackAfter: 90000, runePercent: 20, direction: 'removed' });
  const 간이 = solveMeasurement(pair.a, pair.b);
  const 정확 = solveMeasurement({ attack: 98000, runePercent: 120 }, { attack: 90000, runePercent: 100 });
  assert.equal(Math.round(간이.attackA), Math.round(정확.attackA), '깡공은 같아야 한다');
  assert.equal(Math.round(정확.nonRunePercent), 25);
  assert.equal(Math.round(간이.nonRunePercent), 125, '나머지 공증 100%p 가 섞여 들어가야 한다');
});

test('간이 측정은 값이 모자라면 아무것도 안 만든다', () => {
  assert.equal(singleRunePair(), null);
  assert.equal(singleRunePair({ attackNow: 90000, attackAfter: null, runePercent: 20, direction: 'removed' }), null);
  // 바꾼 룬의 공증이 0 이면 두 상태가 같아 풀 수 없다. 여기서 막지 않으면
  // solveMeasurement 가 'same-percent' 로 잡지만, 그 문구는 두 쌍 모드의 것이라 엉뚱하다.
  assert.equal(singleRunePair({ attackNow: 90000, attackAfter: 90000, runePercent: 0, direction: 'removed' }), null);
});

test('간이 측정의 정밀도가 낮다는 것이 수치로 드러난다', () => {
  // 룬 하나(20%p) vs 세트로 크게 벌린 경우(60%p)
  assert.ok(measurementPrecision(20).attackError > measurementPrecision(60).attackError,
    '차이가 작을수록 오차가 커야 한다');
  assert.equal(Math.round(measurementPrecision(20).attackError), 10);
  assert.equal(measurementPrecision(4).weak, true, '4%p 면 약한 측정으로 표시해야 한다');
});

/* 특정 스킬에만 붙는 효과를 '그 스킬의 딜 비중' 만큼만 반영한다.
 * 예전에는 「기타 효과를 최종 데미지 %로 보정」 이라는 한 칸에 사람이 감으로 넣었다.
 * 그 칸은 쿨감 같은 것을 위한 자리인데, 여기 쓰면 무엇을 넣어야 하는지 아무도 모른다. */
test('스킬 자원 소모 스킬 피해는 딜 비중만큼만 들어간다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const F = 'damageIncrease.specificSkillDamagePercent';
  const at = (share, sc = 'expected') => resolveRuneEffects(RUNES, ['무한한 탐욕'], sc,
    sampleProfile({ assumeVulnerable: false, resourceSkillSharePercent: share }), 'off').deltas[F] ?? 0;
  assert.equal(at(0), 0, '그 스킬을 안 쓰면 0 이다');
  assert.equal(at(40), 15.2, '툴팁 38% × 비중 40% = 15.2% 여야 한다');
  assert.equal(at(100), 38, '전부 그 스킬이면 툴팁 값 그대로다');
  // 시나리오는 천장과 바닥을 보여준다.
  assert.equal(at(40, 'min'), 0);
  assert.equal(at(40, 'max'), 38);
  // 범위 밖 값이 들어와도 천장을 넘지 않는다.
  assert.equal(at(150), 38, '100% 를 넘겨도 툴팁 값이 천장이다');
  assert.equal(at(-20), 0, '음수는 0 으로 본다 — 효과가 손해로 뒤집히면 안 된다');
});

test('석궁사수의 스킬 자원 소모 딜 비중 기본값은 60%다', async () => {
  const { RESOURCE_SKILL_SHARE } = await import('../src/gen/jobs-data.mjs');
  assert.equal(RESOURCE_SKILL_SHARE['석궁사수'], 60);
});

test('스킬 한정 룬은 각 딜 비중만큼 반영되고 서로 겹칠 수 있다', async () => {
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const at = (name, profile) => resolveRuneEffects(RUNES, [name], 'expected', profile)
    .deltas['damageIncrease.specificSkillDamagePercent'] ?? 0;
  assert.equal(at('뼈 인장', { slot3SkillSharePercent: 40 }), 21.2);
  assert.equal(at('바다뱀+', { channelingSkillSharePercent: 50 }), 15.5);
  assert.equal(at('봉인술사', { castingChargeSkillSharePercent: 60 }), 15);
  assert.equal(at('수호자', { ultimateSkillSharePercent: 75 }), 15);

  const both = resolveRuneEffects(RUNES, ['바다뱀+', '수호자'], 'expected', {
    channelingSkillSharePercent: 80,
    ultimateSkillSharePercent: 60,
  }).deltas['damageIncrease.specificSkillDamagePercent'];
  assert.equal(both, 36.8, '채널링 80%와 궁극기 60%가 합계 100%로 잘리면 안 된다');
});

test('스탯창 궁극기 강화도 궁극기 딜 비중만큼만 D항에 들어간다', async () => {
  const { evaluate } = await import('../src/build-evaluator.mjs');
  const at = (share) => evaluate(RUNES, [], 'expected', {
    ultimateEnhance: 8750,
    ultimateSkillSharePercent: share,
  }).factors.D;
  assert.equal(at(0), 1);
  assert.equal(at(50), 1.5);
  assert.equal(at(100), 2);
});

/* 같은 사실이 두 곳에 있으면 하나는 반드시 낡는다. 계산에 들어간 효과가
 * '계산 밖' 목록에도 남아 있으면, 이용자는 반영이 안 된 줄 알고 또 보정한다. */
test('계산에 들어간 뒤에는 계산 밖 목록에서 빠진다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { uncountedOf } = await import('../src/rune-uncounted.mjs');
  const rows = uncountedOf(RUNES.items.find((r) => r.name === '무한한 탐욕'));
  assert.ok(!rows.some((u) => /스킬 자원/.test(u.text)),
    '스킬 자원 피해가 계산에도 들어가고 계산 밖 목록에도 있다');
  for (const name of ['대군주+', '창백한 기수', '가라앉은 왕국', '바다뱀+', '봉인술사', '뼈 인장', '수호자']) {
    const skillRows = uncountedOf(RUNES.items.find((r) => r.name === name))
      .filter((u) => u.kind === '스킬한정');
    assert.deepEqual(skillRows, [], `${name}의 반영된 스킬 피해가 계산 밖에도 남았다`);
  }
  // 쿨감 회복 속도는 여전히 계산 밖이다 — 그건 데미지 공식에 자리가 없다.
  assert.ok(rows.some((u) => /재사용 대기 시간/.test(u.text)));
});

/* ── 열 때 어느 화면으로 시작하는가 ──────────────────────
 * 기본은 안 재는 쪽이다. 「측정」을 눌러 폼만 열어 두고 확정하지 않은 상태가 새로고침을
 * 넘어가면, 다음에 열 때 큰 측정 폼부터 보게 된다 — 실제로 그렇게 됐다. */
test('확정하지 않았으면 안 재는 화면으로 연다', () => {
  const m = settleMeasureMode({ mode: 'pairs', committed: false });
  assert.equal(m.mode, 'none');
});

test('재던 방식은 기억한다 — 되돌아가면 그 화면이어야 한다', () => {
  const m = settleMeasureMode({ mode: 'single', committed: false });
  assert.equal(m.mode, 'none');
  assert.equal(m.prevMode, 'single', '간이로 재던 사람이 세트 화면으로 돌아간다');
});

test('적어둔 숫자는 건드리지 않는다 — 접어두는 것이지 버리는 것이 아니다', () => {
  const m = settleMeasureMode({ mode: 'pairs', committed: false, a: { attack: 30000, runePercent: 40 } });
  assert.deepEqual(m.a, { attack: 30000, runePercent: 40 });
});

test('확정한 측정이 있으면 측정 화면으로 연다', () => {
  const m = settleMeasureMode({ mode: 'pairs', committed: true });
  assert.equal(m.mode, 'pairs');
});

test('안 재기로 해둔 사람은 그대로 둔다 — 확정값이 있어도', () => {
  // 「기본값 쓰기」를 눌러둔 상태다. 잰 값이 있다고 멋대로 측정 화면으로 되돌리면 안 된다.
  const m = settleMeasureMode({ mode: 'none', committed: true, prevMode: 'pairs' });
  assert.equal(m.mode, 'none');
});

test('mode 가 아예 없던 옛 저장분 — 확정값 유무로 갈린다', () => {
  assert.equal(settleMeasureMode({ committed: true }).mode, 'pairs');
  assert.equal(settleMeasureMode({ committed: false }).mode, 'none');
});

/* ── 옛 밤축 모양 → 자리별 맵 ────────────────────────────
 * 이행이 틀리면 조용하다. 쓰던 사람의 데미지가 달라지는데 화면에는 그럴듯한 숫자가
 * 그대로 떠 있다. 그래서 "숫자가 안 변한다" 를 자리별로 직접 단언한다. */
test('배율 100% 였던 사람은 표 값이 자리마다 그대로 온다', () => {
  const p = { nightBlessingClassScalePercent: 100 };
  migrateNightBlessingScale(p, { 'damageIncrease.itemMainDamagePercent': 100 });
  assert.deepEqual(p.nightBlessingEffects, { 'damageIncrease.itemMainDamagePercent': 100 });
  assert.equal(p.nightBlessingClassScalePercent, undefined, '옛 키가 남으면 같은 뜻의 칸이 둘이 된다');
});

test('최종 데미지가 아닌 자리도 그 자리 그대로 온다 — 이게 앞 시도가 놓친 것이다', () => {
  const p = { nightBlessingClassScalePercent: 100 };
  migrateNightBlessingScale(p, { 'attackIncrease.itemAttackPercent': 30 });
  assert.deepEqual(p.nightBlessingEffects, { 'attackIncrease.itemAttackPercent': 30 });
});

test('배율을 낮춰뒀던 사람은 자리마다 그만큼 낮게 온다', () => {
  const p = { nightBlessingClassScalePercent: 50 };
  migrateNightBlessingScale(p, { 'finalDamage.percent': 40, 'critical.runeCriticalRatePercent': 15 });
  assert.deepEqual(p.nightBlessingEffects, { 'finalDamage.percent': 20, 'critical.runeCriticalRatePercent': 7.5 });
});

test('여러 자리를 가진 직업도 전부 살아온다', () => {
  const p = { nightBlessingClassScalePercent: 100 };
  const table = {
    'extraHit.runeExtraRatePercent': 15,
    'critical.runeCriticalRatePercent': 15,
    'attackIncrease.itemAttackPercent': 10,
  };
  migrateNightBlessingScale(p, table);
  assert.deepEqual(p.nightBlessingEffects, table);
});

test('최종 데미지 한 칸이던 중간 모양도 옮긴다', () => {
  const p = { nightBlessingFinalDamagePercent: 40 };
  migrateNightBlessingScale(p, { 'finalDamage.percent': 40 });
  assert.deepEqual(p.nightBlessingEffects, { 'finalDamage.percent': 40 });
  assert.equal(p.nightBlessingFinalDamagePercent, undefined);
});

test('이미 옮긴 저장분은 다시 건드리지 않는다', () => {
  const p = { nightBlessingEffects: { 'finalDamage.percent': 12 }, nightBlessingClassScalePercent: 100 };
  migrateNightBlessingScale(p, { 'finalDamage.percent': 40 });
  assert.deepEqual(p.nightBlessingEffects, { 'finalDamage.percent': 12 },
    '두 번 돌면 사용자가 고친 값을 덮어쓴다');
});

test('손댄 적이 없으면 직업 표 기본값에 맡긴다', () => {
  const p = {};
  migrateNightBlessingScale(p, { 'finalDamage.percent': 40 });
  assert.equal(p.nightBlessingEffects, undefined, '없던 값을 지어내면 안 된다');
});

/* ── 기본값에서 빠진 항목은 버린다 ────────────────────────
 * 직업 기본값에서 항목을 빼면(암흑술사의 치확을 상시 쪽으로 옮긴 것) 이미 저장된 프로필에
 * 그 값이 남는다. 화면에 유령 칸이 뜨고, 바로 위 설명은 "기본값이 없습니다" 라 어긋난다.
 * 화면에서 지우게 만들 일이 아니라 열 때 버릴 일이다. */
test('기본값에 없는 항목은 불러올 때 버린다', () => {
  const p = { nightBlessingEffects: { 'critical.runeCriticalRatePercent': 10 } };
  pruneNightBlessingEffects(p, {}, 'finalDamage.percent');
  assert.deepEqual(p.nightBlessingEffects, {});
});

test('기본값에 있는 항목은 고쳐둔 값 그대로 남는다', () => {
  const p = { nightBlessingEffects: { 'damageIncrease.itemMainDamagePercent': 150 } };
  pruneNightBlessingEffects(p, { 'damageIncrease.itemMainDamagePercent': 100 }, 'finalDamage.percent');
  assert.deepEqual(p.nightBlessingEffects, { 'damageIncrease.itemMainDamagePercent': 150 },
    '사람이 고친 값을 기본값으로 되돌려버렸다');
});

test('최종 데미지는 기본값에 없어도 남긴다 — 어느 직업에서나 사람이 넣을 수 있는 칸이다', () => {
  const p = { nightBlessingEffects: { 'finalDamage.percent': 15 } };
  pruneNightBlessingEffects(p, {}, 'finalDamage.percent');
  assert.deepEqual(p.nightBlessingEffects, { 'finalDamage.percent': 15 });
});

test('섞여 있으면 남길 것만 남긴다', () => {
  const p = {
    nightBlessingEffects: {
      'critical.runeCriticalRatePercent': 10, // 옛 기본값의 잔재
      'damageIncrease.itemMainDamagePercent': 100, // 지금 기본값
      'finalDamage.percent': 5, // 사람이 넣은 값
    },
  };
  pruneNightBlessingEffects(p, { 'damageIncrease.itemMainDamagePercent': 100 }, 'finalDamage.percent');
  assert.deepEqual(p.nightBlessingEffects, {
    'damageIncrease.itemMainDamagePercent': 100, 'finalDamage.percent': 5,
  });
});

/* ── 각성 버프 스위치 ────────────────────────────────────
 * 기본값을 못 믿겠으면 숫자를 하나씩 지우는 것보다 통째로 끄는 쪽이 쉽다. */
test('스위치를 끄면 각성 구간 버프가 통째로 빠진다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const eff = { 'damageIncrease.itemMainDamagePercent': 100, 'finalDamage.percent': 20 };
  const at = (use) => resolveRuneEffects(RUNES, ['광채+'], 'expected',
    sampleProfile({ job: '전격술사', nightBlessingEffects: eff, useNightBlessingBuff: use }), 'on').deltas;
  const on = at(true), off = at(false);
  assert.equal(on['finalDamage.percent'], 20);
  assert.equal(off['finalDamage.percent'] ?? 0, 0, '껐는데 최종 데미지가 붙었다');
  assert.equal((on['damageIncrease.itemMainDamagePercent'] ?? 0) - (off['damageIncrease.itemMainDamagePercent'] ?? 0),
    100, '껐는데 피증이 그대로다');
});

test('스위치를 안 건드린 저장분은 켜진 것으로 본다 — 쓰던 사람 값이 안 변한다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { resolveRuneEffects } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const p = sampleProfile({ job: '댄서', nightBlessingEffects: { 'finalDamage.percent': 40 } });
  delete p.useNightBlessingBuff;
  assert.equal(resolveRuneEffects(RUNES, ['광채+'], 'expected', p, 'on').deltas['finalDamage.percent'], 40);
});

/* ── 밤의 축복 연장 구간 ──────────────────────────────────
 * 댄서의 스포트라이트가 밤의 축복을 5초 늘린다. 그 5초에는 **템포 40% 가 없다** —
 * 템포 2단계는 기본 구간과 함께 끝나고 앵콜 이후에는 다시 안 붙는다.
 * ON 으로 뭉뚱그리면 40% 를 5초 더 주는 셈이라 밤축 룬이 과대평가되고,
 * OFF 로 뭉뚱그리면 공증 15% 와 밤축 룬 옵션을 통째로 놓친다. 둘 다 조용히 틀린다. */
test('연장 구간은 밤의 축복만 켜진 세 번째 상태다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { evaluate } = await import('../src/build-evaluator.mjs');
  const { calculateDamage } = await import('../src/calculator.mjs');
  const { buildFrom } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');

  const set = ['거대한 분노', '거두는 손길', '계승자', '공세+', '공허', '해방'];
  const p = sampleProfile({ job: '댄서', assumeVulnerable: false });
  // 주기는 직업 데이터가 정한다. 여기 숫자를 박아두면 데이터를 고칠 때 같이 안 바뀐다.
  const C = p.nightBlessingCycleSeconds, D = 15, E = 5;
  const raw = (nb, prof) => calculateDamage(buildFrom(RUNES, set, 'expected', prof, nb).build).raw;
  const A = raw('on', p);
  const B = raw('on', { ...p, nightBlessingEffects: {} }); // 밤축만, 템포 없음
  const OFF = raw('off', p);

  const want = (D * A + E * B + (C - D - E) * OFF) / C;
  assert.ok(Math.abs(evaluate(RUNES, set, 'expected', p).score - want) < 1,
    '세 구간 가중평균과 안 맞는다');
  // 두 상태로 뭉뚱그린 값과는 확실히 달라야 한다.
  const asOn = ((D + E) * A + (C - D - E) * OFF) / C;
  const asOff = (D * A + (C - D) * OFF) / C;
  assert.ok(want < asOn && want > asOff, `세 번째 상태가 사라졌다: ${asOff} < ${want} < ${asOn}`);
});

test('연장이 없는 직업은 예전과 똑같이 두 구간이다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { evaluate, buildFrom } = await import('../src/build-evaluator.mjs');
  const { calculateDamage } = await import('../src/calculator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const set = ['거대한 분노', '거두는 손길', '계승자', '공세+', '공허', '해방'];
  const p = sampleProfile({ job: '검술사', assumeVulnerable: false });
  const C = p.nightBlessingCycleSeconds;
  const raw = (nb) => calculateDamage(buildFrom(RUNES, set, 'expected', p, nb).build).raw;
  const want = (15 * raw('on') + (C - 15) * raw('off')) / C;
  assert.ok(Math.abs(evaluate(RUNES, set, 'expected', p).score - want) < 1);
});

test('연장이 주기를 넘지 못한다 — 넘으면 남은 구간이 음수가 된다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { evaluate } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const set = ['거대한 분노', '거두는 손길', '계승자', '공세+', '공허', '해방'];
  // 주기를 16초로 잡으면 기본 15초 + 연장 5초가 주기를 넘는다.
  const p = sampleProfile({ job: '댄서', assumeVulnerable: false, nightBlessingCycleSeconds: 16 });
  const r = evaluate(RUNES, set, 'expected', p);
  assert.ok(Number.isFinite(r.score) && r.score > 0, `점수가 샜다: ${r.score}`);
  assert.ok(r.damageShareNightBlessing <= 1.0000001, `밤축 비중이 100% 를 넘었다: ${r.damageShareNightBlessing}`);
});

/* 주기가 지속(15초)보다 짧으면 OFF 구간 가중치 `C − D − E` 가 음수가 되고, 음수 × OFF 점수가
 * 빠지면서 점수가 **위로** 샌다. 연장(E) 쪽에는 방어가 있었는데 주기(C) 쪽이 비어 있었다.
 *
 * 주기 칸은 사람이 직접 넣는 값이고 입력에 하한이 없다 — 오타 하나로 닿는다.
 * 고치기 전에는 주기 10 에서 expected 가 max 를 넘었고 1 이면 7.5배였다. 에러는 안 나고
 * 밤축 룬만 조용히 과대평가된다. 그래서 '터지지 않는가' 가 아니라 **경계를 단언한다.** */
test('주기가 지속보다 짧아도 expected 는 min 과 max 사이다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { evaluate } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const set = ['죽음', '계승자', '교차하는 사슬', '용 사냥꾼', '금 간 봉인', '해방', '승전'];
  for (const cycle of [15, 14, 10, 5, 1, 0.5]) {
    const p = sampleProfile({ job: '댄서', assumeVulnerable: false, nightBlessingCycleSeconds: cycle });
    const [min, expected, max] = ['min', 'expected', 'max']
      .map((s) => evaluate(RUNES, set, s, p).score);
    assert.ok(expected <= max * (1 + 1e-9), `주기 ${cycle}: expected(${expected}) 가 max(${max}) 를 넘었다`);
    assert.ok(expected >= min * (1 - 1e-9), `주기 ${cycle}: expected(${expected}) 가 min(${min}) 보다 작다`);
  }
});

test('주기가 지속보다 짧으면 밤축이 안 끊긴 것으로 본다 — 지속으로 눌린다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { evaluate, effectiveNightBlessingCycle } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const set = ['죽음', '계승자', '교차하는 사슬', '용 사냥꾼', '금 간 봉인', '해방', '승전'];
  const at = (cycle) => evaluate(RUNES, set,
    'expected', sampleProfile({ job: '댄서', assumeVulnerable: false, nightBlessingCycleSeconds: cycle })).score;
  // 15 미만은 전부 15 와 같은 값이어야 한다. 더 짧다고 점수가 계속 오르면 안 된다.
  for (const cycle of [14, 10, 1]) {
    assert.ok(Math.abs(at(cycle) - at(15)) < 1, `주기 ${cycle} 이 주기 15 와 다르다`);
  }
  assert.equal(effectiveNightBlessingCycle({ nightBlessingCycleSeconds: 3, job: '댄서' }), 15);
  // 0 이하는 '안 넣은 것' 이라 직업 유도값으로 간다 — 하한에 걸려 15 가 되면 안 된다.
  assert.equal(effectiveNightBlessingCycle({ nightBlessingCycleSeconds: 0, job: '댄서' }), 60);
});

/* 주기를 직접 적어둔 직업은 그 값이 유도값을 이겨야 한다.
 * 유도(트리거 간격에서 올림)는 "트리거를 자연 간격에 맡긴다" 는 가정인데, 트리거를 당길
 * 수단이 있으면 그 가정이 깨진다 — 댄서는 앵콜·피날레로 템포를 당겨 쿨에 맞춘다. */
test('직업이 실제 주기를 적어두면 그것이 우선한다', async () => {
  const { nightBlessingCycleSeconds } = await import('../src/class-passives.mjs');
  assert.equal(nightBlessingCycleSeconds('댄서', 60), 60, '적어둔 주기를 안 쓰고 유도값(75)을 쓴다');
  // 안 적어둔 직업은 예전 그대로 유도한다.
  assert.equal(nightBlessingCycleSeconds('기사', 60), 90, '트리거 45초 → 90초 유도가 깨졌다');
  assert.equal(nightBlessingCycleSeconds('없는직업', 60), 60, '모르는 직업은 쿨 그대로');
});

/* 쿨감 룬은 **세트에 하나라도 있으면 한 번만** 최종 데미지에 붙는다.
 *
 * 값은 룬이 아니라 사람이 정한다(전투 상황의 「쿨감 룬 기여」). 예전에는 룬마다 환산 % 를
 * 들고 (1 + v/100) 을 곱해서, 쿨감 룬 둘에 15%씩이면 1.15×1.15 = 1.32 가 됐다.
 * 쿨감은 같은 쿨을 같이 줄이는 것이라 곱으로 불어날 수가 없다.
 *
 * 기본값이 0 이라 이 경로는 값을 넣어야만 밟는다. 그래서 조용히 되돌아가도 화면이 안 변하고,
 * 누가 값을 켜는 순간에야 드러난다 — 그때는 이미 추천이 틀린 뒤다. 지금 못박아 둔다. */
test('쿨감 룬은 둘을 껴도 한 번만 붙는다', async () => {
  const { hasCooldownRune, cooldownRuneContribution } = await import('../src/build-evaluator.mjs');
  const { COOLDOWN_RUNES } = await import('../src/rune-conditionals.mjs');
  assert.deepEqual(Object.keys(COOLDOWN_RUNES).sort(), ['공허', '햇살+'].sort());
  const p = { cooldownRuneDamagePercent: 15 };
  assert.equal(hasCooldownRune(['계승자', '승전']), false);
  assert.equal(cooldownRuneContribution(['계승자', '승전'], p), 0, '쿨감 룬이 없으면 0 이다');
  assert.equal(cooldownRuneContribution(['햇살+', '계승자'], p), 15);
  assert.equal(cooldownRuneContribution(['햇살+', '공허'], p), 15, '둘이어도 15 다 — 30 이나 32.25 가 아니다');
  assert.equal(cooldownRuneContribution(['햇살+'], {}), 0, '값을 안 넣었으면 0 이다');
});

/* 룬별 「유틸 보정」은 성격이 다르다 — 룬마다 다른 효과를 그 사람이 값으로 매기는 자리라
 * 룬 수만큼 있는 것이 맞다(30개 넘는 룬이 대상). 대신 **더한다**. 예전에는 이쪽도 곱했다.
 * 쿨감 룬은 세트 칸이 따로 있으므로 여기서 빠져야 한다 — 안 빼면 두 번 더해진다. */
test('룬별 유틸 보정은 더해지고, 쿨감 룬은 거기서 빠진다', async () => {
  const { utilityCorrectionPercent } = await import('../src/build-evaluator.mjs');
  const p = { runeOverrides: { '가라앉은 왕국': { utility: 3 }, 여신: { utility: 2 }, '햇살+': { utility: 99 } } };
  assert.equal(utilityCorrectionPercent(['가라앉은 왕국'], p), 3);
  assert.equal(utilityCorrectionPercent(['가라앉은 왕국', '여신'], p), 5, '곱이 아니라 합이어야 한다');
  assert.equal(utilityCorrectionPercent(['햇살+'], p), 0, '쿨감 룬은 세트 칸이 따로다 — 여기서 세면 두 번이다');
});

/* 공식 밖 몫은 **점수에 곱한다.** L(최종 데미지) 항에 더하면 안 된다 —
 * L 은 가산 항이라 밤의 축복의 최종 데미지 40% 와 섞여, 20% 를 넣어도 실제 기여가
 * 17.8% 가 된다(댄서 기준). 실제로 그렇게 만들었다가 이 테스트가 잡았다.
 * 「공증 30% 와 최종 데미지 30% 는 같은 수가 아니다」 와 같은 자리다. */
test('쿨감 몫은 점수에 곱한다 — L 에 더하면 밤축과 섞여 작아진다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { evaluate } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const withRune = ['죽음', '계승자', '햇살+', '금 간 봉인', '용 사냥꾼', '승전', '해방'];
  const without = ['죽음', '계승자', '끓는 피', '금 간 봉인', '용 사냥꾼', '승전', '해방'];
  const base = sampleProfile({ assumeVulnerable: false });
  const on = { ...base, cooldownRuneDamagePercent: 20 };
  const at = (set, p) => evaluate(RUNES, set, 'expected', p);

  assert.equal(at(withRune, base).utilityPercent, 0, '기본값이 0 이라 아무것도 안 붙는다');
  assert.equal(at(withRune, on).utilityPercent, 20);
  assert.equal(at(without, on).utilityPercent, 0, '쿨감 룬이 없으면 값을 넣어도 안 붙는다');

  // L 은 안 움직여야 한다. 움직였다면 가산 자리에 들어간 것이다.
  assert.equal(at(withRune, on).factors.L, at(withRune, base).factors.L,
    'L 이 움직였다 — 공식 밖 몫이 최종 데미지 항으로 새어 들어갔다');
  // 점수는 정확히 1.2 배여야 한다. 밤축 구간이든 아니든 같은 비율로 곱해지기 때문이다.
  const r = at(withRune, on).score / at(withRune, base).score;
  assert.ok(Math.abs(r - 1.2) < 1e-9, `점수 비가 1.2 여야 하는데 ${r} — L 에 더하면 1.178 이 나온다`);
});

/* 쿨감 룬의 룬별 보정값을 세트 칸으로 옮긴다.
 *
 * 그 칸은 이제 룬 상세에 없다. 안 옮기면 사람이 일부러 넣은 숫자가 **아무 말 없이**
 * 사라진다 — 화면에서 없어질 뿐 에러도 안 나고, 점수만 조용히 달라진다.
 * 이행 전에는 조회가 빗나간다는 것까지 단언한다. */
test('쿨감 룬의 옛 룬별 보정은 세트 칸으로 옮겨진다', async () => {
  const { migrateCooldownUtility } = await import('../src/save-migrations.mjs');
  const { COOLDOWN_RUNES } = await import('../src/rune-conditionals.mjs');
  const names = Object.keys(COOLDOWN_RUNES);

  const profile = { cooldownRuneDamagePercent: 0 };
  const overrides = { '햇살+': { utility: 12 }, 공허: { utility: 18 }, 계승자: { cond: { x: 5 } } };
  // 이행 전: 세트 칸은 0 이라 저 12·18 은 계산에 아무 영향이 없다.
  assert.equal(profile.cooldownRuneDamagePercent, 0);

  assert.equal(migrateCooldownUtility(profile, overrides, names), true);
  assert.equal(profile.cooldownRuneDamagePercent, 18, '여럿이면 가장 큰 값 — 더하면 옛 병이 되돌아온다');
  assert.equal(overrides['햇살+'], undefined, '빈 껍데기가 남으면 안 된다');
  assert.equal(overrides['공허'], undefined);
  assert.deepEqual(overrides['계승자'], { cond: { x: 5 } }, '쿨감 룬이 아닌 것은 그대로 둔다');

  // 두 번 돌려도 안전하고, 옮길 것이 없으면 false 다.
  assert.equal(migrateCooldownUtility(profile, overrides, names), false);
  assert.equal(profile.cooldownRuneDamagePercent, 18);

  // 이미 사람이 새 칸에 값을 넣었으면 옛 값으로 덮지 않는다.
  const p2 = { cooldownRuneDamagePercent: 5 };
  const o2 = { '햇살+': { utility: 30 } };
  assert.equal(migrateCooldownUtility(p2, o2, names), true);
  assert.equal(p2.cooldownRuneDamagePercent, 5);
  assert.equal(o2['햇살+'], undefined, '옮기지 않았어도 쓸모없어진 값은 버린다');
});

/* 「룬 외 피증」 칸은 없앴다 — 아는 피증 출처가 전부 자기 경로를 갖고 있어서, 이 칸에
 * 넣을 것을 아무도 못 댔다. 배선은 남겨두되 값이 0 이 아니면 불러올 때 버린다.
 *
 * 칸만 감추고 값을 두면 더 나쁘다: 화면에 안 보이는 숫자가 계산에 계속 들어가고,
 * 룬 피증과 같은 가산 그룹이라 피증 룬의 순위를 조용히 흔드는데 되돌릴 칸이 없다.
 * 실제로 이 칸은 한 번 지워졌다가 "계산에 물려 있는데 칸이 없다" 는 이유로 되살아난 적이
 * 있다. 그때 그 이유가 어디에도 안 적혀 있어서였다. */
test('룬 외 피증은 입력칸이 없고, 남은 값은 불러올 때 버린다', async () => {
  const { pruneNonRuneDamage } = await import('../src/save-migrations.mjs');
  const p = { nonRuneDamagePercent: 9.5 };
  assert.equal(pruneNonRuneDamage(p), true);
  assert.equal(p.nonRuneDamagePercent, 0);
  // 이미 0 이면 저장분을 다시 쓸 이유가 없다.
  assert.equal(pruneNonRuneDamage(p), false);
  assert.equal(pruneNonRuneDamage({}), false);
  assert.equal(pruneNonRuneDamage(null), false);
});

test('0 이 아닌 룬 외 피증은 실제로 점수를 흔든다 — 그래서 버린다', async () => {
  const { RUNES } = await import('../src/runes-data.mjs');
  const { evaluate } = await import('../src/build-evaluator.mjs');
  const { sampleProfile } = await import('./sample-profile.mjs');
  const set = ['죽음', '계승자', '침묵', '금 간 봉인', '용 사냥꾼', '승전', '해방'];
  const base = sampleProfile({ assumeVulnerable: false });
  const dirty = { ...base, nonRuneDamagePercent: 30 };
  assert.notEqual(evaluate(RUNES, set, 'expected', dirty).score,
    evaluate(RUNES, set, 'expected', base).score,
    '값이 계산에 안 들어간다면 버릴 이유도 없다 — 배선이 끊겼는지 확인할 것');
});
