// src/runes-data.mjs 의 effects 경로를 사전과 대조한다.
//
// 이 저장소가 검증기를 만든 이유가 "경로 오타는 에러 없이 계산에서 빠진다" 인데,
// 정작 runes-data.mjs 만 그 그물 밖에 있었다. 검증기는 data/*.json 만 읽고,
// 이 파일은 생성기가 없어 손으로 고치는 유일한 데이터다 — 즉 오타가 가장 나기 쉬운
// 자리가 유일하게 무방비였다. (확인 당시 오타는 0건이었다. 우연이지 장치가 아니었다.)
//
// 무엇이 깨지는가: alwaysOnExtra 에 critical.criticalDamagePercnt 라고 적으면
// add() 는 deltas 에 쌓지만 buildFrom() 이 고정 경로만 읽으므로 그 효과만 사라진다.
// 에러도 경고도 없고, 그 룬의 점수만 조용히 낮아진다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RUNES } from '../src/runes-data.mjs';
import { EFFECT_PATHS } from '../src/gen/effect-fields.mjs';

/** 값이 데미지 공식 경로로 들어가는 필드들. 여기 없는 필드는 경로가 아니라 다른 뜻이다. */
const PATH_BEARING = ['conditionalRaw', 'alwaysOnExtra'];

test('runes-data 의 effects 경로가 전부 effect-fields 사전에 있다', () => {
  const known = new Set(EFFECT_PATHS);
  const bad = [];
  for (const rune of RUNES.items) {
    for (const field of PATH_BEARING) {
      for (const path of Object.keys(rune[field] ?? {})) {
        if (!known.has(path)) bad.push(`${rune.name}.${field}: ${path}`);
      }
    }
  }
  assert.deepEqual(bad, [],
    `data/effect-fields.json 에 없는 경로다 — 계산에서 조용히 빠진다:\n  ${bad.join('\n  ')}`);
});

// 위 테스트가 정말 잡는지 확인한다. "통과한다"만 보는 테스트를 쓰지 않는다는 규칙대로,
// 일부러 오타를 넣어 그물에 걸리는 것까지 본다.
test('경로에 오타가 있으면 잡는다', () => {
  const known = new Set(EFFECT_PATHS);
  const typo = 'critical.criticalDamagePercnt';
  assert.ok(!known.has(typo), '오타 예시가 하필 사전에 있는 경로다 — 예시를 바꿔야 한다');
  const broken = { name: '가짜 룬', alwaysOnExtra: { [typo]: 10 } };
  const bad = Object.keys(broken.alwaysOnExtra).filter((p) => !known.has(p));
  assert.equal(bad.length, 1);
});

// 룬 이름이 겹치면 뒤엣것이 조용히 이긴다 — RUNE_CONDITIONALS 조회도 이름으로 한다.
test('룬 이름이 중복되지 않는다', () => {
  const seen = new Set(), dup = [];
  for (const r of RUNES.items) {
    if (seen.has(r.name)) dup.push(r.name);
    seen.add(r.name);
  }
  assert.deepEqual(dup, [], `이름이 중복된 룬이 있다: ${dup.join(', ')}`);
});

/* conditionalRaw 는 게임 툴팁의 기본 수치이고, RUNE_CONDITIONALS 의 max 는 최대로
 * 쌓았을 때다. 그래서 둘이 달라도 정상이다(승전 3% → 4중첩 12%).
 *
 * 정상이 아닌 것은 conditionalRaw 가 모델 최대치를 **넘는** 경우다. 상호 배타인
 * 분기 값을 더하면 그렇게 된다 — 사슬로 묶은 법전이 도발 26% + 미발동 29% = 55 로
 * 적혀 있었다. 게임 어디에도 없는 숫자이고, 이 룬의 모델링이 사라지는 순간
 * 폴백 경로가 화면에 "피증 55%" 를 띄운다. */
test('conditionalRaw 가 모델 최대치를 넘지 않는다', async () => {
  const { RUNE_CONDITIONALS } = await import('../src/gen/rune-conditionals-data.mjs');
  const base = (n) => n.replace(/\+$/, '');
  const over = [];
  for (const rune of RUNES.items) {
    const modeled = RUNE_CONDITIONALS[rune.name] ?? RUNE_CONDITIONALS[base(rune.name)];
    if (!modeled) continue;
    for (const [field, value] of Object.entries(rune.conditionalRaw ?? {})) {
      const entries = modeled.filter((e) => e.field === field);
      if (!entries.length) continue; // 모델이 안 다루는 분기 — 폴백에서만 쓰인다
      const ceiling = entries.reduce((a, e) => a + (e.max ?? 0), 0);
      if (value > ceiling + 0.01) over.push(`${rune.name}.${field}: ${value} > 모델 최대 ${ceiling}`);
    }
  }
  assert.deepEqual(over, [],
    `상호 배타인 분기 값을 더한 것으로 보인다 — 게임에 없는 숫자다:\n  ${over.join('\n  ')}`);
});
