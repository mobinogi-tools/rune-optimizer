// 최적 세트 탐색.
//
// rune-app.mjs 안에 있던 것을 떼어냈다. DOM 모듈 안에 있는 동안은 테스트가 불가능해서,
// "제한 후보 풀 150회를 전수와 대조했다" 는 확인이 한 번 손으로 돌고 끝났다.
// 알고리즘은 그대로 옮겼고, 계열 프로브(아래)만 새로 붙였다.
//
// 점수 함수는 밖에서 받는다 — 프로필·시나리오·사용자 조정값은 앱의 상태이지 이 모듈의
// 관심사가 아니다. 그 덕에 테스트가 원하는 프로필로 이 탐색을 그대로 돌릴 수 있다.
import { SLOT_CAPACITY } from './build-evaluator.mjs';
import {
  validateRuneSet, DRAGON_SIGIL, CURSE_RUNES, RUNE_CONDITIONALS, RUNE_FAMILY, FAMILIES,
} from './rune-conditionals.mjs';

export const SLOT_ORDER = ['무기', '방어구', '엠블럼'];
const baseName = (n) => n.replace(/\+$/, '');

/* 점수와 별개인 추천 우선순위. 앞 원소부터 큰 쪽을 고르고, 전부 같을 때만 점수를 본다.
 * 목표 추가타율처럼 "먼저 이 조건을 채우고, 그 안에서 대미지를 고른다" 는 제약을
 * 점수에 거대한 가중치로 섞으면 화면에 돌려주는 기대 대미지까지 오염된다. */
