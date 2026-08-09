#!/usr/bin/env node
/* 들어온 제보를 처리하는 도구.
 *
 *   npm run reports                          대기·확인 중인 제보 보기
 *   npm run reports -- all                   전부 보기
 *   npm run reports -- 12 done "무엇을 어떻게 고쳤는지"
 *   npm run reports -- 12 open "무엇이 더 필요한지"
 *   npm run reports -- 12 no   "왜 지금 값이 맞는지"
 *   npm run reports -- 12 hide               스팸 숨기기 (지우지 않는다)
 *
 * 관리자 화면을 따로 만들지 않는 이유: 상태를 바꾸는 시점은 어차피 data/ 를 고치고
 * 커밋하는 시점이라 이미 터미널 앞이다. 공개 엔드포인트에 쓰기 권한을 하나 더 두는
 * 것보다 이쪽이 지킬 것이 적다.
 *
 * 원격 DB를 건드린다. 로컬에서 시험하려면 REPORTS_LOCAL=1 을 붙인다.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { STATUSES, STATUS_LABEL, isStatus, todayKST, LIMITS } from '../src/report-shared.mjs';

const DB = 'rune-reports';

/* SQL 문자열 안의 따옴표를 무해하게 만든다.
 *
 * 여기가 이 파일에서 유일하게 위험한 자리다. 관리자가 쓰는 값이라 악의는 없지만,
 * 따옴표가 든 문장("'무형' 룬은…")을 그대로 넣으면 SQL 이 깨지고, 운이 나쁘면
 * 뒤 문장이 명령으로 읽힌다. SQLite 의 규칙대로 따옴표를 두 번 적어 escape 한다.
 */
