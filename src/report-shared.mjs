/* 수치 제보의 규칙. **서버와 화면이 같은 이 파일을 쓴다.**
 *
 * 검증을 두 곳에 쓰면 언젠가 갈라지고, 갈라지면 화면은 통과시켰는데 서버가 거절하는
 * (또는 그 반대의) 상태가 된다. 그래서 규칙은 여기 한 곳에만 둔다.
 * 화면 쪽 검사는 편의이고 **판정은 서버가 한다** — 브라우저를 거치지 않는 요청도 있다.
 *
 * 이 파일은 브라우저·Pages Function·node 테스트에서 모두 import 된다.
 * 따라서 node 전용 API(fs, process)도 브라우저 전용 API(document, localStorage)도 쓰지 않는다.
 */

/** 글자수 상한. 화면의 maxlength 와 서버 검사가 같은 값을 봐야 한다. */
export const LIMITS = Object.freeze({ who: 20, what: 500, why: 500, note: 1000 });

/* 하한이 있는 이유는 "ㅇㅇ", "1" 같은 것을 막기 위해서다. 높게 잡으면 짧지만 정확한
 * 제보("기사 90초 아님")가 막히므로, 장난만 걸러지는 최소치로 둔다.
 * 근거는 "툴팁" 두 글자로 끝낼 수 있어야 하므로 2 다. */
export const MINIMUMS = Object.freeze({ what: 8, why: 2 });

/** 제보자를 안 적었을 때 쓰는 이름. 빈 칸으로 두지 않는다. */
export const ANONYMOUS = '익명';

/* 반영 상태. 순서는 처리 흐름 순서다.
 * 사이트에 공개되는 것은 'done' 뿐이고(functions/api/reports.js), 나머지는 관리자 도구에서만
 * 보인다. 그래서 이 목록은 화면이 아니라 tools/report-status.mjs 와 schema.sql 이 쓴다. */
export const STATUSES = Object.freeze(['new', 'open', 'done', 'no']);

export const STATUS_LABEL = Object.freeze({
  new: '대기',
  open: '확인 중',
  done: '반영됨',
  no: '반영 안 함',
});

export function isStatus(s) {
  return STATUSES.includes(s);
}

/* 안 보이는 문자를 걷어낸다.
 *
 * 정규식에 제어문자를 직접 적으면 소스 파일 안에 그 문자가 그대로 박혀서, 편집기와
 * diff 에서 보이지 않고 복사할 때 조용히 깨진다. 그래서 문자코드로 판정한다.
 *
 * 두 가지를 동시에 한다:
 *   1) 화면을 망가뜨리는 문자 제거 — 특히 양방향 제어문자(202A~202E)는 뒤에 오는
 *      문장을 거꾸로 뒤집어 다른 제보의 내용까지 읽기 어렵게 만들 수 있다.
 *   2) **길이 검사가 의미를 갖게 만든다** — 폭 없는 문자로 글자수를 채우면 상한이
 *      무의미해진다. 그래서 길이를 재기 전에 반드시 이걸 통과시킨다.
 *
 * 폭이 다른 공백들은 지우지 않고 보통 공백으로 바꾼다 — 지우면 단어가 붙어버린다.
 */
function stripInvisible(text) {
  let out = '';
  for (const ch of text) {
    const c = ch.codePointAt(0);
    if (ch === '\n') { out += ch; continue; }
    // C0/C1 제어문자와 DEL
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) continue;
    // 폭 없는 공백·결합자, 양방향 제어문자, word joiner, BOM
    if (c >= 0x200b && c <= 0x200f) continue;
    if (c >= 0x202a && c <= 0x202e) continue;
    if (c >= 0x2066 && c <= 0x2069) continue;
    if (c === 0x2060 || c === 0xfeff || c === 0x00ad) continue;
    // 폭이 다른 공백들 → 보통 공백
    if (c === 0x09 || c === 0x00a0 || c === 0x3000 || (c >= 0x2000 && c <= 0x200a)) {
      out += ' ';
      continue;
    }
    out += ch;
  }
  return out;
}

/** 입력값을 저장·검사에 쓸 형태로 다듬는다. 길이 검사는 반드시 이 뒤에 한다. */
export function normalizeText(raw) {
  if (typeof raw !== 'string') return '';
  return stripInvisible(raw.replace(/\r\n?/g, '\n'))
    .split('\n')
    .map((line) => line.replace(/ {2,}/g, ' ').trim())
    .join('\n')
    // 빈 줄을 잔뜩 넣어 목록을 밀어내는 것을 막는다. 두 줄까지만 허용한다.
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* 제보 하나를 검사한다. 돌려주는 것:
 *   ok     — 통과 여부
 *   errors — { 칸이름: 사람이 읽을 한국어 } . 화면이 칸 아래에 그대로 띄운다
 *   value  — 정규화된 값. **통과했을 때 저장할 것은 입력 원본이 아니라 이쪽이다**
 *
 * 외부 사이트 주소는 거르지 않는다. 이 칸은 제보자의 말이고 그 사람 이름으로 인용되는
 * 것이라, 프로젝트가 자기 데이터의 근거로 무엇을 가리키는지와는 다른 문제다.
 * (`data/` 로 반영할 때의 evidence 규칙은 tools/validate-data.mjs 가 따로 막는다.)
 * 대신 화면은 이 텍스트를 **절대 링크로 만들지 않는다** — report-app.mjs 를 볼 것.
 */
export function validateReport(input) {
  const who = normalizeText(input?.who ?? '');
  const what = normalizeText(input?.what ?? '');
  const why = normalizeText(input?.why ?? '');
  const errors = {};

  if (who.length > LIMITS.who) {
    errors.who = `입력자는 ${LIMITS.who}자까지 적을 수 있습니다.`;
  }

  if (!what) {
    errors.what = '무엇이 다른지 적어주세요.';
  } else if (what.length < MINIMUMS.what) {
    errors.what = '어느 직업의 무슨 값인지까지 적어주세요.';
  } else if (what.length > LIMITS.what) {
    errors.what = `내용은 ${LIMITS.what}자까지입니다. 지금 ${what.length}자입니다.`;
  }

  if (!why) {
    errors.why = '어떻게 확인하셨는지 적어주세요. 게임에 적혀 있는 값이면 "툴팁" 이면 됩니다.';
  } else if (why.length < MINIMUMS.why) {
    errors.why = '어떻게 확인하셨는지 적어주세요.';
  } else if (why.length > LIMITS.why) {
    errors.why = `근거는 ${LIMITS.why}자까지입니다. 지금 ${why.length}자입니다.`;
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { who: who || ANONYMOUS, what, why },
  };
}

/* 한국 날짜(YYYY-MM-DD). 이 도구를 쓰는 사람은 사실상 전부 한국 시간으로 산다.
 *
 * UTC 로 자르면 한국 시간 자정~아침 9시 사이에 들어온 제보가 **하루 전 날짜**로 찍힌다.
 * 9시간을 더해 두고 UTC 로 렌더하면 그 값이 곧 한국 날짜다.
 */
export function todayKST(nowMs) {
  const ms = typeof nowMs === 'number' ? nowMs : Date.now();
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 검색. 접혀 있는 내용도 찾아져야 하므로 전문을 훑는다. */
export function matchesQuery(report, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return true;
  const hay = [report?.who, report?.what, report?.why, report?.note]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}
