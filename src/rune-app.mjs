// 룬 추천기 UI.
//
// 계산은 전부 기존 순수 모듈에 맡긴다(calculator / build-evaluator / rune-conditionals).
// 이 파일은 상태 관리와 DOM 만 담당한다.

import { RUNES } from './runes-data.mjs';
import { fieldLabel } from './gen/effect-fields.mjs';
import { uncountedOf, baseName } from './rune-uncounted.mjs';
import {
  evaluate, SLOT_CAPACITY, resolveRuneEffects, FIGHT_SECONDS_CHOICES, KILL_COUNT_CHOICES,
  effectiveNightBlessingCycle,
} from './build-evaluator.mjs';
import { optimizeSet, SLOT_ORDER } from './optimizer.mjs';
import {
  validateRuneSet, DRAGON_SIGIL, GIANT_FRAGMENT, AWAKENING_RUNES, CURSE_RUNES, EROSION_RUNES,
  COOLDOWN_RUNES, RUNE_CONDITIONALS, NEGATIVE_TRAITS,
  SPECIAL_TRIGGER_RUNES, VULNERABLE_RUNES, DOT_TRIGGER_RUNES, DOT_APPLIER_RUNES,
  POLLUTION_REDUCTION, NIGHT_BLESSING, RUNE_CONTENT, RUNE_FAMILY, FAMILIES, familyCounts,
  EROSION_SYSTEM, MAX_AWAKENING, dragonSigilUptime, DOT_TYPES, dotsFromRunes,
  migrateConditionalOverrideKeys,
} from './rune-conditionals.mjs';
import { DEFAULT_PROFILE, dotDefaults, nightBlessingDefaults } from './default-profile.mjs';
import {
  migrateMeasureToPairs, settleMeasureMode, migrateNightBlessingScale, pruneNightBlessingEffects,
  migrateCooldownUtility, pruneNonRuneDamage,
} from './save-migrations.mjs';
import { solveMeasurement, measurementPrecision, singleRunePair } from './measure.mjs';
import {
  JOB_SAMPLES, BASIC_ATTACK_JOBS, RESOURCE_SKILL_SHARE, JOB_DOTS, HEALING_JOBS,
} from './gen/jobs-data.mjs';
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
// 빌드가 심는다(tools/build-dist.sh). 손으로 세면 반드시 낡는다 — 실제로 9일 밀린 채
// 배너에 떠 있었다. 개발 중에는 'dev' 그대로 보이는 편이 낫다: 지금 보는 것이 배포본이
// 아니라는 신호가 된다.
const APP_VERSION = 'dev';

// 저장 스키마 버전. 상태의 '구조'가 바뀔 때만 올린다.
// 색·문구·계산식 수정으로는 절대 올리지 않는다 — 올리면 사용자의 측정값과 설정이 날아간다.
const SCHEMA_VERSION = 'v2';
const STORAGE_KEY = `mobinogi-rune-optimizer:${SCHEMA_VERSION}`;
// 장신구는 수치 옵션이 하나도 없어(189개 전수 확인) 추천할 것이 없다. UI에서 아예 뺀다.
// 부위 순서는 optimizer.mjs 가 갖는다 — 탐색과 화면이 같은 순서를 봐야 한다.
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
  ['fastSkill', '빠른 스킬'],
];
/* **비어 있는 것이 맞다. 채우지 마라.**
 *
 * 한때 여기 「룬 외 피증 %」 칸이 있었다. 계산에는 늘 물려 있는데(nonRuneDamagePercent →
 * itemMainDamagePercent) 입력칸이 없어 항상 0 이라는 이유로 되살렸던 것인데, **줄 것이
 * 실제로 없다.** 저장소가 아는 피증 출처는 전부 자기 경로가 따로 있다:
 *
 *   헬리오도르        helioPercent
 *   아티팩트          artifactDamagePercent (은의 기사 = 팔라딘 2% 도 여기)
 *   직업 패시브·버프   deltas (전사·장궁병·기사 10%, 전격술사 밤축 100%)
 *   룬               deltas
 *
 * 남는 것을 아무도 못 댔다 — 인챈트에는 피증이 없고(강타 강화 같은 것은 피증이 아니다),
 * 아티팩트와 팔라딘은 위에서 이미 센다. 그래서 칸을 도로 없앴다.
 *
 * 이름을 댈 수 있는 출처가 생기면 그때 되살려라. 그전에는 **아무도 못 채우는 칸**이고,
 * 그런 칸은 0 이 아닌 값이 들어가는 순간 조용히 순위를 흔든다(룬 피증과 같은 가산 그룹이라
 * 기저가 커질수록 피증 룬의 값이 떨어진다). 옛 저장분의 값은 불러올 때 버린다. */
const EXTRA_FIELDS = [];

/** 헬리오도르 등급별 대미지 증가. 게임 내 표기 기준. */
const HELIO_TIERS = [
  ['none', '없음', 0],
  ['base', '헬리오도르', 5.0],
  ['refined', '정제된', 5.2],
  ['pure', '순수한', 5.4],
];
/** 결과를 크게 흔드는 입력에는 무엇에 영향을 주는지 적어 둔다. */
/** 그 직업의 각성 구간 버프 기본값을 사람이 읽는 문장으로. */
/** 확신 등급을 사람이 읽는 말로. 데이터의 confidence 를 그대로 옮긴다. */
const CONFIDENCE_LABEL = { high: '확신 높음', medium: '확신 보통', low: '확신 낮음' };

/* 각성 구간 버프 칸에 늘 띄우는 자리. 그 직업 표에 없어도 사람이 넣을 수 있어야 한다 —
 * 기록이 없는 직업이 여섯이나 되는데, 칸이 없으면 아는 사람도 넣을 방법이 없다.
 * 최종 데미지 하나만 늘 띄운다. 여섯 자리를 다 띄우면 대부분 0 인 칸이 줄줄이 남는다. */
const NB_ALWAYS = 'finalDamage.percent';

/* 그 직업 표에 무엇이 적혀 있는지 — 아래 칸들의 **기본값이 어디서 왔는지**를 밝힌다.
 *
 * 자리(피증이냐 최종 데미지냐)는 여기서 말하지 않는다. 칸마다 이름이 붙어 있어 화면이
 * 이미 말해준다. 대신 화면이 못 말하는 둘을 적는다.
 *
 *   1. **확신 등급** — 21개 직업 중 실측은 댄서·기사 둘뿐이고 나머지는 게임 툴팁을 읽어
 *      유도한 값인데, 표 안에서는 다 똑같이 생겼다. 스스로 low 를 단 것이 여섯이다.
 *   2. **어떻게 나온 값인지(note)** — 유도 과정과 그 안의 단서가 거기 있다
 *      ("신성력이 이미 차 있으면 증분이 없어 과대평가일 수 있다").
 *
 * 유도의 깊이가 제각각이라 이게 중요하다. 트리거가 곧 버프라 곱할 것이 없는 것(댄서)이
 * 있는가 하면, 여러 단계를 연쇄로 이은 것(사제·궁수)도 있다. 그 차이를 화면이 말해주지
 * 않으면 사제 유저가 20 을 그대로 믿는다. */
function nightBlessingBuffText(job) {
  const nb = CLASS_NIGHT_BLESSING[job];
  const entries = Object.entries(nb?.effects ?? {});
  /* 기본값이 없는 직업도 "왜 없는지" 는 알려준다. 암흑술사처럼 있던 것이 다른 자리로
   * 옮겨간 경우가 있어서, 없다는 말만 하면 빠뜨린 것처럼 읽힌다. */
  const explain = nb?.note
    ? `<details class="nb-why"><summary>근거</summary><p>${nb.note}</p></details>`
    : '';
  if (!entries.length) {
    return `${job}는 조사된 기본값이 없습니다. 아는 값이 있으면 아래에 넣으세요.${explain}`;
  }
  const parts = entries.map(([f, v]) => `${fieldLabel(f)} ${v}%`).join(' · ');
  const conf = CONFIDENCE_LABEL[nb.confidence] ?? '';
  const grade = conf ? ` <span class="conf ${nb.confidence}">${conf}</span>` : '';
  /* 어떻게 나온 값인지는 **접어 두되 언제나 열 수 있게** 한다.
   *
   * 대부분에게는 안 궁금한 내용이라 접는다. 하지만 확신이 높다고 근거가 필요 없는 것은
   * 아니다 — 내가 아는 값이어도 남에게는 설명이 있어야 하고, 이 도구는 "이게 왜 이
   * 숫자죠" 에 답하는 것이 일이다. 등급으로 감출 것이 아니라 등급과 함께 보여준다. */
  return `${job} 기본값: <b>${parts}</b>${grade}${explain}`;
}

