// 스탯창 붙여넣기 파서.
//
// 이 파서는 남의 AI 가 뱉은 것을 받는다. 형식을 강제할 수 없으므로 관대해야 하는데,
// 관대한 파서는 **틀리게 읽고도 성공한 척한다.** 그래서 "읽었다" 가 아니라
// "무엇을 읽었고 무엇을 못 읽었는가" 를 검사한다.
//
// 특히 중요한 두 가지:
//   · 없는 항목을 0 으로 채우면 안 된다 — 0 은 계산에서 "없음" 이 아니라 "0" 이다.
//   · 숫자 개수가 안 맞을 때 순서 모드로 넘어가면 안 된다 — 전부 밀려서 조용히 틀린다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStatPaste, importPreview, IMPORT_FIELDS, IMPORT_PROMPT } from '../src/stat-import.mjs';

test('JSON 을 읽는다 — 가장 흔한 형태', () => {
  const r = parseStatPaste('{ "연타 강화": 6392, "강타 강화": 2101, "치명타": 10480 }');
  assert.equal(r.mode, 'labeled');
  assert.equal(r.values.rapidEnhance, 6392);
  assert.equal(r.values.heavyEnhance, 2101);
  assert.equal(r.values.criticalStat, 10480);
});

test('코드펜스와 앞뒤 잡설을 견딘다 — AI 는 시켜도 설명을 붙인다', () => {
  const r = parseStatPaste(`스크린샷에서 읽은 값입니다:

\`\`\`json
{
  "연타 강화": 6,392,
  "강타 강화": 2101
}
\`\`\`

궁극기 강화는 화면에 보이지 않아 제외했습니다.`);
  assert.equal(r.values.rapidEnhance, 6392, '천 단위 쉼표를 못 읽었다');
  assert.equal(r.values.heavyEnhance, 2101);
  assert.ok(!('ultimateEnhance' in r.values), '설명 문장에서 항목을 잘못 주웠다');
});

test('없는 항목을 0 으로 채우지 않는다 — 여기가 조용히 틀리는 자리다', () => {
  const r = parseStatPaste('{ "연타 강화": 6392 }');
  for (const f of IMPORT_FIELDS) {
    if (f.key === 'rapidEnhance') continue;
    assert.ok(!(f.key in r.values), `${f.label} 이 값도 없이 들어왔다`);
  }
});

test('key=value 와 표 형식도 받는다', () => {
  const eq = parseStatPaste('연타 강화 = 6392\n강타 강화 = 2101');
  assert.equal(eq.values.rapidEnhance, 6392);
  const table = parseStatPaste('| 항목 | 값 |\n|---|---|\n| 연타 강화 | 6392 |\n| 치명타 | 10480 |');
  assert.equal(table.values.rapidEnhance, 6392);
  assert.equal(table.values.criticalStat, 10480);
});

test('공백을 지운 라벨과 영문 키도 알아본다', () => {
  assert.equal(parseStatPaste('연타강화: 6392').values.rapidEnhance, 6392);
  assert.equal(parseStatPaste('rapidEnhance: 6392').values.rapidEnhance, 6392);
});

test('모르는 라벨은 버리지 않고 따로 모은다 — 화면에서 "무시함" 으로 보여준다', () => {
  const r = parseStatPaste('{ "연타 강화": 6392, "전투력": 111230, "매력": 52404 }');
  assert.equal(r.values.rapidEnhance, 6392);
  assert.ok(r.unknown.includes('전투력'), `모르는 라벨을 조용히 삼켰다: ${JSON.stringify(r.unknown)}`);
  assert.ok(!('전투력' in r.values));
});

test('숫자만 순서대로 붙여넣어도 받는다 — AI 안 쓰는 사람 몫', () => {
  const r = parseStatPaste('6392 2101 1579 2109 2029 10480 2605 3939 2969');
  assert.equal(r.mode, 'ordered');
  assert.equal(r.values.rapidEnhance, 6392);
  assert.equal(r.values.skillPower, 2969, '마지막 항목이 밀렸다');
  assert.equal(Object.keys(r.values).length, IMPORT_FIELDS.length);
});

test('숫자 개수가 안 맞으면 순서 모드를 쓰지 않는다 — 밀려서 전부 틀리는 것보다 낫다', () => {
  const short = parseStatPaste('6392 2101 1579');
  assert.equal(short.mode, 'empty', '개수가 모자란데 짝지었다');
  assert.deepEqual(short.values, {});
  const long = parseStatPaste('6392 2101 1579 2109 2029 10480 2605 3939 2969 111230');
  assert.equal(long.mode, 'empty', '개수가 남는데 짝지었다');
});

test('빈 입력과 쓰레기 입력에 터지지 않는다', () => {
  for (const bad of ['', '   ', undefined, null, 42, {}, '안녕하세요']) {
    const r = parseStatPaste(bad);
    assert.equal(r.mode, 'empty');
    assert.deepEqual(r.values, {});
  }
});

