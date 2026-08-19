// data/*.json 검증기.
//
// 의존성을 안 쓴다(ajv 등). 스키마가 네 종뿐이라 범용 엔진이 필요 없고,
// 오류 메시지를 한국어로 "어느 파일 어느 항목 어느 키"까지 짚어줄 수 있다.
//
// 여기서 막는 것은 문법 오류가 아니라 **그럴듯하지만 틀린 기여**다.
// JSON 문법 오류는 어차피 파서가 잡는다. 진짜 위험한 건
//   - effects 경로 오타 → 에러 없이 계산에서 빠진다
//   - 근거 없이 바뀐 수치 → 리뷰어가 사실 확인을 할 수 없다
//   - inputs 에 없는 키를 참조 → 입력칸이 안 생기고 값이 undefined 로 흐른다
// 셋 다 사람 눈으로는 잘 안 보이고, 코딩 에이전트가 만든 PR 에서 특히 잘 나온다.
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
// 수식 이름은 평가기가 진실이다. 여기 목록을 따로 적으면 사슬을 고칠 때 어긋난다.
import {
  EXPECTED_FROM_NAMES, EXPECTED_FROM_PARAMS, HIT_TRIGGER_PARAMS,
  RATE_FIELD_NAMES, PROFILE_TEMPLATE, TRIGGER_NAMES,
} from '../src/build-evaluator.mjs';
import { FORMLESS_BRANCHES, FAMILIES } from '../src/rune-conditionals.mjs';
// 화면에 뜨는 부위. 장신구 룬은 추천기가 아예 안 다루므로 이 검사의 대상이 아니다.
import { SLOT_ORDER } from '../src/optimizer.mjs';
// 룬 이름의 진실은 데이터셋이다. 검증기가 이름 목록을 따로 갖고 있으면 그게 또 두 벌이다.
import { RUNES } from '../src/runes-data.mjs';

const CONFIDENCE = ['high', 'medium', 'low'];
const EVIDENCE_TYPES = ['measured', 'tooltip', 'community', 'official'];
// 게임 표기 자체가 근거인 타입. 날짜만 있으면 통과한다.
const SELF_EVIDENT = ['tooltip', 'official'];
// evidence 에 쓸 수 있는 속성.
const EVIDENCE_KEYS = ['type', 'date', 'note'];
// triggerRates() 가 돌려주는 발동률 이름. uptimeFrom 이 이 중 하나여야 한다.
const TRIGGER_RATES = ['critRate', 'extraRate'];

// 룬 조건부 항목에 쓸 수 있는 속성. **평가기가 실제로 읽는 것**의 목록이지
// '지금 데이터에 쓰인 것'의 목록이 아니다 — 아직 안 쓰는 requires 를 빼두면
// 처음 쓰는 사람이 문법은 맞는데 검증기에 막힌다.
// (build-evaluator.mjs · rune-conditionals.mjs 에서 e.* 로 참조하는 이름 + 메타 필드)
const CONDITIONAL_KEYS = [
  // 정체
  'id', 'label', 'field', 'note', 'basis', 'evidence',
  // 계산에 못 넣는 항목임을 데이터가 스스로 밝힌다. field 대신 쓴다.
  'uncounted',
  // 값
  //
  // 'uptime' 은 일부러 뺐다. 평가기가 e.uptime 을 읽지 않는데 허용되고 있어서,
  // "가동률 50%" 의 뜻으로 uptime: 0.5 를 넣으면 검증은 통과하고 계산은 그대로였다.
  // 이 목록의 주석이 "평가기가 실제로 읽는 것" 이라고 약속하는 바로 그 위반이다.
  // 가동률은 basis: 'playstyle' + 사용자 조절(conditionalOverrides)로 표현한다.
  'min', 'expected', 'max',
  // 발동 조건
  'requires', 'requiresFamily', 'requiresDualWield', 'requiresMastery', 'requiresVulnerable', 'branch', 'trigger', 'hitTrigger',
  // 기대값 계산
  'expectedFrom', 'uptimeFrom', 'rateField', 'streakRate',
  'perStack', 'maxStacks', 'stackDurationSeconds', 'perApplication',
  'erosionBase', 'durationSeconds', 'castsRequired',
  'familyOf', 'steps', 'statOf', 'per', 'perStep',
];

