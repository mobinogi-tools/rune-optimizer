// 한계를 적는 자리는 둘뿐이다 — 항목별은 uncounted, 전체는 data/limits.json.
//
// 여기서 잡는 것은 "틀린 문장"이 아니라 **같은 사실이 두 벌이 되는 것**이다. 두 벌이
// 되는 순간부터 한쪽은 반드시 낡고, 낡는 쪽은 늘 이용자가 보는 쪽이었다.
// 실제로 그랬다: README 는 "직접 피해는 계산 밖" 이라고 적어두고, 같은 얘기가
// 코드 주석·데이터·인수인계 노트에 조금씩 다른 문장으로 네 번 더 있었다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateData } from '../tools/validate-data.mjs';
import { LIMITS } from '../src/gen/limits-data.mjs';

const readText = (p) => readFileSync(p, 'utf8');
const limitsJson = () => JSON.parse(readText('data/limits.json'));

test('한계마다 왜 그런지와 그래서 어떻게 되는지가 둘 다 있다', () => {
  for (const l of LIMITS) {
    assert.ok(l.why?.trim(), `${l.id}: why 가 없다 — 이유 없는 한계는 "안 한다"로만 읽힌다`);
    assert.ok(l.effect?.trim(), `${l.id}: effect 가 없다 — 결과를 안 적으면 읽는 사람이 직접 상상한다`);
  }
});

test('why 와 effect 가 없으면 검증기가 막는다', () => {
  const broken = limitsJson();
  broken.limits[0].effect = '   ';
  const errors = validateDataWith(broken);
  assert.ok(errors.some((e) => /effect 가 비었다/.test(e)), errors.join('\n'));
});

test('structural 에 openTo 를 달면 막는다 — 못 채우는 것에 창구를 열면 답이 늘 거절이다', () => {
  const broken = limitsJson();
  const s = broken.limits.find((l) => l.kind === 'structural');
  s.openTo = 'report';
  const errors = validateDataWith(broken);
  assert.ok(errors.some((e) => /structural 인데 openTo/.test(e)), errors.join('\n'));
});

test('모르는 kind 를 막는다 — 오타난 kind 는 화면에서 라벨이 통째로 비어 나간다', () => {
  const broken = limitsJson();
  broken.limits[0].kind = 'structrual';
  const errors = validateDataWith(broken);
  assert.ok(errors.some((e) => /kind 는/.test(e)), errors.join('\n'));
});

// README 는 링크만 갖는다. 한계 문장을 여기 다시 쓰면 LIMITS.md 와 갈라지는데,
// 갈라진 것을 알아차릴 방법이 없다 — 둘 다 그럴듯하게 읽히기 때문이다.
test('README 는 한계 본문을 갖지 않고 LIMITS.md 를 가리킨다', () => {
  const readme = readText('README.md');
  assert.match(readme, /LIMITS\.md/, 'README 에서 LIMITS.md 로 가는 길이 없다');
  // limits.json 의 effect 문장이 README 에 복사돼 있으면 두 벌이 된 것이다.
  for (const l of LIMITS) {
    const head = l.effect.slice(0, 20);
    assert.ok(!readme.includes(head),
      `README 에 ${l.id} 의 문장이 복사돼 있다 — 한계 본문은 data/limits.json 한 곳에만 둔다`);
  }
});

test('생성된 LIMITS.md 가 limits.json 의 항목을 하나도 빠뜨리지 않는다', () => {
  const md = readText('LIMITS.md');
  for (const l of LIMITS) {
    assert.ok(md.includes(l.title), `LIMITS.md 에 ${l.id} 가 없다`);
    assert.ok(md.includes(l.effect), `LIMITS.md 에 ${l.id} 의 effect 가 없다`);
  }
});

