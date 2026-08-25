// 최적 세트 탐색.
//
// 이 탐색은 rune-app.mjs 안에 있어서 테스트가 없었다. "제한 후보 풀 150회를 전수와
// 대조했다" 는 확인이 한 번 손으로 돌고 끝났고, 그 뒤로 룬이 8개 늘고 계열 조건이
// 생기는 동안 아무도 다시 재지 않았다.
//
// 여기서 잡는 것은 "최적인가" 가 아니다 — 언덕오르기는 원래 최적을 보장하지 않는다.
// 잡는 것은 **틀린 답**(불법 세트)과 **구조적으로 못 찾는 조합**이다. 후자는 조용하다:
// 그 룬이 추천에 안 나올 뿐이라 화면 어디에도 신호가 없다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimizeSet, SLOT_ORDER } from '../src/optimizer.mjs';
import { RUNES } from '../src/runes-data.mjs';
import { evaluate, SLOT_CAPACITY } from '../src/build-evaluator.mjs';
import { validateRuneSet, RUNE_FAMILY, GIANT_FRAGMENT } from '../src/rune-conditionals.mjs';
import { sampleProfile } from './sample-profile.mjs';

const USABLE = RUNES.items.filter((r) => SLOT_ORDER.includes(r.slot));
const SLOT_OF = Object.fromEntries(USABLE.map((r) => [r.name, r.slot]));
const slotOf = (n) => SLOT_OF[n];
const PROFILE = sampleProfile({ assumeVulnerable: false });
const score = (set) => evaluate(RUNES, set, 'expected', PROFILE).score;
const run = (candidates, equipped = []) => optimizeSet({ candidates, equipped, score, slotOf });
const named = (...names) => names;

test('유일 효과 거신의 파편은 카브락 방어구 룬 중 하나만 허용한다', () => {
  for (const rune of GIANT_FRAGMENT.runes) {
    assert.ok(validateRuneSet([rune]).valid, `${rune} 하나도 장착할 수 없다`);
  }
  for (let i = 0; i < GIANT_FRAGMENT.runes.length; i++) {
    for (let j = i + 1; j < GIANT_FRAGMENT.runes.length; j++) {
      const pair = [GIANT_FRAGMENT.runes[i], GIANT_FRAGMENT.runes[j]];
      const v = validateRuneSet(pair);
      assert.equal(v.valid, false, `${pair.join(', ')} 두 개가 동시에 허용된다`);
      assert.match(v.reason, /거신의 파편/, '왜 중복 불가인지 유일 효과 이름이 안내되지 않는다');
    }
  }
  assert.ok(validateRuneSet(['원정대', GIANT_FRAGMENT.runes[0]]).valid,
    '카브락 엠블럼 원정대까지 거신의 파편 방어구 룬으로 묶였다');
});

test('추천도 거신의 파편 룬을 둘 이상 고르지 않는다', () => {
  const best = run(GIANT_FRAGMENT.runes);
  const picked = best.set.filter((n) => GIANT_FRAGMENT.runes.includes(n));
  assert.ok(picked.length <= GIANT_FRAGMENT.maxEquipped, `거신의 파편을 ${picked.length}개 추천했다: ${picked.join(', ')}`);
});

test('추천 세트는 언제나 합법이다 — 정원·저주·각성 제약을 지킨다', () => {
  // 후보를 조금씩 다르게 잘라 여러 번 돌린다. 한 번만 돌리면 우연히 통과한다.
  for (let cut = 0; cut < 6; cut++) {
    const candidates = USABLE.filter((_, i) => i % 6 !== cut).map((r) => r.name);
    const best = run(candidates);
    const v = validateRuneSet(best.set);
    assert.ok(v.valid, `불법 세트가 나왔다(${cut}): ${v.reason} — ${best.set.join(', ')}`);
    for (const s of SLOT_ORDER) {
      const n = best.set.filter((x) => slotOf(x) === s).length;
      assert.ok(n <= SLOT_CAPACITY[s], `${s} 정원 초과 ${n}/${SLOT_CAPACITY[s]}`);
    }
    assert.equal(new Set(best.set).size, best.set.length, '같은 룬이 두 번 들어갔다');
    for (const n of best.set) assert.ok(candidates.includes(n), `${n} 은 후보에 없다`);
  }
});

