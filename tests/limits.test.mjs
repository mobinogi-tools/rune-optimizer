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
    'data/rune-conditionals.json', 'src/build-evaluator.mjs', 'tools/build-data.mjs']) {
    assert.ok(doc.includes(p), `PLACEMENT.md 가 ${p} 를 안 가리킨다`);
    assert.ok(existsSync(p), `PLACEMENT.md 가 없는 파일 ${p} 를 가리킨다`);
  }
});