// 손으로 관리하는 목록이 아니라는 것을 못박는다. 화면은 데이터를 훑어서 그리므로
// 데이터가 늘면 목록도 같이 는다 — 여기를 고칠 일이 없어야 정상이다.
test('limits-app 은 화면에 쓸 문장을 스스로 짓지 않는다', () => {
  const app = readText('src/limits-app.mjs');
  assert.ok(!/innerHTML/.test(stripComments(app)),
    'limits-app 이 innerHTML 을 쓴다 — createElement + textContent 로만 그린다');
  assert.match(app, /from '\.\/gen\/limits-data\.mjs'/, 'limits-app 이 생성물을 안 읽는다');
  assert.match(app, /from '\.\/rune-uncounted\.mjs'/,
    'limits-app 이 uncounted 판단을 따로 구현하고 있다 — rune-app 과 같은 모듈을 써야 한다');
});

// 추출한 뒤 원본이 남아 있으면 두 구현이 조용히 갈라진다.
test('uncountedOf 구현은 한 곳에만 있다', () => {
  const app = readText('src/rune-app.mjs');
  assert.ok(!/function uncountedOf/.test(app),
    'rune-app 에 uncountedOf 구현이 다시 생겼다 — src/rune-uncounted.mjs 하나여야 한다');
  assert.match(app, /from '\.\/rune-uncounted\.mjs'/, 'rune-app 이 공용 모듈을 안 쓴다');
});

/* 페널티를 설명문에서 지어내던 자리. '감소한다|사라진다' 로 훑으면 무엇이 줄어드는지를
 * 안 보므로 좋은 것이 줄어드는 것까지 전부 페널티가 됐다 — 7건 중 4건이 오탐이었다.
 * 아래 네 룬이 그 4건이다. 화면에는 상세 패널 맨 위의 desc 와 똑같은 문장이 세 줄 아래
 * '페널티' 딱지를 달고 한 번 더 나왔다. 예외를 하나씩 더하는 것으로는 안 끝난다. */
test('이득이 페널티로 잡히지 않는다 — 줄어드는 것이 무엇인지를 봐야 한다', async () => {
  const { uncountedOf } = await import('../src/rune-uncounted.mjs');
  const { RUNES } = await import('../src/runes-data.mjs');
  const penalties = (name) =>
    uncountedOf(RUNES.items.find((r) => r.name === name)).filter((u) => u.kind === '페널티');

  // 전부 desc 에 '감소한다' 또는 '사라진다' 가 있지만 넷 다 이득이다.
  for (const [name, what] of [
    ['공허', '재사용 대기 시간 3초 감소 — 쿨감이다'],
    ['다가옴+', '재사용 대기 시간 감소 — 쿨감이다'],
    ['위엄', '받는 피해 5% 감소 — 나머지도 전부 증가뿐인 문장이다'],
    ['무형', '이동 속도 감소 효과가 사라진다 — 페널티가 풀리는 것이다'],
  ]) {
    assert.deepEqual(penalties(name), [], `${name} 에 페널티가 붙었다: ${what}`);
  }
});

/* 반대 방향. 「끓는 피」(체력 소모)는 부정 효과로 선언돼 있는데 '감소한다' 가 없어서
 * 정규식에 안 걸렸고, 계산 밖 목록에 아예 안 떴다. 오탐과 누락은 같은 원인이다.
 *
 * 부정 효과 룬이 갈 수 있는 자리는 둘뿐이다 — 계산에 들어갔거나, 계산 밖 목록에 보이거나.
 * 어느 쪽도 아니면 사용자에게는 그냥 좋은 룬으로 보인다. */
