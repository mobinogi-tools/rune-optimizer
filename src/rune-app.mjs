// 룬 추천기 UI.
//
// 계산은 전부 기존 순수 모듈에 맡긴다(calculator / build-evaluator / rune-conditionals).
// 이 파일은 상태 관리와 DOM 만 담당한다.

import { RUNES } from './runes-data.mjs';
import { fieldLabel } from './gen/effect-fields.mjs';
import { uncountedOf, baseName } from './rune-uncounted.mjs';
import { evaluate, SLOT_CAPACITY, resolveRuneEffects } from './build-evaluator.mjs';
import {
  validateRuneSet, DRAGON_SIGIL, AWAKENING_RUNES, CURSE_RUNES, EROSION_RUNES,
  UTILITY_DAMAGE_EQUIVALENT, RUNE_CONDITIONALS, NEGATIVE_TRAITS,
  SPECIAL_TRIGGER_RUNES, VULNERABLE_RUNES, DOT_TRIGGER_RUNES, DOT_APPLIER_RUNES,
  POLLUTION_REDUCTION, NIGHT_BLESSING, migrateConditionalOverrideKeys,
} from './rune-conditionals.mjs';
import { DEFAULT_PROFILE } from './default-profile.mjs';
import { migrateMeasureToPairs } from './save-migrations.mjs';
import { solveMeasurement, measurementPrecision, artifactsChanged } from './measure.mjs';
import { JOB_SAMPLES } from './gen/jobs-data.mjs';
import { IMPORT_PROMPT, IMPORT_FIELDS, parseStatPaste, importPreview } from './stat-import.mjs';
import {
  ARTIFACTS, ARTIFACT_SLOTS, sumArtifacts, artifactTotal, BASE_ATTACK_PER_ARTIFACT,
  artifactMax, overColorLimit, COLOR_LIMIT, attackBearingSlots,
} from './artifacts-data.mjs';
import {
  COMBAT_MASTERIES, MASTERY_NAMES, JOB_MASTERY, masteryEffects, masteryUncounted,
} from './combat-mastery.mjs';
import { uptimePassive, nightBlessingCycleSeconds, CLASS_NIGHT_BLESSING } from './class-passives.mjs';

// 빌드 표시용. 화면 우상단에 찍히며 저장과는 무관하다.
const APP_VERSION = '2026.08.06-44';

// 저장 스키마 버전. 상태의 '구조'가 바뀔 때만 올린다.
// 색·문구·계산식 수정으로는 절대 올리지 않는다 — 올리면 사용자의 측정값과 설정이 날아간다.
const SCHEMA_VERSION = 'v2';
const STORAGE_KEY = `mobinogi-rune-optimizer:${SCHEMA_VERSION}`;
// 장신구는 수치 옵션이 하나도 없어(189개 전수 확인) 추천할 것이 없다. UI에서 아예 뺀다.
const SLOT_ORDER = ['무기', '방어구', '엠블럼'];
/** 조건부 옵션을 어떻게 볼지. 누르면 추천 전체가 그 기준으로 다시 계산된다. */
const SCENARIOS = [
  { key: 'min', label: '최소', desc: '조건부가 하나도 발동하지 않을 때' },
  { key: 'expected', label: '기대값', desc: '가동률을 반영한 평균' },
  { key: 'max', label: '최대', desc: '조건부가 전부 발동할 때' },
];
const USABLE = RUNES.items.filter((r) => SLOT_ORDER.includes(r.slot));

const STAT_FIELDS = [
  ['rapidEnhance', '연타 강화'], ['heavyEnhance', '강타 강화'], ['areaEnhance', '광역 강화'],
  ['comboEnhance', '콤보 강화'], ['ultimateEnhance', '궁극기'], ['criticalStat', '치명타'],
  ['breakStat', '브레이크'], ['extraHitStat', '추가타'], ['skillPower', '스킬 위력'],
];
const EXTRA_FIELDS = [];
/** 헬리오도르 등급별 대미지 증가. 게임 내 표기 기준. */
const HELIO_TIERS = [
  ['none', '없음', 0],
  ['base', '헬리오도르', 5.0],
  ['refined', '정제된', 5.2],
  ['pure', '순수한', 5.4],
];
/** 결과를 크게 흔드는 입력에는 무엇에 영향을 주는지 적어 둔다. */
const FIELD_HINTS = {
  hitsPerSecond: '바위 칼날 스택(최대 30 = 초당 3타 필요), 초월 엠블럼·숲 길잡이 가동률을 좌우합니다.',
  // 직업별 수치는 여기 적지 않는다 — data/jobs 의 트리거 간격에서 nightBlessingHint() 가
  // 만들어 붙인다. 산문에 숫자를 박아두면 데이터를 고쳐도 설명이 안 따라가 서로 어긋난다.
  nightBlessingCycleSeconds: '밤의 축복 버프가 몇 초마다 뜨는지. 스킬 쿨은 60초지만 직업 트리거가 와야 발동해서 대개 더 깁니다. 직접 재보셨으면 그 값을 넣으세요.',
  ultimateEnhance: '⚠ 아직 계산에 안 들어갑니다. 공식은 궁극기/8750 이고 궁극기 스킬 데미지에만 붙는데, 전체 딜에서 궁극기가 차지하는 비중을 받아야 반영할 수 있습니다.',
  skillCastsPerSecond: '타격 수가 아니라 스킬을 쓰는 횟수입니다. 스킬 하나가 여러 번 때리므로 초당 타수보다 작습니다. 공세+ 처럼 \'스킬 사용 시\' 쌓이는 스택에 쓰입니다.',
  rapidRatePercent: '연타 판정이 뜨는 비율. D항에서 연타 피해 옵션에 곱해집니다. 거대한 분노의 기대 중첩도 강타율에서 나옵니다.',
  areaRatePercent: '멀티히트 판정이 뜨는 비율. 한 공격이 동시에 2명 이상을 맞혀야 뜹니다 — 광역기를 써도 보스 하나만 때리면 안 뜹니다. 이 판정의 피해를 키우는 스탯이 스탯창의 \'광역 강화\'입니다. 보스전이면 0.',
  heavyRatePercent: '강타 판정이 뜨는 비율. 강한 적일수록 낮아지는 편입니다.',
  characterCriticalRatePercent: '스탯·룬으로 설명되지 않는 직업 몫.',
  characterExtraRatePercent: '스탯·룬으로 설명되지 않는 직업 몫.',
};

/**
 * 전투 패턴 입력을 성격별로 나눈다. 한 덩어리로 늘어놓으면 '내가 재야 하는 값'과
 * '직업이 정해주는 값'이 섞여 무엇을 손대야 할지 알 수 없다.
 */
const COMBAT_GROUPS = [
  {
    title: '직업 공통',
    desc: '모든 직업에 있는 값입니다.',
    fields: [
      ['hitsPerSecond', '초당 타수'],
      ['skillCastsPerSecond', '초당 스킬 시전'],
      ['nightBlessingCycleSeconds', '밤의 축복 주기 (초)'],
    ],
  },
  {
    title: '직업 특성',
    desc: '직업마다 있기도 하고 없기도 합니다. 해당 패시브가 없으면 0으로 두세요.',
    fields: [
      ['characterCriticalRatePercent', '직업 치확 보정 %'],
      ['characterExtraRatePercent', '직업 추확 보정 %'],
    ],
  },
  {
    title: '캐릭터 상태',
    desc: '같은 직업이어도 장비·상대·콘텐츠에 따라 크게 달라집니다. 실제로 뜨는 비율을 넣으세요.',
    fields: [
      ['rapidRatePercent', '실연타율 %'],
      ['heavyRatePercent', '실강타율 %'],
      ['areaRatePercent', '실멀티히트율 %'],
    ],
  },
];

// ── 상태 ────────────────────────────────────────────────
const defaultState = () => ({
  job: '댄서',
  // 샘플이 있는 항목만 샘플값으로 채운다. 측정값·장비값은 DEFAULT_PROFILE 에서 비워 두고
  // 사용자가 넣는다 — 남의 숫자가 들어 있으면 자기 값이 아니라는 걸 모른 채 결과를 믿는다.
  profile: { ...DEFAULT_PROFILE, assumeVulnerable: false },
  // 샘플이 없는 항목은 비운 채로 시작한다. 착용 룬과 아티팩트는 '예시 수치'가 아니라
  // 남의 세팅 자체라, 들어 있으면 자기 것을 넣기 전에 추천이 그 세트 기준으로 나와 오해를 부른다.
  equipped: [],
  // 룬별 가정 덮어쓰기: { [룬이름]: { utility: %, cond: { [조건부 id]: 기대값% } } }
  // cond 의 키는 라벨이 아니라 id 다 — 라벨을 키로 쓰면 문구를 다듬는 것만으로 값이 사라진다.
  overrides: {},
  candidates: USABLE.map((r) => r.name),
  // 특수 트리거는 기본 제외다 — 체력을 낮게 유지하거나 일부러 맞아주는 플레이를 전제하는데
  // 대부분에게는 해당하지 않아, 켜두면 추천이 그쪽으로 쏠린다.
  filters: { legendaryOnly: false, specialTrigger: true },
  // 필터로 걸러졌지만 사용자가 개별로 되살린 룬. 필터를 켜둔 채 예외를 두기 위한 것이다.
  exceptions: [],
  // 추천을 어느 시나리오로 계산할지. 조건부가 하나도 안 터지는 최소, 기대값, 전부 터지는 최대.
  scenario: 'expected',
  artifacts: {},  // 아티팩트 이름 → 개수 (합계 최대 5, 유일 효과는 1개만 적용)
  // 스탯창을 두 번 읽는다. 각 읽기는 (공격력, 그때의 공증룬 합 %) 한 쌍이다.
  measure: { a: { attack: null, runePercent: null }, b: { attack: null, runePercent: null },
    nonRunePercent: null, attackA: null, at: null, committed: false, artifactSig: '' },
});

let state = load() ?? defaultState();

function load() {
  try {
    // 예전 스키마 저장분은 정리한다(현재 키는 건드리지 않는다).
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('mobinogi-rune-optimizer') && k !== STORAGE_KEY) localStorage.removeItem(k);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const d = defaultState();
    // 예전 저장분에 combatMastery 가 '' 로 남아 있을 수 있다. 읽을 때 masteryOf() 가
    // 막아주긴 하지만, 저장분 자체를 정리해 두는 편이 나중에 헷갈리지 않는다.
    if (s.profile && !MASTERY_NAMES.includes(s.profile.combatMastery)) delete s.profile.combatMastery;
    // 조정값 키를 라벨에서 id 로 옮긴다. SCHEMA_VERSION 을 올려 저장분을 버리는 대신
    // 여기서 1회 변환하는 이유는 위 주석 그대로다 — 측정값까지 같이 날릴 일이 아니다.
    const migrated = migrateConditionalOverrideKeys(s.overrides ?? {});
    const next = { ...d, ...s, profile: { ...d.profile, ...s.profile }, filters: { ...d.filters, ...s.filters }, overrides: migrated.overrides, exceptions: Array.isArray(s.exceptions) ? s.exceptions : [],
      scenario: SCENARIOS.some((x) => x.key === s.scenario) ? s.scenario : 'expected', artifacts: (s.artifacts && !Array.isArray(s.artifacts)) ? s.artifacts : {} };
    // 옛 측정(기준 룬 하나를 빼는 방식)을 '두 번 읽기' 모양으로 옮긴다.
    // 공격력은 사용자가 넣은 값 그대로, 공증합은 옛 코드가 이미 쓰던 값이라 결과가 안 변한다.
    // runeByName 은 이 파일 아래쪽에서 만들어진다 — load() 는 그전에 돈다. 여기서 쓰면
    // TDZ 로 터지고, 그러면 load() 의 catch 가 삼켜 저장분이 통째로 없는 것처럼 된다.
    const pctOf = (n) => RUNES.items.find((r) => r.name === n)?.alwaysOnAttackPercent ?? 0;
    const paired = migrateMeasureToPairs(next, pctOf);
    Object.assign(next, paired.state);
    const changedAny = migrated.changed || paired.changed;
    // 변환 결과를 바로 되쓴다. 안 그러면 열 때마다 다시 변환하게 되고, 그 사이에
    // 라벨이 또 바뀌면 그때는 짝을 못 찾아 조정값이 정말로 사라진다.
    // save() 는 아직 state 가 없어 못 쓴다(이 함수가 state 를 만드는 중이다).
    if (changedAny) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch { return null; }
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveHint('저장됨');
  } catch { setSaveHint('저장 실패(브라우저 설정 확인)'); }
}
function setSaveHint(t) {
  const el = document.querySelector('#save-state');
  el.textContent = t;
  clearTimeout(setSaveHint.t);
  setSaveHint.t = setTimeout(() => { el.textContent = ''; }, 1600);
}