test('돌려준 점수는 그 세트를 실제로 매긴 점수와 같다', () => {
  const best = run(USABLE.map((r) => r.name));
  assert.ok(Math.abs(best.score - score(best.set)) < 1e-6,
    `점수가 세트와 안 맞는다: ${best.score} vs ${score(best.set)}`);
});

test('지금 낀 세트보다 나쁜 것을 추천하지 않는다', () => {
  // 등반은 착용 세트에서 출발하므로 그 아래로 내려갈 수 없어야 한다.
  const equipped = named('죽음', '금 간 봉인', '계승자', '용 사냥꾼', '승전', '쐐기돌', '영원한 밤');
  assert.ok(validateRuneSet(equipped).valid, '테스트가 쓰는 착용 세트부터 불법이다');
  const best = run(USABLE.map((r) => r.name), equipped);
  assert.ok(best.score >= score(equipped) - 1e-6,
    `착용(${score(equipped).toFixed(0)})보다 낮은 것을 추천했다: ${best.score.toFixed(0)}`);
});

/* 여기부터가 이 파일의 이유. 단독으로는 손해라 등반이 절대 안 넣는 룬들이다.
 * 프로브가 죽으면 점수만 조금 낮아지고 아무 에러도 안 난다. */

test('용의 문장 쌍을 찾는다 — 하나만으로는 값이 안 나 등반이 못 넣는 조합', () => {
  // 발동 룬(별바라기)과 소비 룬을 둘 다 넣어야 값이 나는 풀을 만든다.
  const candidates = named(
    '별바라기', '잠들지 않는 불', '용 사냥꾼', '바위 칼날',
    '기본기+', '햇살+', '계시+', '해방', '태초',
  ).filter((n) => SLOT_OF[n]);
  const best = run(candidates);
  const dragons = best.set.filter((n) => ['별바라기', '잠들지 않는 불', '용 사냥꾼', '바위 칼날'].includes(n));
  assert.ok(dragons.length >= 2, `용의 문장 룬을 ${dragons.length}개만 골랐다: ${best.set.join(', ')}`);
});

test('계열 시너지를 찾는다 — 작열은 빛 계열이 모여야 값이 난다', () => {
  /* 작열의 치명타 확률은 빛 계열 수에 따라 3/7/12/18% 다. 혼자 끼면 3% 뿐이라
   * 한 번에 하나씩 바꾸는 등반은 절대 안 넣는다. 빛 룬이 이미 여럿 든 세트가 우연히
   * 만들어질 때만 들어가는데, 후보가 좁으면 그런 일이 안 생긴다.
   *
   * 작열은 기본 공격을 섞는다고 가정해야 값이 난다(기본값 0). 그 가정을 켜고 본다 —
   * 안 켜면 이 검사는 0 과 0 을 견주는 셈이라 프로브가 죽어도 통과한다. */
  const withBasicAttack = sampleProfile({
    assumeVulnerable: false,
    runeOverrides: { 작열: { cond: { 'crit-rate-by-light': 18 } } },
  });
  const scoreBA = (set) => evaluate(RUNES, set, 'expected', withBasicAttack).score;
  const runBA = (candidates) => optimizeSet({ candidates, equipped: [], score: scoreBA, slotOf });
  const light = USABLE.filter((r) => RUNE_FAMILY[r.name.replace(/\+$/, '')] === '빛')
    .filter((r) => r.slot === '방어구').slice(0, 4).map((r) => r.name);
  const filler = USABLE.filter((r) => !RUNE_FAMILY[r.name.replace(/\+$/, '')])
    .map((r) => r.name);
  const candidates = [...new Set(['작열', ...light, ...filler])];
  const best = runBA(candidates);
  // 작열이 최선이 아닐 수는 있다. 다만 '작열 + 빛 셋' 을 손으로 만든 세트보다
  // 낮은 점수를 돌려주면 그건 프로브가 그 봉우리를 못 올라갔다는 뜻이다.
  const byHand = ['작열', ...light.slice(0, 4)].slice(0, SLOT_CAPACITY['방어구']);
  assert.ok(validateRuneSet(byHand).valid, '테스트가 쓰는 손 세트부터 불법이다');
  assert.ok(best.score >= scoreBA(byHand) - 1e-6,
    `손으로 짠 빛 세트(${scoreBA(byHand).toFixed(0)})보다 낮다: ${best.score.toFixed(0)} — ${best.set.join(', ')}`);
  // 가정을 안 켜면 작열은 0 이다. 그 사실 자체도 여기서 못박는다.
  assert.ok(scoreBA(byHand) > score(byHand), '기본 공격 가정을 켰는데 점수가 안 올랐다');
});

