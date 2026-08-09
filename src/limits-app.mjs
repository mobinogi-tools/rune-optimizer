// 「이 도구가 재지 않는 것」 페이지.
//
// 화면에 쓰는 문장을 여기서 짓지 않는다. 세 곳에서 읽어 그리기만 한다:
//   - data/limits.json      도구 전체에 걸리는 한계 (gen/limits-data.mjs)
//   - 각 데이터의 uncounted  항목 하나가 계산에서 빠지는 이유
//   - data/jobs/*.json 의 excluded  그 직업에서 안 넣은 패시브와 이유
//   - HELP-WANTED.md        수치 신뢰도 (저장소 링크로만)
//
// 문장을 여기 적으면 데이터와 갈라지고, 갈라진 쪽이 늘 이용자가 보는 쪽이었다.
import { LIMITS } from './gen/limits-data.mjs';
import { RUNES } from './runes-data.mjs';
import { ARTIFACTS } from './gen/artifacts-list.mjs';
import { COMBAT_MASTERIES } from './gen/masteries-data.mjs';
import { JOB_EXCLUSIONS } from './gen/jobs-data.mjs';
import { uncountedOf } from './rune-uncounted.mjs';

const KIND = {
  structural: { label: '비교 방식 자체', hint: '데이터를 채운다고 없어지지 않습니다' },
  unmodeled: { label: '아직 안 만듦', hint: '만들면 들어올 수 있습니다' },
  unverified: { label: '확증 못 함', hint: '계산에는 들어가지만 값이 맞다고 확인하지 못했습니다' },
};

/** createElement + textContent 만 쓴다. 문자열을 조립해 innerHTML 로 넣으면 데이터에
 *  따옴표나 꺾쇠가 들어오는 날 조용히 깨진다 — 제보 페이지와 같은 규칙이다. */
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/** 배지 하나짜리 제목줄. panel-head 의 자식은 항상 제목과 이 상자 둘이어야 한다. */
function badgeBox(text) {
  const box = el('div', 'head-badges');
  box.append(el('span', 'badge', text));
  return box;
}

// ── ① 도구 전체에 걸리는 한계 ────────────────────────────
function renderLimits(root) {
  for (const l of LIMITS) {
    const card = el('div', 'panel');
    const head = el('div', 'panel-head');
    head.append(el('h2', null, l.title));
    // 배지는 한 상자에 모은다. panel-head 가 space-between 이라 배지를 직접 붙이면
    // 둘 이상일 때 자식이 셋이 되어 가운데가 벌어진다.
    const badges = el('div', 'head-badges');
    const k = KIND[l.kind] ?? { label: l.kind, hint: '' };
    const badge = el('span', 'badge', k.label);
    badge.title = k.hint;
    badges.append(badge);
    if (l.openTo) {
      // 채울 수 있는 것은 그 자리에서 창구를 보여준다. 페이지 끝에 한 번 두면
      // 읽다가 화가 난 사람은 거기까지 안 내려간다.
      const a = el('a', 'badge', l.openTo === 'report' ? '제보로 채울 수 있음' : 'PR 환영');
      a.href = l.openTo === 'report' ? '/report' : 'https://github.com/mobinogi-tools/rune-optimizer';
      badges.append(a);
    }
    head.append(badges);
    card.append(head, el('p', null, l.why));
    const eff = el('p', 'note');
    eff.append(el('b', null, '그래서 '), document.createTextNode(l.effect));
    card.append(eff);
    root.append(card);
  }
}

// ── ② 계산 밖 항목 ───────────────────────────────────────
// 룬·아티팩트·숙련을 훑어 uncounted 를 전부 모은다. 목록을 손으로 관리하지 않는 이유는,
// 데이터가 늘 때마다 여기를 같이 고쳐야 한다는 규칙이 지켜진 적이 없어서다.
function collectUncounted() {
  const rows = [];
  for (const r of RUNES.items) {
    // 계산에 못 넣는 것 중에서도 '따로 나가는 타격' 과 '조건을 모델링 못 함' 만 여기 싣는다.
    // 유틸(이동 속도 등)과 페널티는 애초에 대미지 항목이 아니라, 같이 실으면 목록이
    // 수백 줄이 되고 정작 논란이 되는 두 종류가 묻힌다. 룬 상세 패널에는 전부 나온다.
    for (const u of uncountedOf(r)) {
      if (u.kind !== '직접 피해' && u.kind !== '조건부' && u.kind !== '스킬한정') continue;
      rows.push({ group: '룬', name: r.name, kind: u.kind, text: u.text });
    }
  }
  for (const a of ARTIFACTS) {
    if (a.uncounted) rows.push({ group: '아티팩트', name: a.name, kind: '계산 밖', text: a.uncounted });
  }
  for (const [name, m] of Object.entries(COMBAT_MASTERIES)) {
    for (const u of m.uncounted ?? []) {
      rows.push({ group: '전투 숙련', name, kind: '계산 밖', text: u });
    }
  }
  return rows;
}

