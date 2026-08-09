-- 수치 제보 표. `npm run db:schema` 로 적용한다.
--
-- 몇 번을 다시 돌려도 안전하게 IF NOT EXISTS 로 쓴다 — 배포 순서를 헷갈려 두 번 돌리는
-- 일이 실제로 생기고, 그때 오류가 나면 스키마가 반쯤 적용된 상태인지 알 수 없다.

CREATE TABLE IF NOT EXISTS reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,

  -- 제보자가 쓴 것. 서버가 다듬은 값만 들어온다 (src/report-shared.mjs)
  who         TEXT    NOT NULL,
  what        TEXT    NOT NULL,
  why         TEXT    NOT NULL,

  -- 관리자가 쓴 것. 화면에서 아래 칸에 해당한다
  status      TEXT    NOT NULL DEFAULT 'new',
  note        TEXT    NOT NULL DEFAULT '',
  handled_at  TEXT    NOT NULL DEFAULT '',

  -- 화면에 띄우는 한국 날짜(YYYY-MM-DD). 사람이 읽는 값이다
  created_at  TEXT    NOT NULL,
  -- 같은 날 여러 건이 들어와도 순서가 정해지고, 시간당 횟수 제한을 걸 수 있게
  -- epoch 밀리초를 따로 둔다. created_at 만으로는 둘 다 못 한다
  created_ms  INTEGER NOT NULL,

  -- 스팸을 지우지 않고 숨긴다. 지우면 왜 사라졌는지 아무 기록이 없다
  hidden      INTEGER NOT NULL DEFAULT 0,

  -- 접속 IP 를 되돌릴 수 없는 해시로 바꾼 값. 원본 IP 는 저장하지 않는다.
  -- 시간당 횟수 제한과, 한 사람이 뿌린 스팸을 한 번에 숨기기 위한 것이다
  ip_hash     TEXT    NOT NULL DEFAULT '',

  -- 이 목록은 src/report-shared.mjs 의 STATUSES 와 같아야 한다.
  -- tests/report-schema.test.mjs 가 두 곳이 어긋나면 잡는다
  CHECK (status IN ('new', 'open', 'done', 'no')),
  CHECK (hidden IN (0, 1))
);

-- 목록 조회: 숨기지 않은 것을 최신순으로
CREATE INDEX IF NOT EXISTS reports_visible ON reports (hidden, id DESC);

-- 시간당 횟수 제한 조회
CREATE INDEX IF NOT EXISTS reports_ratelimit ON reports (ip_hash, created_ms);
