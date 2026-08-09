/* 제보 API 테스트.
 *
 * D1 이 없어도 핸들러는 검사할 수 있다 — prepare/bind/all/first 만 흉내내면 된다.
 * 여기서 못박는 것은 두 종류다:
 *
 *   1) **새어나가면 안 되는 것이 안 새는가** — ip_hash 와 hidden 은 어떤 응답에도
 *      나오면 안 된다. SELECT * 하나로 조용히 새는 자리다.
 *   2) **막아야 하는 것이 막히는가** — 검증 실패, 허니팟, 시간당 횟수, 본문 크기.
 *
 * schema.sql 과 report-shared.mjs 가 어긋나는 것도 여기서 잡는다. 상태 목록이 두 곳에
 * 있는데 한쪽만 고치면, 새 상태를 쓰는 순간 DB 가 거절하고 관리자 도구만 실패한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { STATUSES, LIMITS, ANONYMOUS } from '../src/report-shared.mjs';
import { onRequestGet, onRequestPost } from '../functions/api/reports.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const schemaSql = readFileSync(`${root}schema.sql`, 'utf8');
const apiSource = readFileSync(`${root}functions/api/reports.js`, 'utf8');

/* ── schema.sql 과 코드가 같은 것을 보고 있는가 ───────────────────────────── */

test('schema.sql 의 상태 목록이 STATUSES 와 같다', () => {
  const m = schemaSql.match(/CHECK\s*\(status IN \(([^)]*)\)\)/);
  assert.ok(m, 'schema.sql 에 status CHECK 가 없다');
  const inSchema = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  assert.deepEqual(
    inSchema.slice().sort(),
    STATUSES.slice().sort(),
    'schema.sql 과 report-shared.mjs 의 상태 목록이 어긋났다',
  );
});

test('SELECT * 를 쓰지 않는다 — 쓰면 ip_hash 가 그대로 응답에 실린다', () => {
  assert.ok(!/SELECT\s+\*/i.test(apiSource), 'SELECT * 가 있다');
});

test('공개 컬럼 목록에 감춰야 할 컬럼이 없다', () => {
  const m = apiSource.match(/PUBLIC_COLUMNS\s*=\s*'([^']+)'/);
  assert.ok(m, 'PUBLIC_COLUMNS 를 찾지 못했다');
  const cols = m[1].split(',').map((s) => s.trim());
  for (const secret of ['ip_hash', 'hidden', 'created_ms']) {
    assert.ok(!cols.includes(secret), `${secret} 가 공개 컬럼에 있다`);
  }
});

test('공개 컬럼은 전부 schema.sql 에 실제로 있는 컬럼이다', () => {
  const declared = new Set(
    schemaSql
      .split('\n')
      .map((l) => l.trim().match(/^([a-z_]+)\s+(INTEGER|TEXT)\b/))
      .filter(Boolean)
      .map((m) => m[1]),
  );
  const cols = apiSource.match(/PUBLIC_COLUMNS\s*=\s*'([^']+)'/)[1]
    .split(',')
    .map((s) => s.trim());
  for (const c of cols) {
    assert.ok(declared.has(c), `${c} 가 schema.sql 에 없다 — 조회가 런타임에 터진다`);
  }
});

/* ── D1 흉내 ─────────────────────────────────────────────────────────────── */

function makeDb({ recentCount = 0, rows = [], throwOn = null } = {}) {
  const calls = [];
  const db = {
    calls,
    prepare(sql) {
      const stmt = {
        args: [],
        bind(...a) {
          stmt.args = a;
          return stmt;
        },
        async all() {
          calls.push({ sql, args: stmt.args });
          if (throwOn && sql.includes(throwOn)) throw new Error('DB 터짐');
          return { results: rows };
        },
        async first() {
          calls.push({ sql, args: stmt.args });
          if (throwOn && sql.includes(throwOn)) throw new Error('DB 터짐');
          if (/COUNT\(\*\)/.test(sql)) return { n: recentCount };
          if (/INSERT/.test(sql)) {
            return {
              id: 7,
              who: stmt.args[0],
              what: stmt.args[1],
              why: stmt.args[2],
              status: 'new',
              note: '',
              created_at: stmt.args[3],
              handled_at: '',
            };
          }
          return null;
        },
      };
      return stmt;
    },
  };
  return db;
}

function post(body, { ip = '203.0.113.9', headers = {} } = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return new Request('https://rune.askhyung.com/api/reports', {
    method: 'POST',
    body: raw,
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...headers },
  });
}

const good = {
  who: '붉은매',
  what: '대검전사 밤의 축복이 90초가 아니라 60초입니다',
  why: '실측 3회',
};

/* ── GET ─────────────────────────────────────────────────────────────────── */

