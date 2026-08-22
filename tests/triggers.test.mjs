// 트리거 — 룬이 아니라 **캐릭터와 판**이 정하는 조건들.
//
// 이 파일이 있는 이유: 이 조건들은 원래 데이터에 기대값 상수로 박혀 있었고, 그 상수는
// 전부 한 직업(도트를 상시로 거는 댄서, 긴 판, 잡몹을 지나온 판) 기준이었다. 다른 직업·
// 다른 콘텐츠에서는 **에러 없이 틀린 값**이 나왔고, 화면에는 아무 신호가 없었다.
//
// 그래서 여기서 검사하는 것은 "계산이 돈다" 가 아니라 **"조건이 다르면 값이 갈린다"** 다.
// 게이트가 통째로 사라지면(항상 열림/항상 닫힘) 아래 단언들이 깨진다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, FIGHT_SECONDS_CHOICES, KILL_COUNT_CHOICES } from '../src/build-evaluator.mjs';
import { RUNES } from '../src/runes-data.mjs';
import {
  DOT_TYPES, DOT_APPLIER_RUNES, RUNE_CONDITIONALS, dotsFromRunes,
  killStepValue, fightWindowUptime, stackRampAverage,
} from '../src/rune-conditionals.mjs';
import { JOB_DOTS } from '../src/gen/jobs-data.mjs';
import { sampleProfile } from './sample-profile.mjs';

const delta = (runes, over, path) =>
  evaluate(RUNES, runes, 'expected', sampleProfile(over)).deltas[path] ?? 0;
const CRIT = 'critical.criticalDamagePercent';
const SKILL = 'damageIncrease.skillDamagePercent';
const MAIN = 'damageIncrease.itemMainDamagePercent';
const noDots = { dotTypes: {} };

// ── 지속 피해 게이트 ────────────────────────────────────

test('도트가 없으면 광채+ 의 치명타 피해는 0 이다', () => {
  // 예전에는 여기서 15% 가 나왔다. 데이터에 expected: 15 가 박혀 있었기 때문이다.
  assert.equal(delta(['광채+'], noDots, CRIT), 0);
});

test('도트를 상시로 걸면 광채+ 가 켜진다', () => {
  assert.equal(delta(['광채+'], { dotTypes: { 화상: true } }, CRIT), 15);
});

test('종류가 맞아야 켜진다 — 중독은 광채+ 를 안 연다', () => {
  // 툴팁이 나열한 네 종류(화상/빙결/감전/심판) 밖이면 안 열려야 한다.
  // 게이트를 "도트가 하나라도 있으면" 으로 뭉개면 이 단언이 깨진다.
  assert.equal(delta(['광채+'], { dotTypes: { 중독: true } }, CRIT), 0);
  assert.equal(delta(['암운+'], { dotTypes: { 중독: true } }, SKILL), 10);
});

test('세트에 부여 룬이 있으면 사람이 안 켜도 켜진다', () => {
  // 룬을 끼고도 체크를 또 해야 한다면 물어볼 필요가 없는 것을 묻는 것이다.
  assert.equal(delta(['광채+', '폭염+'], noDots, CRIT), 15);
  assert.equal(delta(['암운+', '황혼 숨결'], noDots, SKILL), 10);
});

test('게이트가 닫히면 max 시나리오에서도 0 이다', () => {
  // 다른 게이트(무방비·계열)와 같은 규칙이다. 조건이 아니면 천장도 없다.
  const max = evaluate(RUNES, ['광채+'], 'max', sampleProfile(noDots)).deltas[CRIT] ?? 0;
  assert.equal(max, 0);
});

test('게이트가 열리면 min 시나리오에도 들어간다 — 조건이 맞으면 안 꺼지는 효과다', () => {
  const min = evaluate(RUNES, ['광채+'], 'min', sampleProfile({ dotTypes: { 화상: true } })).deltas[CRIT] ?? 0;
  assert.equal(min, 15);
});

// ── 부여 룬 목록이 낡지 않았는가 ────────────────────────
//
// 이 목록이 낡으면 아무 신호 없이 틀린다 — 광채+·암운+ 가 0 으로 잡히는데 화면에는
// "그 룬은 값이 없다" 로만 보인다. 실제로 황혼 숨결과 전환+ 가 빠져 있었다.