export function validateData(root = '.', expectedFromNames = EXPECTED_FROM_NAMES) {
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const read = (p) => JSON.parse(readFileSync(`${root}/${p}`, 'utf8'));

  const effectFields = read('data/effect-fields.json');
  const paths = new Set(Object.keys(effectFields));

  /* 같은 효과가 여러 룬에서 올 때 더할지 가장 큰 것만 쓸지. 기본은 더하기다.
   * 'max' 를 잘못 적으면(stak/Max 등) 조용히 더해져서 과대평가되므로 값까지 본다. */
  const STACK_MODES = ['sum', 'max'];
  for (const [p, def] of Object.entries(effectFields)) {
    if (!def || typeof def.label !== 'string' || !def.label) err('data/effect-fields.json', `${p} 에 label 이 없다`);
    if (!/^[a-zA-Z]+\.[a-zA-Z]+$/.test(p)) err('data/effect-fields.json', `경로 형식이 아니다: ${p}`);
    for (const k of Object.keys(def ?? {})) {
      if (!['label', 'stack'].includes(k)) {
        err('data/effect-fields.json', `${p} 에 모르는 속성 "${k}" (허용: label, stack)`);
      }
    }
    if (def?.stack !== undefined && !STACK_MODES.includes(def.stack)) {
      err('data/effect-fields.json', `${p} 의 stack 은 ${STACK_MODES.join('/')} 중 하나여야 한다 (받은 값: ${JSON.stringify(def.stack)})`);
    }
  }

  /** effects 맵의 키가 전부 화이트리스트에 있는지. 오타는 여기서 죽는다. */
  const checkEffects = (where, effects) => {
    if (!effects || typeof effects !== 'object') return err(where, 'effects 가 객체가 아니다');
    for (const [k, v] of Object.entries(effects)) {
      if (!paths.has(k)) {
        err(where, `모르는 effects 경로 "${k}" — data/effect-fields.json 에 없다. 오타이거나, 아직 계산에 배선되지 않은 자리다(후자면 이슈로 먼저 제안할 것)`);
      }
      if (typeof v !== 'number' || !Number.isFinite(v)) err(where, `effects["${k}"] 가 숫자가 아니다: ${JSON.stringify(v)}`);
    }
  };

  /** 근거 없는 수치는 받지 않는다. 이 규칙이 없으면 confidence 는 자기 신고에 그친다. */
  const checkEvidence = (where, item) => {
    const ev = item.evidence;
    if (!Array.isArray(ev) || ev.length === 0) {
      return err(where, 'evidence 가 없다 — 어떻게 확인한 값인지 최소 1건 적어야 한다');
    }
    ev.forEach((e, i) => {
      const w = `${where}.evidence[${i}]`;
      if (!EVIDENCE_TYPES.includes(e.type)) err(w, `type 은 ${EVIDENCE_TYPES.join('/')} 중 하나여야 한다 (받은 값: ${JSON.stringify(e.type)})`);
      // 날짜는 타입과 무관하게 받는다. 게임은 패치되므로, 나중에 값이 어긋났을 때
      // '게임이 바뀐 것인가 처음부터 틀렸던 것인가' 를 가르는 건 이 날짜뿐이다.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? '')) err(w, `date 가 YYYY-MM-DD 형식이 아니다 (받은 값: ${JSON.stringify(e.date)})`);
      // "실측했음" 만 적힌 근거는 근거가 아니다. 무엇을 어떻게 쟀는지가 있어야 재현·반박이 된다.
      if (e.type === 'measured' && !e.note) err(w, 'type=measured 면 무엇을 어떻게 쟀는지 note 에 적어야 한다');
      // 모르는 속성은 거부한다. 오타 난 속성 이름이 조용히 무시되는 것을 막고,
      // 스키마에 없는 자리를 새로 만들어 쓰는 것도 함께 막힌다.
      for (const k of Object.keys(e)) {
        if (!EVIDENCE_KEYS.includes(k)) {
          err(w, `evidence 에 쓸 수 있는 속성은 ${EVIDENCE_KEYS.join('/')} 뿐이다 ` +
            `(받은 값: ${JSON.stringify(k)}). 게임에서 확인한 값이면 type 과 date 로 끝난다`);
        }
      }
      // 유저 제보는 무엇이라고 하는지가 없으면 확인할 길이 없다.
      // 반면 tooltip·official 은 게임 표기 자체라 더 물을 것이 없다(SELF_EVIDENT).
      // measured 는 바로 위에서 더 구체적인 메시지로 잡으므로 여기서 또 잡지 않는다 —
      // 같은 실수에 오류가 둘 뜨면 어느 쪽을 고쳐야 하는지 알 수 없다.
      if (!SELF_EVIDENT.includes(e.type) && e.type !== 'measured' && !e.note) {
        err(w, `type=${e.type} 이면 무엇을 확인한 것인지 note 에 적어야 한다`);
      }
    });
  };

  const checkConfidence = (where, item) => {
    if (!CONFIDENCE.includes(item.confidence)) {
      err(where, `confidence 는 ${CONFIDENCE.join('/')} 중 하나여야 한다 (받은 값: ${JSON.stringify(item.confidence)})`);
    }
  };

  /** 오타 난 '속성 이름' 도 잡는다 — 알려진 키가 아니면 조용히 무시되기 때문이다. */
  const checkKeys = (where, obj, allowed) => {
    for (const k of Object.keys(obj)) {
      if (!allowed.includes(k)) err(where, `모르는 속성 "${k}" (허용: ${allowed.join(', ')})`);
    }
  };

  // ── 숙련 ────────────────────────────────────────────────
  const masteries = read('data/masteries.json');
  const masteryNames = new Set(Object.keys(masteries));
  const jobToMastery = new Map();
  for (const [name, m] of Object.entries(masteries)) {
    const where = `data/masteries.json[${name}]`;
    checkKeys(where, m, ['jobs', 'desc', 'effects', 'uncounted', 'confidence', 'note', 'evidence']);
    checkEffects(where, m.effects);
    checkConfidence(where, m);
    checkEvidence(where, m);
    if (!Array.isArray(m.jobs) || m.jobs.length === 0) err(where, 'jobs 가 비어 있다');
    for (const j of m.jobs ?? []) {
      if (jobToMastery.has(j)) err(where, `${j} 가 ${jobToMastery.get(j)} 에도 있다 — 직업은 숙련 하나에만 속한다`);
      jobToMastery.set(j, name);
    }
  }

  // ── 직업 ────────────────────────────────────────────────
  const files = readdirSync(`${root}/data/jobs`).filter((f) => f.endsWith('.json'));
  const seenJobs = new Set();
  for (const file of files.sort()) {
    const j = read(`data/jobs/${file}`);
    const where = `data/jobs/${file}`;
    checkKeys(where, j, ['job', 'mastery', 'dualWield', 'basicAttack', 'nightBlessing', 'excluded', 'inputs', 'uptimePassives', 'alwaysOn', 'samples']);

    /* 이 직업에서 계산에 안 넣은 것. 예전에는 note 산문 안에 "…는 뺐다" 로 섞여 있어서
     * 화면에 못 올렸고, 산문을 정규식으로 훑는 방법밖에 없었다(이 저장소가 금지하는 방식).
     * what 과 why 를 둘 다 요구한다 — 무엇을 뺐는지만 적으면 "왜 안 해주냐" 에 답이 안 된다. */
    for (const [i, e] of (j.excluded ?? []).entries()) {
      const w = `${where}.excluded[${i}]`;
      if (!e || typeof e !== 'object') { err(w, '객체여야 한다'); continue; }
      checkKeys(w, e, ['what', 'why']);
      if (!e.what?.trim()) err(w, 'what 이 비었다 — 무엇을 뺐는지 적어야 한다');
      if (!e.why?.trim()) err(w, 'why 가 비었다 — 이유 없는 제외는 근거 없는 수치와 같다');
    }

    if (typeof j.job !== 'string' || !j.job) err(where, 'job 이 없다');
    // 파일명과 직업명이 어긋나면 "고쳤는데 반영이 안 된다" 가 된다.
    if (j.job && file !== `${j.job}.json`) err(where, `파일명이 job 과 다르다 — ${j.job}.json 이어야 한다`);
    if (seenJobs.has(j.job)) err(where, `${j.job} 이 중복이다`);
    seenJobs.add(j.job);

    if (j.mastery !== null && !masteryNames.has(j.mastery)) err(where, `모르는 숙련 "${j.mastery}"`);
    if (j.mastery && jobToMastery.get(j.job) !== j.mastery) {
      err(where, `masteries.json 은 ${j.job} 를 ${jobToMastery.get(j.job) ?? '(없음)'} 로 두는데 여기는 ${j.mastery} 다`);
    }

    // 입력 선언
    const inputKeys = new Set();
    for (const [i, inp] of (j.inputs ?? []).entries()) {
      const w = `${where}.inputs[${i}]`;
      checkKeys(w, inp, ['key', 'label', 'group', 'default', 'min', 'max', 'hint']);
      if (!inp.key) err(w, 'key 가 없다');
      if (inputKeys.has(inp.key)) err(w, `key "${inp.key}" 가 중복이다`);
      inputKeys.add(inp.key);
      if (!inp.label) err(w, 'label 이 없다 — 화면에 붙을 이름이다');
      if (typeof inp.default !== 'number') err(w, 'default 가 숫자가 아니다');
      if (typeof inp.min === 'number' && typeof inp.max === 'number' && inp.min > inp.max) err(w, `min(${inp.min}) 이 max(${inp.max}) 보다 크다`);
      if (typeof inp.default === 'number' && typeof inp.min === 'number' && inp.default < inp.min) err(w, 'default 가 min 보다 작다');
      if (typeof inp.default === 'number' && typeof inp.max === 'number' && inp.default > inp.max) err(w, 'default 가 max 보다 크다');
    }

    // 밤의 축복
    const nb = j.nightBlessing;
    if (!nb) err(where, 'nightBlessing 이 없다');
    else {
      const w = `${where}.nightBlessing`;
      checkKeys(w, nb, ['trigger', 'triggerIntervalSeconds', 'effects', 'confidence', 'note', 'evidence']);
      if (!nb.trigger) err(w, 'trigger 가 없다 — 무엇이 밤의 축복을 발동시키는지');
      if (nb.triggerIntervalSeconds !== undefined && !(nb.triggerIntervalSeconds > 0)) err(w, 'triggerIntervalSeconds 는 0보다 커야 한다');
      checkEffects(w, nb.effects);
      checkConfidence(w, nb);
      checkEvidence(w, nb);
    }

    // 유지형 패시브
    const passiveIds = new Set();
    for (const [i, p] of (j.uptimePassives ?? []).entries()) {
      const w = `${where}.uptimePassives[${i}]`;
      checkKeys(w, p, ['id', 'name', 'effects', 'uptimePercentFrom', 'nightBlessingGuarantees', 'confidence', 'note', 'evidence']);
      if (!p.id) err(w, 'id 가 없다');
      if (passiveIds.has(p.id)) err(w, `id "${p.id}" 가 중복이다`);
      passiveIds.add(p.id);
      checkEffects(w, p.effects);
      checkConfidence(w, p);
      checkEvidence(w, p);
      // 참조 무결성 — 선언 안 된 입력을 가리키면 입력칸이 안 생기고 값이 undefined 가 된다.
      if (p.uptimePercentFrom && !inputKeys.has(p.uptimePercentFrom)) {
        err(w, `uptimePercentFrom "${p.uptimePercentFrom}" 이 inputs 에 없다 — 입력칸이 생기지 않는다`);
      }
    }

    // 상시 패시브
    const alwaysIds = new Set();
    for (const [i, p] of (j.alwaysOn ?? []).entries()) {
      const w = `${where}.alwaysOn[${i}]`;
      checkKeys(w, p, ['id', 'name', 'effects', 'confidence', 'note', 'evidence']);
      if (!p.id) err(w, 'id 가 없다');
      if (alwaysIds.has(p.id)) err(w, `id "${p.id}" 가 중복이다`);
      alwaysIds.add(p.id);
      checkEffects(w, p.effects);
      checkConfidence(w, p);
      checkEvidence(w, p);
    }

    if (j.samples !== null && j.samples !== undefined) {
      checkKeys(`${where}.samples`, j.samples, ['stats', 'combat']);
    }
  }

  // ── 아티팩트 ────────────────────────────────────────────
  // 아티팩트는 항목마다 evidence 를 요구하지 않는다 — 전부 게임 안 도감에 그대로 표시된다.
  const artifacts = read('data/artifacts.json');
  // 아래 checkKeys 가 스키마에 없는 속성을 거부하므로, 항목에 들어갈 수 있는 것은
  // 게임 화면에 뜨는 값 그대로다.
  const artifactNames = new Set();
  for (const [i, a] of (artifacts.items ?? []).entries()) {
    const where = `data/artifacts.json.items[${i}](${a.name ?? '?'})`;
    checkKeys(where, a, ['name', 'color', 'unique', 'desc', 'effects', 'requires', 'skillTypeOnly', 'uncounted', 'conditional']);
    if (!a.name) err(where, 'name 이 없다');
    if (artifactNames.has(a.name)) err(where, `이름 "${a.name}" 이 중복이다 — 개수 세기가 이름을 키로 쓴다`);
    artifactNames.add(a.name);
    if (typeof a.unique !== 'boolean') err(where, 'unique 가 true/false 가 아니다 — 중복 착용 시 합산 여부가 갈린다');
    // effects 가 없는 아티팩트(속도·회복 등)는 정상이다. 있으면 경로를 검사한다.
    if (a.effects) checkEffects(where, a.effects);
  }

  // ── 룬 조건부 ───────────────────────────────────────────
  const rc = read('data/rune-conditionals.json');
  const BASIS = ['derived', 'playstyle'];

  /* 이 파일은 RUNE_CONDITIONALS 말고도 분류 목록·시스템 상수를 함께 담는데,
   * 지금까지 검증은 RUNE_CONDITIONALS 만 봤다. 그래서 EROSION_RUNES 에 룬 이름을
   * 잘못 적어도 아무 데서도 안 걸리고, 침식 개수 세기·formlessBranch·화면 배지가
   * 조용히 어긋난다 — 그 룬만 계열 취급을 못 받는데 에러는 없다.
   *
   * 최상위 키 자체도 검사한다. 새 키를 만들어 두고 아무도 안 읽는 상태
   * (RUNE_ALWAYS_ON_EXTRA 가 그렇다)를 적어도 드러나게 한다. */
  const RUNE_NAME_LISTS = [
    'AWAKENING_RUNES', 'CURSE_RUNES', 'EROSION_RUNES',
    'DOT_APPLIER_RUNES', 'DOT_TRIGGER_RUNES', 'SPECIAL_TRIGGER_RUNES', 'NO_CONDITIONALS',
  ];
  const RUNE_NAME_MAPS = ['POLLUTION_REDUCTION', 'UTILITY_DAMAGE_EQUIVALENT', 'RUNE_FAMILY', 'RUNE_CONTENT'];
  /* 쿨감 환산은 값과 근거를 한 자리에 둔다. percent 만 있고 note 가 없으면
   * 데이터만 보는 사람은 0 이 "측정 결과 무의미" 인지 "일부러 끔" 인지 알 수 없다. */
  for (const [name, v] of Object.entries(rc.UTILITY_DAMAGE_EQUIVALENT ?? {})) {
    const where = `data/rune-conditionals.json[UTILITY_DAMAGE_EQUIVALENT][${name}]`;
    if (!v || typeof v !== 'object') { err(where, '{ percent, note } 객체여야 한다'); continue; }
    checkKeys(where, v, ['percent', 'note', 'disabledReason']);
    if (typeof v.percent !== 'number') err(where, 'percent 가 숫자가 아니다');
    if (!v.note?.trim()) err(where, 'note 가 없다 — 이 값이 어디서 왔는지 적어야 한다');
    if (v.percent === 0 && !v.disabledReason?.trim()) {
      err(where, 'percent 가 0 인데 disabledReason 이 없다 — 0 이 측정 결과인지 의도적 비활성인지 구분되지 않는다');
    }
  }
  const TOP_LEVEL_KEYS = [
    'RUNE_CONDITIONALS', 'DRAGON_SIGIL', 'NIGHT_BLESSING', 'NEGATIVE_TRAITS',
    'STAT_BETTER_WHEN', 'RUNE_FAMILY', 'RUNE_CONTENT',
    'MAX_AWAKENING', 'MAX_CURSE', 'RUNE_ALWAYS_ON_EXTRA',
    'TRANSCEND_EMBLEM', 'EROSION_SYSTEM',
    ...RUNE_NAME_LISTS, ...RUNE_NAME_MAPS,
  ];
  checkKeys('data/rune-conditionals.json', rc, TOP_LEVEL_KEYS);

  /* 게임 시스템 수치. 수식은 코드에 있고 파라미터만 여기 있다 — 값이 빠지면
   * 수식에 undefined 가 들어가 NaN 이 되고, 그 계열 룬 전체가 조용히 0 이 된다. */
  const SYSTEM_NUMBERS = {
    TRANSCEND_EMBLEM: ['durationSeconds', 'cooldownSeconds', 'stacksRequired'],
    EROSION_SYSTEM: ['ratePerRunePerSecond', 'pollutionSeconds', 'boostThreshold',
      'pollutionThreshold', 'boostMultiplier'],
  };
  for (const [key, fields] of Object.entries(SYSTEM_NUMBERS)) {
    const obj = rc[key];
    const where = `data/rune-conditionals.json[${key}]`;
    if (!obj || typeof obj !== 'object') { err(where, '객체여야 한다'); continue; }
    checkKeys(where, obj, fields);
    for (const f of fields) {
      if (typeof obj[f] !== 'number' || !(obj[f] > 0)) err(where, `${f} 가 양수가 아니다`);
    }
  }
  if (rc.EROSION_SYSTEM && rc.EROSION_SYSTEM.boostThreshold >= rc.EROSION_SYSTEM.pollutionThreshold) {
    err('data/rune-conditionals.json[EROSION_SYSTEM]',
      'boostThreshold 가 pollutionThreshold 보다 크거나 같다 — 배수 구간이 사라져 기대값이 음수로 샌다');
  }

  // 룬 이름의 진실은 runes-data 다. 목록이 그것과 어긋나면 그 항목은 죽은 이름이다.
  const runeNames = new Set(RUNES.items.map((r) => r.name.replace(/\+$/, '')));
  const checkRuneName = (where, name) => {
    if (!runeNames.has(name.replace(/\+$/, ''))) {
      err(where, `"${name}" 은 runes-data 에 없는 룬이다 — 이 항목은 어떤 세트에서도 안 걸린다`);
    }
  };
  for (const key of RUNE_NAME_LISTS) {
    const list = rc[key];
    if (list === undefined) continue;
    if (!Array.isArray(list)) { err(`data/rune-conditionals.json[${key}]`, '배열이어야 한다'); continue; }
    const seen = new Set();
    for (const name of list) {
      const where = `data/rune-conditionals.json[${key}]`;
      if (typeof name !== 'string') { err(where, '룬 이름은 문자열이어야 한다'); continue; }
      if (seen.has(name)) err(where, `"${name}" 이 목록 안에서 중복이다`);
      seen.add(name);
      checkRuneName(where, name);
    }
  }
  for (const key of RUNE_NAME_MAPS) {
    for (const name of Object.keys(rc[key] ?? {})) checkRuneName(`data/rune-conditionals.json[${key}]`, name);
  }
  /* 콘텐츠 이름은 화면의 층 머리말과 배지에 그대로 찍힌다. 빈 값이면 머리말 없는 층이 생기고,
   * 숫자면 배지에 숫자가 뜬다 — 둘 다 에러 없이 이상한 화면이 된다. */
  for (const [name, v] of Object.entries(rc.RUNE_CONTENT ?? {})) {
    if (typeof v !== 'string' || !v.trim()) {
      err(`data/rune-conditionals.json[RUNE_CONTENT][${name}]`, '콘텐츠 이름은 비어 있지 않은 문자열이어야 한다');
    }
  }
  /* 유틸 항목이 이득인지 손해인지는 '감소' 인지가 아니라 무엇이 움직였는지가 정한다.
   * 받는 피해는 줄면 이득, 늘면 손해다. 이 표가 없으면 화면의 색이 반대로 나가는데
   * 에러가 아니라 그냥 틀린 색이라 아무도 눈치채지 못한다 — 실제로 5건이 그랬다.
   * 새 스탯을 쓰면서 표에 안 넣으면 색이 조용히 중립으로 떨어지므로 여기서 막는다. */
  const BETTER = ['높을수록', '낮을수록'];
  const polarity = rc.STAT_BETTER_WHEN ?? {};
  for (const [stat, v] of Object.entries(polarity)) {
    if (!BETTER.includes(v)) {
      err(`data/rune-conditionals.json[STAT_BETTER_WHEN][${stat}]`, `"${v}" 는 ${BETTER.join(' 또는 ')} 여야 한다`);
    }
  }
  const usedStats = new Set();
  for (const r of RUNES.items) {
    for (const [i, b] of (r.uncountedEffects ?? []).entries()) {
      const where = `src/runes-data.mjs[${r.name}].uncountedEffects[${i}]`;
      checkKeys(where, b, ['stat', 'value', 'unit', 'direction', 'conditional']);
      if (!b.stat?.trim()) { err(where, 'stat 이 없다'); continue; }
      usedStats.add(b.stat);
      if (typeof b.value !== 'number') err(where, 'value 가 숫자가 아니다');
      if (b.direction !== undefined && !['증가', '감소'].includes(b.direction)) {
        err(where, `direction 은 증가 또는 감소여야 한다 ("${b.direction}")`);
      }
      if (b.unit !== undefined && !b.unit?.trim()) err(where, 'unit 이 비었다 — 없으면 키를 빼고 % 로 둔다');
      if (!(b.stat in polarity)) {
        err(where, `"${b.stat}" 이 STAT_BETTER_WHEN 에 없다 — 이득인지 손해인지 정해지지 않아 화면에서 중립으로 떨어진다`);
      }
    }
  }
  for (const stat of Object.keys(polarity)) {
    if (!usedStats.has(stat)) {
      err('data/rune-conditionals.json[STAT_BETTER_WHEN]', `"${stat}" 을 쓰는 룬이 없다 — 죽은 줄이다`);
    }
  }

  /* 계열(빛·어둠·용)은 룬 하나가 **많아야 하나**만 갖는다. 그래서 목록 셋이 아니라 맵이다 —
   * 목록으로 두면 같은 룬이 둘에 들어가도 아무도 못 잡는다.
   * 계열이 없는 룬은 여기 없다(신화·장신구·기본기+·쐐기돌·원정대). 근거는 작업공간 노트에 있고,
   * 신화가 계열 없음이라는 것은 아직 추정이다. */
  for (const [name, f] of Object.entries(rc.RUNE_FAMILY ?? {})) {
    if (!FAMILIES.includes(f)) {
      err(`data/rune-conditionals.json[RUNE_FAMILY][${name}]`,
        `"${f}" 는 ${FAMILIES.join('·')} 중 하나여야 한다 — 계열이 없으면 이 표에서 빼면 된다`);
    }
  }

  /* 부정 효과는 손으로 판단해 적는 유일한 분류다 — 설명문을 '감소' 로 훑으면 쿨감 같은
   * 이득까지 딸려와 자동화가 안 된다. 손 목록인 만큼 여기가 유일한 진실이고, 배지·제외
   * 필터·「계산 밖」 목록의 페널티 문장이 전부 여기서 나온다. desc 는 화면에 그대로 나가고,
   * 룬 이름이 틀리면 그 룬만 조용히 아무 데도 안 걸린다(개수만 하나 줄어든다). */
  for (const [key, t] of Object.entries(rc.NEGATIVE_TRAITS ?? {})) {
    const where = `data/rune-conditionals.json[NEGATIVE_TRAITS][${key}]`;
    if (!t || typeof t !== 'object' || Array.isArray(t)) { err(where, '{ label, desc, runes } 객체여야 한다'); continue; }
    checkKeys(where, t, ['label', 'desc', 'runes']);
    if (!t.label?.trim()) err(where, 'label 이 없다 — 제외 필터 버튼에 붙을 이름이다');
    if (!t.desc?.trim()) err(where, 'desc 가 없다 — 「계산 밖」 목록에 이 문장이 그대로 나간다');
    if (!Array.isArray(t.runes) || t.runes.length === 0) {
      err(where, 'runes 가 비었다 — 아무 룬도 안 걸리는 분류다');
      continue;
    }
    const seen = new Set();
    for (const name of t.runes) {
      if (typeof name !== 'string') { err(where, '룬 이름은 문자열이어야 한다'); continue; }
      if (seen.has(name)) err(where, `"${name}" 이 목록 안에서 중복이다`);
      seen.add(name);
      checkRuneName(where, name);
    }
  }
  // 조건부를 붙일 대상도 실재해야 한다. 이름이 틀리면 그 룬은 영영 모델링되지 않는다.
  for (const rune of Object.keys(rc.RUNE_CONDITIONALS ?? {})) {
    checkRuneName('data/rune-conditionals.json[RUNE_CONDITIONALS]', rune);
  }
  /* 점수도 0 이고 왜 0 인지도 없는 룬을 막는다.
   *
   * 화면에는 "이 룬은 0점" 이라고만 뜨고 이유가 어디에도 없다. 빠뜨린 것인지 정말 0 인지
   * 구분할 방법이 없고, 아무도 신고해 주지 않는다 — 실제로 백금 천칭(평타 트리거 피증 21%)과
   * 악몽(화염 지대)이 그렇게 조용히 0 점이었다.
   *
   * NO_CONDITIONALS 검사로는 못 잡는다. 그건 "선언해 놓고 모순인 경우" 만 보기 때문에,
   * 어느 목록에도 안 적힌 룬은 그냥 통과한다. */
  for (const r of RUNES.items) {
    if (!SLOT_ORDER.includes(r.slot)) continue;
    const base = r.name.replace(/\+$/, '');
    const hasValue = r.alwaysOnAttackPercent || r.alwaysOnDamagePercent
      || r.alwaysOnExtra || r.conditionalRaw || rc.RUNE_ALWAYS_ON_EXTRA?.[r.name];
    const hasModel = rc.RUNE_CONDITIONALS?.[r.name] || rc.RUNE_CONDITIONALS?.[base];
    const hasWhy = r.uncountedEffects?.length || r.skillTypeBonuses?.length
      || rc.NO_CONDITIONALS?.includes(r.name);
    if (!hasValue && !hasModel && !hasWhy) {
      err(`src/runes-data.mjs[${r.name}]`,
        '점수가 0 인데 왜 0 인지도 없다 — 상시값·조건부·계산 밖 설명 중 하나는 있어야 한다. '
        + '정말 아무것도 없는 룬이면 NO_CONDITIONALS 에 넣어 "확인했다" 를 남겨라');
    }
  }

  /* NO_CONDITIONALS 는 "조건부가 없다고 확인했다" 는 선언인데, 지금까지 아무도 안 읽어
   * 선언과 실제가 어긋나도 몰랐다. 양쪽에 다 있으면 둘 중 하나가 거짓이다. */
  for (const name of rc.NO_CONDITIONALS ?? []) {
    if (rc.RUNE_CONDITIONALS?.[name]) {
      err('data/rune-conditionals.json[NO_CONDITIONALS]',
        `"${name}" 이 RUNE_CONDITIONALS 에도 있다 — "조건부 없음" 선언과 모순이다`);
    }
  }
  for (const [rune, entries] of Object.entries(rc.RUNE_CONDITIONALS ?? {})) {
    if (!Array.isArray(entries)) { err(`data/rune-conditionals.json[${rune}]`, '배열이어야 한다'); continue; }
    const labels = new Set();
    const ids = new Set();
    for (const [i, e] of entries.entries()) {
      const where = `data/rune-conditionals.json[${rune}][${i}]`;
      // 직업 데이터에는 있던 오타 방지가 여기만 빠져 있었다. 평가기는 모르는 속성을 그냥
      // 안 읽으므로, basis 를 baisis 로 적어도 에러 없이 그 설정만 사라진다.
      checkKeys(where, e, CONDITIONAL_KEYS);
      // uncounted 는 "이 항목은 공식에 자리가 없다" 는 선언이다. 값이 빠진 것과 구분된다 —
      // 빠진 것은 채워야 하지만 이건 채울 자리가 없다. field 없이 이것만 있으면 된다.
      if (e.uncounted !== undefined) {
        if (typeof e.uncounted !== 'string' || !e.uncounted.trim()) {
          err(where, 'uncounted 는 왜 계산에 못 넣는지 적은 문장이어야 한다');
        }
        if (e.field !== undefined) {
          err(where, 'uncounted 와 field 를 함께 쓸 수 없다 — 계산에 들어가거나 안 들어가거나 둘 중 하나다');
        }
      } else if (!paths.has(e.field)) {
        err(where, `모르는 field 경로 "${e.field}" — data/effect-fields.json 에 없다`);
      }
      // id 는 사용자 조정값의 저장 키다(runeOverrides[룬].cond[id]). 브라우저에 남아 있는
      // 값을 찾아가는 유일한 실마리라, 없거나 겹치면 남의 조정값을 읽거나 덮어쓴다.
      // 한 번 배포된 id 는 사실상 못 바꾼다 — 바꾸면 그 옵션의 조정값이 조회에서 빗나간다.
      if (!e.id) err(where, 'id 가 없다 — 사용자 조정값의 저장 키다. field 에서 딴 영문 슬러그(heavy-damage 등)를 붙일 것');
      else if (ids.has(e.id)) err(where, `id "${e.id}" 가 이 룬 안에서 중복이다 — 두 옵션의 사용자 조정값이 서로 덮어쓴다`);
      // 라벨을 그대로 id 에 붙이는 것을 막는다. 그러면 "라벨을 고치면 조정값이 날아간다" 는
      // 원래 문제로 되돌아간다 — id 는 문구와 무관해야 안정 키가 된다.
      else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) err(where, `id "${e.id}" 는 소문자 영문 슬러그여야 한다(예: heavy-damage)`);
      ids.add(e.id);
      // 직업 데이터와 같은 규칙: 근거 없는 룬 수치는 검증기가 막는다. checkEvidence 를 그대로
      // 재사용하는 이유는 형식이 갈라지면 기여자가 두 종류의 규칙을 배워야 하기 때문이다.
      checkEvidence(where, e);
      // 라벨은 표시 전용이다. 겹쳐도 계산은 멀쩡하지만, 화면에 같은 이름의 칸이 둘 뜬다.
      if (!e.label) err(where, 'label 이 없다');
      else if (labels.has(e.label)) err(where, `label "${e.label}" 이 이 룬 안에서 중복이다 — 화면에서 두 옵션을 구분할 수 없다`);
      labels.add(e.label);
      if (typeof e.min === 'number' && typeof e.max === 'number' && e.min > e.max) {
        err(where, `min(${e.min}) 이 max(${e.max}) 보다 크다`);
      }
      if (e.basis !== undefined && !BASIS.includes(e.basis)) {
        err(where, `basis 는 ${BASIS.join('/')} 중 하나여야 한다 (받은 값: ${JSON.stringify(e.basis)})`);
      }
      // 모르는 수식 이름은 평가기 사슬 끝의 (expected ?? 0) 으로 떨어져 조용히 0 이 된다.
      if (e.expectedFrom !== undefined && !expectedFromNames.includes(e.expectedFrom)) {
        err(where, `모르는 expectedFrom "${e.expectedFrom}" — 쓸 수 있는 것: ${expectedFromNames.join(', ')}. 계산에서 조용히 0 이 된다`);
      }
      // 이름이 맞아도 파라미터가 빠지면 식에 undefined 가 들어가 NaN 이 되고,
      // add() 가 NaN 을 버려 결국 0 이 된다. 이름 오타만 막고 이걸 놔두면 반쪽이다.
      for (const p of EXPECTED_FROM_PARAMS[e.expectedFrom] ?? []) {
        if (e[p] === undefined || e[p] === null) {
          err(where, `expectedFrom "${e.expectedFrom}" 인데 ${p} 가 없다 — 기대값이 NaN 을 거쳐 0 이 된다`);
        }
      }
      // hitTrigger 는 중첩 객체라 안쪽 키 오타도 같은 경로로 0 이 된다.
      if (e.hitTrigger !== undefined) {
        if (typeof e.hitTrigger !== 'object' || e.hitTrigger === null) {
          err(where, 'hitTrigger 는 객체여야 한다');
        } else {
          for (const p of HIT_TRIGGER_PARAMS) {
            if (typeof e.hitTrigger[p] !== 'number') err(where, `hitTrigger.${p} 가 숫자가 아니다`);
          }
          for (const k of Object.keys(e.hitTrigger)) {
            if (![...HIT_TRIGGER_PARAMS, 'cooldownSeconds'].includes(k)) {
              err(where, `모르는 hitTrigger.${k} — 평가기가 안 읽는다`);
            }
          }
        }
      }
      /* rateField 와 streakRate 는 uptimeFrom 의 형제인데 검증이 없었다. 병은 같고 증상이 더 나쁘다:
       *   rateField 오타  → 에러가 아니라 타격(hitsPerSecond)으로 **폴백**해서 그럴듯하게 틀린 값
       *   streakRate 오타 → profile[이름] ?? 0 이라 기대 중첩이 통째로 0 */
      if (e.rateField !== undefined && !RATE_FIELD_NAMES.includes(e.rateField)) {
        err(where, `모르는 rateField "${e.rateField}" — 쓸 수 있는 것: ${RATE_FIELD_NAMES.join(', ')}. 틀려도 에러 없이 타격 기준으로 폴백한다`);
      }
      if (e.streakRate !== undefined && !(e.streakRate in PROFILE_TEMPLATE)) {
        err(where, `모르는 streakRate "${e.streakRate}" — PROFILE_TEMPLATE 에 있는 키여야 한다. 없으면 기대 중첩이 0 이 된다`);
      }
      // statOf 도 같은 병이다 — 프로필에 없는 이름이면 profile[이름] ?? 0 이라 값이 통째로 0.
      if (e.statOf !== undefined && !(e.statOf in PROFILE_TEMPLATE)) {
        err(where, `모르는 statOf "${e.statOf}" — PROFILE_TEMPLATE 에 있는 키여야 한다. 없으면 스탯 비례분이 0 이 된다`);
      }
      // '500마다' 의 500 이 0 이면 Infinity 단이 되어 무조건 상한까지 찬다.
      if (e.per !== undefined && !(e.per > 0)) err(where, `per 는 0보다 커야 한다 (받은 값: ${JSON.stringify(e.per)})`);
      // 계열 게이트는 빛·어둠·용 뿐이다. 오타난 계열은 영원히 안 열려서 항목이 조용히 사라진다.
      if (e.requiresFamily !== undefined) {
        if (typeof e.requiresFamily !== 'object' || e.requiresFamily === null) {
          err(where, 'requiresFamily 는 { 계열: 최소개수 } 객체여야 한다');
        } else for (const [f, n] of Object.entries(e.requiresFamily)) {
          if (!FAMILIES.includes(f)) {
            err(where, `모르는 계열 "${f}" — 쓸 수 있는 것: ${FAMILIES.join(', ')}. 조건이 영영 안 열린다`);
          }
          if (!Number.isInteger(n) || n < 1) err(where, `requiresFamily.${f} 는 1 이상의 정수여야 한다`);
        }
      }
      // uptimeFrom 은 별개 경로다(초월 엠블럼 계열). 발동률 이름이 틀리면 rates[이름] 이
      // undefined 가 되어 가동률 계산이 NaN 으로 새어나간다.
      /* trigger 이름은 지금까지 아무도 안 봤다. 오타나면 평가기의 특수 처리에 안 걸리고
       * 아래 min/max 사슬로 떨어져 **상시 효과처럼** 계산된다 — 에러도 경고도 없다. */
      if (e.trigger !== undefined && !TRIGGER_NAMES.includes(e.trigger)) {
        err(where, `모르는 trigger "${e.trigger}" — 쓸 수 있는 것: ${TRIGGER_NAMES.join(', ')}. 틀리면 상시 효과처럼 계산된다`);
      }
      if (e.uptimeFrom !== undefined && !TRIGGER_RATES.includes(e.uptimeFrom)) {
        err(where, `모르는 uptimeFrom "${e.uptimeFrom}" — 쓸 수 있는 것: ${TRIGGER_RATES.join(', ')}`);
      }
      // 기대값을 만드는 길이 하나도 없으면 expected 는 0 으로 굳는다.
      // trigger(용의 문장·밤의 축복)와 branch 는 앞 블록에서 따로 처리되므로 예외다.
      const hasPath = e.expectedFrom !== undefined || e.uptimeFrom !== undefined
        || e.trigger !== undefined || e.branch !== undefined || e.uncounted !== undefined;
      if (!hasPath && e.expected === null) {
        err(where, 'expected 가 null 인데 기대값을 만들 방법이 없다(expectedFrom / uptimeFrom / trigger 중 하나가 필요) — 계산에서 0 이 된다');
      }
    }

    // 오타난 분기 이름은 에러다 — formlessBranch 가 절대 안 돌려주므로 그 항목은
    // 어떤 조성에서도 안 켜진다. (빠진 분기는 경고로 뺐다. missingBranches 참고)
    for (const b of new Set(entries.map((e) => e.branch).filter(Boolean))) {
      if (!FORMLESS_BRANCHES.includes(b)) {
        err(`data/rune-conditionals.json[${rune}]`,
          `모르는 branch "${b}" — formlessBranch 가 돌려주는 것: ${FORMLESS_BRANCHES.join(', ')}`);
      }
    }
  }

  // 숙련 표에만 있고 직업 파일이 없는 직업 — 드롭다운에는 뜨는데 데이터가 없는 상태가 된다.
  for (const [job, mastery] of jobToMastery) {
    if (!seenJobs.has(job)) errors.push(`data/jobs/: ${job}(${mastery}) 의 파일이 없다 — data/jobs/${job}.json 을 만들어야 한다`);
  }

  /* ── limits ────────────────────────────────────────────
   * 도구 전체에 걸리는 한계. 항목 하나가 계산에서 빠지는 것(uncounted)과는 자리가 다르다.
   *
   * why 와 effect 를 둘 다 강제한다. 한계를 한 줄로만 적으면 "안 한다" 로 읽히고,
   * 그 다음에 오는 것이 갑론을박이다 — 왜 그런지와 그래서 결과가 어떻게 되는지가
   * 같이 있어야 답이 된다. 실제로 README 에 있던 문장들은 전부 그 두 가지를 갖고 있었다. */
  const LIMIT_KINDS = ['structural', 'unmodeled', 'unverified'];
  const LIMIT_OPEN_TO = ['report', 'pr'];
  const limits = read('data/limits.json');
  if (!Array.isArray(limits.limits)) {
    err('data/limits.json', 'limits 배열이 없다');
  } else {
    const seenIds = new Set();
    for (const [i, l] of limits.limits.entries()) {
      const where = `data/limits.json[${l?.id ?? i}]`;
      if (!l || typeof l !== 'object') { err(where, '항목이 객체가 아니다'); continue; }
      checkKeys(where, l, ['id', 'kind', 'title', 'why', 'effect', 'openTo']);
      for (const k of ['id', 'title', 'why', 'effect']) {
        if (typeof l?.[k] !== 'string' || !l[k].trim()) err(where, `${k} 가 비었다`);
      }
      if (seenIds.has(l?.id)) err(where, `id 가 중복된다: ${l.id}`);
      seenIds.add(l?.id);
      if (!LIMIT_KINDS.includes(l?.kind)) err(where, `kind 는 ${LIMIT_KINDS.join(' | ')} 중 하나여야 한다`);
      // null 은 "밖에서 채울 수 없다" 는 뜻이라 유효한 값이다. 빠뜨린 것과 구분하려고 키는 요구한다.
      if (!('openTo' in (l ?? {}))) err(where, 'openTo 가 없다 — 밖에서 채울 수 있는지 밝혀야 한다 (없으면 null)');
      else if (l.openTo !== null && !LIMIT_OPEN_TO.includes(l.openTo)) {
        err(where, `openTo 는 ${LIMIT_OPEN_TO.join(' | ')} 또는 null 이어야 한다`);
      }
      // 구조적 한계는 정의상 밖에서 못 채운다. 창구를 달아두면 제보가 오고, 답은 늘 "구조라서 안 됩니다" 다.
      if (l?.kind === 'structural' && l?.openTo) {
        err(where, 'structural 인데 openTo 가 있다 — 데이터를 채운다고 없어지는 한계면 kind 가 틀렸다');
      }
    }
  }

  return errors;
}