test('계열 문턱 룬을 넣을 때 문턱을 같이 채운다 — 황혼 숨결은 용 2개부터 값이 난다', () => {
  // 용 계열이 자기뿐이면 황혼 숨결은 통째로 0 이다. 파트너를 같이 심어야 봉우리에 오른다.
  const dragons = USABLE.filter((r) => RUNE_FAMILY[r.name.replace(/\+$/, '')] === '용')
    .filter((r) => r.slot === '방어구' && r.name !== '황혼 숨결').slice(0, 2).map((r) => r.name);
  const filler = USABLE.filter((r) => !RUNE_FAMILY[r.name.replace(/\+$/, '')] && r.slot === '방어구')
    .map((r) => r.name).slice(0, 3);
  const candidates = [...new Set(['황혼 숨결', ...dragons, ...filler])];
  const byHand = ['황혼 숨결', ...dragons];
  const best = run(candidates);
  assert.ok(best.score >= score(byHand) - 1e-6,
    `손으로 짠 용 세트(${score(byHand).toFixed(0)})보다 낮다: ${best.score.toFixed(0)} — ${best.set.join(', ')}`);
});

test('후보가 부위를 다 못 채워도 터지지 않는다', () => {
  const best = run(named('공허'));
  assert.deepEqual(best.set, ['공허']);
  assert.ok(Number.isFinite(best.score));
  const empty = run([]);
  assert.deepEqual(empty.set, []);
});

test('착용 세트가 불법이어도 합법인 답을 돌려준다', () => {
  // 저장분이 낡아 제약을 어기는 상태로 들어올 수 있다. 거기서 시작해도 답은 합법이어야 한다.
  const candidates = USABLE.map((r) => r.name);
  const illegal = USABLE.filter((r) => r.slot === '방어구').slice(0, 7).map((r) => r.name);
  const best = run(candidates, illegal);
  assert.ok(validateRuneSet(best.set).valid, `불법 착용에서 시작해 불법 답이 나왔다: ${best.set.join(', ')}`);
  for (const s of SLOT_ORDER) {
    assert.ok(best.set.filter((x) => slotOf(x) === s).length <= SLOT_CAPACITY[s], `${s} 정원 초과`);
  }
});

// ── 전수 대조 ─────────────────────────────────────────
//
// 위 테스트들은 "이 조합을 찾아내는가" 를 룬 이름으로 하나씩 못박는다. 그것만으로는
// **전체 품질이 나빠지는 것**을 못 잡는다 — 이름 붙은 조합은 그대로 찾으면서 다른 데서
// 조용히 뒤처질 수 있다. 그래서 작은 풀에서는 전수와 직접 대조한다.
//
// 파일 머리의 "제한 후보 풀 150회를 전수와 대조했다" 가 손으로 한 번 돌고 끝났던 그 확인을,
// 여기서 자동으로 되돌린다.

