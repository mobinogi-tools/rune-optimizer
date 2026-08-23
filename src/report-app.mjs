/* 수치 제보 페이지의 화면.
 *
 * 계산은 하나도 하지 않는다 — 목록을 받아 그리고, 폼을 보내는 일만 한다.
 * 검증 규칙은 src/report-shared.mjs 에 있고 최종 판정은 서버가 한다.
 *
 * **제보자가 쓴 글자는 절대 innerHTML 로 넣지 않는다.**
 * 전부 createElement + textContent 로 만든다. 이유는 두 가지다:
 *   - 아무나 쓸 수 있는 칸이라 태그가 들어오면 그대로 실행된다.
 *   - 주소를 링크로 만들지 않기 위해서다. 클릭되는 링크를 아무나 심을 수 있으면
 *     이 목록이 곧 스팸 통로가 된다. 주소는 글자로만 보인다.
 */
import { LIMITS, matchesQuery, validateReport } from './report-shared.mjs';

/** 한 번에 보여줄 건수. 페이지 번호는 쓰지 않는다 — 제보는 순서대로 읽는 것이 아니다. */
const PAGE = 10;

const API = '/api/reports';

/* 내가 낸 제보를 기억하는 자리. 로그인이 없으므로 브라우저에만 남긴다.
 * 추천기 본체의 저장 키와 겹치지 않는 이름을 쓴다 — 그쪽은 건드리면 사용자의
 * 측정값과 장비 설정이 날아간다. */
const MINE_KEY = 'mabinogi-rune-reports-mine-v1';

const state = {
  reports: [],
  query: '',
  limit: PAGE,
  /** 'loading' | 'ok' — ok 가 아니면 「고쳤습니다」 칸이 아예 안 나온다 */
  load: 'loading',
  /** 서버가 상한에서 목록을 잘랐는지. 잘렸으면 화면이 그 사실을 밝힌다 */
  truncated: false,
  mine: new Set(),
};

const $ = (id) => document.getElementById(id);

/* ── 내 제보 기억 ─────────────────────────────────────────────────────────── */

function readMine() {
  try {
    const raw = localStorage.getItem(MINE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((n) => Number.isInteger(n)) : []);
  } catch {
    // 시크릿 창 등에서 localStorage 가 막혀 있어도 페이지는 돌아가야 한다
    return new Set();
  }
}

function rememberMine(id) {
  state.mine.add(id);
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify([...state.mine]));
  } catch {
    /* 기억하지 못해도 등록 자체는 성공했다 */
  }
}

/* ── DOM 만들기 ───────────────────────────────────────────────────────────── */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/* 제보 하나 = 두 칸. 위는 제보자가 알려준 것, 아래는 그래서 무엇을 고쳤는지.
 *
 * 상태 알약은 없다 — 여기 오는 것은 전부 반영된 것뿐이라 넷 중 하나를 표시할 이유가 없다.
 * 대신 아래 칸이 '반영' 이라고 말하고 그 옆에 고친 날짜가 붙는다.
 */
function entryNode(r) {
  const mine = state.mine.has(r.id);

  const entry = el('article', `entry${mine ? ' is-mine' : ''}`);
  entry.id = `r-${r.id}`;

  const said = el('div', 'said');
  const head = el('div', 'said-head');
  const whoWrap = el('span', 'who-wrap');
  whoWrap.append(el('span', 'who', r.who));
  if (mine) whoWrap.append(el('span', 'badge', '내 제보'));
  head.append(whoWrap, el('span', 'when', r.created_at ?? ''));

  const what = el('p', 'what', r.what);
  const why = el('p', 'why');
  why.append(el('span', 'k', '근거'), el('span', null, r.why));
  said.append(head, what, why);

  const did = el('div', 'did s-done');
  did.append(
    el('span', 'pill', '반영'),
    el('p', 'answer', r.note || '반영했습니다.'),
    el('span', 'when', r.handled_at ?? ''),
  );

  entry.append(said, did);
  return { entry, what };
}

/* 네 줄을 넘는 내용에만 '더 보기' 를 붙인다.
 * 넘치는지는 붙여 넣은 뒤에야 알 수 있어서, 렌더가 끝난 다음에 한 번 훑는다. */
function addClampToggle(paragraph) {
  if (paragraph.scrollHeight <= paragraph.clientHeight + 2) return;
  const btn = el('button', 'more-btn', '더 보기');
  btn.type = 'button';
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    const open = paragraph.classList.toggle('open');
    btn.textContent = open ? '접기' : '더 보기';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  paragraph.after(btn);
}

/* ── 렌더 ─────────────────────────────────────────────────────────────────── */

/** 검색어가 없으면 전부. 이 목록에는 반영된 제보만 들어 있어 상태로 거를 것이 없다. */
function visible() {
  return state.reports.filter((r) => matchesQuery(r, state.query));
}

/** 검색칸이 나타나는 문턱. 서너 건뿐인데 검색칸이 있으면 비어 보인다. */
const SEARCH_FROM = 8;