export function sqlString(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

/** 반영 상태와 처리 내용을 함께 바꾼다. 처리일은 오늘(한국 날짜)로 찍는다. */
export function buildUpdateSql(id, status, note, today) {
  if (!Number.isInteger(id) || id <= 0) throw new Error(`제보 번호가 이상하다: ${id}`);
  if (!isStatus(status)) throw new Error(`모르는 상태다: ${status}`);
  return (
    'UPDATE reports SET ' +
    `status = ${sqlString(status)}, ` +
    `note = ${sqlString(note)}, ` +
    `handled_at = ${sqlString(today)} ` +
    `WHERE id = ${id};`
  );
}

/* 숨기기. 지우지 않는 이유: 지우면 왜 사라졌는지 아무 기록이 없고, 같은 사람이
 * 다시 뿌렸을 때 그게 처음인지 알 수 없다. */
export function buildHideSql(id) {
  if (!Number.isInteger(id) || id <= 0) throw new Error(`제보 번호가 이상하다: ${id}`);
  return `UPDATE reports SET hidden = 1 WHERE id = ${id};`;
}

export function buildListSql(showAll) {
  const where = showAll ? 'hidden = 0' : "hidden = 0 AND status IN ('new', 'open')";
  return (
    'SELECT id, who, status, created_at, handled_at, what, why, note ' +
    `FROM reports WHERE ${where} ORDER BY id DESC LIMIT 100;`
  );
}

/* ── 여기부터는 wrangler 를 부르는 부분 ──────────────────────────────────── */

function wrangler(args) {
  const scope = process.env.REPORTS_LOCAL ? '--local' : '--remote';
  try {
    return execFileSync('npx', ['wrangler', 'd1', 'execute', DB, scope, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new Error('npx 를 찾지 못했다. Node.js 20 이상이 설치돼 있어야 한다.');
    }
    throw new Error(
      'wrangler 실행이 실패했다. `npx wrangler login` 이 되어 있는지, ' +
        'wrangler.toml 의 database_id 를 채웠는지 확인할 것.',
    );
  }
}

/* 쓰기는 파일로 넘긴다. 관리자가 쓴 답변이 들어 있어 셸 따옴표를 거치지 않는 편이 안전하다.
 * 결과 행은 필요 없다 — 실제로 `--file` 은 행을 안 주고 실행 요약만 준다. */
function writeSql(sql) {
  const path = join(tmpdir(), `rune-reports-${process.pid}.sql`);
  writeFileSync(path, `${sql}\n`, 'utf8');
  try {
    return wrangler([`--file=${path}`, '--json']);
  } finally {
    try {
      unlinkSync(path);
    } catch {
      /* 임시 파일이 안 지워져도 하던 일은 끝난 것이다 */
    }
  }
}

/* 읽기는 --command 로 보낸다. **--file 로 보내면 행 대신 "몇 줄 읽었다" 요약이 와서
 * 목록이 텅 빈 것처럼 보인다** — 실제로 그렇게 한 번 헛돌았다.
 * 여기 들어가는 SQL 은 buildListSql() 이 만드는 고정 문자열이라 셸에 실어도 안전하다. */
function readSql(sql) {
  return wrangler(['--json', '--command', sql]);
}

function parseRows(output) {
  try {
    const parsed = JSON.parse(output);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.flatMap((r) => r?.results ?? []);
  } catch {
    // --json 이 아닌 형식으로 나왔거나 빈 결과다. 원문을 보여주는 것이 낫다
    process.stdout.write(output);
    return null;
  }
}

function cut(text, n) {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
}

function list(showAll) {
  const rows = parseRows(readSql(buildListSql(showAll)));
  if (rows === null) return;
  if (rows.length === 0) {
    console.log(showAll ? '제보가 없다.' : '처리할 제보가 없다.');
    return;
  }
  console.log(`${rows.length}건${showAll ? '' : ' (대기·확인 중)'}\n`);
  for (const r of rows) {
    const label = STATUS_LABEL[r.status] ?? r.status;
    console.log(`#${r.id}  [${label}]  ${r.who}  ${r.created_at}`);
    console.log(`   ${cut(r.what, 100)}`);
    console.log(`   근거: ${cut(r.why, 80)}`);
    if (r.note) console.log(`   답변: ${cut(r.note, 80)}  (${r.handled_at})`);
    console.log('');
  }
  console.log('처리:  npm run reports -- <번호> done "무엇을 어떻게 고쳤는지"');
}

function usage(message) {
  if (message) console.error(`\n${message}\n`);
  console.error(`사용법:
  npm run reports                        대기·확인 중인 제보 보기
  npm run reports -- all                 전부 보기
  npm run reports -- <번호> <상태> "<답변>"
  npm run reports -- <번호> hide         숨기기 (지우지 않는다)

  상태: ${STATUSES.map((s) => `${s}(${STATUS_LABEL[s]})`).join(' · ')}

'반영 안 함'(no)도 답변을 적어 남긴다 — 왜 지금 값이 맞는지 적어두면 같은 제보가
반복해서 들어오지 않고, 그것이 곧 "왜 이 숫자냐" 에 대한 공개 답변이 된다.`);
  process.exit(message ? 1 : 0);
}

function main(argv) {
  if (argv.length === 0) return list(false);
  if (argv[0] === 'all') return list(true);
  if (argv[0] === '-h' || argv[0] === '--help') return usage();

  const id = Number(argv[0]);
  if (!Number.isInteger(id) || id <= 0) return usage(`제보 번호가 이상하다: ${argv[0]}`);

  const action = argv[1];
  if (!action) return usage('상태를 적어야 한다.');

  if (action === 'hide') {
    writeSql(buildHideSql(id));
    console.log(`#${id} 숨겼다. 지운 것이 아니라 목록에서만 빠진다.`);
    return;
  }

  if (!isStatus(action)) return usage(`모르는 상태다: ${action}`);

  const note = argv.slice(2).join(' ');
  if (!note && action !== 'new') {
    return usage(`${STATUS_LABEL[action]} 으로 바꿀 때는 답변을 함께 적어야 한다.`);
  }
  if (note.length > LIMITS.note) {
    return usage(`답변은 ${LIMITS.note}자까지다. 지금 ${note.length}자다.`);
  }

  writeSql(buildUpdateSql(id, action, note, todayKST()));
  console.log(`#${id} → ${STATUS_LABEL[action]}`);
  console.log('사이트에 바로 반영된다. 목록은 캐시하지 않는다.');
}

// import 해서 SQL 조립만 테스트할 수 있도록, 직접 실행할 때만 동작한다.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`\n${e.message}\n`);
    process.exit(1);
  }
}