/** 풀 안의 모든 합법 세트를 세어 최고점을 찾는다. 작은 풀 전용. */
function exhaustive(pool) {
  const combos = (arr, k) => {
    if (k === 0) return [[]];
    if (arr.length < k) return [];
    const [h, ...t] = arr;
    return [...combos(t, k - 1).map((c) => [h, ...c]), ...combos(t, k)];
  };
  const by = {};
  for (const s of SLOT_ORDER) by[s] = pool.filter((n) => slotOf(n) === s);
  let best = null;
  let counted = 0;
  for (const w of combos(by['무기'], Math.min(SLOT_CAPACITY['무기'], by['무기'].length))) {
    for (const a of combos(by['방어구'], Math.min(SLOT_CAPACITY['방어구'], by['방어구'].length))) {
      for (const e of combos(by['엠블럼'], Math.min(SLOT_CAPACITY['엠블럼'], by['엠블럼'].length))) {
        const set = [...w, ...a, ...e];
        if (!validateRuneSet(set).valid) continue;
        counted++;
        const v = score(set);
        if (!best || v > best.score) best = { set, score: v };
      }
    }
  }
  return { ...best, counted };
}

/* 탐색이 실제로 최적을 놓치는 풀. 무작위 120회 전수 대조에서 나온 최악 사례를 그대로 굳혔다.
 *
 * 이 테스트는 **양방향으로** 신호를 준다:
 *   격차가 커지면 탐색이 나빠진 것이다.
 *   격차가 0 이 되면 고쳐진 것이니 이 테스트를 지우고 '일치한다' 로 바꿔라.
 * 원인은 계열 문턱이 만드는 두 칸 능선이다 — src/optimizer.mjs 머리 주석에 적어 두었다. */
test('알려진 능선에서 얼마나 뒤지는지 — 값이 움직이면 탐색이 달라진 것이다', () => {
  const pool = named(
    '광채+', '타오르는 영광', '암운+', '바위 칼날', '불꽃으로 새긴 문장', '금 간 봉인',
    '별바라기', '수호자', '맹세+', '그믐달', '두 영웅', '무너진 경계', '잠들지 않는 불',
    '봉인술사', '위대함', '빛바랜 별',
  );
  const ex = exhaustive(pool);
  const got = run(pool);
  assert.ok(ex.counted > 1000, `전수 대상이 너무 적다(${ex.counted}) — 풀이 바뀌었다`);
  assert.ok(got.score <= ex.score * (1 + 1e-9), '탐색이 전수 최적보다 높다 — 불법 세트를 셌다는 뜻이다');
  const gap = 1 - got.score / ex.score;
  assert.ok(gap < 0.006,
    `알려진 격차(0.39%)보다 나빠졌다: ${(gap * 100).toFixed(3)}%\n  전수: ${ex.set.join(' · ')}\n  탐색: ${got.set.join(' · ')}`);
});

/* 능선이 없는 평범한 풀에서는 전수와 정확히 같아야 한다.
 * 위 테스트가 '얼마나 나쁜가' 를 본다면 이쪽은 '평소에는 맞는가' 를 본다. */
test('평범한 작은 풀에서는 전수 최적과 일치한다', () => {
  const pools = [
    named('죽음', '바위 칼날', '계승자', '승전', '용 사냥꾼', '금 간 봉인', '끓는 피', '해방', '영원한 밤'),
    named('죽음', '태초', '계승자', '승전', '첫 번째 서약', '끓는 피', '녹슨 방패', '고결함', '해방'),
  ];
  for (const pool of pools) {
    const ex = exhaustive(pool);
    const got = run(pool);
    assert.ok(Math.abs(got.score - ex.score) < 1,
      `전수와 다르다\n  전수: ${ex.set.join(' · ')} (${ex.score})\n  탐색: ${got.set.join(' · ')} (${got.score})`);
  }
});