/** 값이 계산됐는지 (미리보기용) */
/** 필터를 통과하는가 (체크박스와 별개로 덧씌워지는 제외 조건) */
/** 필터 키 → 어떤 룬을 걸러내는가. 판정·부분적용 표시·개수 표기가 전부 여기서 나온다. */
const FILTER_DEFS = [
  { key: 'legendaryOnly', excludes: (r) => r.grade === '신화' },
  { key: 'specialTrigger', excludes: (r) => SPECIAL_TRIGGER_RUNES.includes(baseName(r.name)) },
  { key: 'dotTrigger', excludes: (r) => DOT_TRIGGER_RUNES.includes(baseName(r.name)) },
  ...Object.entries(NEGATIVE_TRAITS).map(([key, t]) => ({
    key, excludes: (r) => t.runes.includes(baseName(r.name)),
  })),
];

/** 이 룬이 어떤 켜진 필터에 걸리는가(예외는 무시). */
const blockingFilters = (r) => FILTER_DEFS.filter((f) => state.filters[f.key] && f.excludes(r));

function passesFilters(name) {
  const r = runeByName(name);
  if (!r) return false;
  // 개별로 되살린 룬은 필터를 무시한다.
  if (state.exceptions.includes(name)) return true;
  return blockingFilters(r).length === 0;
}

/** 이 필터가 켜져 있는데 예외가 하나라도 있으면 '부분 적용'이다. */
const filterHasException = (f) =>
  state.filters[f.key] && USABLE.some((r) => f.excludes(r) && state.exceptions.includes(r.name));

/** 게임 조건 태그(무방비 / 특수 트리거). 부정 효과와 달리 '나쁜 룬'이라는 뜻이 아니다. */
function conditionTagsOf(rune) {
  const n = baseName(rune.name), out = [];
  if (VULNERABLE_RUNES.includes(n)) {
    // "값이" 가 아니라 "일부 값이" 다. 무방비 의존 경로가 둘인데(항목 자체가 꺼지는 것과
    // break.* 필드가 죽는 것), 위엄처럼 나머지 효과는 그대로 붙는 룬도 있다.
    out.push(['무방비', '일부 값이 무방비(브레이크)를 유효하게 계산할 때만 붙습니다']);
  }
  if (SPECIAL_TRIGGER_RUNES.includes(n)) {
    out.push(['상황 한정', '체력·자원·위치·파티·전투 길이 같은 특정 상황에서만 값이 납니다']);
  }
  if (DOT_TRIGGER_RUNES.includes(n)) {
    out.push(['지속 피해 트리거', `지속 피해가 걸린 적을 때려야 켜집니다. 부여하는 룬: ${DOT_APPLIER_RUNES.join(', ')}`]);
  }
  return out;
}

/** 이 룬이 가진 부정 효과 목록 */
function negativeTraitsOf(rune) {
  return Object.values(NEGATIVE_TRAITS).filter((t) => t.runes.includes(baseName(rune.name)));
}
/** 실제 추천에 쓰이는 후보 = 체크된 것 ∩ 필터 통과 */
const effectiveCandidates = () => state.candidates.filter(passesFilters);

/**
 * 지금 적용할 전투 숙련.
 * 저장분이 빈 문자열이거나 모르는 이름일 수 있으므로 목록에 있는지 확인한다.
 * ?? 로만 걸러내면 '' 가 그대로 통과해 숙련이 조용히 꺼진 채로 굳는다.
 */
const masteryOf = () => {
  const v = state.profile.combatMastery;
  return MASTERY_NAMES.includes(v) ? v : (JOB_MASTERY[state.job] ?? '쾌속');
};

/** 아티팩트 구성을 문자열 하나로. 측정 시점과 지금이 같은지 비교하는 데만 쓴다. */
const artifactSignature = () => Object.entries(state.artifacts ?? {})
  .filter(([, n]) => n > 0).map(([k, n]) => `${k}:${n}`).sort().join(',');

/** 측정 이후 아티팩트가 실제로 바뀌었는가. 판단은 measure.mjs 의 artifactsChanged() 가 한다. */
const artifactsChangedSinceMeasure = () =>
  artifactsChanged(state.measure.artifactSig, artifactSignature());

const isComputed = () => Number.isFinite(state.measure.nonRunePercent);
/** 사용자가 '측정 완료'로 확정했는지 — 결과는 이때만 열린다 */
const isMeasured = () => isComputed() && state.measure.committed;
const runeByName = (n) => USABLE.find((r) => r.name === n);
const fmtPct = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;
/** 소수 둘째 자리에서 0 이면 0 으로 적는다. 안 그러면 '-0.00%' 가 나온다 — 룬 외 공증이
 *  딱 0 인 사람에게 음수처럼 보이고, 이 값은 음수면 안 되는 값이라 더 헷갈린다. */
const fmtPercent = (v) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);

/** 이 룬에 사용자가 조정할 가정이 있는가 */
function hasTweaks(rune) {
  const n = baseName(rune.name);
  const util = (UTILITY_DAMAGE_EQUIVALENT[rune.name] ?? UTILITY_DAMAGE_EQUIVALENT[n])?.percent ?? 0;
  if (util > 0 || uncountedOf(rune).some((u) => u.kind === '유틸')) return true;
  const modeled = RUNE_CONDITIONALS[rune.name] ?? RUNE_CONDITIONALS[n];
  return !!modeled?.some((e) => e.basis === 'playstyle');
}

/** 계열 배지 */
function badges(rune) {
  const n = baseName(rune.name), out = [];
  const fam = [...DRAGON_SIGIL.enablers, ...DRAGON_SIGIL.extenders, ...DRAGON_SIGIL.consumers];
  if (fam.includes(n)) out.push(['용의 문장', 'dragon']);
  if (EROSION_RUNES.includes(n)) out.push(['침식', 'erosion']);
  if (AWAKENING_RUNES.includes(n)) out.push(['각성', 'awaken']);
  if (CURSE_RUNES.includes(n)) out.push(['저주', 'curse']);
  if (/밤의 축복/.test(rune.desc)) out.push(['밤의 축복', 'night']);
  if (((UTILITY_DAMAGE_EQUIVALENT[rune.name] ?? UTILITY_DAMAGE_EQUIVALENT[n])?.percent ?? 0) > 0) out.push(['쿨감 환산', 'util']);
  return out;
}

// ── 측정 ────────────────────────────────────────────────
/** 착용 룬이 주는 공증 합계 */
function equippedAttackPercent(equipped = state.equipped) {
  return equipped.reduce((s, n) => s + (runeByName(n)?.alwaysOnAttackPercent ?? 0), 0);
}

/** 입력값 검증. 스탯창 공격력은 양의 정수여야 한다 — 스탯창에 소수는 안 뜬다. */
function measureInputError(m) {
  for (const [i, r] of [m.a, m.b].entries()) {
    const v = r?.attack;
    if (v === null || v === undefined) continue;
    if (!Number.isFinite(v) || v <= 0) return `${i + 1}번 공격력은 0보다 큰 값이어야 합니다.`;
    if (!Number.isInteger(v)) return `${i + 1}번 공격력은 정수여야 합니다. 스탯창 값을 그대로 넣어 주세요.`;
    const pctv = r?.runePercent;
    if (pctv !== null && pctv !== undefined && (!Number.isFinite(pctv) || pctv < 0)) {
      return `${i + 1}번 공증룬 합은 0 이상이어야 합니다.`;
    }
  }
  return null;
}

/**
 * 두 읽기에서 깡공(A)과 룬 외 공증을 구해 state 에 넣는다.
 *
 * 산수는 src/measure.mjs 에 있다 — 여기 두면 DOM 을 타서 검사를 못 한다.
 * 이 함수는 화면에 말을 붙이는 일만 한다.
 */
function computeMeasure() {
  const m = state.measure;
  const el = document.querySelector('#measure-result');
  const clear = () => { m.nonRunePercent = null; m.attackA = null; };

  const inputErr = measureInputError(m);
  if (inputErr) {
    el.className = 'measure-result bad';
    el.textContent = inputErr;
    clear();
    return;
  }

  const r = solveMeasurement(m.a, m.b);
  if (!r.ok) {
    clear();
    if (r.error === 'incomplete') { el.className = 'measure-result'; el.textContent = ''; return; }
    el.className = 'measure-result bad';
    el.innerHTML = `<b>값이 서로 맞지 않습니다.</b> ${r.detail ?? ''}`;
    return;
  }

  m.attackA = r.attackA;
  m.nonRunePercent = r.nonRunePercent;

  // 정밀도를 같이 말해준다. "정확히 재세요" 는 무엇을 하라는 말인지 알 수 없다 —
  // 공증 차이를 키우면 나아진다는 것까지 적어야 고칠 수 있다.
  const { attackError, weak } = measurementPrecision(r.spread);
  el.className = 'measure-result good';
  el.innerHTML =
    `깡공 <b>A ≈ ${Math.round(r.attackA).toLocaleString()}</b> · ` +
    `총 공증 <b>${r.totalPercent.toFixed(2)}%</b> ` +
    `(공증룬 ${m.a.runePercent}% + 그 외 <b>${fmtPercent(r.nonRunePercent)}%</b>)` +
    (weak
      ? `<div class="diag">· 두 상태의 공증 차이가 <b>${Math.abs(r.spread)}%p</b> 로 작습니다. ` +
        `스탯창이 정수로 잘리는 것만으로도 깡공이 <b>±${Math.round(attackError)}</b> 흔들립니다 — ` +
        `공증룬을 더 빼고 재면 정확해집니다.</div>`
      : '');
}

function renderMeasure() {
  const measured = isMeasured();
  // 버튼은 입력칸 오른쪽에 처음부터 자리한다. 값이 유효할 때만 눌린다.
  const btn = document.querySelector('#measure-submit');
  const outcome = document.querySelector('#measure-outcome');
  const hasMessage = !!document.querySelector('#measure-result').textContent.trim();
  outcome.hidden = !hasMessage;
  btn.disabled = !isComputed();
  btn.textContent = state.measure.committed ? '다시 측정' : '측정';
  document.querySelector('#measure-body').hidden = measured && !renderMeasure.open;
  document.querySelector('#measure-summary').hidden = !measured || renderMeasure.open;
  document.querySelector('#measure-toggle').hidden = !measured;
  document.querySelector('#measure-toggle').textContent = renderMeasure.open ? '접기' : '재측정';
  document.querySelector('#measure-section').classList.toggle('done', measured);
  if (measured) {
    document.querySelector('#sum-nonrune').textContent = `${fmtPercent(state.measure.nonRunePercent)}%`;
    document.querySelector('#sum-a').textContent = Math.round(state.measure.attackA).toLocaleString();
    document.querySelector('#sum-date').textContent = state.measure.at ? `(${state.measure.at} 측정)` : '';
  }
  const stale = document.querySelector('#measure-stale');
  stale.hidden = !(measured && artifactsChangedSinceMeasure());
  stale.innerHTML = '측정 이후 <b>아티팩트가 바뀌었습니다</b>. ' +
    '아티팩트는 공증(B)만이 아니라 깡공(A)도 바꾸므로(개당 133, 실측) 지금 값은 맞지 않습니다. ' +
    '<b>다시 측정</b>해 주세요.';
  document.querySelector('#result-blocked').hidden = measured;
  document.querySelector('#result-body').hidden = !measured;
  // 결과만 잠근다. 룬 선택까지 잠그면, 착용을 비운 상태에서 측정을 못 끝내 막혀버린다.
}