const FIELD_HINTS = {
  hitsPerSecond: '바위 칼날 스택(최대 30 = 초당 3타 필요), 초월 엠블럼·숲 길잡이 가동률을 좌우합니다.',
  // 직업별 수치는 여기 적지 않는다 — data/jobs 의 트리거 간격에서 nightBlessingHint() 가
  // 만들어 붙인다. 산문에 숫자를 박아두면 데이터를 고쳐도 설명이 안 따라가 서로 어긋난다.
  cooldownRuneDamagePercent: '쿨감 룬(햇살+·공허)이 최종 데미지로 얼마나 값어치가 있는지입니다. 세트에 하나라도 있으면 한 번만 붙습니다. 기본 0 — 모르면 그대로 두세요.',
  resourceSkillSharePercent: '스킬 자원(마나·기력 등)을 소모하는 스킬이 내 딜에서 차지하는 비중입니다. 「무한한 탐욕」의 피해 38% 는 그 스킬에만 붙어서, 이 비중만큼만 계산에 들어갑니다 — 40% 면 15.2%. 로테이션에서 그 스킬을 얼마나 쓰는지로 잡으세요.',
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
const DEFAULT_JOB = '댄서';
/** 안 재고 시작할 때 쓰는 룬 외 공증. 인챈트·아티팩트·직업 버프 몫이다. */
const DEFAULT_NON_RUNE_PERCENT = 9.5;

const defaultState = () => ({
  job: DEFAULT_JOB,
  /* 처음 들어온 사람에게는 직업 샘플을 채워 둔다.
   *
   * 예전에는 전부 0 으로 비워 뒀다. "남의 숫자가 들어 있으면 자기 값이 아니라는 걸 모른 채
   * 결과를 믿는다" 가 이유였는데, 0 도 결국 남의 숫자다 — 그것도 **틀린** 남의 숫자다.
   * 실연타율 0 이면 연타 강화가 D 항에 아예 안 들어가서, 첫 화면의 추천이 통째로 엉뚱하게
   * 나온다. 빈 칸이 안전하다는 생각이 여기서는 반대로 작동했다.
   *
   * 대신 '샘플이 들어 있다' 를 화면에 밝힌다(#sample-note). 감추는 것이 문제였지
   * 채우는 것이 문제가 아니었다. 측정(①)은 여전히 본인이 해야 하고, 그 전에는 결과가 막힌다.
   * 착용 룬과 아티팩트는 계속 비운다 — 그건 예시 수치가 아니라 남의 세팅 자체다. */
  profile: {
    ...DEFAULT_PROFILE,
    ...(JOB_SAMPLES[DEFAULT_JOB]?.stats ?? {}),
    ...(JOB_SAMPLES[DEFAULT_JOB]?.combat ?? {}),
    resourceSkillSharePercent: RESOURCE_SKILL_SHARE[DEFAULT_JOB] ?? 0,
    dotTypes: dotDefaults(DEFAULT_JOB),
    nightBlessingEffects: nightBlessingDefaults(DEFAULT_JOB),
    heals: HEALING_JOBS.includes(DEFAULT_JOB),
    assumeVulnerable: false,
  },
  /* 룬마다 교체 후보를 띄울지. 재는 데 값이 들어서(후보 전체면 200회 넘는 평가)
   * 늘 켜두면 스탯 칸을 칠 때마다 그 값을 낸다. 눌러서 켠다. */
  showSwaps: false,
  /* 아직 샘플 그대로인가. 프로필 칸을 한 번이라도 건드리면 꺼진다.
   * profile 안에 두지 않는 이유: 그 객체는 그대로 평가기로 넘어가는데,
   * 계산과 무관한 화면 사정이 거기 섞이면 나중에 누가 그걸 계산에 쓰게 된다. */
  usingSample: true,
  // 샘플이 없는 항목은 비운 채로 시작한다. 착용 룬과 아티팩트는 '예시 수치'가 아니라
  // 남의 세팅 자체라, 들어 있으면 자기 것을 넣기 전에 추천이 그 세트 기준으로 나와 오해를 부른다.
  equipped: [],
  // 룬별 가정 덮어쓰기: { [룬이름]: { utility: %, cond: { [조건부 id]: 기대값% } } }
  // cond 의 키는 라벨이 아니라 id 다 — 라벨을 키로 쓰면 문구를 다듬는 것만으로 값이 사라진다.
  overrides: {},
  candidates: USABLE.map((r) => r.name),
  /* 실험군 — 현재 세팅을 건드리지 않고 바꿔보는 두 번째 세트.
   * null 은 '아직 실험을 시작하지 않았다' 는 뜻이고, 화면에서는 현재의 사본으로 보여준다.
   * 사본을 미리 만들어 두지 않는 이유: 현재를 바꿨을 때 실험군이 옛 구성으로 굳어
   * "왜 왼쪽과 다르지" 가 된다. 손대기 전까지는 따라다니는 편이 맞다. */
  trial: null,
  // 특수 트리거는 기본 제외다 — 체력을 낮게 유지하거나 일부러 맞아주는 플레이를 전제하는데
  // 대부분에게는 해당하지 않아, 켜두면 추천이 그쪽으로 쏠린다.
  // 신화는 대부분 못 구한다. 켜둔 채로 시작하고, 갖고 있으면 끄면 된다 —
  // 반대로 두면 추천 상위가 못 쓰는 룬으로 채워져 목록 전체가 쓸모없어 보인다.
  filters: { mythicExcluded: true, specialTrigger: true },
  // 필터로 걸러졌지만 사용자가 개별로 되살린 룬. 필터를 켜둔 채 예외를 두기 위한 것이다.
  exceptions: [],
  // 추천을 어느 시나리오로 계산할지. 조건부가 하나도 안 터지는 최소, 기대값, 전부 터지는 최대.
  scenario: 'expected',
  artifacts: {},  // 아티팩트 이름 → 개수 (합계 최대 5, 유일 효과는 1개만 적용)
  // 스탯창을 두 번 읽는다. 각 읽기는 (공격력, 그때의 공증룬 합 %) 한 쌍이다.
  /* 재는 방법은 둘이다. 구하는 값(깡공 A · 룬 외 공증)은 같고 입력 개수만 다르다.
   * 기본은 간이 — 사람들이 어려워한 것은 산수가 아니라 공증합을 두 번 더하는 일이었다.
   * a/b 는 어느 모드든 **풀이에 들어가는 정본**이다. 간이 모드는 single 에서 a/b 를 만든다. */
  /* 기본은 '안 잼' 이다. 재는 것은 룬 외 공증 하나뿐인데, 그 값이 좀 달라도 추천 순위는
   * 크게 안 흔들린다(가정값을 바꿔가며 재본 결과 대개 1% 안쪽). 반면 측정은 게임을 두 번
   * 들여다봐야 해서, 거기서 대부분이 멈췄다. 먼저 쓰게 하고 정확도는 원할 때 올린다. */
  measure: { mode: 'none', nonRunePercentManual: DEFAULT_NON_RUNE_PERCENT,
    single: { attackNow: null, attackAfter: null, runePercent: null, direction: 'removed' },
    a: { attack: null, runePercent: null }, b: { attack: null, runePercent: null },
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
    // '전설만' 을 '신화 제외' 로 이름만 바꿨다. 키가 그대로면 켜둔 사람의 설정이 살아 있고,
    // 안 옮기면 조용히 꺼진 채로 추천에 신화가 섞여 들어온다.
    if (s.filters && 'legendaryOnly' in s.filters) {
      s.filters = { ...s.filters, mythicExcluded: s.filters.legendaryOnly };
      delete s.filters.legendaryOnly;
    }
    // 조정값 키를 라벨에서 id 로 옮긴다. SCHEMA_VERSION 을 올려 저장분을 버리는 대신
    // 여기서 1회 변환하는 이유는 위 주석 그대로다 — 측정값까지 같이 날릴 일이 아니다.
    const migrated = migrateConditionalOverrideKeys(s.overrides ?? {});
    const next = { ...d, ...s, profile: { ...d.profile, ...s.profile }, filters: { ...d.filters, ...s.filters }, overrides: migrated.overrides, exceptions: Array.isArray(s.exceptions) ? s.exceptions : [],
      scenario: SCENARIOS.some((x) => x.key === s.scenario) ? s.scenario : 'expected', artifacts: (s.artifacts && !Array.isArray(s.artifacts)) ? s.artifacts : {} };
    /* 평타 스위치는 이 저장분이 만들어진 뒤에 생겼다. 값이 아예 없다는 것은 '이 질문을
     * 받은 적이 없다' 는 뜻이므로 직업 기본값으로 채운다 — 사용자의 선택을 덮는 것이 아니라
     * 빈칸을 메우는 것이다. 한 번이라도 켜거나 끈 사람은 false 라도 그 값이 남는다. */
    if (s.profile?.usesBasicAttack === undefined) {
      next.profile.usesBasicAttack = BASIC_ATTACK_JOBS.includes(next.job);
    }
    /* 지속 피해 칸도 나중에 생겼다. 같은 이유로 직업 기본값을 채운다 — 값이 없다는 것은
     * 질문을 받은 적이 없다는 뜻이다. 빈 객체({})는 "다 껐다" 라는 대답이므로 건드리지 않는다. */
    if (s.profile?.dotTypes === undefined) {
      next.profile.dotTypes = dotDefaults(next.job);
    }
    if (s.profile?.heals === undefined) {
      next.profile.heals = HEALING_JOBS.includes(next.job);
    }
    /* 「밤의 축복 직업 버프 반영 %」(배율) → 「각성 딜 압축 버프 %」(최종 데미지 값).
     * SCHEMA_VERSION 을 올려 저장분을 통째로 버리는 대신 여기서 1회 옮긴다 — 그 사람의
     * 측정값과 장비 설정까지 같이 날릴 일이 아니다. */
    migrateNightBlessingScale(next.profile, CLASS_NIGHT_BLESSING[next.job]?.effects);
    // 기본값에서 빠진 항목은 버린다. 남겨두면 화면에 유령 칸이 뜬다.
    pruneNightBlessingEffects(next.profile, CLASS_NIGHT_BLESSING[next.job]?.effects, NB_ALWAYS);
    /* 쿨감 룬의 룬별 보정값이 남아 있으면 세트 칸으로 옮긴다. 그 칸은 이제 룬 상세에
     * 없어서, 안 옮기면 사람이 일부러 넣은 숫자가 아무 말 없이 사라진다. */
    const cdMoved = migrateCooldownUtility(next.profile, next.overrides, Object.keys(COOLDOWN_RUNES));
    /* 「룬 외 피증」 칸을 없앴다. 값을 남겨두면 화면에 안 보이는 채로 계산에 계속 들어가고,
     * 칸이 없으니 사람이 0 으로 되돌릴 수도 없다. */
    const nrDropped = pruneNonRuneDamage(next.profile);
    // 재다 만 상태는 새로고침을 넘기지 않는다. 규칙은 save-migrations 에 있다 —
    // 여기 두면 localStorage 와 DOM 을 타서 테스트가 못 부른다.
    settleMeasureMode(next.measure);
    if (next.measure && !Number.isFinite(next.measure.nonRunePercentManual)) {
      next.measure.nonRunePercentManual = DEFAULT_NON_RUNE_PERCENT;
    }
    if (next.measure && !next.measure.single) {
      next.measure.single = { attackNow: null, attackAfter: null, runePercent: null, direction: 'removed' };
    }
    // 옛 측정(기준 룬 하나를 빼는 방식)을 '두 번 읽기' 모양으로 옮긴다.
    // 공격력은 사용자가 넣은 값 그대로, 공증합은 옛 코드가 이미 쓰던 값이라 결과가 안 변한다.
    // runeByName 은 이 파일 아래쪽에서 만들어진다 — load() 는 그전에 돈다. 여기서 쓰면
    // TDZ 로 터지고, 그러면 load() 의 catch 가 삼켜 저장분이 통째로 없는 것처럼 된다.
    const pctOf = (n) => RUNES.items.find((r) => r.name === n)?.alwaysOnAttackPercent ?? 0;
    const paired = migrateMeasureToPairs(next, pctOf);
    Object.assign(next, paired.state);
    const changedAny = migrated.changed || paired.changed || cdMoved || nrDropped;
    // 변환 결과를 바로 되쓴다. 안 그러면 열 때마다 다시 변환하게 되고, 그 사이에
    // 라벨이 또 바뀌면 그때는 짝을 못 찾아 조정값이 정말로 사라진다.
    // save() 는 아직 state 가 없어 못 쓴다(이 함수가 state 를 만드는 중이다).
    if (changedAny) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch { return null; }
}
const INPUT_SETTLE_DELAY_MS = 1000;
let pendingInputSave = null;

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setSaveHint('저장됨');
  } catch { setSaveHint('저장 실패(브라우저 설정 확인)'); }
}

function save() {
  clearTimeout(pendingInputSave);
  pendingInputSave = null;
  persistState();
}

/** 숫자를 연달아 누르는 동안에는 동기 localStorage 쓰기도 한 번으로 모은다. */
function scheduleInputSave() {
  clearTimeout(pendingInputSave);
  pendingInputSave = setTimeout(() => {
    pendingInputSave = null;
    persistState();
  }, INPUT_SETTLE_DELAY_MS);
}

// 모바일 브라우저가 탭을 얼리기 전에 아직 대기 중인 입력값을 확정한다.
window.addEventListener('pagehide', () => {
  if (pendingInputSave !== null) save();
});
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
  { key: 'mythicExcluded', excludes: (r) => r.grade === '신화' },
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
    out.push(['지속 피해 트리거', `지속 피해가 걸린 적을 때려야 켜집니다. ② 캐릭터의 「지속 피해」 칸이 정하고, 부여하는 룬을 같이 끼면 자동으로 켜집니다: ${DOT_APPLIER_NAMES.join(', ')}`]);
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


const isComputed = () => Number.isFinite(state.measure.nonRunePercent);
/** 안 재는 모드인가. 이때 룬 외 공증은 사람이 넣은 값(기본 10%)을 그대로 쓴다. */
const isNoMeasure = () => (state.measure.mode ?? 'none') === 'none';
/** 결과를 열어도 되는가. 안 재는 모드는 늘 열려 있다 — 값이 이미 있기 때문이다. */
const isMeasured = () => (isNoMeasure() ? true : isComputed() && state.measure.committed);
const runeByName = (n) => USABLE.find((r) => r.name === n);
const fmtPct = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;
/** 소수 둘째 자리에서 0 이면 0 으로 적는다. 안 그러면 '-0.00%' 가 나온다 — 룬 외 공증이
 *  딱 0 인 사람에게 음수처럼 보이고, 이 값은 음수면 안 되는 값이라 더 헷갈린다. */
const fmtPercent = (v) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);

/** 지속 피해를 부여하는 룬 이름. 목록은 "무엇을 남기는가" 를 담는 맵이라 키만 쓴다. */
const DOT_APPLIER_NAMES = Object.keys(DOT_APPLIER_RUNES);

/** 이 룬에 사용자가 조정할 가정이 있는가 */
function hasTweaks(rune) {
  const n = baseName(rune.name);
  if (uncountedOf(rune).some((u) => u.kind === '유틸')) return true;
  const modeled = RUNE_CONDITIONALS[rune.name] ?? RUNE_CONDITIONALS[n];
  return !!modeled?.some((e) => e.basis === 'playstyle' || e.rateAdjustable);
}

/** 계열 배지 */
function badges(rune) {
  const n = baseName(rune.name), out = [];
  const fam = [...DRAGON_SIGIL.enablers, ...DRAGON_SIGIL.extenders, ...DRAGON_SIGIL.consumers];
  if (fam.includes(n)) out.push(['용의 문장', 'dragon']);
  if (EROSION_RUNES.includes(n)) out.push(['침식', 'erosion']);
  if (AWAKENING_RUNES.includes(n)) out.push(['각성', 'awaken']);
  if (CURSE_RUNES.includes(n)) out.push(['저주', 'curse']);
  if (GIANT_FRAGMENT.runes.includes(n)) out.push(['유일', 'unique']);
  if (/밤의 축복/.test(rune.desc)) out.push(['밤의 축복', 'night']);
  if (COOLDOWN_RUNES[rune.name] || COOLDOWN_RUNES[n]) out.push(['쿨감', 'util']);
  return out;
}

/* 어느 콘텐츠에서 나온 룬인가. 계열 배지(badges)와 섞지 않는다 —
 * bandOf 가 badges 로 '계열 룬이냐' 를 판단하므로, 여기에 끼면 층이 어긋난다. */
function contentOf(rune) {
  return RUNE_CONTENT[baseName(rune.name)] ?? null;
}

/* 룬문장 색으로 갈리는 게임 계열(빛·어둠·용).
 *
 * 새 룬 다섯이 이 수를 조건으로 쓴다 — "용 계열 2개 이상", "빛·어둠·용 각각 2개 이상".
 * 그런데 화면 어디에도 어느 룬이 무슨 계열인지 없었다. 조건은 걸려 있고 무엇이 몇 개인지는
 * 못 보는 상태라, 왜 그 룬이 약하게 나오는지 알 방법이 없었다.
 *
 * badges() 와 섞지 않는다 — bandOf 가 badges 로 '계열 룬이냐'(침식·용의 문장 등)를
 * 판단하므로, 여기에 끼면 층이 통째로 어긋난다. 이름도 겹치지만 다른 개념이다. */
const GLYPH_CLASS = { 빛: 'light', 어둠: 'dark', 용: 'dragon-glyph' };

/* 계열 개수를 문턱으로 쓰는 룬과 그 문턱. 데이터(requiresFamily)에서 뽑는다 —
 * 손으로 적으면 조건을 고쳤을 때 화면 문구만 옛날 것으로 남는다. */
const FAMILY_GATES = Object.fromEntries(
  Object.entries(RUNE_CONDITIONALS)
    .map(([name, entries]) => [name, entries.find((e) => e.requiresFamily)?.requiresFamily])
    .filter(([, req]) => req));
function glyphFamilyOf(rune) {
  return RUNE_FAMILY[baseName(rune.name)] ?? null;
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
        `공증 차이가 더 크게 나도록 바꿔서 재면 정확해집니다.</div>`
      : '');
}