test('룬 설명이 지속 피해를 준다고 말하면 부여 목록에 있어야 한다', () => {
  const missing = [];
  for (const r of RUNES.items) {
    const desc = r.desc ?? '';
    // "지속 피해: OO 을 준다" 꼴. 조건으로 쓰는 쪽("보유한 적 공격 시")은 제외한다.
    if (!/지속 피해\s*:/.test(desc)) continue;
    if (/(보유|부여된)[^.]*적/.test(desc)) continue;
    const types = DOT_TYPES.filter((t) => desc.includes(t));
    if (!types.length) continue; // 종류가 안 적힌 룬(정열+)은 여기서 알 수 없다
    const name = r.name.replace(/\+$/, '');
    if (!DOT_APPLIER_RUNES[r.name] && !DOT_APPLIER_RUNES[name]) missing.push(`${r.name} (${types.join('·')})`);
  }
  assert.deepEqual(missing, [],
    `설명은 지속 피해를 준다는데 DOT_APPLIER_RUNES 에 없다 — 이 룬을 껴도 광채+·암운+ 가 안 켜진다:\n${missing.join('\n')}`);
});

test('부여 룬이 남기는 종류는 실제로 그 룬 설명에 적혀 있다', () => {
  for (const [rune, types] of Object.entries(DOT_APPLIER_RUNES)) {
    const r = RUNES.items.find((x) => x.name === rune || x.name.replace(/\+$/, '') === rune);
    assert.ok(r, `${rune} 이 runes-data 에 없다`);
    for (const t of types) {
      assert.ok(r.desc.includes(t), `${rune} 의 설명에 "${t}" 가 없다 — 목록이 게임과 어긋났다`);
    }
  }
});

test('직업 기본 도트도 DOT_TYPES 안의 이름이다', () => {
  for (const [job, types] of Object.entries(JOB_DOTS)) {
    for (const t of types) assert.ok(DOT_TYPES.includes(t), `${job} 의 "${t}" 는 모르는 종류다`);
  }
});

test('dotsFromRunes 는 + 유무를 가리지 않는다', () => {
  assert.deepEqual([...dotsFromRunes(['폭염+'])], ['화상']);
  assert.deepEqual([...dotsFromRunes(['폭염'])], ['화상']);
});

// ── 처치한 잡몹 수 ──────────────────────────────────────

test('처치 수 문턱을 못 넘기면 아무것도 안 붙는다', () => {
  assert.equal(killStepValue([5, 10, 20], [3, 6, 12], 0), 0);
  assert.equal(killStepValue([5, 10, 20], [3, 6, 12], 4), 0);
});

test('문턱을 넘긴 마지막 단의 값이다 — 중간값은 아래 단에 머문다', () => {
  assert.equal(killStepValue([5, 10, 20], [3, 6, 12], 5), 3);
  assert.equal(killStepValue([5, 10, 20], [3, 6, 12], 9), 3);
  assert.equal(killStepValue([5, 10, 20], [3, 6, 12], 10), 6);
  assert.equal(killStepValue([5, 10, 20], [3, 6, 12], 20), 12);
  assert.equal(killStepValue([5, 10, 20], [3, 6, 12], 999), 12);
});

test('처치 수를 0 으로 두면 정복자+ 의 조건부 몫이 사라진다', () => {
  // 상시 피증은 남는다 — 조건부만 갈려야 한다.
  const at0 = delta(['정복자+'], { killCount: 0 }, MAIN);
  const at20 = delta(['정복자+'], { killCount: 20 }, MAIN);
  assert.equal(at20 - at0, 12);
});

test('화면 눈금은 데이터의 문턱과 짝이 맞는다', () => {
  // 눈금에 없는 문턱이 있으면 그 단은 사람이 고를 수 없다 — 데이터만 보면 안 보인다.
  for (const [rune, entries] of Object.entries(RUNE_CONDITIONALS)) {
    for (const e of entries) {
      if (e.expectedFrom !== 'killSteps') continue;
      for (const t of e.thresholds) {
        assert.ok(KILL_COUNT_CHOICES.includes(t),
          `${rune} 의 문턱 ${t} 명이 화면 눈금(${KILL_COUNT_CHOICES.join('/')})에 없다 — 고를 수 없는 단이다`);
      }
    }
  }
});