// ── 평가 ────────────────────────────────────────────────
function profileFor() {
  // 아티팩트 선택분을 프로필의 아티팩트 항목으로 환산한다.
  const a = sumArtifacts(state.artifacts);
  return {
    ...state.profile,
    combatMastery: masteryOf(),
    job: state.job,
    // 연타·강타·멀티히트의 on/off 파생은 build-evaluator 의 buildFrom 이 한다.
    // 여기서 하면 UI 를 거치지 않는 호출(테스트 등)에서만 조용히 0 이 된다.
    nonRuneAttackPercent: state.measure.nonRunePercent ?? 0,
    runeOverrides: state.overrides,
    artifactDamagePercent: a['damageIncrease.itemMainDamagePercent'] ?? 0,
    artifactCriticalRatePercent: a['critical.runeCriticalRatePercent'] ?? 0,
    artifactExtraRatePercent: a['extraHit.runeExtraRatePercent'] ?? 0,
    artifactRapidDamagePercent: a['enhancement.rapidDamagePercent'] ?? 0,
    artifactHeavyDamagePercent: a['enhancement.heavyDamagePercent'] ?? 0,
    artifactAreaDamagePercent: a['enhancement.areaDamagePercent'] ?? 0,
    artifactComboDamagePercent: a['enhancement.comboDamagePercent'] ?? 0,
    // 공격력%는 룬 외 공증에 이미 포함돼 있을 수 있으나, 아티팩트를 명시 선택했으면 그쪽을 따른다.
    // 아티팩트 공격력%는 스탯창에 이미 반영돼 측정값(nonRuneAttackPercent)에 포함된다.
    // 평가기에서 더하지 않으므로 여기서도 넘기지 않는다.
    artifactAttackPercent: 0,
    artifactVulnerabilityPercent: a['break.vulnerabilityDamagePercent'] ?? 0,
  };
}
/** 추천·최적화는 전부 이 함수를 거친다. 시나리오를 바꾸면 순위가 통째로 그 기준으로 바뀐다. */
const score = (set, sc = state.scenario) => evaluate(RUNES, set, sc, profileFor()).score;

function slotOf(name) { return runeByName(name)?.slot; }
function equippedBySlot() {
  const m = {}; for (const s of SLOT_ORDER) m[s] = [];
  for (const n of state.equipped) { const s = slotOf(n); if (s) m[s].push(n); }
  return m;
}

/** 힐클라이밍. 후보가 많아도 슬롯당 선형 탐색이라 브라우저에서 충분히 빠르다. */
/**
 * 시너지 프로브 대상 — 단독 한계가치가 조합 가치보다 한참 낮아, 한 번에 하나씩 바꾸는
 * 등반으로는 절대 들어가지 못하는 룬들.
 *   용의 문장: 발동 룬 단독은 가동률 50%, 연장·소비 룬 단독은 0. 쌍이 되어야 값이 난다.
 *   저주: 억눌린 충동(무기)과 날 선 적의(방어구)가 '동시 1개' 제한을 공유한다. 서로 바꾸려면
 *         두 슬롯을 동시에 건드려야 하는데 중간 상태가 전부 불법이라 단일 스왑으로 못 건넌다.
 * 침식·각성은 여기 없어도 된다 — 침식은 단독 기대값이 커서 그냥 들어가고, 각성 3종은 전부
 * 방어구라 같은 슬롯 스왑으로 교체된다. (제한 후보 풀 150회 전수 대조로 확인)
 */
const DRAGON_FAMILY = [...DRAGON_SIGIL.enablers, ...DRAGON_SIGIL.extenders, ...DRAGON_SIGIL.consumers];
const PROBE_FAMILY = [...DRAGON_FAMILY, ...CURSE_RUNES];

/** 언덕오르기 한 판. pinned 에 든 룬은 빼지 않는다(프로브가 심은 씨앗을 지키기 위해). */
function climb(start, cand, pinned = new Set(), maxPasses = 8) {
  let cur = [...start];
  const valid = (set) => validateRuneSet(set).valid;
  let curScore = valid(cur) ? score(cur) : -1;
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    for (const s of SLOT_ORDER) {
      const cap = SLOT_CAPACITY[s];
      for (let i = 0; i < cap; i++) {
        for (const c of cand[s]) {
          if (cur.includes(c)) continue;
          // 자리 계산은 후보마다 다시 해야 한다. cur 이 이 루프 안에서 바뀌기 때문이다.
          const inSlot = cur.filter((n) => slotOf(n) === s);
          if (i < inSlot.length && pinned.has(inSlot[i])) continue;
          const next = [...cur];
          if (i < inSlot.length) next[cur.indexOf(inSlot[i])] = c;
          else if (inSlot.length < cap) next.push(c);
          else continue;
          if (!valid(next)) continue;
          const v = score(next);
          if (v > curScore) { cur = next; curScore = v; improved = true; }
        }
      }
    }
    if (!improved) break;
  }
  return { set: cur, score: curScore };
}

/**
 * rune 을 최선 위치에 강제로 넣는다. 점수가 내려가도 넣는다 — 그게 프로브의 목적이다.
 * 계열 제한에 걸리면 충돌 룬을 쫓아내는 경우도 시도한다. 충돌 룬이 다른 슬롯에 있을 수 있어
 * (저주는 무기↔방어구에 걸쳐 있다) 이 축출이 없으면 능선을 못 건넌다.
 */
function bestInsertion(set, rune, pinned = new Set()) {
  const s = slotOf(rune);
  const inSlot = set.filter((n) => slotOf(n) === s);
  const options = [];
  if (inSlot.length < SLOT_CAPACITY[s]) options.push([...set, rune]);
  for (const old of inSlot) if (!pinned.has(old)) options.push(set.map((n) => (n === old ? rune : n)));
  let best = null;
  for (const next of options) {
    const legal = validateRuneSet(next).valid ? [next]
      : next.filter((n) => n !== rune && !pinned.has(n))
        .map((r) => next.filter((n) => n !== r))
        .filter((x) => validateRuneSet(x).valid);
    for (const c of legal) {
      const v = score(c);
      if (!best || v > best.score) best = { set: c, score: v };
    }
  }
  return best;
}

/** 축출로 생긴 빈 칸을 탐욕으로 채운다. */
function greedyFill(set, cand) {
  let cur = [...set];
  for (const s of SLOT_ORDER) {
    while (cur.filter((n) => slotOf(n) === s).length < SLOT_CAPACITY[s]) {
      let bestAdd = null;
      for (const c of cand[s]) {
        if (cur.includes(c)) continue;
        const next = [...cur, c];
        if (!validateRuneSet(next).valid) continue;
        const v = score(next);
        if (!bestAdd || v > bestAdd.score) bestAdd = { set: next, score: v };
      }
      if (!bestAdd) break;
      cur = bestAdd.set;
    }
  }
  return cur;
}

/**
 * 최적 세트 탐색 — 언덕오르기 + 시너지 프로브.
 *
 * 순수 언덕오르기는 '둘이 모여야 값이 나는' 조합을 구조적으로 못 찾는다. 첫 룬을 넣는 순간
 * 점수가 떨어지니 거기서 버리기 때문이다. 그래서 수렴한 뒤, 그런 룬을 강제로 박아넣고
 * 다시 등반해 본다. 전수 탐색은 조합이 3억을 넘어 불가능하다.
 *
 * 제한 후보 풀(보유 룬만 체크한 상황) 150회를 완전 전수와 대조한 결과,
 * 실패율 10.7%(최악 −12.0%) → 1.3%(최악 −0.58%).
 */
function optimize() {
  const cand = {};
  const eff = effectiveCandidates();
  for (const s of SLOT_ORDER) cand[s] = eff.filter((n) => slotOf(n) === s);
  const bySlot = equippedBySlot();

  let best = climb(SLOT_ORDER.flatMap((s) => bySlot[s]), cand);

  for (const p of eff.filter((n) => PROBE_FAMILY.includes(baseName(n)))) {
    if (best.set.includes(p)) continue;
    let seeded = bestInsertion(best.set, p);
    if (!seeded) continue;
    if (DRAGON_FAMILY.includes(baseName(p))) {
      // 용의 문장은 파트너가 있어야 값이 난다 — 최선 파트너도 씨앗에 같이 심는다.
      let pair = null;
      for (const q of cand['방어구']) {
        if (q === p || seeded.set.includes(q) || !DRAGON_FAMILY.includes(baseName(q))) continue;
        const withQ = bestInsertion(seeded.set, q, new Set([p]));
        if (withQ && (!pair || withQ.score > pair.score)) pair = withQ;
      }
      if (pair && pair.score > seeded.score) seeded = pair;
    }
    const filled = greedyFill(seeded.set, cand);
    // 씨앗이 현 최고점에 한참 못 미치면 재등반해도 못 뒤집는다. 비용을 아낀다.
    if (score(filled) > best.score * 0.97) {
      const probed = climb(filled, cand, new Set([p]), 4);
      if (probed.score > best.score) best = probed;
    }
  }

  // 지금 낀 저주 룬이 함정일 수 있다. 빼고 금지한 채 한 번 더 돈다.
  for (const b of best.set.filter((n) => CURSE_RUNES.includes(baseName(n)))) {
    const cand2 = {};
    for (const s of SLOT_ORDER) cand2[s] = cand[s].filter((n) => n !== b);
    const dropped = greedyFill(best.set.filter((n) => n !== b), cand2);
    if (score(dropped) > best.score * 0.97) {
      const probed = climb(dropped, cand2, new Set(), 4);
      if (probed.score > best.score) best = probed;
    }
  }

  // 안전망 — 어떤 경로로도 정원을 넘긴 세트가 나오면 안 된다.
  for (const s of SLOT_ORDER) {
    const n = best.set.filter((x) => slotOf(x) === s).length;
    if (n > SLOT_CAPACITY[s]) console.error(`optimize: ${s} ${n}개 (정원 ${SLOT_CAPACITY[s]})`);
  }
  return best;
}

// ── 렌더 ────────────────────────────────────────────────
/**
 * 말풍선을 화면 안으로 밀어 넣는다.
 *
 * 기본은 버튼 중앙 정렬인데, 그리드 가장자리 칸에서는 화면 밖으로 나간다.
 * 열이 몇 개인지가 폭에 따라 달라져서 CSS 만으로는 어느 칸이 가장자리인지 알 수 없다.
 * 그래서 띄운 뒤 실제 위치를 재서 넘친 만큼만 되민다. 꼬리는 반대로 밀어 버튼을 계속 가리킨다.
 */
function positionHint(box) {
  box.style.transform = 'translateX(-50%)';
  box.style.setProperty('--tail-shift', '0px');
  const pad = 8;
  const r = box.getBoundingClientRect();
  let shift = 0;
  if (r.left < pad) shift = pad - r.left;
  else if (r.right > window.innerWidth - pad) shift = window.innerWidth - pad - r.right;
  if (shift) {
    box.style.transform = `translateX(calc(-50% + ${shift}px))`;
    box.style.setProperty('--tail-shift', `${-shift}px`);
  }
}

