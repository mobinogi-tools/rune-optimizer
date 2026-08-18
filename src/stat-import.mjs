// 스탯창 값 붙여넣기 파싱.
//
// 스탯창 9개를 손으로 옮겨 적는 것이 이 도구에서 가장 지루한 일이다. 그래서 사용자가 각자
// 쓰는 AI 에 스크린샷을 주고 받아온 결과를 붙여넣게 한다. 서버도, OCR 라이브러리도 없이
// 끝난다 — 브라우저 OCR 은 한글 학습 데이터까지 17MB 라 260KB 짜리 페이지에 넣을 수 없고,
// 서버 OCR 은 남의 캐릭터 스크린샷을 받는 서비스가 된다는 뜻이다.
//
// **여기서 조용히 틀리는 것:** AI 가 2,101 을 2,110 으로 읽어도 아무 신호가 없다. 그래서
// 이 파일은 값을 적용하지 않는다. 읽어들인 것을 돌려줄 뿐이고, 화면이 사용자에게 확인을
// 받은 뒤에 적용한다. 파서가 관대할수록 확인 단계가 중요해진다.
//
// 형식을 하나로 강제하지 않는다. 사람마다 다른 AI 를 쓰고 시키는 대로 안 나오기 때문이다.
// JSON, key=value, 한국어 라벨, 숫자 나열을 전부 받는다.

/**
 * 스탯창에서 읽는 항목. 순서는 우리 화면 순서이자 '숫자만 나열' 모드의 순서다.
 *
 * label 은 우리 화면 문구, gameLabel 은 **게임에 실제로 찍혀 있는 문구**다. 지금은 전부 같다 —
 * 한때 우리만 '궁극기 강화' 로 쓰다가 게임 표기('궁극기')에 맞췄다. 게임과 나란히 놓고 쓰는
 * 도구라 문구가 다르면 사용자가 어느 칸인지 못 찾고, 프롬프트에 넣으면 AI 도 못 찾는다.
 * 두 필드를 남겨두는 이유는 다음에 또 갈릴 때 여기서 갈라지게 하기 위해서다.
 *
 * aliases 는 **받기만 하는** 문구다. 프롬프트에는 안 나가지만 들어오면 알아본다 —
 * AI 가 '궁극기' 를 '궁극기 강화' 로 자연스럽게 늘려 쓰는 일이 있고, 그걸 못 알아보면
 * 그 항목만 조용히 빠진다. 넓게 받고 좁게 요구하는 쪽이 맞다.
 */
export const IMPORT_FIELDS = Object.freeze([
  { key: 'rapidEnhance', label: '연타 강화', gameLabel: '연타 강화' },
  { key: 'heavyEnhance', label: '강타 강화', gameLabel: '강타 강화' },
  { key: 'areaEnhance', label: '광역 강화', gameLabel: '광역 강화' },
  { key: 'comboEnhance', label: '콤보 강화', gameLabel: '콤보 강화' },
  { key: 'ultimateEnhance', label: '궁극기', gameLabel: '궁극기', aliases: ['궁극기 강화'] },
  { key: 'criticalStat', label: '치명타', gameLabel: '치명타' },
  { key: 'breakStat', label: '브레이크', gameLabel: '브레이크' },
  { key: 'extraHitStat', label: '추가타', gameLabel: '추가타' },
  { key: 'skillPower', label: '스킬 위력', gameLabel: '스킬 위력' },
  { key: 'fastSkill', label: '빠른 스킬', gameLabel: '빠른 스킬' },
]);

/**
 * 사용자에게 보여줄 프롬프트. 화면에서 복사해 각자 AI 에 붙여넣는다.
 *
 * 두 가지를 못박는다. 둘 다 안 적으면 실제로 겪는 실패다.
 *   · 안 보이는 값을 0 으로 채우지 마라 — 0 은 "없다" 가 아니라 "0이다" 로 계산된다.
 *   · 계산하지 마라 — 옮겨 적는 일이지 해석하는 일이 아니다.
 */
export const IMPORT_PROMPT = [
  '첨부한 마비노기 모바일 스탯창 스크린샷에서 아래 항목의 숫자만 읽어서 JSON 으로 주세요.',
  '',
  ...IMPORT_FIELDS.map((f) => `- ${f.gameLabel}`),
  '',
  '규칙:',
  '1. 화면에 보이는 숫자를 그대로 옮겨 적으세요. 더하거나 빼거나 환산하지 마세요.',
  '2. 화면에 없거나 안 보이는 항목은 **그 항목을 빼고** 주세요. 0 으로 채우지 마세요.',
  '3. 쉼표는 있어도 되고 없어도 됩니다.',
  '4. 설명 없이 JSON 만 주세요.',
  '',
  '예시 형식:',
  '{ "연타 강화": 6392, "강타 강화": 2101, "치명타": 10480 }',
  '',
  '(스탯창에는 "추가 체력", "빠른 공격" 처럼 이름이 비슷한 항목이 함께 있습니다.',
  ' 위에 적은 항목만 골라주세요.)',
].join('\n');

const LABEL_TO_KEY = new Map();
for (const f of IMPORT_FIELDS) {
  // 우리 문구·게임 문구·영문 키를 다 받는다. 공백을 지운 형태도 넣는다 —
  // AI 가 "연타강화" 로 줄여 쓰는 일이 흔하다.
  for (const v of [f.label, f.gameLabel, f.key, ...(f.aliases ?? [])]) {
    LABEL_TO_KEY.set(v.toLowerCase(), f.key);
    LABEL_TO_KEY.set(v.toLowerCase().replace(/\s+/g, ''), f.key);
  }
}