test('부정 효과로 선언한 룬은 계산에 들어갔거나 계산 밖 목록에 보이거나 둘 중 하나다', async () => {
  const { uncountedOf } = await import('../src/rune-uncounted.mjs');
  const { RUNES } = await import('../src/runes-data.mjs');
  const { NEGATIVE_TRAITS, RUNE_CONDITIONALS } = await import('../src/rune-conditionals.mjs');
  for (const t of Object.values(NEGATIVE_TRAITS)) {
    for (const name of t.runes) {
      const r = RUNES.items.find((x) => x.name === name);
      const counted = (RUNE_CONDITIONALS[name] ?? []).some((e) => e.field && e.min < 0);
      assert.ok(counted || uncountedOf(r).some((u) => u.neg),
        `${name} 은 부정 효과(${t.label})로 선언됐는데 계산에도 안 들어가고 계산 밖 목록에도 안 뜬다`);
    }
  }
});

/* 반대로, 계산에 들어간 페널티를 「계산에 안 들어간 것」에 또 올리면 거짓말이 된다.
 * 「추적자」의 자기 강타 디버프는 음수 항(min −20)으로 점수에 이미 반영된다.
 * 오염 지속시간이 바로 위에서 같은 이유로 빠지는데, 그 판단이 여기만 빠져 있었다. */
test('계산에 들어간 페널티는 계산 밖 목록에 올리지 않는다 — 이중 계산을 부른다', async () => {
  const { uncountedOf } = await import('../src/rune-uncounted.mjs');
  const { RUNES } = await import('../src/runes-data.mjs');
  const { RUNE_CONDITIONALS } = await import('../src/rune-conditionals.mjs');
  const modeled = RUNE_CONDITIONALS['추적자'] ?? [];
  assert.ok(modeled.some((e) => e.field && e.min < 0),
    '추적자의 자기 디버프가 더 이상 음수 항으로 모델링돼 있지 않다 — 이 테스트의 전제가 깨졌다');
  const r = RUNES.items.find((x) => x.name === '추적자');
  assert.deepEqual(uncountedOf(r).filter((u) => u.kind === '페널티'), [],
    '추적자의 자기 디버프가 계산에 들어갔는데도 「계산에 안 들어간 것」에 또 올라간다');
});

/* 유틸 항목의 이득/손해도 같은 실수를 하고 있었다 — '감소' 면 손해로 칠했다.
 * 무엇이 움직였는지를 봐야 한다. 받는 피해는 줄면 이득이고 늘면 손해다. */
test('줄어드는 것이 이득이면 손해로 칠하지 않는다', async () => {
  const { uncountedOf } = await import('../src/rune-uncounted.mjs');
  const { RUNES } = await import('../src/runes-data.mjs');
  const util = (name) => uncountedOf(RUNES.items.find((r) => r.name === name)).filter((u) => u.kind === '유틸');

  // 받는 피해 감소 = 이득. 예전에는 이 넷이 손해로 빨갛게 나왔다.
  for (const name of ['여신', '녹슨 방패', '맹세+']) {
    for (const u of util(name).filter((u) => /받는 피해.*감소/.test(u.text))) {
      assert.equal(u.neg, false, `${name} 의 "${u.text}" 가 손해로 표시된다 — 받는 피해가 줄면 이득이다`);
    }
  }
  // 반대 방향. 받는 피해 증가는 손해인데 아무 표시도 안 났다.
  const 무형 = util('무형').find((u) => /받는 피해.*증가/.test(u.text));
  assert.equal(무형?.neg, true, '무형의 "받는 피해 30% 증가" 가 손해로 표시되지 않는다');
});

/* 공허는 페널티에서 빼고 나서 「계산에 안 들어간 것」 에도 안 넣어, 쿨감 얘기가 화면
 * 어디에도 없는 상태가 됐다. 값이 안 들어가는 것과 말이 없는 것은 다르다 —
 * 유틸 항목이 있어야 보정 입력칸도 생긴다(rune-app 의 hasUtilSlot). */
