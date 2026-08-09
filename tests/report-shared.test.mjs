/* 수치 제보 검증기 테스트.
 *
 * "통과한다" 를 보지 않는다. 상한을 우회하는 실제 수법을 넣어 **정말 막히는지** 본다.
 * 이 칸들은 로그인 없이 아무나 쓰고 그 내용이 사이트에 그대로 공개되므로,
 * 검증기가 헐거우면 화면이 망가지는 것이 곧 배포 상태가 된다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS,
  MINIMUMS,
  ANONYMOUS,
  STATUSES,
  STATUS_LABEL,
  isStatus,
  normalizeText,
  validateReport,
  todayKST,
  matchesQuery,
} from '../src/report-shared.mjs';

/** 눈에 보이지 않는 문자를 테스트 소스에 직접 적지 않는다 — 적으면 diff 에서 안 보인다. */
const ch = (code) => String.fromCodePoint(code);
const ZWSP = ch(0x200b); // 폭 없는 공백
const RLO = ch(0x202e); // 오른쪽에서 왼쪽으로 뒤집기
const NBSP = ch(0x00a0); // 줄바꿈 없는 공백
const NUL = ch(0x00);

const ok = { who: '붉은매', what: '대검전사 밤의 축복이 90초가 아니라 60초입니다', why: '실측 3회' };

test('정상 제보는 통과하고 다듬어진 값을 돌려준다', () => {
  const r = validateReport(ok);
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, {});
  assert.equal(r.value.who, '붉은매');
  assert.equal(r.value.what, ok.what);
});

test('입력자를 비우면 익명이 된다 — 빈 칸으로 저장하지 않는다', () => {
  const r = validateReport({ ...ok, who: '   ' });
  assert.equal(r.ok, true);
  assert.equal(r.value.who, ANONYMOUS);
});

test('입력자가 상한을 넘으면 막힌다', () => {
  const r = validateReport({ ...ok, who: 'ㄱ'.repeat(LIMITS.who + 1) });
  assert.equal(r.ok, false);
  assert.match(r.errors.who, /입력자/);
});