/** "6,392" · "6392" · "6 392" → 6392. 숫자가 아니면 null. */
function toNumber(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** 라벨 문자열 → 우리 키. 못 찾으면 null. */
function toKey(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().replace(/^["'`]|["'`]$/g, '').toLowerCase();
  return LABEL_TO_KEY.get(t) ?? LABEL_TO_KEY.get(t.replace(/\s+/g, '')) ?? null;
}

/**
 * 붙여넣은 텍스트에서 스탯값을 뽑는다.
 *
 * @param {string} text
 * @returns {{values: Record<string, number>, unknown: string[], mode: string}}
 *   values  — 알아본 항목만. 못 알아본 것은 아예 없다(0 으로 채우지 않는다).
 *   unknown — 숫자는 붙어 있는데 우리 항목이 아닌 라벨. 화면에서 "무시함" 으로 보여준다.
 *   mode    — 어떻게 읽었는지. 'labeled' | 'ordered' | 'empty'
 */
export function parseStatPaste(text) {
  const out = { values: {}, unknown: [], mode: 'empty' };
  if (typeof text !== 'string' || !text.trim()) return out;

  // 코드펜스는 통째로 벗긴다. 안 벗기면 ``` 가 라벨로 잡힌다.
  let s = text.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '');

  const take = (rawLabel, rawNum) => {
    const n = toNumber(rawNum);
    if (n === null) return;
    const key = toKey(rawLabel);
    if (key) { out.values[key] = n; out.mode = 'labeled'; return; }
    const label = rawLabel.trim();
    if (label && !out.unknown.includes(label)) out.unknown.push(label);
  };

  // 1) 구분자가 뚜렷한 형태 — JSON("연타 강화": 6392) 과 key=value.
  //    한 줄에 여러 쌍이 들어 있어도 되므로 줄을 쪼개지 않고 통째로 훑는다.
  const explicit = /["'`]?([가-힣A-Za-z][가-힣A-Za-z\s]*?)["'`]?\s*[:=]\s*["'`]?(-?[\d,]+(?:\.\d+)?)["'`]?/g;
  for (const m of s.matchAll(explicit)) take(m[1], m[2]);

  // 2) 열로 맞춰진 형태 — 스탯창을 그대로 옮겨 적으면 이 모양이다.
  //
  //      브레이크 2,605      피해 감소 4,205
  //      강타 강화 2,101     빠른 공격 2,279
  //
  //    라벨과 숫자 사이는 한 칸, 열 사이는 여러 칸이다. 그래서 **먼저 여러 칸으로 셀을
  //    나누고**, 셀 하나가 통째로 "라벨 숫자" 일 때만 받는다.
  //
  //    한 칸 공백을 그냥 구분자로 쓰면 산문을 먹는다 — "치명타 확률이 50% 입니다" 가
  //    치명타=50 이 되고, 그건 화면에 아무 신호 없이 틀린 값으로 앉는다.
  //    셀 전체를 앵커로 잡으면 뒤에 말이 붙은 순간 안 걸린다.
  for (const line of s.split('\n')) {
    for (const cellRaw of line.split(/\t|\||\s{2,}/)) {
      const cell = cellRaw.trim().replace(/^[-*•\s]+/, '').replace(/[,;]+$/, '');
      if (!cell) continue;
      const m = /^["'`]?([가-힣A-Za-z][가-힣A-Za-z\s]*?)["'`]?\s+(-?[\d,]+(?:\.\d+)?)$/.exec(cell);
      if (m) take(m[1], m[2]);
    }
  }

  // 3) 라벨 셀과 숫자 셀이 따로 떨어진 형태 — 마크다운 표가 이렇다.
  //      | 연타 강화 | 6392 |
  //    셀 하나만 보면 라벨뿐이거나 숫자뿐이라 위 규칙에 안 걸린다. 이웃한 두 셀을 짝짓는다.
  for (const line of s.split('\n')) {
    const cells = line.split(/\t|\||\s{2,}/).map((c) => c.trim()).filter(Boolean);
    for (let i = 0; i < cells.length - 1; i++) {
      if (!/^["'`]?[가-힣A-Za-z][가-힣A-Za-z\s]*["'`]?$/.test(cells[i])) continue;
      if (!/^["'`]?-?[\d,]+(?:\.\d+)?["'`]?$/.test(cells[i + 1])) continue;
      take(cells[i], cells[i + 1]);
    }
  }
  if (out.mode === 'labeled') return out;

  // 2) 라벨을 하나도 못 찾았으면 '숫자만 순서대로' 로 본다. AI 를 안 쓰고 손으로
  //    옮겨 적는 사람을 위한 길이다 — 칸 사이를 옮겨 다니는 것만 없애도 한참 낫다.
  //    개수가 정확히 맞을 때만 받는다. 모자라거나 남으면 어느 항목이 빠졌는지 알 수 없고,
  //    잘못 짝지으면 조용히 전부 틀린 값이 들어간다.
  const nums = (s.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? []).map(toNumber).filter((n) => n !== null);
  if (nums.length === IMPORT_FIELDS.length) {
    IMPORT_FIELDS.forEach((f, i) => { out.values[f.key] = nums[i]; });
    out.mode = 'ordered';
  }
  return out;
}

/**
 * 읽어들인 값을 현재 프로필과 대조해 화면에 보여줄 행을 만든다.
 * 적용은 하지 않는다 — 사용자가 눈으로 확인하는 것이 이 기능의 안전장치다.
 */
export function importPreview(values, profile) {
  return IMPORT_FIELDS.map((f) => {
    const has = Object.prototype.hasOwnProperty.call(values, f.key);
    const next = has ? values[f.key] : null;
    const cur = Number(profile?.[f.key] ?? 0);
    return { ...f, has, cur, next, changed: has && next !== cur };
  });
}