/**
 * 현재 직업의 밤의 축복 주기 설명을 데이터에서 만든다.
 *
 * 예전에는 "댄서는 25초 간격이라 75초, 기사는 45초라 90초" 를 힌트 문자열에 박아 뒀는데,
 * 그러면 data/jobs 의 간격을 고쳐도 설명이 그대로라 서로 다른 말을 하게 된다.
 */
function nightBlessingHint(job) {
  const iv = CLASS_NIGHT_BLESSING[job]?.triggerIntervalSeconds;
  const cd = NIGHT_BLESSING.cooldownSeconds;
  if (!(iv > 0)) return ` ${job}는 트리거 간격이 확인되지 않아 쿨 ${cd}초를 그대로 씁니다.`;
  return ` ${job}는 트리거가 약 ${iv}초 간격이라 ${cd}초 쿨을 못 맞춰 ${nightBlessingCycleSeconds(job, cd)}초가 됩니다.`;
}

function renderFields() {
  const mk = (host, defs) => {
    host.innerHTML = '';
    for (const [key, label] of defs) {
      const l = document.createElement('label');
      const hint = key === 'classPassiveUptimePercent' ? uptimePassive(state.job)?.hint
        : key === 'nightBlessingCycleSeconds' ? FIELD_HINTS[key] + nightBlessingHint(state.job)
        : FIELD_HINTS[key];
      // 설명은 ? 자리에 뜨는 작은 말풍선으로 띄운다. 접었다 펴는 방식은 아래 내용을
      // 밀어내서 입력칸 위치가 흔들린다.
      l.innerHTML =
        `<span>${label}${hint ? ' <button type="button" class="hint-toggle" aria-expanded="false" title="설명 보기">?' +
          `<small class="field-hint" role="tooltip" hidden>${hint}</small></button>` : ''}</span>` +
        `<input type="number" step="any" data-profile="${key}" value="${state.profile[key] ?? 0}" />`;
      host.append(l);
    }
  };
  mk(document.querySelector('#stat-fields'), STAT_FIELDS);
  mk(document.querySelector('#extra-fields'), EXTRA_FIELDS);
  // 전투 패턴은 성격별로 묶어서 그린다.
  // 유지형 직업 패시브가 있는 직업에만 가동률 칸이 '직업 특성' 그룹에 하나 더 붙는다.
  const up = uptimePassive(state.job);
  const host = document.querySelector('#combat-fields');
  host.innerHTML = '';
  for (const g of COMBAT_GROUPS) {
    const fields = g.title === '직업 특성' && up
      ? [...g.fields, ['classPassiveUptimePercent', up.label]] : g.fields;
    const sec = document.createElement('div');
    sec.className = 'combat-group';
    sec.innerHTML = `<h5>${g.title}</h5><p class="group-desc">${g.desc}</p>`;
    const grid = document.createElement('div');
    grid.className = 'grid-fields';
    mk(grid, fields);
    sec.append(grid);
    host.append(sec);
  }
  document.querySelector('#assume-vulnerable').checked = !!state.profile.assumeVulnerable;
  renderHelio();
  renderArtifacts();
}

function renderArtifacts() {
  const host = document.querySelector('#artifact-list');
  const counts = state.artifacts;
  const total = artifactTotal(counts);
  const cnt = document.querySelector('#artifact-count');
  // 빈 칸은 고유효과와 무관하게 손해다 — 아티팩트 1개당 깡공이 붙기 때문(실측 133).
  // 황금은 그 깡공을 안 주므로(실측) 딜 관점에서는 빈 칸과 같이 센다.
  // 그냥 total 로 세면 황금 낀 사람에게만 손해가 0.36% 적게 표시된다.
  const empty = ARTIFACT_SLOTS - total;
  const dead = ARTIFACT_SLOTS - attackBearingSlots(counts);
  cnt.innerHTML = `${total} / ${ARTIFACT_SLOTS}` + (dead > 0
    ? ` <b class="warn-inline">${empty > 0 ? `빈 칸 ${empty}개` : '황금 칸'} 포함 ${dead}칸 = 데미지 약 ${(dead * 0.36).toFixed(2)}% 손해</b>` : '');
  // 제한을 넘긴 저장분(제한을 몰랐던 시절)도 있을 수 있어 화면에서 알려준다.
  const over = overColorLimit(counts);
  if (over.length) {
    cnt.innerHTML += over.map((o) =>
      ` <b class="warn-inline">${o.color} ${o.count}개 — ${o.max}개까지만 장착됩니다</b>`).join('');
  }
  cnt.className = (total > ARTIFACT_SLOTS || over.length) ? 'hint over' : 'hint';
  const byColor = {};
  for (const a of ARTIFACTS) (byColor[a.color] ??= []).push(a);
  // 이름만 칩으로 나열한다. 효과는 툴팁으로 보여 목록이 길어지지 않게 한다.
  host.innerHTML = Object.entries(byColor).map(([color, list]) =>
    `<div class="art-row"><span class="art-color ${color}">${color}</span>` +
    `<div class="art-chips">` + list.map((a) => {
      const n = counts[a.name] ?? 0;
      const eff = a.effects
        ? Object.entries(a.effects).map(([k, v]) =>
            k === 'attackIncrease.itemAttackPercent' ? `공증 ${v}% (측정값에 포함)` : `${fieldLabel(k)} ${v}%`).join(', ')
        : a.skillTypeOnly ? `${a.skillTypeOnly} · 스킬 한정`
        : a.conditional ? `${a.conditional} · 조건부`
        : `${a.uncounted ?? '계산 밖'} · 계산 밖`;
      const tip = `${a.desc}\n\n${eff}${a.unique ? '\n유일 효과 — 중복해도 1개분' : '\n중첩 가능'}`;
      return `<button type="button" class="art-chip ${n ? 'on' : ''} ${a.effects ? '' : 'dim'}" ` +
        `data-artifact="${a.name}" title="${tip.replace(/"/g, '&quot;')}">` +
        `${a.name}${n > 1 ? `<b>×${n}</b>` : ''}</button>`;
    }).join('') + '</div></div>').join('');
}

function renderHelio() {
  const cur = state.profile.helioPercent ?? 0;
  const row = document.querySelector('#helio-row');
  row.querySelectorAll('label').forEach((l) => l.remove());
  // 기준 노드는 #helio-out(<b>)이 아니라 그 부모다. 직계 자식이어야 insertBefore 가 된다.
  const anchor = row.querySelector('.radio-out');
  for (const [, label, pct] of HELIO_TIERS) {
    const l = document.createElement('label');
    l.innerHTML = `<input type="radio" name="helio" value="${pct}" ${Math.abs(cur - pct) < 1e-9 ? 'checked' : ''} /> ${label}`;
    row.insertBefore(l, anchor);
  }
  document.querySelector('#helio-out').textContent = `${cur.toFixed(1)}%`;
}

/** 저장된 측정값을 입력칸에 되돌려 놓는다. 두 읽기 × (공격력, 공증룬 합). */
function renderMeasureFields() {
  const m = state.measure;
  for (const [key, no] of [['a', 1], ['b', 2]]) {
    document.querySelector(`#atk-${no}`).value = m[key]?.attack ?? '';
    document.querySelector(`#pct-${no}`).value = m[key]?.runePercent ?? '';
  }
}


function renderNegativeFilters() {
  const host = document.querySelector('#negative-filters');
  if (host.dataset.built) return;
  host.dataset.built = '1';
  host.innerHTML =
    `<button type="button" class="ghost toggle tiny" data-filter="specialTrigger" aria-pressed="false" ` +
    `title="특정 상황에서만 값이 나는 룬 — ${SPECIAL_TRIGGER_RUNES.join(', ')}">` +
    `상황 한정 제외 <b>${SPECIAL_TRIGGER_RUNES.length}</b></button>` +
    `<button type="button" class="ghost toggle tiny" data-filter="dotTrigger" aria-pressed="false" ` +
    `title="지속 피해가 걸린 적을 때려야 켜지는 룬 — ${DOT_TRIGGER_RUNES.join(', ')} (부여: ${DOT_APPLIER_RUNES.join(', ')})">` +
    `지속 피해 트리거 제외 <b>${DOT_TRIGGER_RUNES.length}</b></button>` +
    '<span class="filter-sep"></span>' +
    '<span class="filter-label">부정 효과 제외</span>' +
    Object.entries(NEGATIVE_TRAITS).map(([key, t]) => {
      const n = t.runes.length;
      return `<button type="button" class="ghost toggle tiny" data-filter="${key}" aria-pressed="false" ` +
        `data-base-title="${t.desc} — ${t.runes.join(', ')}" ` +
        `title="${t.desc} — ${t.runes.join(', ')}">${t.label} <b>${n}</b></button>`;
    }).join('');
}

function renderFilterButtons() {
  renderNegativeFilters();
  document.querySelectorAll('[data-filter]').forEach((b) => {
    const key = b.dataset.filter;
    const on = !!state.filters[key];
    const f = FILTER_DEFS.find((x) => x.key === key);
    const partial = !!f && filterHasException(f);
    b.classList.toggle('active', on);
    b.classList.toggle('partial', partial);
    b.setAttribute('aria-pressed', String(on));
    if (partial) {
      const n = USABLE.filter((r) => f.excludes(r) && state.exceptions.includes(r.name)).length;
      b.title = `${b.dataset.baseTitle ?? b.title} — ${n}개는 직접 켜서 예외로 두었습니다`;
    } else if (b.dataset.baseTitle) {
      b.title = b.dataset.baseTitle;
    }
  });
}

/**
 * 룬 목록 정렬 밴드.
 *
 * 룬이 80개가 넘어 평점순 한 줄 나열로는 찾을 수가 없다. 성격으로 층을 나누고
 * 층 안에서는 가나다순으로 둔다 — 이름을 알고 찾을 때 이게 제일 빠르다.
 * 제외 태그가 붙은 룬은 계열 태그가 있어도 맨 아래로 내린다(먼저 볼 것이 아니라서).
 */
const RUNE_BANDS = [
  { key: 'mythic', label: '신화' },
  { key: 'family', label: '계열 (침식 · 용의 문장 · 각성 · 밤의 축복)' },
  { key: 'plain', label: '그 외' },
];

// 제외 태그로는 층을 나누지 않는다. 태그가 붙었는지 아닌지를 모르는 상태에서 찾으려면
// 어느 층을 봐야 할지 알 수 없어 오히려 찾기 어려워진다. 제외 여부는 배지와 흐림 처리로만 알린다.
function bandOf(rune) {
  if (rune.grade === '신화') return 0;
  // 저주는 층을 나누지 않는다 — 둘뿐이고, 서로 못 겹친다는 제약일 뿐 침식·용의 문장처럼
  // 세트를 같이 짜야 하는 계열이 아니다. 배지로만 알린다.
  if (badges(rune).some(([, c]) => c !== 'util' && c !== 'curse')) return 1;
  return 2;
}

/** 계열 밴드 안에서의 순서. 세트를 같이 짜야 하는 순서대로 둔다. */
const FAMILY_ORDER = ['night', 'erosion', 'dragon', 'awaken', 'curse'];

/** 계열 밴드 안의 정렬 키. 여러 계열을 가지면 가장 앞선 것을 따른다. */
function familyRank(rune) {
  const ranks = badges(rune)
    .map(([, c]) => FAMILY_ORDER.indexOf(c))
    .filter((i) => i >= 0);
  return ranks.length ? Math.min(...ranks) : FAMILY_ORDER.length;
}

/** 밴드 → (계열 밴드면 계열 순서) → 가나다순. 한글 정렬은 localeCompare('ko') 가 맞다. */
const runeOrder = (a, b) =>
  bandOf(a) - bandOf(b) ||
  (bandOf(a) === 1 ? familyRank(a) - familyRank(b) : 0) ||
  a.name.localeCompare(b.name, 'ko');