function comparePriority(ctx, a, b) {
  if (!ctx.priority) return 0;
  const av = ctx.priority(a) ?? [];
  const bv = ctx.priority(b) ?? [];
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const d = (av[i] ?? 0) - (bv[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

function isBetter(ctx, aSet, aScore, bSet, bScore) {
  const p = comparePriority(ctx, aSet, bSet);
  return p > 0 || (p === 0 && aScore > bScore);
}

/* 우선순위가 좋아지는 씨앗은 대미지가 다소 내려가도 재등반해야 한다. 그 밖에는 기존의
 * 대미지 하한을 그대로 지켜 탐색 비용이 갑자기 불어나지 않게 한다. */
function clearsProbeFloor(ctx, set, setScore, best, floor) {
  return comparePriority(ctx, set, best.set) > 0 || setScore > best.score * floor;
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

/* 프로브 씨앗을 재등반해 볼 가치가 있다고 보는 하한(현 최고점 대비).
 *
 * 씨앗을 심으면 대개 점수가 **내려간다** — 그게 프로브의 전제다. 문제는 얼마나 내려간
 * 씨앗까지 되살려 보느냐다. 0.97 은 너무 얕아서 저주 룬 능선을 놓쳤다: 날 선 적의를 넣는
 * 순간 −4.6% 라 관문에서 막혔는데, 엠블럼까지 같이 바꾸면 +2.1% 였다(검술사, 전체 풀).
 * 0.93 이면 그 능선을 넘고, 더 내려도 6직업 전체 풀에서 더 얻는 것이 없었다.
 * 대신 탐색이 느려진다 — 전체 풀 냉시작 기준 직업당 약 390ms → 520ms. */
const PROBE_FLOOR = 0.93;

/* 계열(빛·어둠·용) 수에 값이 걸린 룬과, 몇 개까지 값이 오르는지.
 *
 * 같은 병이다 — 작열은 혼자 끼면 치확 3% 뿐이라 등반이 절대 안 넣는데, 빛 계열이 넷이면
 * 18% 다. 제한 후보 풀에서 이 차이가 최악 5.9% 로 나타났다(빛 룬이 이미 여럿 든 세트가
 * 우연히 만들어지지 않으면 작열은 영영 후보에 못 든다).
 *
 * 목록은 데이터에서 뽑는다. 손으로 적으면 새 룬이 들어올 때 갱신을 잊고, 잊어도
 * 아무 신호가 없다 — 그 룬이 추천에 안 나올 뿐이다. */
const FAMILY_SYNERGY = (() => {
  const out = {};
  for (const [name, entries] of Object.entries(RUNE_CONDITIONALS)) {
    const want = {};
    const bump = (f, k) => { want[f] = Math.max(want[f] ?? 0, k); };
    for (const e of entries) {
      if (e.requiresFamily) for (const [f, k] of Object.entries(e.requiresFamily)) bump(f, k);
      if (e.expectedFrom !== 'familySteps') continue;
      // '계열수' 는 서로 다른 계열의 가짓수라 계열마다 하나씩 있으면 천장이다.
      if (e.familyOf === '계열수') for (const f of FAMILIES) bump(f, 1);
      else bump(e.familyOf, e.steps.length);
    }
    if (Object.keys(want).length) out[name] = want;
  }
  return out;
})();

const famOf = (n) => RUNE_FAMILY[baseName(n)];

/** 그 룬이 원하는 계열 수가 이 세트에서 이미 채워져 있는가. */
function familyWantMet(set, want) {
  return Object.entries(want).every(([f, k]) => set.filter((n) => famOf(n) === f).length >= k);
}

/**
 * 계열 시너지 프로브. 룬 하나를 심고, 그 룬이 원하는 계열을 최선 룬으로 채운 뒤 재등반한다.
 * 용의 문장 쌍을 같이 심는 것과 같은 발상이고, 채울 개수만 데이터가 정한다.
 *
 * **이미 세트에 든 룬에도 돌려야 한다.** 문턱이 닫힌 채로 들어간 경우가 있기 때문이다 —
 * 오팔 성배는 스택 값만으로도 등반이 넣는데, 그러고 나면 "이미 있다" 며 프로브가 건너뛰어
 * 게이트가 영영 안 열렸다. 값이 통째로 빠진 채 최적이라고 내놓는다.
 */
function familyProbe(ctx, best, p, cand, want) {
  const { slotOf } = ctx;
  /* 이미 있으면 넣지 않는다 — bestInsertion 은 같은 룬을 한 번 더 넣어 중복을 만든다.
   * 그 경우에는 씨앗이 곧 현재 세트고, 아래 문턱 채우기부터 시작하면 된다. */
  let seeded = best.set.includes(p)
    ? { set: [...best.set], score: best.score }
    : bestInsertion(ctx, best.set, p);
  if (!seeded) return null;
  const pinned = new Set([p]);
  for (const [f, k] of Object.entries(want)) {
    while (seeded.set.filter((n) => famOf(n) === f).length < k) {
      let add = null;
      for (const s of SLOT_ORDER) {
        for (const c of cand[s]) {
          if (seeded.set.includes(c) || famOf(c) !== f) continue;
          const r = bestInsertion(ctx, seeded.set, c, pinned);
          if (r && (!add || isBetter(ctx, r.set, r.score, add.set, add.score))) add = { ...r, c };
        }
      }
      // 그 계열 룬이 후보에 더 없으면 여기서 멈춘다. 못 채운 채로도 등반은 해본다.
      if (!add) break;
      seeded = { set: add.set, score: add.score };
      pinned.add(add.c);
    }
  }
  return climb(ctx, greedyFill(ctx, seeded.set, cand), cand, new Set([p]), 4);
}

/** 언덕오르기 한 판. pinned 에 든 룬은 빼지 않는다(프로브가 심은 씨앗을 지키기 위해). */
function climb(ctx, start, cand, pinned = new Set(), maxPasses = 8) {
  const { score, slotOf } = ctx;
  pinned = new Set([...ctx.locked, ...pinned]);
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
          if (isBetter(ctx, next, v, cur, curScore)) { cur = next; curScore = v; improved = true; }
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
function bestInsertion(ctx, set, rune, pinned = new Set()) {
  const { score, slotOf } = ctx;
  pinned = new Set([...ctx.locked, ...pinned]);
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
      if (!best || isBetter(ctx, c, v, best.set, best.score)) best = { set: c, score: v };
    }
  }
  return best;
}

/** 축출로 생긴 빈 칸을 탐욕으로 채운다. */
function greedyFill(ctx, set, cand) {
  const { score, slotOf } = ctx;
  let cur = [...set];
  for (const s of SLOT_ORDER) {
    while (cur.filter((n) => slotOf(n) === s).length < SLOT_CAPACITY[s]) {
      let bestAdd = null;
      for (const c of cand[s]) {
        if (cur.includes(c)) continue;
        const next = [...cur, c];
        if (!validateRuneSet(next).valid) continue;
        const v = score(next);
        if (!bestAdd || isBetter(ctx, next, v, bestAdd.set, bestAdd.score)) bestAdd = { set: next, score: v };
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
 * **정확도는 후보 풀 크기에 크게 달라진다.**
 *
 *   제한 풀(보유 룬만 체크한 상황, 14~21개)  120회 완전 전수 대조 → 실패 2.5%, 최악 0.39%
 *   전체 풀(89개)                            직업 6개 → 5개 일치, 최악 0.26% (기사)
 *
 * 제한 풀 수치는 이 함수를 처음 만들 때의 측정(실패 10.7%·최악 −12.0% → 1.3%·−0.58%)과
 * 같은 크기다. **전체 풀은 그때 안 쟀고, 후보가 많을수록 능선이 많아진다.** 전체 풀
 * 기준선은 전수가 불가능해 제한을 건 다중 시작 좌표상승으로 잡았으므로, "이보다 나은
 * 답이 있다" 는 뜻이지 그 기준선이 최적이라는 보장은 아니다 — 실제 격차는 더 클 수 있다.
 *
 * 전체 풀 최악은 2.05% 였고 능선 셋을 막아 0.26% 로 줄였다. 무엇을 막았는지는 아래
 * 세 곳에 적어 두었다 — 계열 프로브의 '이미 있으면 건너뛴다'(문턱이 닫힌 채로 든 룬),
 * '빼고 금지' 재등반이 저주에만 걸려 있던 것, 그리고 PROBE_FLOOR 가 너무 얕았던 것.
 *
 * 남은 0.26%(기사)와 제한 풀의 0.39% 는 **세 칸을 동시에 바꿔야 넘는 능선**이라 지금
 * 구조로는 못 넘는다. 한 칸씩 옮기면 중간이 전부 내리막이고, 계열도 저주도 아니라
 * 붙일 프로브가 없다. 여기서 더 줄이려면 다중 시작이나 2-스왑이 필요하다.
 */
/* 정원을 넘긴 세트를 정원까지 줄인다.
 *
 * 등반은 **바꾸거나 더할 뿐 빼지 않는다.** 그래서 정원을 넘긴 세트에서 출발하면 끝까지
 * 넘긴 채로 나온다. 지금은 화면이 그 상태에서 결과를 막고 있어 사용자에게 안 보이지만,
 * 그건 이 함수의 보장이 아니라 호출부의 사정이다 — 저장분이 낡거나 호출부가 하나 늘면
 * 그대로 새어 나온다. 마지막의 안전망이 console.error 로 소리만 지르던 자리이기도 하다.
 *
 * 무엇을 뺄지는 점수가 정한다. 앞에서부터 자르면 좋은 룬이 먼저 날아갈 수 있다. */
function trimToCapacity(ctx, set) {
  const { score, slotOf } = ctx;
  let cur = [...set];
  for (const s of SLOT_ORDER) {
    while (cur.filter((n) => slotOf(n) === s).length > SLOT_CAPACITY[s]) {
      let keep = null;
      for (const n of cur.filter((x) => slotOf(x) === s && !ctx.locked.has(x))) {
        const next = cur.filter((x) => x !== n);
        const v = score(next);
        if (!keep || isBetter(ctx, next, v, keep.set, keep.score)) keep = { set: next, score: v };
      }
      cur = keep.set;
    }
  }
  return cur;
}

export function optimizeSet({ candidates, equipped, locked = [], score, priority, slotOf }) {
  const ctx = { score, priority, slotOf, locked: new Set(locked) };
  const cand = {};
  const eff = candidates;
  for (const s of SLOT_ORDER) cand[s] = eff.filter((n) => slotOf(n) === s);

  let best = climb(ctx, trimToCapacity(ctx, equipped), cand);

  for (const p of eff.filter((n) => PROBE_FAMILY.includes(baseName(n)))) {
    if (best.set.includes(p)) continue;
    let seeded = bestInsertion(ctx, best.set, p);
    if (!seeded) continue;
    if (DRAGON_FAMILY.includes(baseName(p))) {
      // 용의 문장은 파트너가 있어야 값이 난다 — 최선 파트너도 씨앗에 같이 심는다.
      let pair = null;
      for (const q of cand['방어구']) {
        if (q === p || seeded.set.includes(q) || !DRAGON_FAMILY.includes(baseName(q))) continue;
        const withQ = bestInsertion(ctx, seeded.set, q, new Set([p]));
        if (withQ && (!pair || isBetter(ctx, withQ.set, withQ.score, pair.set, pair.score))) pair = withQ;
      }
      if (pair && isBetter(ctx, pair.set, pair.score, seeded.set, seeded.score)) seeded = pair;
    }
    const filled = greedyFill(ctx, seeded.set, cand);
    // 씨앗이 현 최고점에 한참 못 미치면 재등반해도 못 뒤집는다. 비용을 아낀다.
    const filledScore = score(filled);
    if (clearsProbeFloor(ctx, filled, filledScore, best, PROBE_FLOOR)) {
      const probed = climb(ctx, filled, cand, new Set([p]), 4);
      if (isBetter(ctx, probed.set, probed.score, best.set, best.score)) best = probed;
    }
  }

  /* 계열 시너지 프로브. 위 프로브와 달리 '파트너를 몇 개 채울지' 를 데이터가 정한다.
   *
   * 세트에 이미 있어도 **문턱이 닫혀 있으면** 돌린다. 닫힌 채로 든 룬은 그 값을 못 받고
   * 있다는 뜻이고, 문턱을 채우는 것은 여러 칸을 동시에 바꾸는 일이라 등반이 못 한다. */
  for (const p of eff.filter((n) => FAMILY_SYNERGY[baseName(n)])) {
    const want = FAMILY_SYNERGY[baseName(p)];
    if (best.set.includes(p) && familyWantMet(best.set, want)) continue;
    const probed = familyProbe(ctx, best, p, cand, want);
    if (probed && isBetter(ctx, probed.set, probed.score, best.set, best.score)) best = probed;
  }

  /* 지금 낀 룬이 함정일 수 있다. 빼고 금지한 채 한 번 더 돈다.
   *
   * 저주 룬만 이 대접을 받고 있었는데 **계열 문턱 룬도 같은 병이다.** 문턱 룬이 낀 세트는
   * 그 문턱을 열어주는 룬들까지 함께 굳어 클러스터가 된다 — 무기만 바꿔도 방어구만 바꿔도
   * 내리막이라 등반이 못 빠져나온다. 실제로 그 능선 하나가 전체 풀에서 최악 2%였다. */
  for (const b of best.set.filter((n) => CURSE_RUNES.includes(baseName(n)) || FAMILY_SYNERGY[baseName(n)])) {
    // best 가 이 루프 안에서 바뀐다. 이미 빠진 룬을 또 뺄 필요는 없다.
    if (!best.set.includes(b) || ctx.locked.has(b)) continue;
    const cand2 = {};
    for (const s of SLOT_ORDER) cand2[s] = cand[s].filter((n) => n !== b);
    const dropped = greedyFill(ctx, best.set.filter((n) => n !== b), cand2);
    const droppedScore = score(dropped);
    if (clearsProbeFloor(ctx, dropped, droppedScore, best, 0.97)) {
      const probed = climb(ctx, dropped, cand2, new Set(), 4);
      if (isBetter(ctx, probed.set, probed.score, best.set, best.score)) best = probed;
    }
  }

  // 안전망 — 어떤 경로로도 정원을 넘긴 세트가 나오면 안 된다.
  for (const s of SLOT_ORDER) {
    const n = best.set.filter((x) => slotOf(x) === s).length;
    if (n > SLOT_CAPACITY[s]) console.error(`optimizeSet: ${s} ${n}개 (정원 ${SLOT_CAPACITY[s]})`);
  }
  return best;
}
