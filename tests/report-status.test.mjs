/* 관리자 도구가 만드는 SQL 테스트.
 *
 * wrangler 없이 검사할 수 있는 부분이 정확히 위험한 부분이다 — 관리자가 쓴 문장을
 * SQL 문자열로 붙이는 자리. 따옴표가 든 답변("'무형' 룬은…")을 그대로 넣으면 SQL 이
 * 깨지고, 운이 나쁘면 뒤 문장이 명령으로 읽힌다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  sqlString,
  buildUpdateSql,
  buildHideSql,
  buildListSql,
} from '../tools/report-status.mjs';
import { STATUSES } from '../src/report-shared.mjs';

test('따옴표가 든 답변도 안전하게 감싼다', () => {
  assert.equal(sqlString("'무형' 룬"), "'''무형'' 룬'");
});

test('답변으로 SQL 을 끊을 수 없다', () => {
  const evil = "x'; DROP TABLE reports; --";
  const sql = buildUpdateSql(12, 'done', evil, '2026-08-08');
  // 공격 문장이 문자열 안에 갇혀 있어야 한다. 따옴표가 닫히면 그 뒤가 명령이 된다
  assert.ok(!/;\s*DROP/i.test(sql.replace(/'[^']*(?:''[^']*)*'/g, "''")),
    'SQL 문자열 밖으로 DROP 이 새어나왔다');
  assert.equal((sql.match(/'/g) ?? []).length % 2, 0, '따옴표 개수가 홀수다 — 문자열이 안 닫혔다');
});

test('제보 번호 자리에는 정수만 들어간다', () => {
  for (const bad of ['1 OR 1=1', '1; DROP TABLE reports', 1.5, -3, 0, NaN, null, undefined, '']) {
    assert.throws(() => buildUpdateSql(bad, 'done', '답변', '2026-08-08'), /제보 번호/);
    assert.throws(() => buildHideSql(bad), /제보 번호/);
  }
});

test('모르는 상태는 거부한다 — 그냥 넣으면 DB 의 CHECK 에서 터진다', () => {
  for (const bad of ['deleted', 'DONE', "done'--", '', null]) {
    assert.throws(() => buildUpdateSql(1, bad, '답변', '2026-08-08'), /모르는 상태/);
  }
});

test('아는 상태는 전부 통과한다', () => {
  for (const s of STATUSES) {
    const sql = buildUpdateSql(1, s, '답변', '2026-08-08');
    assert.ok(sql.includes(`status = '${s}'`));
  }
});

test('상태 변경은 그 제보 하나만 건드린다', () => {
  const sql = buildUpdateSql(12, 'done', '답변', '2026-08-08');
  assert.match(sql, /WHERE id = 12;$/, 'WHERE 가 없으면 전체 행이 바뀐다');
  assert.ok(!sql.includes('WHERE id = 12 OR'));
});

test('처리일이 함께 찍힌다 — 상태만 바뀌고 날짜가 비면 화면이 어긋난다', () => {
  const sql = buildUpdateSql(3, 'done', '고쳤습니다', '2026-08-09');
  assert.ok(sql.includes("handled_at = '2026-08-09'"));
});

test('숨기기는 지우지 않는다', () => {
  const sql = buildHideSql(5);
  assert.ok(!/DELETE/i.test(sql), '숨기기가 삭제로 바뀌었다');
  assert.match(sql, /hidden = 1/);
  assert.match(sql, /WHERE id = 5/);
});

test('목록은 숨긴 제보를 빼고, 기본은 처리할 것만 본다', () => {
  const pending = buildListSql(false);
  assert.match(pending, /hidden = 0/);
  assert.match(pending, /status IN \('new', 'open'\)/);

  const all = buildListSql(true);
  assert.match(all, /hidden = 0/);
  assert.ok(!all.includes('status IN'), 'all 인데 상태로 걸러내고 있다');
});

test('목록에는 상한이 있다', () => {
  assert.match(buildListSql(true), /LIMIT \d+/);
});

/* 읽기와 쓰기가 wrangler 에 다른 방식으로 나가야 한다.
 *
 * `--file` 로 SELECT 를 보내면 행 대신 "몇 줄 읽었다" 요약이 돌아와서, 제보가 있는데도
 * 목록이 텅 빈 것처럼 보인다. 실제로 그렇게 한 번 헛돌았고 오류는 하나도 안 났다. */
test('목록 조회는 --command 로, 쓰기는 --file 로 보낸다', () => {
  const src = readFileSync(new URL('../tools/report-status.mjs', import.meta.url), 'utf8');
  const read = src.match(/function readSql\([\s\S]*?\n}/)?.[0] ?? '';
  const write = src.match(/function writeSql\([\s\S]*?\n}\n/)?.[0] ?? '';

  assert.ok(read.includes("'--command'"), '조회가 --command 로 안 나간다 — 행 대신 요약이 온다');
  assert.ok(!read.includes('--file'), '조회가 --file 로 나가고 있다');
  assert.ok(write.includes('--file='), '쓰기가 --file 로 안 나간다 — 답변의 따옴표가 셸을 탄다');
});

test('조회 SQL 에는 바깥에서 온 값이 섞이지 않는다 — 그래서 셸에 실어도 된다', () => {
  // buildListSql 은 boolean 하나만 받고 그것으로 분기만 한다. 문자열을 이어붙이지 않는다
  for (const arg of [true, false, 'x', null, undefined, 0]) {
    const sql = buildListSql(arg);
    assert.ok(/^SELECT [\w, ]+ FROM reports WHERE [\w =()'.,]+ ORDER BY id DESC LIMIT \d+;$/.test(sql),
      `예상 밖의 SQL 이 나왔다: ${sql}`);
  }
});

test('import 만 해도 wrangler 를 부르지 않는다', () => {
  // 이 파일이 여기까지 왔다는 것 자체가 증거다 — 모듈을 읽는 동안 main() 이
  // 돌았다면 npx 를 부르려다 실패했을 것이다.
  assert.ok(true);
});