function renderRunes() {
  renderFilterButtons();
  const host = document.querySelector('#rune-groups');
  host.innerHTML = '';
  const bySlot = equippedBySlot();
  for (const slot of SLOT_ORDER) {
    const list = USABLE.filter((r) => r.slot === slot);
    if (!list.length) continue;
    const sec = document.createElement('div');
    sec.className = 'rune-group';
    const used = bySlot[slot].length, cap = SLOT_CAPACITY[slot];
    const shown = list.filter((r) => passesFilters(r.name)).length;
    sec.innerHTML = `<h4>${slot} <span class="slot-count ${used > cap ? 'over' : ''}">착용 ${used}/${cap}</span>` +
      `<span class="list-count">룬 ${shown}${shown !== list.length ? ` / ${list.length}` : ''}개</span></h4>`;
    const ul = document.createElement('ul');
    ul.className = 'rune-list';
    let lastBand = null;
    for (const r of [...list].sort(runeOrder)) {
      // 밴드가 바뀌면 구분 줄을 넣는다. 룬이 80개가 넘어 그냥 나열하면 찾기 어렵다.
      const band = bandOf(r);
      if (band !== lastBand) {
        const cap = document.createElement('li');
        cap.className = 'band-cap';
        cap.textContent = RUNE_BANDS[band].label;
        ul.append(cap);
        lastBand = band;
      }
      const li = document.createElement('li');
      const on = state.equipped.includes(r.name);
      // 필터로 빠진 룬은 체크를 풀어 둔다. 체크된 채로 회색이면 '왜 추천에 안 나오지' 가 된다.
      // 이 상태에서 체크를 누르면 예외로 되살아난다(아래 input 핸들러).
      const cand = state.candidates.includes(r.name) && passesFilters(r.name);
      const filtered = !passesFilters(r.name);
      const isException = state.exceptions.includes(r.name);
      li.className = [on ? 'equipped' : '', filtered ? 'filtered' : '', isException ? 'exception' : '']
        .filter(Boolean).join(' ');
      li.innerHTML =
        `<input type="checkbox" class="cand" data-rune="${r.name}" ${cand ? 'checked' : ''} title="추천 후보에 포함" />` +
        `<button type="button" class="equip ${on ? 'on' : ''}" data-rune="${r.name}" title="착용 토글">${on ? '●' : '○'}</button>` +
        // 이름 쪽에는 게임 계열 배지, 스탯 쪽에는 앱 조작용 조정 칩을 둔다.
        `<button type="button" class="rname" data-detail="${r.name}">▸ ${r.name}</button>` +
        badges(r).map(([t, c]) => `<span class="badge fam ${c}">${t}</span>`).join('') +
        conditionTagsOf(r).map(([l, d]) => `<span class="badge cond-tag" title="${d}">${l}</span>`).join('') +
        negativeTraitsOf(r).map((t) => `<span class="badge neg-trait" title="${t.desc}">${t.label}</span>`).join('') +
        `<span class="rstat">${r.alwaysOnAttackPercent ? `공증 ${r.alwaysOnAttackPercent}%` : ''}` +
        `${r.alwaysOnDamagePercent ? ` 피증 ${r.alwaysOnDamagePercent}%` : ''}</span>` +
        (hasTweaks(r) ? `<span class="chip tweakable" title="가정을 직접 조정할 수 있습니다">조정</span>` : '') +
        (state.overrides[r.name] ? `<span class="chip tweaked" title="기본값에서 바뀐 값이 있습니다">수정됨</span>` : '') +
        (filtered ? '<span class="badge filtered-tag">필터 제외</span>' : '') +
        (isException ? '<span class="badge exception-tag" title="필터에 걸리지만 직접 켜서 예외로 두었습니다">필터 예외</span>' : '');
      ul.append(li);
    }
    sec.append(ul);
    host.append(sec);
  }
}

function renderEquipStatus() {
  const el = document.querySelector('#equip-status');
  const bySlot = equippedBySlot();
  const total = state.equipped.length;
  if (!total) {
    el.className = 'note warn-note';
    el.innerHTML = '⚠ <b>착용 룬이 비어 있습니다.</b> 아래에서 지금 끼고 있는 룬의 ● 를 눌러 지정해 주세요. 추천은 이 구성을 기준으로 계산됩니다.';
    return;
  }
  el.className = 'note';
  el.innerHTML = '착용: ' + SLOT_ORDER.map((s) =>
    `${s} <b class="${bySlot[s].length === SLOT_CAPACITY[s] ? 'ok' : 'warn'}">${bySlot[s].length}/${SLOT_CAPACITY[s]}</b>`).join(' · ');
}

/** 룬 상세: 설명 전문 + 이 앱이 어떻게 계산하는지 + 계산에 안 들어간 것 */
function runeDetailHtml(r) {
  const parts = [`<div class="d-desc">${r.desc.replace(/\n/g, '<br>')}</div>`];
  const modeled = RUNE_CONDITIONALS[r.name] ?? RUNE_CONDITIONALS[baseName(r.name)];
  const how = [];
  if (r.alwaysOnAttackPercent) how.push(`상시 공증 ${r.alwaysOnAttackPercent}%`);
  if (r.alwaysOnDamagePercent) how.push(`상시 피증 ${r.alwaysOnDamagePercent}%`);
  if (r.alwaysOnExtra) for (const [f, v] of Object.entries(r.alwaysOnExtra)) how.push(`상시 ${fieldLabel(f)} ${v}%`);
  // 실제로 계산에 들어간 기대값. 범위만 보이면 어느 값이 쓰였는지 알 수 없어
  // 상시 옵션(피증 13% 등)을 기대값으로 오해하게 된다.
  const expectedOf = (() => {
    if (!modeled) return () => null;
    try {
      const p = profileFor();
      const ex = resolveRuneEffects(RUNES, [r.name], 'expected', p).deltas;
      const mn = resolveRuneEffects(RUNES, [r.name], 'min', p).deltas;
      // 한 필드를 두 효과가 나눠 쓰면 분해할 수 없다. 그때는 범위만 보여준다.
      const seen = new Set(), dup = new Set();
      for (const e of modeled) { if (seen.has(e.field)) dup.add(e.field); seen.add(e.field); }
      return (e) => {
        if (dup.has(e.field)) return null;
        const v = (ex[e.field] ?? 0) - (mn[e.field] ?? 0) + (e.min ?? 0);
        return Number.isFinite(v) ? v : null;
      };
    } catch { return () => null; }
  })();

  if (modeled) for (const e of modeled) {
    const exp = expectedOf(e);
    const range = Number.isFinite(exp)
      ? `<b>${Math.round(exp * 100) / 100}%</b> <span class="muted">(범위 ${e.min ?? 0} ~ ${e.max ?? 0}%)</span>`
      : `${e.min ?? 0} ~ ${e.max ?? 0}%`;
    const basis = e.expectedFrom === 'stacks' ? '스택 계산'
      : e.expectedFrom === 'erosion' ? '침식 사이클 계산'
      : e.expectedFrom === 'hitTrigger' ? '적중 트리거 계산'
      : e.trigger === 'dragonSigil' ? '용의 문장 가동률'
      : e.trigger === 'nightBlessing' ? '밤의 축복 ON 구간에만'
      : e.uptimeFrom ? '트리거 확률로 가동률 계산'
      : e.basis === 'playstyle' ? '가정값' : '계산값';
    how.push(`${e.label} ${range} <span class="tag">${basis}</span>${e.note ? `<div class="d-note">${e.note}</div>` : ''}`);
  }
  if (POLLUTION_REDUCTION[r.name] !== undefined) {
    how.push(`오염 지속시간 <b>${POLLUTION_REDUCTION[r.name]}%</b> 감소 → 같은 세트의 침식 룬 기대값이 올라갑니다 ` +
      `<span class="tag">침식 사이클 계산</span>`);
  }
  const util = (UTILITY_DAMAGE_EQUIVALENT[r.name] ?? UTILITY_DAMAGE_EQUIVALENT[baseName(r.name)])?.percent;
  if (util > 0) how.push(`쿨감 등 DPS 기여를 데미지 <b>${util}%</b> 로 환산 <span class="tag">가정값</span>`);

  // ── 사용자가 직접 조정하는 가정들
  const ov = state.overrides[r.name] ?? {};
  const tweaks = [];
  const hasUtilSlot = util > 0 || uncountedOf(r).some((u) => u.kind === '유틸');
  if (hasUtilSlot) {
    const cur = Number.isFinite(ov.utility) ? ov.utility : (util ?? 0);
    tweaks.push(`<label class="tweak"><span>기타 효과를 최종 데미지 %로 보정</span>` +
      `<input type="number" step="0.1" data-ov="utility" data-rune="${r.name}" value="${cur}" />` +
      `<em>쿨감·속도처럼 데미지 공식 밖에 있지만 DPS 에는 기여하는 효과를 한 값으로 환산합니다. ` +
      `최종 점수에 곱해지며, 0이면 무시합니다.</em></label>`);
  }
  if (modeled) for (const e of modeled) {
    if (e.basis !== 'playstyle') continue;
    // 저장 키는 id 다. 라벨은 화면에만 쓴다 — 문구를 다듬어도 조정값이 살아 있어야 한다.
    const cur = Number.isFinite(ov.cond?.[e.id]) ? ov.cond[e.id] : (e.expected ?? 0);
    tweaks.push(`<label class="tweak"><span>${e.label} 기대값</span>` +
      `<input type="number" step="0.1" data-ov="cond" data-cond-id="${e.id}" data-rune="${r.name}" value="${cur}" />` +
      `<em>범위 ${e.min ?? 0} ~ ${e.max ?? 0}%. ${e.note ?? ''}</em></label>`);
  }
  if (tweaks.length) {
    parts.push(`<div class="d-head tweak-head">가정 조정</div><div class="tweaks">${tweaks.join('')}</div>`);
    if (Object.keys(ov).length) parts.push(`<button type="button" class="ghost small" data-ov-reset="${r.name}">이 룬 기본값으로</button>`);
  }
  parts.push(`<div class="d-head">계산에 반영</div><ul class="d-list">${how.length ? how.map((h) => `<li>${h}</li>`).join('') : '<li class="muted">없음</li>'}</ul>`);

  const missing = uncountedOf(r).map((u) =>
    `<span class="kind">${u.kind}</span> <span${u.neg ? ' class="neg"' : ''}>${u.text}</span>`);
  if (missing.length) parts.push(`<div class="d-head warn">계산에 안 들어간 것</div><ul class="d-list warn">${missing.map((m) => `<li>${m}</li>`).join('')}</ul>`);

  const fam = badges(r).map(([t]) => t);
  if (fam.length) parts.push(`<div class="d-fam">계열: ${fam.join(' · ')}</div>`);
  return parts.join('');
}

// 라벨 사전은 data/effect-fields.json 에 있다(gen/effect-fields.mjs 로 생성).
// 여기에 따로 두면 화이트리스트와 사전이 갈라져, 계산에 배선되지도 않은 경로에
// 이름만 붙어 있는 상태가 된다 — 실제로 '콤보 피해' 가 그랬다.

// uncountedOf 는 src/rune-uncounted.mjs 로 옮겼다 — limits-app 도 같은 판단을 쓴다.

const modal = () => document.querySelector('#rune-modal');

function openRuneModal(name) {
  const r = runeByName(name);
  if (!r) return;
  document.querySelector('#modal-title').innerHTML =
    `${r.name} <span class="muted">${r.slot} · ${r.grade}</span>`;
  document.querySelector('#modal-body').innerHTML = runeDetailHtml(r);
  // 목록에서 룬을 찾아 체크박스를 누르는 대신 이 창에서 바로 후보를 넣고 뺀다.
  const inPool = state.candidates.includes(name) && passesFilters(name);
  const cb = document.querySelector('#modal-cand');
  cb.textContent = inPool ? '후보에서 제외' : '후보로 추가';
  cb.classList.toggle('primary', !inPool);
  cb.dataset.rune = name;
  const d = modal();
  if (!d.open) d.showModal();
  d.dataset.rune = name;
}
function refreshRuneModal() {
  const d = modal();
  if (d?.open && d.dataset.rune) openRuneModal(d.dataset.rune);
}