test('공허의 쿨감이 계산 밖 항목으로 보이고, 손해가 아니다', async () => {
  const { uncountedOf } = await import('../src/rune-uncounted.mjs');
  const { RUNES } = await import('../src/runes-data.mjs');
  const items = uncountedOf(RUNES.items.find((r) => r.name === '공허'));
  const util = items.filter((u) => u.kind === '유틸');
  assert.equal(util.length, 1, '공허의 쿨감이 계산 밖 목록에 없다 — 보정 입력칸도 같이 사라진다');
  assert.match(util[0].text, /재사용 대기 시간 3초 감소/, `단위가 % 로 새어 나갔다: ${util[0].text}`);
  assert.equal(util[0].neg, false, '쿨감이 손해로 표시된다');
  assert.deepEqual(items.filter((u) => u.kind === '페널티'), [], '공허에 페널티가 다시 붙었다');
});

/* 판단이 두 곳에 있으면 갈라진다 — 실제로 갈라져 있었다. 정규식은 공허·위엄·다가옴+·
 * 무형·추적자를 페널티로 봤고 NEGATIVE_TRAITS 에는 그 다섯이 다 없었다. */
test('페널티 판단은 부정 효과 목록 하나에서만 나온다 — 설명문을 훑지 않는다', () => {
  const src = stripComments(readText('src/rune-uncounted.mjs'));
  assert.match(src, /NEGATIVE_TRAITS/,
    '페널티가 NEGATIVE_TRAITS 에서 안 나온다 — 사람 판단 목록이 그것 하나다');
  assert.ok(!/rune\.desc/.test(src),
    'uncountedOf 가 다시 rune.desc 를 훑는다 — 이득까지 페널티로 잡히던 방식이다');
});

/** 금지어 검사는 코드만 봐야 한다. 주석까지 보면 "innerHTML 을 쓰지 마라" 고 적어둔
 *  주석 자체가 위반으로 잡힌다 — 실제로 이 테스트가 처음에 그렇게 걸렸다. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** data/limits.json 만 바꿔치기해 검증기를 돌린다. 다른 데이터는 진짜 파일을 그대로 쓴다. */
function validateDataWith(limits) {
  const dir = mkdtempSync(join(tmpdir(), 'rune-limits-'));
  try {
    cpSync('data', join(dir, 'data'), { recursive: true });
    writeFileSync(join(dir, 'data/limits.json'), JSON.stringify(limits, null, 2));
    return validateData(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/* PLACEMENT.md 가 "이건 파생시킨다" 고 약속한 것들. 문서만 있으면 다음 사람이
 * 모르고 손 목록을 다시 만든다 — 실제로 무방비 목록이 그렇게 갈라졌다.
 * 규칙이 지켜지는 이유는 문서가 아니라 검사다. */
test('배치 규칙 문서가 가리키는 파생 자리들이 실제로 파생이다', async () => {
  const { EXPECTED_FROM_NAMES, EXPECTED_FROM_PARAMS } = await import('../src/build-evaluator.mjs');
  assert.deepEqual([...EXPECTED_FROM_NAMES], Object.keys(EXPECTED_FROM_PARAMS),
    'EXPECTED_FROM_NAMES 를 손으로 적었다 — EXPECTED_FROM_PARAMS 의 키에서 나와야 한다');

  const src = readText('src/rune-conditionals.mjs');
  assert.match(src, /VULNERABLE_RUNES = Object\.freeze\(\[\.\.\.new Set/,
    '무방비 목록이 파생이 아니다 — 손 목록으로 되돌아갔다');
});

test('배치 규칙 문서가 실제 파일들을 가리킨다', () => {
  const doc = readText('docs/PLACEMENT.md');
  for (const p of ['data/limits.json', 'data/effect-fields.json', 'src/runes-data.mjs',
    'data/rune-conditionals.json', 'src/build-evaluator.mjs', 'tools/build-data.mjs',
    'src/rune-uncounted.mjs']) {
    assert.ok(doc.includes(p), `PLACEMENT.md 가 ${p} 를 안 가리킨다`);
    assert.ok(existsSync(p), `PLACEMENT.md 가 없는 파일 ${p} 를 가리킨다`);
  }
});