/* 프로브가 **실제로 값을 하는** 풀.
 *
 * 위의 이름 붙은 프로브 테스트(용의 문장·작열·황혼 숨결)는 프로브를 통째로 꺼도 통과한다 —
 * 그 조합들은 지금 평범한 등반으로도 닿기 때문이다. 즉 프로브가 조용히 죽어도 신호가 없었다.
 * 그래서 프로브를 껐을 때 답이 실제로 나빠지는 풀을 찾아 굳혔다(무작위 400회에서 추출).
 *
 * 여기서 이름을 대는 룬은 "이 룬이 정답" 이라서가 아니라 **프로브만이 넣을 수 있는 룬**이라서다.
 * 프로브가 죽으면 이 룬들이 답에서 사라지고 점수가 3.8% / 7.6% 낮아진다. */
test('계열 프로브가 죽으면 못 넣는 조합 — 오팔 성배가 답에 있어야 한다', () => {
  const pool = named(
    '죽음', '대군주+', '억눌린 충동', '바위 칼날', '타오르는 영광', '암운+', '계승자',
    '무한한 탐욕', '교차하는 사슬', '얼음 발톱', '황혼 숨결', '잿빛 장막', '오팔 성배',
    '삼키는 모래', '돌 심장', '가라앉은 왕국', '은빛 찬가', '악몽', '부서진 왕관', '공세+',
    '봉인술사', '해방', '원정대', '위대함', '영원한 밤',
  );
  const best = run(pool);
  assert.ok(best.set.includes('오팔 성배'),
    `계열 프로브가 안 돌았다 — 오팔 성배는 빛·어둠·용 2개씩 모여야 값이 나서 등반으로는 못 넣는다\n  ${best.set.join(' · ')}`);
});

test('용의 문장·저주 프로브가 죽으면 못 넣는 조합', () => {
  const pool = named(
    '오랜 광기', '대군주+', '타오르는 영광', '암운+', '공허', '서광', '가라앉은 왕국',
    '돌 심장', '별바라기', '녹슨 방패', '계승자', '얼음 발톱', '사슬로 묶은 법전',
    '잠들지 않는 불', '번개 숨결', '위엄', '아귀', '그믐달', '백금 천칭', '영원한 밤',
    '초월', '침묵',
  );
  const best = run(pool);
  for (const n of ['잠들지 않는 불', '별바라기']) {
    assert.ok(best.set.includes(n), `프로브가 안 돌았다 — ${n} 이 빠졌다\n  ${best.set.join(' · ')}`);
  }
});

// ── 막은 능선들 ────────────────────────────────────────
//
// 전체 풀 최악 2.05% → 0.26% 로 줄인 수정들을 각각 못박는다. 둘 다 조용히 되돌아갈 수
// 있는 종류다 — 답이 조금 나빠질 뿐 에러도 없고 세트는 여전히 합법이다.

/* ① '빼고 금지' 재등반이 저주 룬에만 걸려 있던 것.
 *
 * 문턱 룬이 낀 세트는 그 문턱을 열어주는 룬들까지 함께 굳어 클러스터가 된다. 무기만 바꿔도
 * 방어구만 바꿔도 내리막이라 등반이 못 빠져나온다. 빙결술사·궁수가 이것 때문에 1.3% 뒤졌다. */
test('계열 문턱 룬이 만든 클러스터에서 빠져나온다', () => {
  // 궁수 추진력 모델을 추가한 뒤 숲 길잡이가 정당하게 쐐기돌보다 좋은 답이 됐다.
  // 이 테스트는 점수표가 아니라 탐색의 클러스터 탈출을 고정하는 것이므로, 그 독립 변수를 뺀다.
  const pool = USABLE.filter((r) => r.name !== '숲 길잡이').map((r) => r.name);
  for (const job of ['빙결술사', '궁수']) {
    const p = sampleProfile({ job, assumeVulnerable: false, nightBlessingCycleSeconds: 0 });
    const s = (set) => evaluate(RUNES, set, 'expected', p).score;
    const best = optimizeSet({ candidates: pool, equipped: [], score: s, slotOf });
    // 쐐기돌(빛1·어둠1·용1)을 낀 답이 정답인 자리다. 클러스터에 갇히면 여기 못 온다.
    assert.ok(best.set.includes('쐐기돌'),
      `${job}: 클러스터에서 못 빠져나왔다\n  ${best.set.join(' · ')}`);
  }
});