function renderValidation() {
  const el = document.querySelector('#validation');
  const v = validateRuneSet(state.equipped);
  const bySlot = equippedBySlot();
  const over = SLOT_ORDER.filter((s) => bySlot[s].length > SLOT_CAPACITY[s]);
  const msgs = [];
  if (!v.valid) msgs.push(v.reason);
  for (const s of over) msgs.push(`${s} 슬롯 초과: ${bySlot[s].length}/${SLOT_CAPACITY[s]}`);
  el.hidden = !msgs.length;
  el.innerHTML = msgs.map((m) => `<div>⚠ ${m}</div>`).join('');
  return !msgs.length;
}

/**
 * 결과 패널을 그린다.
 *
 * 통째로 try 로 감싸는 이유: 이 함수는 위에서부터 순서대로 DOM 을 채우는데, 중간에서
 * 예외가 나면 앞부분만 그려진 채로 멈춘다. 사용자에게는 **섹션 하나가 통째로 사라진 것**
 * 처럼 보이고 화면 어디에도 신호가 없다. 실제로 그렇게 하루를 보냈다 — 룬 데이터를
 * 옮기며 EROSION_RUNES 의 import 를 빠뜨렸고, '최적 세트' 아래가 조용히 안 그려졌다.
 *
 * 계산이 틀린 것을 여기서 고칠 수는 없다. 다만 **틀렸다는 사실을 감추지 않는 것**은 할 수 있다.
 */
function renderResults() {
  try {
    renderResultsInner();
  } catch (e) {
    console.error('renderResults 실패:', e);
    // 시나리오 박스는 남겨둔다 — 총점까지 지우면 무엇이 살아 있고 무엇이 죽었는지 알 수 없다.
    const msg = '<div class="blocked">계산 중 오류가 생겨 이 부분을 그리지 못했습니다. ' +
      '<b>초기화</b> 후 다시 시도해 주시고, 계속되면 ' +
      '<a href="https://github.com/mobinogi-tools/rune-optimizer/issues/new" target="_blank" rel="noopener noreferrer">제보</a>해 주세요. ' +
      `(${e?.message ?? e})</div>`;
    for (const sel of ['#slot-recs', '#best-set']) {
      const el = document.querySelector(sel);
      if (el) el.innerHTML = sel === '#best-set' ? msg : '';
    }
  }
}