test('GET: 바인딩이 없으면 503 이고, 0건과 구분된다', async () => {
  const res = await onRequestGet({ env: {} });
  assert.equal(res.status, 503);
  const b = await res.json();
  assert.ok(b.error, '오류 메시지가 없으면 화면이 "제보 0건" 으로 그린다');
  assert.equal(b.reports, undefined);
});

test('GET: 목록을 돌려준다', async () => {
  const rows = [{ id: 2, who: '가', what: '나', why: '다', status: 'new', note: '', created_at: '2026-08-08', handled_at: '' }];
  const res = await onRequestGet({ env: { REPORTS_DB: makeDb({ rows }) } });
  assert.equal(res.status, 200);
  const b = await res.json();
  assert.equal(b.reports.length, 1);
  assert.equal(b.truncated, false);
});

test('GET: 숨긴 제보는 조회에서 빠진다', async () => {
  const db = makeDb();
  await onRequestGet({ env: { REPORTS_DB: db } });
  assert.match(db.calls[0].sql, /hidden = 0/, '숨김 조건 없이 조회하고 있다');
});

/* 여기가 이 API 의 가장 중요한 성질이다.
 *
 * 반영된 것만 내보내면 검증 안 된 남의 주장도, 스팸도 사이트에 안 걸린다.
 * 이 조건이 빠지면 아무 오류 없이 모든 제보가 그대로 공개된다 — 되돌릴 수 없는 종류의 사고다. */
test('GET: 반영된 제보만 내보낸다 — 대기·확인 중·반영 안 함은 공개되지 않는다', async () => {
  const db = makeDb();
  await onRequestGet({ env: { REPORTS_DB: db } });
  const { sql, args } = db.calls[0];
  assert.match(sql, /status = \?/, '상태 조건 없이 조회하고 있다 — 전부 공개된다');
  assert.ok(args.includes('done'), `공개 상태가 done 이 아니다: ${JSON.stringify(args)}`);
  for (const hidden of ['new', 'open', 'no']) {
    assert.ok(!args.includes(hidden), `${hidden} 상태가 공개 조회에 들어갔다`);
  }
});