/* ② PROBE_FLOOR 가 0.97 이라 −4.6% 짜리 씨앗을 재등반조차 안 하던 것.
 *
 * 검술사 전체 풀에서 날 선 적의(저주)를 넣으면 그 순간 −4.6% 다. 그런데 엠블럼까지 같이
 * 바꾸면 +2.1% 였다. 관문이 얕으면 씨앗을 심어 놓고 등반을 안 해서 영영 못 넘는다. */
test('깊은 씨앗도 재등반한다 — 저주 룬 능선', () => {
  const pool = USABLE.map((r) => r.name);
  const p = sampleProfile({ job: '검술사', assumeVulnerable: false, nightBlessingCycleSeconds: 0 });
  const s = (set) => evaluate(RUNES, set, 'expected', p).score;
  const best = optimizeSet({ candidates: pool, equipped: [], score: s, slotOf });
  assert.ok(best.set.includes('날 선 적의'),
    `저주 룬 능선을 못 넘었다 — 씨앗이 관문에서 막혔다는 뜻이다\n  ${best.set.join(' · ')}`);
});

/* 탐색기는 **후보 밖 착용 룬을 남긴다.** 등반은 바꾸거나 더할 뿐 빼지 않기 때문이다.
 *
 * 버그가 아니라 계약이다 — "지금 낀 것보다 나쁜 추천은 안 한다" 가 여기서 나온다.
 * 대신 **씨앗을 거르는 것은 호출자 몫**이다. 앱은 필터에 걸린 착용 룬을 씨앗에서 빼서
 * 넘긴다(rune-app 의 optimize). 그 책임이 어디 있는지 헷갈리면 필터가 조용히 무시된다. */
test('후보에 없는 착용 룬은 그대로 남는다 — 거르는 것은 호출자 몫이다', () => {
  const candidates = named('죽음', '침묵', '수호자', '금 간 봉인', '용 사냥꾼', '끓는 피', '해방');
  const equipped = named('죽음', '계승자', '침묵', '수호자', '금 간 봉인', '용 사냥꾼', '해방');
  assert.ok(!candidates.includes('계승자'), '이 테스트는 계승자가 후보 밖이라는 전제 위에 있다');

  const kept = run(candidates, equipped);
  assert.ok(kept.set.includes('계승자'),
    `후보 밖 착용 룬이 사라졌다 — 계약이 바뀌었으면 앱의 씨앗 거르기도 다시 봐야 한다\n  ${kept.set.join(' · ')}`);

  // 호출자가 씨앗을 거르면 빠진다. 앱이 하는 일이 이것이다.
  const dropped = run(candidates, equipped.filter((n) => candidates.includes(n)));
  assert.ok(!dropped.set.includes('계승자'),
    `씨앗을 걸렀는데도 남았다\n  ${dropped.set.join(' · ')}`);
  // 거르면 점수가 낮아질 수 있다. 그래서 앱이 그 사실을 화면에 밝힌다.
  assert.ok(dropped.score < kept.score, '이 풀에서는 거른 쪽이 낮아야 한다 — 전제가 낡았다');
});

test('고정 룬은 점수가 낮아도 추천에서 빠지지 않는다', () => {
  const candidates = named('죽음', '침묵', '수호자', '금 간 봉인', '용 사냥꾼', '끓는 피', '해방');
  const locked = candidates.find((n) => slotOf(n) === '방어구');
  const hostileScore = (set) => score(set) - (set.includes(locked) ? 1e12 : 0);
  const best = optimizeSet({ candidates, equipped: [locked], locked: [locked], score: hostileScore, slotOf });
  assert.ok(best.set.includes(locked), `${locked} 고정이 추천에서 빠졌다`);
});