/**
 * 에러는 아니지만 사람이 채워야 하는 구멍.
 *
 * 분기형 룬(무형)은 세트 조성에 따라 효과가 갈리는데, 짝이 없는 분기로 떨어지면 그 룬이
 * 통째로 0 이 된다. 화면에는 '이 룬은 수치 옵션이 없다' 와 똑같이 보여서 아무 신호가 없다.
 * 실제로 침식 분기가 이렇게 비어 있었고 아무도 몰랐다.
 *
 * 에러로 막지 않는 이유는, 고치려면 게임을 봐야 하기 때문이다. 검증기가 막아버리면
 * 답을 아는 사람이 나타날 때까지 아무 기여도 못 받는다. 대신 HELP-WANTED.md 에 올려
 * 답을 아는 사람 눈에 띄게 한다 — 이 구멍의 해법은 코드가 아니라 사람이다.
 */
export function missingBranches(root = '.') {
  const rc = JSON.parse(readFileSync(`${root}/data/rune-conditionals.json`, 'utf8'));
  const out = [];
  for (const [rune, entries] of Object.entries(rc.RUNE_CONDITIONALS ?? {})) {
    if (!Array.isArray(entries)) continue;
    const branches = new Set(entries.map((e) => e.branch).filter(Boolean));
    if (!branches.size) continue;
    const missing = FORMLESS_BRANCHES.filter((b) => !branches.has(b));
    if (missing.length) out.push({ rune, missing });
  }
  return out;
}

// CLI 로도 쓴다: node tools/validate-data.mjs
// 경로에 공백이 있으면 단순 문자열 비교는 %20 때문에 어긋나므로 pathToFileURL 로 맞춘다.
// argv[1] 이 없을 수도 있다(node -e 에서 import 하는 경우) — 없는데 그냥 넘기면
// pathToFileURL 이 던져서, 검증기를 불러 쓰려던 쪽이 검증 결과 대신 크래시를 본다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = validateData('.');
  if (errors.length) {
    console.error(`데이터 검증 실패 — ${errors.length}건\n`);
    for (const e of errors) console.error('  ✗ ' + e);
    process.exit(1);
  }
  console.log('데이터 검증 통과');
  // 통과했다고 구멍이 없는 것은 아니다. 막지는 않되 조용히 넘어가지도 않는다.
  for (const { rune, missing } of missingBranches('.')) {
    console.log(`  ! ${rune}: 분기 ${missing.join(', ')} 가 비어 있다 — 그 조성에서 0 으로 계산된다 (HELP-WANTED.md 참고)`);
  }
}