function render() {
  const section = $('thanks');
  const box = $('entries');
  const more = $('more');

  /* 아직 반영된 제보가 없으면 이 구역을 통째로 숨긴다.
   *
   * "0건" 이라고 적힌 빈 상자는 아무것도 알려주지 않으면서 페이지만 허전하게 만든다.
   * 목록을 못 불러온 것도 마찬가지다 — 방문자가 할 수 있는 일이 없고, 제보를 남기는 데
   * 아무 지장이 없다. 아래 칸이 안 보일 뿐 폼은 그대로 동작한다. */
  if (state.load !== 'ok' || state.reports.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const hits = visible();
  const page = hits.slice(0, state.limit);

  box.textContent = '';
  const clampTargets = [];
  for (const r of page) {
    const { entry, what } = entryNode(r);
    box.append(entry);
    clampTargets.push(what);
  }
  for (const p of clampTargets) addClampToggle(p);

  if (page.length === 0) {
    box.append(el('p', 'blocked', '찾으시는 말이 든 제보가 없습니다.'));
  }

  $('search-row').hidden = state.reports.length < SEARCH_FROM;

  // 서버가 상한에서 잘랐으면 그 사실을 말한다. 조용히 자르면 화면은 "이게 전부" 라고
  // 거짓말하게 된다
  const cut = state.truncated ? ' · 오래된 것 일부는 표시되지 않습니다' : '';
  $('shown').textContent = `${state.reports.length}건 반영${cut}`;

  if (hits.length > page.length) {
    more.hidden = false;
    more.textContent = `더 보기 (남은 ${hits.length - page.length}건)`;
  } else {
    more.hidden = true;
  }
}

/* ── 목록 불러오기 ────────────────────────────────────────────────────────── */

/* 목록을 못 불러와도 화면에 오류를 띄우지 않는다. 방문자가 할 수 있는 일이 없고,
 * 제보를 남기는 데도 지장이 없다 — 「고쳤습니다」 칸이 안 보일 뿐 폼은 그대로 동작한다.
 * 관리자가 상태를 확인할 자리는 화면이 아니라 tools/report-status.mjs 다. */
async function load() {
  if (location.protocol === 'file:') return;

  try {
    const res = await fetch(API, { headers: { Accept: 'application/json' } });
    if (!res.ok) return;
    const body = await res.json();

    state.reports = Array.isArray(body?.reports) ? body.reports : [];
    state.truncated = Boolean(body?.truncated);
    state.load = 'ok';
  } catch {
    /* 그대로 숨긴 채로 둔다 */
  }
  render();
}

/* ── 등록 ─────────────────────────────────────────────────────────────────── */

function showErrors(errors) {
  for (const key of ['who', 'what', 'why']) {
    const msg = errors?.[key] ?? '';
    $(`err-${key}`).textContent = msg;
    $(`field-${key}`).classList.toggle('bad', Boolean(msg));
  }
}

function firstBadField(errors) {
  for (const key of ['what', 'why', 'who']) {
    if (errors?.[key]) return $(`f-${key}`);
  }
  return null;
}

async function submit(event) {
  event.preventDefault();
  const button = $('submit');
  const privacy = $('privacy');

  const payload = {
    who: $('f-who').value,
    what: $('f-what').value,
    why: $('f-why').value,
    trap: $('f-trap').value,
  };

  // 화면 쪽 검사는 왕복을 아끼기 위한 것이고, 판정은 서버가 한 번 더 한다
  const check = validateReport(payload);
  if (!check.ok) {
    showErrors(check.errors);
    firstBadField(check.errors)?.focus();
    return;
  }
  showErrors({});

  button.disabled = true;
  button.textContent = '보내는 중…';

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);

    if (!res.ok) {
      if (body?.errors) {
        showErrors(body.errors);
        firstBadField(body.errors)?.focus();
      } else {
        privacy.className = 'err';
        privacy.textContent = body?.error ?? '제보를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.';
      }
      return;
    }

    $('report-form').reset();
    privacy.className = 'sent';
    /* 등록한 글은 **지금 목록에 안 나타난다.** 반영된 것만 공개하기 때문이다.
     * 이 사실을 말해주지 않으면 실패한 줄 알고 같은 내용을 다시 쓴다 —
     * 이 화면에서 가장 흔할 오해라 문구가 분명해야 한다. */
    privacy.textContent =
      '보내주셨습니다. 확인하고 값을 고치면 아래 「알려주셔서 고쳤습니다」 에 올라갑니다.';

    // 허니팟에 걸리면 report 가 null 이다. 저장되지 않았지만 그 사실은 알려주지 않는다
    if (body?.report?.id != null) rememberMine(body.report.id);
  } catch {
    privacy.className = 'err';
    privacy.textContent = '제보를 보내지 못했습니다. 연결을 확인해 주세요.';
  } finally {
    button.disabled = false;
    button.textContent = '제보 등록';
  }
}

/* ── 배선 ─────────────────────────────────────────────────────────────────── */

function start() {
  state.mine = readMine();

  // 상한을 HTML 과 코드 두 곳에 적어두면 갈라진다. 여기서 한 번 맞춘다
  $('f-who').maxLength = LIMITS.who;
  $('f-what').maxLength = LIMITS.what;
  $('f-why').maxLength = LIMITS.why;

  $('report-form').addEventListener('submit', submit);

  $('q').addEventListener('input', (e) => {
    state.query = e.target.value;
    state.limit = PAGE;
    render();
  });

  $('more').addEventListener('click', () => {
    state.limit += PAGE;
    render();
  });

  render();
  load();
}

start();