test('내용이 비면 막힌다', () => {
  const r = validateReport({ ...ok, what: '' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.what);
});

test('내용이 장난이면 막힌다 — "ㅇㅇ" 같은 것', () => {
  const r = validateReport({ ...ok, what: 'ㅇㅇ' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.what);
});

test('짧지만 정확한 제보는 통과해야 한다 — 하한이 너무 높으면 안 된다', () => {
  const r = validateReport({ ...ok, what: '기사 90초 아님' });
  assert.equal(r.ok, true, `하한 ${MINIMUMS.what}자가 정상 제보를 막고 있다`);
});

test('근거는 "툴팁" 두 글자로 끝낼 수 있다', () => {
  const r = validateReport({ ...ok, why: '툴팁' });
  assert.equal(r.ok, true);
});

test('근거가 비면 막힌다 — 근거 없는 수치를 받지 않는 것이 이 도구의 규칙이다', () => {
  const r = validateReport({ ...ok, why: '  \n \n ' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.why);
});

/* 여기서부터가 우회 시도다. 정규화를 길이 검사보다 먼저 하지 않으면 전부 통과한다. */

test('상한을 넘는 내용은 막힌다', () => {
  const r = validateReport({ ...ok, what: '가'.repeat(LIMITS.what + 1) });
  assert.equal(r.ok, false);
  assert.match(r.errors.what, /자까지/);
});

/* 아래 둘이 "정규화를 길이 검사보다 먼저 한다" 를 못박는 자리다.
 * 길이만 재면 둘 다 하한을 넘어 통과해 버린다 — 상한에는 한참 못 미치므로
 * 상한 검사로는 절대 걸리지 않는다. */

test('하한을 공백으로 채울 수 없다', () => {
  const padded = ' '.repeat(MINIMUMS.what + 12);
  assert.ok(padded.length > MINIMUMS.what, '이 표본은 안 다듬으면 하한을 넘어야 의미가 있다');
  const r = validateReport({ ...ok, what: padded });
  assert.equal(r.ok, false, '공백만으로 하한을 통과했다');
  assert.ok(r.errors.what);
});

test('하한을 줄바꿈으로 채울 수 없다', () => {
  const r = validateReport({ ...ok, what: '\n'.repeat(MINIMUMS.what + 12) });
  assert.equal(r.ok, false, '줄바꿈만으로 하한을 통과했다');
});

test('근거의 하한도 공백으로 채울 수 없다', () => {
  const r = validateReport({ ...ok, why: '   ' });
  assert.equal(r.ok, false, '공백만으로 근거를 통과했다');
  assert.ok(r.errors.why);
});

test('폭 없는 문자로 글자수를 채울 수 없다', () => {
  const r = validateReport({ ...ok, what: 'ㅇㅇ' + ZWSP.repeat(50) });
  assert.equal(r.ok, false, '폭 없는 문자가 글자수로 세어졌다');
});

test('제어문자와 양방향 뒤집기 문자는 저장되지 않는다', () => {
  const r = validateReport({ ...ok, what: `대검전사 ${RLO}밤의 축복 90초 아님${NUL}` });
  assert.equal(r.ok, true);
  assert.ok(!r.value.what.includes(RLO), '양방향 제어문자가 그대로 남았다');
  assert.ok(!r.value.what.includes(NUL), '제어문자가 그대로 남았다');
});

test('폭이 다른 공백은 지우지 않고 보통 공백으로 바꾼다 — 지우면 단어가 붙는다', () => {
  assert.equal(normalizeText(`대검전사${NBSP}밤의 축복`), '대검전사 밤의 축복');
});

test('빈 줄을 잔뜩 넣어 목록을 밀어낼 수 없다', () => {
  assert.equal(normalizeText('가\n\n\n\n\n\n나'), '가\n\n나');
});

test('문자열이 아닌 것을 보내도 터지지 않는다', () => {
  for (const junk of [null, undefined, 42, {}, [], true]) {
    assert.equal(normalizeText(junk), '');
  }
  const r = validateReport(null);
  assert.equal(r.ok, false);
  assert.equal(r.value.who, ANONYMOUS);
});

/* 날짜 — 한국 시간 새벽에 들어온 제보가 하루 전으로 찍히던 종류의 버그를 막는다. */

test('한국 시간 자정을 넘기면 날짜가 넘어간다', () => {
  // UTC 15:00 = 한국 시간 다음날 00:00
  assert.equal(todayKST(Date.UTC(2026, 7, 8, 14, 59)), '2026-08-08');
  assert.equal(todayKST(Date.UTC(2026, 7, 8, 15, 0)), '2026-08-09');
});

test('UTC 로 자르면 틀리는 시각에서 한국 날짜가 나온다', () => {
  const ms = Date.UTC(2026, 7, 8, 20, 30); // 한국 시간 8/9 05:30
  assert.equal(new Date(ms).toISOString().slice(0, 10), '2026-08-08'); // UTC 로는 하루 전
  assert.equal(todayKST(ms), '2026-08-09');
});

/* 검색·집계 */

test('검색은 관리자가 쓴 처리 내용까지 훑는다', () => {
  const r = { who: '가', what: '나', why: '다', note: '댄서 주기를 고쳤습니다' };
  assert.equal(matchesQuery(r, '댄서'), true);
  assert.equal(matchesQuery(r, '없는말'), false);
});

test('검색어가 비면 전부 통과한다', () => {
  assert.equal(matchesQuery({ what: '가' }, ''), true);
  assert.equal(matchesQuery({ what: '가' }, '   '), true);
});

test('처리 내용이 없는 제보도 검색에서 터지지 않는다', () => {
  assert.equal(matchesQuery({ who: '가', what: '나', why: '다' }, '나'), true);
});


test('모든 상태에 한국어 라벨이 있다 — 라벨 없는 상태는 화면에 빈 칩으로 나온다', () => {
  for (const s of STATUSES) {
    assert.ok(STATUS_LABEL[s], `${s} 에 라벨이 없다`);
    assert.equal(isStatus(s), true);
  }
  assert.equal(isStatus('deleted'), false);
  assert.equal(isStatus(undefined), false);
});