test('GET: 상태를 문자열로 이어붙이지 않는다 — 바인딩으로 넘긴다', async () => {
  assert.ok(!/status = '/.test(apiSource), 'SQL 에 상태를 직접 끼워 넣고 있다');
});

test('GET: 반영 날짜 순으로 내보낸다 — 고친 순서가 곧 읽는 순서다', async () => {
  const db = makeDb();
  await onRequestGet({ env: { REPORTS_DB: db } });
  assert.match(db.calls[0].sql, /ORDER BY handled_at DESC/);
});

test('GET: DB 가 터지면 500 이고 빈 목록으로 위장하지 않는다', async () => {
  const res = await onRequestGet({ env: { REPORTS_DB: makeDb({ throwOn: 'SELECT' }) } });
  assert.equal(res.status, 500);
  const b = await res.json();
  assert.ok(b.error);
  assert.equal(b.reports, undefined);
});

test('GET: 응답은 캐시되지 않는다 — 등록 직후 자기 글이 안 보이면 다시 쓴다', async () => {
  const res = await onRequestGet({ env: { REPORTS_DB: makeDb() } });
  assert.match(res.headers.get('cache-control'), /no-store/);
});

/* ── POST ────────────────────────────────────────────────────────────────── */

test('POST: 정상 제보는 저장되고 201 로 답한다', async () => {
  const db = makeDb();
  const res = await onRequestPost({ request: post(good), env: { REPORTS_DB: db } });
  assert.equal(res.status, 201);
  const b = await res.json();
  assert.equal(b.ok, true);
  assert.equal(b.report.who, '붉은매');
  assert.equal(b.report.status, 'new', '새 제보는 대기 상태로 들어가야 한다');
  assert.ok(db.calls.some((c) => /INSERT/.test(c.sql)));
});

test('POST: 상태와 처리 내용은 제보자가 정할 수 없다', async () => {
  const db = makeDb();
  await onRequestPost({
    request: post({ ...good, status: 'done', note: '내가 반영했다고 적어둠', id: 1, hidden: 1 }),
    env: { REPORTS_DB: db },
  });
  const insert = db.calls.find((c) => /INSERT/.test(c.sql));
  assert.ok(!/status|note|hidden/.test(insert.sql.split('VALUES')[0].replace(/created_\w+/g, '')),
    'INSERT 가 제보자에게서 온 status/note/hidden 을 받고 있다');
  assert.ok(!insert.args.includes('done'));
  assert.ok(!insert.args.includes('내가 반영했다고 적어둠'));
});

test('POST: 입력자를 비우면 익명으로 저장된다', async () => {
  const db = makeDb();
  const res = await onRequestPost({ request: post({ ...good, who: '' }), env: { REPORTS_DB: db } });
  const b = await res.json();
  assert.equal(b.report.who, ANONYMOUS);
});

test('POST: 근거가 없으면 400 이고 어느 칸이 문제인지 알려준다', async () => {
  const res = await onRequestPost({ request: post({ ...good, why: '' }), env: { REPORTS_DB: makeDb() } });
  assert.equal(res.status, 400);
  const b = await res.json();
  assert.ok(b.errors.why, '어느 칸이 문제인지 없으면 화면이 알려줄 수 없다');
});

test('POST: 검증에 걸리면 DB 를 건드리지 않는다', async () => {
  const db = makeDb();
  await onRequestPost({ request: post({ what: '', why: '' }), env: { REPORTS_DB: db } });
  assert.equal(db.calls.length, 0, '검증 실패인데 DB 를 조회했다');
});

test('POST: 허니팟이 채워지면 저장하지 않는다 — 그러나 성공한 것처럼 답한다', async () => {
  const db = makeDb();
  const res = await onRequestPost({
    request: post({ ...good, trap: 'http://spam.example' }),
    env: { REPORTS_DB: db },
  });
  assert.equal(res.status, 200, '막혔다고 알려주면 다음 시도에 그 칸을 비우고 온다');
  assert.equal(db.calls.length, 0, '허니팟에 걸렸는데 저장했다');
});

test('POST: 시간당 횟수를 넘기면 429', async () => {
  const res = await onRequestPost({
    request: post(good),
    env: { REPORTS_DB: makeDb({ recentCount: 5 }) },
  });
  assert.equal(res.status, 429);
});

test('POST: 횟수 제한은 같은 사람인지로만 센다 — 원본 IP 는 저장하지 않는다', async () => {
  const db = makeDb();
  await onRequestPost({ request: post(good, { ip: '203.0.113.9' }), env: { REPORTS_DB: db } });
  const flat = JSON.stringify(db.calls);
  assert.ok(!flat.includes('203.0.113.9'), '원본 IP 가 그대로 DB 로 갔다');
});

test('POST: 소금값이 다르면 같은 IP 도 다른 해시가 된다', async () => {
  const hashOf = async (salt) => {
    const db = makeDb();
    await onRequestPost({ request: post(good), env: { REPORTS_DB: db, IP_SALT: salt } });
    return db.calls.find((c) => /INSERT/.test(c.sql)).args.at(-1);
  };
  assert.notEqual(await hashOf('소금하나'), await hashOf('소금둘'));
});

test('POST: 본문이 너무 크면 413', async () => {
  const huge = 'ㄱ'.repeat(20000);
  const res = await onRequestPost({
    request: post({ ...good, what: huge }),
    env: { REPORTS_DB: makeDb() },
  });
  assert.equal(res.status, 413);
});

test('POST: content-length 를 속여도 실제 본문 크기로 막힌다', async () => {
  const res = await onRequestPost({
    request: post({ ...good, what: 'ㄱ'.repeat(20000) }, { headers: { 'content-length': '10' } }),
    env: { REPORTS_DB: makeDb() },
  });
  assert.equal(res.status, 413, 'content-length 헤더만 믿고 있다');
});

test('POST: JSON 이 아니면 400', async () => {
  const res = await onRequestPost({ request: post('{ 망가진'), env: { REPORTS_DB: makeDb() } });
  assert.equal(res.status, 400);
});

test('POST: 상한을 넘는 내용은 400 이고 413 과 구분된다', async () => {
  const res = await onRequestPost({
    request: post({ ...good, what: 'ㄱ'.repeat(LIMITS.what + 1) }),
    env: { REPORTS_DB: makeDb() },
  });
  assert.equal(res.status, 400);
  const b = await res.json();
  assert.ok(b.errors.what);
});

test('POST: 바인딩이 없으면 503', async () => {
  const res = await onRequestPost({ request: post(good), env: {} });
  assert.equal(res.status, 503);
});

test('POST: 저장이 실패하면 500 이고 성공으로 위장하지 않는다', async () => {
  const res = await onRequestPost({
    request: post(good),
    env: { REPORTS_DB: makeDb({ throwOn: 'INSERT' }) },
  });
  assert.equal(res.status, 500);
  const b = await res.json();
  assert.notEqual(b.ok, true);
});

test('어떤 응답에도 ip_hash 가 실리지 않는다', async () => {
  const rows = [{ id: 1, who: '가', what: '나', why: '다', status: 'new', note: '', created_at: '2026-08-08', handled_at: '' }];
  const bodies = await Promise.all([
    onRequestGet({ env: { REPORTS_DB: makeDb({ rows }) } }).then((r) => r.text()),
    onRequestPost({ request: post(good), env: { REPORTS_DB: makeDb() } }).then((r) => r.text()),
  ]);
  for (const b of bodies) {
    assert.ok(!b.includes('ip_hash'), 'ip_hash 가 응답에 있다');
  }
});