function renderMeasure() {
  const measured = isMeasured();
  // 버튼은 입력칸 오른쪽에 처음부터 자리한다. 값이 유효할 때만 눌린다.
  /* 안 재는 모드면 입력 폼 대신 한 칸짜리 블록만 띄운다. */
  const noMeasure = isNoMeasure();
  document.querySelector('#no-measure').hidden = !noMeasure;
  document.querySelector('#measure-body').hidden = noMeasure || (measured && !renderMeasure.open);
  /* 재는 것과 안 재는 것 사이를 **양쪽으로** 오갈 수 있어야 한다.
   *
   * 예전에는 한 번 확정하면 되돌아 나오는 버튼이 사라져서(「측정 취소」가 미확정일 때만
   * 떴다) 안 재는 화면으로 갈 길이 아예 없었다. 그리고 그 버튼 이름이 「측정 취소」라,
   * 안 재고 쓰는 것이 하나의 선택이 아니라 하던 일을 무르는 것처럼 읽혔다.
   *
   * 이제 안 재는 쪽이 기본이고, 양쪽 다 언제든 갈 수 있다. 오갈 때 잰 값을 버리지
   * 않는다 — 버리면 되돌아왔을 때 처음부터 다시 재야 한다. */
  const startBtn = document.querySelector('#measure-start');
  startBtn.hidden = !noMeasure;
  startBtn.textContent = state.measure.committed ? '측정값 쓰기' : '측정';
  document.querySelector('#measure-none').hidden = noMeasure;
  document.querySelector('#nm-nonrune').value =
    state.measure.nonRunePercentManual ?? DEFAULT_NON_RUNE_PERCENT;
  /* 잰 값을 갖고 있으면서 안 쓰는 중이라는 것을 밝힌다. 안 적으면 "내가 잰 게 어디 갔지"
   * 가 되고, 실제로 사라진 것이 아니라 안 보는 중이라는 걸 알 방법이 없다. */
  const kept = document.querySelector('#nm-kept');
  kept.hidden = !state.measure.committed;
  if (state.measure.committed) {
    kept.textContent = `이전에 잰 값(룬 외 공증 ${fmtPercent(state.measure.nonRunePercent ?? 0)}%)이 남아 있습니다 — ` +
      '「측정값 쓰기」를 누르면 그대로 돌아갑니다.';
  }

  /* 모드 전환. 두 블록 중 하나만 보인다. 측정 버튼도 그 블록 안의 것만 쓴다 —
   * 숨은 블록의 버튼이 남아 있으면 화면에 안 보이는 것이 눌린 것처럼 동작한다. */
  /* 안 재는 모드에는 라디오도 측정 버튼도 없다. 그 상태에서 라디오를 찾으면 null 이 나오고,
   * 거기에 .checked 를 쓰는 순간 이 함수가 통째로 터진다 — 요약도 결과도 안 그려진다.
   * 실제로 그렇게 났고, 화면에는 옛 내용이 남아 있어 신호가 없었다. */
  const mode = state.measure.mode ?? 'none';
  if (!noMeasure) {
    document.querySelector(`input[name="measure-mode"][value="${mode}"]`).checked = true;
    document.querySelector('#mode-single').hidden = mode !== 'single';
    document.querySelector('#mode-pairs').hidden = mode === 'single';
    // 정밀 모드 안내문은 '공증룬 합' 을 설명한다. 간이 모드에서는 묻지도 않는 값이라 감춘다.
    document.querySelector('#pairs-note').hidden = mode === 'single';

    const btn = document.querySelector(mode === 'single' ? '#measure-submit-single' : '#measure-submit');
    document.querySelector(mode === 'single' ? '#measure-submit' : '#measure-submit-single').disabled = true;
    const outcome = document.querySelector('#measure-outcome');
    const hasMessage = !!document.querySelector('#measure-result').textContent.trim();
    outcome.hidden = !hasMessage;
    btn.disabled = !isComputed();
    btn.textContent = state.measure.committed ? '다시 측정' : '측정';
  } else {
    document.querySelector('#measure-outcome').hidden = true;
  }
  document.querySelector('#measure-summary').hidden = !measured || renderMeasure.open;
  document.querySelector('#measure-toggle').hidden = !measured || noMeasure;
  document.querySelector('#measure-toggle').textContent = renderMeasure.open ? '접기' : '재측정';
  document.querySelector('#measure-section').classList.toggle('done', measured);
  if (measured) {
    const manual = state.measure.nonRunePercentManual ?? DEFAULT_NON_RUNE_PERCENT;
    document.querySelector('#sum-title').textContent = noMeasure ? '기본값 사용 중' : '측정 완료';
    document.querySelector('#sum-nonrune').textContent =
      `${fmtPercent(noMeasure ? manual : state.measure.nonRunePercent)}%`;
    // 깡공은 안 재는 모드에서 값 자체가 없다. '≈ –' 로 두면 못 구한 것처럼 보이므로 문장을 바꾼다.
    const aWrap = document.querySelector('#sum-a-wrap');
    aWrap.innerHTML = noMeasure ? '깡공 A = <b>미측정</b>'
      : `깡공 A ≈ <b>${Math.round(state.measure.attackA ?? 0).toLocaleString()}</b>`;
    document.querySelector('#sum-date').textContent =
      noMeasure ? '' : (state.measure.at ? `(${state.measure.at} 측정)` : '');
  }
  /* 측정은 여기서 끝난다.
   *
   * 예전에는 아래 단계(아티팩트·착용 룬)를 보고 "측정할 때와 다릅니다" 를 띄웠다.
   * 그런데 그 경고가 맞는 경우보다 헛짚는 경우가 많았다 — 측정을 먼저 하고 아티팩트를
   * 나중에 채우는 것이 자연스러운 순서라서다. 괜한 경고는 진짜 경고까지 같이 무시하게 만든다.
   *
   * 잰 값은 잰 값이다. 다시 재야 할 이유가 생기면 사람이 안다. */
  // 간이로 잰 값은 룬 외 공증이 부풀어 있다. 요약에 그 사실을 붙여 둔다 —
  // 접힌 상태에서는 이 줄만 보이기 때문이다.
  const note = document.querySelector('#sum-mode');
  if (note) {
    if (noMeasure) {
      note.hidden = !measured;
      note.innerHTML = '이 값은 <b>기본값</b>입니다 — 재보지 않은 값이라 실제와 다를 수 있습니다. '
        + '추천 순위는 크게 안 흔들리지만, 정확히 보고 싶으면 오른쪽 위 <b>측정</b>으로 직접 재세요.';
    } else if (state.measure.mode === 'single') {
      note.hidden = !measured;
      note.innerHTML = '간이로 잰 값입니다 — <b>룬 외 공증에 다른 공증 룬이 섞여</b> 있어 '
        + '공증 룬이 실제보다 낮게 평가됩니다. 정확히 보려면 <b>재측정</b> 후 '
        + '<b>공증룬 세트로 측정</b>을 고르세요.';
    } else {
      note.hidden = true;
    }
  }
  document.querySelector('#result-blocked').hidden = measured;
  document.querySelector('#cmp-cols').hidden = !measured;
  document.querySelector('#panel-rec').hidden = !measured;
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
    // 안 재는 모드면 사람이 넣은 값을 그대로 쓴다. 잰 값이 있으면 그쪽이다.
    nonRuneAttackPercent: (isNoMeasure()
      ? state.measure.nonRunePercentManual ?? DEFAULT_NON_RUNE_PERCENT
      : state.measure.nonRunePercent) ?? 0,
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

/** 착용 중이지만 필터에 걸려 추천에서 빠지는 룬. 빈 배열이면 필터와 착용이 안 부딪힌다. */
function equippedBlockedByFilter() {
  return state.equipped.filter((n) => slotOf(n) && !passesFilters(n));
}

/**
 * 최적 세트 탐색. 알고리즘은 src/optimizer.mjs 에 있다 — DOM 모듈 안에 두면 테스트가 안 된다.
 * 여기서 넘기는 것은 앱의 상태뿐이다: 지금 후보, 지금 착용, 지금 프로필·시나리오로 매긴 점수.
 *
 * **씨앗에도 필터를 건다.** 등반은 바꾸거나 더할 뿐 빼지 않으므로, 거르지 않으면 필터로
 * 뺀 룬이 착용 중이라는 이유만으로 추천에 계속 살아남는다. 필터는 사용자가 방금 명시적으로
 * 한 말이고, "지금 낀 것보다 나쁜 추천은 안 한다" 는 코드가 스스로 한 약속이다. 부딪히면
 * 사용자 쪽이 이긴다 — 대신 그 대가(점수가 지금보다 낮을 수 있다)를 화면에 밝힌다.
 */
function optimize() {
  const bySlot = equippedBySlot();
  return optimizeSet({
    candidates: effectiveCandidates(),
    equipped: SLOT_ORDER.flatMap((s) => bySlot[s]).filter(passesFilters),
    score,
    slotOf,
  });
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
    /* 직업 특성 칸은 직업마다 붙었다 떨어진다.
     * 유지형 패시브 가동률과, 스킬 자원 소모 스킬의 딜 비중 — 둘 다 그 직업에만 뜻이 있다.
     * 없는 직업에 띄우면 "0 으로 두세요" 를 읽게 만드는데, 그건 물어보지 않는 편이 낫다. */
    const extra = [];
    if (g.title === '직업 특성' && up) extra.push(['classPassiveUptimePercent', up.label]);
    const fields = extra.length ? [...g.fields, ...extra] : g.fields;
    const sec = document.createElement('div');
    sec.className = 'combat-group';
    sec.innerHTML = `<h5>${g.title}</h5><p class="group-desc">${g.desc}</p>`;
    const grid = document.createElement('div');
    grid.className = 'grid-fields';
    mk(grid, fields);
    sec.append(grid);
    host.append(sec);
  }
  renderNightBlessing();
  document.querySelector('#assume-vulnerable').checked = !!state.profile.assumeVulnerable;
  document.querySelector('#uses-basic-attack').checked = !!state.profile.usesBasicAttack;
  renderSituation();
  renderHelio();
  renderArtifacts();
}

/**
 * 각성(밤의 축복) 구간에 겹치는 직업 버프 — **자리마다 한 칸씩**.
 *
 * 예전에는 기본값 전체에 곱하는 배율 하나였다. 두 칸 중 하나만 고칠 수도, 기본값에 없는
 * 항목을 더할 수도 없었다. 그 다음에는 최종 데미지 한 칸으로 합쳐 봤는데 더 나빴다 — 전격술사의
 * 피증 100% 를 최종 데미지로 옮기려면 자기 B 값을 알아야 하고, 그건 아무도 못 한다.
 * 실제로 그렇게 바꿨더니 전격술사의 밤축 구간 데미지가 41.5% 날아갔다.
 *
 * 원래 문제는 자리가 여럿인 것이 아니라 **틀렸을 때 고칠 수가 없다는 것**이었다.
 * 그래서 자리는 그대로 두고 칸마다 고치게 한다. 기본값은 직업 표가 준다.
 */
function renderNightBlessing() {
  const host = document.querySelector('#nb-effects');
  const table = CLASS_NIGHT_BLESSING[state.job]?.effects ?? {};
  const cur = state.profile.nightBlessingEffects ?? {};
  /* 이 직업의 기본값 항목 + 최종 데미지. 그게 전부다.
   *
   * 기본값에서 빠진 항목이 저장분에 남는 경우가 있는데(암흑술사 치확), 그건 화면에서
   * 다룰 일이 아니라 불러올 때 버린다(pruneNightBlessingEffects). 여기서 또 걸러내면
   * 같은 규칙이 두 곳에 생긴다. */
  const paths = [...new Set([...Object.keys(table), NB_ALWAYS])];
  const on = state.profile.useNightBlessingBuff ?? true;
  /* 스위치가 맨 앞이다. 숫자를 하나씩 지웠다 넣었다 하는 것보다 "이걸 쓸지" 를 먼저
   * 정하는 것이 자연스럽다. 꺼도 칸은 남긴다 — 무엇을 안 쓰기로 한 것인지 보여야 한다. */
  host.innerHTML =
    `<label class="dot-check nb-switch"><input type="checkbox" id="use-nb-buff"${on ? ' checked' : ''} />사용함</label>` +
    paths.map((path) => {
    /* 줄에는 값만 둔다. 기본값이 얼마인지는 바로 위 한 줄이 이미 다 말해주고 있어서,
     * 줄마다 또 적으면 같은 말이 두 번이다. 되돌리고 싶으면 그것을 보고 넣으면 된다 —
     * 되돌리기 버튼은 그래서 없앴다. */
    const v = cur[path] ?? 0;
    return `<label class="nb-row"><span>${fieldLabel(path)}</span>` +
      `<input type="number" step="any" data-nb="${path}" value="${v}" aria-label="${fieldLabel(path)} %" />` +
      `<span class="unit">%</span></label>`;
    }).join('');
  for (const i of host.querySelectorAll('input[data-nb]')) i.disabled = !on;
  host.classList.toggle('off', !on);
  document.querySelector('#nb-ref').innerHTML = nightBlessingBuffText(state.job);
}

/**
 * 전투 상황 — 지속 피해 · 처치 잡몹 수 · 기준 전투 시간.
 *
 * 세 칸 모두 "룬이 아니라 판이 정하는 것" 이라 한 자리에 있다. 지속 피해만 성격이 하나 더
 * 있는데, **세트가 스스로 켜는 몫**이 있다는 점이다 — 부여 룬을 끼면 그 종류는 사람이
 * 끌 수 없다(실제로 걸리고 있으므로). 그래서 그 칸은 잠그고 왜 잠겼는지 적는다.
 * 잠그지 않고 그냥 체크만 해두면, 껐다가 룬은 그대로인데 계산은 안 꺼지는 상태가 된다.
 */