test('미리보기는 바뀌는 항목만 changed 로 표시한다', () => {
  const rows = importPreview({ rapidEnhance: 6392, heavyEnhance: 2101 },
    { rapidEnhance: 6300, heavyEnhance: 2101, criticalStat: 10500 });
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.equal(by.rapidEnhance.changed, true, '6300 → 6392 인데 안 바뀐 것으로 봤다');
  assert.equal(by.heavyEnhance.changed, false, '같은 값인데 바뀐 것으로 봤다');
  assert.equal(by.criticalStat.has, false, '안 읽은 항목이 읽은 것으로 잡혔다');
  assert.equal(rows.length, IMPORT_FIELDS.length, '미리보기에 빠진 항목이 있다');
});

// 프롬프트가 규칙을 빠뜨리면 AI 가 0 으로 채워 보내고, 그건 파서가 못 잡는다.
// 파서의 안전장치는 프롬프트에 의존하므로 여기서 같이 못박는다.
test('프롬프트가 "0으로 채우지 마라" 와 "계산하지 마라" 를 담고 있다', () => {
  assert.match(IMPORT_PROMPT, /0\s*으로 채우지 마세요/);
  assert.match(IMPORT_PROMPT, /더하거나 빼거나 환산하지 마세요/);
  for (const f of IMPORT_FIELDS) {
    assert.ok(IMPORT_PROMPT.includes(f.gameLabel), `프롬프트에 ${f.gameLabel} 이 없다`);
  }
});

// 실제 스탯창을 그대로 옮겨 적은 모양. 이게 가장 흔할 형태이고, 처음 구현은 이걸 못 읽었다.
// 라벨-숫자 사이는 한 칸, 열 사이는 여러 칸이라 "공백 = 구분자" 로는 안 풀린다.
const REAL_SCREENSHOT = `브레이크 2,605      피해 감소 4,205
강타 강화 2,101      빠른 공격 2,279
콤보 강화 2,109      연타 강화 6,392
스킬 위력 2,969      빠른 스킬 1,774
광역 강화 1,579      추가 체력 46,974
회복력 2,101         궁극기 2,029
급소 회피 1,028      치명타 10,480
추가타 3,939`;

test('실제 스탯창 2열 배치를 전부 읽는다', () => {
  const r = parseStatPaste(REAL_SCREENSHOT);
  assert.equal(r.mode, 'labeled');
  assert.deepEqual(r.values, {
    breakStat: 2605, heavyEnhance: 2101, comboEnhance: 2109, skillPower: 2969,
    areaEnhance: 1579, extraHitStat: 3939, rapidEnhance: 6392,
    ultimateEnhance: 2029, criticalStat: 10480,
  });
  assert.equal(Object.keys(r.values).length, IMPORT_FIELDS.length, '9개를 다 못 읽었다');
});

test('같은 화면의 다른 스탯을 우리 항목으로 오인하지 않는다', () => {
  const r = parseStatPaste(REAL_SCREENSHOT);
  // '추가 체력' 46,974 를 '추가타' 로 읽으면 추가타가 12배로 뛴다.
  assert.equal(r.values.extraHitStat, 3939, '추가 체력을 추가타로 읽었다');
  for (const label of ['추가 체력', '빠른 공격', '빠른 스킬', '피해 감소', '회복력', '급소 회피']) {
    assert.ok(r.unknown.includes(label), `${label} 이 무시 목록에 없다 — 어딘가로 새어 들어갔다`);
  }
});

// 게임은 '궁극기 강화' 가 아니라 '궁극기' 로 쓴다. 프롬프트가 우리 문구를 요구하면
// AI 가 화면에서 못 찾아 항목을 빼거나 엉뚱한 값을 집는다.
test('프롬프트는 게임에 실제로 찍힌 문구를 쓴다', () => {
  assert.ok(IMPORT_PROMPT.includes('궁극기'), '프롬프트에 궁극기가 없다');
  assert.ok(!IMPORT_PROMPT.includes('궁극기 강화'),
    '프롬프트가 게임에 없는 문구(궁극기 강화)를 요구하고 있다');
});

test('게임 문구와 우리 문구를 둘 다 알아본다', () => {
  assert.equal(parseStatPaste('궁극기: 2029').values.ultimateEnhance, 2029);
  assert.equal(parseStatPaste('궁극기 강화: 2029').values.ultimateEnhance, 2029);
});

// 산문을 값으로 먹으면 화면에 아무 신호 없이 틀린 숫자가 앉는다.
test('산문에서 숫자를 줍지 않는다', () => {
  for (const prose of [
    '치명타 확률이 50% 입니다',
    '스크린샷에서 연타 강화는 확인이 어려웠습니다',
    '총 9개 항목을 읽었습니다',
  ]) {
    const r = parseStatPaste(prose);
    assert.deepEqual(r.values, {}, `산문에서 값을 주웠다: ${prose} → ${JSON.stringify(r.values)}`);
  }
});