function renderUncounted(root) {
  const rows = collectUncounted();
  const card = el('div', 'panel');
  const head = el('div', 'panel-head');
  head.append(el('h2', null, '계산 밖 항목'), badgeBox(`${rows.length}건`));
  card.append(head);
  card.append(el('p', 'lead',
    '아래 항목들은 점수에 0 으로 잡힙니다. 빠뜨린 값이 아니라 위의 비교 방식에 자리가 없는 것들이고, '
    + '이유는 항목마다 데이터에 적혀 있습니다. 추천기에서 룬 상세를 열면 그 룬 것만 따로도 볼 수 있습니다 '
    + '— 이동 속도 같은 유틸과 페널티까지 거기에는 전부 나옵니다.'));

  let group = null;
  let list = null;
  for (const r of rows) {
    if (r.group !== group) {
      group = r.group;
      card.append(el('h3', null, group));
      list = el('ul', 'd-list');
      card.append(list);
    }
    const li = el('li');
    li.append(el('b', null, r.name), el('span', 'tag', r.kind), document.createTextNode(' ' + r.text));
    list.append(li);
  }
  root.append(card);
}

// ── ③ 직업별로 뺀 것 ────────────────────────────────────
// 룬·아티팩트만 계산 밖인 게 아니다. 직업 패시브 중에도 안 넣은 것이 있고, 자기 직업
// 얘기가 없으면 이 페이지는 "내 얘기는 아니네" 가 된다. 이유는 데이터가 갖고 있다.
function renderJobExclusions(root) {
  const rows = Object.entries(JOB_EXCLUSIONS);
  if (!rows.length) return;
  const card = el('div', 'panel');
  const head = el('div', 'panel-head');
  head.append(el('h2', null, '직업별로 뺀 것'),
    badgeBox(`${rows.reduce((n, [, v]) => n + v.length, 0)}건`));
  card.append(head);
  card.append(el('p', 'lead',
    '직업 패시브 중에도 계산에 안 넣은 것이 있습니다. 대부분 특정 스킬에만 붙거나 '
    + '버프 구간을 덮지 못해서, 한 대 대미지로 견주는 이 방식에 자리가 없는 것들입니다.'));
  const list = el('ul', 'd-list');
  for (const [job, items] of rows) {
    for (const e of items) {
      const li = el('li');
      li.append(el('b', null, job), el('span', 'tag', '계산 밖'),
        document.createTextNode(` ${e.what} — ${e.why}`));
      list.append(li);
    }
  }
  card.append(list);
  card.append(el('p', 'note',
    '여기 없는 직업이라고 전부 반영된 것은 아닙니다 — 아직 확인하지 못한 패시브일 수 있습니다. '
    + '자기 직업에서 빠진 것이 보이면 알려주세요.'));
  root.append(card);
}

// ── ④ 채워줄 수 있는 것 ──────────────────────────────────
// 신뢰도 목록 자체는 저장소의 HELP-WANTED.md 가 갖고 있다. 같은 표를 여기 한 벌 더
// 그리면 두 벌이 되고, 둘이 어긋나는 것은 시간 문제다. 여기서는 길만 알려준다.
function renderHelp(root) {
  const card = el('div', 'panel');
  const head = el('div', 'panel-head');
  head.append(el('h2', null, '이건 채워주실 수 있습니다'));
  card.append(head);
  card.append(el('p', null,
    '위의 「확증 못 함」 항목들은 게임 툴팁에 안 적힌 숫자라 화면으로는 확인할 수가 없습니다. '
    + '직업을 아는 분이 알려주시면 그날 반영됩니다.'));
  const actions = el('p');
  const report = el('a', 'ghost', '수치 제보하기');
  report.href = '/report';
  const help = el('a', 'ghost', '어느 항목이 불확실한지 보기 (HELP-WANTED.md)');
  help.href = 'https://github.com/mobinogi-tools/rune-optimizer/blob/main/HELP-WANTED.md';
  help.target = '_blank';
  help.rel = 'noopener noreferrer';
  actions.append(report, document.createTextNode(' '), help);
  card.append(actions);
  root.append(card);
}

const root = document.querySelector('#limits-root');
renderLimits(root);
renderUncounted(root);
renderJobExclusions(root);
renderHelp(root);