function renderSituation() {
  /* 자동으로 켜지는 몫은 **현재 세팅** 기준으로만 표시한다. 계산은 세트마다 따로 하므로
   * (실험군에 폭염을 넣으면 그 세트에서는 화상이 켜진다) 여기 표시와 어긋날 수 있는데,
   * 칸이 하나뿐이라 둘 다 보여줄 자리가 없다. 흔들리는 쪽(실험군)을 표시에 쓰면
   * 룬을 만질 때마다 캐릭터 화면의 체크가 따라 움직여 더 헷갈린다. */
  const fromRunes = dotsFromRunes(state.equipped);
  document.querySelector('#dot-checks').innerHTML = DOT_TYPES.map((t) => {
    const auto = fromRunes.has(t);
    const on = auto || !!state.profile.dotTypes?.[t];
    const why = auto
      ? ` title="같은 세트의 룬이 이 지속 피해를 부여합니다 — 끌 수 없습니다"`
      : (JOB_DOTS[state.job] ?? []).includes(t) ? ` title="${state.job}의 기본값입니다"` : '';
    return `<label class="dot-check${auto ? ' auto' : ''}"${why}>` +
      `<input type="checkbox" data-dot="${t}"${on ? ' checked' : ''}${auto ? ' disabled' : ''} />${t}` +
      `${auto ? '<em>룬</em>' : ''}</label>`;
  }).join('');

  /* 눈금 선택. range 입력이 아니라 버튼인 이유는 값이 연속이 아니기 때문이다 —
   * 게임이 정한 문턱(5/10/20명)과 우리가 정한 판 길이 사이에는 중간값이 없다.
   * range 로 두면 7명 같은 값을 고를 수 있는데, 그 값은 5명과 결과가 똑같다. */
  const steps = (host, choices, cur, attr, fmt) => {
    document.querySelector(host).innerHTML = choices.map((v) =>
      `<button type="button" class="step${v === cur ? ' on' : ''}" ${attr}="${v}">${fmt(v)}</button>`).join('');
  };
  document.querySelector('#does-heal').checked = !!state.profile.heals;
  /* 이 칸은 renderFields 의 mk() 가 만든 것이 아니라 HTML 에 그대로 있다. 그래서 값도
   * 여기서 넣어야 한다 — 안 넣으면 빈 칸으로 보이는데, 빈 칸은 0 과 다르게 읽힌다. */
  document.querySelector('[data-profile="resourceSkillSharePercent"]').value =
    state.profile.resourceSkillSharePercent ?? 0;
  document.querySelector('[data-profile="cooldownRuneDamagePercent"]').value =
    state.profile.cooldownRuneDamagePercent ?? 0;
  /* 도발은 여기서 아무 말도 하지 않는다. 전투 숙련이 정하는 것이라 물을 것이 없고,
   * 도발과 치유가 서로 얽히는 것은 **사슬로 묶은 법전 하나뿐**이다 — 룬 하나의 사정을
   * 캐릭터 화면에 끌어올리면 이 자리가 그 룬 설명서가 된다.
   * 세 갈래와 반반 규칙은 그 룬 상세의 note 에 적혀 있다. */

  steps('#kill-count', KILL_COUNT_CHOICES, state.profile.killCount ?? 0, 'data-kill', (v) => `${v}명`);
  steps('#fight-seconds', FIGHT_SECONDS_CHOICES, state.profile.fightSeconds ?? 60, 'data-fight',
    (v) => (v >= 60 ? `${v / 60}분` : `${v}초`));
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

/** 저장된 측정값을 입력칸에 되돌려 놓는다. 모드마다 칸이 다르다. */
function renderMeasureFields() {
  const m = state.measure;
  for (const [key, no] of [['a', 1], ['b', 2]]) {
    document.querySelector(`#atk-${no}`).value = m[key]?.attack ?? '';
    document.querySelector(`#pct-${no}`).value = m[key]?.runePercent ?? '';
  }
  const sg = m.single ?? {};
  document.querySelector('#s-atk-now').value = sg.attackNow ?? '';
  document.querySelector('#s-atk-after').value = sg.attackAfter ?? '';
  document.querySelector('#s-rune').value = sg.runePercent ?? '';
  document.querySelector('#s-dir').value = sg.direction ?? 'removed';
}


function renderNegativeFilters() {
  const host = document.querySelector('#negative-filters');
  if (host.dataset.built) return;
  host.dataset.built = '1';
  const mythic = USABLE.filter((r) => r.grade === '신화').length;
  host.innerHTML =
    `<button type="button" class="ghost toggle tiny" data-filter="mythicExcluded" aria-pressed="false" ` +
    `title="신화 등급 룬을 추천에서 뺍니다. 갖고 계시면 끄세요.">` +
    `신화 제외 <b>${mythic}</b></button>` +
    `<button type="button" class="ghost toggle tiny" data-filter="specialTrigger" aria-pressed="false" ` +
    `title="특정 상황에서만 값이 나는 룬 — ${SPECIAL_TRIGGER_RUNES.join(', ')}">` +
    `상황 한정 제외 <b>${SPECIAL_TRIGGER_RUNES.length}</b></button>` +
    `<button type="button" class="ghost toggle tiny" data-filter="dotTrigger" aria-pressed="false" ` +
    `title="지속 피해가 걸린 적을 때려야 켜지는 룬 — ${DOT_TRIGGER_RUNES.join(', ')} (부여: ${DOT_APPLIER_NAMES.join(', ')})">` +
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
  // 0층은 콘텐츠 이름을 그대로 머리말로 쓴다(capOf). 여기 라벨은 안 쓰이는 자리다.
  { key: 'content', label: '콘텐츠' },
  { key: 'mythic', label: '신화' },
  { key: 'family', label: '계열 (침식 · 용의 문장 · 각성 · 밤의 축복)' },
  { key: 'plain', label: '그 외' },
];

// 제외 태그로는 층을 나누지 않는다. 태그가 붙었는지 아닌지를 모르는 상태에서 찾으려면
// 어느 층을 봐야 할지 알 수 없어 오히려 찾기 어려워진다. 제외 여부는 배지와 흐림 처리로만 알린다.
function bandOf(rune) {
  // 새로 들어온 묶음은 맨 위에 모은다. 등급·계열보다 '어느 콘텐츠에서 왔나' 가 먼저 궁금하다.
  if (contentOf(rune)) return 0;
  if (rune.grade === '신화') return 1;
  // 저주는 층을 나누지 않는다 — 둘뿐이고, 서로 못 겹친다는 제약일 뿐 침식·용의 문장처럼
  // 세트를 같이 짜야 하는 계열이 아니다. 배지로만 알린다.
  if (badges(rune).some(([, c]) => c !== 'util' && c !== 'curse')) return 2;
  return 3;
}

/** 층의 머리말. 콘텐츠 층은 콘텐츠가 여럿이 되면 이름별로 갈라진다. */
const capOf = (rune) => contentOf(rune) ?? RUNE_BANDS[bandOf(rune)].label;

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
  // 콘텐츠가 여럿이면 이름끼리 묶는다. 안 묶으면 머리말이 중간에 또 뜬다.
  (bandOf(a) === 0 ? (contentOf(a) ?? '').localeCompare(contentOf(b) ?? '', 'ko') : 0) ||
  (bandOf(a) === 2 ? familyRank(a) - familyRank(b) : 0) ||
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
      // 머리말이 바뀌면 구분 줄을 넣는다. 룬이 90개가 넘어 그냥 나열하면 찾기 어렵다.
      const band = capOf(r);
      if (band !== lastBand) {
        const cap = document.createElement('li');
        cap.className = 'band-cap';
        cap.textContent = band;
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
        // 착용 표시는 행의 바탕색(li.equipped)이 한다. 여기 동그라미를 두면 누를 수 있어
        // 보이는데 실제로는 안 눌려서, 착용을 정하는 자리가 어디인지 더 헷갈린다.
        // 이름 쪽에는 게임 계열 배지, 스탯 쪽에는 앱 조작용 조정 칩을 둔다.
        `<button type="button" class="rname" data-detail="${r.name}">▸ ${r.name}</button>` +
        (glyphFamilyOf(r)
          ? `<span class="badge glyph ${GLYPH_CLASS[glyphFamilyOf(r)]}" title="룬문장 색으로 갈리는 계열입니다. 일부 룬이 이 개수를 조건으로 씁니다">${glyphFamilyOf(r)}</span>`
          : '') +
        (contentOf(r) ? `<span class="badge content-tag">${contentOf(r)}</span>` : '') +
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

/* 한 세트를 부위별로 늘어놓는다. 좌우가 같은 모양이어야 눈으로 줄을 맞춰 볼 수 있다.
 * 빈 칸도 자리를 남긴다 — 안 그리면 오른쪽이 한 줄 위로 올라가 서로 다른 부위가 나란히 선다. */
/**
 * 이 세트의 룬 하나를 다른 룬으로 바꿨을 때 **점수가 오르는** 후보들.
 *
 * 룬마다 최대 3개. 오르는 것만 낸다 — 내려가는 후보를 같이 보여주면 무엇을 눌러야 하는지
 * 다시 생각해야 하고, 이 목록의 용건은 "여기서 뭘 바꾸면 좋아지나" 하나다.
 * 그래서 **0개일 수 있다.** 그건 그 자리가 이미 최선이라는 뜻이라 비워두는 것이 맞다.
 *
 * 부위가 같고, 이미 낀 것이 아니고, 바꾼 뒤에도 장착 규칙을 지키는 것만 본다.
 */
function betterSwaps(set, profile, baseScore) {
  const byRune = {}, bySlot = {};
  const cands = effectiveCandidates();
  // 눈에 안 보이는 이득은 이득이 아니다. 부동소수 찌꺼기로 '+0.00%' 가 뜨는 것을 막는다.
  const better = (next) => {
    if (!validateRuneSet(next).valid) return null;
    const s = evaluate(RUNES, next, state.scenario, profile).score;
    return s > baseScore * 1.00005 ? s / baseScore - 1 : null;
  };
  const top3 = (rows) => rows.sort((a, b) => b.gain - a.gain).slice(0, 3);

  // 낀 룬을 바꾸는 후보
  for (const n of set) {
    const sl = slotOf(n);
    if (!sl) continue;
    const rows = [];
    for (const c of cands) {
      if (slotOf(c) !== sl || set.includes(c)) continue;
      const gain = better(set.map((x) => (x === n ? c : x)));
      if (gain !== null) rows.push({ to: c, gain });
    }
    if (rows.length) byRune[n] = top3(rows);
  }

  /* 빈 칸을 채우는 후보. 교체와 성격이 달라 따로 센다 — 여기서는 빼는 룬이 없다.
   * 자리가 남았는데도 안 채우는 사람이 있어서(그 부위에 뭘 넣어야 할지 몰라서),
   * 빈 칸에 아무것도 안 뜨면 그 자리는 영영 비어 있게 된다. */
  for (const sl of SLOT_ORDER) {
    if (set.filter((n) => slotOf(n) === sl).length >= SLOT_CAPACITY[sl]) continue;
    const rows = [];
    for (const c of cands) {
      if (slotOf(c) !== sl || set.includes(c)) continue;
      const gain = better([...set, c]);
      if (gain !== null) rows.push({ to: c, gain });
    }
    if (rows.length) bySlot[sl] = top3(rows);
  }
  return { byRune, bySlot };
}

/**
 * 미계산 목록을 「보정한 것」과 「아직 안 센 것」으로 가른다.
 *
 * 사용자가 값을 넣은 룬은 더 이상 미계산이 아니다. 그대로 두면 '이미 반영했는데 왜 아직
 * 미계산이지?' 하고 두 번 넣게 된다.
 *
 * **두 패널이 같은 함수를 쓴다.** 예전에는 이 규칙이 현재 세팅 쪽에만 있어서, 공허의
 * 쿨감을 보정해도 실험군에서는 여전히 「미계산」으로 떴다 — 같은 룬이 왼쪽에서는 보정됨,
 * 오른쪽에서는 미계산이었다.
 */
function splitCorrected(rows) {
  const corrected = [], uncounted = [];
  const cd = state.profile.cooldownRuneDamagePercent;
  const cdOn = Number.isFinite(cd) && cd > 0;
  const isCooldown = (n) => !!(COOLDOWN_RUNES[n] ?? COOLDOWN_RUNES[baseName(n)]);
  for (const r of rows) {
    const ov = r.rune ? state.overrides[r.rune]?.utility : undefined;
    if (Number.isFinite(ov) && ov !== 0) { corrected.push({ ...r, applied: ov }); continue; }
    /* 쿨감 룬의 유틸 효과는 룬별 칸이 아니라 **세트 단위 칸**이 센다. 값을 넣었는데도
     * 「미계산」 에 남겨두면 이미 반영한 것을 또 넣게 된다 — 이 목록이 막으려는 것이
     * 정확히 그것이다. 다만 세트에 한 번만 붙으므로 문구를 달리해야 한다(viaSet). */
    if (cdOn && r.kind === '유틸' && r.rune && isCooldown(r.rune)) {
      corrected.push({ ...r, applied: cd, viaSet: true });
      continue;
    }
    uncounted.push(r);
  }
  return { corrected, uncounted };
}

/** 보정 문구. 세트 단위로 한 번 붙는 것은 룬별 보정과 달리 읽혀야 한다 —
 *  쿨감 룬 둘을 끼면 같은 문장이 두 줄에 뜨는데, 합쳐서 두 배가 되는 것이 아니다. */
function appliedText(r) {
  return r.viaSet
    ? ` <span class="applied">→ 「쿨감 룬 기여」 ${r.applied}% 로 셉니다 (세트에 한 번)</span>`
    : ` <span class="applied">→ 최종 데미지 ${r.applied > 0 ? '+' : ''}${r.applied}% 로 보정함</span>`;
}

/** @returns {number} 이번에 그린 칩 수. 호출한 쪽이 "하나도 없음" 과 "일부 있음" 을 가른다.
 *  함수 속성에 남기면 안 된다 — 이 함수는 패널마다 불리고, 나중에 부른 쪽이 앞 값을 덮는다. */
function renderSetList(host, names, { origin = 'equipped', swaps = null } = {}) {
  let chipCount = 0;
  const bySlot = {};
  for (const sl of SLOT_ORDER) bySlot[sl] = [];
  for (const n of names) { const sl = slotOf(n); if (sl) bySlot[sl].push(n); }
  host.innerHTML = SLOT_ORDER.map((sl) => {
    const worn = bySlot[sl];
    const cells = [];
    for (let i = 0; i < SLOT_CAPACITY[sl]; i++) {
      const n = worn[i];
      /* 좋아지는 후보. 낀 룬에는 '바꾸기', 빈 칸에는 '넣기' 다.
       * 없으면 아무것도 안 그린다 — "없음" 이라고 적으면 줄만 늘어나고, 없다는 것은
       * 칩이 없는 것으로 이미 보인다.
       *
       * 빈 칸이 둘 이상인 부위에서는 **첫 칸에만** 붙인다. 같은 후보를 칸마다 되풀이하면
       * 방어구에서 같은 칩이 세 번 뜬다 — 넣는 자리는 어차피 아무 빈 칸이나 같다. */
      const chips = n ? (swaps?.byRune?.[n] ?? [])
        : (worn.length === i ? (swaps?.bySlot?.[sl] ?? []) : []);
      chipCount += chips.length;
      const alt = chips.map((r) =>
        `<button type="button" class="swap" ${n ? `data-swap-out="${n}" ` : ''}data-swap-in="${r.to}" ` +
        `title="${n ? `${n} 를 ${r.to} 로 바꿉니다` : `${r.to} 를 빈 칸에 넣습니다`}">${r.to}<b>${fmtPct(r.gain)}</b></button>`).join('');
      cells.push(n
        ? `<li><button type="button" class="rname inline" data-detail="${n}" data-set="${origin}">▸ ${n}</button>` +
          (glyphFamilyOf(runeByName(n) ?? { name: n })
            ? `<span class="badge glyph ${GLYPH_CLASS[glyphFamilyOf(runeByName(n))]}">${glyphFamilyOf(runeByName(n))}</span>` : '') +
          (alt ? `<div class="swaps">${alt}</div>` : '') +
          '</li>'
        : `<li class="empty">비어 있음${alt ? `<div class="swaps">${alt}</div>` : ''}</li>`);
    }
    return `<div class="setslot"><h4>${sl}</h4><ul>${cells.join('')}</ul></div>`;
  }).join('');
  return chipCount;
}

/** 점수 한 줄. 기준이 있으면 그 대비 몇 %인지 같이 낸다. */
function scoreLine(score, baseline) {
  const num = `<b>${Math.round(score).toLocaleString()}</b>`;
  if (!Number.isFinite(baseline) || baseline <= 0) return num;
  const gain = score / baseline - 1;
  const cls = gain > 0.00005 ? 'up' : gain < -0.00005 ? 'down' : '';
  return `${num}<span class="delta ${cls}">현재 대비 ${fmtPct(gain)}</span>`;
}

/** 후보가 몇 개인지 ② 에서 바로 보이게 한다. 팝업 안에만 있으면 열기 전엔 알 수 없다. */
/* 샘플이 들어 있다는 것을 화면에 밝힌다. 채우는 것은 괜찮지만 감추면 안 된다 —
 * 남의 숫자로 나온 결과를 자기 것으로 읽게 된다. */
function renderSampleNote() {
  const el = document.querySelector('#sample-note');
  el.hidden = !state.usingSample;
  el.innerHTML = '처음 여신 화면이라 <b>' + state.job + ' 샘플값</b>이 채워져 있습니다 — '
    + '<b>내 스탯창 값으로 바꿔주세요.</b> 한 칸이라도 고치면 이 안내는 사라집니다. '
    + '(위의 <b>스샷으로 채우기</b>가 가장 빠릅니다)';
}

function renderCandStatus() {
  const el = document.querySelector('#cand-status');
  const total = USABLE.length;
  const on = effectiveCandidates().length;
  el.innerHTML = on
    ? `추천 후보 <b>${on}</b> / ${total}개 — <b>④ 추천</b>은 이 안에서만 나옵니다.`
    : '<b class="warn-inline">추천 후보가 없습니다.</b> 「후보 룬 설정」에서 가진 룬을 체크하거나 <b>전체 선택</b>을 눌러 주세요.';
}

function renderEquipStatus() {
  // 비어 있는 칸이 있으면 설정 버튼이 천천히 깜빡인다.
  document.querySelector('#open-equip').classList.toggle('needs-fill', !equipSlotsFull());
  const el = document.querySelector('#equip-status');
  const bySlot = equippedBySlot();
  const total = state.equipped.length;
  if (!total) {
    el.className = 'note warn-note';
    el.innerHTML = '⚠ <b>착용 룬이 비어 있습니다.</b> 위의 <b>착용 룬 설정</b>에서 지금 끼고 있는 룬을 지정해 주세요. '
      + '추천은 이 구성을 기준으로 계산됩니다 — 비워두면 「현재 대비」가 실제보다 크게 나옵니다.';
    return;
  }
  el.className = 'note';
  // 계열 수를 같이 보여준다. 여러 룬이 "용 2개 이상", "각각 2개 이상" 을 조건으로 쓰는데,
  // 지금 몇 개인지 볼 자리가 없으면 그 룬이 왜 약하게 나오는지 알 수 없다.
  const fam = familyCounts(state.equipped);
  el.innerHTML = '착용: ' + SLOT_ORDER.map((s) =>
    `${s} <b class="${bySlot[s].length === SLOT_CAPACITY[s] ? 'ok' : 'warn'}">${bySlot[s].length}/${SLOT_CAPACITY[s]}</b>`).join(' · ')
    + ' <span class="muted">|</span> 계열: '
    + FAMILIES.map((f) => `<b class="${fam[f] ? 'ok' : 'muted'}">${f} ${fam[f]}</b>`).join(' · ');
}

/** 룬 상세: 설명 전문 + 이 앱이 어떻게 계산하는지 + 계산에 안 들어간 것 */
/* 시간에 따라 켜졌다 꺼지는 계열의 '지금 이 세트에서의 사이클'.
 *
 * 룬 하나만 보면 "침식 부여 중 16.5%, 100 이상이면 2배" 같은 툴팁만 보인다. 정작 궁금한
 * 것은 **그래서 지금 몇 %로 잡혔나** 이고, 그 답은 세트 전체(침식 룬 수·오염 감소 룬·
 * 직업 트리거 주기)가 정한다. 룬 상세에 그 계산을 같이 띄운다.
 *
 * 어느 세트 기준인지는 상세창을 연 자리가 정한다(detailOrigin) — 실험군에서 열었으면
 * 실험군 구성으로 잰다. 안 그러면 왼쪽 숫자를 보며 오른쪽을 고치게 된다.
 */
function timelineHtml(r, set, profile) {
  const n = baseName(r.name);
  const rows = [];

  // ── 침식 ──────────────────────────────────────────────
  const eroCount = set.filter((x) => EROSION_RUNES.includes(baseName(x))).length;
  const polRed = set.reduce((sum, x) => sum + (POLLUTION_REDUCTION[x] ?? POLLUTION_REDUCTION[baseName(x)] ?? 0), 0);
  if (EROSION_RUNES.includes(n) || POLLUTION_REDUCTION[n] !== undefined) {
    const { ratePerRunePerSecond: rate, pollutionSeconds, boostThreshold, pollutionThreshold } = EROSION_SYSTEM;
    const r2 = rate * Math.max(1, eroCount);
    const pol = pollutionSeconds * (1 - polRed / 100);
    const t1 = boostThreshold / r2, t2 = (pollutionThreshold - boostThreshold) / r2;
    rows.push(['침식 사이클',
      `${(t1 + t2 + pol).toFixed(1)}초 주기`,
      `침식 룬 ${eroCount}개 → 초당 ${r2} · ` +
      `0→${boostThreshold} ${t1.toFixed(1)}초(기본) · ${boostThreshold}→${pollutionThreshold} ${t2.toFixed(1)}초(2배) · ` +
      `오염 ${pol.toFixed(1)}초(0)` + (polRed ? ` · 오염 감소 ${polRed}%` : '')]);
    rows.push(['침식이 켜져 있는 비중',
      `${((t1 + t2) / (t1 + t2 + pol) * 100).toFixed(1)}%`,
      '나머지 시간은 오염이라 침식 옵션이 0 이다']);
  }

  // ── 밤의 축복 ─────────────────────────────────────────
  const awakened = set.filter((x) => AWAKENING_RUNES.includes(baseName(x)));
  if (AWAKENING_RUNES.includes(n)) {
    const cyc = effectiveNightBlessingCycle(profile, state.job);
    rows.push(['밤의 축복 주기', `${cyc}초마다 ${NIGHT_BLESSING.durationSeconds}초`,
      `쿨 ${NIGHT_BLESSING.cooldownSeconds}초 · 직업 트리거 간격으로 올림한 값 ` +
      `(직접 잰 값이 있으면 ② 캐릭터의 입력이 우선)`]);
    rows.push(['시간 비중', `${(NIGHT_BLESSING.durationSeconds / cyc * 100).toFixed(1)}%`,
      '점수는 ON 구간과 OFF 구간을 이 비중으로 가중 평균한 값이다. ' +
      '시간 비중이 아니라 딜 비중은 ③ 의 「계수 · 중간값」에 따로 있다']);
    if (awakened.length > 1) {
      rows.push(['⚠ 각성 룬 중복', `${awakened.length}개`, `${awakened.join(', ')} — 동시에 ${MAX_AWAKENING}개만 발동한다`]);
    }
  }

  // ── 용의 문장 ─────────────────────────────────────────
  const dragonAll = [...DRAGON_SIGIL.enablers, ...DRAGON_SIGIL.extenders, ...DRAGON_SIGIL.consumers];
  if (dragonAll.includes(n)) {
    const up = dragonSigilUptime(set);
    const has = (list) => list.filter((x) => set.some((y) => baseName(y) === x));
    rows.push(['용의 문장 가동률', `${(up * 100).toFixed(0)}%`,
      `발동 ${has(DRAGON_SIGIL.enablers).join(', ') || '없음'} · ` +
      `연장 ${has(DRAGON_SIGIL.extenders).join(', ') || '없음'} · ` +
      `소비 ${has(DRAGON_SIGIL.consumers).join(', ') || '없음'}`]);
    if (up === 0) rows.push(['⚠ 켜지지 않는다', '0%', '발동 룬이 세트에 없으면 연장·소비 룬은 값이 0 이다']);
  }

  if (!rows.length) return '';
  const who = detailOrigin === 'trial' ? '실험군' : '현재 세팅';
  return `<div class="d-head">시간 흐름 <span class="muted">${who} 기준</span></div>` +
    `<div class="derived">${rows.map(([k, v, note]) =>
      `<div class="drow"><span>${k}</span><b>${v}</b><em>${note}</em></div>`).join('')}</div>`;
}

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
      : e.expectedFrom === 'erosion' || e.expectedFrom === 'erosionWindow' ? '침식 사이클 계산'
      : e.expectedFrom === 'hitTrigger' ? '적중 트리거 계산'
      // 트리거를 먼저 본다. 계열 값을 천장으로 쓰면서 트리거가 붙는 항목(작열)이 있는데,
      // expectedFrom 을 먼저 보면 '계열 구성으로 확정' 이라고 적어 조건을 감춘다.
      : e.trigger === 'dragonSigil' ? '용의 문장 가동률'
      : e.trigger === 'nightBlessing' ? '밤의 축복 ON 구간에만'
      : e.trigger === 'basicAttack' ? '기본 공격을 섞을 때만'
      : e.expectedFrom === 'familySteps' ? '계열 구성으로 확정'
      : e.expectedFrom === 'statSteps' ? '스탯창 수치 비례'
      : e.uptimeFrom ? '트리거 확률로 가동률 계산'
      : e.basis === 'playstyle' ? '가정값' : '계산값';
    how.push(`${e.label} ${range} <span class="tag">${basis}</span>${e.note ? `<div class="d-note">${e.note}</div>` : ''}`);
  }
  if (POLLUTION_REDUCTION[r.name] !== undefined) {
    how.push(`오염 지속시간 <b>${POLLUTION_REDUCTION[r.name]}%</b> 감소 → 같은 세트의 침식 룬 기대값이 올라갑니다 ` +
      `<span class="tag">침식 사이클 계산</span>`);
  }
  const isCooldownRune = !!(COOLDOWN_RUNES[r.name] ?? COOLDOWN_RUNES[baseName(r.name)]);
  if (isCooldownRune) {
    /* 값을 여기 또 적지 않는다. 「지금 N%」 를 같이 띄웠더니 값이 룬 안에 있는 것처럼 읽혔다 —
     * 실제로 그렇게 오해한 적이 있다. 값은 전투 상황 칸 하나가 갖고, 여기서는 어디서 정하는지만
     * 말한다. 같은 수를 두 곳에 적으면 한쪽은 반드시 낡는다. */
    how.push(`쿨감 룬입니다 — 값은 <b>② 캐릭터</b>의 전투 상황에서 「쿨감 룬 기여」로 정합니다. ` +
      `쿨감 룬을 둘 껴도 <b>한 번만</b> 붙습니다. <span class="tag">사람이 정함</span>`);
  }

  // ── 사용자가 직접 조정하는 가정들
  const ov = state.overrides[r.name] ?? {};
  const tweaks = [];
  const hasUtilSlot = !isCooldownRune && uncountedOf(r).some((u) => u.kind === '유틸');
  if (hasUtilSlot) {
    const cur = Number.isFinite(ov.utility) ? ov.utility : 0;
    tweaks.push(`<label class="tweak"><span>기타 효과를 최종 데미지 %로 보정</span>` +
      `<input type="number" step="0.1" data-ov="utility" data-rune="${r.name}" value="${cur}" />` +
      `<em>쿨감·속도처럼 데미지 공식 밖에 있지만 DPS 에는 기여하는 효과를 한 값으로 환산합니다. ` +
      `최종 점수에 곱해지며, 0이면 무시합니다.</em></label>`);
  }
  if (modeled) for (const e of modeled) {
    /* 조정 칸은 두 종류다. 둘이 묻는 것이 다르므로 한 항목에 둘 다 뜨지 않는다.
     *
     *   발동율  — "이 상황에 얼마나 있느냐" 를 %로. 천장을 몰라도 답할 수 있다.
     *   기대값  — 그 항목의 값을 직접 지정. 천장을 알아야 답할 수 있어 마지막 수단이다.
     *
     * 발동율을 먼저 만든 이유가 이것이다. "마력의 원 위에 얼마나 서 있나" 는 답할 수 있어도
     * "그래서 공격력 몇 %냐" 는 3중첩이 12% 라는 걸 알아야 답할 수 있다. */
    if (e.rateAdjustable) {
      /* 같은 조건이 여러 항목을 켜는 룬이 있다(부서진 왕관 — 마력의 원 위에 서 있으면
       * 공격력과 강타 피해가 함께 붙는다). 항목마다 칸을 띄우면 같은 질문을 두 번 하게
       * 되고, 한쪽만 고치면 한 몸인 값이 따로 움직여 있을 수 없는 상태가 된다.
       * 그래서 **묻는 것(rateLabel)이 같으면 칸도 하나**다. 저장은 항목별로 하되 함께 쓴다. */
      const group = modeled.filter((x) => x.rateAdjustable && x.rateLabel === e.rateLabel);
      if (group[0] !== e) continue;
      const ids = group.map((x) => x.id);
      const cur = Number.isFinite(ov.rate?.[e.id]) ? ov.rate[e.id] : 100;
      const what = group.map((x) => x.label).join(' · ');
      tweaks.push(`<label class="tweak"><span>${what} 발동율</span>` +
        `<input type="number" step="1" min="0" max="100" data-ov="rate" data-cond-id="${ids.join(',')}" data-rune="${r.name}" value="${cur}" />` +
        `<em>${e.rateLabel} — 0~100%. 이 비율만큼만 계산에 들어갑니다(100 이면 상시, 0 이면 없는 것과 같음).</em></label>`);
      continue;
    }
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
  parts.push(timelineHtml(r, originSet(), profileFor()));

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

/* ── 착용 룬 설정 ────────────────────────────────────────
 *
 * 착용을 정하는 자리를 여기 하나로 모은다. 예전에는 룬 55개짜리 목록에서 ☑(가진 룬)과
 * ●(낀 룬)을 같은 줄에서 골라야 했는데, 성격이 다른 두 가지라 헷갈렸고 방어구 5칸을
 * 채우려면 긴 목록을 계속 훑어야 했다.
 *
 * 후보로 거르지 않고 **그 부위의 룬을 전부** 보여준다 — "이걸 얻으면 어떻게 되지" 가
 * 충분히 그럴듯한 물음이라서다. 대신 「착용만 보기」로 접을 수 있다.
 *
 * 장신구는 뺐다. 9개 전부 스킬 변형 전용이라 점수에 걸리는 항목이 하나도 없다.
 */
const EQUIP_SLOTS = ['무기', '방어구', '엠블럼'];

/** 착용 칸이 다 찼는가. 장신구는 뺀다 — 9개 전부 스킬 변형 전용이라 점수에 안 걸린다.
 *  EQUIP_SLOTS 바로 아래에 둔다. 위에 두면 초기화 순서에 기대는 코드가 되고,
 *  이 저장소는 그 방식으로 한 번 터진 적이 있다. */
const equipSlotsFull = () => {
  const by = equippedBySlot();
  return EQUIP_SLOTS.every((sl) => by[sl].length >= SLOT_CAPACITY[sl]);
};
const equipModal = () => document.querySelector('#equip-modal');
// 팝업은 **초안**을 만지고 저장할 때만 반영한다. 즉시 반영하면 취소할 방법이 없고,
// 여러 칸을 갈아끼우는 동안 뒤쪽 점수가 계속 흔들려 무엇과 견주는 중인지 알기 어렵다.
/* 룬 상세창이 어느 세트에서 열렸는가. 상세창의 착용·교체 버튼이 이 값을 따른다.
 * 없으면 실험군에서 룬을 눌러 바꿔도 현재 세팅이 바뀐다 — 실제로 그렇게 났다. */
let detailOrigin = 'equipped';
/** 상세창이 만지는 세트. 실험군이면 손대기 전 사본을 만들어 준다. */
const originSet = () => (detailOrigin === 'trial' ? trialSet() : [...state.equipped]);
const writeOriginSet = (next) => {
  if (detailOrigin === 'trial') state.trial = next;
  else state.equipped = next;
};
const equipState = { slot: '무기', replace: null, onlyCandidates: false, draft: null, target: 'equipped' };

/** 실험군의 실제 구성. 손대기 전에는 현재를 따라간다. */
const trialSet = () => (Array.isArray(state.trial) ? state.trial : [...state.equipped]);
/** 실험군이 현재와 다른가. 같으면 비교할 것이 없어 화면 문구가 달라진다. */
const trialTouched = () => Array.isArray(state.trial) && state.trial.join('|') !== state.equipped.join('|');

function openEquipModal({ slot, replace = null, target = 'equipped' } = {}) {
  equipState.slot = slot ?? equipState.slot ?? '무기';
  equipState.replace = replace;
  equipState.target = target;
  equipState.draft = target === 'trial' ? trialSet() : [...state.equipped];
  renderEquipModal();
  const d = equipModal();
  if (!d.open) d.showModal();
}

/** 초안을 실제 착용으로 옮긴다. 직전 구성은 여기서 한 번만 잡는다 — 편집 한 번이 한 단위다. */
function saveEquipDraft() {
  const next = equipState.draft;
  const target = equipState.target ?? 'equipped';
  equipModal().close();
  if (!Array.isArray(next)) return;
  if (target === 'trial') {
    // 실험군은 현재를 안 건드린다 — 되돌릴 것이 없으므로 직전 구성도 잡지 않는다.
    state.trial = next;
    save(); renderAll();
    return;
  }
  if (next.join('|') === state.equipped.join('|')) return;
  state.equipped = next;
  // 껴본 룬은 후보에도 넣는다. 안 그러면 착용 중인데 추천에서는 없는 셈이 되어
  // '현재 대비' 가 엉뚱해진다.
  const add = next.filter((n) => !state.candidates.includes(n));
  if (add.length) state.candidates = [...state.candidates, ...add];
  save(); renderAll();
}

function renderEquipModal() {
  const draft = equipState.draft ?? [];
  const bySlot = Object.fromEntries(EQUIP_SLOTS.map((s) => [s, draft.filter((n) => slotOf(n) === s)]));
  const who = equipState.target === 'trial' ? '실험군' : '현재 세팅';
  document.querySelector('#equip-title').textContent = equipState.replace
    ? `${who} — 「${equipState.replace}」 를 무엇으로 바꿀까요?`
    : `${who} 룬 고르기`;

  document.querySelector('#equip-tabs').innerHTML = EQUIP_SLOTS.map((s) =>
    `<button type="button" class="equip-tab ${s === equipState.slot ? 'on' : ''}" data-slot="${s}"` +
    `${equipState.replace ? ' disabled' : ''}>${s} <b>${bySlot[s].length}/${SLOT_CAPACITY[s]}</b></button>`).join('');

  /* 계열 개수는 초안 기준이다. 저장 전에도 누를 때마다 움직여야, 조건이 열리는지
   * 눌러보며 확인할 수 있다. 게이트를 쓰는 룬을 실제로 낀 경우에만 문턱을 같이 적는다 —
   * 안 그러면 아무 상관 없는 사람에게 "2개 이상" 이 계속 떠 있다. */
  const fam = familyCounts(draft);
  // 문턱은 낀 룬 것만 적는다. 안 그러면 상관없는 사람에게 "2개 이상" 이 계속 떠 있다.
  // 채웠는지 못 채웠는지를 같이 보여주는 것이 요점이다 — 개수만으로는 암산을 시킨다.
  const gates = draft.map((n) => [n, FAMILY_GATES[baseName(n)]]).filter(([, req]) => req)
    .map(([n, req]) => {
      const met = Object.entries(req).every(([f, k]) => (fam[f] ?? 0) >= k);
      const need = Object.entries(req).map(([f, k]) => `${f} ${k}`).join(' · ');
      return `<span class="fam-gate ${met ? 'met' : 'unmet'}">${met ? '✓' : '✗'} ${n} — ${need} 이상</span>`;
    });
  document.querySelector('#equip-families').innerHTML =
    '<span class="fam-label">계열</span>' + FAMILIES.map((f) =>
      `<span class="badge glyph ${GLYPH_CLASS[f]} ${fam[f] ? '' : 'zero'}">${f} ${fam[f]}</span>`).join('')
    + gates.join('');

  const slot = equipState.slot;
  const full = bySlot[slot].length >= SLOT_CAPACITY[slot];
  const all = USABLE.filter((r) => r.slot === slot);
  // 「후보 룬만 보기」 — 후보는 '내가 가진 룬' 이라는 뜻이다. 기본은 전부 보여준다.
  // 안 가진 룬이라도 "이걸 얻으면 어떻게 되지" 는 충분히 그럴듯한 물음이라서다.
  const list = all
    .filter((r) => !equipState.onlyCandidates || state.candidates.includes(r.name) || draft.includes(r.name))
    .sort((a, b) => Number(draft.includes(b.name)) - Number(draft.includes(a.name))
      || a.name.localeCompare(b.name, 'ko'));

  document.querySelector('#equip-picker').innerHTML = list.length
    ? list.map((r) => {
      /* 바꿀 룬은 '고른 것' 이 아니다. 초안에는 아직 남아 있어 초록으로 칠해지는데,
       * 그러면 "이미 이걸 골랐다" 로 읽혀 뭘 눌러야 할지 알 수 없다.
       * 지금 바꾸려는 그 룬만 따로 표시한다. */
      const replacing = equipState.replace === r.name;
      const on = !replacing && draft.includes(r.name);
      const cand = state.candidates.includes(r.name);
      // 칸이 찼는데 안 낀 룬은 누를 수 없다. 무엇을 뺄지는 사람이 정해야 한다 —
      // 임의로 하나를 밀어내면 방어구 5칸에서는 어느 것이 빠졌는지 알 수가 없다.
      const blocked = !on && full && SLOT_CAPACITY[slot] > 1 && !equipState.replace;
      // 목록과 같은 태그를 여기에도 단다. 룬을 실제로 고르는 자리가 여기라서,
      // 계열이 몇 개인지·어느 콘텐츠 룬인지를 목록으로 돌아가 확인해야 했다.
      // 조건부·페널티 딱지는 뺐다 — 칸이 좁아 다 넣으면 이름이 밀린다.
      const tags = (glyphFamilyOf(r)
        ? `<span class="badge glyph ${GLYPH_CLASS[glyphFamilyOf(r)]}">${glyphFamilyOf(r)}</span>` : '')
        + (contentOf(r) ? `<span class="badge content-tag">${contentOf(r)}</span>` : '')
        + badges(r).map(([t, c]) => `<span class="badge fam ${c}">${t}</span>`).join('');
      return `<button type="button" class="equip-pick ${on ? 'on' : ''} ${replacing ? 'replacing' : ''} ${cand ? '' : 'dim'}"` +
        ` data-rune="${r.name}"${blocked ? ' disabled' : ''}` +
        ` title="${replacing ? '지금 바꾸려는 룬입니다' : cand ? '' : '후보에 없는 룬입니다 — 저장하면 후보에도 들어갑니다'}">` +
        `<span class="ep-name">${replacing ? '↺ ' : ''}${r.name}</span>` +
        (tags ? `<span class="ep-tags">${tags}</span>` : '') + '</button>';
    }).join('')
    : `<p class="note">${equipState.onlyCandidates ? '이 부위에 후보로 고른 룬이 없습니다.' : '보여줄 룬이 없습니다.'}</p>`;

  const notes = [];
  if (equipState.replace) notes.push('바꿀 룬을 하나 고르면 교체합니다. <b>저장</b>을 눌러야 반영됩니다.');
  else if (full && SLOT_CAPACITY[slot] > 1) notes.push(`${slot}가 ${SLOT_CAPACITY[slot]}칸을 다 썼습니다. 먼저 하나를 눌러 빼주세요.`);
  else if (SLOT_CAPACITY[slot] === 1) notes.push('한 칸짜리 부위라 다른 룬을 누르면 그대로 교체됩니다.');
  const v = validateRuneSet(draft);
  if (!v.valid) notes.push(`<b class="warn-inline">${v.reason}</b>`);
  document.querySelector('#equip-note').innerHTML = notes.join(' ');
  document.querySelector('#equip-only').checked = equipState.onlyCandidates;
  // 여러 칸짜리 부위에서만 쓸모가 있다. 한 칸짜리는 다른 룬을 누르면 그냥 바뀐다.
  const clearBtn = document.querySelector('#equip-clear-slot');
  clearBtn.hidden = SLOT_CAPACITY[slot] <= 1 || !bySlot[slot].length || !!equipState.replace;
  clearBtn.textContent = `${slot} 비우기`;
  const baseSet = equipState.target === 'trial' ? trialSet() : state.equipped;
  document.querySelector('#equip-save').disabled = draft.join('|') === baseSet.join('|');
}

/** 팝업에서 룬 하나를 눌렀을 때. 초안만 바꾼다 — 저장 전에는 아무것도 반영되지 않는다. */
function pickEquip(name) {
  const r = runeByName(name);
  if (!r) return;
  const slot = r.slot;
  const draft = equipState.draft ?? [];
  const worn = draft.filter((n) => slotOf(n) === slot);

  if (equipState.replace) {
    equipState.draft = draft.map((n) => (n === equipState.replace ? name : n));
    equipState.replace = null;
  } else if (draft.includes(name)) {
    equipState.draft = draft.filter((n) => n !== name);
  } else if (SLOT_CAPACITY[slot] === 1 && worn.length) {
    // 한 칸짜리는 밀어내는 대상이 하나뿐이라 헷갈릴 일이 없다.
    equipState.draft = draft.map((n) => (n === worn[0] ? name : n));
  } else {
    if (worn.length >= SLOT_CAPACITY[slot]) return;
    equipState.draft = [...draft, name];
  }
  renderEquipModal();
}

document.querySelector('#open-equip').addEventListener('click', () => openEquipModal({}));
document.querySelector('#open-trial').addEventListener('click', () => openEquipModal({ target: 'trial' }));

/* 실험군을 현재 세팅에 반영한다. 올리고 나면 실험군은 다시 현재를 따라가야 한다 —
 * 사본을 남겨두면 좌우가 같은데 '실험 중' 으로 보인다. */
document.querySelector('#promote-trial').addEventListener('click', () => {
  const next = trialSet();
  if (!validateRuneSet(next).valid) return;
  state.equipped = next;
  state.trial = null;
  const add = next.filter((n) => !state.candidates.includes(n));
  if (add.length) state.candidates = [...state.candidates, ...add];
  save(); renderAll();
});
document.querySelector('#toggle-swaps').addEventListener('click', () => {
  state.showSwaps = !state.showSwaps;
  save(); renderAll();
});
document.querySelector('#reset-trial').addEventListener('click', () => {
  state.trial = null; save(); renderAll();
});
// 후보 룬 팝업. 목록이 90줄이라 본문에 두면 다른 것이 다 밀린다.
document.querySelector('#open-cand').addEventListener('click', () => {
  const d = document.querySelector('#cand-modal');
  renderRunes();
  if (!d.open) d.showModal();
});
document.querySelector('#cand-close').addEventListener('click', () => document.querySelector('#cand-modal').close());
// 결과가 막혔을 때 그 자리에서 바로 고치러 갈 수 있게 한다.
document.addEventListener('click', (e) => {
  if (e.target.closest('#fix-equip')) openEquipModal({});
});
document.querySelector('#equip-clear-slot').addEventListener('click', () => {
  equipState.draft = (equipState.draft ?? []).filter((n) => slotOf(n) !== equipState.slot);
  renderEquipModal();
});
document.querySelector('#equip-save').addEventListener('click', saveEquipDraft);
document.querySelector('#equip-cancel').addEventListener('click', () => equipModal().close());
// 상세창의 착용 조작. 개별 룬 하나를 만지는 것이므로 여기서 직전 구성을 잡는다.
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-equip-act]');
  if (!b) return;
  const name = modal()?.dataset.rune;
  if (!name) return;
  const act = b.dataset.equipAct;
  const target = detailOrigin;
  if (act === 'swap') { modal().close(); openEquipModal({ slot: slotOf(name), replace: name, target }); return; }
  if (act === 'open') { modal().close(); openEquipModal({ slot: slotOf(name), target }); return; }
  const cur = originSet();
  if (act === 'off') {
    writeOriginSet(cur.filter((n) => n !== name));
    save(); renderAll(); openRuneModal(name);
  } else if (act === 'on') {
    // 상세창은 룬 하나만 만지므로 즉시 반영한다. 팝업의 초안·저장과 달리 되돌릴 것이 없다.
    const slot = slotOf(name);
    const worn = cur.filter((n) => slotOf(n) === slot);
    writeOriginSet((SLOT_CAPACITY[slot] === 1 && worn.length)
      ? cur.map((n) => (n === worn[0] ? name : n))
      : [...cur, name]);
    if (!state.candidates.includes(name)) state.candidates = [...state.candidates, name];
    save(); renderAll(); openRuneModal(name);
  }
});
document.querySelector('#equip-only').addEventListener('change', (e) => {
  equipState.onlyCandidates = e.target.checked;
  renderEquipModal();
});
document.querySelector('#equip-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-slot]');
  if (!b || b.disabled) return;
  equipState.slot = b.dataset.slot;
  renderEquipModal();
});
document.querySelector('#equip-picker').addEventListener('click', (e) => {
  const b = e.target.closest('[data-rune]');
  if (b && !b.disabled) pickEquip(b.dataset.rune);
});
// ESC 나 배경 클릭으로 닫는 것도 '취소' 다. 초안은 버린다 — 저장은 저장 버튼만 한다.
equipModal().addEventListener('close', () => { equipState.replace = null; equipState.draft = null; });

