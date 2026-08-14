// data/*.json 검증기 테스트.
//
// "검증기가 통과한다" 만 확인하면 아무것도 검사하지 않는 검증기도 통과한다.
// 그래서 일부러 망가뜨린 데이터를 만들어 **실제로 잡는지** 를 확인한다.
// 여기 있는 케이스들이 곧 "우리가 막기로 한 기여 실수" 의 목록이다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateData, missingBranches } from '../tools/validate-data.mjs';

/** data/ 를 임시 디렉터리로 복사하고, 한 직업 파일을 망가뜨린 뒤 검증한다. */
function withBrokenJob(job, mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'rune-data-'));
  try {
    cpSync('data', join(dir, 'data'), { recursive: true });
    const p = join(dir, 'data/jobs', `${job}.json`);
    const j = JSON.parse(readFileSync(p, 'utf8'));
    mutate(j);
    writeFileSync(p, JSON.stringify(j, null, 2));
    return validateData(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const hits = (errors, needle) => errors.filter((e) => e.includes(needle));

test('현재 data/ 는 검증을 통과한다', () => {
  assert.deepEqual(validateData('.'), []);
});

test('effects 경로 오타를 잡는다 — 이게 가장 조용히 죽는 실수다', () => {
  const errors = withBrokenJob('댄서', (j) => {
    j.nightBlessing.effects = { 'finalDamge.percent': 40 }; // finalDamage 오타
  });
  assert.equal(hits(errors, 'finalDamge.percent').length, 1, errors.join('\n'));
});

test('evidence 없는 항목을 거부한다', () => {
  const errors = withBrokenJob('댄서', (j) => { delete j.nightBlessing.evidence; });
  assert.equal(hits(errors, 'evidence 가 없다').length, 1, errors.join('\n'));
});

test('measured 인데 무엇을 쟀는지 없으면 거부한다', () => {
  const errors = withBrokenJob('댄서', (j) => {
    j.nightBlessing.evidence = [{ type: 'measured', date: '2026-08-07' }];
  });
  assert.equal(hits(errors, 'note 에 적어야 한다').length, 1, errors.join('\n'));
});

test('evidence 날짜 형식을 검사한다', () => {
  const errors = withBrokenJob('댄서', (j) => {
    j.nightBlessing.evidence = [{ type: 'tooltip', date: '2026년 8월' }];
  });
  assert.equal(hits(errors, 'YYYY-MM-DD').length, 1, errors.join('\n'));
});

// 근거의 무게는 검증 비용에 맞춘다. 게임이 직접 표기한 값은 누가 옮겨 적어도 같은 값이라
// '어디서 봤는지'를 물을 것이 없고, 해석이 들어간 값은 그게 없으면 아무도 확인을 못 한다.
// 여기를 구분하지 않으면 기여자는 툴팁 숫자 하나 고치는 데도 설명을 지어내게 된다.
test('tooltip 은 type 과 date 만으로 통과한다 — 게임 표기 자체가 근거다', () => {
  const errors = withBrokenJob('댄서', (j) => {
    j.nightBlessing.evidence = [{ type: 'tooltip', date: '2026-08-05' }];
  });
  assert.deepEqual(errors, [], '툴팁 근거에 설명을 강요하면 안 된다');
});

test('official 도 마찬가지다', () => {
  const errors = withBrokenJob('댄서', (j) => {
    j.nightBlessing.evidence = [{ type: 'official', date: '2026-08-05' }];
  });
  assert.deepEqual(errors, []);
});

test('community 는 무엇이라고 하는지가 있어야 한다 — 없으면 확인할 길이 없다', () => {
  const errors = withBrokenJob('댄서', (j) => {
    j.nightBlessing.evidence = [{ type: 'community', date: '2026-08-05' }];
  });
  assert.equal(hits(errors, 'note 에 적어야 한다').length, 1,
    'community 까지 풀어주면 완화가 아니라 규칙을 없앤 것이다');
});

/* evidence 에는 출처를 적는 자리가 없다. 금지 목록을 관리하는 대신 자리를 두지 않았다 —
 * 자리가 없으면 무엇을 적을지 고민할 일도 없고, 새로 만들어 쓰는 것도 여기서 막힌다. */
test('evidence 에 스키마에 없는 속성을 넣으면 거부한다', () => {
  const errors = withBrokenJob('댄서', (j) => {
    j.nightBlessing.evidence = [{ type: 'tooltip', date: '2026-08-05', source: '어딘가' }];
  });
  assert.equal(hits(errors, '쓸 수 있는 속성은').length, 1, errors.join('\n'));
});

test('속성 이름 오타도 같은 자리에서 걸린다', () => {
  const errors = withBrokenJob('댄서', (j) => {
    j.nightBlessing.evidence = [{ type: 'tooltip', date: '2026-08-05', notes: '오타' }];
  });
  assert.equal(hits(errors, '쓸 수 있는 속성은').length, 1, errors.join('\n'));
});

test('모르는 confidence 값을 거부한다', () => {
  const errors = withBrokenJob('댄서', (j) => { j.nightBlessing.confidence = '확실함'; });
  assert.equal(hits(errors, 'confidence 는').length, 1, errors.join('\n'));
});

test('속성 이름 오타를 잡는다 — 조용히 무시되는 자리다', () => {
  const errors = withBrokenJob('댄서', (j) => {
    j.nightBlessing.effect = j.nightBlessing.effects; // effects 를 effect 로
  });
  assert.equal(hits(errors, '모르는 속성 "effect"').length, 1, errors.join('\n'));
});

test('선언되지 않은 입력을 참조하면 잡는다', () => {
  const errors = withBrokenJob('검술사', (j) => {
    j.uptimePassives[0].uptimePercentFrom = 'notDeclaredKey';
  });
  assert.equal(hits(errors, 'notDeclaredKey').length, 1, errors.join('\n'));
});

test('입력의 default 가 범위 밖이면 잡는다', () => {
  const errors = withBrokenJob('검술사', (j) => { j.inputs[0].default = 150; });
  assert.equal(hits(errors, 'default 가 max 보다 크다').length, 1, errors.join('\n'));
});

test('파일명과 job 이 어긋나면 잡는다 — 고쳐도 반영 안 되는 상태다', () => {
  const errors = withBrokenJob('댄서', (j) => { j.job = '무희'; });
  assert.ok(hits(errors, '파일명이 job 과 다르다').length >= 1, errors.join('\n'));
});

test('숙련 표와 직업 파일이 어긋나면 잡는다', () => {
  const errors = withBrokenJob('댄서', (j) => { j.mastery = '수호'; });
  assert.ok(hits(errors, '수호').length >= 1, errors.join('\n'));
});

test('effects 값이 숫자가 아니면 잡는다', () => {
  const errors = withBrokenJob('댄서', (j) => {
    j.nightBlessing.effects = { 'finalDamage.percent': '40%' };
  });
  assert.equal(hits(errors, '숫자가 아니다').length, 1, errors.join('\n'));
});

/** data/ 를 임시로 복사해 artifacts.json 을 망가뜨린 뒤 검증한다. */
function withBrokenArtifacts(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'rune-art-'));
  try {
    cpSync('data', join(dir, 'data'), { recursive: true });
    const p = join(dir, 'data/artifacts.json');
    const a = JSON.parse(readFileSync(p, 'utf8'));
    mutate(a);
    writeFileSync(p, JSON.stringify(a, null, 2));
    return validateData(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('아티팩트의 effects 경로 오타도 잡는다', () => {
  const errors = withBrokenArtifacts((a) => {
    a.items[0].effects = { 'attackIncrese.itemAttackPercent': 2 };
  });
  assert.equal(hits(errors, 'attackIncrese').length, 1, errors.join('\n'));
});

test('아티팩트 이름 중복을 잡는다 — 개수 세기가 이름을 키로 쓴다', () => {
  const errors = withBrokenArtifacts((a) => { a.items[1].name = a.items[0].name; });
  assert.ok(hits(errors, '중복이다').length >= 1, errors.join('\n'));
});

test('unique 가 빠지면 잡는다 — 중복 착용 합산 여부가 갈린다', () => {
  const errors = withBrokenArtifacts((a) => { delete a.items[0].unique; });
  assert.equal(hits(errors, 'unique 가 true/false').length, 1, errors.join('\n'));
});

/** data/ 를 임시로 복사해 rune-conditionals.json 을 망가뜨린 뒤 검증한다. */
function withBrokenConditionals(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'rune-cond-'));
  try {
    cpSync('data', join(dir, 'data'), { recursive: true });
    const p = join(dir, 'data/rune-conditionals.json');
    const c = JSON.parse(readFileSync(p, 'utf8'));
    mutate(c);
    writeFileSync(p, JSON.stringify(c, null, 2));
    return validateData(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const firstRune = () => Object.keys(
  JSON.parse(readFileSync('data/rune-conditionals.json', 'utf8')).RUNE_CONDITIONALS)[0];

test('조건부의 field 경로 오타를 잡는다', () => {
  const errors = withBrokenConditionals((c) => {
    c.RUNE_CONDITIONALS[firstRune()][0].field = 'enhancement.heavyDamagePercnt';
  });
  assert.equal(hits(errors, 'heavyDamagePercnt').length, 1, errors.join('\n'));
});

test('모르는 expectedFrom 을 잡는다 — 조용히 0 이 되는 자리다', () => {
  const errors = withBrokenConditionals((c) => {
    c.RUNE_CONDITIONALS[firstRune()][0].expectedFrom = 'castCycl';
  });
  assert.equal(hits(errors, 'castCycl').length, 1, errors.join('\n'));
});

test('모르는 uptimeFrom 을 잡는다', () => {
  const errors = withBrokenConditionals((c) => {
    c.RUNE_CONDITIONALS['초월'][0].uptimeFrom = 'extraRat';
  });
  assert.equal(hits(errors, 'extraRat').length, 1, errors.join('\n'));
});

test('기대값을 만들 방법이 하나도 없으면 잡는다', () => {
  const errors = withBrokenConditionals((c) => {
    const e = c.RUNE_CONDITIONALS[firstRune()][0];
    delete e.expectedFrom; delete e.uptimeFrom; delete e.trigger; delete e.branch;
    e.expected = null;
  });
  assert.equal(hits(errors, '기대값을 만들 방법이 없다').length, 1, errors.join('\n'));
});

test('한 룬 안에서 label 이 겹치면 잡는다 — 화면에서 구분이 안 된다', () => {
  const errors = withBrokenConditionals((c) => {
    c.RUNE_CONDITIONALS['초월'][1].label = c.RUNE_CONDITIONALS['초월'][0].label;
  });
  assert.equal(hits(errors, '화면에서 두 옵션을 구분할 수 없다').length, 1, errors.join('\n'));
});

// id 는 사용자 조정값의 저장 키다. 여기가 뚫리면 브라우저에 남은 값을 못 찾거나
// 남의 값을 읽는데, 둘 다 화면에는 그냥 '기본값' 으로 보여서 아무도 눈치채지 못한다.
test('조건부에 id 가 없으면 잡는다 — 사용자 조정값의 저장 키다', () => {
  const errors = withBrokenConditionals((c) => { delete c.RUNE_CONDITIONALS['초월'][0].id; });
  assert.equal(hits(errors, 'id 가 없다').length, 1, errors.join('\n'));
});

test('한 룬 안에서 id 가 겹치면 잡는다 — 조정값이 서로 덮어쓴다', () => {
  const errors = withBrokenConditionals((c) => {
    c.RUNE_CONDITIONALS['초월'][1].id = c.RUNE_CONDITIONALS['초월'][0].id;
  });
  assert.equal(hits(errors, '중복이다 — 두 옵션의 사용자 조정값').length, 1, errors.join('\n'));
});

/* 표에서 빠진 스탯은 에러가 아니라 '중립' 으로 조용히 떨어진다 — 화면에 색만 안 붙고
 * 아무 신호가 없다. 새 룬을 넣는 사람이 가장 빠뜨리기 쉬운 자리다. */
test('유틸 스탯이 STAT_BETTER_WHEN 에 없으면 잡는다 — 이득/손해가 안 정해진다', () => {
  const errors = withBrokenConditionals((c) => { delete c.STAT_BETTER_WHEN['이동 속도']; });
  assert.ok(hits(errors, 'STAT_BETTER_WHEN 에 없다').length > 0, errors.join('\n'));
});

test('높을수록/낮을수록 이외의 값을 잡는다', () => {
  const errors = withBrokenConditionals((c) => { c.STAT_BETTER_WHEN['이동 속도'] = '좋음'; });
  assert.equal(hits(errors, '높을수록 또는 낮을수록').length, 1, errors.join('\n'));
});

test('아무 룬도 안 쓰는 STAT_BETTER_WHEN 줄을 잡는다 — 죽은 줄은 낡는다', () => {
  const errors = withBrokenConditionals((c) => { c.STAT_BETTER_WHEN['없는 스탯'] = '높을수록'; });
  assert.equal(hits(errors, '쓰는 룬이 없다').length, 1, errors.join('\n'));
});

/* NEGATIVE_TRAITS 는 손으로 판단해 적는 유일한 분류다. 손 목록이라 오타가 나는데,
 * 틀린 이름은 배지도 필터도 페널티 문장도 못 만들고 개수만 하나 줄어든다 —
 * 화면 어디에도 에러가 안 뜨므로 아무도 눈치채지 못한다. */
test('부정 효과 목록의 룬 이름 오타를 잡는다 — 그 룬만 조용히 아무 데도 안 걸린다', () => {
  const errors = withBrokenConditionals((c) => { c.NEGATIVE_TRAITS.moveSpeed.runes[0] = '억눌린 충돌'; });
  assert.equal(hits(errors, '억눌린 충돌').length, 1, errors.join('\n'));
});

test('부정 효과의 desc 가 비면 잡는다 — 「계산 밖」 목록에 그대로 나가는 문장이다', () => {
  const errors = withBrokenConditionals((c) => { c.NEGATIVE_TRAITS.moveSpeed.desc = '  '; });
  assert.equal(hits(errors, 'desc 가 없다').length, 1, errors.join('\n'));
});

test('룬이 하나도 없는 부정 효과를 잡는다 — 아무것도 안 거르는 필터 버튼이 생긴다', () => {
  const errors = withBrokenConditionals((c) => { c.NEGATIVE_TRAITS.moveSpeed.runes = []; });
  assert.equal(hits(errors, 'runes 가 비었다').length, 1, errors.join('\n'));
});

test('id 에 라벨을 그대로 넣으면 잡는다 — 문구를 고치면 조정값이 날아가던 그 구조다', () => {
  const errors = withBrokenConditionals((c) => {
    const e = c.RUNE_CONDITIONALS['초월'][0];
    e.id = e.label;
  });
  assert.equal(hits(errors, '소문자 영문 슬러그').length, 1, errors.join('\n'));
});

// 직업 데이터의 evidence 규칙(checkEvidence)을 룬 조건부에도 그대로 재사용한다.
// 형식이 갈라지면 기여자가 두 종류의 규칙을 배워야 하므로, 여기서도 같은 실수를 같은
// 메시지로 잡는지 확인한다.
test('조건부에 evidence 가 없으면 잡는다 — 직업 데이터와 같은 규칙이다', () => {
  const errors = withBrokenConditionals((c) => { delete c.RUNE_CONDITIONALS['초월'][0].evidence; });
  assert.equal(hits(errors, 'evidence 가 없다').length, 1, errors.join('\n'));
});

test('조건부에서 measured 인데 무엇을 쟀는지 없으면 거부한다', () => {
  const errors = withBrokenConditionals((c) => {
    c.RUNE_CONDITIONALS['초월'][0].evidence = [{ type: 'measured', date: '2026-08-05' }];
  });
  assert.equal(hits(errors, 'note 에 적어야 한다').length, 1, errors.join('\n'));
});

test('조건부 evidence 의 날짜 형식을 검사한다', () => {
  const errors = withBrokenConditionals((c) => {
    c.RUNE_CONDITIONALS['초월'][0].evidence = [{ type: 'tooltip', date: '2026년 8월' }];
  });
  assert.equal(hits(errors, 'YYYY-MM-DD').length, 1, errors.join('\n'));
});

test('다른 룬끼리는 id 가 같아도 된다 — 저장 키가 룬 이름으로 나뉜다', () => {
  const byRune = JSON.parse(readFileSync('data/rune-conditionals.json', 'utf8')).RUNE_CONDITIONALS;
  const all = Object.values(byRune).flatMap((es) => es.map((e) => e.id));
  assert.ok(new Set(all).size < all.length, 'id 가 전역 유일하면 이 규칙이 실수로 좁아진 것이다');
  assert.deepEqual(validateData('.'), []);
});

// ── 룬 조건부의 오타·구멍 ─────────────────────────────────
// 직업 데이터에는 있던 오타 방지가 여기만 빠져 있었다. 평가기는 모르는 속성을 그냥 안 읽으므로
// basis 를 baisis 로 적어도 에러가 안 나고 그 설정만 사라진다.
test('조건부 항목의 오타난 속성을 잡는다 — 직업 데이터와 같은 규칙이다', () => {
  const errors = withBrokenConditionals((c) => {
    const e = c.RUNE_CONDITIONALS[firstRune()][0];
    e.baisis = e.basis;
    delete e.basis;
  });
  assert.equal(hits(errors, 'baisis').length, 1, errors.join('\n'));
});

test('아직 안 쓰는 속성도 허용한다 — 평가기가 읽는 것은 전부 통과해야 한다', () => {
  // requires 는 build-evaluator 가 읽지만 현재 데이터에는 안 쓰인다.
  // 화이트리스트를 '지금 쓰이는 키'로 만들면 처음 쓰는 사람이 문법은 맞는데 막힌다.
  const errors = withBrokenConditionals((c) => {
    c.RUNE_CONDITIONALS[firstRune()][0].requires = ['거대한 분노'];
  });
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('formlessBranch 가 안 돌려주는 branch 이름은 에러다 — 영원히 안 켜진다', () => {
  const errors = withBrokenConditionals((c) => {
    c.RUNE_CONDITIONALS['무형'][0].branch = 'curses';  // 오타
  });
  assert.equal(hits(errors, '모르는 branch').length, 1, errors.join('\n'));
});

// 빈 분기는 에러가 아니라 경고다. 고치려면 게임을 봐야 해서, 막아버리면 답을 아는 사람이
// 나타날 때까지 아무 기여도 못 받는다. 대신 HELP-WANTED 로 올려 눈에 띄게 한다.
test('빈 분기는 검증을 막지 않는다 — 사람이 채워야 하는 구멍이다', () => {
  assert.deepEqual(validateData('.'), []);
});

test('지금 data/ 에는 빈 분기가 없다', () => {
  assert.deepEqual(missingBranches('.'), []);
});

// 위 단언만 있으면 "아무것도 안 잡는 검사" 도 통과한다. 분기를 일부러 빼서 잡히는지 본다.
test('분기를 빼면 집어낸다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rune-gap-'));
  try {
    cpSync('data', join(dir, 'data'), { recursive: true });
    const p = join(dir, 'data/rune-conditionals.json');
    const c = JSON.parse(readFileSync(p, 'utf8'));
    c.RUNE_CONDITIONALS['무형'] = c.RUNE_CONDITIONALS['무형'].filter((e) => e.branch !== 'erosion');
    writeFileSync(p, JSON.stringify(c, null, 2));
    const gaps = missingBranches(dir);
    assert.equal(gaps.length, 1, `빠진 분기를 못 잡았다: ${JSON.stringify(gaps)}`);
    assert.deepEqual(gaps[0], { rune: '무형', missing: ['erosion'] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 무형의 침식 분기는 '5초마다 공격력×101% 직접 피해' 다. 별도 타격이라 '한 대 대미지'
// 공식에 자리가 없다. 누가 좋은 뜻으로 effects 경로에 이어붙이면 무형만 부당하게 유리해진다
// — 같은 종류의 직접 피해(황금 아티팩트, 심판 폭발 등)는 전부 계산 밖이기 때문이다.
test('무형의 침식 분기는 계산에 안 들어간다고 선언돼 있다', () => {
  const c = JSON.parse(readFileSync('data/rune-conditionals.json', 'utf8'));
  const e = c.RUNE_CONDITIONALS['무형'].find((x) => x.branch === 'erosion');
  assert.ok(e, '침식 분기가 사라졌다');
  assert.ok(e.uncounted, '왜 계산에 못 넣는지 설명이 없다');
  assert.equal(e.field, undefined, 'field 가 붙었다 — 직접 피해가 수치로 계산되고 있다');
});

test('uncounted 와 field 를 함께 쓰면 막는다 — 둘 중 하나여야 한다', () => {
  const errors = withBrokenConditionals((c) => {
    const e = c.RUNE_CONDITIONALS['무형'].find((x) => x.branch === 'erosion');
    e.field = 'damageIncrease.itemMainDamagePercent';
  });
  assert.equal(hits(errors, '함께 쓸 수 없다').length, 1, errors.join('\n'));
});

test('uncounted 가 빈 문자열이면 막는다 — 이유 없는 제외는 근거 없는 수치와 같다', () => {
  const errors = withBrokenConditionals((c) => {
    c.RUNE_CONDITIONALS['무형'].find((x) => x.branch === 'erosion').uncounted = '   ';
  });
  assert.equal(hits(errors, '왜 계산에 못 넣는지').length, 1, errors.join('\n'));
});

test('분기가 다 차 있으면 아무것도 안 나온다 — 항상 뭔가 뱉는 검사가 아니다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rune-gap-'));
  try {
    cpSync('data', join(dir, 'data'), { recursive: true });
    const p = join(dir, 'data/rune-conditionals.json');
    const c = JSON.parse(readFileSync(p, 'utf8'));
    const base = c.RUNE_CONDITIONALS['무형'][0];
    c.RUNE_CONDITIONALS['무형'].push({ ...base, id: 'erosion-fill', label: '침식 분기(테스트)', branch: 'erosion' });
    writeFileSync(p, JSON.stringify(c, null, 2));
    assert.deepEqual(missingBranches(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ── 조건부 참조 필드의 구멍들 ──────────────────────────────
 * uptimeFrom 만 검증되고 형제인 rateField·streakRate 는 무검증이었다. 셋 다
 * "검증 통과 + 조용히 0(또는 엉뚱한 폴백)" 으로 끝나는 같은 뿌리의 병이다. */

test('모르는 rateField 를 잡는다 — 틀려도 에러 없이 타격 기준으로 폴백한다', () => {
  const errors = withBrokenConditionals((c) => {
    const e = c.RUNE_CONDITIONALS['끓는 피'].find((x) => x.rateField);
    e.rateField = 'skillCast'; // 's' 하나 빠짐
  });
  assert.equal(hits(errors, '모르는 rateField').length, 1, errors.join('\n'));
});

test('모르는 streakRate 를 잡는다 — profile 에 없으면 기대 중첩이 0 이 된다', () => {
  const errors = withBrokenConditionals((c) => {
    const e = c.RUNE_CONDITIONALS['거대한 분노'].find((x) => x.streakRate);
    e.streakRate = 'heavyRatePercnt';
  });
  assert.equal(hits(errors, '모르는 streakRate').length, 1, errors.join('\n'));
});

test('expectedFrom 의 파라미터가 빠지면 잡는다 — 이름만 맞고 NaN 을 거쳐 0 이 되던 자리', () => {
  const errors = withBrokenConditionals((c) => {
    const e = c.RUNE_CONDITIONALS['거대한 분노'].find((x) => x.expectedFrom === 'streak');
    delete e.perStack;
  });
  assert.equal(hits(errors, 'perStack 가 없다').length, 1, errors.join('\n'));
});

test('hitTrigger 안쪽 키 오타를 잡는다 — 중첩 객체도 같은 경로로 0 이 된다', () => {
  const errors = withBrokenConditionals((c) => {
    const [, e] = Object.values(c.RUNE_CONDITIONALS)
      .flatMap((es) => es.map((x) => [x.id, x]))
      .find(([, x]) => x.hitTrigger);
    e.hitTrigger.hitsRequird = e.hitTrigger.hitsRequired;
    delete e.hitTrigger.hitsRequired;
  });
  assert.ok(hits(errors, 'hitTrigger').length >= 1, errors.join('\n'));
});

// uptime 은 평가기가 안 읽는다. 허용해 두면 "가동률 50%" 의 뜻으로 넣은 값이
// 검증을 통과하고 계산은 그대로인, 가장 알아차리기 어려운 상태가 된다.
test('uptime 을 쓰면 막는다 — 평가기가 읽지 않는 키다', () => {
  const errors = withBrokenConditionals((c) => {
    c.RUNE_CONDITIONALS[firstRune()][0].uptime = 0.5;
  });
  assert.equal(hits(errors, '모르는 속성 "uptime"').length, 1, errors.join('\n'));
});

/* ── 무방비 목록은 파생이지 손 목록이 아니다 ──────────────
 * 손 목록이었을 때 등대지기(플래그만 있음)가 빠져서, 계산에서는 값이 꺼지는데 화면에는
 * 이유가 안 떴다. 같은 사실을 두 곳에 적으면 갈라진다 — 그 재발을 여기서 막는다. */
test('VULNERABLE_RUNES 를 데이터에 손으로 적지 않는다', () => {
  const c = JSON.parse(readFileSync('data/rune-conditionals.json', 'utf8'));
  assert.equal(c.VULNERABLE_RUNES, undefined,
    'VULNERABLE_RUNES 가 데이터에 다시 생겼다 — requiresVulnerable 과 break.* 에서 파생시킨다');
});

test('무방비 목록이 requiresVulnerable 과 break.* 를 둘 다 담는다', async () => {
  const { VULNERABLE_RUNES } = await import('../src/rune-conditionals.mjs');
  // 플래그로만 걸리는 룬(항목이 통째로 꺼진다)
  assert.ok(VULNERABLE_RUNES.includes('등대지기'), 'requiresVulnerable 룬이 빠졌다');
  // break.* 로만 걸리는 룬(값이 죽는다). 플래그가 없어서 손 목록 시절엔 빠져 있었다.
  assert.ok(VULNERABLE_RUNES.includes('아귀'), 'break.* 를 쓰는 룬이 빠졌다');
});
