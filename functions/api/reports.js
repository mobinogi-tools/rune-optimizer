/* 수치 제보 API. Cloudflare Pages Function.
 *
 *   GET  /api/reports   보이는 제보 목록
 *   POST /api/reports   제보 등록
 *
 * **이 파일은 dist/ 에 들어가지 않는다.** Cloudflare 가 프로젝트 루트의 functions/ 를
 * 따로 읽어 워커로 묶는다. 정적 루트에 두면 소스가 그대로 공개된다 — tools/build-dist.sh
 * 가 이 디렉터리를 복사하지 않는 것이 의도다.
 *
 * 추천기 본체는 이 함수가 없어도 완전히 동작한다. 제보 페이지만 목록을 못 불러온다.
 *
 * env.REPORTS_DB 는 Cloudflare Pages 프로젝트에 붙인 D1 바인딩이다. 그 설정은 관리자
 * 계정을 가리키므로 이 저장소에 없다 — 바인딩이 없으면 아래 핸들러가 503 으로 떨어진다.
 */
import { validateReport, todayKST } from '../../src/report-shared.mjs';

/** 한 번에 돌려주는 최대 건수. 넘으면 오래된 것이 빠지고 화면이 그 사실을 알린다. */
const MAX_ROWS = 1000;

/** 같은 사람이 한 시간에 넣을 수 있는 제보 수. 진지한 제보자에게는 걸릴 일이 없다. */
const MAX_PER_HOUR = 5;

/** 본문 크기 상한. 글자수 상한(합쳐 1KB 남짓)에 여유를 둔 값이다. */
const MAX_BODY_BYTES = 8 * 1024;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  // 제보 목록은 계속 바뀌므로 캐시하지 않는다. 등록 직후 자기 글이 안 보이면
  // 사람들은 등록이 실패한 줄 알고 다시 쓴다
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/* 접속 IP 를 되돌릴 수 없는 값으로 바꾼다.
 *
 * 원본 IP 를 저장하지 않는 이유: 시간당 횟수 제한과 스팸 일괄 숨김에는 "같은 사람인가"
 * 만 필요하고 그게 누구인지는 필요 없다. 소금값(IP_SALT)을 넣으면 같은 해시를 밖에서
 * 재현할 수 없다 — 안 넣어도 돌아가지만 넣는 것이 낫다.
 */
async function hashIp(ip, salt) {
  const bytes = new TextEncoder().encode(`${salt ?? ''}:${ip ?? ''}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 화면이 쓰는 모양으로만 골라 내보낸다. ip_hash 와 hidden 은 절대 나가지 않는다. */
const PUBLIC_COLUMNS = 'id, who, what, why, status, note, created_at, handled_at';

/* 공개되는 것은 **반영된 제보뿐이다.**
 *
 * 들어온 것을 전부 보여주면 두 가지가 같이 따라온다. 검증 안 된 남의 주장이 사이트에
 * 걸리고, 스팸이 들어오는 즉시 공개된다. 반영된 것만 내보내면 둘 다 사라진다 —
 * 관리자가 손대기 전에는 아무것도 밖에서 안 보인다.
 *
 * 대신 제보자는 등록 직후 자기 글을 목록에서 못 본다. 그걸 모르면 실패한 줄 알고
 * 다시 쓰므로, 등록 성공 문구가 "반영되면 올라간다" 를 분명히 말해야 한다
 * (src/report-app.mjs).
 *
 * 관리자는 이 API 가 아니라 tools/report-status.mjs 로 전부 본다.
 */
const PUBLIC_STATUS = 'done';

export async function onRequestGet({ env }) {
  if (!env.REPORTS_DB) {
    return json({ error: '제보 저장소가 연결되지 않았습니다.' }, 503);
  }
  try {
    const { results } = await env.REPORTS_DB.prepare(
      `SELECT ${PUBLIC_COLUMNS} FROM reports
        WHERE hidden = 0 AND status = ?
        ORDER BY handled_at DESC, id DESC
        LIMIT ?`,
    )
      .bind(PUBLIC_STATUS, MAX_ROWS)
      .all();

    return json({ reports: results ?? [], truncated: (results?.length ?? 0) >= MAX_ROWS });
  } catch (e) {
    // 목록을 못 불러온 것과 제보가 0건인 것은 화면에서 다르게 보여야 한다
    return json({ error: '제보 목록을 불러오지 못했습니다.', detail: String(e?.message ?? e) }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.REPORTS_DB) {
    return json({ error: '제보 저장소가 연결되지 않았습니다.' }, 503);
  }

  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return json({ error: '보내신 내용이 너무 깁니다.' }, 413);
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json({ error: '보내신 내용이 너무 깁니다.' }, 413);
    }
    body = JSON.parse(raw);
  } catch {
    return json({ error: '요청을 읽을 수 없습니다.' }, 400);
  }

  /* 허니팟. 화면에는 안 보이는 칸이고 사람은 채울 수 없다. 봇만 채운다.
   * 막혔다고 알려주면 다음 시도에서 그 칸을 비우고 오므로, 성공한 것처럼 답한다.
   * 대신 저장은 하지 않는다. */
  if (typeof body?.trap === 'string' && body.trap.trim() !== '') {
    return json({ ok: true, report: null });
  }

  const check = validateReport(body);
  if (!check.ok) {
    return json({ error: '적어주신 내용을 확인해 주세요.', errors: check.errors }, 400);
  }

  const now = Date.now();
  const ipHash = await hashIp(request.headers.get('CF-Connecting-IP'), env.IP_SALT);

  try {
    const recent = await env.REPORTS_DB.prepare(
      'SELECT COUNT(*) AS n FROM reports WHERE ip_hash = ? AND created_ms > ?',
    )
      .bind(ipHash, now - 60 * 60 * 1000)
      .first();

    if ((recent?.n ?? 0) >= MAX_PER_HOUR) {
      return json(
        { error: '잠시 후에 다시 보내주세요. 한 시간에 여러 건을 연달아 받지 않습니다.' },
        429,
      );
    }

    const inserted = await env.REPORTS_DB.prepare(
      `INSERT INTO reports (who, what, why, created_at, created_ms, ip_hash)
        VALUES (?, ?, ?, ?, ?, ?)
        RETURNING ${PUBLIC_COLUMNS}`,
    )
      .bind(check.value.who, check.value.what, check.value.why, todayKST(now), now, ipHash)
      .first();

    return json({ ok: true, report: inserted }, 201);
  } catch (e) {
    return json({ error: '제보를 저장하지 못했습니다.', detail: String(e?.message ?? e) }, 500);
  }
}

/* 여기에 onRequest(전 메서드 처리)를 export 하지 않는다. GET·POST 핸들러를 덮어써서
 * 두 경로가 전부 죽을 수 있고, 그러면 제보 기능 전체가 조용히 405 가 된다.
 * 핸들러가 없는 메서드는 Pages 가 알아서 405 를 준다.
 *
 * 상태 변경(PATCH 등)도 두지 않는다. 공개 엔드포인트에 쓰기 권한을 하나 더 두면
 * 그 권한을 지키는 일이 늘어난다. 관리자는 어차피 data/ 를 고치고 커밋하는 시점에
 * 터미널 앞에 있으므로, 상태 변경은 tools/report-status.mjs 가 wrangler 로 직접 한다.
 */