const modal = () => document.querySelector('#rune-modal');

function openRuneModal(name) {
  const r = runeByName(name);
  if (!r) return;
  document.querySelector('#modal-title').innerHTML =
    `${r.name} <span class="muted">${r.slot} · ${r.grade}</span>`;
  document.querySelector('#modal-body').innerHTML = runeDetailHtml(r);
  // 목록에서 룬을 찾아 체크박스를 누르는 대신 이 창에서 바로 후보를 넣고 뺀다.
  // 착용 관련 조작. 목록의 ● 를 표시 전용으로 바꿨으므로 여기가 개별 룬의 착용 창구다.
  /* 어느 세트를 만지는지 버튼 문구에 적는다. 창을 열 때 눌렀던 자리가 어디였는지는
   * 몇 초만 지나도 잊는다 — 여기 안 적으면 실험군에서 현재를 바꿔놓고도 모른다. */
  const who = detailOrigin === 'trial' ? '실험군' : '현재';
  const setNow = originSet();
  const on = setNow.includes(name);
  const room = setNow.filter((n) => slotOf(n) === r.slot).length < SLOT_CAPACITY[r.slot];
  const act = document.querySelector('#modal-equip');
  act.innerHTML = on
    ? `<button type="button" class="ghost" data-equip-act="swap">${who}에서 룬 바꾸기</button>` +
      `<button type="button" class="ghost" data-equip-act="off">${who}에서 빼기</button>`
    : (room || SLOT_CAPACITY[r.slot] === 1
      ? `<button type="button" class="ghost" data-equip-act="on">${who}에 넣기</button>`
      : `<button type="button" class="ghost" data-equip-act="open">${r.slot} 칸이 찼습니다 — ${who} 설정 열기</button>`);

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

/** 지금 착용이 규칙에 어긋나는 이유들. 두 곳(③ 룬 패널·④ 결과)이 같은 문장을 쓴다. */
function validationMessages() {
  const v = validateRuneSet(state.equipped);
  const bySlot = equippedBySlot();
  const msgs = v.valid ? [] : [v.reason];
  for (const s of SLOT_ORDER.filter((x) => bySlot[x].length > SLOT_CAPACITY[x])) {
    msgs.push(`${s} 슬롯 초과: ${bySlot[s].length}/${SLOT_CAPACITY[s]}`);
  }
  return msgs;
}

function renderValidation() {
  const el = document.querySelector('#validation');
  const msgs = validationMessages();
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
let pendingResultRender = null;

/**
 * 숫자를 연달아 입력하는 동안에는 최적 세트 탐색을 미룬다.
 *
 * renderResults 는 후보 전체를 다시 탐색하고 결과 DOM 도 통째로 만든다. 모바일에서 숫자
 * 한 자리마다 이 작업을 하면 다음 키 입력까지 막힌다. 화면과 메모리의 상태만 즉시 바꾸고,
 * 마지막 입력 뒤 잠깐 쉬었을 때 저장과 결과 갱신을 각각 한 번만 한다.
 */
function scheduleResultRender() {
  clearTimeout(pendingResultRender);
  pendingResultRender = setTimeout(() => {
    pendingResultRender = null;
    renderResults();
  }, INPUT_SETTLE_DELAY_MS);
}

function renderResults() {
  clearTimeout(pendingResultRender);
  pendingResultRender = null;
  try {
    renderResultsInner();
  } catch (e) {
    console.error('renderResults 실패:', e);
    // 시나리오 박스는 남겨둔다 — 총점까지 지우면 무엇이 살아 있고 무엇이 죽었는지 알 수 없다.
    const msg = '<div class="blocked">계산 중 오류가 생겨 이 부분을 그리지 못했습니다. ' +
      '<b>초기화</b> 후 다시 시도해 주시고, 계속되면 ' +
      '<a href="https://github.com/mobinogi-tools/rune-optimizer/issues/new" target="_blank" rel="noopener noreferrer">제보</a>해 주세요. ' +
      `(${e?.message ?? e})</div>`;
    const el = document.querySelector('#best-set');
    if (el) el.innerHTML = msg;
  }
}

/**
 * 계수·중간값 표. 현재 세팅과 실험군이 같은 함수를 쓴다.
 *
 * 실험군에는 계수 차이만 보여주다가 전체를 넣었다. "치확이 왜 이렇게 높지" 같은 물음은
 * 중간값 표를 봐야 답이 나오는데, 그게 한쪽에만 있으면 바꿔본 쪽은 확인할 방법이 없다.
 *
 * compareTo 가 있으면 달라진 계수에 표시를 단다.
 */
function renderCalcDetail({ ev, profile, factorsHost, derivedHost, scenarioHost, compareTo }) {
  const f = ev.factors;
  const nb = ev.factorsNightBlessing;
  factorsHost.innerHTML =
    [['A 깡공', Number.isFinite(state.measure.attackA) ? Math.round(state.measure.attackA).toLocaleString() : '미측정',
      Number.isFinite(state.measure.attackA) ? '측정값' : '계산에는 안 쓰입니다 — 두 조합의 비율에서 약분됩니다'],
     ['A×B 스탯창', Number.isFinite(state.measure.attackA)
       ? Math.floor(state.measure.attackA * f.B).toLocaleString() : '–', '⌊A×B⌋ · 실측 A 기준'],
     ['B 공증', f.B.toFixed(4)], ['C 피증', f.C.toFixed(4)], ['D 강화', f.D.toFixed(4)],
     ['E 젬', f.E.toFixed(4)], ['F 치명타', f.F.toFixed(4)], ['G 무방비', f.G.toFixed(4)],
     ['H 스킬배율', f.H.toFixed(4)], ['I 방어', f.I.toFixed(4)], ['J 카운터', f.J.toFixed(4)],
     ['K 추가타', f.K.toFixed(4)], ['L 최종뎀', f.L.toFixed(4)]]
      .map(([k, v, note]) => {
        // 비교 대상이 있으면 달라진 항만 눈에 띄게 한다. 열세 항을 그냥 두 번 그리면
        // 어디를 봐야 할지 알 수 없는데, 세트를 바꿔서 실제로 움직이는 항은 서너 개다.
        const key = k.split(' ')[0];
        const was = compareTo?.[key];
        const now = f[key];
        const moved = typeof was === 'number' && typeof now === 'number' && Math.abs(now - was) > 1e-9;
        const cmp = moved ? `<em class="${now > was ? 'up' : 'down'}">현재 ${was.toFixed(4)} → ×${(now / was).toFixed(4)}</em>` : '';
        return `<div class="${moved ? 'moved' : ''}"><span>${k}</span><b>${v}</b>${cmp || (note ? `<em>${note}</em>` : '')}</div>`;
      }).join('') +
    /* 공식 밖 몫(쿨감 룬 · 룬별 유틸 보정)은 점수에 곱한다 — L 에 넣으면 밤축의 최종
     * 데미지와 가산으로 섞여 실제보다 작게 들어간다. 표에 안 뜨므로 여기 한 줄로 밝힌다. */
    (ev.utilityPercent
      ? `<div><span>공식 밖 (쿨감·유틸)</span><b>×${(1 + ev.utilityPercent / 100).toFixed(4)}</b>` +
        `<em>점수에 곱합니다 — 항별 표에는 안 들어갑니다</em></div>` : '');

  // 중간 계산값 — 어떤 수치가 어디서 나왔는지 확인용
  const d = ev.deltas ?? {};
  // 룬 델타 + 아티팩트 몫을 합쳐 보여준다. 계산은 이미 둘 다 반영돼 있는데 표시만 룬 몫이면 오해를 부른다.
  const art = sumArtifacts(state.artifacts);
  const dv = (k) => (d[k] ?? 0) + (art[k] ?? 0);
  const hps = profile.hitsPerSecond ?? 0;
  const rockStacks = Math.min(30, hps * 10);
  const nbCycle = effectiveNightBlessingCycle(profile, state.job);
  // 전투 숙련 몫은 deltas 에 이미 합쳐져 있다. 어느 줄이 그 영향을 받았는지 꼬리말로 밝힌다.
  const mEff = masteryEffects(profile.combatMastery);
  const mNote = (field) => (mEff[field] ? ` · 전투 숙련 ${profile.combatMastery} ${mEff[field]}%` : '');

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
    ['치명타 확률', `${(ev.rates.critRate * 100).toFixed(2)}%`,
      `공식 ${(50 - 100 / (2 + profile.criticalStat / 1000)).toFixed(2)}% + 룬/아티 ${dv('critical.runeCriticalRatePercent').toFixed(1)}% + 직업 ${profile.characterCriticalRatePercent ?? 0}%`],
    ['치명타 배율', `${((1.4 + profile.criticalStat / 5000) * (1 + dv('critical.criticalDamagePercent') / 100)).toFixed(3)}배`,
      `(1.4 + 치명타/5000) × (1 + 치명타피해 ${dv('critical.criticalDamagePercent').toFixed(1)}%)` + mNote('critical.criticalDamagePercent')],
    ['추가타 확률', `${(ev.rates.extraRate * 100).toFixed(2)}%`,
      `(1 + 추가타/13000) × (1 + 룬·아티 ${dv('extraHit.runeExtraRatePercent').toFixed(1)}% + 직업 ${profile.characterExtraRatePercent ?? 0}%) − 1`],
    ['피증 합', `${(dv('damageIncrease.itemMainDamagePercent') + (profile.helioPercent ?? 0)).toFixed(1)}%`,
      `룬 ${(d['damageIncrease.itemMainDamagePercent'] ?? 0).toFixed(1)}% + 아티팩트 ${(art['damageIncrease.itemMainDamagePercent'] ?? 0).toFixed(1)}% + 헬리오 ${profile.helioPercent ?? 0}%`],
    // D 항 기여를 그대로 보여준다. 옵션 합계(연타 피해%)만 띄우면 옵션이 0 일 때
    // '강타 피해 0%' 로 보여서 강화 수치가 통째로 빠진 것처럼 읽힌다.
    enhRow('연타 기여', profile.rapidEnhance, profile.rapidRatePercent, profile.isRapid, 'enhancement.rapidDamagePercent'),
    enhRow('강타 기여', profile.heavyEnhance, profile.heavyRatePercent, profile.isHeavy, 'enhancement.heavyDamagePercent'),
    enhRow('멀티히트 기여', profile.areaEnhance, profile.areaRatePercent, profile.isArea, 'enhancement.areaDamagePercent'),
    ['스킬 피해', `${dv('damageIncrease.skillDamagePercent').toFixed(1)}%`, '(1 + 스킬위력/8500) 에 곱해짐'],
    ['바위 칼날 스택', `${rockStacks.toFixed(0)} / 30`, `초당 ${hps}타 × 10초 (30스택은 3타 필요)`],
    // min/max 는 밤축 OFF/ON 한 상태를 통째로 계산한 것이라 '비중'이라는 개념이 없다.
    ...(state.scenario === 'expected'
      ? [['밤의 축복 ON 딜 비중', `${(ev.damageShareNightBlessing * 100).toFixed(1)}%`,
          `주기 ${nbCycle}초 중 15초 = 시간 비중 ${(15 / nbCycle * 100).toFixed(1)}%`]]
      : [['밤의 축복', state.scenario === 'max' ? 'ON 상태로 계산' : 'OFF 상태로 계산',
          `주기 ${nbCycle}초 · 지속 15초`]]),
  ];
  const label = SCENARIOS.find((s) => s.key === state.scenario)?.label ?? '';
  if (scenarioHost) scenarioHost.textContent = `${label} 기준`;
  derivedHost.innerHTML = rows.map(([k, v, note]) =>
    `<div class="drow"><span>${k}</span><b>${v}</b><em>${note}</em></div>`).join('') +
    (nb ? `<div class="drow"><span>밤축 ON 계수</span><b>D ${nb.D.toFixed(3)} · F ${nb.F.toFixed(3)} · L ${nb.L.toFixed(2)}</b><em>OFF: D ${f.D.toFixed(3)} · F ${f.F.toFixed(3)} · L ${f.L.toFixed(2)}</em></div>` : '');

}

function renderResultsInner() {
  if (!isMeasured()) return;
  if (!renderValidation()) {
    // 이유를 막힌 자리에 적는다. 예전에는 룬 패널에만 떠서, 결과 쪽에서는 무엇이
    // 잘못됐는지 알 수 없었다. 밤의 축복 방어구 룬 4개 중 3개가 각성이라 둘만 껴도
    // 이 상태가 되기 쉽다.
    document.querySelector('#cur-score').innerHTML =
      '<div class="blocked"><b>현재 세팅이 규칙에 어긋나 계산할 수 없습니다.</b>' +
      validationMessages().map((m) => `<div class="blocked-why">· ${m}</div>`).join('') +
      '<button type="button" class="ghost small" id="fix-equip">현재 세팅 바꾸기</button></div>';
    for (const id of ['#best-set', '#warnings', '#factors', '#derived']) {
      document.querySelector(id).innerHTML = '';
    }
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

  /* '직전 대비' 는 실험군이 대신한다. 기준이 계속 움직이는 것이 문제였다 —
   * 세 번 바꾸면 처음 구성이 어디에도 안 남아 되찾을 방법이 없었다.
   * 이제 왼쪽이 고정 기준이고 오른쪽이 바꿔보는 자리다. */
  renderSetList(document.querySelector('#cur-runes'), cur);
  document.querySelector('#cur-score').innerHTML = scoreLine(base.score);
  renderTrial(base);

  renderCalcDetail({ ev: base, profile: p,
    factorsHost: document.querySelector('#factors'),
    derivedHost: document.querySelector('#derived'),
    scenarioHost: document.querySelector('#factors-scenario') });
  /* 「부위별 교체 추천」은 여기서 걷어냈다. 실험군의 룬마다 교체 후보가 바로 붙으면서
   * 같은 일을 두 곳이 하게 됐고, 더 나쁜 것은 **기준이 서로 달랐다**는 점이다 —
   * 이쪽은 현재 세팅을 기준으로 재고 실험군 쪽은 실험군을 기준으로 잰다. 실험군을
   * 한 번이라도 만지면 같은 룬에 다른 숫자가 두 자리에 떴다.
   *
   * 후보가 하나도 없으면 아래 최적 세트도 못 낸다. 아무 말 없이 비면 고장으로 보이므로
   * 무엇을 하면 되는지 말해준다 — 후보 기본값이 '없음' 이라 처음엔 늘 이 상태다. */
  if (!effectiveCandidates().length) {
    document.querySelector('#best-set').innerHTML =
      '<div class="blocked">추천할 <b>후보 룬</b>이 없습니다. ' +
      '<b>② 캐릭터</b>의 <b>후보 룬 설정</b>에서 가진 룬을 체크하거나 <b>전체 선택</b>을 눌러 주세요.</div>';
    document.querySelector('#warnings').innerHTML = '';
    return;
  }

  // 최적 세트
  const best = optimize();
  const bs = document.querySelector('#best-set');
  const gain = best.score / baseScore - 1;
  const changed = best.set.filter((n) => !cur.includes(n));
  bs.innerHTML = `<div class="best-head"><b>${fmtPct(gain)}</b> <span class="muted">현재 대비</span>` +
    (changed.length ? `<button type="button" id="apply-best" class="primary">실험군에 전체 반영</button>` : '<span class="muted">이미 최적입니다</span>') + '</div>' +
    SLOT_ORDER.map((s) => {
      const list = best.set.filter((n) => slotOf(n) === s);
      if (!list.length) return '';
      return `<div class="best-slot"><span class="muted">${s}</span> ` +
        list.map((n) => `<button type="button" class="rname inline ${cur.includes(n) ? '' : 'new'}" data-detail="${n}" data-set="trial">${n}</button>`).join(' ') + '</div>';
    }).join('');
  /* 착용 중인데 필터에 걸린 룬이 있으면 밝힌다.
   *
   * 이때만 "현재 대비" 가 음수로 나올 수 있다 — 추천이 그 룬을 못 쓰기 때문이다. 이유를
   * 안 적으면 "추천이 더 나쁜 걸 준다" 로만 보인다. 필터를 끄는 게 아니라 왜 그런지를 말한다. */
  const blocked = equippedBlockedByFilter();
  if (blocked.length) {
    bs.innerHTML += `<div class="best-caveat">⚠ 착용 중인 <b>${blocked.join(', ')}</b> 은(는) ` +
      `켜 둔 필터에 걸려 <b>추천에서 뺐습니다</b>. 그래서 점수가 지금보다 낮을 수 있습니다. ` +
      `쓰고 싶으시면 <b>② 캐릭터</b>의 후보 룬 설정에서 그 룬을 예외로 되살리거나 필터를 꺼 주세요.</div>`;
  }

  // 계산에 안 들어간 효과를 가진 룬이 최적 세트에서 빠지면, 추천이 오해를 부를 수 있다.
  const dropped = cur.filter((n) => !best.set.includes(n))
    .map(runeByName).filter((r) => r && (r.uncountedEffects || r.skillTypeBonuses));
  if (dropped.length) {
    bs.innerHTML += `<div class="best-caveat">⚠ 이 추천은 <b>${dropped.map((r) => r.name).join(', ')}</b> 을(를) 뺍니다. ` +
      `해당 룬의 ${dropped.flatMap((r) => (r.uncountedEffects ?? []).map((b) => `${b.stat} ${b.value}%`)).join(', ') || '일부 효과'} 는 ` +
      `데미지 공식에 없어 <b>0으로 계산</b>됩니다. 실제로는 손해일 수 있습니다.</div>`;
  }
  if (changed.length) {
    /* 추천은 실험군으로 간다. 현재 세팅을 바꾸는 문은 ③ 의 「현재 세팅에 반영」 하나뿐이다.
     * 여기서 바로 현재를 덮으면, 기준으로 삼으려고 안 건드리기로 한 그 세트가
     * 추천 한 번에 날아간다 — 왼쪽을 고정 기준으로 둔 이유가 없어진다. */
    /* 후보 목록은 여기서 건드리지 않는다. 예전에는 추천에 든 룬을 후보에 자동으로 도로
     * 넣었는데, 그러면 사용자가 직접 끈 체크가 버튼 한 번에 되살아난다. 씨앗에도 필터를
     * 걸게 된 뒤로는 추천이 후보 밖 룬을 낼 일도 없다. */
    document.querySelector('#apply-best').addEventListener('click', () => {
      state.trial = [...best.set];
      save(); renderAll();
      document.querySelector('#panel-trial')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // 미계산 항목 — 현재 착용분만 보면 추천으로 새로 들어오는 룬의 페널티를 놓친다.
  // 현재 세트와 추천 세트를 모두 훑고, 어느 쪽인지 표시한다.
  const w = document.querySelector('#warnings');
  const recW = document.querySelector('#rec-warnings');
  /* 프로필 스위치를 켤 때마다 "이렇게 보고 계산했습니다" 를 여기 적지 않는다.
   *
   * 예전에는 평타 스위치에만 그런 안내가 붙어 있었는데, 스위치가 늘 때마다 이 자리가
   * 길어지고 정작 그 아래 미계산 항목이 밀린다. 스위치가 무엇을 하는지는 그 스위치 옆에
   * 적고, 도구 전체에 걸리는 한계는 `/limits` 가 갖는다 — 자리는 그 둘뿐이다. */
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

  const { corrected, uncounted } = splitCorrected(warnRows);
  const line = (r, extra = '') =>
    `<li class="${r.neg ? 'neg' : ''}">` +
    (r.tag ? `<span class="where ${r.tag === '추천' ? 'rec' : ''}">${r.tag}</span>` : '') +
    (r.rune ? `<button type="button" class="rname inline" data-detail="${r.rune}">${r.rune}</button> ` : '') +
    (r.kind ? `<span class="kind">${r.kind}</span> ` : '') + r.text + extra + '</li>';

  /* 현재 세트 것은 왼쪽 칸에, 추천에서 새로 들어오는 것은 4층에 둔다.
   * 한 덩어리로 두면 "지금 내 세팅의 한계" 와 "추천을 받아들이면 생기는 한계" 가 섞인다. */
  const isRec = (r) => r.tag === '추천';
  const block = (list, title) => (list.length
    ? `<h3>${title}</h3><ul class="warn">${list.map((r) => line(r)).join('')}</ul>` : '');
  w.innerHTML =
    (corrected.filter((r) => !isRec(r)).length
      ? `<h3>보정 항목</h3><ul class="warn corrected">${corrected.filter((r) => !isRec(r)).map((r) =>
          line(r, appliedText(r))
        ).join('')}</ul>` : '') +
    block(uncounted.filter((r) => !isRec(r)), '미계산 항목');
  recW.innerHTML = block(uncounted.filter(isRec), '추천 세트에서 새로 생기는 미계산 항목') +
    (corrected.filter(isRec).length
      ? `<h3>추천 세트의 보정 항목</h3><ul class="warn corrected">${corrected.filter(isRec).map((r) =>
          line(r, appliedText(r))
        ).join('')}</ul>` : '');

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

/* 실험군 칸. 왼쪽과 같은 모양으로 그리고, 점수 옆에 현재 대비를 붙인다.
 *
 * 계수는 **다른 항만** 보여준다. 열세 항을 통째로 두 번 그리면 눈이 어디를 봐야 할지
 * 모르는데, 세트를 바꿔서 실제로 움직이는 항은 보통 서너 개다. */
function renderTrial(basePoint) {
  const host = document.querySelector('#trial-runes');
  const set = trialSet();
  const statusEl = document.querySelector('#trial-status');
  const vEl = document.querySelector('#trial-validation');
  renderSetList(host, set, { origin: 'trial' });

  const v = validateRuneSet(set);
  const over = SLOT_ORDER.filter((sl) => set.filter((n) => slotOf(n) === sl).length > SLOT_CAPACITY[sl]);
  const msgs = [...(v.valid ? [] : [v.reason]),
    ...over.map((sl) => `${sl} 슬롯 초과: ${set.filter((n) => slotOf(n) === sl).length}/${SLOT_CAPACITY[sl]}`)];
  vEl.hidden = !msgs.length;
  vEl.innerHTML = msgs.map((m) => `<div>⚠ ${m}</div>`).join('');

  // 계열 개수는 왼쪽에도 있다. 여기 없으면 실험군에서 계열 문턱이 열렸는지를 볼 자리가 없다.
  const fam = familyCounts(set);
  statusEl.innerHTML = (trialTouched()
    ? '현재 세팅은 그대로 두고 여기서만 바꿉니다.'
    : '현재 세팅과 같습니다 — 「바꾸기」로 이것저것 껴보세요. 왼쪽은 안 건드립니다.')
    + ' <span class="muted">|</span> 계열: '
    + FAMILIES.map((f) => `<b class="${fam[f] ? 'ok' : 'muted'}">${f} ${fam[f]}</b>`).join(' · ');

  const scoreEl = document.querySelector('#trial-score');
  const facEl = document.querySelector('#trial-factors');
  const warnEl = document.querySelector('#trial-warnings');
  if (msgs.length) {
    scoreEl.innerHTML = '<div class="blocked">규칙에 어긋나 계산할 수 없습니다.</div>';
    facEl.innerHTML = ''; warnEl.innerHTML = '';
    return;
  }
  const p = profileFor();
  const t = evaluate(RUNES, set, state.scenario, p);
  scoreEl.innerHTML = scoreLine(t.score, basePoint.score);

  /* 바꾸면 좋아지는 후보를 룬 옆에 붙인다. **실험군에만** 붙인다 — 현재 세팅은 손대는
   * 자리가 아니고(③ 에서 현재를 바꾸는 문은 「현재 세팅에 반영」 하나뿐), 왼쪽에도 붙이면
   * 같은 화면에서 두 가지 다른 일이 일어난다. */
  const chipCount = renderSetList(host, set, {
    origin: 'trial',
    // 눌러야 뜬다. 룬마다 후보를 재는 값이 들어서(후보 전체면 200회 넘는 평가)
    // 늘 켜두면 스탯 칸을 칠 때마다 그 값을 낸다.
    swaps: state.showSwaps ? betterSwaps(set, p, t.score) : null,
  });
  /* 칩이 안 붙은 줄이 무슨 뜻인지 밝힌다.
   *
   * 칩은 **한 칸만** 바꿔 본다. 두 칸을 동시에 바꿔야 나아지는 자리가 실제로 있고
   * (무너진 경계→금 간 봉인 혼자 +0.3%, 첫 번째 서약→교차하는 사슬 혼자 −0.5%,
   * 둘 다 하면 +2.3%), 그런 경우 이 줄들은 전부 비어 있다. 아무 말도 안 하면
   * "지금이 최선" 으로 읽힌다 — 실제로는 여기서 보이지 않을 뿐이다.
   *
   * 줄마다 「없음」을 적지는 않는다. 그건 줄만 늘리고, 없다는 것은 칩이 없는 것으로
   * 이미 보인다. 대신 한 번만 말하고 ④ 로 보낸다 — ④ 는 여러 칸을 같이 바꾼다. */
  const noteEl = document.querySelector('#swaps-note');
  if (state.showSwaps) {
    const shown = chipCount;
    noteEl.innerHTML = shown
      ? '칩이 안 붙은 자리는 <b>그 한 칸만 바꿔서는</b> 나아지지 않는다는 뜻입니다. ' +
        '두 칸을 같이 바꿔야 오르는 경우가 있고 그건 여기서 안 보입니다 — ' +
        '<b>④ 추천 세팅</b>이 그런 조합까지 찾습니다.'
      : '<b>한 칸만 바꿔서 나아지는 자리가 없습니다.</b> 두 칸을 같이 바꿔야 오르는 경우가 ' +
        '있고 그건 여기서 안 보입니다 — <b>④ 추천 세팅</b>을 보세요.';
    noteEl.hidden = false;
  } else {
    noteEl.hidden = true;
    noteEl.innerHTML = '';
  }
  const tg = document.querySelector('#toggle-swaps');
  tg.setAttribute('aria-pressed', String(!!state.showSwaps));
  // 켜짐은 accent, 꺼짐은 quiet. 둘은 같은 상자라 눌러도 크기가 안 흔들린다.
  tg.classList.toggle('accent', !!state.showSwaps);
  tg.classList.toggle('quiet', !state.showSwaps);

  renderCalcDetail({ ev: t, profile: p,
    factorsHost: facEl,
    derivedHost: document.querySelector('#trial-derived'),
    scenarioHost: document.querySelector('#trial-factors-scenario'),
    compareTo: basePoint.factors });

  /* 미계산 항목은 실험군 세트 전체를 보여준다.
   * 예전에는 '왼쪽에 없는 룬' 만 실었는데, 그러면 실험군만 접은 사람은 자기 세트의
   * 한계를 반쪽만 본다. 새로 들어온 것은 표시를 달아 구분한다. */
  const rows = [];
  for (const n of set) {
    const r = runeByName(n);
    if (!r) continue;
    const isNew = !state.equipped.includes(n);
    for (const u of uncountedOf(r)) rows.push({ rune: r.name, isNew, ...u });
  }
  // 보정한 것과 아직 안 센 것을 가른다. 규칙은 현재 세팅 쪽과 같은 함수다.
  const { corrected, uncounted } = splitCorrected(rows);
  const line = (r, extra = '') =>
    `<li class="${r.neg ? 'neg' : ''}">` +
    (r.isNew ? '<span class="where rec">새로</span>' : '') +
    `<button type="button" class="rname inline" data-detail="${r.rune}" data-set="trial">${r.rune}</button> ` +
    `<span class="kind">${r.kind}</span> ${r.text}${extra}</li>`;
  warnEl.innerHTML =
    (corrected.length
      ? '<h3>보정 항목</h3><ul class="warn corrected">' + corrected.map((r) =>
          line(r, appliedText(r))
        ).join('') + '</ul>' : '') +
    (uncounted.length
      ? '<h3>미계산 항목</h3><ul class="warn">' + uncounted.map((r) => line(r)).join('') + '</ul>' : '');
}

// renderSituation 이 여기 있는 이유: 착용을 바꾸면 세트가 스스로 켜는 지속 피해가 달라져
// 체크박스의 잠금 표시가 같이 움직여야 한다. 프로필 칸만 다시 그리면 그 표시가 낡는다.
function renderAll() { renderJobs(); renderMastery(); renderMeasure(); renderRunes(); renderSituation(); renderSampleNote(); renderCandStatus(); renderEquipStatus(); renderValidation(); renderResults(); }

// ── 이벤트 ──────────────────────────────────────────────
function onMeasureInput(e) {
  const num = (sel) => {
    const v = document.querySelector(sel).value;
    return v === '' ? null : Number(v);
  };
  const m = state.measure;
  // 안 재는 모드의 한 칸. 여기서는 풀 것이 없다 — 적은 값이 곧 룬 외 공증이다.
  if (isNoMeasure()) {
    const v = num('#nm-nonrune');
    m.nonRunePercentManual = Number.isFinite(v) && v >= 0 ? v : DEFAULT_NON_RUNE_PERCENT;
    scheduleInputSave(); renderMeasure();
    if (e?.type === 'change') renderResults(); else scheduleResultRender();
    return;
  }
  const mode = document.querySelector('input[name="measure-mode"]:checked')?.value ?? m.mode;
  /* 모드를 막 바꾼 순간에는 입력을 읽지 않는다.
   *
   * 방금 보이게 된 블록의 칸은 아직 비어 있다 — 저장된 값을 되돌려 놓기 전이다.
   * 그걸 읽어 상태에 쓰면 이미 잰 값이 통째로 지워진다. 간이로 재놓고 정밀 모드를
   * 열어보기만 해도 측정이 날아가는 셈이라, 실제로 그렇게 났다. */
  if (mode !== m.mode) {
    m.mode = mode;
    save(); renderMeasureFields(); computeMeasure(); renderMeasure(); renderResults();
    return;
  }
  if (mode === 'single') {
    m.single = {
      attackNow: num('#s-atk-now'),
      attackAfter: num('#s-atk-after'),
      runePercent: num('#s-rune'),
      direction: document.querySelector('#s-dir').value,
    };
    // 간이 입력에서 두 쌍을 만든다. 풀이는 한 벌뿐이다.
    const pair = singleRunePair(m.single);
    m.a = pair?.a ?? { attack: m.single.attackNow, runePercent: m.single.runePercent };
    m.b = pair?.b ?? { attack: null, runePercent: null };
  } else {
    m.a = { attack: num('#atk-1'), runePercent: num('#pct-1') };
    m.b = { attack: num('#atk-2'), runePercent: num('#pct-2') };
  }
  // 값을 건드리면 그 순간부터 '확정 안 된 측정'이다. 옛 확정 시각이 남아 있으면
  // 새 숫자에 옛 날짜가 붙는다.
  state.measure.at = null;
  state.measure.committed = false;
  computeMeasure();
  scheduleInputSave(); renderMeasure();
  if (e?.type === 'change') renderResults(); else scheduleResultRender();
}


document.querySelector('#measure-section').addEventListener('input', onMeasureInput);
document.querySelector('#measure-section').addEventListener('change', onMeasureInput);
/* 「측정」 — 안 재고 쓰던 사람이 정확도를 올리러 갈 때. 기본은 간이 모드로 연다.
 * 여기서 잰 뒤에는 다시 안 재는 모드로 돌아가지 않는다(잰 값이 더 낫기 때문).
 * 중간에 그만두려면 「측정 취소」가 있다 — 아직 아무것도 확정 안 했으면 되돌아간다. */
document.querySelector('#measure-start').addEventListener('click', () => {
  /* 재러 들어간다. 이미 확정한 측정이 있으면 **그 값과 그 방식으로** 돌아간다 —
   * 안 재고 쓰던 것은 잠시 안 본 것이지 잰 것을 버린 게 아니다.
   * 처음 들어올 때는 정확한 쪽을 먼저 보여준다(간이는 라디오로 바꿀 수 있다). */
  state.measure.mode = state.measure.prevMode ?? 'pairs';
  if (!state.measure.committed) renderMeasure.open = true;
  save(); renderMeasureFields(); computeMeasure(); renderAll();
});
/* 기본값 쓰기(= 안 재기). 언제든 누를 수 있고, 잰 값을 버리지 않는다.
 * 어느 방식으로 재고 있었는지만 적어둔다 — 되돌아올 때 그 화면으로 가야 하기 때문이다. */
document.querySelector('#measure-none').addEventListener('click', () => {
  if (!isNoMeasure()) state.measure.prevMode = state.measure.mode;
  state.measure.mode = 'none';
  renderMeasure.open = false;
  save(); renderAll();
});
document.querySelector('#measure-toggle').addEventListener('click', () => {
  renderMeasure.open = !renderMeasure.open;
  renderMeasure();
});

document.addEventListener('input', (e) => {
  const key = e.target.dataset.profile;
  if (key) {
    state.profile[key] = Number(e.target.value) || 0;
    // 한 칸이라도 자기 값을 넣었으면 더는 샘플이 아니다.
    if (state.usingSample) { state.usingSample = false; renderSampleNote(); }
    scheduleInputSave(); computeMeasure(); renderMeasure(); scheduleResultRender();
  }
  if (e.target.name === 'helio') {
    state.profile.helioPercent = Number(e.target.value) || 0;
    save(); renderHelio(); computeMeasure(); renderMeasure(); renderResults();
  }
  if (e.target.id === 'assume-vulnerable') { state.profile.assumeVulnerable = e.target.checked; save(); renderResults(); }
  if (e.target.id === 'uses-basic-attack') { state.profile.usesBasicAttack = e.target.checked; save(); renderAll(); }
  if (e.target.id === 'does-heal') { state.profile.heals = e.target.checked; save(); renderAll(); return; }
  if (e.target.id === 'use-nb-buff') {
    state.profile.useNightBlessingBuff = e.target.checked;
    save(); renderNightBlessing(); renderResults();
    return;
  }
  if (e.target.dataset.nb) {
    const path = e.target.dataset.nb;
    const v = e.target.value === '' ? 0 : Number(e.target.value);
    state.profile.nightBlessingEffects = {
      ...state.profile.nightBlessingEffects, [path]: Number.isFinite(v) ? v : 0,
    };
    scheduleInputSave(); scheduleResultRender();
    return;
  }
  if (e.target.dataset.dot) {
    // 룬이 켠 칸은 disabled 라 여기 안 온다. 사람이 고른 몫만 저장한다 —
    // 룬 몫까지 저장하면 룬을 뺀 뒤에도 켜진 채로 남는다.
    state.profile.dotTypes = { ...state.profile.dotTypes, [e.target.dataset.dot]: e.target.checked };
    save(); renderAll();
    return;
  }
  const ovKind = e.target.dataset.ov;
  if (ovKind) {
    const rune = e.target.dataset.rune;
    const v = e.target.value === '' ? null : Number(e.target.value);
    state.overrides[rune] ??= {};
    if (ovKind === 'utility') {
      if (v === null) delete state.overrides[rune].utility; else state.overrides[rune].utility = v;
    } else {
      // 'cond' 는 값, 'rate' 는 비율. 저장 자리를 나눠야 한 항목이 둘 다 갖게 되는 일이 없다.
      const bucket = ovKind === 'rate' ? 'rate' : 'cond';
      state.overrides[rune][bucket] ??= {};
      // 칸 하나가 항목 여럿을 덮을 수 있다(한 조건이 여러 효과를 켜는 룬). 그 경우 id 가
      // 쉼표로 온다 — 한 항목만 쓰면 나머지가 100 에 머물러 한 몸인 값이 갈라진다.
      for (const id of e.target.dataset.condId.split(',')) {
        if (v === null) delete state.overrides[rune][bucket][id];
        else state.overrides[rune][bucket][id] = bucket === 'rate' ? Math.min(100, Math.max(0, v)) : v;
      }
    }
    scheduleInputSave(); scheduleResultRender(); renderRunes();
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

/** 측정 확정. 모드마다 버튼이 따로 있지만 하는 일은 같다. */
function commitMeasure() {
  if (!isComputed()) return;
  state.measure.committed = true;
  // 여기서 찍지 않으면 새 측정은 시각 없이 저장된다(입력할 때마다 null 로 지워지므로).
  state.measure.at = stampNow();
  // 측정 당시의 아티팩트 구성을 같이 남긴다. 이후 아티팩트가 바뀌면 측정이 무효가 되는데,
  // 아티팩트는 B(공증)뿐 아니라 A(깡공)까지 바꾸기 때문이다(개당 깡공 133, 실측).
  state.measure.artifactSig = artifactSignature();
  renderMeasure.open = false;
  save(); renderAll();
}
document.querySelector('#measure-submit').addEventListener('click', commitMeasure);
document.querySelector('#measure-submit-single').addEventListener('click', commitMeasure);





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
  /* 눈금 선택(처치 잡몹 · 기준 전투 시간). 값이 연속이 아니라 버튼이다 — 게임이 정한
   * 문턱 사이에는 결과가 같은 구간뿐이라, 그 안을 고르게 하면 안 움직이는 슬라이더가 된다. */
  const kill = e.target.closest('[data-kill]');
  if (kill) {
    state.profile.killCount = Number(kill.dataset.kill);
    save(); renderSituation(); renderResults(); renderRunes();
    return;
  }
  const fight = e.target.closest('[data-fight]');
  if (fight) {
    state.profile.fightSeconds = Number(fight.dataset.fight);
    save(); renderSituation(); renderResults(); renderRunes();
    return;
  }
  const reset = e.target.closest('[data-ov-reset]');
  if (reset) {
    delete state.overrides[reset.dataset.ovReset];
    save(); renderRunes(); renderResults(); refreshRuneModal();
    return;
  }
  const dbtn = e.target.closest('[data-detail]');
  if (dbtn) {
    // 어느 세트에서 눌렀는지를 여기서 잡는다. 안 잡으면 상세창의 착용 버튼이
    // 늘 현재 세팅을 만진다 — 실험군에서 눌러도 왼쪽이 바뀐다.
    detailOrigin = dbtn.dataset.set === 'trial' ? 'trial' : 'equipped';
    openRuneModal(dbtn.dataset.detail);
    return;
  }
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



/* 룬 옆의 교체 후보. 누르면 실험군에서 그 룬만 바뀐다. */
document.querySelector('#trial-runes').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-swap-in]');
  if (!btn) return;
  const { swapOut, swapIn } = btn.dataset;
  // 빈 칸에서 눌렀으면 뺄 룬이 없다 — 그냥 더한다.
  state.trial = swapOut ? trialSet().map((n) => (n === swapOut ? swapIn : n)) : [...trialSet(), swapIn];
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
  // 각성 구간 버프도 그 직업 표로 되돌린다. 앞 직업의 값이 남으면 뜻이 없다.
  state.profile.nightBlessingEffects = nightBlessingDefaults(state.job);
  // 스킬 자원 비중도 직업이 정한다. 없는 직업이면 0 — 칸도 안 뜬다.
  state.profile.resourceSkillSharePercent = RESOURCE_SKILL_SHARE[state.job] ?? 0;
  // 평타를 섞는지도 직업이 기본값을 준다. 직접 켠 사람은 다시 켜면 된다 —
  // 직업을 바꾼 뒤 앞 직업의 가정이 남아 있는 쪽이 더 나쁘다.
  state.profile.usesBasicAttack = BASIC_ATTACK_JOBS.includes(state.job);
  // 직업이 상시로 거는 지속 피해도 마찬가지다. 앞 직업의 도트가 남아 있으면
  // 광채+·암운+ 가 근거 없이 켜진 채로 추천에 들어간다.
  state.profile.dotTypes = dotDefaults(state.job);
  // 치유도 마찬가지다. 도발은 숙련에서 나오므로 여기서 손댈 것이 없다.
  state.profile.heals = HEALING_JOBS.includes(state.job);
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
  // 스스로 고른 것이니 안내를 더 띄울 이유가 없다. 취소했으면 위에서 이미 돌아갔다.
  state.usingSample = false;
  save(); renderFields(); renderSampleNote(); computeMeasure(); renderMeasure(); renderResults();
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
  state.usingSample = false; // 자기 스탯창을 넣었으니 더는 샘플이 아니다
  save(); renderFields(); renderSampleNote(); computeMeasure(); renderMeasure(); renderResults();
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