function renderResultsInner() {
  if (!isMeasured()) return;
  if (!renderValidation()) {
    document.querySelector('#scenarios').innerHTML = '<div class="blocked">착용 구성이 규칙에 어긋납니다.</div>';
    document.querySelector('#slot-recs').innerHTML = '';
    document.querySelector('#best-set').innerHTML = '';
    return;
  }
  const cur = [...state.equipped];
  const p = profileFor();

  // 시나리오
  const sc = document.querySelector('#scenarios');
  sc.innerHTML = SCENARIOS.map(({ key, label, desc }) => {
    const r = evaluate(RUNES, cur, key, p);
    return `<button type="button" class="scen ${key === state.scenario ? 'primary' : ''}" ` +
      `data-scenario="${key}" title="${desc} — 누르면 이 기준으로 추천을 다시 계산합니다">` +
      `<span>${label}</span><b>${Math.round(r.score).toLocaleString()}</b></button>`;
  }).join('');

  // 계수·중간값도 선택한 시나리오를 따라간다. 아래 추천이 최대 기준으로 계산되는데
  // 이 표만 기대값이면 왜 그런 추천이 나왔는지 표에서 확인할 수가 없다.
  // 세 시나리오의 총점은 위 박스에 늘 다 떠 있으므로 기준선을 잃지도 않는다.
  const base = evaluate(RUNES, cur, state.scenario, p);
  const baseScore = base.score;
  const f = base.factors;
  const nb = base.factorsNightBlessing;
  document.querySelector('#factors').innerHTML =
    [['A 깡공', Math.round(state.measure.attackA).toLocaleString(), '측정값'],
     ['A×B 스탯창', Math.floor((state.measure.attackA ?? 0) * f.B).toLocaleString(), '⌊A×B⌋ · 실측 A 기준'],
     ['B 공증', f.B.toFixed(4)], ['C 피증', f.C.toFixed(4)], ['D 강화', f.D.toFixed(4)],
     ['E 젬', f.E.toFixed(4)], ['F 치명타', f.F.toFixed(4)], ['G 무방비', f.G.toFixed(4)],
     ['H 스킬배율', f.H.toFixed(4)], ['I 방어', f.I.toFixed(4)], ['J 카운터', f.J.toFixed(4)],
     ['K 추가타', f.K.toFixed(4)], ['L 최종뎀', f.L.toFixed(4)]]
      .map(([k, v, note]) => `<div><span>${k}</span><b>${v}</b>${note ? `<em>${note}</em>` : ''}</div>`).join('') +
    (base.utilityMultiplier && base.utilityMultiplier !== 1
      ? `<div><span>쿨감 환산</span><b>×${base.utilityMultiplier.toFixed(3)}</b></div>` : '');

  // 중간 계산값 — 어떤 수치가 어디서 나왔는지 확인용
  const d = base.deltas ?? {};
  // 룬 델타 + 아티팩트 몫을 합쳐 보여준다. 계산은 이미 둘 다 반영돼 있는데 표시만 룬 몫이면 오해를 부른다.
  const art = sumArtifacts(state.artifacts);
  const dv = (k) => (d[k] ?? 0) + (art[k] ?? 0);
  const hps = p.hitsPerSecond ?? 0;
  const rockStacks = Math.min(30, hps * 10);
  const nbCycle = p.nightBlessingCycleSeconds > 0
    ? p.nightBlessingCycleSeconds : nightBlessingCycleSeconds(state.job, 60);
  // 전투 숙련 몫은 deltas 에 이미 합쳐져 있다. 어느 줄이 그 영향을 받았는지 꼬리말로 밝힌다.
  const mEff = masteryEffects(p.combatMastery);
  const mNote = (field) => (mEff[field] ? ` · 전투 숙련 ${p.combatMastery} ${mEff[field]}%` : '');

  /**
   * 연타/강타가 D 항에 얹는 몫.
   *   기여 = 발동률 × ((1 + 강화/8500) × (1 + 옵션%) − 1)
   * 강화 수치와 옵션은 곱해지는 별개 항이라, 옵션이 0 이어도 기여는 0 이 아니다.
   */
  const enhRow = (label, enhance, ratePercent, isOn, optField) => {
    const opt = dv(optField);
    const basePct = (enhance ?? 0) / 8500 * 100;
    const rate = isOn === false ? 0 : (ratePercent ?? 100) / 100;
    const contrib = rate * ((1 + (enhance ?? 0) / 8500) * (1 + opt / 100) - 1) * 100;
    return [label, `+${contrib.toFixed(1)}%p`,
      `강화 ${enhance ?? 0} → ${basePct.toFixed(1)}% · 옵션 ${opt.toFixed(1)}%${mNote(optField)} · ` +
      `발동률 ${isOn === false ? '0(미사용)' : `${ratePercent ?? 100}%`}`];
  };

  const rows = [
    ['치명타 확률', `${(base.rates.critRate * 100).toFixed(2)}%`,
      `공식 ${(50 - 100 / (2 + p.criticalStat / 1000)).toFixed(2)}% + 룬/아티 ${dv('critical.runeCriticalRatePercent').toFixed(1)}% + 직업 ${p.characterCriticalRatePercent ?? 0}%`],
    ['치명타 배율', `${((1.4 + p.criticalStat / 5000) * (1 + dv('critical.criticalDamagePercent') / 100)).toFixed(3)}배`,
      `(1.4 + 치명타/5000) × (1 + 치명타피해 ${dv('critical.criticalDamagePercent').toFixed(1)}%)` + mNote('critical.criticalDamagePercent')],
    ['추가타 확률', `${(base.rates.extraRate * 100).toFixed(2)}%`,
      `(1 + 추가타/13000) × (1 + 룬·아티 ${dv('extraHit.runeExtraRatePercent').toFixed(1)}% + 직업 ${p.characterExtraRatePercent ?? 0}%) − 1`],
    ['피증 합', `${(dv('damageIncrease.itemMainDamagePercent') + (p.helioPercent ?? 0)).toFixed(1)}%`,
      `룬 ${(d['damageIncrease.itemMainDamagePercent'] ?? 0).toFixed(1)}% + 아티팩트 ${(art['damageIncrease.itemMainDamagePercent'] ?? 0).toFixed(1)}% + 헬리오 ${p.helioPercent ?? 0}%`],
    // D 항 기여를 그대로 보여준다. 옵션 합계(연타 피해%)만 띄우면 옵션이 0 일 때
    // '강타 피해 0%' 로 보여서 강화 수치가 통째로 빠진 것처럼 읽힌다.
    enhRow('연타 기여', p.rapidEnhance, p.rapidRatePercent, p.isRapid, 'enhancement.rapidDamagePercent'),
    enhRow('강타 기여', p.heavyEnhance, p.heavyRatePercent, p.isHeavy, 'enhancement.heavyDamagePercent'),
    enhRow('멀티히트 기여', p.areaEnhance, p.areaRatePercent, p.isArea, 'enhancement.areaDamagePercent'),
    ['스킬 피해', `${dv('damageIncrease.skillDamagePercent').toFixed(1)}%`, '(1 + 스킬위력/8500) 에 곱해짐'],
    ['바위 칼날 스택', `${rockStacks.toFixed(0)} / 30`, `초당 ${hps}타 × 10초 (30스택은 3타 필요)`],
    // min/max 는 밤축 OFF/ON 한 상태를 통째로 계산한 것이라 '비중'이라는 개념이 없다.
    ...(state.scenario === 'expected'
      ? [['밤의 축복 ON 딜 비중', `${(base.damageShareNightBlessing * 100).toFixed(1)}%`,
          `주기 ${nbCycle}초 중 15초 = 시간 비중 ${(15 / nbCycle * 100).toFixed(1)}%`]]
      : [['밤의 축복', state.scenario === 'max' ? 'ON 상태로 계산' : 'OFF 상태로 계산',
          `주기 ${nbCycle}초 · 지속 15초`]]),
  ];
  const label = SCENARIOS.find((s) => s.key === state.scenario)?.label ?? '';
  document.querySelector('#factors-scenario').textContent = `${label} 기준`;
  document.querySelector('#derived').innerHTML = rows.map(([k, v, note]) =>
    `<div class="drow"><span>${k}</span><b>${v}</b><em>${note}</em></div>`).join('') +
    (nb ? `<div class="drow"><span>밤축 ON 계수</span><b>D ${nb.D.toFixed(3)} · F ${nb.F.toFixed(3)} · L ${nb.L.toFixed(2)}</b><em>OFF: D ${f.D.toFixed(3)} · F ${f.F.toFixed(3)} · L ${f.L.toFixed(2)}</em></div>` : '');

  // 부위별 교체 추천
  const recHost = document.querySelector('#slot-recs');
  recHost.innerHTML = '';
  const bySlot = equippedBySlot();
  for (const slot of SLOT_ORDER) {
    const cands = effectiveCandidates().filter((n) => slotOf(n) === slot && !cur.includes(n));
    if (!cands.length) continue;
    const hasRoom = bySlot[slot].length < SLOT_CAPACITY[slot];
    const rows = [];
    for (const c of cands) {
      let best = -Infinity, bestOut = null;
      // 빈 칸이 있으면 교체가 아니라 '추가'로도 평가한다.
      if (hasRoom) {
        const next = [...cur, c];
        if (validateRuneSet(next).valid) { best = score(next); bestOut = null; }
      }
      for (const out of bySlot[slot]) {
        const next = cur.map((n) => (n === out ? c : n));
        if (!validateRuneSet(next).valid) continue;
        const v = score(next);
        if (v > best) { best = v; bestOut = out; }
      }
      if (Number.isFinite(best)) rows.push({ c, gain: best / baseScore - 1, out: bestOut });
    }
    rows.sort((a, b) => b.gain - a.gain);
    // 전부 변화가 없으면(장신구처럼 수치 옵션이 없는 부위) 목록을 띄우지 않는다.
    if (rows.every((r) => Math.abs(r.gain) < 1e-9)) {
      const d0 = document.createElement('div');
      d0.className = 'rec-slot';
      d0.innerHTML = `<h5>${slot}</h5><div class="rec none">이 부위의 룬은 수치 옵션이 없어 계산상 차이가 없습니다 (스킬 변형 전용).</div>`;
      recHost.append(d0);
      continue;
    }
    const top = rows.slice(0, 5);
    if (!top.length) continue;
    const d = document.createElement('div');
    d.className = 'rec-slot';
    d.innerHTML = `<h5>${slot}</h5>` + top.map((r) =>
      `<div class="rec ${r.gain > 0 ? 'up' : 'down'}"><b>${fmtPct(r.gain)}</b>` +
      `<button type="button" class="rname inline" data-detail="${r.c}">${r.c}</button>` +
      `<span class="muted">${r.out ? `← ${r.out}` : '빈 칸에 추가'}</span>` +
      `<button type="button" class="apply" data-in="${r.c}" data-out="${r.out ?? ''}">적용</button></div>`).join('');
    recHost.append(d);
  }

  // 최적 세트
  const best = optimize();
  const bs = document.querySelector('#best-set');
  const gain = best.score / baseScore - 1;
  const changed = best.set.filter((n) => !cur.includes(n));
  bs.innerHTML = `<div class="best-head"><b>${fmtPct(gain)}</b> <span class="muted">현재 대비</span>` +
    (changed.length ? `<button type="button" id="apply-best" class="primary">전체 적용</button>` : '<span class="muted">이미 최적입니다</span>') + '</div>' +
    SLOT_ORDER.map((s) => {
      const list = best.set.filter((n) => slotOf(n) === s);
      if (!list.length) return '';
      return `<div class="best-slot"><span class="muted">${s}</span> ` +
        list.map((n) => `<button type="button" class="rname inline ${cur.includes(n) ? '' : 'new'}" data-detail="${n}">${n}</button>`).join(' ') + '</div>';
    }).join('');
  // 계산에 안 들어간 효과를 가진 룬이 최적 세트에서 빠지면, 추천이 오해를 부를 수 있다.
  const dropped = cur.filter((n) => !best.set.includes(n))
    .map(runeByName).filter((r) => r && (r.uncountedEffects || r.skillTypeBonuses));
  if (dropped.length) {
    bs.innerHTML += `<div class="best-caveat">⚠ 이 추천은 <b>${dropped.map((r) => r.name).join(', ')}</b> 을(를) 뺍니다. ` +
      `해당 룬의 ${dropped.flatMap((r) => (r.uncountedEffects ?? []).map((b) => `${b.stat} ${b.value}%`)).join(', ') || '일부 효과'} 는 ` +
      `데미지 공식에 없어 <b>0으로 계산</b>됩니다. 실제로는 손해일 수 있습니다.</div>`;
  }
  if (changed.length) {
    document.querySelector('#apply-best').addEventListener('click', () => {
      state.equipped = best.set; save(); renderRunes(); renderResults();
    });
  }

  // 미계산 항목 — 현재 착용분만 보면 추천으로 새로 들어오는 룬의 페널티를 놓친다.
  // 현재 세트와 추천 세트를 모두 훑고, 어느 쪽인지 표시한다.
  const w = document.querySelector('#warnings');
  const warnRows = [];
  const seen = new Set();
  for (const [names, where] of [[cur, '현재'], [best.set, '추천']]) {
    for (const n of names) {
      const r = runeByName(n);
      if (!r) continue;
      const tag = cur.includes(n) && best.set.includes(n) ? '현재·추천' : where;
      for (const u of uncountedOf(r)) {
        const key = `${r.name}|${u.text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        warnRows.push({ rune: r.name, tag, ...u });
      }
    }
  }
  for (const n of base.notes ?? []) warnRows.push({ rune: '', tag: '', kind: '', text: n });

  // 사용자가 보정값을 넣은 룬은 더 이상 '미계산'이 아니다. 넣은 값과 함께 따로 모아 보여준다.
  // 그대로 두면 '이미 반영했는데 왜 아직 미계산이지?' 하고 두 번 넣게 된다.
  const corrected = [], uncounted = [];
  for (const r of warnRows) {
    const ov = r.rune ? state.overrides[r.rune]?.utility : undefined;
    if (Number.isFinite(ov) && ov !== 0) corrected.push({ ...r, applied: ov });
    else uncounted.push(r);
  }
  const line = (r, extra = '') =>
    `<li class="${r.neg ? 'neg' : ''}">` +
    (r.tag ? `<span class="where ${r.tag === '추천' ? 'rec' : ''}">${r.tag}</span>` : '') +
    (r.rune ? `<button type="button" class="rname inline" data-detail="${r.rune}">${r.rune}</button> ` : '') +
    (r.kind ? `<span class="kind">${r.kind}</span> ` : '') + r.text + extra + '</li>';

  w.innerHTML =
    (corrected.length
      ? `<h3>보정 항목</h3><ul class="warn corrected">${corrected.map((r) =>
          line(r, ` <span class="applied">→ 최종 데미지 ${r.applied > 0 ? '+' : ''}${r.applied}% 로 보정함</span>`)
        ).join('')}</ul>` : '') +
    (uncounted.length
      ? `<h3>미계산 항목</h3><ul class="warn">${uncounted.map((r) => line(r)).join('')}</ul>` : '');

}

/**
 * 전투 숙련 선택. 직업이 정해지면 숙련도 정해지지만(직업 고정 패시브), 목록에 없는 직업을
 * 쓰는 사람도 있을 수 있어 직접 고를 수 있게 열어 둔다.
 */
/** 직업 목록. 전투 숙련 표에 있는 21개 직업을 가나다순으로 채운다. */
function renderJobs() {
  const sel = document.querySelector('#job');
  if (!sel.dataset.built) {
    sel.dataset.built = '1';
    sel.innerHTML = Object.keys(JOB_MASTERY).sort((a, b) => a.localeCompare(b, 'ko'))
      .map((j) => `<option value="${j}">${j}</option>`).join('');
  }
  sel.value = state.job;
  // 샘플값은 댄서만 있다. 없는 직업에서 누르면 아무 일도 안 일어나 혼란스러우니 잠근다.
  const hasSample = !!JOB_SAMPLES[state.job];
  for (const id of ['#sample-stats', '#sample-combat']) {
    const b = document.querySelector(id);
    b.disabled = !hasSample;
    b.title = hasSample ? '' : `${state.job} 샘플값은 아직 없습니다`;
  }
}

function renderMastery() {
  const sel = document.querySelector('#mastery');
  if (!sel.dataset.built) {
    sel.dataset.built = '1';
    sel.innerHTML = MASTERY_NAMES.map((n) =>
      `<option value="${n}">${n} · ${COMBAT_MASTERIES[n].jobs.join(', ')}</option>`).join('');
  }
  sel.value = masteryOf();
  const m = COMBAT_MASTERIES[sel.value];
  const applied = Object.entries(masteryEffects(sel.value))
    .map(([f, v]) => `${fieldLabel(f)} +${v}%`);
  const skipped = masteryUncounted(sel.value);
  document.querySelector('#mastery-out').innerHTML =
    (applied.length ? `반영: <b>${applied.join(' · ')}</b>` : '<b>계산에 반영되는 항목 없음</b>') +
    (skipped.length ? ` <span class="muted">/ 미반영: ${skipped.join(' · ')}</span>` : '');
}

function renderAll() { renderJobs(); renderMastery(); renderMeasure(); renderRunes(); renderEquipStatus(); renderValidation(); renderResults(); }

// ── 이벤트 ──────────────────────────────────────────────
function onMeasureInput() {
  const num = (sel) => {
    const v = document.querySelector(sel).value;
    return v === '' ? null : Number(v);
  };
  state.measure.a = { attack: num('#atk-1'), runePercent: num('#pct-1') };
  state.measure.b = { attack: num('#atk-2'), runePercent: num('#pct-2') };
  // 값을 건드리면 그 순간부터 '확정 안 된 측정'이다. 옛 확정 시각이 남아 있으면
  // 새 숫자에 옛 날짜가 붙는다.
  state.measure.at = null;
  state.measure.committed = false;
  computeMeasure();
  save(); renderMeasure(); renderResults();
}


document.querySelector('#measure-section').addEventListener('input', onMeasureInput);
document.querySelector('#measure-section').addEventListener('change', onMeasureInput);
document.querySelector('#measure-toggle').addEventListener('click', () => {
  renderMeasure.open = !renderMeasure.open;
  renderMeasure();
});

document.addEventListener('input', (e) => {
  const key = e.target.dataset.profile;
  if (key) { state.profile[key] = Number(e.target.value) || 0; save(); computeMeasure(); renderMeasure(); renderResults(); }
  if (e.target.name === 'helio') {
    state.profile.helioPercent = Number(e.target.value) || 0;
    save(); renderHelio(); computeMeasure(); renderMeasure(); renderResults();
  }
  if (e.target.id === 'assume-vulnerable') { state.profile.assumeVulnerable = e.target.checked; save(); renderResults(); }
  const ovKind = e.target.dataset.ov;
  if (ovKind) {
    const rune = e.target.dataset.rune;
    const v = e.target.value === '' ? null : Number(e.target.value);
    state.overrides[rune] ??= {};
    if (ovKind === 'utility') {
      if (v === null) delete state.overrides[rune].utility; else state.overrides[rune].utility = v;
    } else {
      state.overrides[rune].cond ??= {};
      const id = e.target.dataset.condId;
      if (v === null) delete state.overrides[rune].cond[id]; else state.overrides[rune].cond[id] = v;
    }
    save(); renderResults(); renderRunes();
    return;
  }
  if (e.target.classList.contains('cand')) {
    toggleCandidate(e.target.dataset.rune);
  }
});

/** 측정 시각. 날짜만으로는 같은 날 여러 번 잰 것을 구분할 수 없어 분까지 남긴다. */
function stampNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

document.querySelector('#measure-submit').addEventListener('click', () => {
  if (!isComputed()) return;
  state.measure.committed = true;
  // 여기서 찍지 않으면 새 측정은 시각 없이 저장된다(입력할 때마다 null 로 지워지므로).
  state.measure.at = stampNow();
  // 측정 당시의 아티팩트 구성을 같이 남긴다. 이후 아티팩트가 바뀌면 측정이 무효가 되는데,
  // 아티팩트는 B(공증)뿐 아니라 A(깡공)까지 바꾸기 때문이다(개당 깡공 133, 실측).
  state.measure.artifactSig = artifactSignature();
  renderMeasure.open = false;
  save(); renderAll();
});

document.querySelector('#clear-equipped').addEventListener('click', () => {
  state.equipped = [];
  save(); renderAll();
});

document.addEventListener('click', (e) => {
  const ht = e.target.closest('.hint-toggle');
  // 말풍선은 한 번에 하나만 띄운다. 여기저기 열려 있으면 화면이 지저분해진다.
  const openHint = document.querySelector('.hint-toggle[aria-expanded="true"]');
  if (openHint && openHint !== ht) {
    openHint.setAttribute('aria-expanded', 'false');
    openHint.querySelector('.field-hint').setAttribute('hidden', '');
  }
  if (ht) {
    const box = ht.querySelector('.field-hint');
    const open = box.hasAttribute('hidden');
    box.toggleAttribute('hidden', !open);
    ht.setAttribute('aria-expanded', String(open));
    if (open) positionHint(box);
    return;
  }
  const scen = e.target.closest('[data-scenario]');
  if (scen) {
    state.scenario = scen.dataset.scenario;
    save(); renderResults();
    return;
  }
  const reset = e.target.closest('[data-ov-reset]');
  if (reset) {
    delete state.overrides[reset.dataset.ovReset];
    save(); renderRunes(); renderResults(); refreshRuneModal();
    return;
  }
  const dbtn = e.target.closest('[data-detail]');
  if (dbtn) { openRuneModal(dbtn.dataset.detail); return; }
});

// 아티팩트 칩: 클릭하면 1씩 늘고 최대에서 0으로 돌아간다. 유일 효과는 0↔1.
document.querySelector('#artifact-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-artifact]');
  if (!btn) return;
  const name = btn.dataset.artifact;
  const a = ARTIFACTS.find((x) => x.name === name);
  // 황금색은 1개 제한이라 다른 황금이 이미 있으면 이 칩은 0 에서 못 올라간다.
  // 클릭이 먹통인 것처럼 보이지 않게, 이미 낀 황금을 이 것으로 갈아끼운다.
  if (a && (COLOR_LIMIT[a.color] ?? Infinity) === 1 && !state.artifacts[name]) {
    for (const other of ARTIFACTS) {
      if (other.color === a.color && other.name !== name) delete state.artifacts[other.name];
    }
  }
  const max = artifactMax(a);
  const next = ((state.artifacts[name] ?? 0) + 1) % (max + 1);
  if (next) state.artifacts[name] = next; else delete state.artifacts[name];
  save(); renderArtifacts(); computeMeasure(); renderMeasure(); renderResults();
});

/** 후보에 넣고 빼기. 필터에 걸린 룬을 넣으면 그 룬만 예외가 된다. */
function toggleCandidate(name) {
  const inPool = state.candidates.includes(name) && passesFilters(name);
  if (inPool) {
    state.candidates = state.candidates.filter((x) => x !== name);
    state.exceptions = state.exceptions.filter((x) => x !== name);
  } else {
    state.candidates = [...new Set([...state.candidates, name])];
    const r = runeByName(name);
    if (r && blockingFilters(r).length) state.exceptions = [...new Set([...state.exceptions, name])];
  }
  save(); renderRunes(); renderResults(); refreshRuneModal();
}

document.querySelector('#modal-cand').addEventListener('click', (e) => {
  if (e.currentTarget.dataset.rune) toggleCandidate(e.currentTarget.dataset.rune);
});
document.querySelector('#modal-close').addEventListener('click', () => modal().close());
modal().addEventListener('click', (e) => { if (e.target === modal()) modal().close(); });

document.querySelector('#rune-groups').addEventListener('click', (e) => {
  const btn = e.target.closest('.equip');
  if (!btn) return;
  const n = btn.dataset.rune;
  state.equipped = state.equipped.includes(n) ? state.equipped.filter((x) => x !== n) : [...state.equipped, n];
  save(); renderAll();
});

document.querySelector('#slot-recs').addEventListener('click', (e) => {
  const btn = e.target.closest('.apply');
  if (!btn) return;
  state.equipped = btn.dataset.out
    ? state.equipped.map((n) => (n === btn.dataset.out ? btn.dataset.in : n))
    : [...state.equipped, btn.dataset.in];
  save(); renderAll();
});

// 후보 일괄 지정(1회성)
const CAND_MODES = {
  all: () => USABLE.map((r) => r.name),
  none: () => [],
  equipped: () => [...state.equipped],
};
document.querySelectorAll('[data-cand]').forEach((b) => b.addEventListener('click', () => {
  const fn = CAND_MODES[b.dataset.cand];
  if (!fn) return;
  state.candidates = fn();
  save(); renderAll();
}));

// 필터(토글). 체크박스 선택 위에 덧씌워지는 제외 조건이라, 다시 누르면 풀린다.
// 부정 효과 버튼은 렌더 시점에 만들어져 이 시점에 아직 없으므로 위임으로 받는다.
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-filter]');
  if (!b) return;
  const k = b.dataset.filter;
  state.filters[k] = !state.filters[k];
  save(); renderAll();
});

// 직업 샘플값 — 스탯창·아티팩트·전투 패턴을 예시로 한 번에 채운다.
// 측정값은 사용자 고유이므로 건드리지 않는다.
document.querySelector('#job').addEventListener('change', (e) => {
  state.job = e.target.value;
  // 전투 숙련은 직업이 정한다. 직업을 바꾸면 직접 고른 숙련도 그 직업 것으로 되돌린다.
  state.profile.combatMastery = JOB_MASTERY[state.job] ?? null;
  // 유지형 패시브의 기본 가동률은 직업마다 다르다(검술사 100 / 기사 44).
  state.profile.classPassiveUptimePercent = uptimePassive(state.job)?.defaultUptimePercent ?? 100;
  // 밤의 축복 주기도 직업이 정해준다. 직접 잰 값이 있으면 사용자가 다시 넣으면 된다.
  state.profile.nightBlessingCycleSeconds = nightBlessingCycleSeconds(state.job, 60);
  // 전투 패턴 칸 구성이 직업마다 달라(유지형 패시브 가동률) 다시 그려야 한다.
  save(); renderFields(); renderAll();
});

document.querySelector('#mastery').addEventListener('change', (e) => {
  if (!MASTERY_NAMES.includes(e.target.value)) return; // 빈 값이 저장되는 것을 막는다
  state.profile.combatMastery = e.target.value;
  save(); renderAll();
});

/**
 * 카테고리별 샘플값 적용. 전체를 한 번에 덮어쓰면 이미 채운 다른 칸까지 날아가,
 * 원하는 부분만 채우려는 사람이 쓸 수 없다.
 */
function applySample(kind, label) {
  const sample = JOB_SAMPLES[state.job]?.[kind];
  if (!sample) return;
  if (!confirm(`${state.job} 샘플값으로 ${label}을(를) 덮어씁니다.\n다른 항목과 측정값은 그대로 둡니다. 계속할까요?`)) return;
  state.profile = { ...state.profile, ...sample };
  save(); renderFields(); computeMeasure(); renderMeasure(); renderResults();
  setSaveHint(`${label} 샘플값 적용`);
}

// ── 스샷으로 채우기 ────────────────────────────────────
//
// 스탯창 9개를 손으로 옮겨 적는 것이 가장 지루한 일이라, 각자 쓰는 AI 에 스크린샷을 주고
// 받아온 결과를 붙여넣게 한다. 사진은 이 페이지로 오지 않는다.
//
// **적용 전 확인 단계를 반드시 거친다.** AI 가 2,101 을 2,110 으로 읽어도 아무 신호가 없고,
// 그대로 앉으면 추천이 조용히 틀어진다. 파서가 관대할수록 이 단계가 유일한 안전장치다.
const importModal = () => document.querySelector('#import-modal');
let importParsed = null;

function importGoto(step) {
  for (const sec of document.querySelectorAll('#import-body .wz')) {
    sec.hidden = sec.dataset.step !== String(step);
  }
  document.querySelector('#import-step-label').textContent = `${step} / 3`;
  document.querySelector('#import-body').scrollTop = 0;
}

function openImport() {
  document.querySelector('#import-prompt').textContent = IMPORT_PROMPT;
  document.querySelector('#import-paste').value = '';
  document.querySelector('#import-error').hidden = true;
  importParsed = null;
  importGoto(1);
  importModal().showModal();
}

function renderImportPreview() {
  const rows = importPreview(importParsed.values, state.profile);
  const fmt = (n) => Number(n).toLocaleString();
  document.querySelector('#import-preview').innerHTML =
    rows.map((r) => r.has
      ? `<div class="imp-row ${r.changed ? 'up' : ''}"><span>${r.label}</span>` +
        `<span class="imp-cur">${fmt(r.cur)}</span><span class="imp-arrow">→</span>` +
        `<b class="imp-next">${fmt(r.next)}</b></div>`
      : `<div class="imp-row miss"><span>${r.label}</span><span class="imp-cur">${fmt(r.cur)}</span>` +
        `<span class="imp-arrow"></span><span class="imp-next">그대로 둠</span></div>`).join('') +
    (importParsed.unknown.length
      ? `<p class="imp-note">무시한 항목: ${importParsed.unknown.join(', ')}</p>` : '') +
    (importParsed.mode === 'ordered'
      ? `<p class="imp-note">라벨이 없어 <b>적은 순서대로</b> 짝지었습니다. 순서가 맞는지 꼭 확인해 주세요.</p>` : '');
  // 하나도 안 바뀌면 적용할 것이 없다 — 누르면 아무 일도 안 일어나 고장으로 보인다.
  document.querySelector('#import-apply').disabled = !rows.some((r) => r.changed);
}

// 안내를 펼칠 때 예시 그림을 붙인다. 안 펴는 사람에게는 52K 를 안 보낸다.
// (loading="lazy" 로는 안 된다 — dialog 안이라 브라우저가 화면 밖으로 안 쳐준다.)
document.querySelector('#shot-guide').addEventListener('toggle', (e) => {
  const img = document.querySelector('#shot-sample');
  if (e.target.open && img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
});

document.querySelector('#stat-import').addEventListener('click', openImport);
document.querySelector('#import-close').addEventListener('click', () => importModal().close());
for (const b of document.querySelectorAll('#import-body [data-goto]')) {
  b.addEventListener('click', () => importGoto(Number(b.dataset.goto)));
}
document.querySelector('#import-copy').addEventListener('click', async (e) => {
  try {
    await navigator.clipboard.writeText(IMPORT_PROMPT);
    e.target.textContent = '복사됨';
  } catch {
    // 클립보드 권한이 없거나 file:// 인 경우가 있다. 그때는 직접 긁어가면 된다.
    e.target.textContent = '직접 복사해 주세요';
    getSelection()?.selectAllChildren(document.querySelector('#import-prompt'));
  }
  setTimeout(() => { e.target.textContent = '복사'; }, 1800);
});
document.querySelector('#import-read').addEventListener('click', () => {
  const parsed = parseStatPaste(document.querySelector('#import-paste').value);
  const err = document.querySelector('#import-error');
  if (!Object.keys(parsed.values).length) {
    err.hidden = false;
    err.textContent = parsed.unknown.length
      ? `우리가 쓰는 항목을 못 찾았습니다. 읽힌 것: ${parsed.unknown.join(', ')} — 프롬프트를 그대로 넣으셨는지 확인해 주세요.`
      : '숫자를 못 찾았습니다. AI 가 준 결과를 통째로 붙여넣거나, 숫자 9개를 순서대로 넣어주세요.';
    return;
  }
  err.hidden = true;
  importParsed = parsed;
  renderImportPreview();
  importGoto(3);
});
document.querySelector('#import-apply').addEventListener('click', () => {
  const n = importPreview(importParsed.values, state.profile).filter((r) => r.changed).length;
  Object.assign(state.profile, importParsed.values);
  save(); renderFields(); computeMeasure(); renderMeasure(); renderResults();
  importModal().close();
  setSaveHint(`스탯 ${n}개 적용`);
});

document.querySelector('#sample-stats').addEventListener('click', () => applySample('stats', '스탯창'));
document.querySelector('#sample-combat').addEventListener('click', () => applySample('combat', '전투 패턴'));

document.querySelector('#reset-all').addEventListener('click', () => {
  if (!confirm('입력을 모두 초기화합니다. 계속할까요?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  renderFields(); renderMeasureFields(); computeMeasure(); renderAll();
});

// ── 시작 ────────────────────────────────────────────────
document.querySelector('#app-version').textContent = APP_VERSION;
renderFields();
renderMeasureFields();
computeMeasure();
renderAll();