// ── 기준 전투 시간 ──────────────────────────────────────

test('전투 시작 버프는 판이 길수록 묽어진다', () => {
  assert.equal(fightWindowUptime(15, 15), 1);
  assert.equal(fightWindowUptime(15, 60), 0.25);
  // 판이 창보다 짧으면 판 내내 켜져 있다 — 1 을 넘지 않는다.
  assert.equal(fightWindowUptime(180, 60), 1);
});

test('거두는 손길은 판 길이로 갈린다', () => {
  const short = delta(['거두는 손길'], { fightSeconds: 15 }, MAIN);
  const long = delta(['거두는 손길'], { fightSeconds: 180 }, MAIN);
  assert.equal(short, 26);
  assert.ok(long < short / 10, `긴 판에서 더 커지거나 안 줄었다: ${short} → ${long}`);
});

test('차오르는 중첩은 마지막 중첩이 아니라 평균이다', () => {
  // 데미지는 판 내내 나가지 다 찬 뒤에만 나가는 것이 아니다.
  const ramp = { startStacks: 5, maxStacks: 10, secondsPerStack: 5 }; // 다 차는 데 25초
  assert.equal(stackRampAverage(ramp, 15), 6.5);
  assert.ok(Math.abs(stackRampAverage(ramp, 60) - 8.9583) < 0.001);
  // 판이 아무리 길어도 상한을 넘지 않고, 시작 중첩 아래로도 안 내려간다.
  assert.ok(stackRampAverage(ramp, 100000) < 10);
  assert.ok(stackRampAverage(ramp, 1) >= 5);
});

test('신기루 중첩 몫은 판이 길수록 커진다 — 단조롭게', () => {
  const vals = FIGHT_SECONDS_CHOICES.map((t) => delta(['신기루'], { fightSeconds: t }, MAIN));
  for (let i = 1; i < vals.length; i++) {
    assert.ok(vals[i] > vals[i - 1], `판 길이 순으로 안 커진다: ${vals.join(' → ')}`);
  }
});

// ── 룬 내 발동율 ────────────────────────────────────────

test('발동율은 기대값에만 곱한다 — min 과 max 는 그대로다', () => {
  const rate = (v) => ({ runeOverrides: { '부서진 왕관': { rate: { attack: v } } } });
  const ATT = 'attackIncrease.itemAttackPercent';
  assert.equal(delta(['부서진 왕관'], rate(100), ATT), 12);
  assert.equal(delta(['부서진 왕관'], rate(25), ATT), 3);
  assert.equal(delta(['부서진 왕관'], rate(0), ATT), 0);
  // max 는 '이 룬의 천장' 이라 사람의 플레이 방식과 무관해야 한다.
  const max = evaluate(RUNES, ['부서진 왕관'], 'max', sampleProfile(rate(0))).deltas[ATT] ?? 0;
  assert.equal(max, 12);
});

test('발동율 항목에는 무엇의 비율인지가 붙어 있다', () => {
  // 라벨이 없으면 "발동율 %" 만 뜨고, 사람은 무엇을 답하는지 모른 채 숫자를 넣는다.
  for (const [rune, entries] of Object.entries(RUNE_CONDITIONALS)) {
    for (const e of entries) {
      if (!e.rateAdjustable) continue;
      assert.ok(e.rateLabel?.trim(), `${rune}[${e.id}] 에 rateLabel 이 없다`);
    }
  }
});

test('한 조건이 여러 항목을 켜는 룬은 라벨이 같다 — 화면이 한 번만 묻는다', () => {
  // 부서진 왕관은 마력의 원 하나로 공격력과 강타 피해가 함께 붙는다. 라벨이 갈리면
  // 칸이 둘이 되고, 한쪽만 고치면 한 몸인 값이 따로 움직인다.
  const labels = RUNE_CONDITIONALS['부서진 왕관'].filter((e) => e.rateAdjustable).map((e) => e.rateLabel);
  assert.equal(new Set(labels).size, 1, `라벨이 갈렸다: ${labels.join(' / ')}`);
});
